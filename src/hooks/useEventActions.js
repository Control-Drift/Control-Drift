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

import { useCallback } from 'react';
import { ExerciseSchema } from '../lib/schemas';

export function useEventActions({
    dbAdapter,
    exercisesPage,
    exercisesLimit,
    fetchEventsPage,
    setExercises,
    allEventsData,
    setAllEventsData,
    gaps,
    setGaps,
    loadMitreCoverage,
    simulationSummaries,
    setSimulationSummaries,
    simulationEvidence,
    events,
    addToast
}) {
    /**
     * completeExercise
     * 
     * Submits a newly completed Event (atomic TTP test) into the database.
     * This function dynamically aggregates coverage ratings and automatically
     * determines whether a new "Gap" ticket should be created based on the outcome.
     * 
     * @param {string} ttp - The MITRE technique ID tested.
     * @param {string} finding - The detailed execution finding/procedure.
     * @param {string} remediation - Recommendations for improving defenses.
     * @param {string} outcomeStatus - The raw operational outcome (e.g., 'Missed', 'Logged').
     * @param {string} simulationName - The overarching campaign (Simulation) this belongs to.
     * @param {string} [severityOverride=null] - The aggregated severity rating for gaps.
     * @param {string|Array} [environment=['Windows Workstation']] - The infrastructure where this was tested.
     * @param {string} [coverageRating=null] - The calculated coverage (Optimal/Partial/Minimal/None).
     * @param {string} [outcomeString=null] - The final mapped string summarizing detection.
     * @param {Array} [tags=[]] - Custom tags to associate with the event.
     */
    const completeExercise = useCallback(async (ttp, finding, remediation, outcomeStatus, simulationName, severityOverride = null, environment = ['Windows Workstation'], coverageRating = null, outcomeString = null, tags = [], securityControls = [], skipFetch = false, dateOverride = null) => {
        const envArray = Array.isArray(environment) ? environment : [environment];
        const newExercise = {
            id: `ex-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            ttp: ttp,
            simulation: simulationName,
            finding: finding,
            outcome: outcomeString || outcomeStatus,
            coverageRating: coverageRating,
            remediation: remediation,
            status: outcomeStatus,
            environment: envArray,
            tags: tags,
            securityControls: securityControls,
            date: dateOverride || new Date().toISOString()
        };

        const parseResult = ExerciseSchema.safeParse(newExercise);
        if (!parseResult.success) {
            const errMsg = "Schema validation failed for Event.";
            console.error(errMsg, parseResult.error);
            if (addToast) addToast(errMsg, "error");
            throw new Error(errMsg);
        }

        const validExercise = parseResult.data;

        const applyLocalUpdate = (adapterType) => {
            setExercises(prev => {
                const existingIndex = prev.findIndex(ex => ex.ttp === ttp && ex.simulation === simulationName);
                let next = [...prev];
                if (existingIndex > -1) {
                    next[existingIndex] = { ...next[existingIndex], ...validExercise };
                } else {
                    next = [validExercise, ...next];
                }
                if (adapterType === 'local' && dbAdapter) dbAdapter.saveData('events', next);
                
                setAllEventsData(prevMap => {
                    const nextMap = { ...prevMap };
                    next.forEach(ex => {
                        nextMap[ex.id] = ex;
                    });
                    return nextMap;
                });
                
                return next;
            });
        };

        if (dbAdapter && typeof dbAdapter.createEvent === 'function' && dbAdapter.type !== 'local') {
            try {
                await dbAdapter.createEvent(validExercise);
                applyLocalUpdate('remote');
            } catch (err) {
                console.error("completeExercise REST error:", err);
                if (addToast) addToast("Failed to save event. Database write error.", "error");
                throw err;
            }
        } else {
            // Fallback for legacy adapters
            applyLocalUpdate('local');
        }

        if (outcomeStatus === 'high') {
           if (dbAdapter && typeof dbAdapter.fetchGaps === 'function' && typeof dbAdapter.updateGap === 'function' && dbAdapter.type !== 'local') {
                try {
                   const gapToResolve = gaps.find(gap => {
                        const gapTTPs = (gap.ttp || '').split(',').map(t => t.trim());
                        return gapTTPs.length === 1 && gapTTPs[0] === ttp && gap.status !== 'Resolved';
                   });
                   
                   if (gapToResolve) {
                       const updatedGap = {
                           ...gapToResolve,
                           status: 'Resolved',
                           resolvedDate: new Date().toISOString(),
                           resolutionNotes: (gapToResolve.resolutionNotes || '') + '\n[System] Auto-resolved via successful Purple Team test.'
                       };
                       await dbAdapter.updateGap(gapToResolve.id, updatedGap);
                       setGaps(prev => prev.map(g => g.id === gapToResolve.id ? updatedGap : g));
                   }
               } catch (err) {
                   console.error("completeExercise gaps resolve error:", err);
                   if (addToast) addToast("Failed to auto-resolve related gap.", "error");
                   throw err;
               }
           } else {
                setGaps(prev => {
                    const latestGaps = prev;
                    let gapResolved = false;
                    const next = latestGaps.map(gap => {
                        const gapTTPs = (gap.ttp || '').split(',').map(t => t.trim());
                        if (gapTTPs.length === 1 && gapTTPs[0] === ttp && gap.status !== 'Resolved') {
                            gapResolved = true;
                            return { ...gap, status: 'Resolved', resolvedDate: new Date().toISOString(), resolutionNotes: (gap.resolutionNotes || '') + '\n[System] Auto-resolved by subsequent successful execution.' };
                        }
                        return gap;
                    });
                    if (gapResolved && dbAdapter && dbAdapter.type === 'local') {
                        dbAdapter.saveData('gaps', next);
                    }
                    return next;
                });
           }
        }
    }, [dbAdapter, exercisesPage, exercisesLimit, fetchEventsPage, loadMitreCoverage, setAllEventsData, setExercises, setGaps]);

    /**
     * updateEventValidation
     * 
     * Called when a user submits a "Validation" re-test from the Gap Tracker.
     * This function performs complex state aggregation:
     * 1. Appends the re-test notes to the original Event.
     * 2. Recalculates the coverage average for the entire Simulation.
     * 3. Auto-resolves the parent Gap ticket if the re-test was successful.
     * 
     * @param {Object} gapObj - The Gap ticket being validated.
     * @param {string} newOutcomeStatus - The new detection outcome achieved during re-test.
     * @param {string} validationNotes - Evidence or notes about what changed.
     * @param {string} [validationDate] - ISO timestamp of when the re-test occurred.
     * @returns {boolean} True if the gap was auto-resolved, false otherwise.
     */
    const updateEventValidation = useCallback(async (gapObj, newOutcomeStatus, validationNotes, validationDate) => {
        // Parse the TTPs mapped to this gap (can be a comma-separated list)
        const ttpList = (gapObj.ttp || '').split(',').map(t => t.trim()).filter(Boolean);
        const simulationName = gapObj.simulation;
        const procName = gapObj.finding;
        
        let finalAggOutcome = newOutcomeStatus;
        let finalCoverageRating = 'None';
        let newRemediationNotes = '';
        let aggregatedSecurityControls = [];

        const currentSimulations = JSON.parse(JSON.stringify(simulationSummaries));
        const simulationData = currentSimulations[simulationName];
        
        let targetTTPs = ttpList;
        let proc = null;

        if (simulationData && simulationData.testResults) {
            proc = simulationData.testResults.find(p => p.name === procName);
            if (proc) {
                let original = proc.outcome || 'Missed';
                if (original.includes(' ➔ ')) original = original.split(' ➔ ')[0];
                
                const statusLower = newOutcomeStatus.toLowerCase();
                if (statusLower === 'prevented & alerted') {
                    proc.outcome = `${original} ➔ Prevented & Alerted ✓`;
                    proc.coverageRating = 'Optimal';
                    proc.severity = 'N/A';
                } else if (statusLower === 'prevented') {
                    proc.outcome = `${original} ➔ Prevented ✓`;
                    proc.coverageRating = 'Optimal';
                    proc.severity = 'N/A';
                } else if (statusLower === 'prevented') {
                    proc.outcome = `${original} ➔ Prevented ✓`;
                    proc.coverageRating = 'Optimal';
                    proc.severity = 'N/A';
                } else if (statusLower === 'alerted') {
                    proc.outcome = `${original} ➔ Alerted ✓`;
                    proc.coverageRating = 'Optimal';
                    proc.severity = 'N/A';
                } else if (statusLower === 'logged') {
                    proc.outcome = `${original} ➔ Logged ✓`;
                    proc.coverageRating = 'Partial';
                    proc.severity = 'Low';
                } else {
                    proc.outcome = `${original} ➔ ${newOutcomeStatus} ✓`;
                }
                proc.detNotes = (proc.detNotes || '') + `\n\n**[Validation Re-Test]**\n${validationNotes}`;
                if (validationDate) {
                    proc.validationDate = validationDate;
                }
                
                if (proc.ttps && proc.ttps.length > 0) {
                    targetTTPs = proc.ttps;
                }
            }
            
            const proceduresForTTP = simulationData.testResults.filter(p => (p.ttps || []).some(t => targetTTPs.includes(t)));
            
            let totalScore = 0;
            let validCount = 0;
            proceduresForTTP.forEach(p => {
                let cov = p.coverageRating || 'None';
                let out = p.outcome || '';
                if (out === 'N/A' || out === 'Error') return;
                validCount++;
                if (cov === 'Optimal') { totalScore += 100; }
                else if (cov === 'Partial') { totalScore += 50; }
                else if (cov === 'Minimal') { totalScore += 25; }
                else if (cov === 'None') { totalScore += 0; }
            });
            
            const avg = validCount > 0 ? totalScore / validCount : 0;
            if (validCount === 0) {
                finalAggOutcome = 'na';
                finalCoverageRating = 'N/A';
            } else if (avg >= 75) {
                finalAggOutcome = 'high';
                finalCoverageRating = 'Optimal';
            } else if (avg >= 25 && avg < 75) {
                finalAggOutcome = 'medium';
                finalCoverageRating = 'Partial';
            } else if (avg > 0 && avg < 25) {
                finalAggOutcome = 'minimal';
                finalCoverageRating = 'Minimal';
            } else {
                finalAggOutcome = 'low';
                finalCoverageRating = 'None';
            }
            
            newRemediationNotes = proceduresForTTP.map(p => {
                let note = `Event: ${p.name || 'Unnamed Event'} [${p.outcome || 'N/A'}]`;
                if (p.execNotes) note += `\nExecution: ${p.execNotes}`;
                if (p.detNotes) note += `\nDetection: ${p.detNotes.replace(/\n\n\[Attached Evidence:.*?\]/g, '')}`;
                return note;
            }).join('\n\n') || 'No specific execution or detection notes were recorded for this technique.';
            
            aggregatedSecurityControls = Array.from(new Set(proceduresForTTP.flatMap(p => p.securityControls || [])));
            
            setSimulationSummaries(currentSimulations);
            if (dbAdapter && typeof dbAdapter.upsertSimulation === 'function') {
                try {
                    await dbAdapter.upsertSimulation({
                        id: simulationName,
                        summary: simulationData,
                        evidence: simulationEvidence[simulationName] || []
                    });
                } catch (err) {
                    console.warn("upsertSimulation failed, possibly missing simulations table. Skipping.", err);
                }
            } else if (dbAdapter && typeof dbAdapter.saveData === 'function') {
                await dbAdapter.saveData('simulationSummaries', currentSimulations);
            }
        }

        let updatedExercisesArray = [];

        if (dbAdapter && typeof dbAdapter.fetchData === 'function' && dbAdapter.type === 'local') {
            const allExercises = await dbAdapter.fetchData('events') || [];
            const updatedExercises = allExercises.map(ex => {
                if (targetTTPs.includes(ex.ttp) && ex.simulation === simulationName) {
                    return {
                        ...ex,
                        status: finalAggOutcome,
                        coverageRating: finalCoverageRating !== 'N/A' ? finalCoverageRating : ex.coverageRating,
                        finding: procName || ex.finding,
                        remediation: newRemediationNotes || ex.remediation,
                        securityControls: aggregatedSecurityControls
                    };
                }
                return ex;
            });
            await dbAdapter.saveData('events', updatedExercises);
            updatedExercisesArray = updatedExercises;

            // Fix state sync leak: update allEventsData map properly
            setAllEventsData(prevMap => {
                const nextMap = { ...prevMap };
                updatedExercises.forEach(ex => {
                    nextMap[ex.id] = ex;
                });
                return nextMap;
            });

            await fetchEventsPage(exercisesPage, dbAdapter);
        } else {
            let modifiedExercises = [];
            
            // We must search the entire global map, not just the paginated 'events' list
            Object.values(allEventsData).forEach(ex => {
                if (targetTTPs.includes(ex.ttp) && ex.simulation === simulationName) {
                    const updated = {
                        ...ex,
                        status: finalAggOutcome,
                        coverageRating: finalCoverageRating !== 'N/A' ? finalCoverageRating : ex.coverageRating,
                        finding: procName || ex.finding,
                        remediation: newRemediationNotes || ex.remediation,
                        securityControls: aggregatedSecurityControls
                    };
                    modifiedExercises.push(updated);
                }
            });

            const updatedExercises = events.map(ex => {
                const mod = modifiedExercises.find(m => m.id === ex.id);
                return mod ? mod : ex;
            });
            setExercises(updatedExercises);
            
            // Fix state sync leak: update allEventsData map properly
            setAllEventsData(prevMap => {
                const nextMap = { ...prevMap };
                modifiedExercises.forEach(ex => {
                    nextMap[ex.id] = ex;
                });
                return nextMap;
            });

            updatedExercisesArray = modifiedExercises;
            
            if (dbAdapter && typeof dbAdapter.updateEvent === 'function') {
                for (const ex of modifiedExercises) {
                    if (ex.id) {
                        try {
                            await dbAdapter.updateEvent(ex.id, {
                                status: ex.status,
                                coverageRating: ex.coverageRating,
                                finding: ex.finding,
                                remediation: ex.remediation
                            });
                        } catch (err) {
                            console.warn("Event update failed, likely due to unsupported column.", err);
                        }
                    }
                }
                await fetchEventsPage(exercisesPage, dbAdapter);
            }
        }

        let shouldResolveGap = false;
        const statusLowerForResolve = newOutcomeStatus.toLowerCase();
        if (['prevented & alerted', 'prevented', 'prevented', 'alerted'].includes(statusLowerForResolve)) {
             shouldResolveGap = true;
        }

        if (dbAdapter && typeof dbAdapter.updateGap === 'function' && dbAdapter.type !== 'local') {
            try {
                if (shouldResolveGap) {
                    await dbAdapter.updateGap(gapObj.id, {
                        status: 'Resolved',
                        resolvedDate: validationDate || new Date().toISOString(),
                        details: (gapObj.details || '') + '\n\n[System] Auto-resolved via inline validation.'
                    });
                } else {
                    await dbAdapter.updateGap(gapObj.id, {
                        details: (gapObj.details || '') + `\n\n[Validation] Outcome: ${newOutcomeStatus}. Notes: ${validationNotes}`
                    });
                }
            } catch (err) {
                console.warn("Gap update failed, possibly missing columns in DB. Falling back to status-only update.", err);
                if (shouldResolveGap) {
                    await dbAdapter.updateGap(gapObj.id, { status: 'Resolved' });
                }
            }
            const reloadedGaps = await dbAdapter.fetchGaps();
            setGaps(reloadedGaps);
        } else {
            const latestGaps = (dbAdapter && typeof dbAdapter.fetchGaps === 'function' && dbAdapter.type !== 'local')
                ? await dbAdapter.fetchGaps()
                : gaps;
            let newGaps = latestGaps;
            if (shouldResolveGap) {
                newGaps = latestGaps.map(gap => {
                    if (String(gap.id) === String(gapObj.id) && gap.status !== 'Resolved') {
                        return { ...gap, status: 'Resolved', resolvedDate: validationDate || new Date().toISOString(), details: (gap.details || '') + '\n\n[System] Auto-resolved via inline validation.' };
                    }
                    return gap;
                });
            } else {
                newGaps = latestGaps.map(gap => {
                    if (String(gap.id) === String(gapObj.id)) {
                        return { ...gap, details: (gap.details || '') + `\n\n[Validation] Outcome: ${newOutcomeStatus}. Notes: ${validationNotes}` };
                    }
                    return gap;
                });
            }
            setGaps(newGaps);
            if (dbAdapter && typeof dbAdapter.saveData === 'function') {
                await dbAdapter.saveData('gaps', newGaps);
            }
        }
        return shouldResolveGap;
    }, [dbAdapter, events, allEventsData, gaps, exercisesPage, exercisesLimit, fetchEventsPage, loadMitreCoverage, simulationSummaries, setSimulationSummaries, simulationEvidence, setExercises, setAllEventsData, setGaps]);

    /**
     * revertEventValidation
     * 
     * Undoes a validation re-test on a Gap. It strips out the appended validation notes
     * from the original Simulation Event and restores the original detection outcome.
     * 
     * @param {Object} gapObj - The Gap ticket whose validation is being reverted.
     * @returns {Promise<void>}
     */
    const revertEventValidation = useCallback(async (gapObj) => {
        if (!gapObj || !gapObj.simulation || !gapObj.finding) return;
        const simulationName = gapObj.simulation;
        const procName = gapObj.finding;
        
        const currentSimulations = JSON.parse(JSON.stringify(simulationSummaries));
        const simulationData = currentSimulations[simulationName];
        
        let targetTTPs = [];
        let finalAggOutcome = 'unknown';
        let newRemediationNotes = '';
        let aggregatedSecurityControls = [];

        if (simulationData && simulationData.testResults) {
            const proc = simulationData.testResults.find(p => p.name === procName);
            if (proc) {
                if (proc.outcome && (proc.outcome.includes(' ➔ ') || proc.outcome.includes(' ➔ '))) {
                    const original = proc.outcome.split(' ➔ ')[0].split(' ➔ ')[0].trim();
                    proc.outcome = original;
                    if (original === 'Prevented & Alerted' || original === 'Prevented' || original === 'Alerted') proc.coverageRating = 'Optimal';
                    else if (original === 'Prevented' || original === 'Logged') proc.coverageRating = 'Partial';
                    else if (original === 'Missed') proc.coverageRating = 'None';
                    else proc.coverageRating = 'N/A';
                }
                
                if (proc.detNotes && proc.detNotes.includes('**[Validation Re-Test]**')) {
                    proc.detNotes = proc.detNotes.split('\n\n**[Validation Re-Test]**')[0].trim();
                }
                
                proc.validationDate = null;
                if (proc.ttps && proc.ttps.length > 0) {
                    targetTTPs = proc.ttps;
                }
            }
            
            const proceduresForTTP = simulationData.testResults.filter(p => (p.ttps || []).some(t => targetTTPs.includes(t)));
            
            let totalScore = 0;
            let validCount = 0;
            proceduresForTTP.forEach(p => {
                let cov = p.coverageRating || 'None';
                let out = p.outcome || '';
                if (out === 'N/A' || out === 'Error') return;
                validCount++;
                if (cov === 'Optimal') { totalScore += 100; }
                else if (cov === 'Partial') { totalScore += 50; }
                else if (cov === 'Minimal') { totalScore += 25; }
                else if (cov === 'None') { totalScore += 0; }
            });
            
            const avg = validCount > 0 ? totalScore / validCount : 0;
            if (validCount === 0) finalAggOutcome = 'na';
            else if (avg >= 75) finalAggOutcome = 'high';
            else if (avg >= 25 && avg < 75) finalAggOutcome = 'medium';
            else if (avg > 0 && avg < 25) finalAggOutcome = 'minimal';
            else finalAggOutcome = 'low';
            
            newRemediationNotes = proceduresForTTP.map(p => {
                let note = `Event: ${p.name || 'Unnamed Event'} [${p.outcome || 'N/A'}]`;
                if (p.execNotes) note += `\nExecution: ${p.execNotes}`;
                if (p.detNotes) note += `\nDetection: ${p.detNotes}`;
                return note;
            }).join('\n\n') || 'No specific execution or detection notes were recorded for this technique.';
            
            aggregatedSecurityControls = Array.from(new Set(proceduresForTTP.flatMap(p => p.securityControls || [])));

            setSimulationSummaries(currentSimulations);
            if (dbAdapter && typeof dbAdapter.saveData === 'function' && dbAdapter.type === 'local') {
                await dbAdapter.saveData('simulation_summaries', currentSimulations);
            }
        }
        
        if (targetTTPs.length === 0) return;

        if (dbAdapter && typeof dbAdapter.fetchData === 'function' && dbAdapter.type === 'local') {
            const allExercises = await dbAdapter.fetchData('events') || [];
            const updatedExercises = allExercises.map(ex => {
                if (targetTTPs.includes(ex.ttp) && ex.simulation === simulationName) {
                    return {
                        ...ex,
                        status: finalAggOutcome,
                        finding: procName || ex.finding,
                        remediation: newRemediationNotes || ex.remediation,
                        securityControls: aggregatedSecurityControls
                    };
                }
                return ex;
            });
            await dbAdapter.saveData('events', updatedExercises);
            
            setAllEventsData(prevMap => {
                const nextMap = { ...prevMap };
                updatedExercises.forEach(ex => {
                    nextMap[ex.id] = ex;
                });
                return nextMap;
            });
        } else {
            const updatedExercises = events.map(ex => {
                if (targetTTPs.includes(ex.ttp) && ex.simulation === simulationName) {
                    const updated = {
                        ...ex,
                        status: finalAggOutcome,
                        finding: procName || ex.finding,
                        remediation: newRemediationNotes || ex.remediation,
                        securityControls: aggregatedSecurityControls
                    };
                    if (dbAdapter && typeof dbAdapter.updateEvent === 'function') {
                        dbAdapter.updateEvent(updated.id, updated).catch(err => console.error("Error updating event:", err));
                    }
                    return updated;
                }
                return ex;
            });
            setExercises(updatedExercises);
            
            setAllEventsData(prevMap => {
                const nextMap = { ...prevMap };
                updatedExercises.forEach(ex => {
                    nextMap[ex.id] = ex;
                });
                return nextMap;
            });
        }
    }, [simulationSummaries, setSimulationSummaries, dbAdapter, events, allEventsData, setExercises, setAllEventsData]);

    const deleteSimulation = useCallback(async (simulationName) => {
        if (!simulationName) return;

        // 0. Delete from DB explicitly if adapter supports it
        if (dbAdapter && typeof dbAdapter.deleteSimulation === 'function') {
            try {
                await dbAdapter.deleteSimulation(simulationName);
            } catch (err) {
                console.error('Failed to delete simulation from dbAdapter', err);
            }
        }

        // 1. Delete from simulationSummaries
        setSimulationSummaries(prev => {
            const next = { ...prev };
            delete next[simulationName];
            if (dbAdapter && typeof dbAdapter.saveData === 'function') {
                dbAdapter.saveData('simulationSummaries', next).catch(console.error);
            }
            return next;
        });

        // 2. Delete from events (local state & DB)
        const cleanSimName = (simulationName || '').toString().trim().toLowerCase();
        if (dbAdapter && typeof dbAdapter.fetchData === 'function' && dbAdapter.type === 'local') {
            const allExercises = await dbAdapter.fetchData('events') || [];
            const remainingExercises = allExercises.filter(ex => (ex.simulation || '').toString().trim().toLowerCase() !== cleanSimName);
            await dbAdapter.saveData('events', remainingExercises);
            
            setAllEventsData(prevMap => {
                const nextMap = { ...prevMap };
                // Rebuild map from scratch to ensure orphans are removed
                const rebuiltMap = {};
                remainingExercises.forEach(ex => { rebuiltMap[ex.id] = ex; });
                return rebuiltMap;
            });
            setExercises(remainingExercises);
        } else {
            setExercises(prev => {
                const remaining = prev.filter(ex => (ex.simulation || '').toString().trim().toLowerCase() !== cleanSimName);
                return remaining;
            });
            
            // Rebuild allEventsData by filtering out the ones with simulationName
            setAllEventsData(prevMap => {
                const nextMap = { ...prevMap };
                Object.keys(nextMap).forEach(key => {
                    if ((nextMap[key].simulation || '').toString().trim().toLowerCase() === cleanSimName) {
                        delete nextMap[key];
                    }
                });
                return nextMap;
            });
        }

        // 3. Delete from gaps (local state & DB)
        if (gaps && setGaps) {
            if (dbAdapter && typeof dbAdapter.fetchData === 'function' && dbAdapter.type === 'local') {
                const allGaps = await dbAdapter.fetchData('gaps') || [];
                const remainingGaps = allGaps.filter(g => (g.simulation || '').toString().trim().toLowerCase() !== cleanSimName);
                await dbAdapter.saveData('gaps', remainingGaps);
                setGaps(remainingGaps);
            } else {
                setGaps(prev => prev.filter(g => (g.simulation || '').toString().trim().toLowerCase() !== cleanSimName));
            }
        }
    }, [setSimulationSummaries, dbAdapter, setAllEventsData, setExercises, gaps, setGaps]);

    return {
        completeExercise,
        updateEventValidation,
        revertEventValidation,
        deleteSimulation
    };
}
