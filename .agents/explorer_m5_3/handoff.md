# Handoff Report — explorer_m5_3

## 1. Observation
- `src/components/TestRunner.jsx`:
  - Contains test definitions array `testSuite` (lines 148-762).
  - Contains execution method `runAllTests` (lines 778-842) which loops sequentially through test cases and calls `t.run(contextRef.current, logAssertion)`.
  - Does not contain query param parsing or mount hooks to trigger the test suite automatically.
  - Updates states asynchronously via `setTests(prev => ...)` but has no mechanism to collect and serialize overall status for callback.
- `src/App.jsx`:
  - Defines routing for `/test-runner` pointing to the `<TestRunner />` component (line 97).
- `package.json`:
  - Standard Vite scripts present: `"dev": "vite"` (line 7). No pre-configured E2E runner scripts are present.

## 2. Logic Chain
- **Auto-run execution**: By inspecting `URLSearchParams` in a React `useEffect` inside `TestRunner.jsx` once the `tests` array length is initialized (i.e. `testsLength > 0`), we can trigger `runAllTests` automatically. Setting a small timeout (500ms) avoids race conditions during initial mounting.
- **Reporting results**: To send results to an external HTTP server, we can accumulate assertions and outcomes locally in `runAllTests` on completion. We then perform a standard browser `fetch` POST request to a callback URL extracted from `URLSearchParams` (falling back to a default of `http://localhost:3001/api/results`).
- **Headless Browser Execution**: Chrome and Microsoft Edge executables can be programmatically launched headlessly on Windows by checking standard application folder paths (e.g., in `Program Files` or `%LocalAppData%`).
- **Vite Server Spawning**: In the Node script, Vite can be launched using `child_process.spawn`. Listening to the stdout stream for the pattern `http://localhost:(\d+)` allows the script to adapt dynamically to whichever port Vite starts on.
- **Process Cleanup**: When the browser exits or a result is received, we must terminate Vite. On Windows, spawning via shells can produce orphan child processes. Using the native CLI command `taskkill /pid <PID> /T /F` forces clean closure of the entire child process trees.
- **Performance Profiling**:
  - Browser API `window.performance` provides timing data for `first-paint`, `first-contentful-paint`, `domContentLoadedEventEnd`, and `loadEventEnd`.
  - Wrapping core routes inside `<Profiler>` components in `src/App.jsx` collects React mount/update durations, stored globally in `window.reactRenderMetrics`.
  - The E2E runner can append these metrics to the POST payload.
  - A comparison Node script (`compare_perf.js`) can take baseline and optimized JSON outputs and print a markdown comparison table.

## 3. Caveats
- Browser installations are assumed to be in standard locations on the Windows system. If they are in custom locations, the paths in `getBrowserPath` would need to be updated.
- React Router is used in the app, but using standard `window.location.search` is cleaner and less error-prone than importing router-specific hooks.
- Performance profiling requires wrapping components in `src/App.jsx` with `<Profiler>`, which incurs a tiny overhead (only active during development/profiling, not production builds).

## 4. Conclusion
The proposed design is robust, lightweight, and leverages native Windows capabilities and browser Web Performance APIs. Implementing the suggested changes in `TestRunner.jsx` and `App.jsx`, alongside adding `run_e2e.js` and `compare_perf.js` scripts, fully satisfies all requirements of Milestone 5.

## 5. Verification Method
- **Implementation check**: Inspect `src/components/TestRunner.jsx` to ensure `useEffect` for auto-run and `fetch` POST for the callback are added.
- **Server and Execution test**: Run `node run_e2e.js` (with a mock or real browser path) and verify that:
  - Vite starts up.
  - Headless browser launches.
  - Results are received on port 3001 and outputted to console.
  - Vite and browser processes are terminated cleanly upon exit.
- **Comparison test**: Run `node compare_perf.js baseline.json optimized.json` with dummy performance files to verify the comparison output format.
