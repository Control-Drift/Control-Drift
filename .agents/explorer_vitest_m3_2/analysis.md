# Milestone 3: State & Logic/Context Testing Strategy (AppContext & AppProvider)

This report outlines the detailed analysis and test specification for `src/AppContext.jsx` and the `AppProvider` integration. It serves as a blueprint for implementing comprehensive test coverage using Vitest and React Testing Library.

---

## 1. Codebase Analysis & Orchestration Logic

### 1.1 AppProvider Architecture
`AppProvider` is the central state hub of the application. Instead of managing all state locally, it orchestrates multiple domain-specific React hooks and exposes their consolidated state, handlers, and utility functions through `AppContext`.

The hook interactions inside `AppProvider` are as follows:
- **`useDbConnection`**: Manages the database config (`dbConfig`), initialization (`initDb`), authentication (`isAuthenticated`), and loading status (`isDbLoading`).
- **`useAppUI`**: Manages confirmations, offline sync checking (`checkSyncQueue`), and toast notifications (`addToast`).
- **`useExercisesData` / `useGapsData` / `useSimulationsData` / `useTagsData` / `useSecurityControlsData`**: Domain-specific state hooks.
- **`useMitreData`**: Receives the database adapter and a *reactive, memoized filtered subset* of exercise data to compute coverage.
- **`useExerciseActions`**: Coordinates complex state modifications across exercises, gaps, and simulations.

### 1.2 Data Loading Orchestration (`loadData`)
The core orchestrator for fetching all application data is the `loadData` callback:
```javascript
const loadData = useCallback(async (adapter) => {
    if (!adapter) return;
    await exData.loadAllData(adapter);
    await gapsData.fetchGaps(adapter);
    await simsData.fetchSimulations(adapter);
    
    // Load initial Mitre skeleton
    await mitreHook.loadMitreSkeleton();
}, [exData.loadAllData, gapsData.fetchGaps, simsData.fetchSimulations, mitreHook.loadMitreSkeleton]);
```
#### Key Analysis Points:
- **Sequential Awaits**: The loading process waits for exercise data, gap tracker data, and simulations to resolve, then finally loads the MITRE ATT&CK framework skeleton.
- **Separation of Loading and Calculation**: `loadMitreSkeleton` only fetches/loads the base MITRE matrix (from local cache or remote STIX JSON). The actual computation of coverage statuses (e.g. mapping exercise TTPs to matrix cells) is done *reactively* inside `useMitreData` via `useMemo` based on `filteredExercisesForMitre`.
- **Ref Refinement**: To prevent the mounting effect from re-running whenever dependencies of `loadData` change, a ref `loadDataRef` is utilized:
  ```javascript
  const loadDataRef = useRef(loadData);
  useEffect(() => { loadDataRef.current = loadData; }, [loadData]);
  ```

### 1.3 Database & Sync Initialization Logic
#### A. On-Mount Database Initialization:
```javascript
useEffect(() => {
    initDb((adapter) => loadDataRef.current(adapter));
}, [dbConfig, initDb]);
```
- **Execution Flow**: When the provider mounts, it triggers `initDb`. If authentication succeeds, `initDb` calls the provided callback with the initialized `dbAdapter`.
- **Liveness Prevention**: By passing `(adapter) => loadDataRef.current(adapter)` to `initDb` and referencing the ref, `initDb` can always execute the latest `loadData` closure without triggering unnecessary database initialization runs when `loadData` changes.

#### B. Interval Sync Queue:
```javascript
useEffect(() => {
    const interval = setInterval(() => checkSyncQueue(dbAdapter, isAuthenticated), 15000);
    return () => clearInterval(interval);
}, [dbAdapter, isAuthenticated, checkSyncQueue]);
```
- **Interval Sync**: Every 15 seconds, the application calls `checkSyncQueue` from `useAppUI`. This function checks `localStorage` for offline pending changes and attempts to synchronize them with the remote database adapter if online.
- **Dependency Tracking**: The effect correctly updates its timer whenever the `dbAdapter` instance, authentication status, or `checkSyncQueue` function identity changes. It returns a cleanup function to prevent memory leaks by calling `clearInterval`.

---

## 2. Test Specifications & Strategy

### 2.1 Mounting & Initial Data Loading Tests
#### Test Objective:
Verify that mounting the `AppProvider` correctly initializes the database and triggers the cascading loading sequence if authenticated.
#### Test Cases:
1. **Successful Auth & Load Cascade**:
   - Mock `initDb` to immediately invoke its callback parameter with a mock `dbAdapter`.
   - Verify that `initDb` is called on mount.
   - Assert that `exData.loadAllData`, `gapsData.fetchGaps`, and `simsData.fetchSimulations` are all called with the mock `dbAdapter`.
   - Assert that `mitreHook.loadMitreSkeleton` is called.
2. **Failed Auth / No Load Cascade**:
   - Mock `initDb` to resolve without executing the callback (representing failed/pending authentication).
   - Assert that `initDb` was called, but none of the loading functions (`loadAllData`, `fetchGaps`, etc.) are triggered.

### 2.2 Sync Queue Interval Tests
#### Test Objective:
Verify that `checkSyncQueue` is invoked periodically with correct parameters and cleaned up properly on unmount.
#### Test Cases:
1. **Periodic Execution**:
   - Use Vitest's fake timers (`vi.useFakeTimers`).
   - Mock `dbAdapter` and `isAuthenticated = true`.
   - Render the `AppProvider`.
   - Advance timers by 15,000ms and verify `checkSyncQueue` was called once with `(dbAdapter, true)`.
   - Advance timers by another 15,000ms and verify call count is now 2.
2. **Interval Cleanup on Unmount**:
   - Unmount the component.
   - Advance timers by 15,000ms and verify call count did not increase.
3. **Dependency Re-Triggering**:
   - Change `isAuthenticated` or `dbAdapter` reference.
   - Verify that the old interval is cleared and a new interval starts immediately.

### 2.3 Utility Functions in Context
#### A. `toggleTacticScope(tacticName)`
- **Behavior**: Calls `mitreHook.setBaseMitreData` with an updater function to toggle technique statuses within a tactic between `'na'` and `'unknown'`.
- **Test cases**:
  - *Mixed/Unknown Status*: If techniques are not all `'na'`, calling `toggleTacticScope` must toggle all matching techniques (which are `'unknown'` or `'na'`) to `'na'`.
  - *All NA Status*: If all techniques are `'na'`, calling `toggleTacticScope` must toggle them all to `'unknown'`.
  - *Non-Existent Tactic*: Calling it with an invalid tactic name should leave the state unmodified.

#### B. `toggleTechniqueScope(techId, environment)`
- **Behavior**: Calls `mitreHook.setBaseMitreData` to toggle the status of a specific technique (identified by `techId`) across all tactics it belongs to.
- **Test cases**:
  - *Environment = 'All'*: Toggle technique status between `'na'` and `'unknown'` globally.
  - *Environment = 'Production'*: Toggle technique status globally AND set `environments['Production']` to the toggled status.
  - *Non-Existent ID*: If `techId` does not exist, return the state unchanged.

#### C. `compressImage(dataUrl, maxWidth)`
- **Behavior**: Uses browser `Image` and `Canvas` to scale down screenshots.
- **Test cases**:
  - *Within Limit*: If input image width <= `maxWidth`, resolve immediately with the original `dataUrl`.
  - *Above Limit*: If input image width > `maxWidth`, scale it down using canvas and return a new compressed JPEG data URL (quality `0.6`).

#### D. `injectTestData()`
- **Behavior**: Shows a toast indicating the feature is disabled.
- **Test cases**:
  - Call `injectTestData()` and verify it triggers `addToast` with `("Stress Test Injection is disabled in the refactored architecture. Please use the Import feature.", "info")`.

---

## 3. Mock Implementation Designs

To isolate `AppContext` testing and avoid hitting network resources or real IndexedDB/Supabase connections, we use Vitest's mocking engine.

### 3.1 Custom Hooks Mock Design
Mock definitions for all hooks consumed by `AppContext.jsx`:

```javascript
import { vi } from 'vitest';

// Spies to verify hook parameters & calls
export const mockInitDb = vi.fn();
export const mockCheckSyncQueue = vi.fn();
export const mockLoadAllData = vi.fn();
export const mockFetchGaps = vi.fn();
export const mockFetchSimulations = vi.fn();
export const mockLoadMitreSkeleton = vi.fn();
export const mockSetBaseMitreData = vi.fn();
export const mockAddToast = vi.fn();

export const setupMocks = () => {
  vi.mock('./hooks/useDbConnection', () => ({
    useDbConnection: () => ({
      dbConfig: { provider: 'local', endpoint: '', apiKey: '' },
      setDbConfig: vi.fn(),
      dbAdapter: { type: 'mock-db' },
      isAuthenticated: true,
      setIsAuthenticated: vi.fn(),
      isDbLoading: false,
      userRole: 'admin',
      initDb: mockInitDb,
    }),
  }));

  vi.mock('./hooks/useAppUI', () => ({
    useAppUI: () => ({
      confirmConfig: { isOpen: false, message: '', onConfirm: null },
      confirmAction: vi.fn(),
      closeConfirm: vi.fn(),
      requestSuccessToast: vi.fn(),
      checkSyncQueue: mockCheckSyncQueue,
      addToast: mockAddToast,
    }),
  }));

  vi.mock('./hooks/useExercisesData', () => ({
    useExercisesData: () => ({
      exercises: [],
      allExercisesData: {},
      totalExercises: 0,
      exercisesPage: 1,
      exercisesLimit: 50,
      fetchExercisesPage: vi.fn(),
      loadAllData: mockLoadAllData,
    }),
  }));

  vi.mock('./hooks/useGapsData', () => ({
    useGapsData: () => ({
      gaps: [],
      fetchGaps: mockFetchGaps,
    }),
  }));

  vi.mock('./hooks/useSimulationsData', () => ({
    useSimulationsData: () => ({
      simulationSummaries: {},
      simulationEvidence: {},
      fetchSimulations: mockFetchSimulations,
    }),
  }));

  vi.mock('./hooks/useMitreData', () => ({
    useMitreData: () => ({
      mitreData: {},
      isMitreLoading: false,
      loadMitreSkeleton: mockLoadMitreSkeleton,
      setBaseMitreData: mockSetBaseMitreData,
    }),
  }));

  vi.mock('./hooks/useExerciseActions', () => ({
    useExerciseActions: () => ({
      completeExercise: vi.fn(),
      updateExerciseValidation: vi.fn(),
    }),
  }));

  vi.mock('./hooks/useAiData', () => ({
    useAiData: () => ({}),
  }));

  vi.mock('./hooks/useTagsData', () => ({
    useTagsData: () => ({ activeTagFilter: 'All' }),
  }));

  vi.mock('./hooks/useSecurityControlsData', () => ({
    useSecurityControlsData: () => ({ activeSecurityControlFilter: 'All' }),
  }));
};
```

### 3.2 Canvas & Image Browser APIs Mock Design
Since JSDOM does not implement visual rendering or complete canvas operations, the following mocks must be stubbed globally during tests targeting image compression:

```javascript
export const mockBrowserApis = () => {
  const originalImage = global.Image;
  const originalCreateElement = global.document.createElement;

  // Mock Image behavior
  global.Image = class {
    constructor() {
      this.onload = null;
      this.src = '';
      // Simulate asynchronous load
      setTimeout(() => {
        if (this.onload) this.onload();
      }, 0);
    }
    get width() { return this._width || 1000; }
    set width(val) { this._width = val; }
    get height() { return this._height || 600; }
    set height(val) { this._height = val; }
  };

  // Mock Canvas behavior
  global.document.createElement = (tagName) => {
    if (tagName === 'canvas') {
      return {
        width: 0,
        height: 0,
        getContext: () => ({
          drawImage: vi.fn(),
        }),
        toDataURL: vi.fn().mockReturnValue('data:image/jpeg;base64,compressed-result'),
      };
    }
    return originalCreateElement(tagName);
  };

  return () => {
    global.Image = originalImage;
    global.document.createElement = originalCreateElement;
  };
};
```

---

## 4. Proposed Test Implementation Blueprint

Below is the complete blueprint implementation of `AppContext.test.jsx`. This uses the mock patterns defined above to comprehensively test `AppProvider` behaviors:

```javascript
import React from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AppProvider, useAppContext } from '../AppContext';

// Import mocked spies
import {
  mockInitDb,
  mockCheckSyncQueue,
  mockLoadAllData,
  mockFetchGaps,
  mockFetchSimulations,
  mockLoadMitreSkeleton,
  mockSetBaseMitreData,
  mockAddToast,
  setupMocks
} from './mocks/appContextHooks';

// Apply the custom hooks mocks
setupMocks();

// Helper Component to consume context for assertion
const TestConsumer = ({ onFetchContext }) => {
  const context = useAppContext();
  React.useEffect(() => {
    if (onFetchContext) onFetchContext(context);
  }, [context, onFetchContext]);
  return <div data-testid="consumer">App Context Rendered</div>;
};

describe('AppProvider (AppContext.jsx) Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Initialization and Mount Flow', () => {
    it('should call initDb on mount and execute loadData cascade when authenticated', async () => {
      // Setup initDb to immediately trigger onSuccess callback with mock adapter
      const mockAdapter = { type: 'mock-local-db' };
      mockInitDb.mockImplementationOnce(async (onLoadComplete) => {
        if (onLoadComplete) {
          await onLoadComplete(mockAdapter);
        }
      });

      render(
        <AppProvider>
          <TestConsumer />
        </AppProvider>
      );

      expect(mockInitDb).toHaveBeenCalledTimes(1);
      
      // Verify data loaders are called with adapter
      expect(mockLoadAllData).toHaveBeenCalledWith(mockAdapter);
      expect(mockFetchGaps).toHaveBeenCalledWith(mockAdapter);
      expect(mockFetchSimulations).toHaveBeenCalledWith(mockAdapter);
      
      // Verify Mitre skeleton load is triggered
      expect(mockLoadMitreSkeleton).toHaveBeenCalledTimes(1);
    });

    it('should call initDb but NOT trigger data loaders if unauthenticated', async () => {
      // Resolve initDb without invoking callback (auth failed/pending)
      mockInitDb.mockImplementationOnce(async () => {});

      render(
        <AppProvider>
          <TestConsumer />
        </AppProvider>
      );

      expect(mockInitDb).toHaveBeenCalledTimes(1);
      expect(mockLoadAllData).not.toHaveBeenCalled();
      expect(mockFetchGaps).not.toHaveBeenCalled();
      expect(mockFetchSimulations).not.toHaveBeenCalled();
      expect(mockLoadMitreSkeleton).not.toHaveBeenCalled();
    });
  });

  describe('Sync Queue Interval', () => {
    it('should invoke checkSyncQueue every 15 seconds with current dbAdapter and auth status', () => {
      render(
        <AppProvider>
          <TestConsumer />
        </AppProvider>
      );

      // Fast-forward 15 seconds
      act(() => {
        vi.advanceTimersByTime(15000);
      });
      expect(mockCheckSyncQueue).toHaveBeenCalledTimes(1);
      expect(mockCheckSyncQueue).toHaveBeenLastCalledWith({ type: 'mock-db' }, true);

      // Fast-forward another 15 seconds
      act(() => {
        vi.advanceTimersByTime(15000);
      });
      expect(mockCheckSyncQueue).toHaveBeenCalledTimes(2);
    });

    it('should clear interval on unmount', () => {
      const { unmount } = render(
        <AppProvider>
          <TestConsumer />
        </AppProvider>
      );

      unmount();

      act(() => {
        vi.advanceTimersByTime(30000);
      });
      expect(mockCheckSyncQueue).not.toHaveBeenCalled();
    });
  });

  describe('Context Utility Functions', () => {
    it('should invoke addToast when injectTestData is triggered', () => {
      let contextVal;
      render(
        <AppProvider>
          <TestConsumer onFetchContext={(ctx) => { contextVal = ctx; }} />
        </AppProvider>
      );

      act(() => {
        contextVal.injectTestData();
      });

      expect(mockAddToast).toHaveBeenCalledWith(
        "Stress Test Injection is disabled in the refactored architecture. Please use the Import feature.",
        "info"
      );
    });

    it('should handle toggleTacticScope update correctly', () => {
      let contextVal;
      render(
        <AppProvider>
          <TestConsumer onFetchContext={(ctx) => { contextVal = ctx; }} />
        </AppProvider>
      );

      act(() => {
        contextVal.toggleTacticScope('Initial Access');
      });

      // It triggers setBaseMitreData state updater function
      expect(mockSetBaseMitreData).toHaveBeenCalledTimes(1);
      
      const updater = mockSetBaseMitreData.mock.calls[0][0];

      // Test Case A: mixed statuses (not all na) -> toggles all to 'na'
      const stateMixed = {
        'Initial Access': {
          techniques: [
            { id: 'T1190', status: 'unknown' },
            { id: 'T1566', status: 'na' }
          ]
        }
      };
      const resultMixed = updater(stateMixed);
      expect(resultMixed['Initial Access'].techniques[0].status).toBe('na');
      expect(resultMixed['Initial Access'].techniques[1].status).toBe('na');

      // Test Case B: all statuses are 'na' -> toggles all to 'unknown'
      const stateAllNa = {
        'Initial Access': {
          techniques: [
            { id: 'T1190', status: 'na' },
            { id: 'T1566', status: 'na' }
          ]
        }
      };
      const resultAllNa = updater(stateAllNa);
      expect(resultAllNa['Initial Access'].techniques[0].status).toBe('unknown');
      expect(resultAllNa['Initial Access'].techniques[1].status).toBe('unknown');
    });

    it('should handle toggleTechniqueScope update correctly', () => {
      let contextVal;
      render(
        <AppProvider>
          <TestConsumer onFetchContext={(ctx) => { contextVal = ctx; }} />
        </AppProvider>
      );

      // 1. Test Toggle globally (environment = 'All')
      act(() => {
        contextVal.toggleTechniqueScope('T1059', 'All');
      });

      expect(mockSetBaseMitreData).toHaveBeenCalledTimes(1);
      const updaterGlobal = mockSetBaseMitreData.mock.calls[0][0];
      const stateInitial = {
        'Execution': {
          techniques: [{ id: 'T1059', status: 'na', environments: {} }]
        }
      };
      
      const resultGlobal = updaterGlobal(stateInitial);
      expect(resultGlobal['Execution'].techniques[0].status).toBe('unknown');

      // 2. Test Toggle specific environment (environment = 'Production')
      vi.clearAllMocks();
      act(() => {
        contextVal.toggleTechniqueScope('T1059', 'Production');
      });

      const updaterEnv = mockSetBaseMitreData.mock.calls[0][0];
      const resultEnv = updaterEnv(stateInitial);
      expect(resultEnv['Execution'].techniques[0].status).toBe('unknown');
      expect(resultEnv['Execution'].techniques[0].environments['Production']).toBe('unknown');
    });

    it('should compress images based on width constraint', async () => {
      // Register canvas/image mock stubs
      const restoreStubs = mockBrowserApis();

      let contextVal;
      render(
        <AppProvider>
          <TestConsumer onFetchContext={(ctx) => { contextVal = ctx; }} />
        </AppProvider>
      );

      // Case A: Image width within maxWidth (800)
      // Stub Image to have width = 500
      Image.prototype._width = 500;
      const resA = await contextVal.compressImage('data:image/png;base64,original-small', 800);
      expect(resA).toBe('data:image/png;base64,original-small');

      // Case B: Image width exceeding maxWidth (800)
      // Stub Image to have width = 1200
      Image.prototype._width = 1200;
      const resB = await contextVal.compressImage('data:image/png;base64,original-large', 800);
      expect(resB).toBe('data:image/jpeg;base64,compressed-result');

      restoreStubs();
    });
  });
});
```
