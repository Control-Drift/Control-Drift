# Milestone 5 UI Load & Performance Verification Handoff Report

## 1. Observation
We executed a dedicated, modular Playwright performance test script (`tests/ui-load-perf.spec.js`) to verify page rendering, responsiveness, JS exceptions, and resource consumption on the Dashboard (`/`), MITRE Heatmap (`/posture`), and Gap Tracker (`/gaps`) under a synthetic load of 10,500 exercises (simulations) and 1,050 gaps.

Stale processes on ports 3001 and 5173 were first identified and terminated. The performance test suite was then run via:
```powershell
npx playwright test tests/ui-load-perf.spec.js
```

### Performance Metrics Summary Table
Under the active 10,500 simulation and 1,050 gap data load:

| Page / Route | Status | Measured Page Load (ms) | Navigation Duration (ms) | DOM Content Loaded (ms) | Used JS Heap Size (MB) | Notes / Issues Detected |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **Dashboard (`/`)** | **PASS** | 2,950 | 2,766.80 | 2,551.90 | 48.07 MB | Loads fast and remains fully responsive. |
| **MITRE Heatmap (`/posture`)** | <span style="color:red">**FAIL**</span> | 27,232 | 2,224.90 | 2,051.40 | 61.04 MB | **CRITICAL BUG**: Application crashed with a white screen (caught by ErrorBoundary). |
| **Gap Tracker (`/gaps`)** | **PASS** | 3,994 | 2,373.20 | 596.80 | 51.02 MB | Rendered 1,050 Kanban cards cleanly and remains responsive when app is healthy. |

### Verbatim Console Error Output for MITRE Heatmap (`/posture`)
During the navigation to the MITRE Heatmap page, the following console exceptions were captured:
```
PAGE EXCEPTION: Rendered more hooks than during the previous render.
PAGE EXCEPTION: Rendered more hooks than during the previous render.
PAGE CONSOLE ERROR: The above error occurred in the <MitreHeatmap> component:
    at MitreHeatmap (http://127.0.0.1:5173/src/components/MitreHeatmap.jsx:1214:211)
    ...
PAGE CONSOLE ERROR: ErrorBoundary caught an error Error: Rendered more hooks than during the previous render.
    at updateWorkInProgressHook (http://127.0.0.1:5173/node_modules/.vite/deps/chunk-NUMECXU6.js?v=75a72231:11678:21)
    at updateCallback (http://127.0.0.1:5173/node_modules/.vite/deps/chunk-NUMECXU6.js?v=75a72231:12177:22)
    at Object.useCallback (http://127.0.0.1:5173/node_modules/.vite/deps/chunk-NUMECXU6.js?v=75a72231:12693:22)
    at useCallback (http://127.0.0.1:5173/node_modules/.vite/deps/chunk-RLJ2RCJQ.js?v=75a72231:1090:29)
    at MitreHeatmap (http://127.0.0.1:5173/src/components/MitreHeatmap.jsx:1277:27)
```

---

## 2. Logic Chain
1. **React Hooks Rule Violation**: In `src/components/MitreHeatmap.jsx`, around line 909, the component has an conditional early-return block when `isMitreLoading` is true:
   ```javascript
   if (isMitreLoading) {
     return (
       <div className="glass-panel animate-fade-in" ...>
         ...
       </div>
     );
   }
   ```
2. **Conditional Hook Declarations**: Following this early return (around line 918 and below), several hook declarations exist, such as `handleTechClick` (declared using `useCallback`), `toggleDescope`, and `resolvedMitreData` (declared using `useMemo`).
3. **Trigger Scenario**: On initial page load, `isMitreLoading` is set to `true`. The component hits the early return, and only a subset of React hooks (declared before line 909) are executed. Once the MITRE skeleton is loaded locally (from the cache cache injected by the test runner), `isMitreLoading` is set to `false`. On this subsequent render, the early return is bypassed, and React attempts to execute the additional hooks declared after line 909.
4. **Conclusion**: React throws a critical `Rendered more hooks than during the previous render` exception, crashing the rendering tree and producing a white screen that forces the application into its root `ErrorBoundary` state.

---

## 3. Caveats
- **Mock DB Serialization Speed**: The load tests use a local Node.js mock database (`mock_database.js`) which runs on localhost. In production environments, network latency and database querying overhead could further slow down payload delivery.
- **REST Client-Side Timeout**: The `RestApiAdapter` uses a hardcoded 5-second (`5000` ms) timeout for all fetches. Under massive datasets (e.g. 10,000+ records), this is a significant risk as a slow query or Zod validation overhead will easily cause abort errors, setting lists to empty.
- **GPU 3D Canvas Rendering**: The MITRE Heatmap page utilizes React Three Fiber (Three.js) for 3D sphere visualization. This depends highly on the client's GPU capabilities. Although a performance fix was applied to reduce vertices from 256x256 to 64x64, the canvas rendering speed was not fully evaluated on low-end hardware without GPU acceleration.

---

## 4. Conclusion
* **Overall Risk Assessment**: <span style="color:red">**CRITICAL**</span>
* **Summary of Assessment**:
  The application remains highly responsive and functional on the Dashboard and Gap Tracker pages under a massive 10,000+ simulation data load, with memory footprints hovering safely around ~40-50 MB. However, **the MITRE Heatmap page contains a critical React Lifecycle / Hooks bug** that completely crashes the application upon navigation, rendering it unusable and displaying a white screen.
* **Mitigation / Actionable Fixes**:
  - **Move all hook declarations in `src/components/MitreHeatmap.jsx` to the top of the component** (before any conditional check or early-return statement) to strictly satisfy React's Rules of Hooks.
  - **Increase client-side timeout** in `RestApiAdapter.fetchWithTimeout` to handle bulk datasets safely (e.g. 15-30 seconds), or implement server-side pagination for `/api/gaps` rather than loading all items at once.

---

## 5. Verification Method
To independently reproduce the performance metrics and observe the critical React hook crash:
1. Ensure the workspace dependencies are fully installed:
   ```powershell
   npm install
   ```
2. Execute the UI load test suite using Playwright:
   ```powershell
   npx playwright test tests/ui-load-perf.spec.js
   ```
3. Open the generated performance JSON file to inspect the raw measurements:
   ```powershell
   cat ui_load_perf_results.json
   ```
4. Confirm that:
   - `Dashboard` status is `PASS` with load times under 3 seconds.
   - `Posture` status is `FAIL` with console errors containing `ErrorBoundary caught an error Error: Rendered more hooks than during the previous render.`
   - `Gaps` status is `PASS` with load times under 4 seconds.
