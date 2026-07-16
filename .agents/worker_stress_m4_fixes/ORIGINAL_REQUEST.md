## 2026-06-17T18:46:22Z
You are a Software Engineer for the "Stress Test Data Injection Utility" project.
Your task is to fix the state-sync and adapter bugs that are causing the E2E tests to fail. Please apply the following changes:

1. Update Database Rollup status logic (mock_database.js):
- Replace `getAggStatus` (lines 342-348) inside `mock_database.js` with the average-based calculation to match the frontend rollup calculation in `AppContext.jsx`:
  ```javascript
  const getAggStatus = (statuses) => {
      if (statuses.length === 0) return 'unknown';
      let total = 0;
      statuses.forEach(s => {
          if (s === 'high') total += 100;
          else if (s === 'medium') total += 50;
          else if (s === 'minimal') total += 25;
          else if (s === 'low') total += 0;
      });
      const avg = total / statuses.length;
      if (avg === 100) return 'high';
      if (avg >= 50) return 'medium';
      if (avg > 0) return 'minimal';
      return 'low';
  };
  ```

2. Sync `allExercisesData` in Local Storage Fallback (src/AppContext.jsx):
- Inside `completeExercise` fallback branch (where `setExercises` is called), also update `allExercisesData` by calling `setAllExercisesData(next)`.
- Inside `updateExerciseValidation` fallback branch, after calling `setExercises(updatedExercises)`, also call `setAllExercisesData(updatedExercises)`.

3. Enhance Gap Resolution Check (src/AppContext.jsx):
- In `updateExerciseValidation` (around line 851), update `shouldResolveGap` evaluation. If `matchingEx` is not found, also check `testResults` inside `simulationSummaries[simulationName]` to determine if a procedure mapping to the gap's TTP was validated successfully:
  ```javascript
  shouldResolveGap = ttpList.every(t => {
      const matchingEx = updatedExercisesArray.find(ex => ex.ttp === t && ex.simulation === simulationName && (!procName || ex.finding === procName || !ex.finding));
      if (matchingEx) {
          return ['high', 'prevented', 'alerted', 'logged'].includes((matchingEx.status || '').toLowerCase());
      }
      // Fallback: Check if the procedure in testResults for this TTP has been validated successfully
      const currentSimulations = JSON.parse(JSON.stringify(simulationSummaries));
      const simulationData = currentSimulations[simulationName];
      if (simulationData && simulationData.testResults) {
          const matchingProc = simulationData.testResults.find(p => (p.ttps || []).includes(t) && p.name === procName);
          if (matchingProc && matchingProc.outcome) {
              const out = matchingProc.outcome.toLowerCase();
              return out.startsWith('prevented') || out.startsWith('alerted') || out.startsWith('logged') || out.startsWith('high');
          }
      }
      return false;
  });
  ```

4. Prevent State Reset Leak during Adapter Switch (src/AppContext.jsx):
- In `loadData` function (lines 305-344), ensure that if fetched exercises, gaps, simulationSummaries, or simulationEvidence are null/empty, we reset their local states to empty arrays/objects:
  - If `ex` is null/undefined, call `setExercises([])` and `setAllExercisesData([])`.
  - If `g` is null/undefined, call `setGaps([])`.
  - If `cs` is null/undefined, call `setSimulationSummaries({})`.
  - If `ce` is null/undefined, call `setSimulationEvidence({})`.

5. Define `.type` Property on Database Adapters:
- Add `this.type` property inside the constructor of the following database adapters (matched to their provider string, e.g. `'local'`, `'rest'`, `'supabase'`, `'firebase'`):
  - `src/lib/db/adapters/LocalStorageAdapter.js` (add `this.type = 'local';` in constructor)
  - `src/lib/db/adapters/RestApiAdapter.js` (add `this.type = 'rest';` in constructor)
  - `src/lib/db/adapters/SupabaseAdapter.js` (add `this.type = 'supabase';` in constructor)
  - `src/lib/db/adapters/FirebaseAdapter.js` (add `this.type = 'firebase';` in constructor)

6. Increase test condition timeout (src/components/TestRunner.jsx):
- In `waitForCondition` (line 70), increase the default timeout value from `2000` to `5000` to prevent timeouts under slow local environments.

Verify your changes by running `npm run build` and `npm run test:e2e`. All E2E tests must pass successfully.
Write a detailed report in C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\.agents\worker_stress_m4_fixes\handoff.md detailing the modifications and the test verification output.
