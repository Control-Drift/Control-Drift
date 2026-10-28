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

import { idbGet, idbSet } from './db/idbStorage';
import { lookupTTPName } from './mitreUtils';

const CTI_CACHE_KEY = 'mitre_cti_v2';
const CTI_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

let inMemoryCtiCache = null;
let inFlightCtiPromise = null;

/**
 * Strips noisy STIX markdown citation tags like (Citation: FireEye APT29 2020)
 * while preserving readable text and links.
 */
export function cleanStixDescription(text = '') {
    if (!text) return '';
    return String(text)
        .replace(/\(Citation:[^)]+\)/gi, '')
        .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

/**
 * Parses raw STIX 2.1 bundle objects into a compact, fast CTI Encyclopedia & Procedure index.
 */
function parseStixBundleForCti(stixData) {
    const objects = Array.isArray(stixData?.objects) ? stixData.objects : [];

    const tacticsByShortname = {};
    const attackPatternsByStixId = new Map();
    const techniquesById = {};
    const groupsByStixId = new Map();
    const softwareByStixId = new Map();
    const mitigationsByStixId = new Map();

    // Pass 1: Tactics
    objects.forEach((obj) => {
        if (obj.type === 'x-mitre-tactic' && obj.x_mitre_shortname) {
            tacticsByShortname[obj.x_mitre_shortname] = obj.name;
        }
    });

    // Pass 2: Attack Patterns (Techniques & Sub-techniques), Intrusion Sets (Groups), Malware/Tools, Mitigations
    objects.forEach((obj) => {
        if (obj.revoked || obj.x_mitre_deprecated) return;

        const mitreRef = obj.external_references?.find(
            (ref) => ref.source_name === 'mitre-attack' && ref.external_id
        );
        const externalId = mitreRef?.external_id ? String(mitreRef.external_id).toUpperCase() : '';
        const externalUrl = mitreRef?.url || '';

        if (obj.type === 'attack-pattern' && externalId) {
            const tactics = [];
            (obj.kill_chain_phases || []).forEach((phase) => {
                if (phase.kill_chain_name === 'mitre-attack') {
                    const tName = tacticsByShortname[phase.phase_name] || phase.phase_name;
                    if (tName && !tactics.includes(tName)) tactics.push(tName);
                }
            });

            const entry = {
                id: externalId,
                stixId: obj.id,
                name: obj.name || externalId,
                description: cleanStixDescription(obj.description || ''),
                detection: cleanStixDescription(obj.x_mitre_detection || ''),
                platforms: Array.isArray(obj.x_mitre_platforms) ? obj.x_mitre_platforms : [],
                dataSources: Array.isArray(obj.x_mitre_data_sources) ? obj.x_mitre_data_sources : [],
                permissionsRequired: Array.isArray(obj.x_mitre_permissions_required)
                    ? obj.x_mitre_permissions_required
                    : [],
                tactics,
                url: externalUrl,
                mitigations: [],
                procedureExamples: []
            };
            attackPatternsByStixId.set(obj.id, entry);
            techniquesById[externalId] = entry;
        } else if (obj.type === 'intrusion-set' && externalId) {
            const aliases = Array.isArray(obj.aliases)
                ? obj.aliases.filter((a) => a && a.toLowerCase() !== obj.name?.toLowerCase())
                : [];
            groupsByStixId.set(obj.id, {
                id: externalId,
                stixId: obj.id,
                name: obj.name || externalId,
                aliases,
                description: cleanStixDescription(obj.description || ''),
                url: externalUrl,
                ttps: [],
                software: []
            });
        } else if ((obj.type === 'malware' || obj.type === 'tool') && externalId) {
            const aliases = Array.isArray(obj.x_mitre_aliases)
                ? obj.x_mitre_aliases.filter((a) => a && a.toLowerCase() !== obj.name?.toLowerCase())
                : [];
            softwareByStixId.set(obj.id, {
                id: externalId,
                stixId: obj.id,
                name: obj.name || externalId,
                type: obj.type === 'malware' ? 'Malware' : 'Tool',
                aliases,
                platforms: Array.isArray(obj.x_mitre_platforms) ? obj.x_mitre_platforms : [],
                description: cleanStixDescription(obj.description || ''),
                url: externalUrl,
                ttps: [],
                usedByGroups: []
            });
        } else if (obj.type === 'course-of-action' && externalId && externalId.startsWith('M')) {
            mitigationsByStixId.set(obj.id, {
                id: externalId,
                stixId: obj.id,
                name: obj.name || externalId,
                description: cleanStixDescription(obj.description || ''),
                url: externalUrl
            });
        }
    });

    // Inherit parent tactics for sub-techniques if empty
    Object.values(techniquesById).forEach((tech) => {
        if (tech.id.includes('.') && tech.tactics.length === 0) {
            const parentId = tech.id.split('.')[0];
            if (techniquesById[parentId]?.tactics?.length) {
                tech.tactics = [...techniquesById[parentId].tactics];
            }
        }
    });

    // Pass 3: Relationships ('uses' and 'mitigates')
    objects.forEach((rel) => {
        if (rel.type !== 'relationship' || rel.revoked || rel.x_mitre_deprecated) return;
        const { relationship_type, source_ref, target_ref, description } = rel;
        const cleanDesc = cleanStixDescription(description || '').slice(0, 420);

        if (relationship_type === 'uses') {
            // Case A: Group uses Technique
            if (groupsByStixId.has(source_ref) && attackPatternsByStixId.has(target_ref)) {
                const group = groupsByStixId.get(source_ref);
                const tech = attackPatternsByStixId.get(target_ref);
                const isPreCompromiseOnly =
                    tech.tactics.length > 0 &&
                    tech.tactics.every(
                        (t) => t === 'Reconnaissance' || t === 'Resource Development'
                    );
                if (!isPreCompromiseOnly && !group.ttps.some((t) => t.id === tech.id)) {
                    group.ttps.push({
                        id: tech.id,
                        name: tech.name,
                        tactics: tech.tactics,
                        procedureDesc: cleanDesc
                    });
                }
                if (cleanDesc && tech.procedureExamples.length < 18) {
                    tech.procedureExamples.push({
                        actorId: group.id,
                        actorName: group.name,
                        actorType: 'Threat Group',
                        description: cleanDesc
                    });
                }
            }
            // Case B: Software (Malware/Tool) uses Technique
            else if (softwareByStixId.has(source_ref) && attackPatternsByStixId.has(target_ref)) {
                const sw = softwareByStixId.get(source_ref);
                const tech = attackPatternsByStixId.get(target_ref);
                if (!sw.ttps.some((t) => t.id === tech.id)) {
                    sw.ttps.push({
                        id: tech.id,
                        name: tech.name,
                        tactics: tech.tactics,
                        procedureDesc: cleanDesc
                    });
                }
                if (cleanDesc && tech.procedureExamples.length < 18) {
                    tech.procedureExamples.push({
                        actorId: sw.id,
                        actorName: sw.name,
                        actorType: sw.type,
                        description: cleanDesc
                    });
                }
            }
            // Case C: Group uses Software
            else if (groupsByStixId.has(source_ref) && softwareByStixId.has(target_ref)) {
                const group = groupsByStixId.get(source_ref);
                const sw = softwareByStixId.get(target_ref);
                if (!group.software.some((s) => s.id === sw.id)) {
                    group.software.push({
                        id: sw.id,
                        name: sw.name,
                        type: sw.type
                    });
                }
                if (!sw.usedByGroups.some((g) => g.id === group.id)) {
                    sw.usedByGroups.push({
                        id: group.id,
                        name: group.name
                    });
                }
            }
        } else if (relationship_type === 'mitigates') {
            if (mitigationsByStixId.has(source_ref) && attackPatternsByStixId.has(target_ref)) {
                const mit = mitigationsByStixId.get(source_ref);
                const tech = attackPatternsByStixId.get(target_ref);
                if (tech.mitigations.length < 8 && !tech.mitigations.some((m) => m.id === mit.id)) {
                    tech.mitigations.push({
                        id: mit.id,
                        name: mit.name,
                        description: cleanDesc || mit.description.slice(0, 280)
                    });
                }
            }
        }
    });

    // Sort groups and software by TTP count (most richly documented first) then alphabetically
    const groups = Array.from(groupsByStixId.values())
        .filter((g) => g.ttps.length > 0)
        .map((g) => {
            g.ttps.sort((a, b) => a.id.localeCompare(b.id));
            g.software.sort((a, b) => a.name.localeCompare(b.name));
            return {
                id: g.id,
                name: g.name,
                aliases: g.aliases,
                description: g.description,
                url: g.url,
                ttps: g.ttps,
                software: g.software
            };
        })
        .sort((a, b) => b.ttps.length - a.ttps.length || a.name.localeCompare(b.name));

    const software = Array.from(softwareByStixId.values())
        .filter((s) => s.ttps.length > 0)
        .map((s) => {
            s.ttps.sort((a, b) => a.id.localeCompare(b.id));
            return {
                id: s.id,
                name: s.name,
                type: s.type,
                aliases: s.aliases,
                platforms: s.platforms,
                description: s.description,
                url: s.url,
                ttps: s.ttps,
                usedByGroups: s.usedByGroups
            };
        })
        .sort((a, b) => b.ttps.length - a.ttps.length || a.name.localeCompare(b.name));

    // Clean stixId from techniquesById before caching
    Object.values(techniquesById).forEach((t) => {
        delete t.stixId;
    });

    return {
        groups,
        software,
        techniquesById
    };
}

/**
 * Loads the MITRE ATT&CK CTI Encyclopedia (Threat Groups, Malware/Tools, Technique Deep-Dive & Procedure Examples)
 * from IndexedDB cache or parses it from `/enterprise-attack.json`.
 */
export async function loadMitreCtiData() {
    if (inMemoryCtiCache) return inMemoryCtiCache;
    if (inFlightCtiPromise) return inFlightCtiPromise;

    inFlightCtiPromise = (async () => {
        try {
            const cached = await idbGet(CTI_CACHE_KEY);
            if (
                cached &&
                cached.timestamp &&
                Date.now() - cached.timestamp < CTI_CACHE_TTL_MS &&
                cached.data?.groups?.length > 0
            ) {
                inMemoryCtiCache = cached.data;
                return cached.data;
            }

            const res = await fetch('/enterprise-attack.json', { credentials: 'same-origin' });
            if (!res.ok) {
                throw new Error(`Failed to fetch enterprise-attack.json (${res.status})`);
            }
            const rawJson = await res.json();
            const parsed = parseStixBundleForCti(rawJson);

            inMemoryCtiCache = parsed;
            await idbSet(
                CTI_CACHE_KEY,
                {
                    timestamp: Date.now(),
                    data: parsed
                },
                { notifySync: false }
            );
            return parsed;
        } finally {
            inFlightCtiPromise = null;
        }
    })();

    return inFlightCtiPromise;
}

// High-signal behavioral heuristics for CTI reports that describe behaviors without explicit Txxxx IDs
const BEHAVIORAL_KEYWORD_PATTERNS = [
    { regex: /\b(powershell|pwsh|invoke-expression|iex\b|-enc\b|encodedcommand)\b/i, id: 'T1059.001', reason: 'PowerShell command execution reference' },
    { regex: /\b(cmd\.exe|command shell|batch script|\.bat\b|\.cmd\b)\b/i, id: 'T1059.003', reason: 'Windows Command Shell reference' },
    { regex: /\b(bash\b|\/bin\/sh\b|shell script)\b/i, id: 'T1059.004', reason: 'Unix Shell execution reference' },
    { regex: /\b(lsass|procdump|comsvcs\.dll|minidump|sekurlsa)\b/i, id: 'T1003.001', reason: 'LSASS memory credential dumping' },
    { regex: /\b(ntds\.dit|ntdsutil|vssadmin.*ntds)\b/i, id: 'T1003.003', reason: 'Active Directory NTDS.dit extraction' },
    { regex: /\b(dcsync|drsuapi|lsadump::dcsync)\b/i, id: 'T1003.006', reason: 'DCSync domain controller replication' },
    { regex: /\b(kerberoast|invoke-kerberoast|spn ticket)\b/i, id: 'T1558.003', reason: 'Kerberoasting service ticket extraction' },
    { regex: /\b(schtasks|scheduled task|register-scheduledtask)\b/i, id: 'T1053.005', reason: 'Scheduled Task persistence/execution' },
    { regex: /\b(wmic\b|wmiexec|invoke-wmimethod|win32_process)\b/i, id: 'T1047', reason: 'Windows Management Instrumentation (WMI)' },
    { regex: /\b(vssadmin.*delete.*shadows|wbadmin.*delete|bcdedit.*recoveryenabled)\b/i, id: 'T1490', reason: 'Inhibit System Recovery / Shadow Copy deletion' },
    { regex: /\b(reg\s+add.*\\run\b|currentversion\\run)\b/i, id: 'T1547.001', reason: 'Registry Run Keys / Startup Folder persistence' },
    { regex: /\b(rundll32)\b/i, id: 'T1218.011', reason: 'Rundll32 signed binary proxy execution' },
    { regex: /\b(certutil\s+-urlcache|certutil\s+-decode)\b/i, id: 'T1140', reason: 'Certutil decode / ingress tool transfer' },
    { regex: /\b(nltest\s+\/domain_trusts|dsquery.*trust)\b/i, id: 'T1482', reason: 'Domain Trust Discovery' },
    { regex: /\b(psexec|paexec|smb.*service.*execution)\b/i, id: 'T1569.002', reason: 'Service Execution (PsExec)' },
    { regex: /\b(rdp\b|remote desktop|mstsc)\b/i, id: 'T1021.001', reason: 'Remote Desktop Protocol (RDP) lateral movement' },
    { regex: /\b(pass-the-hash|pth\b|overpass-the-hash)\b/i, id: 'T1550.002', reason: 'Pass the Hash lateral authentication' },
    { regex: /\b(spearphishing attachment|malicious macro|malicious document)\b/i, id: 'T1566.001', reason: 'Spearphishing Attachment initial access' },
    { regex: /\b(spearphishing link|credential harvesting link)\b/i, id: 'T1566.002', reason: 'Spearphishing Link initial access' },
    { regex: /\b(dll side-loading|dll sideloading)\b/i, id: 'T1574.002', reason: 'DLL Side-Loading defense evasion' },
    { regex: /\b(rclone|megasync|mega\.nz.*exfil)\b/i, id: 'T1567.002', reason: 'Exfiltration to Cloud Storage' },
    { regex: /\b(wevtutil\s+cl\b|clear-eventlog)\b/i, id: 'T1070.001', reason: 'Clear Windows Event Logs' }
];

/**
 * Deterministically analyzes a pasted Threat Intelligence Report / Advisory to extract:
 * 1. Explicit MITRE ATT&CK Technique IDs (Txxxx / Txxxx.yyy)
 * 2. Referenced Threat Groups (by name or alias)
 * 3. Referenced Malware & Red Team Tools (by name or alias)
 * 4. Behavioral Keyword-Matched Techniques
 */
export function analyzeThreatAdvisoryText(rawText = '', mitreData = {}, ctiData = null) {
    const text = String(rawText || '');
    if (!text.trim()) {
        return {
            extractedTTPs: [],
            matchedGroups: [],
            matchedSoftware: []
        };
    }

    const ttpMap = new Map();
    const matchedGroups = [];
    const matchedSoftware = [];

    const addTtp = (id, sourceLabel, snippet = '') => {
        const cleanId = String(id || '').trim().toUpperCase();
        if (!/^T\d{4}(?:\.\d{3})?$/.test(cleanId)) return;
        const name =
            ctiData?.techniquesById?.[cleanId]?.name ||
            lookupTTPName(mitreData, cleanId) ||
            cleanId;

        if (!ttpMap.has(cleanId)) {
            ttpMap.set(cleanId, {
                id: cleanId,
                name,
                sources: [sourceLabel],
                comment: snippet || `Extracted via ${sourceLabel}`
            });
        } else {
            const existing = ttpMap.get(cleanId);
            if (!existing.sources.includes(sourceLabel)) {
                existing.sources.push(sourceLabel);
                existing.comment = `${existing.comment} | ${sourceLabel}`;
            }
        }
    };

    // 1. Explicit TTP ID regex extraction
    const explicitMatches = text.match(/\bT\d{4}(?:\.\d{3})?\b/gi) || [];
    explicitMatches.forEach((m) => {
        addTtp(m.toUpperCase(), 'Explicit TTP ID in Advisory');
    });

    // 2. Match Threat Groups by Name or Alias
    if (ctiData?.groups) {
        const lowerText = text.toLowerCase();
        ctiData.groups.forEach((g) => {
            const candidates = [g.name, g.id, ...(g.aliases || [])].filter(
                (term) => term && term.length >= 4
            );
            const hit = candidates.find((term) => {
                const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                return new RegExp(`\\b${escaped}\\b`, 'i').test(lowerText);
            });
            if (hit) {
                matchedGroups.push({ ...g, matchedTerm: hit });
            }
        });
    }

    // 3. Match Malware & Tools by Name
    if (ctiData?.software) {
        const lowerText = text.toLowerCase();
        // Exclude overly generic common English words from software auto-matching unless exact
        const genericStopwords = new Set([
            'at', 'arp', 'net', 'ip', 'ping', 'route', 'find', ' expand', 'replace', ' Tor', 'raw'
        ]);
        ctiData.software.forEach((sw) => {
            if (sw.name.length < 4 || genericStopwords.has(sw.name.toLowerCase())) return;
            const escaped = sw.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            if (new RegExp(`\\b${escaped}\\b`, 'i').test(lowerText)) {
                matchedSoftware.push(sw);
            }
        });
    }

    // 4. Behavioral heuristic matching
    BEHAVIORAL_KEYWORD_PATTERNS.forEach((rule) => {
        if (rule.regex.test(text)) {
            addTtp(rule.id, `Behavioral Match (${rule.reason})`);
        }
    });

    return {
        extractedTTPs: Array.from(ttpMap.values()),
        matchedGroups: matchedGroups.slice(0, 8),
        matchedSoftware: matchedSoftware.slice(0, 12)
    };
}

/**
 * 7 Post-Compromise Cyber Kill Chain Phases aligned with industry Cyber Kill Chain /
 * Unified Kill Chain verbiage (excluding pre-compromise OSINT Reconnaissance & Resource Development).
 */
export const CYBER_KILL_CHAIN_PHASES = [
    {
        id: 'ckc-delivery',
        phaseNumber: 1,
        name: 'Delivery & Initial Access',
        shortName: '1. Delivery & Initial Access',
        description: 'Breaching the perimeter via spearphishing, public-facing exploits, or valid accounts',
        color: '#22d3ee',
        tactics: ['Initial Access'],
        recommendedPerPhase: 2
    },
    {
        id: 'ckc-exploitation',
        phaseNumber: 2,
        name: 'Exploitation & Execution',
        shortName: '2. Exploitation & Execution',
        description: 'Executing adversary code, command/script interpreters (PowerShell, CMD), or client exploits',
        color: '#22d3ee',
        tactics: ['Execution'],
        recommendedPerPhase: 2
    },
    {
        id: 'ckc-installation',
        phaseNumber: 3,
        name: 'Installation & Evasion',
        shortName: '3. Installation & Evasion',
        description: 'Establishing persistent footholds, escalating privileges, and evading host defenses',
        color: '#22d3ee',
        tactics: ['Persistence', 'Privilege Escalation', 'Defense Evasion'],
        recommendedPerPhase: 2
    },
    {
        id: 'ckc-internal-recon-creds',
        phaseNumber: 4,
        name: 'Internal Recon & Credential Access',
        shortName: '4. Internal Recon & Creds',
        description: 'Harvesting credentials/LSASS/tickets and enumerating hosts, domain trusts, and accounts',
        color: '#22d3ee',
        tactics: ['Credential Access', 'Discovery'],
        recommendedPerPhase: 2
    },
    {
        id: 'ckc-lateral',
        phaseNumber: 5,
        name: 'Lateral Movement',
        shortName: '5. Lateral Movement',
        description: 'Pivoting across internal systems using RDP, SMB/Admin Shares, WinRM, or alternate auth material',
        color: '#22d3ee',
        tactics: ['Lateral Movement'],
        recommendedPerPhase: 2
    },
    {
        id: 'ckc-c2',
        phaseNumber: 6,
        name: 'Command & Control (C2)',
        shortName: '6. Command & Control',
        description: 'Establishing covert C2 beacons, web/DNS channels, proxies, and ingress tool transfers',
        color: '#22d3ee',
        tactics: ['Command and Control'],
        recommendedPerPhase: 2
    },
    {
        id: 'ckc-objectives',
        phaseNumber: 7,
        name: 'Actions on Objectives',
        shortName: '7. Actions on Objectives',
        description: 'Collecting and archiving target data, exfiltrating over C2/cloud, or executing final impact',
        color: '#22d3ee',
        tactics: ['Collection', 'Exfiltration', 'Impact'],
        recommendedPerPhase: 2
    }
];

/**
 * Deterministically maps a MITRE ATT&CK technique to its primary Cyber Kill Chain phase.
 * Returns null if the technique only belongs to pre-compromise Reconnaissance / Resource Development.
 */
export function resolveKillChainPhaseForTtp(ttp) {
    const rawTactics = Array.isArray(ttp?.tactics) ? ttp.tactics : [];
    const inEnvTactics = rawTactics.filter(
        (t) => t !== 'Reconnaissance' && t !== 'Resource Development'
    );

    if (inEnvTactics.length === 0 && rawTactics.length > 0) {
        return null; // Pure pre-compromise Recon / Resource Development
    }

    if (inEnvTactics.includes('Initial Access')) {
        return CYBER_KILL_CHAIN_PHASES[0];
    }
    if (inEnvTactics.includes('Lateral Movement')) {
        return CYBER_KILL_CHAIN_PHASES[4];
    }
    if (inEnvTactics.includes('Command and Control')) {
        return CYBER_KILL_CHAIN_PHASES[5];
    }
    if (
        inEnvTactics.includes('Collection') ||
        inEnvTactics.includes('Exfiltration') ||
        inEnvTactics.includes('Impact')
    ) {
        return CYBER_KILL_CHAIN_PHASES[6];
    }
    if (inEnvTactics.includes('Credential Access') || inEnvTactics.includes('Discovery')) {
        return CYBER_KILL_CHAIN_PHASES[3];
    }
    // Pure Execution (e.g. T1059.001 PowerShell, T1203, T1204, T1047 WMI, T1106 Native API)
    if (
        inEnvTactics.includes('Execution') &&
        !inEnvTactics.includes('Persistence') &&
        !inEnvTactics.includes('Privilege Escalation') &&
        !inEnvTactics.includes('Defense Evasion')
    ) {
        return CYBER_KILL_CHAIN_PHASES[1];
    }
    if (
        inEnvTactics.includes('Persistence') ||
        inEnvTactics.includes('Privilege Escalation') ||
        inEnvTactics.includes('Defense Evasion')
    ) {
        return CYBER_KILL_CHAIN_PHASES[2];
    }
    if (inEnvTactics.includes('Execution')) {
        return CYBER_KILL_CHAIN_PHASES[1];
    }
    return CYBER_KILL_CHAIN_PHASES[2];
}

const HIGH_IMPACT_CHOKE_POINT_PREFIXES = [
    'T1003', // OS Credential Dumping (LSASS, NTDS, SAM, DCSync)
    'T1059', // Command and Scripting Interpreter (PowerShell, CMD, etc.)
    'T1055', // Process Injection
    'T1053', // Scheduled Task/Job
    'T1547', // Boot or Logon Autostart Execution
    'T1543', // Create or Modify System Process
    'T1021', // Remote Services (RDP, SMB, WinRM, SSH)
    'T1550', // Use Alternate Authentication Material (PtH, PtT)
    'T1558', // Steal or Forge Kerberos Tickets (Kerberoasting, Golden Ticket)
    'T1190', // Exploit Public-Facing Application
    'T1203', // Exploitation for Client Execution
    'T1068', // Exploitation for Privilege Escalation
    'T1210', // Exploitation of Remote Services
    'T1078', // Valid Accounts
    'T1105', // Ingress Tool Transfer
    'T1071', // Application Layer Protocol (Web/DNS C2)
    'T1560', // Archive Collected Data
    'T1041', // Exfiltration Over C2 Channel
    'T1567', // Exfiltration Over Web Service
    'T1486', // Data Encrypted for Impact
    'T1490'  // Inhibit System Recovery
];

const CLI_ARTIFACT_REGEX =
    /\b(cmd(?:\.exe)?|powershell(?:\.exe)?|rundll32|regsvr32|schtasks|wmic|psexec|mimikatz|cobalt|lsass|ntds\.dit|vssadmin|wevtutil|nltest|certutil|bitsadmin|mshta|cscript|wscript|HKLM|HKCU|AppData|ProgramData|System32|-enc|\.dll|\.exe|\.ps1|\.bat|\.vbs)\b/i;

const CONDUIT_BASE_IDS = new Set([
    // Execution Interpreters, APIs & Invocation Conduits
    'T1059', // Command and Scripting Interpreter (PowerShell, CMD, VBScript, Python, Bash, JS, Lua, Cloud API, etc.)
    'T1106', // Native API (Win32 / NT Syscalls)
    'T1047', // Windows Management Instrumentation (WMI)
    'T1569', // System Services (Service Execution / sc.exe / psexecsvc)
    'T1204', // User Execution (Malicious File / Link / Macro invocation)
    'T1559', // Inter-Process Communication (COM, DDE, XPC)
    'T1129', // Shared Modules (Dynamic Library Loader)
    'T1609', // Container Administration Command (docker exec / kubectl exec)
    'T1651', // Cloud Administration Command (AWS SSM Run Command / Azure RunCommand)
    'T1072', // Software Deployment Tools
    'T1610', // Deploy Container
    'T1648', // Serverless Execution
    'T1203'  // Exploitation for Client Execution
]);

const MODIFIER_BASE_IDS = new Set([
    // Obfuscation, Encoding, Encryption & Network Cloaking Modifiers
    'T1027', // Obfuscated Files or Information (Packing, Base64, Steganography, Stripped Payloads)
    'T1140', // Deobfuscate/Decode Files or Information (certutil -decode, Base64 decode)
    'T1001', // Data Obfuscation
    'T1573', // Encrypted Channel
    'T1090', // Proxy (Multi-hop, Domain Fronting, SOCKS)
    'T1572', // Protocol Tunneling
    'T1571', // Non-Standard Port
    'T1008', // Fallback Channels
    'T1132', // Data Encoding
    // Binary & Script Proxy Execution (LOLBins & Signed Wrappers)
    'T1218', // System Binary Proxy Execution (Rundll32, Regsvr32, Mshta, Msiexec, InstallUtil, CMSTP, etc.)
    'T1216', // System Script Proxy Execution (PubPrn, SyncAppvPublishingServer)
    'T1127', // Trusted Developer Utilities Proxy Execution (MSBuild, dnx, rcsi)
    'T1202', // Indirect Command Execution (forfiles, pcalua, wlrmdr)
    'T1220', // XSL Script Processing (wmic os get /format:)
    'T1221', // Template Injection
    'T1197', // BITS Jobs
    'T1620', // Reflective Code Loading
    // Token, Privilege & Authentication Context Modifiers
    'T1134', // Access Token Manipulation (Token Impersonation, Make & Impersonate Token, PPID Spoofing)
    'T1548', // Abuse Elevation Control Mechanism (UAC Bypass, Sudo Caching, Setuid)
    'T1550', // Use Alternate Authentication Material (Pass the Hash / Pass the Ticket / App Token)
    'T1078', // Valid Accounts (Identity context modifier when paired with an Anchor; promotes to Anchor if standalone)
    // Masquerading, Trust Subversion & Artifact Hiding
    'T1036', // Masquerading (Rename System Utilities, Match Legitimate Name/Location, Double Extension)
    'T1564', // Hide Artifacts (Hidden Files, Hidden Window, NTFS ADS, Hidden Users)
    'T1553', // Subvert Trust Controls (Mark-of-the-Web Bypass, Code Signing, Install Root Certificate)
    'T1222', // File and Directory Permissions Modification (icacls, chmod, takeown)
    'T1006', // Direct Volume Access
    // Anti-Analysis & Post-Execution Cleanup Modifiers
    'T1497', // Virtualization/Sandbox Evasion
    'T1622', // Debugger Evasion
    'T1070'  // Indicator Removal (File Deletion, Timestomp, Clear Command History)
]);

// Modifiers that represent high-value tradecraft capable of promoting to an Anchor Objective
// whenever no other Anchor Objective exists in their operational affinity domain
const PROMOTABLE_MODIFIER_BASE_IDS = new Set([
    'T1550', // Pass the Hash / Pass the Ticket / Web Session Cookie
    'T1548', // UAC Bypass / Elevation Control Abuse
    'T1134', // Access Token Manipulation / PPID Spoofing
    'T1218', // Signed Binary Proxy Execution (Rundll32, Regsvr32, Mshta)
    'T1127', // Trusted Developer Utilities Proxy Execution (MSBuild)
    'T1620', // Reflective Code Loading
    'T1078'  // Valid Accounts (when tested as a standalone initial access / auth event)
]);

// Sub-techniques of Modifier parents that are always standalone high-severity Anchor Objectives
const EXPLICIT_ANCHOR_IDS = new Set([
    'T1070.001', // Clear Windows Event Logs (wevtutil cl Security / Clear-EventLog)
    'T1070.002', // Clear Linux or Mac System Logs
    'T1070.008', // Clear Mailbox Data
    'T1562.001', // Disable or Modify Security Tools
    'T1562.002', // Disable Windows Event Logging (ETW Tampering)
    'T1562.004', // Disable or Modify System Firewall
    'T1562.008'  // Disable or Modify Cloud Logs
]);

const PRECURSOR_BASE_IDS = new Set([
    // Discovery (Host, Process, Architecture, User, Group, Time, Driver, Cloud)
    'T1082', // System Information Discovery
    'T1083', // File and Directory Discovery
    'T1057', // Process Discovery
    'T1016', // System Network Configuration Discovery
    'T1033', // System Owner/User Discovery
    'T1049', // System Network Connections Discovery
    'T1087', // Account Discovery
    'T1069', // Permission Groups Discovery
    'T1018', // Remote System Discovery
    'T1135', // Network Share Discovery
    'T1012', // Query Registry
    'T1518', // Software Discovery
    'T1007', // System Service Discovery
    'T1124', // System Time Discovery
    'T1046', // Network Service Discovery
    'T1482', // Domain Trust Discovery
    'T1615', // Group Policy Discovery
    'T1201', // Password Policy Discovery
    'T1010', // Application Window Discovery
    'T1217', // Browser Information Discovery
    'T1580', // Cloud Infrastructure Discovery
    'T1538', // Cloud Service Dashboard
    'T1526', // Cloud Service Discovery
    'T1619', // Cloud Storage Object Discovery
    'T1613', // Container and Resource Discovery
    'T1652', // Device Driver Discovery
    'T1654', // Log Enumeration
    'T1040', // Network Sniffing
    'T1120', // Peripheral Device Discovery
    'T1614', // System Location Discovery
    // Reconnaissance & Staging Precursors
    'T1595', // Active Scanning
    'T1592', // Gather Victim Host Info
    'T1589', // Gather Victim Identity Info
    'T1590', // Gather Victim Network Info
    'T1598', // Phishing for Information
    'T1593', // Search Open Websites/Domains
    'T1594', // Search Victim-Owned Websites
    'T1596', // Search Open Technical Databases
    'T1597', // Search Closed Sources
    'T1586', // Compromise Accounts (Recon/Prep)
    'T1583', // Acquire Infrastructure
    'T1584', // Compromise Infrastructure
    'T1591', // Gather Victim Org Info
    'T1063', // Security Software Discovery (Legacy)
    'T1081'  // Credentials in Registry (Discovery)
]);

// Comprehensive base-ID domain affinity tables so even bare { id, name } TTPs (without .tactics) map accurately
const EVASION_INJECTION_BASE_IDS = new Set([
    'T1055', 'T1562', 'T1070', 'T1574', 'T1497', 'T1622', 'T1057', 'T1518', 'T1218', 'T1216', 'T1127',
    'T1134', 'T1548', 'T1620', 'T1036', 'T1564', 'T1553', 'T1222', 'T1027', 'T1140', 'T1006', 'T1652'
]);
const CREDENTIAL_HARVEST_BASE_IDS = new Set([
    'T1003', 'T1558', 'T1555', 'T1552', 'T1110', 'T1556', 'T1056', 'T1539', 'T1528', 'T1606', 'T1649',
    'T1187', 'T1212', 'T1557', 'T1040', 'T1087', 'T1069', 'T1033', 'T1201', 'T1482', 'T1615', 'T1217'
]);
const LATERAL_PIVOT_BASE_IDS = new Set([
    'T1021', 'T1550', 'T1570', 'T1210', 'T1563', 'T1534', 'T1072', 'T1080',
    'T1018', 'T1135', 'T1049', 'T1016', 'T1046'
]);
const COLLECTION_EXFIL_IMPACT_BASE_IDS = new Set([
    'T1005', 'T1039', 'T1025', 'T1114', 'T1119', 'T1113', 'T1115', 'T1123', 'T1125', 'T1213', 'T1530', 'T1602',
    'T1560', 'T1074', 'T1041', 'T1048', 'T1567', 'T1020', 'T1030', 'T1029', 'T1011', 'T1052',
    'T1485', 'T1486', 'T1490', 'T1489', 'T1491', 'T1561', 'T1529', 'T1498', 'T1499', 'T1496', 'T1657',
    'T1083', 'T1619'
]);
const C2_STAGING_BASE_IDS = new Set([
    'T1071', 'T1105', 'T1573', 'T1090', 'T1219', 'T1095', 'T1572', 'T1102', 'T1104', 'T1092', 'T1132',
    'T1001', 'T1008', 'T1568', 'T1571'
]);

/**
 * Classifies any MITRE ATT&CK technique into its realistic endpoint behavioral role:
 * - ANCHOR: Culminating objective/action that drives behavioral detection when executed with its precursors/conduit.
 * - CONDUIT: Execution interpreter or invocation mechanism (e.g., PowerShell, CMD, WMI, Native API).
 * - MODIFIER: Evasion, obfuscation, masquerading, or LOLBin proxy modifier applied to an Anchor payload.
 * - PRECURSOR: Contextual discovery/enumeration that only generates baseline logs alone and must fuse into an Anchor phase.
 */
export function classifyTtpOperationalRole(ttp) {
    const rawId = String(typeof ttp === 'string' ? ttp : ttp?.id || '').toUpperCase().trim();
    const baseId = rawId.split('.')[0];
    const cachedTech = inMemoryCtiCache?.techniquesById?.[rawId] || inMemoryCtiCache?.techniquesById?.[baseId];
    const tactics = Array.isArray(ttp?.tactics) && ttp.tactics.length > 0
        ? ttp.tactics
        : Array.isArray(cachedTech?.tactics)
        ? cachedTech.tactics
        : [];

    // Determine operational affinity domain so precursors/conduits/modifiers bind to the right Anchor
    let affinityDomain = 'foothold_persistence';
    if (CREDENTIAL_HARVEST_BASE_IDS.has(baseId) || tactics.includes('Credential Access')) {
        affinityDomain = 'credential_harvest';
    } else if (LATERAL_PIVOT_BASE_IDS.has(baseId) || tactics.includes('Lateral Movement')) {
        affinityDomain = 'lateral_pivot';
    } else if (
        COLLECTION_EXFIL_IMPACT_BASE_IDS.has(baseId) ||
        tactics.includes('Collection') ||
        tactics.includes('Exfiltration') ||
        tactics.includes('Impact')
    ) {
        affinityDomain = 'collection_exfil_impact';
    } else if (
        C2_STAGING_BASE_IDS.has(baseId) ||
        (tactics.length === 1 && tactics[0] === 'Command and Control')
    ) {
        affinityDomain = 'c2_staging';
    } else if (EVASION_INJECTION_BASE_IDS.has(baseId)) {
        affinityDomain = 'evasion_injection';
    }

    // Priority 1: Check Precursor (Discovery & Reconnaissance)
    const isDiscoveryOrRecon =
        PRECURSOR_BASE_IDS.has(baseId) ||
        (tactics.length > 0 && tactics.every((t) => t === 'Discovery' || t === 'Reconnaissance'));
    if (isDiscoveryOrRecon) {
        return {
            role: 'PRECURSOR',
            label: 'Contextual Precursor',
            shortLabel: 'Precursor',
            affinityDomain,
            canPromoteToAnchor: false,
            color: '#94a3b8',
            bg: 'rgba(148, 163, 184, 0.12)',
            border: 'rgba(148, 163, 184, 0.28)',
            description: 'Contextual host, network, or domain discovery that gathers situational awareness to feed an operational objective.'
        };
    }

    // Priority 2: Check Conduit (Execution interpreters, APIs & invocation mechanisms)
    if (CONDUIT_BASE_IDS.has(baseId)) {
        return {
            role: 'CONDUIT',
            label: 'Execution Conduit',
            shortLabel: 'Conduit',
            affinityDomain,
            canPromoteToAnchor: false,
            color: '#a78bfa',
            bg: 'rgba(167, 139, 250, 0.12)',
            border: 'rgba(167, 139, 250, 0.32)',
            description: 'Command interpreter, native API, or execution conduit used to invoke precursors and Anchor Objectives.'
        };
    }

    // Priority 3: Check Modifier (Obfuscation, LOLBin proxies, token manipulation, masquerading & cleanup)
    if (MODIFIER_BASE_IDS.has(baseId) && !EXPLICIT_ANCHOR_IDS.has(rawId)) {
        return {
            role: 'MODIFIER',
            label: 'Tradecraft Modifier',
            shortLabel: 'Modifier',
            affinityDomain,
            canPromoteToAnchor: PROMOTABLE_MODIFIER_BASE_IDS.has(baseId),
            color: '#f472b6',
            bg: 'rgba(244, 114, 182, 0.12)',
            border: 'rgba(244, 114, 182, 0.32)',
            description: 'Obfuscation, masquerading, token manipulation, or proxy execution modifier applied directly to an Anchor payload.'
        };
    }

    // Priority 4: Anchor Objectives (Culminating objectives: Credential Access, Persistence, Injection, Defense Impairment, Collection, Exfiltration, Impact, Lateral Movement)
    return {
        role: 'ANCHOR',
        label: 'Anchor Objective',
        shortLabel: 'Anchor',
        affinityDomain,
        canPromoteToAnchor: true,
        color: '#22d3ee',
        bg: 'rgba(6, 182, 212, 0.12)',
        border: 'rgba(6, 182, 212, 0.32)',
        description: 'Culminating adversarial action that anchors a compound behavioral event.'
    };
}

const DOMAIN_METADATA = {
    foothold_persistence: {
        title: 'Execution & Persistent Foothold',
        shortTitle: 'Persistent Foothold',
        order: 1
    },
    evasion_injection: {
        title: 'Defense Evasion & Process Manipulation',
        shortTitle: 'Process & Defense Evasion',
        order: 2
    },
    credential_harvest: {
        title: 'Internal Enumeration & Credential Harvesting',
        shortTitle: 'Credential Harvesting',
        order: 3
    },
    lateral_pivot: {
        title: 'Remote Discovery & Lateral Movement Pivot',
        shortTitle: 'Lateral Movement Pivot',
        order: 4
    },
    c2_staging: {
        title: 'Ingress Staging & C2 Channel Establishment',
        shortTitle: 'C2 & Tool Staging',
        order: 5
    },
    collection_exfil_impact: {
        title: 'Data Discovery, Archive Staging & Exfiltration',
        shortTitle: 'Collection, Staging & Exfil',
        order: 6
    }
};

/**
 * Finds the best companion Anchor Objective TTP within an adversary's profile
 * for any Precursor, Conduit, or Modifier technique.
 */
function findBestCompanionAnchor(supporterTtp, anchorCandidates = []) {
    if (!anchorCandidates || anchorCandidates.length === 0) return null;
    const supRole = supporterTtp.operationalRole || classifyTtpOperationalRole(supporterTtp);
    const supTools = new Set(supporterTtp.matchedTools || []);
    const supText = (supporterTtp.procedureDesc || supporterTtp.externalComment || '').toLowerCase();

    let bestAnchor = null;
    let bestScore = -1;

    anchorCandidates.forEach((anchor) => {
        if (anchor.id === supporterTtp.id) return;
        const ancRole = anchor.operationalRole || classifyTtpOperationalRole(anchor);
        let score = (anchor.priorityScore || 25) * 0.35;

        if (ancRole.affinityDomain === supRole.affinityDomain) {
            score += 40;
        }
        // Check shared actor tool
        const sharedTool = (anchor.matchedTools || []).some((t) => supTools.has(t));
        if (sharedTool) {
            score += 32;
        }
        // Check shared CLI artifacts in STIX procedure descriptions
        const ancText = (anchor.procedureDesc || anchor.externalComment || '').toLowerCase();
        if (supText && ancText) {
            const keywords = ['powershell', 'cmd', 'schtasks', 'rundll32', 'reg', 'lsass', 'rar', '7z', 'zip', 'smb', 'rdp', 'wmi', 'service'];
            for (const kw of keywords) {
                if (supText.includes(kw) && ancText.includes(kw)) {
                    score += 15;
                    break;
                }
            }
        }
        if (anchor.category !== 'coveredFresh') {
            score += 10;
        }

        if (score > bestScore) {
            bestScore = score;
            bestAnchor = anchor;
        }
    });

    return bestAnchor;
}

const HUMANIZED_TECHNIQUE_TITLES = {
    'T1574.001': 'DLL Search Order Hijacking',
    'T1574.002': 'DLL Side-Loading Execution',
    'T1574.006': 'Dynamic Linker Hijacking',
    'T1574.011': 'Services Registry Permissions Hijack',
    'T1574.012': 'COR_PROFILER Environment Hijack',
    'T1003': 'OS Credential Harvesting',
    'T1003.001': 'LSASS Memory Credential Dump',
    'T1003.002': 'SAM Registry Hive Extraction',
    'T1003.003': 'Active Directory NTDS.dit Extraction',
    'T1003.004': 'LSA Secrets Registry Extraction',
    'T1003.006': 'DCSync Domain Credential Replication',
    'T1558.003': 'Kerberoasting Service Ticket Harvest',
    'T1558.004': 'AS-REP Roasting Pre-Auth Extraction',
    'T1555': 'Password Store Credential Harvesting',
    'T1555.003': 'Browser Credential Vault Harvesting',
    'T1555.004': 'Windows Credential Manager Extraction',
    'T1552.001': 'Cleartext Credentials in Files Search',
    'T1552.002': 'Registry Credential Harvesting',
    'T1552.004': 'Private Key Material Harvesting',
    'T1053': 'Scheduled Task Persistence',
    'T1053.005': 'Scheduled Task Foothold Persistence',
    'T1547.001': 'Registry Run Key Persistence',
    'T1543.003': 'Malicious Windows Service Creation',
    'T1546.003': 'WMI Event Subscription Persistence',
    'T1078': 'Compromised Account Abuse',
    'T1078.001': 'Default Account Abuse',
    'T1078.002': 'Domain Account Intrusion',
    'T1078.003': 'Local Account Privilege Abuse',
    'T1078.004': 'Cloud Account Session Abuse',
    'T1070.001': 'Windows Security Event Log Tampering',
    'T1070.003': 'Command History Tampering',
    'T1070.004': 'Forensic Artifact File Deletion',
    'T1070.006': 'Timestomped Artifact Manipulation',
    'T1562.001': 'Defensive Control & Sensor Tampering',
    'T1562.002': 'Windows Event Logging Impairment',
    'T1562.004': 'Host Firewall Rule Modification',
    'T1055': 'Cross-Process Memory Injection',
    'T1055.001': 'DLL Process Injection',
    'T1055.012': 'Process Hollowing Injection',
    'T1021.001': 'RDP Lateral Movement Pivot',
    'T1021.002': 'SMB Admin Share Lateral Pivot',
    'T1021.003': 'DCOM Remote Execution Pivot',
    'T1021.006': 'WinRM Remote Session Pivot',
    'T1550.002': 'Pass-the-Hash Lateral Authentication',
    'T1550.003': 'Pass-the-Ticket Kerberos Pivot',
    'T1560': 'Collected Data Archive Staging',
    'T1560.001': 'Encrypted Utility Archive Staging',
    'T1074.001': 'Local Directory Data Staging',
    'T1005': 'Local File System Data Collection',
    'T1041': 'C2 Channel Data Exfiltration',
    'T1048': 'Alternative Protocol Exfiltration',
    'T1567.002': 'Cloud Storage Exfiltration',
    'T1105': 'Remote Payload & Tool Ingress Transfer',
    'T1071.001': 'Web Protocol C2 Beaconing',
    'T1071.004': 'DNS Tunneling C2 Communication',
    'T1090': 'Connection Proxy C2 Routing',
    'T1219': 'Remote Access Tool Deployment',
    'T1486': 'Ransomware File Encryption Impact',
    'T1490': 'Shadow Copy & Backup Deletion',
    'T1489': 'Critical Service Termination',
    'T1068': 'Kernel / Local Privilege Escalation',
    'T1548.002': 'UAC Bypass Privilege Elevation',
    'T1134': 'Access Token Manipulation',
    'T1134.001': 'Token Impersonation & Theft'
};

/**
 * Translates terse or generic MITRE ATT&CK technique names (such as "DLL" for T1574.001
 * or "LSASS Memory" for T1003.001) into descriptive, title-worthy operational phrases.
 */
export function humanizeTechniqueActionName(ttpOrId, fallbackName = '') {
    const rawId = String(typeof ttpOrId === 'object' ? ttpOrId?.id : ttpOrId || '')
        .toUpperCase()
        .trim();
    const baseId = rawId.split('.')[0];
    const rawName = String(
        (typeof ttpOrId === 'object' ? ttpOrId?.name : fallbackName) || ''
    ).trim();

    if (HUMANIZED_TECHNIQUE_TITLES[rawId]) {
        return HUMANIZED_TECHNIQUE_TITLES[rawId];
    }
    if (!rawName && HUMANIZED_TECHNIQUE_TITLES[baseId]) {
        return HUMANIZED_TECHNIQUE_TITLES[baseId];
    }

    // Disambiguate ultra-short or ambiguous sub-technique names
    const lower = rawName.toLowerCase();
    if (lower === 'dll') return 'DLL Search Order Hijacking';
    if (lower === 'lsass memory') return 'LSASS Memory Credential Dump';
    if (lower === 'ntds') return 'Active Directory NTDS Extraction';
    if (lower === 'security account manager') return 'SAM Hive Credential Extraction';
    if (lower === 'clear windows event logs') return 'Windows Event Log Tampering';
    if (lower === 'valid accounts') return 'Compromised Account Abuse';
    if (lower === 'ingress tool transfer') return 'Remote Tool Ingress Staging';
    if (lower === 'credentials from web browsers') return 'Browser Credential Vault Harvesting';
    if (lower === 'exploitation for privilege escalation') return 'Local Privilege Escalation Exploit';
    if (lower === 'archive via utility') return 'Encrypted Archive Staging';

    return rawName || HUMANIZED_TECHNIQUE_TITLES[baseId] || rawId || 'Operational Validation';
}

/**
 * Synthesizes a concise, unique, title-worthy operational event name from a 4-component bucket
 * without repetitive boilerplate like "Contextual Recon + Evasive Staging ➔ ...".
 */
export function buildCompoundEventTitle(bucket) {
    const anchors = bucket?.anchors || [];
    const conduits = bucket?.conduits || [];
    const precursors = bucket?.precursors || [];
    const modifiers = bucket?.modifiers || [];

    const anchorPhrases = anchors.map((a) => humanizeTechniqueActionName(a));
    const primaryAnchorText =
        anchorPhrases.length > 0 ? anchorPhrases.join(' & ') : 'Operational Validation';

    // Determine specific tradecraft qualifier from Modifiers, Conduits, or Precursors
    let qualifier = '';
    const modIds = modifiers.map((m) => String(m.id || '').toUpperCase());
    const condIds = conduits.map((c) => String(c.id || '').toUpperCase());
    const precIds = precursors.map((p) => String(p.id || '').toUpperCase());

    if (modIds.some((id) => id === 'T1070.006')) {
        qualifier = 'Timestomped';
    } else if (modIds.some((id) => id.startsWith('T1140'))) {
        qualifier = 'Certutil-Decoded';
    } else if (modIds.some((id) => id.startsWith('T1027'))) {
        qualifier = 'Obfuscated';
    } else if (modIds.some((id) => id.startsWith('T1036'))) {
        qualifier = 'Masqueraded';
    } else if (modIds.some((id) => id.startsWith('T1218'))) {
        const proxyName = modifiers.find((m) => String(m.id || '').startsWith('T1218'))?.name;
        qualifier = proxyName && proxyName.length <= 16 ? `${proxyName}-Proxied` : 'LOLBin-Proxied';
    } else if (modIds.some((id) => id.startsWith('T1564'))) {
        qualifier = 'Stealth-Hidden';
    } else if (condIds.includes('T1047')) {
        qualifier = 'WMI-Brokered';
    } else if (condIds.includes('T1059.001') && condIds.length === 1) {
        qualifier = 'PowerShell';
    } else if (condIds.includes('T1059.003') && condIds.length === 1) {
        qualifier = 'CMD-Driven';
    } else if (precIds.includes('T1049') || precIds.includes('T1016') || precIds.includes('T1018')) {
        qualifier = 'Network-Mapped';
    } else if (precIds.includes('T1057')) {
        qualifier = 'Process-Targeted';
    } else if (precIds.includes('T1012')) {
        qualifier = 'Registry-Guided';
    } else if (precIds.includes('T1083')) {
        qualifier = 'File-Targeted';
    } else if (precIds.includes('T1087') || precIds.includes('T1069')) {
        qualifier = 'Account-Enumerated';
    } else if (precIds.includes('T1082')) {
        qualifier = 'Host-Profiled';
    }

    if (qualifier && !primaryAnchorText.toLowerCase().includes(qualifier.toLowerCase())) {
        return `${qualifier} ${primaryAnchorText}`;
    }
    return primaryAnchorText;
}

/**
 * Deterministically clusters any list of selected TTPs into cohesive Compound Operational Events.
 * Every Precursor (Discovery), Conduit (Interpreter), and Modifier (Obfuscation/Masquerading/Proxy)
 * is fused into the Culminating Anchor event it supports so they execute as a single process tree
 * and are graded as a single compound event in Step 3.
 */
export function clusterTTPsIntoCompoundEvents(ttpList = [], entityName = 'Adversary') {
    if (!Array.isArray(ttpList) || ttpList.length === 0) {
        return {
            compoundEvents: [],
            hasAnchor: false,
            anchorCount: 0,
            supporterCount: 0
        };
    }

    const enriched = ttpList.map((t) => {
        const opRole = t.operationalRole || classifyTtpOperationalRole(t);
        return {
            ...t,
            operationalRole: opRole
        };
    });

    const rawAnchors = enriched.filter((t) => t.operationalRole.role === 'ANCHOR');
    const anchorDomains = new Set(
        rawAnchors.map((a) => a.operationalRole.affinityDomain || 'foothold_persistence')
    );

    // Contextual Role Promotion:
    // If a domain has no explicit Anchor (e.g. the user scoped Pass-the-Hash T1550.002 without T1021,
    // or UAC Bypass T1548.002 / Rundll32 T1218.011 / Valid Accounts T1078 without a separate downstream Anchor in that domain),
    // promote the first promotable Modifier in that domain to act as the Anchor Objective.
    const promotedIds = new Set();
    enriched.forEach((t) => {
        if (t.operationalRole.role === 'MODIFIER' && t.operationalRole.canPromoteToAnchor) {
            const dom = t.operationalRole.affinityDomain || 'foothold_persistence';
            if (!anchorDomains.has(dom)) {
                promotedIds.add(t.id);
                anchorDomains.add(dom);
            }
        }
    });

    const anchors = enriched.filter(
        (t) => t.operationalRole.role === 'ANCHOR' || promotedIds.has(t.id)
    );
    const supporters = enriched.filter(
        (t) => t.operationalRole.role !== 'ANCHOR' && !promotedIds.has(t.id)
    );

    // If the user only selected Precursors/Conduits/Modifiers without any Anchor Objective,
    // bundle them into a single compound group rather than fragmenting them, and flag hasAnchor: false.
    if (anchors.length === 0) {
        const conduits = supporters.filter((t) => t.operationalRole.role === 'CONDUIT');
        const precursors = supporters.filter((t) => t.operationalRole.role === 'PRECURSOR');
        const modifiers = supporters.filter((t) => t.operationalRole.role === 'MODIFIER');
        const ordered = [...conduits, ...precursors, ...modifiers];
        return {
            compoundEvents: [
                {
                    eventNumber: 1,
                    domain: ordered[0]?.operationalRole?.affinityDomain || 'foothold_persistence',
                    title: `${entityName} Host Situational Awareness & Execution Setup`,
                    anchors: [],
                    conduits,
                    precursors,
                    modifiers,
                    allTtps: ordered,
                    ttpIds: ordered.map((t) => t.id),
                    isMissingAnchor: true
                }
            ],
            hasAnchor: false,
            anchorCount: 0,
            supporterCount: supporters.length
        };
    }

    // Group Anchors by operational affinity domain, keeping at most 2 Anchors per Compound Event
    // (or up to 3 for collection_exfil_impact where Collect + Archive + Exfil form a single natural pipeline)
    const domainAnchorGroups = new Map();
    anchors.forEach((anc) => {
        const dom = anc.operationalRole.affinityDomain || 'foothold_persistence';
        if (!domainAnchorGroups.has(dom)) {
            domainAnchorGroups.set(dom, []);
        }
        domainAnchorGroups.get(dom).push(anc);
    });

    const rawBuckets = [];
    Array.from(domainAnchorGroups.entries())
        .sort(
            (a, b) =>
                (DOMAIN_METADATA[a[0]]?.order || 99) - (DOMAIN_METADATA[b[0]]?.order || 99)
        )
        .forEach(([dom, domAnchors]) => {
            const maxPerBucket = dom === 'collection_exfil_impact' ? 3 : 2;
            for (let i = 0; i < domAnchors.length; i += maxPerBucket) {
                rawBuckets.push({
                    domain: dom,
                    anchors: domAnchors.slice(i, i + maxPerBucket),
                    conduits: [],
                    precursors: [],
                    modifiers: []
                });
            }
        });

    // Assign every Supporter (Conduit, Precursor, Modifier) to its best matching Anchor bucket
    supporters.forEach((sup) => {
        const supRole = sup.operationalRole;
        let bestBucket = rawBuckets[0];
        let bestScore = -999;

        rawBuckets.forEach((bucket) => {
            let score = 0;
            // 1. Direct companionAnchor match
            if (
                sup.companionAnchor?.id &&
                bucket.anchors.some((a) => a.id === sup.companionAnchor.id)
            ) {
                score += 60;
            }
            // 2. Affinity domain match
            if (bucket.domain === supRole.affinityDomain) {
                score += 40;
            }
            // 3. Shared actor tool or CLI keywords with bucket anchors
            const supTools = new Set(sup.matchedTools || []);
            if (
                bucket.anchors.some((a) =>
                    (a.matchedTools || []).some((tool) => supTools.has(tool))
                )
            ) {
                score += 25;
            }
            // 4. Slight penalty for already-crowded supporter buckets to distribute conduits/modifiers naturally
            const currentSupCount =
                bucket.conduits.length + bucket.precursors.length + bucket.modifiers.length;
            score -= currentSupCount * 6;

            if (score > bestScore) {
                bestScore = score;
                bestBucket = bucket;
            }
        });

        if (supRole.role === 'CONDUIT') {
            bestBucket.conduits.push(sup);
        } else if (supRole.role === 'PRECURSOR') {
            bestBucket.precursors.push(sup);
        } else {
            bestBucket.modifiers.push(sup);
        }
    });

    // Build descriptive Compound Operational Event objects
    const compoundEvents = rawBuckets.map((bucket, idx) => {
        const allTtps = [
            ...bucket.conduits,
            ...bucket.precursors,
            ...bucket.modifiers,
            ...bucket.anchors
        ];
        const baseMeta =
            DOMAIN_METADATA[bucket.domain]?.shortTitle || 'Operational Objective';
        const title = buildCompoundEventTitle(bucket);

        return {
            eventNumber: idx + 1,
            domain: bucket.domain,
            domainTitle: DOMAIN_METADATA[bucket.domain]?.title || baseMeta,
            title,
            anchors: bucket.anchors,
            conduits: bucket.conduits,
            precursors: bucket.precursors,
            modifiers: bucket.modifiers,
            allTtps,
            ttpIds: allTtps.map((t) => t.id),
            isMissingAnchor: false
        };
    });

    return {
        compoundEvents,
        hasAnchor: true,
        anchorCount: anchors.length,
        supporterCount: supporters.length
    };
}

/**
 * Synthesizes up to 4 realistic, ready-to-scope Adversary Operational Chains
 * from a threat group's documented STIX techniques.
 * Each chain fuses the actor's Conduit + Precursor Discovery + Evasion Modifier + Culminating Anchor.
 */
function buildAdversaryOperationalChains(enrichedAllTTPs = []) {
    if (!Array.isArray(enrichedAllTTPs) || enrichedAllTTPs.length === 0) return [];

    const anchors = enrichedAllTTPs.filter((t) => t.operationalRole?.role === 'ANCHOR');
    const conduits = enrichedAllTTPs.filter((t) => t.operationalRole?.role === 'CONDUIT');
    const modifiers = enrichedAllTTPs.filter((t) => t.operationalRole?.role === 'MODIFIER');
    const precursors = enrichedAllTTPs.filter((t) => t.operationalRole?.role === 'PRECURSOR');

    if (anchors.length === 0) return [];

    // Sort candidates by priorityScore descending, preferring uncovered/decayed first
    const sortByPriority = (arr) =>
        [...arr].sort((a, b) => {
            const aCov = a.category === 'coveredFresh' ? 1 : 0;
            const bCov = b.category === 'coveredFresh' ? 1 : 0;
            if (aCov !== bCov) return aCov - bCov;
            return (b.priorityScore || 0) - (a.priorityScore || 0);
        });

    const sortedConduits = sortByPriority(conduits);
    const sortedModifiers = sortByPriority(modifiers);
    const sortedPrecursors = sortByPriority(precursors);

    const domainOrder = [
        'foothold_persistence',
        'credential_harvest',
        'evasion_injection',
        'lateral_pivot',
        'collection_exfil_impact',
        'c2_staging'
    ];

    const chains = [];
    const usedConduitIds = new Set();
    const usedPrecursorIds = new Set();
    const usedModifierIds = new Set();

    domainOrder.forEach((dom) => {
        if (chains.length >= 4) return;
        const domAnchors = sortByPriority(
            anchors.filter((a) => a.operationalRole?.affinityDomain === dom)
        );
        if (domAnchors.length === 0) return;

        // Pick top 1 Anchor (or 2 if collection_exfil_impact where Archive + Exfil pair together)
        const chosenAnchors =
            dom === 'collection_exfil_impact' && domAnchors.length >= 2
                ? domAnchors.slice(0, 2)
                : [domAnchors[0]];

        const chainTtps = [];
        const addUnique = (item) => {
            if (item && !chainTtps.some((x) => x.id === item.id)) {
                chainTtps.push(item);
            }
        };

        // 1. Add best Conduit (prefer unused conduit or one sharing a tool with chosenAnchors)
        const anchorTools = new Set(chosenAnchors.flatMap((a) => a.matchedTools || []));
        const matchingConduit =
            sortedConduits.find(
                (c) =>
                    !usedConduitIds.has(c.id) &&
                    (c.matchedTools || []).some((tool) => anchorTools.has(tool))
            ) ||
            sortedConduits.find((c) => !usedConduitIds.has(c.id)) ||
            sortedConduits[0];
        if (matchingConduit) {
            addUnique(matchingConduit);
            usedConduitIds.add(matchingConduit.id);
        }

        // 2. Add best Precursor (prefer same domain & unused, else unused, else top precursor)
        const matchingPrecursor =
            sortedPrecursors.find(
                (p) =>
                    !usedPrecursorIds.has(p.id) &&
                    p.operationalRole?.affinityDomain === dom
            ) ||
            sortedPrecursors.find((p) => p.operationalRole?.affinityDomain === dom) ||
            sortedPrecursors.find((p) => !usedPrecursorIds.has(p.id)) ||
            sortedPrecursors[0];
        if (matchingPrecursor) {
            addUnique(matchingPrecursor);
            usedPrecursorIds.add(matchingPrecursor.id);
        }

        // 3. Add best Modifier if available (only when unused or specifically matching tool/domain)
        if (
            sortedModifiers.length > 0 &&
            (dom === 'foothold_persistence' ||
                dom === 'evasion_injection' ||
                dom === 'credential_harvest')
        ) {
            const matchingModifier =
                sortedModifiers.find(
                    (m) =>
                        !usedModifierIds.has(m.id) &&
                        (m.matchedTools || []).some((tool) => anchorTools.has(tool))
                ) || sortedModifiers.find((m) => !usedModifierIds.has(m.id));
            if (matchingModifier) {
                addUnique(matchingModifier);
                usedModifierIds.add(matchingModifier.id);
            }
        }

        // 4. Culminating Anchor(s)
        chosenAnchors.forEach((a) => addUnique(a));

        if (chainTtps.length >= 2) {
            const meta = DOMAIN_METADATA[dom] || {
                title: 'Compound Operational Chain',
                shortTitle: 'Operational Chain'
            };
            chains.push({
                id: `chain-${dom}`,
                domain: dom,
                title: meta.title,
                shortTitle: meta.shortTitle,
                primaryAnchor: chosenAnchors[0],
                ttps: chainTtps,
                ttpIds: chainTtps.map((t) => t.id),
                uncoveredCount: chainTtps.filter((t) => t.category !== 'coveredFresh').length
            });
        }
    });

    return chains;
}

/**
 * Computes a selective Priority & Impact score (0-100), Priority Tier, and human-readable
 * Priority Reasons for a technique within an adversary's profile.
 */
function evaluateTtpPriorityAndImpact(ttpItem, toolUsageMap, ctiData) {
    let score = 0;
    const reasons = [];

    const matchedTools = toolUsageMap.get(ttpItem.id) || [];
    const stixTech = ctiData?.techniquesById?.[ttpItem.id];
    const globalActorCount = Array.isArray(stixTech?.procedureExamples)
        ? stixTech.procedureExamples.length
        : 0;
    const procText = (ttpItem.procedureDesc || ttpItem.externalComment || '').trim();
    const hasCliIndicators = CLI_ARTIFACT_REGEX.test(procText);
    const hasDetailedNarrative = procText.length >= 165;
    const isSubTechnique = String(ttpItem.id || '').includes('.');
    const baseId = String(ttpItem.id || '').split('.')[0];
    const ttpTactics = Array.isArray(ttpItem.tactics) ? ttpItem.tactics : [];
    const isPassiveDiscoveryOnly =
        ttpTactics.length > 0 && ttpTactics.every((t) => t === 'Discovery');
    const isChokePoint = HIGH_IMPACT_CHOKE_POINT_PREFIXES.includes(baseId);

    // 1. Defensive Posture / Exposure Weight (0 - 40 pts)
    // Ordinary 'untested' only gets +8 baseline so scores aren't artificially inflated across the board
    if (ttpItem.category === 'exposedGap') {
        score += 40;
    } else if (ttpItem.category === 'decayed') {
        score += 26;
    } else if (ttpItem.category === 'untested') {
        score += 8;
    }

    // 2. Adversary Arsenal Tool Convergence (0 - 28 pts)
    if (matchedTools.length >= 3) {
        score += 28;
        reasons.push({
            label: `Core Arsenal (${matchedTools.slice(0, 2).join(', ')} +${matchedTools.length - 2})`,
            type: 'tool',
            color: '#c084fc',
            bg: 'rgba(192, 132, 252, 0.14)',
            border: 'rgba(192, 132, 252, 0.35)'
        });
    } else if (matchedTools.length === 2) {
        score += 22;
        reasons.push({
            label: `Core Arsenal (${matchedTools.join(', ')})`,
            type: 'tool',
            color: '#c084fc',
            bg: 'rgba(192, 132, 252, 0.14)',
            border: 'rgba(192, 132, 252, 0.35)'
        });
    } else if (matchedTools.length === 1) {
        score += 12;
        reasons.push({
            label: `Used by ${matchedTools[0]}`,
            type: 'tool',
            color: '#c084fc',
            bg: 'rgba(192, 132, 252, 0.14)',
            border: 'rgba(192, 132, 252, 0.35)'
        });
    }

    // 3. Concrete CLI / Artifact Intelligence in STIX Procedure (0 - 16 pts)
    if (hasCliIndicators && hasDetailedNarrative) {
        score += 16;
        reasons.push({
            label: 'Executable CLI Tradecraft',
            type: 'cti',
            color: '#38bdf8',
            bg: 'rgba(56, 189, 248, 0.12)',
            border: 'rgba(56, 189, 248, 0.3)'
        });
    } else if (hasCliIndicators || hasDetailedNarrative) {
        score += 10;
        reasons.push({
            label: 'Documented Tradecraft',
            type: 'cti',
            color: '#38bdf8',
            bg: 'rgba(56, 189, 248, 0.12)',
            border: 'rgba(56, 189, 248, 0.3)'
        });
    }

    // 4. Kill Chain Choke-Point Criticality vs Passive Discovery (0 - 12 pts)
    if (isChokePoint && !isPassiveDiscoveryOnly) {
        score += 12;
        reasons.push({
            label: 'High-Impact Choke Point',
            type: 'chokepoint',
            color: '#f59e0b',
            bg: 'rgba(245, 158, 11, 0.12)',
            border: 'rgba(245, 158, 11, 0.3)'
        });
    } else if (!isPassiveDiscoveryOnly) {
        score += 5;
    }

    // 5. Sub-Technique Execution Precision & Global Prevalence (0 - 6 pts)
    if (isSubTechnique) {
        score += 4;
    }
    if (globalActorCount >= 14) {
        score += 2;
    }

    score = Math.min(100, score);
    const operationalRole = classifyTtpOperationalRole(ttpItem);

    return {
        ...ttpItem,
        matchedTools,
        globalActorCount,
        isPassiveDiscoveryOnly,
        isChokePoint,
        operationalRole,
        priorityScore: score,
        priorityTier: 'MEDIUM',
        priorityColor: '#38bdf8',
        priorityReasons: reasons
    };
}

/**
 * Organizes an adversary's or report's evaluated TTPs into the 7 Cyber Kill Chain Phases,
 * calibrating Priority Tiers selectively so only the true top choke points are CRITICAL / HIGH.
 */
export function buildKillChainBoardForEntity(evaluatedTTPs = [], entitySoftware = [], ctiData = null) {
    // Map which of the actor's Malware/Tools use which TTP IDs
    const toolUsageMap = new Map();
    const actorToolsWithTtps = [];

    if (Array.isArray(entitySoftware) && entitySoftware.length > 0 && ctiData?.software) {
        entitySoftware.forEach((swRef) => {
            const fullSw = ctiData.software.find((s) => s.id === swRef.id);
            if (!fullSw || !Array.isArray(fullSw.ttps) || fullSw.ttps.length === 0) return;
            actorToolsWithTtps.push({
                id: fullSw.id,
                name: fullSw.name,
                type: fullSw.type,
                ttpIds: fullSw.ttps.map((t) => t.id)
            });
            fullSw.ttps.forEach((swTtp) => {
                if (!toolUsageMap.has(swTtp.id)) {
                    toolUsageMap.set(swTtp.id, []);
                }
                const list = toolUsageMap.get(swTtp.id);
                if (!list.includes(fullSw.name)) {
                    list.push(fullSw.name);
                }
            });
        });
        actorToolsWithTtps.sort((a, b) => b.ttpIds.length - a.ttpIds.length);
    }

    const phaseBuckets = CYBER_KILL_CHAIN_PHASES.map((phase) => ({
        ...phase,
        ttps: [],
        topPriorityTTPs: [],
        criticalCount: 0,
        highCount: 0,
        deltaCount: 0
    }));

    const phaseMap = new Map(phaseBuckets.map((p) => [p.id, p]));
    const enrichedAllTTPs = [];

    evaluatedTTPs.forEach((ttp) => {
        const targetPhase = resolveKillChainPhaseForTtp(ttp);
        if (!targetPhase) return; // Skip pure pre-compromise Recon / Resource Development

        const enriched = evaluateTtpPriorityAndImpact(
            {
                ...ttp,
                killChainPhaseId: targetPhase.id,
                killChainPhaseName: targetPhase.name,
                killChainPhaseNumber: targetPhase.phaseNumber
            },
            toolUsageMap,
            ctiData
        );

        const bucket = phaseMap.get(targetPhase.id);
        if (bucket && !bucket.ttps.some((existing) => existing.id === enriched.id)) {
            bucket.ttps.push(enriched);
            enrichedAllTTPs.push(enriched);
        }
    });

    // Calibrate selective Priority Tiers across all uncovered TTPs of the entity:
    // - CRITICAL: Top ~10% of uncovered TTPs (max 5 for a 44-TTP actor) with score >= 48 (or exposedGap)
    // - HIGH: Next ~18% of uncovered TTPs (around 7-8 for a 44-TTP actor) with score >= 34 (excluding passive discovery unless exposedGap/decayed)
    // - MEDIUM: Standard active techniques (score >= 20)
    // - LOW: Passive enumeration or low-signal techniques (score < 20)
    // - COVERED: Validated & fresh in your workspace
    const uncoveredSorted = [...enrichedAllTTPs]
        .filter((t) => t.category !== 'coveredFresh')
        .sort((a, b) => b.priorityScore - a.priorityScore || a.id.localeCompare(b.id));

    const maxCriticalCount = Math.max(1, Math.min(6, Math.round(uncoveredSorted.length * 0.1)));
    const maxHighCount = Math.max(2, Math.min(12, Math.round(uncoveredSorted.length * 0.2)));

    let assignedCritical = 0;
    let assignedHigh = 0;
    const tierById = new Map();

    uncoveredSorted.forEach((item) => {
        if (
            item.category === 'exposedGap' ||
            (assignedCritical < maxCriticalCount &&
                item.priorityScore >= 46 &&
                !item.isPassiveDiscoveryOnly)
        ) {
            tierById.set(item.id, { tier: 'CRITICAL', color: '#ef4444' });
            assignedCritical += 1;
        } else if (
            assignedHigh < maxHighCount &&
            item.priorityScore >= 32 &&
            (!item.isPassiveDiscoveryOnly || item.category === 'decayed')
        ) {
            tierById.set(item.id, { tier: 'HIGH', color: '#f59e0b' });
            assignedHigh += 1;
        } else if (item.priorityScore >= 20 && !item.isPassiveDiscoveryOnly) {
            tierById.set(item.id, { tier: 'MEDIUM', color: '#38bdf8' });
        } else {
            tierById.set(item.id, { tier: 'LOW', color: '#94a3b8' });
        }
    });

    enrichedAllTTPs.forEach((item) => {
        if (item.category === 'coveredFresh') {
            item.priorityTier = 'COVERED';
            item.priorityColor = '#10b981';
        } else {
            const resolved = tierById.get(item.id) || { tier: 'MEDIUM', color: '#38bdf8' };
            item.priorityTier = resolved.tier;
            item.priorityColor = resolved.color;
        }
    });

    // Attach companion Anchor Objective to every Precursor, Conduit, and Modifier TTP
    const allAnchorCandidates = enrichedAllTTPs.filter(
        (t) => t.operationalRole?.role === 'ANCHOR'
    );
    enrichedAllTTPs.forEach((item) => {
        if (item.operationalRole?.role !== 'ANCHOR') {
            const companion = findBestCompanionAnchor(item, allAnchorCandidates);
            if (companion) {
                item.companionAnchor = {
                    id: companion.id,
                    name: companion.name,
                    killChainPhaseName: companion.killChainPhaseName
                };
            }
        }
    });

    const operationalChains = buildAdversaryOperationalChains(enrichedAllTTPs);

    const topPriorityChainTTPs = [];
    const criticalPriorityTTPs = [];

    phaseBuckets.forEach((bucket) => {
        // Sort highest priority score first; place already covered at the bottom of the phase
        bucket.ttps.sort((a, b) => {
            const aCovered = a.category === 'coveredFresh' ? 1 : 0;
            const bCovered = b.category === 'coveredFresh' ? 1 : 0;
            if (aCovered !== bCovered) return aCovered - bCovered;
            if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
            return a.id.localeCompare(b.id);
        });

        bucket.criticalCount = bucket.ttps.filter((t) => t.priorityTier === 'CRITICAL').length;
        bucket.highCount = bucket.ttps.filter((t) => t.priorityTier === 'HIGH').length;
        bucket.deltaCount = bucket.ttps.filter((t) => t.category !== 'coveredFresh').length;

        // Top N priority TTPs in this Kill Chain phase (prefer uncovered/drifted first)
        const uncoveredInPhase = bucket.ttps.filter((t) => t.category !== 'coveredFresh');
        const candidates = uncoveredInPhase.length > 0 ? uncoveredInPhase : bucket.ttps;
        bucket.topPriorityTTPs = candidates.slice(0, bucket.recommendedPerPhase);

        bucket.topPriorityTTPs.forEach((t) => {
            if (!topPriorityChainTTPs.some((c) => c.id === t.id)) {
                topPriorityChainTTPs.push(t);
            }
        });

        bucket.ttps.forEach((t) => {
            if (t.priorityTier === 'CRITICAL' && !criticalPriorityTTPs.some((c) => c.id === t.id)) {
                criticalPriorityTTPs.push(t);
            }
        });
    });

    return {
        phases: phaseBuckets.filter((p) => p.ttps.length > 0),
        allPhasesWithEmpty: phaseBuckets,
        enrichedAllTTPs,
        operationalChains,
        topPriorityChainTTPs,
        criticalPriorityTTPs,
        actorTools: actorToolsWithTtps
    };
}

/**
 * Builds a realistic Compound Operational Event scenario narrative for Step 1 (Scope),
 * fusing Precursors (Discovery), Conduits (Interpreters), and Modifiers (Obfuscation/Masquerading)
 * into their Culminating Anchor Objectives alongside each TTP's documented STIX threat group behavior.
 */
export function buildScenarioNarrativeFromSelection(entityName, entityId, selectedTtpList = []) {
    const clustered = clusterTTPsIntoCompoundEvents(selectedTtpList, entityName);
    const events = clustered.compoundEvents;

    const lines = [
        `Adversary Emulation Campaign modeled on **${entityName}${entityId ? ` (${entityId})` : ''}** across ${selectedTtpList.length} selected technique${selectedTtpList.length === 1 ? '' : 's'}, structured into **${events.length} Compound Operational Event${events.length === 1 ? '' : 's'}** (fusing precursor discovery, execution conduits, and tradecraft modifiers into their culminating objective so each phase generates correlated behavioral telemetry within a single process lineage):`,
        ''
    ];

    events.forEach((ev) => {
        lines.push(
            `### Phase ${ev.eventNumber}: ${ev.title} (${ev.ttpIds.join(', ')})`
        );
        ev.allTtps.forEach((t) => {
            const roleLabel =
                t.operationalRole?.label || classifyTtpOperationalRole(t).label;
            const behaviorText = (t.procedureDesc || t.externalComment || '').trim();
            if (behaviorText) {
                lines.push(`- **[${roleLabel}] ${t.id} (${t.name}):** ${behaviorText}`);
            } else {
                lines.push(
                    `- **[${roleLabel}] ${t.id} (${t.name}):** Observed ${entityName} technique in ${ev.domainTitle || 'this operational sequence'}.`
                );
            }
        });
        lines.push('');
    });

    return lines.join('\n').trim();
}

const DOMAIN_ROLE_RECOMMENDATIONS = {
    foothold_persistence: {
        CONDUIT: [
            { id: 'T1059.001', name: 'PowerShell' },
            { id: 'T1059.003', name: 'Windows Command Shell' },
            { id: 'T1047', name: 'Windows Management Instrumentation' }
        ],
        PRECURSOR: [
            { id: 'T1082', name: 'System Information Discovery' },
            { id: 'T1033', name: 'System Owner/User Discovery' },
            { id: 'T1007', name: 'System Service Discovery' }
        ],
        MODIFIER: [
            { id: 'T1027', name: 'Obfuscated Files or Information' },
            { id: 'T1036.005', name: 'Match Legitimate Name or Location' },
            { id: 'T1218.011', name: 'Rundll32' }
        ],
        ANCHOR: [
            { id: 'T1053.005', name: 'Scheduled Task' },
            { id: 'T1547.001', name: 'Registry Run Keys / Startup Folder' },
            { id: 'T1543.003', name: 'Windows Service' }
        ]
    },
    evasion_injection: {
        CONDUIT: [
            { id: 'T1106', name: 'Native API' },
            { id: 'T1059.001', name: 'PowerShell' },
            { id: 'T1059.003', name: 'Windows Command Shell' }
        ],
        PRECURSOR: [
            { id: 'T1057', name: 'Process Discovery' },
            { id: 'T1518.001', name: 'Security Software Discovery' },
            { id: 'T1082', name: 'System Information Discovery' }
        ],
        MODIFIER: [
            { id: 'T1027', name: 'Obfuscated Files or Information' },
            { id: 'T1218.011', name: 'Rundll32' },
            { id: 'T1140', name: 'Deobfuscate/Decode Files or Information' }
        ],
        ANCHOR: [
            { id: 'T1055', name: 'Process Injection' },
            { id: 'T1562.001', name: 'Disable or Modify Tools' },
            { id: 'T1574.001', name: 'DLL Search Order Hijacking' }
        ]
    },
    credential_harvest: {
        CONDUIT: [
            { id: 'T1059.001', name: 'PowerShell' },
            { id: 'T1059.003', name: 'Windows Command Shell' },
            { id: 'T1106', name: 'Native API' }
        ],
        PRECURSOR: [
            { id: 'T1057', name: 'Process Discovery' },
            { id: 'T1087.001', name: 'Local Account' },
            { id: 'T1033', name: 'System Owner/User Discovery' }
        ],
        MODIFIER: [
            { id: 'T1134', name: 'Access Token Manipulation' },
            { id: 'T1218.011', name: 'Rundll32' },
            { id: 'T1027', name: 'Obfuscated Files or Information' }
        ],
        ANCHOR: [
            { id: 'T1003.001', name: 'LSASS Memory' },
            { id: 'T1555', name: 'Credentials from Password Stores' },
            { id: 'T1552.001', name: 'Credentials In Files' }
        ]
    },
    lateral_pivot: {
        CONDUIT: [
            { id: 'T1047', name: 'Windows Management Instrumentation' },
            { id: 'T1059.001', name: 'PowerShell' },
            { id: 'T1059.003', name: 'Windows Command Shell' }
        ],
        PRECURSOR: [
            { id: 'T1018', name: 'Remote System Discovery' },
            { id: 'T1049', name: 'System Network Connections Discovery' },
            { id: 'T1135', name: 'Network Share Discovery' }
        ],
        MODIFIER: [
            { id: 'T1078', name: 'Valid Accounts' },
            { id: 'T1036', name: 'Masquerading' },
            { id: 'T1027', name: 'Obfuscated Files or Information' }
        ],
        ANCHOR: [
            { id: 'T1021.002', name: 'SMB/Windows Admin Shares' },
            { id: 'T1021.001', name: 'Remote Desktop Protocol' },
            { id: 'T1570', name: 'Lateral Tool Transfer' }
        ]
    },
    c2_staging: {
        CONDUIT: [
            { id: 'T1059.001', name: 'PowerShell' },
            { id: 'T1059.003', name: 'Windows Command Shell' },
            { id: 'T1106', name: 'Native API' }
        ],
        PRECURSOR: [
            { id: 'T1016', name: 'System Network Configuration Discovery' },
            { id: 'T1049', name: 'System Network Connections Discovery' },
            { id: 'T1082', name: 'System Information Discovery' }
        ],
        MODIFIER: [
            { id: 'T1140', name: 'Deobfuscate/Decode Files or Information' },
            { id: 'T1027', name: 'Obfuscated Files or Information' },
            { id: 'T1218.010', name: 'Regsvr32' }
        ],
        ANCHOR: [
            { id: 'T1105', name: 'Ingress Tool Transfer' },
            { id: 'T1071.001', name: 'Web Protocols' },
            { id: 'T1573', name: 'Encrypted Channel' }
        ]
    },
    collection_exfil_impact: {
        CONDUIT: [
            { id: 'T1059.001', name: 'PowerShell' },
            { id: 'T1059.003', name: 'Windows Command Shell' }
        ],
        PRECURSOR: [
            { id: 'T1083', name: 'File and Directory Discovery' },
            { id: 'T1082', name: 'System Information Discovery' },
            { id: 'T1135', name: 'Network Share Discovery' }
        ],
        MODIFIER: [
            { id: 'T1027', name: 'Obfuscated Files or Information' },
            { id: 'T1036', name: 'Masquerading' },
            { id: 'T1070.004', name: 'File Deletion' }
        ],
        ANCHOR: [
            { id: 'T1560.001', name: 'Archive via Utility' },
            { id: 'T1005', name: 'Data from Local System' },
            { id: 'T1041', name: 'Exfiltration Over C2 Channel' }
        ]
    }
};

function resolveTechniqueFromMitreData(candidate, mitreData = {}) {
    if (!candidate?.id) return null;
    const targetId = candidate.id.toUpperCase();
    for (const tacticObj of Object.values(mitreData || {})) {
        for (const tech of tacticObj?.techniques || []) {
            if (tech.id === targetId) {
                return { id: tech.id, name: tech.name };
            }
            for (const sub of tech.subTechniques || []) {
                if (sub.id === targetId) {
                    return { id: sub.id, name: sub.name };
                }
            }
        }
    }
    return { id: targetId, name: candidate.name };
}

/**
 * Given a Compound Operational Event in Step 1 (Scope), returns optional 1-click companion
 * TTP suggestions for any unpopulated component slots (CONDUIT, PRECURSOR, MODIFIER, ANCHOR).
 */
export function getMissingRoleSuggestionsForEvent(compoundEvent, mitreData = {}, existingSelectedTTPs = []) {
    if (!compoundEvent) return {};
    const domain = compoundEvent.domain || 'foothold_persistence';
    const domainMap =
        DOMAIN_ROLE_RECOMMENDATIONS[domain] ||
        DOMAIN_ROLE_RECOMMENDATIONS.foothold_persistence;
    const selectedIds = new Set((existingSelectedTTPs || []).map((t) => t.id));

    const pickFirstUnselected = (roleKey) => {
        const list = domainMap[roleKey] || [];
        for (const cand of list) {
            if (!selectedIds.has(cand.id)) {
                const resolved = resolveTechniqueFromMitreData(cand, mitreData);
                if (resolved) {
                    return {
                        ...resolved,
                        operationalRole: classifyTtpOperationalRole(resolved)
                    };
                }
            }
        }
        return null;
    };

    const suggestions = {};
    if (!compoundEvent.conduits || compoundEvent.conduits.length === 0) {
        suggestions.CONDUIT = pickFirstUnselected('CONDUIT');
    }
    if (!compoundEvent.precursors || compoundEvent.precursors.length === 0) {
        suggestions.PRECURSOR = pickFirstUnselected('PRECURSOR');
    }
    if (!compoundEvent.modifiers || compoundEvent.modifiers.length === 0) {
        suggestions.MODIFIER = pickFirstUnselected('MODIFIER');
    }
    if (!compoundEvent.anchors || compoundEvent.anchors.length === 0) {
        suggestions.ANCHOR = pickFirstUnselected('ANCHOR');
    }

    return suggestions;
}

/**
 * Given any single MITRE technique card in Step 1, returns the complete 4-component
 * chain (Conduit + Precursor + Modifier + Anchor) anchored around its affinity domain.
 */
export function getRecommendedChainForCustomTtp(seedTtp, mitreData = {}, existingSelectedTTPs = []) {
    if (!seedTtp?.id) return [];
    const seedRole = classifyTtpOperationalRole(seedTtp);
    const domain = seedRole.affinityDomain || 'foothold_persistence';
    const domainMap =
        DOMAIN_ROLE_RECOMMENDATIONS[domain] ||
        DOMAIN_ROLE_RECOMMENDATIONS.foothold_persistence;

    const selectedIds = new Set((existingSelectedTTPs || []).map((t) => t.id));
    const chain = [{ id: seedTtp.id, name: seedTtp.name }];
    const chainIds = new Set([seedTtp.id]);

    ['CONDUIT', 'PRECURSOR', 'MODIFIER', 'ANCHOR'].forEach((roleKey) => {
        if (seedRole.role === roleKey) return;
        const candidates = domainMap[roleKey] || [];
        // Prefer an already-selected TTP in the same domain/role if present, otherwise pick top candidate
        const chosen =
            candidates.find((c) => selectedIds.has(c.id)) ||
            candidates.find((c) => !chainIds.has(c.id));
        if (chosen && !chainIds.has(chosen.id)) {
            const resolved = resolveTechniqueFromMitreData(chosen, mitreData);
            if (resolved) {
                chain.push(resolved);
                chainIds.add(resolved.id);
            }
        }
    });

    return chain;
}



