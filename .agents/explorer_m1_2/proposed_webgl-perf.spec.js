import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Pre-parse the local MITRE STIX cache (same as ui-load-perf.spec.js)
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

test.describe('MITRE Heatmap WebGL CPU Performance measurement', () => {
  let token = null;
  let role = null;

  test.beforeAll(async ({ request }) => {
    // Obtain SSO Auth Token from mock database
    const ssoResponse = await request.get('http://127.0.0.1:3001/auth/sso?role=admin');
    expect(ssoResponse.ok()).toBeTruthy();
    const ssoData = await ssoResponse.json();
    token = ssoData.token;
    role = ssoData.role;
  });

  test.beforeEach(async ({ page }) => {
    // Inject token, roles, database config and cached MITRE data to browser localStorage
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

  test('Measure and baseline Heatmap idle CPU performance', async ({ page }) => {
    // Extend test timeout to cover navigation, idle verification, 5s measurement, and screenshots
    test.setTimeout(60000);

    // 1. Establish CDP (Chrome DevTools Protocol) session
    const client = await page.context().newCDPSession(page);
    await client.send('Performance.enable');

    // 2. Navigate to MITRE Heatmap page and wait for network activity to settle
    console.log('Navigating to Security Posture (MITRE Heatmap) page...');
    await page.goto('/posture', { waitUntil: 'networkidle' });

    // 3. Verify that the UI elements are loaded
    console.log('Waiting for UI components to render...');
    const sidebarHeader = page.locator('h3:has-text("Tactics Navigator")');
    await expect(sidebarHeader).toBeVisible({ timeout: 25000 });

    // 4. Verify main-thread/CPU idle state
    // Let the initial bundle parsing, 3D WebGL camera lerps, and React mounting stabilize
    console.log('Verifying CPU main-thread is idle...');
    await page.evaluate(async () => {
      return new Promise((resolve) => {
        let timeoutId;
        // The PerformanceObserver tracks "long tasks" (>50ms blockages) on the main thread
        const observer = new PerformanceObserver((list) => {
          // If a long task is executed, reset the idle timer
          clearTimeout(timeoutId);
          timeoutId = setTimeout(onIdle, 1000); // Requires 1 full second of no long tasks
        });
        
        function onIdle() {
          observer.disconnect();
          resolve();
        }
        
        observer.observe({ entryTypes: ['longtask'] });
        timeoutId = setTimeout(onIdle, 1000); // Initial 1-second timeout
      });
    });

    // Extra buffer to ensure WebGL camera settles in position
    await page.waitForTimeout(1000);
    console.log('Page is idle. Starting 5-second measurement window...');

    // 5. Take "Before" screenshot
    const screenshotsDir = path.resolve(process.cwd(), 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    const beforeScreenshotPath = path.join(screenshotsDir, 'heatmap-before.png');
    await page.screenshot({ path: beforeScreenshotPath, fullPage: true });
    console.log(`Saved screenshot before measurement to: ${beforeScreenshotPath}`);

    // 6. Capture initial cumulative CPU metrics
    const startMetricsRaw = await client.send('Performance.getMetrics');
    const startMetrics = {};
    for (const metric of startMetricsRaw.metrics) {
      startMetrics[metric.name] = metric.value;
    }

    // 7. Wait for 5 seconds in idle state
    await page.waitForTimeout(5000);

    // 8. Capture final cumulative CPU metrics
    const endMetricsRaw = await client.send('Performance.getMetrics');
    const endMetrics = {};
    for (const metric of endMetricsRaw.metrics) {
      endMetrics[metric.name] = metric.value;
    }

    // 9. Take "After" screenshot
    const afterScreenshotPath = path.join(screenshotsDir, 'heatmap-after.png');
    await page.screenshot({ path: afterScreenshotPath, fullPage: true });
    console.log(`Saved screenshot after measurement to: ${afterScreenshotPath}`);

    // 10. Process and report CPU performance metrics (durations in seconds -> milliseconds)
    const scriptTimeMs = (endMetrics['ScriptDuration'] - startMetrics['ScriptDuration']) * 1000;
    const layoutTimeMs = (endMetrics['LayoutDuration'] - startMetrics['LayoutDuration']) * 1000;
    const recalcStyleTimeMs = (endMetrics['RecalcStyleDuration'] - startMetrics['RecalcStyleDuration']) * 1000;
    const totalTaskTimeMs = (endMetrics['TaskDuration'] - startMetrics['TaskDuration']) * 1000;
    const renderingTimeMs = layoutTimeMs + recalcStyleTimeMs;

    const results = {
      timestamp: new Date().toISOString(),
      idleIntervalSec: 5.0,
      cpuScriptingTimeMs: parseFloat(scriptTimeMs.toFixed(2)),
      cpuLayoutTimeMs: parseFloat(layoutTimeMs.toFixed(2)),
      cpuStyleRecalcTimeMs: parseFloat(recalcStyleTimeMs.toFixed(2)),
      cpuRenderingTimeMs: parseFloat(renderingTimeMs.toFixed(2)),
      cpuTotalTaskTimeMs: parseFloat(totalTaskTimeMs.toFixed(2))
    };

    console.log('\n==================================================');
    console.log('MITRE HEATMAP 5-SECOND IDLE CPU PERFORMANCE METRICS');
    console.log('==================================================');
    console.log(JSON.stringify(results, null, 2));
    console.log('==================================================\n');

    // Save results to file
    const perfResultsPath = path.resolve(process.cwd(), 'heatmap_cpu_perf_results.json');
    fs.writeFileSync(perfResultsPath, JSON.stringify(results, null, 2), 'utf8');
    console.log(`Performance results successfully saved to: ${perfResultsPath}`);

    // Clean up CDP session
    await client.send('Performance.disable');
    await client.detach();
  });
});
