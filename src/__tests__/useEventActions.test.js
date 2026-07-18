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

import { renderHook, act } from '@testing-library/react';
import { useEventActions } from '../hooks/useEventActions';
import { vi } from 'vitest';

describe('useEventActions', () => {
    let mockDbAdapter;
    let mockFetchExercisesPage;
    let mockLoadMitreCoverage;
    let mockSetAllExercisesData;
    let mockSetExercises;
    let mockSetGaps;
    let mockSetSimulationSummaries;
    let mockExercises;
    let mockGaps;
    let mockSimulationSummaries;
    let mockSimulationEvidence;

    beforeEach(() => {
        mockDbAdapter = {
            type: 'local',
            fetchData: vi.fn(),
            saveData: vi.fn(),
            createGap: vi.fn(),
            updateGap: vi.fn(),
            updateEvent: vi.fn(),
            upsertSimulation: vi.fn(),
        };

        mockFetchExercisesPage = vi.fn();
        mockLoadMitreCoverage = vi.fn();
        mockSetAllExercisesData = vi.fn();
        mockSetExercises = vi.fn();
        mockSetGaps = vi.fn();
        mockSetSimulationSummaries = vi.fn();
        
        mockExercises = [];
        mockGaps = [];
        mockSimulationSummaries = {};
        mockSimulationEvidence = {};
    });

    const renderHookWithArgs = () => {
        return renderHook(() => useEventActions({
            dbAdapter: mockDbAdapter,
            exercisesPage: 1,
            exercisesLimit: 10,
            fetchEventsPage: mockFetchExercisesPage,
            loadMitreCoverage: mockLoadMitreCoverage,
            setAllEventsData: mockSetAllExercisesData,
            setExercises: mockSetExercises,
            setGaps: mockSetGaps,
            gaps: mockGaps,
            simulationSummaries: mockSimulationSummaries,
            setSimulationSummaries: mockSetSimulationSummaries,
            simulationEvidence: mockSimulationEvidence,
            events: mockExercises
        }));
    };

    it('completeExercise correctly saves the event and resolves gaps if outcome is high', async () => {
        // We use setExercises and setGaps callback logic, so we need to mock them to execute their callbacks
        mockSetExercises.mockImplementation(cb => {
            return cb([]);
        });
        mockSetGaps.mockImplementation(cb => {
            return cb(mockGaps);
        });
        
        // Mock the DB returning existing gaps BEFORE rendering hook
        const existingGap = { id: 'gap-1', ttp: 'T1048', status: 'Open' };
        mockGaps.push(existingGap);

        const { result } = renderHookWithArgs();
        
        // Mock current simulations
        mockSimulationSummaries['Test_Campaign'] = {
            testResults: []
        };

        await act(async () => {
            await result.current.completeExercise(
                'T1048', 
                'Exfiltration over Alternative Protocol', 
                'Block outbound DNS', 
                'high', // passing high should trigger gap resolution
                'Test_Campaign',
                'High',
                'Windows Workstation',
                'Optimal',
                'high',
                ['apt29']
            );
        });
        
        // Verify event was saved via the local adapter
        expect(mockDbAdapter.saveData).toHaveBeenCalledWith('events', expect.arrayContaining([
            expect.objectContaining({
                ttp: 'T1048',
                simulation: 'Test_Campaign',
                outcome: 'high',
                status: 'high'
            })
        ]));

        // Verify that because outcomeStatus === 'high', it resolved the existing gap
        expect(mockDbAdapter.saveData).toHaveBeenCalledWith('gaps', expect.arrayContaining([
            expect.objectContaining({
                ttp: 'T1048',
                status: 'Resolved'
            })
        ]));
    });

    it('updateEventValidation resolves the gap and recalculates parent coverage', async () => {
        const { result } = renderHookWithArgs();

        mockSimulationSummaries['Test_Campaign'] = {
            testResults: [
                {
                    name: 'Exfil Test',
                    outcome: 'Missed',
                    coverageRating: 'None',
                    ttps: ['T1048']
                }
            ]
        };

        const mockGap = {
            id: 'gap-123',
            ttp: 'T1048',
            simulation: 'Test_Campaign',
            finding: 'Exfil Test',
            status: 'Open'
        };

        mockDbAdapter.fetchData.mockResolvedValue([
            {
                id: 'ex-123',
                ttp: 'T1048',
                simulation: 'Test_Campaign',
                finding: 'Exfil Test',
                outcome: 'Missed'
            }
        ]);

        await act(async () => {
            const resolved = await result.current.updateEventValidation(
                mockGap, 
                'Prevented & Alerted', 
                'Firewall rule applied', 
                new Date().toISOString()
            );
            
            expect(resolved).toBe(true);
        });

        // The parent simulation should have its testResults updated to Optimal
        expect(mockSetSimulationSummaries).toHaveBeenCalledWith(expect.objectContaining({
            'Test_Campaign': expect.objectContaining({
                testResults: expect.arrayContaining([
                    expect.objectContaining({
                        name: 'Exfil Test',
                        coverageRating: 'Optimal',
                        outcome: 'Missed ➔ Prevented & Alerted ✓'
                    })
                ])
            })
        }));
    });
});
