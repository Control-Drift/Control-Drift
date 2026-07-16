## 2026-06-21T23:02:32Z
You are the Worker agent (Implementer) for Milestone 5.
Your working directory is: C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\.agents\worker_m5_fix
Your task is to fix the React Hook rule violation in `src/components/MitreHeatmap.jsx` to resolve the page crash under load, build the application, and re-run the Playwright load tests.

Please perform the following:
1. Process cleanup:
   - Identify and terminate any stale processes running on port 3001 or port 5173.
2. Apply code fix:
   - Edit `src/components/MitreHeatmap.jsx`:
     - Move the hooks `handleTechClick` (`useCallback`) and `resolvedMitreData` (`useMemo`), along with helper function `toggleDescope`, from their current position (lines 918-952) to be *above* the early return statement:
       ```javascript
       if (isMitreLoading) { ... }
       ```
       (e.g., place them right below the `React.useEffect` hook ending around line 907).
3. Build the application:
   - Run `npm run build` to verify there are no compilation errors or warnings.
4. Execute Playwright load/performance test:
   - Create or run the test at `tests/ui-load-perf.spec.js` using `npx playwright test tests/ui-load-perf.spec.js`.
   - Confirm that all pages (Dashboard, Gap Tracker, and MITRE Heatmap) load successfully, and that the MITRE Heatmap page no longer crashes.
5. Verify functionality:
   - Ensure the tests pass and capture the performance metrics.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Write your handoff report to C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\.agents\worker_m5_fix\handoff.md.
When completed, send a message to the Project Orchestrator (ID: 2792f428-25fa-4b96-8a78-5434ade92ac2) summarizing your changes and the resulting test runs.
