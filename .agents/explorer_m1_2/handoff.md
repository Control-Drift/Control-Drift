# Heatmap CPU Performance and Playwright/CDP Investigation Report

## 1. Observation
We observed the following regarding the project structure, test configurations, and WebGL rendering mechanisms:
- **Test Directory Location**: `playwright.config.js` defines the test directory on line 4:
  ```javascript
  testDir: './tests',
  ```
- **Authentication & Setup Pipeline**: In `tests/ui-load-perf.spec.js`, the tests require fetching an SSO token and injecting database configurations, roles, and cached MITRE data into the browser's local storage prior to navigation to `/posture`. Lines 95-100 show the token acquisition:
  ```javascript
  const ssoResponse = await request.get('http://127.0.0.1:3001/auth/sso?role=admin');
  expect(ssoResponse.ok()).toBeTruthy();
  const ssoData = await ssoResponse.json();
  token = ssoData.token;
  role = ssoData.role;
  ```
  Lines 105-119 show local storage hydration in `page.addInitScript(...)`:
  ```javascript
  localStorage.setItem('token', token);
  localStorage.setItem('roles', JSON.stringify([role]));
  localStorage.setItem('db_config', JSON.stringify({
    provider: 'rest',
    endpoint: 'http://127.0.0.1:3001',
    apiKey: ''
  }));
  ```
- **Continuous WebGL Render Loop**: In `src/components/MitreHeatmap.jsx`, the component implements a continuous rotation animation inside a `@react-three/fiber` `useFrame` hook on lines 684-687:
  ```javascript
  if (!activeTactic && groupRef.current) {
     groupRef.current.rotation.y += 0.0006;
     groupRef.current.rotation.x += 0.0003;
  }
  ```
  Additionally, the `PulsingWireframe` component updates shader uniforms on every frame (lines 182-185), and individual `TechNode` components execute lerp transitions inside their own `useFrame` loops (lines 367-375). This creates a steady-state CPU and GPU load even when the page has no user interaction, necessitating an idle performance baseline.
- **Test Commands**: In `package.json`, line 13 specifies the Playwright E2E command:
  ```json
  "test:playwright": "playwright test"
  ```
- **Proposed Implementation Draft**: We generated a complete implementation draft at:
  `C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\.agents\explorer_m1_2\proposed_webgl-perf.spec.js`

---

## 2. Logic Chain
1. **Test Placement**: Because `playwright.config.js` sets `testDir` to `./tests`, any new Playwright test file must reside inside the `tests` directory. To avoid conflicts with existing UI load tests and keep naming clean, we propose placing it at `tests/mitre-heatmap-perf.spec.js` (or `tests/webgl-perf.spec.js`).
2. **CDP Session Lifecycle**: Playwright exposes the raw Chrome DevTools Protocol session through `page.context().newCDPSession(page)`.
3. **CPU Metric Retrieval**: 
   - Enabling the Performance domain using `Performance.enable` causes Chromium to start recording execution durations.
   - Calling `Performance.getMetrics` returns an array of metric pairs.
   - The specific metrics representing CPU load are cumulative counters (in seconds):
     - `ScriptDuration`: JS execution time.
     - `LayoutDuration`: Layout calculation time.
     - `RecalcStyleDuration`: CSS style recalculation time.
     - `TaskDuration`: Total main-thread task execution time.
4. **Calculations**: To compute CPU activity over a specific 5-second interval, we must obtain metrics at the start and end of the interval, take the difference, and convert them to milliseconds:
   - **Scripting CPU Time**: `(endMetrics.ScriptDuration - startMetrics.ScriptDuration) * 1000`
   - **Rendering CPU Time**: `((endMetrics.LayoutDuration - startMetrics.LayoutDuration) + (endMetrics.RecalcStyleDuration - startMetrics.RecalcStyleDuration)) * 1000`
   - **Total Main Thread CPU Time**: `(endMetrics.TaskDuration - startMetrics.TaskDuration) * 1000`
5. **Idle State Verification**:
   - `waitUntil: 'networkidle'` ensures network requests have completed.
   - `page.waitForSelector('h3:has-text("Tactics Navigator")')` ensures key Heatmap DOM elements have successfully rendered.
   - Running a browser-side `PerformanceObserver` targeting entryType `'longtask'` verifies that CPU-blocking tasks (like JS execution, page layout, and WebGL compilation/initialization) have ceased. Resolving the promise after 1 second of no long tasks guarantees main thread idle.
   - Adding a 1-second delay ensures the initial WebGL camera lerp transition has settled.
6. **Screenshots**: Capturing screenshots is done using `page.screenshot(...)`. To avoid conflicts and track the performance state visually, we capture `heatmap-before.png` prior to metric extraction and `heatmap-after.png` after the 5-second interval.

---

## 3. Caveats
- **Headless vs Headful Execution**: The Chrome DevTools Protocol (CDP) `Performance` metrics are only available on Chromium-based browsers (Chromium, Google Chrome, Microsoft Edge). Firefox and WebKit (Safari) do not support the CDP. Therefore, the test must be forced or restricted to run under `chromium` (which is already configured as the default browser in `playwright.config.js`).
- **Hardware Acceleration**: Since the MITRE Heatmap utilizes WebGL via three.js, CPU/rendering performance will vary dramatically depending on whether hardware acceleration is active in the test runner environment. If WebGL is disabled or fallback rendering is triggered (e.g. in headless CI environments), CPU rendering metrics will be significantly higher.

---

## 4. Conclusion
1. **Placement**: Place the new test at `tests/mitre-heatmap-perf.spec.js` (or `tests/webgl-perf.spec.js`).
2. **APIs**:
   - Playwright API: `const client = await page.context().newCDPSession(page);`
   - CDP APIs: `client.send('Performance.enable')`, `client.send('Performance.getMetrics')`, and `client.send('Performance.disable')`.
   - Metric keys: `ScriptDuration` (Scripting), and `LayoutDuration` + `RecalcStyleDuration` (Rendering).
3. **Idle Verification**: Wait for `networkidle`, check for the presence of the `Tactics Navigator` header, then evaluate a browser `PerformanceObserver` to confirm the main thread has ceased running tasks longer than 50ms for 1 second.
4. **Screenshots**: Call `page.screenshot({ path: 'screenshots/heatmap-before.png' })` immediately before capturing start metrics, and `page.screenshot({ path: 'screenshots/heatmap-after.png' })` immediately after capturing final metrics.

---

## 5. Verification Method
1. **Copy Proposed Test**: Copy the code from `proposed_webgl-perf.spec.js` in the agent folder to `tests/mitre-heatmap-perf.spec.js` in the main workspace:
   `copy C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\.agents\explorer_m1_2\proposed_webgl-perf.spec.js tests\mitre-heatmap-perf.spec.js`
2. **Run Test**: Execute the Playwright test using the npm script:
   `npm run test:playwright -- tests/mitre-heatmap-perf.spec.js`
3. **Inspect Output & Artifacts**:
   - Verify the console outputs a JSON block with `cpuScriptingTimeMs`, `cpuRenderingTimeMs`, etc.
   - Verify that the results file `heatmap_cpu_perf_results.json` is successfully written.
   - Verify that `screenshots/heatmap-before.png` and `screenshots/heatmap-after.png` exist and display the MITRE Heatmap globe before and after the idle period.
4. **Invalidation Conditions**: If the page fails to load (due to incorrect local storage auth setup) or if the performance metrics returned are zero or `NaN`, the verification is invalid.
