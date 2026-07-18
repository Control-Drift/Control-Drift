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

import { useState, useMemo, useEffect, useCallback } from 'react';
import { calculateAverageStatus } from '../lib/mitreUtils';

/**
 * Custom React hook that loads, caches, and calculates MITRE ATT&CK framework data 
 * against the provided simulation events to generate unified security posture metrics.
 *
 * @param {Object} dbAdapter - Database connection adapter for syncing state.
 * @param {Object} allEventsData - A dictionary of all recorded events and simulations.
 * @returns {Object} An object containing the calculated MITRE data, loading state, and helper functions.
 */
export function useMitreData(dbAdapter, allEventsData) {
    const [baseMitreData, setBaseMitreData] = useState({});
    const [isMitreLoading, setIsMitreLoading] = useState(true);
    const [mitreProgress, setMitreProgress] = useState(0);

    // Persist any manual scope toggles (like marking N/A) back to the cache
    useEffect(() => {
        if (Object.keys(baseMitreData).length > 0 && !isMitreLoading) {
            const cachedStr = localStorage.getItem('mitre_data_v4');
            let timestamp = Date.now();
            if (cachedStr) {
                try {
                    const cached = JSON.parse(cachedStr);
                    if (cached.timestamp) timestamp = cached.timestamp; // Preserve original fetch timestamp so it can still expire and refresh if needed
                } catch (e) {}
            }
            
            localStorage.setItem('mitre_data_v4', JSON.stringify({
                timestamp,
                data: baseMitreData
            }));
        }
    }, [baseMitreData, isMitreLoading]);

    /**
     * Determines the unified coverage status ('high', 'medium', 'minimal', 'low', 'unknown') 
     * for a single event based on its explicit rating or parsed simulation outcome.
     * 
     * @param {Object} ex - The event object containing coverageRating, outcome, and status.
     * @returns {string} The resolved status rating for heatmap calculation.
     */
    const getResolvedStatusFromExercise = useCallback((ex) => {
        let calcStatus = 'unknown';
        
        let inlineCr = null;
        let out = ex.outcome || '';
        
        // 1. Always check remediation for the most up-to-date inline validation outcome!
        // This overrides any stale coverageRating in the DB
        if (ex.remediation && ex.remediation.includes('Event:')) {
            const eventLines = ex.remediation.split('\n\n').filter(r => r.trim() && r.startsWith('Event:'));
            if (eventLines.length > 0) {
                const match = eventLines[0].match(/Event: .*? \[(.*?)\]/);
                if (match) out = match[1];
                
                // Parse inline coverage rating if present
                const crMatch = eventLines[0].match(/\]\s+(Optimal|Partial|Minimal|None|No)\s+Coverage/i);
                if (crMatch) {
                    inlineCr = crMatch[1];
                }
            }
        }
        
        // 2. Apply inline coverage rating if found
        if (inlineCr) {
            const cr = inlineCr.toLowerCase();
            if (cr.includes('optimal')) calcStatus = 'high';
            else if (cr.includes('partial')) calcStatus = 'medium';
            else if (cr.includes('minimal')) calcStatus = 'minimal';
            else if (cr.includes('none') || cr.includes('no')) calcStatus = 'low';
            
            if (calcStatus !== 'unknown') return calcStatus;
        }

        // 3. Fallback to explicit coverage rating
        if (ex.coverageRating && ex.coverageRating !== 'N/A') {
            const cr = String(ex.coverageRating).toLowerCase();
            if (cr.includes('optimal')) calcStatus = 'high';
            else if (cr.includes('partial')) calcStatus = 'medium';
            else if (cr.includes('minimal')) calcStatus = 'minimal';
            else if (cr.includes('none') || cr.includes('no coverage')) calcStatus = 'low';
            
            if (calcStatus !== 'unknown') return calcStatus;
        }

        // 4. Otherwise calculate based on outcome string
        if (typeof out === 'string' && out.trim() !== '') {
            let outParts = out;
            if (out.includes('->') || out.includes('➔')) {
                outParts = out.split(/->|➔/)[1] || '';
            }
            outParts = outParts.replace('✓', '').trim().toLowerCase();
            if (outParts === 'prevented & alerted' || outParts === 'optimal') calcStatus = 'high';
            else if (outParts.includes('prevented')) calcStatus = 'high';
            else if (outParts.includes('alerted')) calcStatus = 'high';
            else if (outParts.includes('logged') || outParts.includes('partial')) calcStatus = 'medium';
            else if (outParts.includes('minimal')) calcStatus = 'minimal';
            else if (outParts.includes('missed') || outParts.includes('none')) calcStatus = 'low';
        }
        
        if (calcStatus === 'unknown') {
            if (ex.status && ex.status.toLowerCase() !== 'completed') {
                calcStatus = ex.status;
            }
        }
        return calcStatus;
    }, []);

    /**
     * Recalculates the coverage status (high, medium, minimal, low, na, unknown) 
     * for all MITRE ATT&CK techniques and sub-techniques in the provided matrix, 
     * based on the provided array of event data.
     * 
     * The scoring logic strictly distinguishes between objective 'Outcome' (Prevented, Alerted, Logged, Missed)
     * and subjective 'Coverage Rating' (Optimal, Partial, Minimal, None), mapping them into a unified status.
     * Parent techniques are rolled up automatically based on their sub-techniques.
     *
     * @param {Object} matrix - The MITRE matrix object keyed by Tactic name.
     * @param {Array} exArray - Array of historical simulation and gap tracker events.
     */
    const recalculateMitreStatuses = (matrix, exArray) => {
        for (const tactic in matrix) {
            matrix[tactic].techniques.forEach(tech => {
                if (tech.status === 'na') {
                    // Skip, keep out-of-scope 'na'
                } else if (tech.subTechniques && tech.subTechniques.length > 0) {
                    tech.subTechniques.forEach(sub => {
                        if (sub.status === 'na') return;
                        const matchingEx = exArray.filter(e => e.ttp === sub.id && e.status !== 'pending' && e.status !== 'error');
                        if (matchingEx.length === 0) {
                            sub.status = 'unknown';
                        } else {
                            const exStatuses = matchingEx.map(e => getResolvedStatusFromExercise(e));
                            sub.status = calculateAverageStatus(exStatuses);
                        }
                    });

                    const directMatchingEx = exArray.filter(e => e.ttp === tech.id && e.status !== 'pending' && e.status !== 'error');
                    let directStatus = 'unknown';
                    if (directMatchingEx.length > 0) {
                        const exStatuses = directMatchingEx.map(e => getResolvedStatusFromExercise(e));
                        directStatus = calculateAverageStatus(exStatuses);
                    }

                    // Roll up to parent
                    const subStatuses = [...tech.subTechniques.map(s => s.status), directStatus];
                    if (subStatuses.every(s => s === 'unknown' || s === 'na')) {
                        tech.status = tech.status !== 'unknown' ? tech.status : 'unknown'; // keep existing if map was already scored
                    } else {
                        tech.status = calculateAverageStatus(subStatuses);
                    }
                } else {
                    const matchingEx = exArray.filter(e => e.ttp === tech.id && e.status !== 'pending' && e.status !== 'error');
                    if (matchingEx.length === 0) {
                        tech.status = 'unknown';
                    } else {
                        const exStatuses = matchingEx.map(e => getResolvedStatusFromExercise(e));
                        tech.status = calculateAverageStatus(exStatuses);
                    }
                }
            });
        }
    };

    /**
     * Memoized calculation that merges raw historical event data into the MITRE ATT&CK skeleton.
     * It maps environment-specific test history, tracks prevention percentages, 
     * dynamically adds unmapped TTPs, and runs recalculateMitreStatuses to produce the final dataset.
     */
    const mitreDataCalculated = useMemo(() => {
        if (!baseMitreData || Object.keys(baseMitreData).length === 0) return baseMitreData;
        
        const next = JSON.parse(JSON.stringify(baseMitreData));
        
        const knownIds = new Set();
        for (const tactic in next) {
          next[tactic].techniques.forEach(t => {
            if (t.status !== 'na') {
               t.status = 'unknown';
            }
            t.environments = {}; 
            knownIds.add(t.id);
            if (t.subTechniques) {
                t.subTechniques.forEach(s => {
                    if (s.status !== 'na') s.status = 'unknown';
                    knownIds.add(s.id);
                });
            }
          });
        }

        // Dynamically add tested but unmapped TTPs to their respective Tactics
        const TTP_TACTIC_MAP = {
            'T1190': 'Initial Access', 'T1566': 'Initial Access', 'T1078': 'Initial Access',
            'T1059': 'Execution', 'T1204': 'Execution',
            'T1547': 'Persistence', 'T1543': 'Persistence', 'T1136': 'Persistence',
            'T1134': 'Privilege Escalation', 'T1053': 'Privilege Escalation',
            'T1562': 'Defense Evasion', 'T1070': 'Defense Evasion', 'T1027': 'Defense Evasion',
            'T1003': 'Credential Access', 'T1110': 'Credential Access',
            'T1082': 'Discovery', 'T1016': 'Discovery',
            'T1021': 'Lateral Movement', 'T1570': 'Lateral Movement',
            'T1115': 'Collection', 'T1119': 'Collection',
            'T1071': 'Command and Control', 'T1573': 'Command and Control',
            'T1041': 'Exfiltration', 'T1567': 'Exfiltration',
            'T1485': 'Impact', 'T1486': 'Impact'
        };

        const rawExArray = Object.values(allEventsData);
        const latestExMap = new Map();
        rawExArray.forEach(ex => {
            if (ex.status === 'pending' || ex.status === 'error') return;
            
            const envKey = Array.isArray(ex.environment) ? ex.environment.join(',') : (ex.environment || 'Windows Workstation');
            const key = `${ex.simulation}_${ex.ttp}_${envKey}_${ex.finding}`;
            
            if (!latestExMap.has(key)) {
                latestExMap.set(key, ex);
            } else {
                const existing = latestExMap.get(key);
                const exDate = new Date(ex.date || ex.createdDate);
                const existingDate = new Date(existing.date || existing.createdDate);
                if (exDate > existingDate) {
                    latestExMap.set(key, ex);
                }
            }
        });
        const exArray = Array.from(latestExMap.values());

        exArray.forEach(ex => {
            if (ex.ttp && !knownIds.has(ex.ttp)) {
                let baseTtp = ex.ttp.split('.')[0];
                let targetTactic = TTP_TACTIC_MAP[baseTtp] || 'Initial Access'; // Fallback only if unknown
                
                if (next[targetTactic]) {
                    next[targetTactic].techniques.push({
                        id: ex.ttp,
                        name: `Dynamic Technique ${ex.ttp}`,
                        status: 'unknown',
                        subTechniques: [],
                        environments: {}
                    });
                    knownIds.add(ex.ttp);
                }
            }
        });
        
        const exMap = {};
        const historyMap = {};
        exArray.forEach(ex => {
            if (ex.ttp) {
                if (!historyMap[ex.ttp]) historyMap[ex.ttp] = [];
                if (!historyMap[ex.ttp].find(h => h.simulation === ex.simulation && h.date === ex.date)) {
                    historyMap[ex.ttp].push(ex);
                }
            }

            const envArray = Array.isArray(ex.environment) ? ex.environment : [ex.environment || 'Windows Workstation'];
            
            let calcStatus = getResolvedStatusFromExercise(ex);

            let score = -2; // use -2 for unknown/error
            if (calcStatus === 'high') score = 100;
            else if (calcStatus === 'medium') score = 50;
            else if (calcStatus === 'minimal') score = 25;
            else if (calcStatus === 'low') score = 0;
            else if (calcStatus === 'exception') score = -3;
            else if (calcStatus === 'na') score = -1;
            
            if (score === -2) return; // Skip error/pending statuses entirely
            
            if (!exMap[ex.ttp]) exMap[ex.ttp] = {};
            envArray.forEach(env => {
                if (!exMap[ex.ttp][env]) exMap[ex.ttp][env] = { scores: [], prevented: 0, total: 0 };
                
                if (score >= 0) {
                    exMap[ex.ttp][env].scores.push(score);
                    exMap[ex.ttp][env].total++;
                    
                    let out = ex.outcome || ex.finding || '';
                    if (ex.remediation && ex.remediation.includes('Event:')) {
                        const eventLines = ex.remediation.split('\n\n').filter(r => r.trim() && r.startsWith('Event:'));
                        if (eventLines.length > 0) {
                            const match = eventLines[0].match(/Event: .*? \[(.*?)\]/);
                            if (match) out = match[1];
                        }
                    }
                    if (out.includes(' ➔ ')) out = out.split(' ➔ ')[1];
                    out = out.replace(' ✓', '').trim().toLowerCase();
                    
                    if (out === 'prevented' || out === 'prevented' || out === 'prevented & alerted' || (!out && calcStatus === 'high')) {
                        exMap[ex.ttp][env].prevented++;
                    }
                }
                else if (score === -1 && exMap[ex.ttp][env].scores.length === 0) exMap[ex.ttp][env].scores.push(-1);
                else if (score === -3) exMap[ex.ttp][env].scores.push(-3);
            });
        });
        
        for (const tactic in next) {
            next[tactic].techniques.forEach(t => {
                const combinedEnvs = {};

                t.history = historyMap[t.id] ? [...historyMap[t.id]] : [];

                if (t.subTechniques && t.subTechniques.length > 0) {
                    t.subTechniques.forEach(sub => {
                        sub.history = historyMap[sub.id] ? [...historyMap[sub.id]] : [];
                        if (historyMap[sub.id]) {
                            t.history.push(...historyMap[sub.id]);
                        }
                        
                        // Restore sub-technique combinedEnvs calculation
                        const subCombinedEnvs = {};
                        sub.history.forEach(ex => {
                            const envArray = Array.isArray(ex.environment) ? ex.environment : [ex.environment || 'Windows Workstation'];
                            let calcStatus = getResolvedStatusFromExercise(ex);
                            let score = -2;
                            if (calcStatus === 'high') score = 100;
                            else if (calcStatus === 'medium') score = 50;
                            else if (calcStatus === 'minimal') score = 25;
                            else if (calcStatus === 'low') score = 0;
                            else if (calcStatus === 'exception') score = -3;
                            else if (calcStatus === 'na') score = -1;
                            
                            if (score === -2) return;
                            
                            envArray.forEach(env => {
                                if (!subCombinedEnvs[env]) subCombinedEnvs[env] = { scores: [], prevented: 0, total: 0 };
                                if (score >= 0) {
                                    subCombinedEnvs[env].scores.push(score);
                                    subCombinedEnvs[env].total++;
                                    let out = ex.outcome || ex.finding || '';
                                    if (ex.remediation && ex.remediation.includes('Event:')) {
                                        const eventLines = ex.remediation.split('\n\n').filter(r => r.trim() && r.startsWith('Event:'));
                                        if (eventLines.length > 0) out = eventLines[0].match(/Event: .*? \[(.*?)\]/)?.[1] || out;
                                    }
                                    if (out.includes(' ➔ ')) out = out.split(' ➔ ')[1];
                                    out = out.replace(' ✓', '').trim().toLowerCase();
                                    if (out === 'prevented' || out === 'prevented & alerted' || (!out && calcStatus === 'high')) {
                                        subCombinedEnvs[env].prevented++;
                                    }
                                } else {
                                    subCombinedEnvs[env].scores.push(score);
                                }
                            });
                        });
                        
                        if (Object.keys(subCombinedEnvs).length > 0) {
                            Object.keys(subCombinedEnvs).forEach(env => {
                                const scores = subCombinedEnvs[env].scores;
                                if (scores.length === 0) return;
                                if (!sub.environments) sub.environments = {};
                                if (scores[0] === -1) { sub.environments[env] = 'na'; return; }
                                if (scores[0] === -3) { sub.environments[env] = 'exception'; return; }
                                const avg = scores.reduce((a,b)=>a+b,0) / scores.length;
                                if (avg >= 75) sub.environments[env] = 'high';
                                else if (avg >= 50) sub.environments[env] = 'medium';
                                else if (avg >= 25) sub.environments[env] = 'minimal';
                                else sub.environments[env] = 'low';
                            });
                        }
                    });
                }

                // Deep Merge history by Simulation Run
                const mergedHistoryMap = new Map();
                t.history.forEach(h => {
                    const envKey = Array.isArray(h.environment) ? h.environment.join(',') : (h.environment || 'Windows Workstation');
                    const key = `${h.simulation}_${h.date}_${envKey}`;
                    
                    if (!mergedHistoryMap.has(key)) {
                        // Deep clone to avoid mutating the original record
                        const clone = JSON.parse(JSON.stringify(h));
                        // Do not overwrite ttp with parent id so sub-techniques render correctly
                        mergedHistoryMap.set(key, clone);
                    } else {
                        const existing = mergedHistoryMap.get(key);
                        
                        // Smart Deep Merge Remediation Notes (Deduplicate exact event strings)
                        if (h.remediation && h.remediation !== 'No specific execution or detection notes were recorded for this technique.') {
                            if (existing.remediation === 'No specific execution or detection notes were recorded for this technique.' || !existing.remediation) {
                                existing.remediation = h.remediation;
                            } else {
                                const existingEvents = existing.remediation.split('\n\n');
                                const newEvents = h.remediation.split('\n\n');
                                const uniqueEvents = Array.from(new Set([...existingEvents, ...newEvents]));
                                existing.remediation = uniqueEvents.join('\n\n');
                            }
                        }

                        // Calculate accurate AVERAGE coverage outcome for the parent
                        const getCovScore = (rating) => {
                            if (!rating || rating === 'N/A') return -1;
                            const r = String(rating).toLowerCase();
                            if (r.includes('optimal')) return 100;
                            if (r.includes('partial')) return 50;
                            if (r.includes('minimal')) return 25;
                            if (r.includes('none') || r.includes('no coverage')) return 0;
                            return -1;
                        };
                        
                        if (!existing._covScores) {
                            existing._covScores = [ getCovScore(existing.coverageRating) ];
                        }
                        if (h.coverageRating) {
                            existing._covScores.push(getCovScore(h.coverageRating));
                        }
                        
                        const validScores = existing._covScores.filter(s => s !== undefined && s >= 0);
                        if (validScores.length > 0) {
                            const avg = validScores.reduce((a,b) => a+b, 0) / validScores.length;
                            if (avg === 100) existing.coverageRating = 'Optimal';
                            else if (avg >= 50) existing.coverageRating = 'Partial';
                            else if (avg > 0) existing.coverageRating = 'Minimal';
                            else existing.coverageRating = 'None';
                        }
                        
                        // Take BEST outcome for the parent
                        const outcomeValues = { 'Prevented': 4, 'Alerted': 3, 'Logged': 2, 'Missed': 1, 'N/A': 0 };
                        const exOut = outcomeValues[existing.outcome] || 0;
                        const newOut = outcomeValues[h.outcome] || 0;
                        if (newOut > exOut) {
                            existing.outcome = h.outcome;
                            existing.status = h.status;
                        }
                    }
                });
                
                t.history = Array.from(mergedHistoryMap.values());
                
                t.history.forEach(ex => {
                    const envArray = Array.isArray(ex.environment) ? ex.environment : [ex.environment || 'Windows Workstation'];
                    
                    let calcStatus = getResolvedStatusFromExercise(ex);
                    let score = -2;
                    if (calcStatus === 'high') score = 100;
                    else if (calcStatus === 'medium') score = 50;
                    else if (calcStatus === 'minimal') score = 25;
                    else if (calcStatus === 'low') score = 0;
                    else if (calcStatus === 'exception') score = -3;
                    else if (calcStatus === 'na') score = -1;
                    
                    if (score === -2) return;
                    
                    envArray.forEach(env => {
                        if (!combinedEnvs[env]) combinedEnvs[env] = { scores: [], prevented: 0, total: 0 };
                        
                        if (score >= 0) {
                            combinedEnvs[env].scores.push(score);
                            combinedEnvs[env].total++;
                            
                            let out = ex.outcome || ex.finding || '';
                            if (ex.remediation && ex.remediation.includes('Event:')) {
                                const eventLines = ex.remediation.split('\n\n').filter(r => r.trim() && r.startsWith('Event:'));
                                if (eventLines.length > 0) {
                                    const match = eventLines[0].match(/Event: .*? \[(.*?)\]/);
                                    if (match) out = match[1];
                                }
                            }
                            if (out.includes(' ➔ ')) out = out.split(' ➔ ')[1];
                            out = out.replace(' ✓', '').trim().toLowerCase();
                            
                            if (out === 'prevented' || out === 'prevented' || out === 'prevented & alerted' || (!out && calcStatus === 'high')) {
                                combinedEnvs[env].prevented++;
                            }
                        } else if (score === -1 && combinedEnvs[env].scores.length === 0) {
                            combinedEnvs[env].scores.push(-1);
                        } else if (score === -3) {
                            combinedEnvs[env].scores.push(-3);
                        }
                    });
                });

                // Sort history
                t.history.sort((a, b) => new Date(b.date) - new Date(a.date));
                if (t.subTechniques) {
                    t.subTechniques.forEach(sub => {
                        sub.history.sort((a, b) => new Date(b.date) - new Date(a.date));
                    });
                }

                if (Object.keys(combinedEnvs).length > 0) {
                    Object.keys(combinedEnvs).forEach(env => {
                        const scores = combinedEnvs[env].scores;
                        if (scores.length === 0) return;
                        if (scores[0] === -1) {
                            t.environments[env] = 'na';
                            return;
                        }
                        
                        const validStatuses = scores.map(s => s >= 75 ? 'high' : s >= 50 ? 'medium' : s >= 25 ? 'minimal' : 'low');
                        t.environments[env] = calculateAverageStatus(validStatuses);
                        
                        if (!t.preventedStats) t.preventedStats = {};
                        t.preventedStats[env] = {
                            prevented: combinedEnvs[env].prevented,
                            total: combinedEnvs[env].total
                        };
                    });
                }
            });
        }

        recalculateMitreStatuses(next, exArray);
        return next;
    }, [baseMitreData, allEventsData, getResolvedStatusFromExercise]);

    /**
     * Fetches the official Enterprise MITRE ATT&CK framework from MITRE's raw STIX JSON.
     * Caches the skeleton locally for 7 days to improve load times, while parsing 
     * tactics, techniques, and sub-techniques into a structured hierarchy.
     *
     * @param {Object} provider - Optional auth provider or context.
     */
    const loadMitreSkeleton = useCallback(async (provider) => {
        setIsMitreLoading(true);
        try {
            const cachedStr = localStorage.getItem('mitre_data_v4');
            if (cachedStr) {
              const cached = JSON.parse(cachedStr);
              const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
              if (cached.timestamp && Date.now() - cached.timestamp < SEVEN_DAYS && cached.data) {
                setBaseMitreData(cached.data);
                setIsMitreLoading(false);
                return;
              }
            }

            const controller = new AbortController();
            const res = await fetch('/enterprise-attack.json', { 
                signal: controller.signal,
                credentials: 'same-origin'
            });
            
            const contentLength = res.headers.get('content-length');
            const total = contentLength ? parseInt(contentLength, 10) : 47450483;
            let loaded = 0;
            const reader = res.body.getReader();
            const chunks = [];
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                loaded += value.length;
                setMitreProgress(Math.min(100, Math.round((loaded / total) * 100)));
            }
            
            const blob = new Blob(chunks);
            const text = await blob.text();
            const data = JSON.parse(text);
            
            const tacticsMap = {};
            const mitreOutput = {};
            
            data.objects.forEach(obj => {
              if (obj.type === 'x-mitre-tactic') {
                tacticsMap[obj.x_mitre_shortname] = obj.name;
                mitreOutput[obj.name] = { status: 'unknown', techniques: [] };
              }
            });

            data.objects.forEach(obj => {
              if (obj.type === 'attack-pattern' && !obj.revoked && !obj.x_mitre_deprecated) {
                const idObj = obj.external_references?.find(ref => ref.source_name === 'mitre-attack');
                if (idObj && idObj.external_id && !idObj.external_id.includes('.')) {
                  obj.kill_chain_phases?.forEach(phase => {
                    if (phase.kill_chain_name === 'mitre-attack') {
                      const tacticName = tacticsMap[phase.phase_name];
                      if (tacticName && mitreOutput[tacticName]) {
                        if (!mitreOutput[tacticName].techniques.find(t => t.id === idObj.external_id)) {
                           mitreOutput[tacticName].techniques.push({ id: idObj.external_id, name: obj.name, description: obj.description, status: 'unknown', subTechniques: [] });
                        }
                      }
                    }
                  });
                }
              }
            });

            data.objects.forEach(obj => {
              if (obj.type === 'attack-pattern' && !obj.revoked && !obj.x_mitre_deprecated) {
                const idObj = obj.external_references?.find(ref => ref.source_name === 'mitre-attack');
                if (idObj && idObj.external_id && idObj.external_id.includes('.')) {
                  const parentId = idObj.external_id.split('.')[0];
                  
                  // In STIX 2.1, sub-techniques may inherit kill_chain_phases from their parent
                  // and may not explicitly define them. We must search all tactics for the parent technique.
                  let foundParent = false;
                  Object.values(mitreOutput).forEach(tactic => {
                      const parentTech = tactic.techniques.find(t => t.id === parentId);
                      if (parentTech) {
                          foundParent = true;
                          if (!parentTech.subTechniques.find(t => t.id === idObj.external_id)) {
                              parentTech.subTechniques.push({ id: idObj.external_id, name: obj.name, description: obj.description, status: 'unknown' });
                          }
                      }
                  });
                }
              }
            });

            Object.keys(mitreOutput).forEach(k => {
               mitreOutput[k].techniques.sort((a,b) => a.id.localeCompare(b.id));
               mitreOutput[k].techniques.forEach(t => t.subTechniques.sort((a,b) => a.id.localeCompare(b.id)));
            });

            localStorage.setItem('mitre_data_v4', JSON.stringify({
               timestamp: Date.now(),
               data: mitreOutput
            }));
            setBaseMitreData(mitreOutput);
        } catch (err) {
            console.error("Error loading MITRE STIX data:", err);
            const cachedStr = localStorage.getItem('mitre_data_v4');
            if (cachedStr) {
                try {
                    const cached = JSON.parse(cachedStr);
                    if (cached.data) {
                        setBaseMitreData(cached.data);
                    }
                } catch (e) {
                    console.error("Failed to parse expired cache fallback:", e);
                }
            }
        } finally {
            setIsMitreLoading(false);
        }
    }, []);

    return {
        mitreData: mitreDataCalculated,
        isMitreLoading,
        mitreProgress,
        loadMitreSkeleton,
        setBaseMitreData
    };
}
