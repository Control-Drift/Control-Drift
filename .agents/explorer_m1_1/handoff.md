# Handoff Report: MITRE Heatmap Performance & Profiling Setup

## Observation

We analyzed the following files in the project workspace:
1. **`C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\tests\ui-load-perf.spec.js`**
   - Lines 89-296: Contains E2E load performance tests for pages `/`, `/posture`, and `/gaps`.
   - Lines 103-120: Utilizes `page.addInitScript` to pre-populate browser `localStorage` with `token`, `roles`, `db_config`, and the local `mitre_data_v2` (parsed from `mitre_stix_cache.json`), preventing external API requests and ensuring standard load paths.
   - Lines 188-199: Navigates to `/posture` and verifies load readiness by locating the sidebar header `h3:has-text("Tactics Navigator")`.
2. **`C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\src\components\MitreHeatmap.jsx`**
   - Lines 7-9: Imports `@react-three/fiber` (`Canvas`, `useFrame`, `useThree`), `@react-three/drei` (`TrackballControls`, `Html`, Stars, `PerformanceMonitor`), and `@react-three/postprocessing` (`EffectComposer`, `Bloom`).
   - Line 1290: Renders a `Canvas` component inside `<WebGLFallbackBoundary>`, representing a heavy 3D rendering load.
3. **`C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\playwright.config.js`**
   - Lines 4-5: Sets `testDir` to `'./tests'` and defines global `timeout: 30 * 1000`.
   - Line 16: Sets `browserName` to `'chromium'` (Chrome/Chromium is required to utilize the Chrome DevTools Protocol).
4. **`C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\package.json`**
   - Lines 11-13: Includes scripts `"test:e2e": "playwright test --grep-invert @stress"` and `"test:playwright": "playwright test"`.

---

## Logic Chain

1. **Test Placement**:
   - Given that all E2E spec files are located in the `tests/` directory (e.g. `tests/ui-load-perf.spec.js`, `tests/gap-tracker-e2e.spec.js` as observed in the directory structure) and `playwright.config.js` defines `testDir: './tests'`, the new profiling test must reside under `tests/` (e.g., `tests/webgl-perf.spec.js`).
2. **WebGL Dependency**:
   - Because `MitreHeatmap.jsx` renders a 3D environment using React Three Fiber (`<Canvas>` on lines 1290-1309), the page incurs continuous scripting and rendering/GPU load. Using the file name `tests/webgl-perf.spec.js` is highly descriptive and fits the specific testing intent.
3. **CDP & Metric Capturing**:
   - Playwright allows starting a Chrome DevTools Protocol (CDP) session on an active page using `await page.context().newCDPSession(page)`.
   - Sending `Performance.enable` turns on CPU performance tracking.
   - Calling `Performance.getMetrics` returns cumulative values for `ScriptDuration`, `LayoutDuration`, and `RecalcStyleDuration` (measured in seconds).
   - Thus, taking metrics at `t_start` and `t_end` (where `t_end - t_start = 5` seconds) allows us to compute the exact delta for scripting and rendering time on the CPU main thread:
     - `Scripting Time = (ScriptDuration_end - ScriptDuration_start) * 1000` (in milliseconds)
     - `Rendering Time = ((LayoutDuration_end + RecalcStyleDuration_end) - (LayoutDuration_start + RecalcStyleDuration_start)) * 1000` (in milliseconds)
4. **Page Idle Verification**:
   - Simply calling `page.goto` with `waitUntil: 'networkidle'` or calling `await page.waitForLoadState('networkidle')` is insufficient, because WebGL canvases continue initializing and compiling shaders after network traffic ceases.
   - We must also wait for crucial components to mount in the DOM, such as the header `h3:has-text("Tactics Navigator")` and the `<canvas>` element itself.
   - To guarantee complete idle state of the main thread, we propose a **Rate-of-Change Stabilization check**: poll `Performance.getMetrics` every 500ms and verify that the scripting/rendering time growth is below a threshold (e.g., `< 10ms` of CPU work per interval). Alternatively, evaluate `requestIdleCallback` inside the page context to yield to the browser's native idle scheduler before commencing measurements.
5. **Screenshots**:
   - Playwright's `page.screenshot({ path: ... })` is standard and should be called directly before taking the `t_start` metrics and immediately after taking the `t_end` metrics, outputting to a dedicated folder like `tests/screenshots`.

---

## Caveats

- **CDP Chromium Lock-in**: CDP features are chromium-only. Running this test against Firefox or WebKit browsers will result in an error; therefore, `playwright.config.js` must be configured (or the test flagged) to run exclusively under the `chromium` browser project (which is the default configured on line 16 of `playwright.config.js`).
- **Headless GPU support**: Rendering 3D WebGL in headless mode on CI servers might fall back to software rendering (SwiftShader), which can dramatically increase scripting and rendering times. In virtualized environments, a failure boundary fallback (observed in `WebGLFallbackBoundary`) could be triggered if WebGL is completely disabled.

---

## Conclusion

We propose the following concrete design to measure and baseline the MITRE Heatmap performance:

1. **File Location**: Place the spec file at `tests/webgl-perf.spec.js`.
2. **CDP Session**: Create a CDP session via `newCDPSession` and enable performance metrics collection via `Performance.enable`. Retrieve and delta `ScriptDuration`, `LayoutDuration`, and `RecalcStyleDuration` from `Performance.getMetrics`.
3. **Idle Guard**: Implement an asynchronous stabilization function `waitCDPIdle` that polls performance metrics and waits until delta scripting/rendering activity drops below 10ms per 500ms interval.
4. **Visual Benchmarking**: Capture screenshots before and after the 5-second measurement period using `page.screenshot` and save them to `tests/screenshots/`.

A fully implemented draft is placed in the workspace directory at:
`C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\.agents\explorer_m1_1\proposed_webgl-perf.spec.js`

---

## Verification Method

To verify the proposal independently:
1. Copy `C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\.agents\explorer_m1_1\proposed_webgl-perf.spec.js` to `C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\tests\webgl-perf.spec.js`.
2. Run the Playwright test command:
   ```bash
   npx playwright test tests/webgl-perf.spec.js
   ```
3. Inspect the standard output to see the logged scripting, layout, and style recalculation metrics.
4. Confirm that performance data is stored in `heatmap_perf_results.json` at the root, and that the screenshots `tests/screenshots/heatmap_before_idle.png` and `tests/screenshots/heatmap_after_idle.png` are successfully generated and visually show the Heatmap view.
