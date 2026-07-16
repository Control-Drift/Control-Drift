# Handoff Report: E2E Runner and Profiler Design

## 1. Observation
The following key items were observed in the workspace:
* **Test Suite Definition**:
  * In `src/components/TestRunner.jsx` (lines 778-842), the runner handles execution sequentially via a `for` loop, updating the React state `tests` and toasts:
    ```javascript
    for (let i = 0; i < currentTests.length; i++) {
      if (abortRef.current) break;
      const t = currentTests[i];
      // ... runs test using contextRef.current and logAssertion ...
    }
    ```
* **Routing Setup**:
  * In `src/App.jsx` (lines 51-53, 97), the test runner is routed under `/test-runner` as a standard React page:
    ```javascript
    <Link to="/test-runner" style={{ ... }}>
      <Activity size={20} /> Test Runner
    </Link>
    // ...
    <Route path="/test-runner" element={<TestRunner />} />
    ```
* **Existing Node Helpers**:
  * In `package.json` (lines 6-10), the scripts list lacks any automated browser execution commands:
    ```json
    "scripts": {
      "dev": "vite",
      "build": "vite build",
      "preview": "vite preview"
    }
    ```
  * Several `verify_*.cjs` scripts exist at the root, e.g., `verify_dashboard_stress.cjs` which executes standalone stress tests on context data but does not interface with a real browser.

---

## 2. Logic Chain
1. **Automated Trigger**: To automate test execution, a mechanism must trigger `runAllTests()` upon loading the page. Inspecting `TestRunner.jsx` shows it mounts and loads all tests into state sequentially. Adding a `useEffect` hook checking a query parameter `?run=true` ensures the suite starts running as soon as the test list is initialized (Observation 1).
2. **Result Delivery**: Because the browser executes headlessly, the test results must be returned to the calling process. By appending a webhook POST request at the end of the `runAllTests()` loop (Observation 1), the browser can send structured test logs and assertion details to a local listener.
3. **Performance Profiling**: Instead of relying on heavy Node dependencies (like Puppeteer/Playwright) or complex Chrome DevTools Protocol (CDP) debugging layers, the browser already has access to timing benchmarks through standard Web Performance APIs (e.g. `performance.getEntriesByType('navigation')`). Collecting these metrics inside the React app and sending them in the same webhook payload keeps the design lightweight and dependency-free.
4. **Node Orchestrator (`run_e2e.js`)**: By starting a native Node HTTP server on port 3001, spawning the Vite development server on port 5173, and launching Chrome/Edge headlessly, the system can dynamically capture the POST payload from the client, log metrics to a file, and exit with status code `1` or `0` based on test failures.

---

## 3. Caveats
* **Browser Path Assumptions**: The browser launcher relies on standard file system structures for Windows, macOS, and Linux to locate Chrome/Edge. If the testing environment uses non-standard browser paths, path resolution will fall back to spawning `'google-chrome'` on the system path.
* **Network Isolation**: Since the network is in CODE_ONLY mode, the test runner should not make external network calls during testing. The current mock stream generator in Tier 4 tests properly simulates network activities locally (as observed in `TestRunner.jsx` lines 428-500).

---

## 4. Conclusion
Integrating automated E2E testing and performance profiling requires three coordinated additions:
1. An auto-run and POST callback mechanism in `TestRunner.jsx` using `URLSearchParams` and standard `fetch`.
2. Browser-side performance extraction utilizing `PerformanceNavigationTiming` and `PerformancePaintTiming`.
3. A native Node orchestrator (`run_e2e.js`) and performance comparison utility (`compare_perf.js`) at the project root.

---

## 5. Verification Method
1. **Inspecting Reports**: Read `analysis.md` inside this directory to verify the complete proposed file structures and changes.
2. **Verification Commands**: Once the changes are implemented by the implementer agent:
   * To execute the automated suite:
     ```powershell
     node run_e2e.js
     ```
   * To check performance delta between runs:
     ```powershell
     node compare_perf.js
     ```
3. **Invalidation Condition**: The tests should fail if the callback server is unreachable or if any test assertion evaluates to `passed: false`. The process should exit with exit code `1`.
