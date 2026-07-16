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

import { useState, useCallback } from 'react';
import { validateBulkData, SimulationSummarySchema } from '../lib/schemas';

export function useSimulationsData(dbAdapter, addToast = () => {}) {
    const [simulationSummaries, setSimulationSummaries] = useState({});
    const [simulationEvidence, setSimulationEvidence] = useState({});

    const fetchSimulations = useCallback(async (adapter = dbAdapter) => {
        if (!adapter || typeof adapter.fetchSimulationsData !== 'function') return;
        try {
            const data = await adapter.fetchSimulationsData();
            const validatedData = validateBulkData(SimulationSummarySchema, data, "Simulation");
            
            const summaries = {};
            const evidence = {};
            validatedData.forEach(sim => {
                summaries[sim.id] = sim.summary;
                evidence[sim.id] = sim.evidence;
            });
            
            setSimulationSummaries(summaries);
            setSimulationEvidence(evidence);
        } catch (e) {
            console.error("Failed to fetch simulations:", e);
        }
    }, [dbAdapter]);

    const saveSimulationSummary = useCallback(async (simulationName, summary) => {
        const existingCamp = simulationSummaries[simulationName];
        let nextSummary;
        if (existingCamp) {
            nextSummary = { ...existingCamp, ...summary };
        } else {
            nextSummary = { status: 'planned', objectives: [], environment: 'Windows Workstation', ...summary };
        }
        
        setSimulationSummaries(prev => ({ ...prev, [simulationName]: nextSummary }));

        if (dbAdapter && typeof dbAdapter.upsertSimulation === 'function') {
            try {
                await dbAdapter.upsertSimulation({
                    id: simulationName,
                    summary: nextSummary,
                    evidence: simulationEvidence[simulationName] || []
                });
            } catch (err) {
                console.error("saveSimulationSummary error:", err);
                addToast("Failed to save simulation summary.", "error");
                throw err;
            }
        }
    }, [dbAdapter, simulationEvidence, simulationSummaries]);

    const addSimulationEvidence = useCallback(async (simulationName, base64Image) => {
        const current = simulationEvidence[simulationName] || [];
        const nextEvidenceArray = [...current, base64Image];
        
        setSimulationEvidence(prev => ({ ...prev, [simulationName]: nextEvidenceArray }));

        if (dbAdapter && typeof dbAdapter.upsertSimulation === 'function') {
            try {
                await dbAdapter.upsertSimulation({
                    id: simulationName,
                    summary: simulationSummaries[simulationName] || {},
                    evidence: nextEvidenceArray
                });
            } catch (err) {
                console.error("addSimulationEvidence error:", err);
                addToast("Failed to save simulation evidence.", "error");
                throw err;
            }
        }
    }, [dbAdapter, simulationSummaries, simulationEvidence]);

    const removeSimulationEvidence = useCallback(async (simulationName, evidenceIndex) => {
        const current = simulationEvidence[simulationName] || [];
        const nextEvidenceArray = [...current];
        nextEvidenceArray.splice(evidenceIndex, 1);
        
        setSimulationEvidence(prev => ({ ...prev, [simulationName]: nextEvidenceArray }));

        if (dbAdapter && typeof dbAdapter.upsertSimulation === 'function') {
            try {
                await dbAdapter.upsertSimulation({
                    id: simulationName,
                    summary: simulationSummaries[simulationName] || {},
                    evidence: nextEvidenceArray
                });
            } catch (err) {
                console.error("removeSimulationEvidence error:", err);
                addToast("Failed to remove simulation evidence.", "error");
                throw err;
            }
        }
    }, [dbAdapter, simulationSummaries, simulationEvidence]);

    return {
        simulationSummaries, setSimulationSummaries,
        simulationEvidence, setSimulationEvidence,
        fetchSimulations,
        saveSimulationSummary, addSimulationEvidence, removeSimulationEvidence
    };
}
