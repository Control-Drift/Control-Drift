import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Pre-parse the local MITRE STIX cache (same as in tests/ui-load-perf.spec.js)
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
    console.log(`Parsed local MITRE cache with ${Object.keys(mitreOutput).length} tactics.`);
  } else {
    console.warn('MITRE STIX cache file not found at:', cachePath);
  }
} catch (e) {
  console.error('Failed to parse local MITRE cache:', e);
}

// Helper to retrieve and format performance metrics from CDP
async function getCDPMetrics(client) {
  const response = await client.send('Performance.getMetrics');
  const metrics = {};
  for (const m of response.metrics) {
    metrics[m.name] = m.value;
  }
  return metrics;
}

// Wait for CPU to become idle by checking metric rate-of-change
async function waitCDPIdle(client, thresholdMs = 10, checkIntervalMs = 500, maxChecks = 10) {
  let prev = await getCDPMetrics(client);
  for (let i = 0; i < maxChecks; i++) {
    await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
    const curr = await getCDPMetrics(client);
    const scriptDiff = (curr.ScriptDuration - prev.ScriptDuration) * 1000;
    const layoutDiff = (curr.LayoutDuration - prev.LayoutDuration) * 1000;
    
    if (scriptDiff < thresholdMs && layoutDiff < thresholdMs) {
      console.log(`Page stabilized (idle) at check ${i + 1}`);
      return;
    }
    prev = curr;
  }
  console.warn('Page did not fully stabilize within check limit, starting measurement anyway.');
}

test.describe('MITRE Heatmap 3D WebGL Performance Baseline', () => {
  let token = null;
  let role = null;

  test.beforeAll(async ({ request }) => {
    // Obtain SSO Auth Token from mock database
    const ssoResponse = await request.get('http://127.0.0.1:3001/auth/sso?role=admin');
    expect(ssoResponse.ok()).toBeTruthy();
    const ssoData = await ssoResponse.json();
    token = ssoData.token;
    role = ssoData.role;
    console.log('SSO Auth Token obtained:', token ? 'Success' : 'Failed');
  });

  test.beforeEach(async ({ page }) => {
    // Inject token and mock data
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

  test('Measure CPU scripting and rendering time during 5s idle on Heatmap', async ({ page }) => {
    test.setTimeout(60000); // Allow ample time for 3D load, idle checks, screenshots, and 5-sec sleep

    // Create a Chrome DevTools Protocol session
    const client = await page.context().newCDPSession(page);
    await client.send('Performance.enable');

    console.log('Navigating to Security Posture (MITRE Heatmap)...');
    await page.goto('/posture', { waitUntil: 'networkidle' });

    // 1. Confirm page is loaded and canvas is rendering
    await page.locator('h3:has-text("Tactics Navigator")').waitFor({ state: 'visible', timeout: 25000 });
    await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 15000 });

    // 2. Wait for CPU idle state using stabilization logic
    await waitCDPIdle(client);

    // Create screenshot directory if it doesn't exist
    const screenshotDir = path.resolve(process.cwd(), 'tests', 'screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    // 3. Take BEFORE screenshot
    const beforeScreenshot = path.join(screenshotDir, 'heatmap_before_idle.png');
    await page.screenshot({ path: beforeScreenshot });
    console.log(`Saved screenshot before idle to: ${beforeScreenshot}`);

    // 4. Capture baseline performance metrics
    const startMetrics = await getCDPMetrics(client);

    // 5. Wait for 5 seconds (the idle period)
    console.log('Measuring performance over 5-second idle period...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 6. Capture ending performance metrics
    const endMetrics = await getCDPMetrics(client);

    // 7. Take AFTER screenshot
    const afterScreenshot = path.join(screenshotDir, 'heatmap_after_idle.png');
    await page.screenshot({ path: afterScreenshot });
    console.log(`Saved screenshot after idle to: ${afterScreenshot}`);

    // 8. Calculate delta metrics (values in seconds * 1000 = milliseconds)
    const scriptingTimeMs = (endMetrics.ScriptDuration - startMetrics.ScriptDuration) * 1000;
    const layoutTimeMs = (endMetrics.LayoutDuration - startMetrics.LayoutDuration) * 1000;
    const recalcStyleTimeMs = (endMetrics.RecalcStyleDuration - startMetrics.RecalcStyleDuration) * 1000;
    const renderingTimeMs = layoutTimeMs + recalcStyleTimeMs;
    const totalTaskTimeMs = (endMetrics.TaskDuration - startMetrics.TaskDuration) * 1000;

    console.log('\n--- PERFORMANCE RESULTS OVER 5-SEC IDLE PERIOD ---');
    console.log(`CPU Scripting Time:  ${scriptingTimeMs.toFixed(2)} ms`);
    console.log(`CPU Rendering Time:  ${renderingTimeMs.toFixed(2)} ms (Layout: ${layoutTimeMs.toFixed(2)} ms, Style: ${recalcStyleTimeMs.toFixed(2)} ms)`);
    console.log(`Total Main-Thread:   ${totalTaskTimeMs.toFixed(2)} ms`);
    console.log('--------------------------------------------------\n');

    // Save results to file
    const resultsPath = path.resolve(process.cwd(), 'heatmap_perf_results.json');
    const results = {
      timestamp: new Date().toISOString(),
      scriptingTimeMs,
      renderingTimeMs,
      layoutTimeMs,
      recalcStyleTimeMs,
      totalTaskTimeMs,
      beforeScreenshot,
      afterScreenshot
    };
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2), 'utf8');
    console.log(`Performance results saved to: ${resultsPath}`);

    // Cleanup CDP
    await client.send('Performance.disable');
    await client.detach();

    // Verification assertions
    expect(scriptingTimeMs).toBeGreaterThanOrEqual(0);
    expect(renderingTimeMs).toBeGreaterThanOrEqual(0);
  });
});
