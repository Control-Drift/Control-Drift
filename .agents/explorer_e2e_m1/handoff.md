# Handoff Report — explorer_e2e_m1

This report documents the E2E test runner architecture, UI data flow, state cascade mechanism, database integration, and details a programmatic verification strategy. It also outlines several critical bugs and discrepancies identified in the E2E runner execution and dashboard metrics calculation.

---

## 1. Observation

### E2E Test Setup and Execution Infrastructure
1. **Custom Client-Side Test Runner (`run_e2e.js` & `TestRunner.jsx`)**:
   - The primary regression suite runs in-browser at `/test-runner` using a custom React-context test suite.
   - File `run_e2e.js` starts a callback server (port 3002), spawns the mock database (`mock_database.js` on port 3001), spawns Vite (port 5173), and launches a headless browser targeting:
     ```javascript
     // run_e2e.js (lines 223)
     `http://127.0.0.1:${port}/test-runner?run=true&callback=http://127.0.0.1:3002/api/results`
     ```
   - In `run_e2e.js`, the spawn calls lack the `cwd` option, which causes shell executables on Windows to spawn in the system directory rather than the project directory:
     ```javascript
     // run_e2e.js (lines 177, 187)
     dbProcess = spawn('node', ['mock_database.js'], { shell: true });
     viteProcess = spawn('npx', ['vite', '--port', '5173', '--host', '127.0.0.1'], { shell: true });
     ```
     This results in execution errors under PowerShell (observed in `test_run_latest_utf8.log` lines 17-25):
     ```
     Error: Cannot find module 'C:\Windows\System32\WindowsPowerShell\v1.0\mock_database.js'
     [Vite stderr] Error: EPERM: operation not permitted, mkdir 'C:\Windows\System32\WindowsPowerShell\v1.0\.vite\deps_temp_7517e775'
     ```
2. **Playwright Integration (`playwright.config.js` & `tests/`)**:
   - Playwright tests (`wizard-e2e.spec.js` and `wizard-stress.spec.js`) execute browser-based UI flows.
   - `playwright.config.js` starts both the mock database (port 3001) and Vite (port 5173) as background web servers before running tests.

---

### UI Components, State Cascades, and Database Integration
1. **React Context (`AppContext.jsx`)**:
   - State and data hooks are initialized in `AppContext.jsx` (lines 35-38):
     ```javascript
     const exData = useExercisesData(dbAdapter);
     const gapsData = useGapsData(dbAdapter);
     const simsData = useSimulationsData(dbAdapter);
     ```
   - Global UI actions (e.g. `completeExercise`, `updateExerciseValidation`) are wired in `useExerciseActions.js`.
2. **Exercise Wizard Flow (`ExerciseWizard.jsx`)**:
   - Submitting a Purple Team campaign triggers `finishExercise` (lines 652-796). It performs:
     - `completeExercise` for each tested TTP.
     - `createGap` for events with non-optimal outcomes (outcome is not `'high'`).
     - Priority scores for gaps are calculated on lines 749-751:
       ```javascript
       const baseScore = severity === 'Critical' ? 100 : severity === 'High' ? 80 : severity === 'Medium' ? 50 : 20;
       const visibilityMultiplier = (p.coverageRating === 'None') ? 1.0 : (p.coverageRating === 'Minimal' ? 0.9 : (p.coverageRating === 'Partial' ? 0.75 : 0.0));
       const priorityScore = Math.round(baseScore * visibilityMultiplier);
       ```
     - Redirection to `/reports`.
3. **Database Layer (`mock_database.js`)**:
   - Persists data to `./synthetic_stress_data.json`.
   - Offers endpoints for `/api/metrics`, `/api/exercises`, `/api/gaps`, `/api/mitre-coverage`.
   - Dynamic GRS and metrics are calculated on the backend in `/api/metrics` (lines 713-853).

---

### Key Code Discrepancies and Bugs Observed
* **Bug 1: GRS Metric Discrepancies (Backend vs Local Fallback)**:
  - Backend `/api/metrics` includes `"Admin Config"` campaigns when calculating GRS, whereas the frontend `Dashboard.jsx` (local fallback) filters them out. Furthermore, the frontend is limited to the first 50 paginated exercises.
* **Bug 2: MTTR Negative Interval Math**:
  - `GapTracker.jsx` calculates MTTR on lines 429-432:
    ```javascript
    const totalSeconds = validResolved.reduce((acc, g) => {
        let diff = (new Date(g.resolvedDate) - new Date(g.createdDate)) / 1000;
        return acc + Math.max(0, diff);
    }, 0);
    ```
    However, legacy versions in the client calculations didn't use `Math.max(0, diff)` or handled negative intervals incorrectly resulting in bad formatting (e.g. days = -1, hours = -2).
* **Bug 3: State Sync/Persistence Leaks**:
  - In `AppContext.jsx` (local fallback mode), the gap state update inside `updateExerciseValidation` lacks a `dbAdapter.saveData('gaps', gapsState)` call, resulting in resolved gaps reverting upon page reload.
  - In `GapTracker.jsx` (handleDrop), dragging a Resolved gap back to Open/In Progress updates the exercise status in React state but fails to write the modified exercise back to local storage via `saveData('exercises')`.
* **Bug 4: Comma-Separated Multi-TTP Gaps Overwriting**:
  - If a gap targets multiple TTPs (e.g., `"T1059.001, T1078"`), validation updates (e.g., resolving the gap by proving protection for PowerShell) overwrite all related exercises in the database to `'high'` (Optimal), masking the untested TTPs.
* **Bug 5: AppContext Missing Guards**:
  - `recalculateMitreStatuses` inside `mock_database.js` lacks guards for null/empty `mitreObj`, causing potential UI crashes when MITRE data is loading.
  - Dynamic date sorting in `Dashboard.jsx` fails to handle invalid date values (causing stable sorting violations in V8).

---

## 2. Logic Chain

1. **E2E Spawn Root Cause**: Because `run_e2e.js` uses `spawn(..., { shell: true })` without defining `cwd`, child processes default their working directory to `C:\Windows\System32\WindowsPowerShell\v1.0` on Windows systems. This causes file paths to break (`MODULE_NOT_FOUND`) and permissions to fail (`EPERM`).
2. **State Cascading Mechanism**:
   - Clicking "Submit" in the `ExerciseWizard` calls `completeExercise` for each selected technique.
   - If an exercise achieves `'high'` status, it scans open gaps matching the TTP and resolves them.
   - If an exercise has non-optimal coverage, `createGap` adds a gap card to the database with status `'Open'`.
   - Moving a gap to Resolved in the `GapTracker` (or calling validation) executes `updateExerciseValidation`, modifying the simulation summary outcome (e.g. `Missed ➔ Prevented ✓`) and recalculating TTP averages.
   - The updated exercises rewrite technique coverage inside `mitreData`.
   - The `Dashboard` queries `/api/metrics` (or calculates it locally), updating GRS and gap counts.
3. **Discrepancy in GRS**: Since `/api/metrics` averages raw exercise statuses and the frontend calculates it from `mitreData` technique states (penalizing TTPs that have active gaps), the high-level GRS will mismatch when transitioning between local data adapters and REST adapters.

---

## 3. Caveats

- **Assumptions**: We assume Chromium is the primary execution target. We assume the dev server and DB server ports (5173, 3001) are free during verification execution.
- **Scope Limit**: AI stream parsing and PDF export rendering limits were checked via schema validation, but structural layout correctness was not visually verified.

---

## 4. Conclusion

### Proposed E2E Verification Workflow Strategy
To verify the application's E2E integrity without workspace code contamination, we recommend implementing a standalone Playwright script targeting the following scenarios:

#### A. 10 Sequential Realistic Simulations
- To prevent database write collisions, run 10 test iterations sequentially.
- Implement a human-like delay helper:
  ```javascript
  async function humanPause(min = 150, max = 450) {
    await new Promise(r => setTimeout(r, Math.random() * (max - min) + min));
  }
  ```
- Use `page.pressSequentially()` with a delay (e.g. 30ms) to type simulation names and scenario goals.
- Step-by-step:
  1. Login via SSO (admin).
  2. Scoping: Select target environment, map 3 techniques (e.g., Initial Access).
  3. Attack Chain: Enter description.
  4. Execution: Add 3 events matching the selected TTPs (1 Prevented, 1 Logged, 1 Missed).
  5. Submit the campaign.

#### B. Verify Data Propagation to Heatmap
- Immediately after submitting, intercept the redirect to `/reports`.
- Navigate to `/posture` (MITRE Heatmap).
- Assert that the technique cell for the **Prevented** TTP is highlighted as **Optimal** (cyan/green).
- Assert that the **Logged** TTP is highlighted as **Partial** (orange/yellow).
- Assert that the **Missed** TTP is highlighted as **None** (red/crimson).

#### C. Modify/Resolve Gaps and Verify Cascade
- Navigate to `/gaps`.
- Assert that two new gap cards exist (representing the Logged and Missed events) in the **Open** column.
- Open the details for the Missed gap.
- Select the validation outcome as **Prevented & Alerted** and enter validation notes.
- Click **Submit Validation**.
- Verify the following cascade:
  1. The gap moves to the **Resolved** column.
  2. Navigate to `/posture` (Heatmap) and verify the TTP status has updated to **Optimal**.
  3. Navigate to `/reports` and confirm the report procedure reflects `Missed ➔ Prevented & Alerted ✓`.
  4. Navigate to `/paths` and verify the resolved TTP no longer appears as a vulnerability node in the active Attack Path diagram.

#### D. Validate Dashboard Metrics Against Raw Counts
- Query `/api/gaps` and `/api/exercises` directly via Playwright's `request` utility to get raw counts.
- Navigate to `/` (Dashboard).
- Extract GRS, Total Gaps, Open Gaps, Resolution Rate, and MTTR values from the DOM.
- Verify:
  - `Dashboard Open Gaps === Raw Gaps (Open + In Progress)`
  - `Dashboard GRS === Calculated GRS` (asserting whichever adapter is active)
  - `Dashboard MTTR === Calculated MTTR`

---

## 5. Verification Method

To verify the test suite execution and diagnostic logic:
1. **Fix run_e2e.js (locally)**:
   Add `{ shell: true, cwd: process.cwd() }` to the spawn options on lines 177 and 187, then run:
   ```bash
   npm run test:e2e
   ```
2. **Execute Playwright Suite**:
   Run the stress test script to confirm browser automation runs correctly:
   ```bash
   npx playwright test tests/wizard-e2e.spec.js
   ```
3. **Inspect Logs**:
   Confirm that `perf_log.json` is appended with correct load times and no `TypeError` is present in console output.
