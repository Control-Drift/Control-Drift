# Synthesis: Milestone 3 (State & Logic/Context Testing)

## Core Objective
Implement comprehensive unit and integration tests under Vitest for:
1. `src/hooks/useGapsData.js`
2. `src/AppContext.jsx`

All tests must run cleanly under JSDOM and achieve 100% logic coverage of these two files without making actual network requests, database hits, or throwing JSDOM-specific rendering crashes.

---

## 1. Custom Hook Testing: `useGapsData.js`
To be implemented in `src/__tests__/useGapsData.test.js` (or `.jsx`).

### Test Coverage Requirements:
1. **State Hydration**:
   - Verify initialization checks `localStorage.getItem('target_envs')`.
   - Test hydration with valid JSON array, invalid JSON string (should catch error and return `[]`), and no stored value (should default to `[]`).
2. **Environment Management**:
   - `addEnvironment(name)`:
     - Trims leading/trailing whitespace.
     - Performs a case-insensitive duplicate check.
     - Adds unique values and sorts the array alphabetically.
   - `deleteEnvironment(name)`:
     - Case-sensitive filter behavior. Note that calling `deleteEnvironment('prod')` will not remove `'Prod'`. We must write a test to explicitly assert this current behavior (even if it's inconsistent, it represents the actual code behavior).
3. **CRUD Operations**:
   - **Local Mode** (`dbAdapter.type === 'local'`):
     - Creating, updating, and deleting gaps updates the state array and invokes `dbAdapter.saveData` with the updated array.
   - **Remote/Server Mode** (`dbAdapter.type !== 'local'`):
     - Creating, updating, or deleting a gap invokes the corresponding API method (`dbAdapter.createGap`, `dbAdapter.updateGap`, `dbAdapter.deleteGap`) and triggers a full state refresh via `fetchGaps`. Asserts that `saveData` is *not* called.
4. **Error Handling**:
   - Handles API network/database failures in remote mode gracefully. The error must be caught and logged (verified via console.error stubbing) and should not trigger `fetchGaps`.

---

## 2. AppContext Integration Testing: `AppContext.jsx`
To be implemented in `src/__tests__/AppContext.test.jsx`.

### Test Coverage Requirements:
1. **Mount & Initial Loading**:
   - Mounting the `AppProvider` calls `initDb`, which invokes the callback with the `dbAdapter`.
   - The callback triggers sequential data fetching inside `loadData`:
     1. `exData.loadAllData(adapter)`
     2. `gapsData.fetchGaps(adapter)`
     3. `simsData.fetchSimulations(adapter)`
     4. `mitreHook.loadMitreSkeleton()`
2. **Synchronization Interval**:
   - An interval of 15 seconds must periodically call `checkSyncQueue(dbAdapter, isAuthenticated)`.
   - Using Vitest fake timers (`vi.useFakeTimers`), verify the interval triggers `checkSyncQueue` periodically.
   - Verify that upon unmounting the `AppProvider`, the interval is cleared (`clearInterval`).
3. **Utility Context Actions**:
   - `toggleTacticScope(tacticName)`:
     - Toggles techniques under a tactic between `'na'` and `'unknown'`.
   - `toggleTechniqueScope(techId, environment)`:
     - Toggles a technique's status across all tactics. If a specific environment (not `'All'`) is targeted, updates that environment specifically.
   - `compressImage(dataUrl, maxWidth)`:
     - Test that the promise resolves. Because JSDOM doesn't support canvas and Image loading, we must mock/stub the global `Image` class and `document.createElement('canvas')`.

---

## 3. Mocking & Dependencies Strategy
- **`dbAdapter` Mock**:
  - `type`: 'local' or 'remote'.
  - Stubs: `fetchGaps`, `createGap`, `updateGap`, `deleteGap`, `saveData`.
- **Sub-hooks Mock**:
  - The `AppProvider` imports and calls multiple sub-hooks. We must mock these hooks (`src/hooks/useExercisesData`, `useMitreData`, `useSimulationsData`, `useTagsData`, `useSecurityControlsData`, `useExerciseActions`, `useAiData`, `useAppUI`, `useToast`) using `vi.mock` so we can control their returns and spy on their calls.
- **Browser/JSDOM Mocking**:
  - `localStorage`: Standard mock using `vi.spyOn` or global stub.
  - `Image`: Stub `global.Image` to trigger `onload` asynchronously during testing of `compressImage`.
  - `Canvas`: Stub `document.createElement` to return a mock canvas with `getContext('2d')` returning a mock context, and `toDataURL` returning a dummy string.
