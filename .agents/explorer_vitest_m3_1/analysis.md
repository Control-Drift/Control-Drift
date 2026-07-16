# Milestone 3 State & Logic Testing: Hook Analysis & Test Strategy for `useGapsData.js`

This analysis report lays out a comprehensive strategy for unit testing the `useGapsData` custom hook in isolation using `@testing-library/react`'s `renderHook` and Vitest.

---

## 1. Codebase Analysis of `useGapsData.js`

### 1.1 Dependencies
*   **React Hooks**: `useState`, `useCallback`, `useEffect` (for state management, memoization, and side effects).
*   **Validation Utilities**: 
    *   `validateBulkData` (from `../lib/schemas.js`) to sanitize and validate input arrays.
    *   `GapSchema` (from `../lib/schemas.js`) to parse and transform individual gap items.

### 1.2 State Elements
*   `gaps` (Array, defaults to `[]`): The list of validated gaps.
*   `activeEnvironmentFilter` (String, defaults to `'All'`): Current selected filter environment.
*   `targetEnvironments` (Array, defaults to lazy initialization from `localStorage`): List of configured target environments.

### 1.3 Actions & Methods
*   `setGaps(gaps)`: Directly updates the gaps state.
*   `setActiveEnvironmentFilter(filter)`: Sets the environment filter.
*   `setTargetEnvironments(envs)`: Directly overrides target environments.
*   `addEnvironment(name)`: Trims whitespace, checks for case-insensitive duplicates, adds and alphabetically sorts target environments.
*   `deleteEnvironment(name)`: Case-sensitive filter to remove target environment by exact name match.
*   `fetchGaps(adapter)`: Asynchronously retrieves gaps, runs Zod schema validation, backfills missing `displayId`s, and persists changes if the adapter is `'local'`.
*   `createGap(gap)`: Creates a gap; splits logic into local vs. remote DB adapter paths.
*   `updateGap(id, gapData)`: Updates a gap; splits logic into local vs. remote DB adapter paths.
*   `deleteGap(id)`: Deletes a gap; splits logic into local vs. remote DB adapter paths.

### 1.4 API Adapters Compatibility
The hook is designed to work with two different adapter modalities:
1.  **Local Mode (`dbAdapter.type === 'local'`)**:
    *   Uses `adapter.fetchGaps()` to fetch.
    *   Uses `adapter.saveData('gaps', data)` for writes/deletions.
    *   Manipulates `gaps` state directly client-side first, then syncs with `adapter.saveData`.
2.  **Server/Remote Mode (`dbAdapter.type !== 'local'`)**:
    *   Uses `adapter.fetchGaps()`, `adapter.createGap()`, `adapter.updateGap()`, and `adapter.deleteGap()` respectively.
    *   Wait-and-sync design: Awaits the remote operation and then triggers a re-fetch of all gaps using `fetchGaps(dbAdapter)`.

---

## 2. Existing Test Suite Patterns
Our review of the test files in `src/__tests__/` reveals:
*   Tests are run using **Vitest** (utilizing `describe`, `it`, `expect`, `vi`, `beforeEach`, `afterEach`).
*   Mocking relies on `vi.mock` for component tree isolation and `vi.fn()` for context mocks (e.g. `Settings.test.jsx`, `GapTracker.test.jsx`).
*   DOM-based queries use `@testing-library/react` (`render`, `screen`, `fireEvent`, `waitFor`).
*   `localStorage` is interacted with globally; however, there is no isolated hook test (no usage of `renderHook`). This design introduces a dedicated specification for hooks testing.

---

## 3. Test Cases Specification

### 3.1 Initial State & Hydration
*   **Test Case 1.1**: Hook initialized with empty `localStorage`.
    *   *Assert*: `targetEnvironments` is `[]`, `activeEnvironmentFilter` is `'All'`, `gaps` is `[]`.
*   **Test Case 1.2**: Hook initialized with existing `localStorage` data for target environments.
    *   *Setup*: Populate `localStorage.setItem('target_envs', JSON.stringify(['Staging', 'Production']))`.
    *   *Assert*: `targetEnvironments` loads as `['Staging', 'Production']`.
*   **Test Case 1.3**: Hook initialized with corrupt `localStorage` data.
    *   *Setup*: Populate `localStorage.setItem('target_envs', 'corrupt-string-non-json')`.
    *   *Assert*: Catch block triggers gracefully, fallback value `targetEnvironments` is `[]`.

### 3.2 Environment Management
*   **Test Case 2.1**: `addEnvironment` adds valid new trimmed environment and sorts alphabetically.
    *   *Action*: Call `addEnvironment('  Staging  ')`, then `addEnvironment('Development')`.
    *   *Assert*: `targetEnvironments` is `['Development', 'Staging']`. `localStorage` item is updated.
*   **Test Case 2.2**: `addEnvironment` ignores empty/falsy inputs.
    *   *Action*: Call `addEnvironment('')`, `addEnvironment(null)`.
    *   *Assert*: `targetEnvironments` remains unchanged.
*   **Test Case 2.3**: `addEnvironment` prevents duplicate environments (case-insensitive).
    *   *Setup*: `targetEnvironments` is `['Production']`.
    *   *Action*: Call `addEnvironment('production')` or `addEnvironment('PRODUCTION  ')`.
    *   *Assert*: `targetEnvironments` remains `['Production']` (no duplicate added).
*   **Test Case 2.4**: `deleteEnvironment` removes the specified environment (case-sensitive).
    *   *Setup*: `targetEnvironments` is `['Development', 'Production']`.
    *   *Action*: Call `deleteEnvironment('Development')`.
    *   *Assert*: `targetEnvironments` is `['Production']`.
*   **Test Case 2.5**: `deleteEnvironment` case-sensitivity behavior.
    *   *Setup*: `targetEnvironments` is `['Production']`.
    *   *Action*: Call `deleteEnvironment('production')` (lowercase).
    *   *Assert*: `targetEnvironments` remains `['Production']` (no-op due to case-sensitive mismatch `e !== name`).

### 3.3 CRUD Operations: Local vs. Server Adapters
#### 3.3.1 Local Adapter (`type: 'local'`)
*   **Test Case 3.1**: `fetchGaps` updates state and backfills missing `displayId`s.
    *   *Setup*: Mock local dbAdapter returns `[{ id: 'GAP-1', title: 'Local Gap 1' }]` (missing `displayId`).
    *   *Action*: Call `fetchGaps()`.
    *   *Assert*: `gaps` state has 1 element, which has `displayId` matching `/GAP-\d{4}/`. `dbAdapter.saveData` is called with the backfilled array.
*   **Test Case 3.2**: `createGap` prepends new gap and writes to `saveData`.
    *   *Setup*: Initial gaps state: `[{ id: 'GAP-1', displayId: 'GAP-1001', title: 'G1' }]`.
    *   *Action*: Call `createGap({ id: 'GAP-2', title: 'New Local Gap' })`.
    *   *Assert*: `gaps` state starts with the new gap: `[{ id: 'GAP-2', ... }, { id: 'GAP-1', ... }]`. `dbAdapter.saveData` is called with the merged list.
*   **Test Case 3.3**: `updateGap` modifies matching item and writes to `saveData`.
    *   *Setup*: Initial gaps state: `[{ id: 'GAP-1', title: 'Old Title' }]`.
    *   *Action*: Call `updateGap('GAP-1', { title: 'New Title' })`.
    *   *Assert*: `gaps` state updated to `[{ id: 'GAP-1', title: 'New Title' }]`. `dbAdapter.saveData` is called.
*   **Test Case 3.4**: `deleteGap` removes matching item and writes to `saveData`.
    *   *Setup*: Initial gaps state: `[{ id: 'GAP-1', title: 'G1' }]`.
    *   *Action*: Call `deleteGap('GAP-1')`.
    *   *Assert*: `gaps` state is `[]`. `dbAdapter.saveData` is called with `[]`.

#### 3.3.2 Server-based Adapter (`type: 'rest'` or `'supabase'`)
*   **Test Case 3.5**: `fetchGaps` updates state and backfills but does NOT write to `saveData`.
    *   *Setup*: Mock server adapter returns `[{ id: 'GAP-1', title: 'Server Gap' }]` (no `displayId`).
    *   *Action*: Call `fetchGaps()`.
    *   *Assert*: `gaps` state updated. `dbAdapter.saveData` is NOT called.
*   **Test Case 3.6**: `createGap` formats environments, generates `displayId`, invokes API, and re-fetches.
    *   *Setup*: Mock server adapter `createGap` and `fetchGaps` functions. Initial state is empty.
    *   *Action*: Call `createGap({ id: 'GAP-2', title: 'Server Gap 2', environment: ['Prod', 'Staging'] })`.
    *   *Assert*:
        *   `dbAdapter.createGap` is invoked with `environment: "Prod, Staging"` (mapped to comma-separated string).
        *   `dbAdapter.createGap` payload contains a generated `displayId`.
        *   `dbAdapter.fetchGaps` is re-called once `createGap` completes.
*   **Test Case 3.7**: `updateGap` formats environments, invokes API, and re-fetches.
    *   *Setup*: Initial state loaded.
    *   *Action*: Call `updateGap('GAP-1', { title: 'Updated Title', environment: ['Dev'] })`.
    *   *Assert*:
        *   `dbAdapter.updateGap` is called with `('GAP-1', { title: 'Updated Title', environment: 'Dev' })`.
        *   `dbAdapter.fetchGaps` is re-called.
*   **Test Case 3.8**: `deleteGap` invokes API and re-fetches.
    *   *Setup*: Initial state loaded.
    *   *Action*: Call `deleteGap('GAP-1')`.
    *   *Assert*:
        *   `dbAdapter.deleteGap` called with `'GAP-1'`.
        *   `dbAdapter.fetchGaps` is re-called.

### 3.4 Error Handling
*   **Test Case 4.1**: `fetchGaps` throws an error.
    *   *Setup*: Mock `dbAdapter.fetchGaps` to reject/throw.
    *   *Action*: Call `fetchGaps()`.
    *   *Assert*: `console.error` is called. `gaps` is reset to/remains `[]` (prevents app crash).
*   **Test Case 4.2**: Server `createGap` API call fails.
    *   *Setup*: Mock server `dbAdapter.createGap` to reject.
    *   *Action*: Call `createGap({...})`.
    *   *Assert*: `console.error` called. `dbAdapter.fetchGaps` is **not** called. Hook state does not alter.
*   **Test Case 4.3**: Server `updateGap` API call fails.
    *   *Setup*: Mock server `dbAdapter.updateGap` to reject.
    *   *Action*: Call `updateGap('id', {...})`.
    *   *Assert*: `console.error` called. `dbAdapter.fetchGaps` is **not** called. Hook state does not alter.
*   **Test Case 4.4**: Server `deleteGap` API call fails.
    *   *Setup*: Mock server `dbAdapter.deleteGap` to reject.
    *   *Action*: Call `deleteGap('id')`.
    *   *Assert*: `console.error` called. `dbAdapter.fetchGaps` is **not** called. Hook state does not alter.

---

## 4. Mock Designs & Implementation

To implement these tests without loading actual SQLite/Supabase/REST dependencies, we design standard Vitest mocks.

### 4.1 Mock Adapters Design

```javascript
// Local Adapter Mock
export const createMockLocalAdapter = (initialGaps = []) => {
    let gapsStore = [...initialGaps];
    return {
        type: 'local',
        fetchGaps: vi.fn().mockImplementation(async () => {
            return gapsStore;
        }),
        saveData: vi.fn().mockImplementation(async (key, data) => {
            if (key === 'gaps') {
                gapsStore = data;
            }
            return true;
        })
    };
};

// Server Adapter Mock
export const createMockServerAdapter = (initialGaps = []) => {
    const gapsStore = [...initialGaps];
    return {
        type: 'rest', // or 'supabase'
        fetchGaps: vi.fn().mockResolvedValue(gapsStore),
        createGap: vi.fn().mockResolvedValue({ success: true }),
        updateGap: vi.fn().mockResolvedValue({ success: true }),
        deleteGap: vi.fn().mockResolvedValue({ success: true })
    };
};
```

---

## 5. Vitest Hook Test Specification Template
Below is the design of the test file `src/__tests__/useGapsData.test.js` targeting 100% logic coverage:

```javascript
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useGapsData } from '../hooks/useGapsData';

describe('useGapsData hook in isolation', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    describe('Initialization & Hydration', () => {
        it('should initialize with default states when localStorage is empty', () => {
            const { result } = renderHook(() => useGapsData(null));

            expect(result.current.gaps).toEqual([]);
            expect(result.current.activeEnvironmentFilter).toBe('All');
            expect(result.current.targetEnvironments).toEqual([]);
        });

        it('should hydrate target environments from localStorage', () => {
            localStorage.setItem('target_envs', JSON.stringify(['Staging', 'Production']));
            const { result } = renderHook(() => useGapsData(null));

            expect(result.current.targetEnvironments).toEqual(['Staging', 'Production']);
        });

        it('should fallback to empty array on invalid localStorage JSON', () => {
            localStorage.setItem('target_envs', '{invalid-json}');
            const { result } = renderHook(() => useGapsData(null));

            expect(result.current.targetEnvironments).toEqual([]);
        });
    });

    describe('Environment Management', () => {
        it('should add environment, trim it, sort them, and save to localStorage', () => {
            const { result } = renderHook(() => useGapsData(null));

            act(() => {
                result.current.addEnvironment('  Staging  ');
            });
            expect(result.current.targetEnvironments).toEqual(['Staging']);
            expect(JSON.parse(localStorage.getItem('target_envs'))).toEqual(['Staging']);

            act(() => {
                result.current.addEnvironment('Development');
            });
            expect(result.current.targetEnvironments).toEqual(['Development', 'Staging']);
        });

        it('should ignore duplicate environments case-insensitively', () => {
            const { result } = renderHook(() => useGapsData(null));

            act(() => {
                result.current.addEnvironment('Production');
            });
            act(() => {
                result.current.addEnvironment('production'); // lowercase duplicate
            });

            expect(result.current.targetEnvironments).toEqual(['Production']);
        });

        it('should ignore empty environment name inputs', () => {
            const { result } = renderHook(() => useGapsData(null));

            act(() => {
                result.current.addEnvironment('');
            });
            act(() => {
                result.current.addEnvironment(null);
            });

            expect(result.current.targetEnvironments).toEqual([]);
        });

        it('should delete environments case-sensitively', () => {
            localStorage.setItem('target_envs', JSON.stringify(['Prod', 'Staging']));
            const { result } = renderHook(() => useGapsData(null));

            act(() => {
                result.current.deleteEnvironment('prod'); // Mismatch case
            });
            expect(result.current.targetEnvironments).toEqual(['Prod', 'Staging']);

            act(() => {
                result.current.deleteEnvironment('Prod'); // Match case
            });
            expect(result.current.targetEnvironments).toEqual(['Staging']);
        });
    });

    describe('Local Mode DB Operations', () => {
        const mockGaps = [
            { id: 'GAP-1', title: 'Local Vulnerability', status: 'Open', severity: 'High' }
        ];

        it('should fetch, validate, backfill displayId and save to local adapter', async () => {
            const mockAdapter = {
                type: 'local',
                fetchGaps: vi.fn().mockResolvedValue(mockGaps),
                saveData: vi.fn().mockResolvedValue(true)
            };

            const { result } = renderHook(() => useGapsData(mockAdapter));

            await act(async () => {
                await result.current.fetchGaps();
            });

            expect(result.current.gaps.length).toBe(1);
            expect(result.current.gaps[0].displayId).toMatch(/^GAP-\d{4}$/);
            expect(mockAdapter.saveData).toHaveBeenCalledWith('gaps', expect.any(Array));
        });

        it('should create gap local-path and write to saveData', async () => {
            const mockAdapter = {
                type: 'local',
                saveData: vi.fn().mockResolvedValue(true)
            };

            const { result } = renderHook(() => useGapsData(mockAdapter));

            act(() => {
                result.current.setGaps([{ id: 'GAP-1', displayId: 'GAP-1001', title: 'G1' }]);
            });

            await act(async () => {
                await result.current.createGap({ id: 'GAP-2', title: 'G2' });
            });

            expect(result.current.gaps.length).toBe(2);
            expect(result.current.gaps[0].id).toBe('GAP-2');
            expect(mockAdapter.saveData).toHaveBeenCalledTimes(1);
        });

        it('should update gap local-path and write to saveData', async () => {
            const mockAdapter = {
                type: 'local',
                saveData: vi.fn().mockResolvedValue(true)
            };

            const { result } = renderHook(() => useGapsData(mockAdapter));

            act(() => {
                result.current.setGaps([{ id: 'GAP-1', title: 'Old Title' }]);
            });

            await act(async () => {
                await result.current.updateGap('GAP-1', { title: 'New Title' });
            });

            expect(result.current.gaps[0].title).toBe('New Title');
            expect(mockAdapter.saveData).toHaveBeenCalledTimes(1);
        });

        it('should delete gap local-path and write to saveData', async () => {
            const mockAdapter = {
                type: 'local',
                saveData: vi.fn().mockResolvedValue(true)
            };

            const { result } = renderHook(() => useGapsData(mockAdapter));

            act(() => {
                result.current.setGaps([{ id: 'GAP-1', title: 'G1' }]);
            });

            await act(async () => {
                await result.current.deleteGap('GAP-1');
            });

            expect(result.current.gaps).toEqual([]);
            expect(mockAdapter.saveData).toHaveBeenCalledTimes(1);
        });
    });

    describe('Server/Remote Mode DB Operations', () => {
        it('should fetch, validate, backfill displayId but NOT save to server database', async () => {
            const mockAdapter = {
                type: 'rest',
                fetchGaps: vi.fn().mockResolvedValue([{ id: 'GAP-1', title: 'Server Gap' }]),
                saveData: vi.fn()
            };

            const { result } = renderHook(() => useGapsData(mockAdapter));

            await act(async () => {
                await result.current.fetchGaps();
            });

            expect(result.current.gaps.length).toBe(1);
            expect(result.current.gaps[0].displayId).toBeDefined();
            expect(mockAdapter.saveData).not.toHaveBeenCalled();
        });

        it('should create gap remotely, format environments, and refetch', async () => {
            const mockAdapter = {
                type: 'rest',
                fetchGaps: vi.fn().mockResolvedValue([]),
                createGap: vi.fn().mockResolvedValue({ success: true })
            };

            const { result } = renderHook(() => useGapsData(mockAdapter));

            await act(async () => {
                await result.current.createGap({
                    id: 'GAP-2',
                    title: 'R2',
                    environment: ['Staging', 'Production']
                });
            });

            expect(mockAdapter.createGap).toHaveBeenCalledWith(expect.objectContaining({
                id: 'GAP-2',
                environment: 'Staging, Production',
                displayId: expect.any(String)
            }));
            // fetchGaps is called once during createGap orchestration
            expect(mockAdapter.fetchGaps).toHaveBeenCalled();
        });

        it('should update gap remotely, format environment and refetch', async () => {
            const mockAdapter = {
                type: 'supabase',
                fetchGaps: vi.fn().mockResolvedValue([]),
                updateGap: vi.fn().mockResolvedValue({ success: true })
            };

            const { result } = renderHook(() => useGapsData(mockAdapter));

            await act(async () => {
                await result.current.updateGap('GAP-1', {
                    title: 'Updated',
                    environment: ['QA']
                });
            });

            expect(mockAdapter.updateGap).toHaveBeenCalledWith('GAP-1', expect.objectContaining({
                title: 'Updated',
                environment: 'QA'
            }));
            expect(mockAdapter.fetchGaps).toHaveBeenCalled();
        });

        it('should delete gap remotely and refetch', async () => {
            const mockAdapter = {
                type: 'rest',
                fetchGaps: vi.fn().mockResolvedValue([]),
                deleteGap: vi.fn().mockResolvedValue({ success: true })
            };

            const { result } = renderHook(() => useGapsData(mockAdapter));

            await act(async () => {
                await result.current.deleteGap('GAP-1');
            });

            expect(mockAdapter.deleteGap).toHaveBeenCalledWith('GAP-1');
            expect(mockAdapter.fetchGaps).toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        it('should handle fetchGaps failure gracefully by logging and clearing state', async () => {
            const mockAdapter = {
                type: 'local',
                fetchGaps: vi.fn().mockRejectedValue(new Error('Database offline'))
            };

            const { result } = renderHook(() => useGapsData(mockAdapter));
            
            // Seed local state first
            act(() => {
                result.current.setGaps([{ id: 'OLD' }]);
            });

            await act(async () => {
                await result.current.fetchGaps();
            });

            expect(console.error).toHaveBeenCalledWith('Failed to fetch gaps:', expect.any(Error));
            expect(result.current.gaps).toEqual([]);
        });

        it('should catch server createGap failure, log it, and skip refetching', async () => {
            const mockAdapter = {
                type: 'rest',
                fetchGaps: vi.fn(),
                createGap: vi.fn().mockRejectedValue(new Error('Network error'))
            };

            const { result } = renderHook(() => useGapsData(mockAdapter));

            await act(async () => {
                await result.current.createGap({ id: 'GAP-1', title: 'Fail' });
            });

            expect(console.error).toHaveBeenCalledWith('createGap error:', expect.any(Error));
            expect(mockAdapter.fetchGaps).not.toHaveBeenCalled();
        });
    });
});
```

---

## 6. Notable Caveats & Anti-Patterns Identified

1.  **Synchronous State Update with Async Operations (Local Adapter)**:
    In local dbAdapter mode, `createGap`, `updateGap`, and `deleteGap` update the React state synchronously, but trigger an *asynchronous* call to `dbAdapter.saveData` inside the state updater:
    ```javascript
    setGaps(prev => {
        const next = ...;
        dbAdapter.saveData('gaps', next); // returns Promise
        return next;
    });
    ```
    This is an anti-pattern. React state update functions should be pure and free of side-effects. Calling an async function without awaiting it or catching its promise rejection can cause unhandled promise rejections if the write fails (e.g. disk full, localStorage quota exceeded).
2.  **Alphabetical Sorting Side Effect**:
    The `addEnvironment` action modifies the target environments and sorts them: `[...prev, cleanName].sort()`. However, standard JavaScript `.sort()` is alphabetical and case-sensitive (e.g., `'prod'` comes after `'Production'`). Though duplicate check is case-insensitive, environments with mixed casing will sort in UTF-16 code unit order rather than pure alphabetical order.
3.  **Environment Array Mapping Mismatch**:
    When creating or updating a gap in server mode, the environment array is mapped to a string:
    `environment: Array.isArray(gap.environment) ? gap.environment.join(', ') : gap.environment`
    However, on local mode, the environment array remains an array. This means gaps stored in local dbAdapter vs. server dbAdapter will have different formats for their `environment` property, leading to rendering differences in UI downstream. This requires unit tests to cover both formats when testing components using this data.
