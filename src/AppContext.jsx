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
import { useExercisesData } from './hooks/useExercisesData';
import { useGapsData } from './hooks/useGapsData';
import { useMitreData } from './hooks/useMitreData';
import { useSimulationsData } from './hooks/useSimulationsData';
import { useExerciseActions } from './hooks/useExerciseActions';
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
 * 1. "Exercise" (Data Table: `exercises`, State: `exercises`)
 *    - An Exercise represents a single, atomic test of a specific TTP (e.g., T1048).
 *    - It contains the finding, outcome, remediation notes, and coverage rating.
 * 
 * 2. "Simulation" (Data Table: `simulations`, State: `simulationSummaries`)
 *    - A Simulation is an aggregate collection or "campaign" of multiple Exercises.
 *    - Example: "Q3 Ransomware Campaign".
 *    - It stores a JSONB summary block and evidence attachments.
 * 
 * 3. "Gap" (Data Table: `gaps`, State: `gaps`)
 *    - A Gap is a ticketing construct representing a missing control or coverage blindspot
 *      identified during an Exercise.
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
 * and business logic into modular custom hooks (e.g., `useExercisesData`, `useDbConnection`).
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
    const exData = useExercisesData(dbAdapter, addToast);
    const gapsData = useGapsData(dbAdapter, addToast);
    const simsData = useSimulationsData(dbAdapter, addToast);
    const tagsData = useTagsData();
    const securityControlsData = useSecurityControlsData();

    // 4. Mitre Hook
    const filteredExercisesForMitre = useMemo(() => {
        if (!exData.allExercisesData) return {};
        let filtered = exData.allExercisesData;

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
    }, [exData.allExercisesData, tagsData.activeTagFilter, securityControlsData.activeSecurityControlFilter, simsData.simulationSummaries]);

    const mitreHook = useMitreData(dbAdapter, filteredExercisesForMitre);

    // 5. Actions Hook (complex business logic)
    const actions = useExerciseActions({
        dbAdapter,
        exercisesPage: exData.exercisesPage,
        exercisesLimit: exData.exercisesLimit,
        fetchExercisesPage: exData.fetchExercisesPage,
        setExercises: exData.setExercises,
        allExercisesData: exData.allExercisesData,
        setAllExercisesData: exData.setAllExercisesData,
        gaps: gapsData.gaps,
        setGaps: gapsData.setGaps,
        loadMitreCoverage: () => {}, // Handled reactively now
        simulationSummaries: simsData.simulationSummaries,
        setSimulationSummaries: simsData.setSimulationSummaries,
        simulationEvidence: simsData.simulationEvidence,
        exercises: exData.exercises,
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
            await dbAdapter.saveData('exercises', []);
            await dbAdapter.saveData('gaps', []);
            await dbAdapter.saveData('simulationSummaries', {});
            await dbAdapter.saveData('simulationEvidence', {});

            const newExercises = [];
            const newSummaries = {};
            
            const possibleOutcomes = [
                { status: 'high', outcome: 'Missed ➔ Prevented ✓' },
                { status: 'medium', outcome: 'Missed ➔ Alerted ✓' },
                { status: 'minimal', outcome: 'Missed ➔ Logged ✓' },
                { status: 'low', outcome: 'Missed' }
            ];
            const severities = ['Critical', 'High', 'Medium', 'Low'];
            const envs = ['Windows Workstation', 'Linux Server', 'macOS Endpoint', 'AWS Cloud'];

            const ttpPool = ['T1190', 'T1059', 'T1547', 'T1134', 'T1562', 'T1003', 'T1082', 'T1021', 'T1115', 'T1041', 'T1485', 'T1078', 'T1566'];

            for (let s = 1; s <= 10; s++) {
                const simName = `Automated Simulation ${s}`;
                const testResults = [];
                const numExercises = Math.floor(Math.random() * 3) + 3; // 3 to 5 exercises

                for (let e = 1; e <= numExercises; e++) {
                    const outcomeObj = possibleOutcomes[Math.floor(Math.random() * possibleOutcomes.length)];
                    const severity = severities[Math.floor(Math.random() * severities.length)];
                    const env = envs[Math.floor(Math.random() * envs.length)];
                    const ttp = ttpPool[Math.floor(Math.random() * ttpPool.length)];

                    const ex = {
                        id: `auto-sim-${s}-ex-${e}`,
                        campaign: "Data Integrity Assessment",
                        simulation: simName,
                        finding: `Automated testing event ${e} for ${ttp}`,
                        remediation: `Event: Test remediation generated for outcome [${outcomeObj.outcome}]`,
                        environment: env,
                        date: new Date(Date.now() - Math.random() * 1000000000).toISOString(),
                        status: outcomeObj.status,
                        severity: severity,
                        ttp: ttp,
                        securityControls: ['CrowdStrike', 'Splunk'].slice(0, Math.floor(Math.random() * 2) + 1)
                    };
                    newExercises.push(ex);

                    testResults.push({
                        id: `proc-auto-${s}-${e}`,
                        name: `Procedure for ${ttp}`,
                        outcome: outcomeObj.outcome,
                        ttps: [ttp],
                        severity: severity,
                        detNotes: "Auto generated."
                    });
                }

                newSummaries[simName] = {
                    summary: `Automated test simulation #${s} execution to validate TTP mapping.`,
                    testResults: testResults
                };
            }

            if (typeof dbAdapter.bulkImport === 'function') {
                await dbAdapter.bulkImport({
                    exercises: newExercises,
                    gaps: [],
                    simulationSummaries: newSummaries,
                    simulationEvidence: {}
                });
            } else {
                await dbAdapter.saveData('exercises', newExercises);
                await dbAdapter.saveData('gaps', []);
                await dbAdapter.saveData('simulationSummaries', newSummaries);
                await dbAdapter.saveData('simulationEvidence', {});
            }

            await loadDataRef.current(dbAdapter);
            addToast("Successfully injected 10 Automated Simulations!", "success");
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
        // Exercises
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
        completeExercise: actions.completeExercise, updateExerciseValidation: actions.updateExerciseValidation, revertExerciseValidation: actions.revertExerciseValidation, deleteSimulation: actions.deleteSimulation,
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
