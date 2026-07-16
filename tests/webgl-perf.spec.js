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

    // Assert that the Canvas element is correctly loaded, mounted and visible
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 15000 });
    const canvasProps = await canvas.evaluate(el => ({
      width: el.width,
      height: el.height
    }));
    expect(canvasProps.width).toBeGreaterThan(0);
    expect(canvasProps.height).toBeGreaterThan(0);

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
