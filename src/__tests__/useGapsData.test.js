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
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useGapsData } from '../hooks/useGapsData';

describe('useGapsData hook tests', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('State Hydration', () => {
        it('should initialize targetEnvironments from localStorage if it has a valid JSON array', () => {
            const spyGet = vi.spyOn(Storage.prototype, 'getItem');
            const initialEnvs = ['Prod', 'Staging'];
            localStorage.setItem('target_envs', JSON.stringify(initialEnvs));
            
            const { result } = renderHook(() => useGapsData(null));
            
            expect(spyGet).toHaveBeenCalledWith('target_envs');
            expect(result.current.targetEnvironments).toEqual(initialEnvs);
        });

        it('should fall back to empty array and catch error if localStorage contains invalid JSON', () => {
            const spyGet = vi.spyOn(Storage.prototype, 'getItem');
            localStorage.setItem('target_envs', '{invalid-json}');
            
            const { result } = renderHook(() => useGapsData(null));
            
            expect(spyGet).toHaveBeenCalledWith('target_envs');
            expect(result.current.targetEnvironments).toEqual([]);
        });

        it('should fall back to empty array if localStorage targetEnvironments is not present', () => {
            const spyGet = vi.spyOn(Storage.prototype, 'getItem');
            
            const { result } = renderHook(() => useGapsData(null));
            
            expect(spyGet).toHaveBeenCalledWith('target_envs');
            expect(result.current.targetEnvironments).toEqual([]);
        });
    });

    describe('Environment Management', () => {
        it('should add unique environments, trimmed and sorted, performing case-insensitive checks', () => {
            const { result } = renderHook(() => useGapsData(null));
            
            act(() => {
                result.current.addEnvironment('  Staging  ');
            });
            expect(result.current.targetEnvironments).toEqual(['Staging']);
            
            // Check case-insensitive duplicate
            act(() => {
                result.current.addEnvironment('staging');
            });
            expect(result.current.targetEnvironments).toEqual(['Staging']);
            
            // Add another one, check sorting
            act(() => {
                result.current.addEnvironment('Alpha');
            });
            expect(result.current.targetEnvironments).toEqual(['Alpha', 'Staging']);
            
            // Add empty / invalid name
            act(() => {
                result.current.addEnvironment('');
                result.current.addEnvironment(null);
            });
            expect(result.current.targetEnvironments).toEqual(['Alpha', 'Staging']);
        });

        it('should delete environments case-sensitively, e.g. deleteEnvironment("prod") does not remove "Prod"', () => {
            localStorage.setItem('target_envs', JSON.stringify(['Prod', 'Staging']));
            const { result } = renderHook(() => useGapsData(null));
            
            act(() => {
                result.current.deleteEnvironment('prod'); // case-sensitive, shouldn't delete 'Prod'
            });
            expect(result.current.targetEnvironments).toEqual(['Prod', 'Staging']);
            
            act(() => {
                result.current.deleteEnvironment('Prod'); // correct case, should delete
            });
            expect(result.current.targetEnvironments).toEqual(['Staging']);
        });
    });

    describe('fetchGaps', () => {
        it('does nothing if adapter is not passed and dbAdapter is null', async () => {
            const { result } = renderHook(() => useGapsData(null));
            await act(async () => {
                await result.current.fetchGaps();
            });
            expect(result.current.gaps).toEqual([]);
        });

        it('fetches and validates data, backfilling displayId if missing (saving to local adapter if local)', async () => {
            const mockGaps = [
                { id: 'GAP-1', displayId: 'GAP-1', title: 'Gap 1' },
                { id: 'GAP-2', title: 'Gap 2' } // missing displayId
            ];
            const localAdapter = {
                type: 'local',
                fetchGaps: vi.fn().mockResolvedValue(mockGaps),
                saveData: vi.fn()
            };
            
            const { result } = renderHook(() => useGapsData(localAdapter));
            await act(async () => {
                await result.current.fetchGaps();
            });
            
            expect(localAdapter.fetchGaps).toHaveBeenCalled();
            expect(result.current.gaps.length).toBe(2);
            expect(result.current.gaps[0].displayId).toBe('GAP-1');
            expect(result.current.gaps[1].displayId).toMatch(/^GAP-\d{4}$/);
            expect(localAdapter.saveData).toHaveBeenCalledWith('gaps', result.current.gaps);
        });

        it('fetches and validates data, backfilling displayId if missing but does NOT save to remote adapter', async () => {
            const mockGaps = [
                { id: 'GAP-1', displayId: 'GAP-1', title: 'Gap 1' },
                { id: 'GAP-2', title: 'Gap 2' } // missing displayId
            ];
            const remoteAdapter = {
                type: 'remote',
                fetchGaps: vi.fn().mockResolvedValue(mockGaps),
                saveData: vi.fn()
            };
            
            const { result } = renderHook(() => useGapsData(remoteAdapter));
            await act(async () => {
                await result.current.fetchGaps();
            });
            
            expect(remoteAdapter.fetchGaps).toHaveBeenCalled();
            expect(result.current.gaps.length).toBe(2);
            expect(result.current.gaps[1].displayId).toMatch(/^GAP-\d{4}$/);
            expect(remoteAdapter.saveData).not.toHaveBeenCalled();
        });
    });

    describe('CRUD Operations - Local Mode', () => {
        let localAdapter;
        beforeEach(() => {
            localAdapter = {
                type: 'local',
                saveData: vi.fn(),
                fetchGaps: vi.fn().mockResolvedValue([])
            };
        });

        it('creates a gap in local mode (assigns displayId if missing, updates state, saves to adapter)', async () => {
            const { result } = renderHook(() => useGapsData(localAdapter));
            const newGap = { id: 'gap-new', title: 'New Gap' };
            
            await act(async () => {
                await result.current.createGap(newGap);
            });
            
            expect(result.current.gaps.length).toBe(1);
            expect(result.current.gaps[0].id).toBe('gap-new');
            expect(result.current.gaps[0].displayId).toMatch(/^GAP-\d{4}$/);
            expect(localAdapter.saveData).toHaveBeenCalledWith('gaps', result.current.gaps);
        });

        it('updates a gap in local mode (updates state, saves to adapter)', async () => {
            const initialGaps = [{ id: 'GAP-1', displayId: 'GAP-1', title: 'Old Title' }];
            localAdapter.fetchGaps.mockResolvedValue(initialGaps);
            
            const { result } = renderHook(() => useGapsData(localAdapter));
            
            // Initial load
            await act(async () => {
                await result.current.fetchGaps();
            });
            
            await act(async () => {
                await result.current.updateGap('GAP-1', { title: 'New Title' });
            });
            
            expect(result.current.gaps[0].title).toBe('New Title');
            expect(localAdapter.saveData).toHaveBeenCalledWith('gaps', result.current.gaps);
        });

        it('deletes a gap in local mode (updates state, saves to adapter)', async () => {
            const initialGaps = [{ id: 'GAP-1', displayId: 'GAP-1', title: 'Gap 1' }];
            localAdapter.fetchGaps.mockResolvedValue(initialGaps);
            
            const { result } = renderHook(() => useGapsData(localAdapter));
            
            // Initial load
            await act(async () => {
                await result.current.fetchGaps();
            });
            
            await act(async () => {
                await result.current.deleteGap('GAP-1');
            });
            
            expect(result.current.gaps).toEqual([]);
            expect(localAdapter.saveData).toHaveBeenCalledWith('gaps', []);
        });
    });

    describe('CRUD Operations - Remote Mode', () => {
        let remoteAdapter;
        beforeEach(() => {
            remoteAdapter = {
                type: 'remote',
                createGap: vi.fn().mockResolvedValue({}),
                updateGap: vi.fn().mockResolvedValue({}),
                deleteGap: vi.fn().mockResolvedValue({}),
                fetchGaps: vi.fn().mockResolvedValue([]),
                saveData: vi.fn()
            };
        });

        it('creates a gap in remote mode (scrubs environment array, calls createGap, fetches gaps, does not call saveData)', async () => {
            const { result } = renderHook(() => useGapsData(remoteAdapter));
            const newGap = { id: 'gap-new', title: 'New Gap', environment: ['Prod', 'Staging'] };
            
            await act(async () => {
                await result.current.createGap(newGap);
            });
            
            expect(remoteAdapter.createGap).toHaveBeenCalledWith({
                id: 'gap-new',
                title: 'New Gap',
                displayId: expect.any(String),
                environment: 'Prod, Staging'
            });
            expect(remoteAdapter.fetchGaps).toHaveBeenCalled();
            expect(remoteAdapter.saveData).not.toHaveBeenCalled();
        });

        it('updates a gap in remote mode (scrubs environment array, calls updateGap, fetches gaps, does not call saveData)', async () => {
            const { result } = renderHook(() => useGapsData(remoteAdapter));
            const gapData = { title: 'Updated Gap', environment: ['Prod', 'Staging'] };
            
            await act(async () => {
                await result.current.updateGap('GAP-1', gapData);
            });
            
            expect(remoteAdapter.updateGap).toHaveBeenCalledWith('GAP-1', {
                title: 'Updated Gap',
                environment: 'Prod, Staging'
            });
            expect(remoteAdapter.fetchGaps).toHaveBeenCalled();
            expect(remoteAdapter.saveData).not.toHaveBeenCalled();
        });

        it('deletes a gap in remote mode (calls deleteGap, fetches gaps, does not call saveData)', async () => {
            const { result } = renderHook(() => useGapsData(remoteAdapter));
            
            await act(async () => {
                await result.current.deleteGap('GAP-1');
            });
            
            expect(remoteAdapter.deleteGap).toHaveBeenCalledWith('GAP-1');
            expect(remoteAdapter.fetchGaps).toHaveBeenCalled();
            expect(remoteAdapter.saveData).not.toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        let remoteAdapter;
        let consoleErrorSpy;

        beforeEach(() => {
            remoteAdapter = {
                type: 'remote',
                createGap: vi.fn().mockRejectedValue(new Error('Network Failure')),
                updateGap: vi.fn().mockRejectedValue(new Error('DB Timeout')),
                deleteGap: vi.fn().mockRejectedValue(new Error('Auth Expired')),
                fetchGaps: vi.fn(),
                saveData: vi.fn()
            };
            consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        });

        afterEach(() => {
            consoleErrorSpy.mockRestore();
        });

        it('handles createGap errors gracefully, logging to console and not calling fetchGaps', async () => {
            const { result } = renderHook(() => useGapsData(remoteAdapter));
            const newGap = { id: 'gap-new', title: 'New Gap' };
            
            await act(async () => {
                await result.current.createGap(newGap);
            });
            
            expect(consoleErrorSpy).toHaveBeenCalledWith('createGap error:', expect.any(Error));
            expect(remoteAdapter.fetchGaps).not.toHaveBeenCalled();
        });

        it('handles updateGap errors gracefully, logging to console and not calling fetchGaps', async () => {
            const { result } = renderHook(() => useGapsData(remoteAdapter));
            
            await act(async () => {
                await result.current.updateGap('GAP-1', { title: 'Updated' });
            });
            
            expect(consoleErrorSpy).toHaveBeenCalledWith('updateGap error:', expect.any(Error));
            expect(remoteAdapter.fetchGaps).not.toHaveBeenCalled();
        });

        it('handles deleteGap errors gracefully, logging to console and not calling fetchGaps', async () => {
            const { result } = renderHook(() => useGapsData(remoteAdapter));
            
            await act(async () => {
                await result.current.deleteGap('GAP-1');
            });
            
            expect(consoleErrorSpy).toHaveBeenCalledWith('deleteGap error:', expect.any(Error));
            expect(remoteAdapter.fetchGaps).not.toHaveBeenCalled();
        });
    });
});
