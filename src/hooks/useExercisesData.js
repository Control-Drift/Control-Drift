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

import { useState, useCallback, useRef, useEffect } from 'react';
import { validateBulkData, ExerciseSchema } from '../lib/schemas';

export function useExercisesData(dbAdapter) {
    const [exercises, setExercises] = useState([]);
    const [allExercisesData, setAllExercisesData] = useState({});
    const [totalExercises, setTotalExercises] = useState(0);
    const [exercisesPage, setExercisesPage] = useState(1);
    const [exercisesLimit, setExercisesLimit] = useState(50);
    const prevExercisesRef = useRef([]);

    useEffect(() => {
        setAllExercisesData(prevAll => {
            let changed = false;
            const nextAll = { ...prevAll };
            exercises.forEach(ex => {
                const existing = nextAll[ex.id];
                if (!existing) {
                    nextAll[ex.id] = ex;
                    changed = true;
                } else if (existing.status !== ex.status || existing.finding !== ex.finding || existing.remediation !== ex.remediation) {
                    nextAll[ex.id] = { ...existing, ...ex };
                    changed = true;
                }
            });
            return changed ? nextAll : prevAll;
        });
    }, [exercises]);

    const fetchExercisesPage = useCallback(async (page, limitOrAdapter = dbAdapter, maybeAdapter = null) => {
        let limit = exercisesLimit;
        let adapter = dbAdapter;
        if (typeof limitOrAdapter === 'number') {
            limit = limitOrAdapter;
            setExercisesLimit(limitOrAdapter);
            adapter = maybeAdapter || dbAdapter;
        } else if (limitOrAdapter) {
            adapter = limitOrAdapter;
        }

        if (!adapter || typeof adapter.fetchExercises !== 'function') return;
        try {
            const data = await adapter.fetchExercises(page, limit);
            
            // Validate incoming data
            const validatedData = validateBulkData(ExerciseSchema, data.data, "Exercise");
            
            setExercises(validatedData);
            setTotalExercises(data.total);
            setExercisesPage(page);
            
            // Sync with allExercisesData map
            setAllExercisesData(prevAll => {
                let changed = false;
                const nextAll = { ...prevAll };
                const prevExercises = prevExercisesRef.current;
                
                const deletedIds = prevExercises
                    .filter(pe => !validatedData.some(e => e.id === pe.id))
                    .map(pe => pe.id);
                    
                deletedIds.forEach(id => {
                    if (nextAll[id]) {
                        delete nextAll[id];
                        changed = true;
                    }
                });
                
                validatedData.forEach(ex => {
                    const existing = nextAll[ex.id];
                    if (!existing) {
                        nextAll[ex.id] = ex;
                        changed = true;
                    } else if (existing.status !== ex.status || existing.finding !== ex.finding || existing.remediation !== ex.remediation) {
                        nextAll[ex.id] = { ...existing, ...ex };
                        changed = true;
                    }
                });
                
                return changed ? nextAll : prevAll;
            });
            prevExercisesRef.current = validatedData;
        } catch (e) {
            console.error("Failed to fetch exercises:", e);
        }
    }, [dbAdapter, exercisesLimit]);

    const loadAllData = useCallback(async (adapter = dbAdapter) => {
        if (!adapter) return;
        try {
            // Load paginated view
            await fetchExercisesPage(exercisesPage, adapter);
            
            // Load entire mapping if we are on a remote adapter where fetchExercises is paginated
            // Actually, we need ALL exercises for the Mitre map calculation.
            // Load entire mapping
            let fullDataRaw = [];
            if (typeof adapter.fetchData === 'function') {
                fullDataRaw = await adapter.fetchData('exercises') || [];
            } else if (typeof adapter.fetchExercises === 'function') {
                const res = await adapter.fetchExercises(1, 10000);
                fullDataRaw = res.data || [];
            }
            
            if (fullDataRaw.length > 0) {
                const validatedFull = validateBulkData(ExerciseSchema, fullDataRaw, "Exercise");
                const exMap = {};
                validatedFull.forEach(ex => { exMap[ex.id] = ex; });
                setAllExercisesData(exMap);
            }
        } catch (e) {
            console.error("Failed to load all exercises data", e);
        }
    }, [dbAdapter, fetchExercisesPage, exercisesPage]);

    return {
        exercises, setExercises,
        allExercisesData, setAllExercisesData,
        totalExercises,
        exercisesPage, setExercisesPage,
        exercisesLimit,
        fetchExercisesPage,
        loadAllData
    };
}
