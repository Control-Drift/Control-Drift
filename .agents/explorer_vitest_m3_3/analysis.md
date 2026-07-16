# Milestone 3 Testing Strategy: State & Logic/Context Testing

This document details the comprehensive testing strategy, mocking requirements, and test specifications for **Milestone 3 (State & Logic/Context Testing)**, specifically focusing on `src/AppContext.jsx` and `src/hooks/useGapsData.js`.

---

## 1. Executive Summary
Milestone 3 testing covers the core state coordination, business logic, and database synchronization of the application. By mocking database connections, React hooks, and browser APIs (including local storage, history/search, and HTML5 Canvas), we establish a robust, reliable, and isolated testing suite in Vitest without external network or filesystem mutations.

---

## 2. Dependency & Mocking Boundary Analysis

### 2.1 `src/AppContext.jsx` Dependencies
`AppContext` serves as the central orchestration hub of the application. It aggregates multiple domain hooks, maintains the active database connection state, coordinates loading data on boot, manages synchronization, and provides utility functions.

| Dependency | Category | Usage / Impact in `AppContext` | Mocking Strategy |
| :--- | :--- | :--- | :--- |
| `useDbConnection` | React Hook | Manages auth, adapter state, and initialization. | Mock to return custom adapter and controllable states. |
| `useExercisesData` | React Hook | Handles exercise state and fetches. | Mock returning simulated data state and fetch triggers. |
| `useGapsData` | React Hook | Manages Gap arrays and environment lists. | Mock returning list of mock gaps and CRUD stubs. |
| `useSimulationsData` | React Hook | Manages simulation summary and evidence data. | Mock returning mock summaries and evidence. |
| `useTagsData` | React Hook | Tracks active and target tag lists. | Mock returning mock tags and filters. |
| `useSecurityControlsData` | React Hook | Handles security control filters. | Mock returning controls and filter status. |
| `useMitreData` | React Hook | Calculates MITRE matrix and loads STIX data. | Mock to prevent network calls and return static matrix. |
| `useExerciseActions` | React Hook | Executes complex validation updates and gap updates. | Mock to return trigger functions for actions. |
| `useAiData` | React Hook | Handles Gemini/Anthropic API calls and stream settings. | Mock to prevent API calls and return test settings. |
| `useAppUI` | React Hook | Controls confirmation modal and toast queueing. | Mock returning stubs for UI dialogs and toast triggers. |
| `useToast` | React Hook | Displays global notifications. | Mock returning `addToast` spy. |
| `Image` / Canvas API | Browser Globals | Used inside `compressImage` utility for image resizing. | Stub global `Image` class and mock canvas `2d` context. |
| `setInterval` / `clearInterval` | Browser Globals | Runs background queue sync check every 15 seconds. | Use Vitest fake timers (`vi.useFakeTimers()`). |

### 2.2 `src/hooks/useGapsData.js` Dependencies
The `useGapsData` hook governs gap lifecycle, filtering, and environment management.

| Dependency | Category | Usage / Impact in `useGapsData` | Mocking Strategy |
| :--- | :--- | :--- | :--- |
| `localStorage` | Browser Global | Loads/saves `target_envs`. | Mock `localStorage.getItem` and `setItem` with in-memory store. |
| `validateBulkData`, `GapSchema` | Lib imports | Performs validation checks on database rows. | Real imports from `src/lib/schemas.js` (no mock needed, ensures schema compliance). |
| `dbAdapter` | Parameter | Coordinates CRUD operations (SQL, REST, or Local). | Provide a mocked Database Adapter with controllable behaviors. |

---

## 3. Mock Implementation Designs

### 3.1 Mock Database Adapter (`dbAdapter`)
A flexible database adapter mock supporting both `'local'` (which writes to localStorage) and `'remote'` (SQL/REST, which runs async updates and forces re-fetches) modes.

```javascript
import { vi } from 'vitest';

export const createMockDbAdapter = (type = 'local') => {
  const store = {
    gaps: [],
    exercises: [],
    simulations_table: []
  };

  return {
    type,
    // General storage mockup for local adapter compatibility
    fetchData: vi.fn(async (key) => store[key] || null),
    saveData: vi.fn(async (key, data) => {
      store[key] = data;
      return true;
    }),

    // Auth methods
    checkAuth: vi.fn(async () => true),
    login: vi.fn(async () => true),
    logout: vi.fn(async () => true),
    signup: vi.fn(async () => true),
    roles: ['admin'],

    // Gaps methods
    fetchGaps: vi.fn(async () => store.gaps),
    createGap: vi.fn(async (gap) => {
      store.gaps.push(gap);
      return gap;
    }),
    updateGap: vi.fn(async (id, gapData) => {
      const idx = store.gaps.findIndex(g => g.id === id);
      if (idx > -1) {
        store.gaps[idx] = { ...store.gaps[idx], ...gapData };
      }
      return store.gaps[idx];
    }),
    deleteGap: vi.fn(async (id) => {
      store.gaps = store.gaps.filter(g => g.id !== id);
      return true;
    }),

    // Exercises methods
    fetchExercises: vi.fn(async (page = 1, limit = 50, simulation = '') => {
      let data = store.exercises;
      if (simulation) {
        data = data.filter(e => e.simulation === simulation);
      }
      return {
        data: data.slice((page - 1) * limit, page * limit),
        total: data.length
      };
    }),
    createExercise: vi.fn(async (exercise) => {
      store.exercises.push(exercise);
      return exercise;
    }),
    updateExercise: vi.fn(async (id, exData) => {
      const idx = store.exercises.findIndex(e => e.id === id);
      if (idx > -1) {
        store.exercises[idx] = { ...store.exercises[idx], ...exData };
      }
      return store.exercises[idx];
    }),

    // Simulations methods
    fetchSimulations: vi.fn(async () => {
      return Array.from(new Set(store.exercises.map(e => e.simulation).filter(Boolean)));
    }),
    fetchSimulationsData: vi.fn(async () => store.simulations_table),
    upsertSimulation: vi.fn(async (simulationData) => {
      const idx = store.simulations_table.findIndex(s => s.id === simulationData.id);
      if (idx > -1) {
        store.simulations_table[idx] = { ...store.simulations_table[idx], ...simulationData };
      } else {
        store.simulations_table.push(simulationData);
      }
      return simulationData;
    }),
    bulkImport: vi.fn(async () => ({ success: true }))
  };
};
```

### 3.2 Mocking Consumed React Hooks
When performing isolated tests on `AppContext.jsx`, its custom hooks can be mocked to control inputs and spy on context registration.

```javascript
import { vi } from 'vitest';

export const mockHooks = () => {
  vi.mock('./hooks/useDbConnection', () => ({
    useDbConnection: vi.fn(() => ({
      dbConfig: { provider: 'local', endpoint: '', apiKey: '' },
      setDbConfig: vi.fn(),
      dbAdapter: createMockDbAdapter('local'),
      isAuthenticated: true,
      setIsAuthenticated: vi.fn(),
      isDbLoading: false,
      userRole: 'admin',
      initDb: vi.fn((onLoad) => onLoad(createMockDbAdapter('local')))
    }))
  }));

  vi.mock('./hooks/useExercisesData', () => ({
    useExercisesData: vi.fn(() => ({
      exercises: [],
      setExercises: vi.fn(),
      allExercisesData: {},
      setAllExercisesData: vi.fn(),
      totalExercises: 0,
      exercisesPage: 1,
      fetchExercisesPage: vi.fn(),
      loadAllData: vi.fn()
    }))
  }));

  vi.mock('./hooks/useGapsData', () => ({
    useGapsData: vi.fn(() => ({
      gaps: [],
      setGaps: vi.fn(),
      activeEnvironmentFilter: 'All',
      setActiveEnvironmentFilter: vi.fn(),
      targetEnvironments: ['Production'],
      addEnvironment: vi.fn(),
      deleteEnvironment: vi.fn(),
      fetchGaps: vi.fn(),
      createGap: vi.fn(),
      updateGap: vi.fn(),
      deleteGap: vi.fn()
    }))
  }));

  vi.mock('./hooks/useMitreData', () => ({
    useMitreData: vi.fn(() => ({
      mitreData: {},
      isMitreLoading: false,
      loadMitreSkeleton: vi.fn(),
      setBaseMitreData: vi.fn()
    }))
  }));

  vi.mock('./hooks/useSimulationsData', () => ({
    useSimulationsData: vi.fn(() => ({
      simulationSummaries: {},
      setSimulationSummaries: vi.fn(),
      simulationEvidence: {},
      setSimulationEvidence: vi.fn(),
      fetchSimulations: vi.fn(),
      saveSimulationSummary: vi.fn(),
      addSimulationEvidence: vi.fn()
    }))
  }));

  vi.mock('./hooks/useTagsData', () => ({
    useTagsData: vi.fn(() => ({
      targetTags: [],
      addTag: vi.fn(),
      deleteTag: vi.fn(),
      activeTagFilter: 'All',
      setActiveTagFilter: vi.fn()
    }))
  }));

  vi.mock('./hooks/useSecurityControlsData', () => ({
    useSecurityControlsData: vi.fn(() => ({
      targetSecurityControls: [],
      addSecurityControl: vi.fn(),
      deleteSecurityControl: vi.fn(),
      activeSecurityControlFilter: 'All',
      setActiveSecurityControlFilter: vi.fn()
    }))
  }));

  vi.mock('./hooks/useExerciseActions', () => ({
    useExerciseActions: vi.fn(() => ({
      completeExercise: vi.fn(),
      updateExerciseValidation: vi.fn()
    }))
  }));

  vi.mock('./hooks/useAiData', () => ({
    useAiData: vi.fn(() => ({
      aiSettings: { provider: 'Gemini', model: 'gemini-3.5-flash', apiKey: 'mock-key' },
      setAiSettings: vi.fn(),
      activeAiContext: null,
      setActiveAiContext: vi.fn(),
      generateAIContent: vi.fn(),
      generateAIContentStream: vi.fn(),
      isAiActive: true
    }))
  }));

  vi.mock('./hooks/useAppUI', () => ({
    useAppUI: vi.fn(() => ({
      confirmConfig: { isOpen: false, message: '', onConfirm: null },
      confirmAction: vi.fn(),
      closeConfirm: vi.fn(),
      requestSuccessToast: vi.fn(),
      checkSyncQueue: vi.fn(),
      addToast: vi.fn()
    }))
  }));

  vi.mock('./components/Toast', () => ({
    useToast: vi.fn(() => ({
      addToast: vi.fn()
    }))
  }));
};
```

### 3.3 Mocking Browser Globals
Browser APIs are mocked cleanly using Vitest stub utilities to isolate JSDOM execution environment differences.

#### Mocking Local Storage
```javascript
import { vi } from 'vitest';

export const mockLocalStorage = () => {
  let store = {};
  
  const mockStorage = {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => {
      store[key] = String(value);
    }),
    removeItem: vi.fn((key) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index) => Object.keys(store)[index] || null)
  };

  vi.stubGlobal('localStorage', mockStorage);
  return mockStorage;
};
```

#### Mocking Window Location and History
```javascript
export const mockWindowApis = (queryString = '') => {
  const replaceStateMock = vi.fn();
  
  vi.stubGlobal('window', {
    location: {
      search: queryString,
      origin: 'http://localhost:5173',
      pathname: '/'
    },
    history: {
      replaceState: replaceStateMock
    }
  });

  return { replaceStateMock };
};
```

#### Mocking Image and Canvas APIs (Image Compression Utility)
The `compressImage` utility instantiates a new `Image` object and uses standard HTML5 Canvas 2D context methods. This mock simulates the loading process and returns a mock data URL.

```javascript
export const mockImageAndCanvas = () => {
  // Mock Image class
  class MockImage {
    constructor() {
      this.onload = null;
      this.onerror = null;
      this._src = '';
    }

    set src(value) {
      this._src = value;
      // Simulate asynchronous load event
      setTimeout(() => {
        if (this.onload) {
          this.onload();
        }
      }, 0);
    }

    get src() {
      return this._src;
    }

    // Return dimensions to test compression logic paths (e.g. > maxWidth)
    get width() {
      return 1200;
    }

    get height() {
      return 900;
    }
  }

  vi.stubGlobal('Image', MockImage);

  // Mock Canvas & Context
  const mockContext2d = {
    drawImage: vi.fn()
  };

  const mockCanvasElement = {
    getContext: vi.fn((contextType) => {
      if (contextType === '2d') return mockContext2d;
      return null;
    }),
    toDataURL: vi.fn(() => 'data:image/jpeg;base64,mockCompressedImageResult'),
    width: 0,
    height: 0
  };

  const spyCreateElement = vi.spyOn(document, 'createElement');
  spyCreateElement.mockImplementation((tagName) => {
    if (tagName.toLowerCase() === 'canvas') {
      return mockCanvasElement;
    }
    return spyCreateElement.mock.results[0].value; // fallback to original behavior if needed
  });

  return { mockContext2d, mockCanvasElement, spyCreateElement };
};
```

---

## 4. Test Specifications

### 4.1 `useGapsData` Unit Test Specifications

#### Test 1: Load Target Environments from Local Storage
*   **Goal**: Verify hook initializes `targetEnvironments` state from cached local storage.
*   **Setup**: Seed `localStorage` with `target_envs` containing `["AWS Staging", "On-Prem Prod"]`.
*   **Execution**: Call `useGapsData(null)`.
*   **Assertion**: `targetEnvironments` initially equals `["AWS Staging", "On-Prem Prod"]`.

#### Test 2: Add and Delete Target Environments
*   **Goal**: Verify management logic handles deduplication, trimming, alphabetical sorting, and serialization.
*   **Execution**:
    1.  Call `addEnvironment("  Azure Dev  ")`.
    2.  Call `addEnvironment("azure dev")` (duplicate check).
    3.  Call `deleteEnvironment("AWS Staging")`.
*   **Assertion**:
    1.  `targetEnvironments` contains trimmed `"Azure Dev"`, sorted alphabetically.
    2.  `azure dev` is rejected as duplicate (case-insensitive checks).
    3.  Deleted environment is removed from array.
    4.  Updates are saved back to `localStorage` under `target_envs`.

#### Test 3: Fetch Gaps and Schema Validation
*   **Goal**: Test standard fetch path, data schema parsing, backfilling, and local auto-save.
*   **Setup**: Mock `dbAdapter.fetchGaps` to return `[{ id: "1", title: "Gap A", environment: "AWS" }]` (missing `displayId`).
*   **Execution**: Trigger `fetchGaps(dbAdapter)` in `local` mode.
*   **Assertion**:
    1.  `validateBulkData` runs and ensures schema validity.
    2.  Missing `displayId` is auto-backfilled with format `/GAP-\d{4}/`.
    3.  `dbAdapter.saveData` is invoked to update the database state.
    4.  `gaps` state updates with final validated array.

#### Test 4: Create, Update, and Delete Gap Operations
*   **Goal**: Ensure operations route correctly to database adapters based on adapter type (`local` vs. API adapter).
*   **Execution**:
    *   **Case A (Local Mode)**: Call CRUD triggers. Verify state updates locally and calls `dbAdapter.saveData`.
    *   **Case B (Remote Mode)**: Call CRUD triggers. Verify call is passed to `dbAdapter.createGap`/`updateGap`/`deleteGap` respectively, followed by a reload via `fetchGaps`.

---

### 4.2 `AppContext` Integration/Context Test Specifications

#### Test 1: Database Adapter Initialization on Mount
*   **Goal**: Verify context triggers database auth initialization and chains full data load on success.
*   **Setup**: Inject mock `useDbConnection` that executes `initDb(onLoadComplete)`. Spies placed on `loadAllData`, `fetchGaps`, `fetchSimulations`, and `loadMitreSkeleton`.
*   **Execution**: Render `<AppProvider />`.
*   **Assertion**:
    1.  `initDb` is executed.
    2.  On completion, `loadData` runs, launching parallel queries for Exercises, Gaps, Simulations, and the MITRE coverage skeleton.

#### Test 2: Image Compression Utility execution
*   **Goal**: Confirm canvas-based resizing logic computes correct proportions and resolves data URLs.
*   **Setup**: Register Image/Canvas mocks. Set mock image width to `1000px` (exceeding `maxWidth = 800px`).
*   **Execution**: Retrieve `compressImage` from context. Call it with a dummy data URL.
*   **Assertion**:
    1.  Image class sets `src` to trigger load.
    2.  Canvas dimensions are updated keeping aspect ratio: `width` = `800`, `height` = `1200 * (800 / 1000)` = `600`.
    3.  `drawImage` is executed with resized dimensions.
    4.  Promise resolves to the mock compressed data URL.

#### Test 3: Tactic Scope Toggle Business Logic
*   **Goal**: Test logical inversion of status scoping in the MITRE matrix.
*   **Setup**: Seed `useMitreData` with a Tactic containing some techniques having status `'na'` and some `'unknown'`.
*   **Execution**: Execute `toggleTacticScope(tacticName)`.
*   **Assertion**:
    1.  If tactic techniques are mixed or all `'na'`, toggle sets all techniques to `'unknown'`.
    2.  If all techniques are `'unknown'`, toggle sets them to `'na'`.
    3.  Updates correctly propagate to `mitreHook.setBaseMitreData`.

#### Test 4: Background Queue Synchronization Check Interval
*   **Goal**: Verify interval is scheduled, triggers background checks, and cleans up on unmount.
*   **Setup**: Mock `checkSyncQueue`. Use `vi.useFakeTimers()`.
*   **Execution**: Render `<AppProvider />`. Advanced timers by 15 seconds. Unmount component.
*   **Assertion**:
    1.  `checkSyncQueue` is invoked exactly once at 15s.
    2.  `checkSyncQueue` is invoked again at 30s.
    3.  After unmounting and advancing timers, no further calls are made.

---

## 5. Vitest Verification & Configuration

To execute these tests, verify that `vitest.config.js` or `vite.config.js` is set to run in a `jsdom` environment.

### Test Running Command
```bash
npx vitest run src/__tests__/AppContext.test.jsx src/__tests__/useGapsData.test.js
```

### Configuration Safeguard Checklist
- [x] Environment is set to `jsdom` (already verified in `package.json`).
- [x] Timers are cleaned up in `afterEach` via `vi.useRealTimers()`.
- [x] Global mocks (`Image`, `localStorage`, `window`) are cleaned up or stubbed correctly to avoid leaking across test suites.
