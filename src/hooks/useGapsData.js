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

import { useState, useCallback, useEffect } from 'react';
import { validateBulkData, GapSchema } from '../lib/schemas';

export function useGapsData(dbAdapter, addToast = () => {}) {
    const [gaps, setGaps] = useState([]);
    const [activeEnvironmentFilter, setActiveEnvironmentFilter] = useState('All');
    const [targetEnvironments, setTargetEnvironments] = useState(() => {
        const saved = localStorage.getItem('target_envs');
        if (saved) {
            try { return JSON.parse(saved); } catch (e) { return []; }
        }
        return [];
    });

    useEffect(() => {
        localStorage.setItem('target_envs', JSON.stringify(targetEnvironments));
    }, [targetEnvironments]);

    const addEnvironment = useCallback((name) => {
        if (!name) return;
        const cleanName = name.trim();
        setTargetEnvironments(prev => {
            if (prev.some(e => e.toLowerCase() === cleanName.toLowerCase())) return prev;
            return [...prev, cleanName].sort();
        });
    }, []);

    const deleteEnvironment = useCallback((name) => {
        setTargetEnvironments(prev => prev.filter(e => e !== name));
    }, []);

    const fetchGaps = useCallback(async (adapter = dbAdapter) => {
        if (!adapter || typeof adapter.fetchGaps !== 'function') return;
        try {
            const data = await adapter.fetchGaps();
            const validatedData = validateBulkData(GapSchema, data, "Gap");
            
            // Backfill any gaps that are missing a displayId (due to schema stripping in previous version or manual creation)
            let hasChanges = false;
            const backfilledData = validatedData.map(g => {
                if (!g.displayId) {
                    hasChanges = true;
                    return { ...g, displayId: 'GAP-' + Math.floor(1000 + Math.random() * 9000) };
                }
                return g;
            });
            
            if (hasChanges && adapter.type === 'local') {
                adapter.saveData('gaps', backfilledData);
            }
            
            setGaps(backfilledData);
        } catch (e) {
            console.error("Failed to fetch gaps:", e);
            setGaps([]);
        }
    }, [dbAdapter]);

    const createGap = useCallback(async (gap, skipFetch = false) => {
        const gapWithId = {
            ...gap,
            displayId: gap.displayId || ('GAP-' + Math.floor(1000 + Math.random() * 9000))
        };
        
        const parseResult = GapSchema.safeParse(gapWithId);
        if (!parseResult.success) {
            const errMsg = "Schema validation failed for Gap creation.";
            console.error(errMsg, parseResult.error);
            addToast(errMsg, "error");
            throw new Error(errMsg);
        }

        const scrubbedGap = {
            ...parseResult.data,
            environment: Array.isArray(parseResult.data.environment) ? parseResult.data.environment.join(', ') : parseResult.data.environment
        };

        if (dbAdapter && typeof dbAdapter.createGap === 'function' && dbAdapter.type !== 'local') {
            try {
                await dbAdapter.createGap(scrubbedGap);
                setGaps(prev => [gapWithId, ...prev]);
            } catch (err) {
                console.error("createGap error:", err);
                addToast("Failed to create gap. Database write error.", "error");
                throw err;
            }
        } else if (dbAdapter && dbAdapter.type === 'local') {
            setGaps(prev => {
                const next = [gapWithId, ...prev];
                dbAdapter.saveData('gaps', next);
                return next;
            });
        }
    }, [dbAdapter, addToast]);

    const updateGap = useCallback(async (id, gapData) => {
        const gapToUpdate = gaps.find(g => String(g.id) === String(id));
        if (!gapToUpdate) return;
        
        const mergedGap = { ...gapToUpdate, ...gapData };
        const parseResult = GapSchema.safeParse(mergedGap);
        
        if (!parseResult.success) {
            const errMsg = "Schema validation failed for Gap update.";
            console.error(errMsg, parseResult.error);
            addToast(errMsg, "error");
            throw new Error(errMsg);
        }

        if (dbAdapter && typeof dbAdapter.updateGap === 'function' && dbAdapter.type !== 'local') {
            try {
                const scrubbedGapData = {
                    ...gapData,
                    ...(gapData.environment && { environment: Array.isArray(gapData.environment) ? gapData.environment.join(', ') : gapData.environment })
                };
                await dbAdapter.updateGap(id, scrubbedGapData);
                setGaps(prev => prev.map(g => String(g.id) === String(id) ? mergedGap : g));
            } catch (err) {
                console.error("updateGap error:", err);
                addToast("Failed to update gap. Database write error.", "error");
                throw err;
            }
        } else if (dbAdapter && dbAdapter.type === 'local') {
            setGaps(prev => {
                const next = prev.map(g => String(g.id) === String(id) ? mergedGap : g);
                dbAdapter.saveData('gaps', next);
                return next;
            });
        }
    }, [dbAdapter, gaps, addToast]);

    const deleteGap = useCallback(async (id) => {
        if (dbAdapter && typeof dbAdapter.deleteGap === 'function' && dbAdapter.type !== 'local') {
            try {
                await dbAdapter.deleteGap(id);
                setGaps(prev => prev.filter(g => String(g.id) !== String(id)));
            } catch (err) {
                console.error("deleteGap error:", err);
                addToast("Failed to delete gap. Database write error.", "error");
                throw err;
            }
        } else if (dbAdapter && dbAdapter.type === 'local') {
            setGaps(prev => {
                const next = prev.filter(g => String(g.id) !== String(id));
                dbAdapter.saveData('gaps', next);
                return next;
            });
        }
    }, [dbAdapter, addToast]);

    return {
        gaps, setGaps,
        activeEnvironmentFilter, setActiveEnvironmentFilter,
        targetEnvironments, setTargetEnvironments,
        addEnvironment, deleteEnvironment,
        fetchGaps,
        createGap, updateGap, deleteGap
    };
}
