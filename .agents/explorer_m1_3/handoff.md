# MITRE Heatmap Idle Performance Verification Analysis Report

## Observation
1. **Existing Performance Test Reference**: In `tests/ui-load-perf.spec.js` (lines 93–120), SSO authentication tokens are retrieved from a mock database at `http://127.0.0.1:3001` and injected into the browser's `localStorage` along with cached MITRE STIX JSON data:
   ```javascript
   const ssoResponse = await request.get('http://127.0.0.1:3001/auth/sso?role=admin');
   expect(ssoResponse.ok()).toBeTruthy();
   const ssoData = await ssoResponse.json();
   token = ssoData.token;
   role = ssoData.role;
   ...
   await page.addInitScript(({ token, role, mitreData }) => {
     localStorage.setItem('token', token);
     localStorage.setItem('roles', JSON.stringify([role]));
     localStorage.setItem('db_config', JSON.stringify({
       provider: 'rest',
       endpoint: 'http://127.0.0.1:3001',
       apiKey: ''
     }));
     if (mitreData) {
       localStorage.setItem('mitre_data_v2', JSON.stringify({
         timestamp: Date.now(),
         data: mitreData
       }));
     }
   }, { token, role, mitreData: mitreOutput });
   ```
2. **Playwright Config**: In `playwright.config.js` (lines 14–19), the E2E testing environment is configured to run headless Chromium on `http://127.0.0.1:5173`:
   ```javascript
   use: {
     baseURL: 'http://127.0.0.1:5173',
     browserName: 'chromium',
     headless: true,
     trace: 'on-first-retry',
   }
   ```
3. **Heatmap View Code**: In `src/components/MitreHeatmap.jsx` (lines 7–10, 101–154), the heatmap page renders a 3D Canvas utilizing `@react-three/fiber` (WebGL) and performs high-density vertex computations on a `GradientSphere` geometry during startup, which demands intensive CPU and GPU initialization before idling.

---

## Logic Chain
Based on these observations, the new test implementation requires:
1. **Placement**: The test should be placed alongside existing tests in the `tests/` directory (e.g., `tests/webgl-perf.spec.js`) to inherit the configured test runner directories.
2. **Playwright + CDP APIs**: 
   - Since Chromium is the active browser, a direct Chrome DevTools Protocol session can be spawned with:
     ```javascript
     const client = await page.context().newCDPSession(page);
     ```
   - Performance metrics can be captured using the `Performance` domain:
     ```javascript
     await client.send('Performance.enable');
     const response = await client.send('Performance.getMetrics');
     ```
   - From the returned metrics array, the following keys (measured in seconds) are queried to evaluate performance deltas:
     - `ScriptDuration`: Cumulative time spent executing JavaScript (CPU Scripting Time).
     - `LayoutDuration` and `RecalcStyleDuration`: Cumulative time spent on page layout and style recalculations (Rendering Time).
     - `TaskDuration`: Total CPU task execution duration.
   - *Comparison to Tracing*: The alternative approach of utilizing Playwright's `Tracing` or CDP `Tracing.start/end` requires saving large trace files and parsing complex timelines post-run. In contrast, `Performance.getMetrics` is lightweight, real-time, and programmatically queryable directly inside the test case.
3. **Page Idle Verification**:
   - Navigation uses `waitUntil: 'networkidle'` to ensure no active network requests.
   - `page.locator('h3:has-text("Tactics Navigator")').waitFor({ state: 'visible' })` confirms that the DOM components have been mounted and initially rendered.
   - To ensure the JS main thread has completed heavy initial data parsing and React rendering cycles, the browser is evaluated to resolve a `window.requestIdleCallback` (with a timeout fallback for environments where it is missing). This guarantees that the event loop is idle before the 5-second baseline starts.
4. **Screenshots**:
   - Screenshots are taken at the start and end of the 5-second interval using `page.screenshot` and stored in `test-results/screenshots/`.

---

## Caveats
1. **Chromium Dependency**: The `newCDPSession` API is chromium-only. Running tests with other browsers (Firefox, WebKit) will fail unless skipped or conditioned.
2. **WebGL Render Loop**: The 3D globe animation loop runs continuously at 60 FPS via React Three Fiber. Therefore, while the CPU main thread scripting will show negligible duration during idle, the GPU will remain active. The test must focus strictly on CPU main-thread metrics (`ScriptDuration` and `LayoutDuration`) rather than assuming absolute zero hardware utilization.
3. **Local Dev Servers**: The test relies on mock DB and Vite development servers starting up as specified in `playwright.config.js`.

---

## Conclusion
We recommend implementing the new E2E performance test file at `tests/webgl-perf.spec.js`. The test will:
1. Establish a CDP Session using `page.context().newCDPSession(page)`.
2. Navigate and wait for network/element visibility, followed by a `requestIdleCallback` check to ensure the page is fully idle.
3. Take a screenshot `heatmap-before-idle.png`.
4. Capture starting performance metrics using `Performance.getMetrics`.
5. Wait for 5 seconds using `page.waitForTimeout(5000)`.
6. Capture ending performance metrics and take a screenshot `heatmap-after-idle.png`.
7. Calculate the scripting and rendering time deltas and assert they fall under acceptable baseline thresholds (e.g., `< 1000ms` scripting and `< 500ms` rendering).

### Proposed Script: `tests/webgl-perf.spec.js`
```javascript
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Parse MITRE cache to feed local storage (matches ui-load-perf.spec.js setup)
let mitreOutput = null;
try {
  const cachePath = path.resolve(process.cwd(), 'mitre_stix_cache.json');
  if (fs.existsSync(cachePath)) {
    const rawData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    const tacticsMap = {};
    const tempOutput = {};
    
    rawData.objects.forEach(obj => {
      if (obj.type === 'x-mitre-tactic') {
        tacticsMap[obj.x_mitre_shortname] = obj.name;
        tempOutput[obj.name] = { status: 'unknown', techniques: [] };
      }
    });

    rawData.objects.forEach(obj => {
      if (obj.type === 'attack-pattern' && !obj.revoked && !obj.x_mitre_deprecated) {
        const idObj = obj.external_references?.find(ref => ref.source_name === 'mitre-attack');
        if (idObj && idObj.external_id && !idObj.external_id.includes('.')) {
          obj.kill_chain_phases?.forEach(phase => {
            if (phase.kill_chain_name === 'mitre-attack') {
              const tacticName = tacticsMap[phase.phase_name];
              if (tacticName && tempOutput[tacticName]) {
                if (!tempOutput[tacticName].techniques.find(t => t.id === idObj.external_id)) {
                  tempOutput[tacticName].techniques.push({ id: idObj.external_id, name: obj.name, status: 'unknown', subTechniques: [] });
                }
              }
            }
          });
        }
      }
    });

    rawData.objects.forEach(obj => {
      if (obj.type === 'attack-pattern' && !obj.revoked && !obj.x_mitre_deprecated) {
        const idObj = obj.external_references?.find(ref => ref.source_name === 'mitre-attack');
        if (idObj && idObj.external_id && idObj.external_id.includes('.')) {
          const parentId = idObj.external_id.split('.')[0];
          obj.kill_chain_phases?.forEach(phase => {
            if (phase.kill_chain_name === 'mitre-attack') {
              const tacticName = tacticsMap[phase.phase_name];
              if (tacticName && tempOutput[tacticName]) {
                const parentTech = tempOutput[tacticName].techniques.find(t => t.id === parentId);
                if (parentTech && !parentTech.subTechniques.find(t => t.id === idObj.external_id)) {
                  parentTech.subTechniques.push({ id: idObj.external_id, name: obj.name, status: 'unknown' });
                }
              }
            }
          });
        }
      }
    });

    Object.keys(tempOutput).forEach(k => {
      tempOutput[k].techniques.sort((a,b) => a.id.localeCompare(b.id));
      tempOutput[k].techniques.forEach(t => t.subTechniques.sort((a,b) => a.id.localeCompare(b.id)));
    });
    mitreOutput = tempOutput;
  }
} catch (e) {
  console.error('Failed to parse local MITRE cache:', e);
}

test.describe('WebGL Heatmap Idle Performance', () => {
  let token = null;
  let role = null;

  test.beforeAll(async ({ request }) => {
    const ssoResponse = await request.get('http://127.0.0.1:3001/auth/sso?role=admin');
    expect(ssoResponse.ok()).toBeTruthy();
    const ssoData = await ssoResponse.json();
    token = ssoData.token;
    role = ssoData.role;
  });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(({ token, role, mitreData }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('roles', JSON.stringify([role]));
      localStorage.setItem('db_config', JSON.stringify({
        provider: 'rest',
        endpoint: 'http://127.0.0.1:3001',
        apiKey: ''
      }));
      if (mitreData) {
        localStorage.setItem('mitre_data_v2', JSON.stringify({
          timestamp: Date.now(),
          data: mitreData
        }));
      }
    }, { token, role, mitreData: mitreOutput });
  });

  test('Measure CPU and Rendering performance on Heatmap over 5-second idle period', async ({ page }) => {
    test.setTimeout(35000);

    // 1. Establish CDP Session
    const client = await page.context().newCDPSession(page);
    await client.send('Performance.enable');

    // 2. Navigate and wait for loading state
    console.log('Navigating to Security Posture...');
    await page.goto('/posture', { waitUntil: 'networkidle' });

    // Wait for key elements to be visible
    const sidebarHeader = page.locator('h3:has-text("Tactics Navigator")');
    await expect(sidebarHeader).toBeVisible({ timeout: 25000 });

    // 3. Verify event loop idle state before starting metrics
    console.log('Verifying event loop idle...');
    await page.evaluate(() => {
      return new Promise((resolve) => {
        if ('requestIdleCallback' in window) {
          window.requestIdleCallback(() => resolve(), { timeout: 5000 });
        } else {
          setTimeout(resolve, 1000);
        }
      });
    });

    // Ensure screenshots folder exists in test-results
    const screenshotDir = path.resolve(process.cwd(), 'test-results', 'screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    // 4. Capture "Before" screenshot
    const beforeScreenshotPath = path.join(screenshotDir, 'heatmap-before-idle.png');
    await page.screenshot({ path: beforeScreenshotPath });
    console.log(`Saved screenshot before idle to ${beforeScreenshotPath}`);

    // 5. Gather baseline performance metrics
    const baseline = await client.send('Performance.getMetrics');
    const getMetric = (metrics, name) => {
      const found = metrics.find(m => m.name === name);
      return found ? found.value : 0;
    };

    const startScript = getMetric(baseline.metrics, 'ScriptDuration');
    const startLayout = getMetric(baseline.metrics, 'LayoutDuration');
    const startStyle = getMetric(baseline.metrics, 'RecalcStyleDuration');
    const startTask = getMetric(baseline.metrics, 'TaskDuration');

    // 6. Sleep for 5 seconds (Idle Measurement period)
    console.log('Measuring performance over 5-second idle period...');
    await page.waitForTimeout(5000);

    // 7. Gather final performance metrics
    const finalMetrics = await client.send('Performance.getMetrics');
    const endScript = getMetric(finalMetrics.metrics, 'ScriptDuration');
    const endLayout = getMetric(finalMetrics.metrics, 'LayoutDuration');
    const endStyle = getMetric(finalMetrics.metrics, 'RecalcStyleDuration');
    const endTask = getMetric(finalMetrics.metrics, 'TaskDuration');

    // 8. Capture "After" screenshot
    const afterScreenshotPath = path.join(screenshotDir, 'heatmap-after-idle.png');
    await page.screenshot({ path: afterScreenshotPath });
    console.log(`Saved screenshot after idle to ${afterScreenshotPath}`);

    // 9. Calculate deltas (convert from seconds to milliseconds)
    const scriptDeltaMs = (endScript - startScript) * 1000;
    const layoutDeltaMs = (endLayout - startLayout) * 1000;
    const styleDeltaMs = (endStyle - startStyle) * 1000;
    const taskDeltaMs = (endTask - startTask) * 1000;
    const renderingDeltaMs = layoutDeltaMs + styleDeltaMs;

    console.log('=== Idle Performance Results (over 5000ms) ===');
    console.log(`CPU Scripting Time: ${scriptDeltaMs.toFixed(2)} ms`);
    console.log(`Layout rendering:   ${layoutDeltaMs.toFixed(2)} ms`);
    console.log(`Style recalculation:${styleDeltaMs.toFixed(2)} ms`);
    console.log(`Total Rendering:    ${renderingDeltaMs.toFixed(2)} ms`);
    console.log(`Total CPU Task Time:${taskDeltaMs.toFixed(2)} ms`);
    console.log('==============================================');

    // Save results to performance log
    const resultsPath = path.resolve(process.cwd(), 'ui_load_perf_results.json');
    let currentResults = {};
    if (fs.existsSync(resultsPath)) {
      try {
        currentResults = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
      } catch (e) {}
    }
    currentResults['HeatmapIdlePerf'] = {
      scriptDurationMs: scriptDeltaMs,
      renderingDurationMs: renderingDeltaMs,
      cpuTaskDurationMs: taskDeltaMs,
      beforeScreenshot: beforeScreenshotPath,
      afterScreenshot: afterScreenshotPath,
      timestamp: new Date().toISOString()
    };
    fs.writeFileSync(resultsPath, JSON.stringify(currentResults, null, 2), 'utf8');

    // Assert that the idle CPU metrics are within reasonable limits
    expect(scriptDeltaMs).toBeLessThan(1000);
    expect(renderingDeltaMs).toBeLessThan(500);
  });
});
```

---

## Verification Method
To verify this proposed design:
1. Save the above test script code block to `tests/webgl-perf.spec.js`.
2. Run the newly added Playwright test target using the following terminal command from the project root directory:
   ```powershell
   npx playwright test tests/webgl-perf.spec.js
   ```
3. Inspect `ui_load_perf_results.json` in the root folder to confirm the presence of the `HeatmapIdlePerf` entry containing computed performance deltas.
4. Verify that screenshots `heatmap-before-idle.png` and `heatmap-after-idle.png` are populated and viewable under `test-results/screenshots/`.
5. Invalidating condition: If the browser context configured in `playwright.config.js` is changed to use a browser other than Chromium (e.g. Firefox or WebKit), or if the mock auth server is down, the test will throw a protocol exception or network connection timeout.
