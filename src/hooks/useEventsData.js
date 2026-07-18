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

export function useEventsData(dbAdapter) {
    const [events, setExercises] = useState([]);
    const [allEventsData, setAllEventsData] = useState({});
    const [totalExercises, setTotalExercises] = useState(0);
    const [exercisesPage, setExercisesPage] = useState(1);
    const [exercisesLimit, setExercisesLimit] = useState(50);
    const prevExercisesRef = useRef([]);

    useEffect(() => {
        setAllEventsData(prevAll => {
            let changed = false;
            const nextAll = { ...prevAll };
            events.forEach(ex => {
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
    }, [events]);

    const fetchEventsPage = useCallback(async (page, limitOrAdapter = dbAdapter, maybeAdapter = null) => {
        let limit = exercisesLimit;
        let adapter = dbAdapter;
        if (typeof limitOrAdapter === 'number') {
            limit = limitOrAdapter;
            setExercisesLimit(limitOrAdapter);
            adapter = maybeAdapter || dbAdapter;
        } else if (limitOrAdapter) {
            adapter = limitOrAdapter;
        }

        if (!adapter || typeof adapter.fetchEvents !== 'function') return;
        try {
            const data = await adapter.fetchEvents(page, limit);
            
            // Validate incoming data
            const validatedData = validateBulkData(ExerciseSchema, data.data, "Event");
            
            setExercises(validatedData);
            setTotalExercises(data.total);
            setExercisesPage(page);
            
            // Sync with allEventsData map
            setAllEventsData(prevAll => {
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
            console.error("Failed to fetch events:", e);
        }
    }, [dbAdapter, exercisesLimit]);

    const loadAllData = useCallback(async (adapter = dbAdapter) => {
        if (!adapter) return;
        try {
            // Load paginated view
            await fetchEventsPage(exercisesPage, adapter);
            
            // Load entire mapping if we are on a remote adapter where fetchEvents is paginated
            // Actually, we need ALL events for the Mitre map calculation.
            // Load entire mapping
            let fullDataRaw = [];
            if (typeof adapter.fetchData === 'function') {
                fullDataRaw = await adapter.fetchData('events') || [];
            } else if (typeof adapter.fetchEvents === 'function') {
                const res = await adapter.fetchEvents(1, 10000);
                fullDataRaw = res.data || [];
            }
            
            if (fullDataRaw.length > 0) {
                const validatedFull = validateBulkData(ExerciseSchema, fullDataRaw, "Event");
                const exMap = {};
                validatedFull.forEach(ex => { exMap[ex.id] = ex; });
                setAllEventsData(exMap);
            }
        } catch (e) {
            console.error("Failed to load all events data", e);
        }
    }, [dbAdapter, fetchEventsPage, exercisesPage]);

    return {
        events, setExercises,
        allEventsData, setAllEventsData,
        totalExercises,
        exercisesPage, setExercisesPage,
        exercisesLimit,
        fetchEventsPage,
        loadAllData
    };
}
