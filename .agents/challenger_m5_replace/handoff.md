# Handoff Report — challenger_m5_replace

This handoff report documents the performance verification, profiling results, and empirical findings discovered during the Milestone 5 review.

## 1. Observation

1. **Process Cleanup**: Active TCP connections were identified on ports `3001` and `5173`.
   - Command: `Get-NetTCPConnection -LocalPort 3001,5173 -State Listen -ErrorAction SilentlyContinue`
   - Output: Port `3001` (PID `28836`) and Port `5173` (PID `20216`) were successfully terminated.

2. **Zod Validation Failure (Silently Dropped Data)**:
   - When attempting to load the database in the browser console, thousands of console warnings were printed:
     ```
     [Browser WARNING] [Validation Warning] Dropped invalid Exercise: {id: 1700000000471, ttp: T1021.001, ...} undefined
     [Browser WARNING] [Validation Warning] Dropped invalid Gap: {id: 1800000000000, ttp: T1082, ...} undefined
     ```
   - In `src/lib/schemas.js` line 12 (GapSchema) and line 35 (ExerciseSchema), `id` is defined as:
     ```javascript
     id: z.string().min(1, "ID is required"),
     ```
   - In `synthetic_stress_data.json`, `id` fields were generated as numeric values (e.g., `1700000000471` and `1800000000000`). Because the strict schema does not coerce types, Zod threw a validation error for every record, and `validateBulkData` silently dropped them, leaving the Gap Tracker board entirely empty.

3. **React Hook Rule Violation**:
   - The MITRE Heatmap page `/posture` crashed completely upon loading with the following error:
     ```
     ErrorBoundary caught an error Error: Rendered more hooks than during the previous render.
         at updateWorkInProgressHook (http://127.0.0.1:5173/node_modules/.vite/deps/chunk-NUMECXU6.js?v=75a72231:11678:21)
         at updateCallback (http://127.0.0.1:5173/node_modules/.vite/deps/chunk-NUMECXU6.js?v=75a72231:12177:22)
         ...
         at MitreHeatmap (http://127.0.0.1:5173/src/components/MitreHeatmap.jsx:1277:27)
     ```
   - In `src/components/MitreHeatmap.jsx` lines 909-917, the component returns early if `isMitreLoading` is true:
     ```javascript
     if (isMitreLoading) {
       return (
         <div className="glass-panel animate-fade-in" style={{  padding: '40px', ... }}>
           ...
         </div>
       );
     }
     ```
   - Subsequent React Hooks (`handleTechClick` on line 918, and `resolvedMitreData` on line 928) are declared *after* this early return statement. Once `isMitreLoading` transitions from `true` to `false` in the lifecycle, the number of hook calls changes, directly violating React's Hook rules.

4. **UI Performance Execution (After ID Sanitation)**:
   - Command: `npx playwright test tests/ui-load-perf.spec.js`
   - Output results:
     - Dashboard test: **PASS**
     - Gap Tracker test: **PASS**
     - MITRE Heatmap test: **FAIL** (due to React Hook violation crash)

## 2. Logic Chain

1. **Process Clean-up**: Terminating stale node processes on ports `3001` and `5173` ensures that subsequent tests start a clean server instance loading the correct database state rather than reusing stale in-memory states. (Ref: Observation 1 & 4)
2. **Empty Kanban Boards**: The strict Zod validation schema expecting string IDs combined with numeric database IDs resulted in the silent drop of all data rows. This explains why the Gap Tracker page timed out waiting for columns—they simply never rendered on an empty state. Coercing IDs to string in `synthetic_stress_data.json` successfully fixed this issue, letting the Kanban board render immediately. (Ref: Observation 2 & 4)
3. **Heatmap Page Crash**: React forbids executing hooks conditionally or after early returns. Because `isMitreLoading` is checked for an early return prior to calling `useCallback` and `useMemo` hooks, React crashes on transition. This explains why `/posture` fails to render the Tactics Navigator sidebar. (Ref: Observation 3 & 4)

## 3. Caveats

- We observed that `/api/simulations` returns a raw list of strings in `mock_database.js` while `useSimulationsData.js` expects it to be an array of objects matching `SimulationSummarySchema`. This triggers console warnings but does not crash the page.
- We modified `tests/ui-load-perf.spec.js` to enable logging of browser console warnings/errors to stdout during headless execution to capture silent Zod drops.
- As a Critic/Challenger agent, we did not modify any web application source code (e.g., `MitreHeatmap.jsx`), preserving strict review-only boundaries.

## 4. Conclusion

1. **Performance Metrics**: The UI remains responsive and highly performant under the 10,000+ simulation load *once type-sanitized*.
2. **Structured Performance Metrics Table**:
   | Metric | Dashboard (/) | Gap Tracker (/gaps) | MITRE Heatmap (/posture) |
   |---|---|---|---|
   | **Status** | **PASS** | **PASS** | **FAIL** (React Hook Crash) |
   | **Measured Page Load** | 1678 ms | 3412 ms | 25441 ms (Timed Out) |
   | **Navigation Duration** | 479.3 ms | 1882.8 ms | 423.6 ms |
   | **DOM Content Loaded** | 278.2 ms | 234.4 ms | 233.6 ms |
   | **Used JS Heap Size** | 45.20 MB | 61.04 MB | 98.23 MB |
3. **Actionable Recommendations**:
   - **Bug Fix**: In `src/components/MitreHeatmap.jsx`, move `handleTechClick` (`useCallback`) and `resolvedMitreData` (`useMemo`) hooks to the top of the function component, prior to the `if (isMitreLoading)` early return block.
   - **Bug Fix**: Update the `synthetic_stress_data.json` generator script to output string IDs instead of numbers to avoid Zod schema validation drops.

## 5. Verification Method

1. Run the Playwright performance test suite:
   ```powershell
   npx playwright test tests/ui-load-perf.spec.js
   ```
2. Verify that the Dashboard and Gap Tracker tests pass successfully, and observe the verbatim React Hook violation warning in the stdout logs during the MITRE Heatmap test execution.
