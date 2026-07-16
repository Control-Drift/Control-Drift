# Iridescence Codebase Audit and Exploration Report

This report presents the findings of a comprehensive code audit of the React frontend application and the backend mock database server (`mock_database.js`) of the Iridescence application (`eclipse-ops`).

---

## 1. Calculation Logic, Variables, and Formulas

### A. Global Resilience Score (GRS)
The GRS is calculated using identical formulas in the backend (`mock_database.js`) and the frontend fallback (`Dashboard.jsx`), with a few key differences in scope and data filtering.

*   **Formula**:
    $$\text{GRS} = \text{Math.round}\left(\frac{\text{Points}}{\text{Total Validated}} \times 100\right)$$
*   **Variables**:
    *   `valid`: A filtered list of exercises where status is NOT equal to `'na'` (case-insensitive).
    *   `totalValidated`: The length of the `valid` array.
    *   `points`: Accumulated points based on status values:
        *   `ex.status === 'high'` adds **`1.0`** points.
        *   `ex.status === 'medium'` adds **`0.5`** points.
        *   All other statuses (e.g. `'minimal'`, `'low'`, `'unknown'`, `'prevented'`, `'alerted'`, `'logged'`) add **`0.0`** points.
    *   If `totalValidated === 0`, GRS defaults to `0`.

### B. Mean Time to Resolution (MTTR)
MTTR is computed in the backend (`mock_database.js`), the dashboard fallback (`Dashboard.jsx`), and the gap tracker (`GapTracker.jsx`).

*   **Formula**:
    $$\text{Mean Seconds} = \frac{\sum (\text{resolvedDate} - \text{createdDate})}{1000 \times \text{Number of Valid Resolved Gaps}}$$
*   **Date Handling**:
    *   Filters for resolved gaps having both `resolvedDate` and `createdDate`.
    *   Filters out invalid dates using `!isNaN(new Date(g.resolvedDate)) && !isNaN(new Date(g.createdDate))`.
*   **Division by Zero**:
    *   Protected by checking `validResolved.length > 0`. If no gaps are resolved, it returns `'N/A'`.
*   **Format Rollup**:
    *   If $\ge 1$ day: `[Days]d [Hours]h` (using `Math.floor` on mean seconds).
    *   If $< 1$ day but $\ge 1$ hour: `[Hours]h`.
    *   If $< 1$ hour: `'< 1h'`.
*   **Edge Case**:
    *   If `resolvedDate` is set before `createdDate` (due to malformed input), `meanSeconds` is negative, resulting in incorrect/negative day/hour formats.

### C. Residual Risk
Calculated in `mock_database.js` and `Dashboard.jsx` to represent the security risk exposure.

*   **Formula**:
    $$\text{Residual Risk} = \sum (\text{Severity Weight of Open/In Progress Gaps})$$
*   **Status Filter**: Gaps with `g.status === 'Open' || g.status === 'In Progress'`.
*   **Severity Weights**:
    *   `'Critical'`: **`10`**
    *   `'High'`: **`7`**
    *   `'Medium'`: **`3`**
    *   `'Low'`: **`1`**
    *   Unmapped severities default to **`0`**.
*   **Rollup Logic**: A simple absolute sum of weights of open/in progress gaps. No normalization or division by the total number of gaps is performed.

---

## 2. Potential Edge Cases and Data Discrepancies

### A. Front-end vs Back-end GRS Math Differences
1.  **Scope/Simulation Filtering**:
    *   The frontend filters out exercises associated with the `'Admin Config'` simulation:
        `setExercises(ex.filter(e => e.simulation !== 'Admin Config'));`
    *   The backend `/api/metrics` endpoint does **not** filter out `'Admin Config'`. Thus, the backend-computed GRS and the frontend-computed fallback GRS will diverge if any exercises belong to the `'Admin Config'` simulation.
2.  **Pagination Truncation**:
    *   When using the REST API adapter (`provider: 'rest'`), `contextExercises` is paginated (capped at the page limit, default 50).
    *   If `/api/metrics` fails and the frontend falls back to its local calculation, GRS is computed using `contextExercises` (maximum 50 exercises), whereas the backend computes GRS across the entire database (e.g. 100,000 synthetic exercises).
3.  **Status Mappings and Points**:
    *   `'minimal'` is mapped to a score of `25` in environment-level averages (in `AppContext.jsx` and `mock_database.js`), but it adds `0` points in the GRS calculation.
    *   Statuses of `'prevented'`, `'alerted'`, or `'logged'` on an exercise also score `0` points in GRS, which could lead to low resilience scores if exercises are not converted to `'high'`, `'medium'`, or `'low'` through rollup calculations.

### B. Dropping Cards / Drag & Drop Sync and Persistence Leaks
1.  **Automatic Resolution of Multi-TTP Gaps**:
    *   If a gap lists multiple comma-separated TTPs (e.g. `"T1059.001, T1059.003"`), testing *any single one* of these TTPs as `'high'` (or validating it as optimal) auto-resolves the entire gap in `AppContext.jsx` (`completeExercise` / `updateExerciseValidation`), even though other TTPs remain untested.
2.  **Exercise Status Corruption on Multi-TTP Gaps**:
    *   In `updateExerciseValidation`, validating a gap updates **all** exercises matching **any** TTP in `ttpList` to the same status `finalAggOutcome`. Validating one technique in a multi-TTP gap will overwrite the history/status of other unrelated techniques.
3.  **Local Storage Persistence Leaks**:
    *   **Inline Validation**: In `updateExerciseValidation` (lines 834-842), the fallback branch (for local storage/Firebase adapters) updates the `gaps` React state to `'Resolved'` but **fails** to persist it using `dbAdapter.saveData()`. The resolved state is lost on reload.
    *   **Reopening Resolved Gaps**: In `GapTracker.jsx`'s `handleDrop`, moving a resolved gap back to Open/In Progress updates matching exercises to status `'low'` in the React state (`setExercises`), but does **not** call `dbAdapter.saveData()`. The exercise statuses revert back to their high state on reload.

### C. Missing Guards in `AppContext.jsx`
1.  **Malformed/Empty `mitreData`**:
    *   In `recalculateMitreStatuses` (lines 7-88), `mitreObj[tactic].techniques` is iterated using `.forEach()` without checking if `techniques` exists or is an array. If `mitreData` is malformed or empty, it will throw a TypeError and crash the application at startup.
2.  **Invalid Date Sorting**:
    *   In `AppContext.jsx` (line 252), `filtered.sort` uses `new Date(b.date || 0) - new Date(a.date || 0)`. If a date is a malformed non-empty string, it yields `NaN`, resulting in unstable sorting.

### D. Attack Path Rendering Logic (`src/components/AttackPath.jsx`)
1.  **SVG Width Clipping**:
    *   The SVG overlay (`width: '100%'`, absolute positioning) is sized to the *visible viewport width* of the scroll container, not its *scrollable content width*. When scrolling horizontally across the 6 phases (min-width: 1920px), paths to the right of the initial viewport are clipped or invisible.
2.  **Lack of Scroll Event Listeners**:
    *   The path coordinates are computed using the container's `scrollLeft` and `scrollTop` in `updatePaths()`. However, there is no event listener for the container's `scroll` event. If the user scrolls, coordinates will drift or display incorrectly until a resize event fires.
3.  **Text and Height Clipping**:
    *   Nodes have a hardcoded height of `145px`. If the finding title or environment list is long, text overflows the boundaries.
4.  **MitreData Access Guards**:
    *   In `gapsByPhase` (line 262), `tacticObj.techniques` is accessed without a safety guard (assumes it is always defined).

### E. 3D Battle Globe vs. SVG Discrepancy
1.  **SVG-Only Implementation**:
    *   `src/components/BattleGlobe.jsx` is **not** a WebGL/3D component. It is a 2D SVG component that creates a wavy grid effect using standard SVG filters (`feTurbulence`, `feDisplacementMap`) and CSS animation (`animate-globe-wobble`).
    *   It is rendered in the Simulation Launcher (`ExerciseWizard.jsx`), not on the Security Posture page. It takes a single `ratio` prop rather than campaign statuses.
2.  **Actual 3D Component**:
    *   The Security Posture page renders `MitreHeatmap.jsx`, which is a true 3D WebGL component powered by `@react-three/fiber` and `three`.
    *   It resolves campaign statuses by grouping tested techniques, mapping statuses to HSL hues, and interpolating colors inside `GradientSphere` using a distance-weighted algorithm.
3.  **WebGL Disposal**:
    *   disposal is correctly implemented: `GradientSphere` contains a `useEffect` that calls `geometry.dispose()` to free GPU resources when the memoized `THREE.SphereGeometry` updates or unmounts, preventing WebGL memory leaks.

---

## 3. End-to-End (E2E) Test Harness and Aggregation

The E2E testing framework is designed to run regression tests directly against the React state using the Node runtime and a headless browser.

### A. Configuration (`package.json`)
The script `"test:e2e": "node run_e2e.js"` triggers the E2E test harness.

### B. Execution Flow (`run_e2e.js`)
1.  **Callback Server Initialization**: Starts an HTTP server on port `3002` to await test results.
2.  **Mock DB Spawning**: Spawns the REST API mock database server (`mock_database.js`) on port `3001`.
3.  **Dev Server Spawning**: Spawns Vite on port `5173`.
4.  **Headless Browser Launch**:
    *   Finds Chrome or Edge on Windows/Linux.
    *   Spawns the browser in headless mode with `--no-sandbox` and `--disable-gpu`.
    *   Directs it to the React application test page:
        `http://127.0.0.1:5173/test-runner?run=true&callback=http://127.0.0.1:3002/api/results`
5.  **Timeout Protection**: A global timeout of 60 seconds is configured to kill processes if tests hang.

### C. Frontend Test Runner (`TestRunner.jsx`)
1.  **State Sandbox & Backup**:
    *   Upon mounting, the runner backs up the current React Context state (exercises, gaps, summaries, etc.) and local storage keys.
    *   A clean sandbox state is initialized to ensure reproducibility.
2.  **Sequencing**:
    *   The test harness iterates through `testSuite` (13 tests organized in Tiers 1-5).
    *   Each test runs asynchronously, executing actions directly on React Context functions (e.g. `completeExercise`, `toggleTechniqueScope`, `updateExerciseValidation`).
3.  **Asynchronous Polling**:
    *   Uses a `waitForCondition(conditionFn, timeout)` helper that checks state variables every 50ms to allow asynchronous React rendering or fetch callbacks to finish.
4.  **State Restoration**:
    *   Restores the backed-up state upon completion, preserving user data.

### D. Result Aggregation
1.  **Payload Generation**:
    *   Collects assertions, status (`passed` or `failed`), and duration for each test.
    *   Captures client-side performance metrics using the browser's Performance Navigation Timing API (including `loadTimeMs`, `domContentLoadedMs`, `firstPaintMs`, `firstContentfulPaintMs`, and `usedJSHeapSizeMb`).
2.  **POST Callback**: Posts the results JSON payload back to the Callback Server (`http://127.0.0.1:3002/api/results`).
3.  **Reporting & Tear Down**:
    *   The Node callback handler parses the JSON, formats a colorful detailed test run log in the console, and appends the performance metrics to `perf_log.json`.
    *   Kills all child processes (`vite`, `chrome`, `node mock_database`) using `taskkill` (on Windows).
    *   Exits the process with code `0` if all tests passed, and `1` if any failed or no tests ran.
