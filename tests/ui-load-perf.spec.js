import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Pre-parse the local MITRE STIX cache to feed directly to the browser local storage
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

// Robust helper to save results incrementally to file
function saveResult(pageName, data) {
  const resultsPath = path.resolve(process.cwd(), 'ui_load_perf_results.json');
  let currentResults = {};
  if (fs.existsSync(resultsPath)) {
    try {
      currentResults = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
    } catch (e) {}
  }
  currentResults[pageName] = data;
  fs.writeFileSync(resultsPath, JSON.stringify(currentResults, null, 2), 'utf8');
  console.log(`\n--- ${pageName.toUpperCase()} PERFORMANCE RESULTS SAVED ---`);
  console.log(JSON.stringify(data, null, 2));
  console.log('---------------------------------------------\n');
}

test.describe('UI Load and Performance Verification', () => {
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
    // Inject token, roles, database config and cached MITRE data to browser localStorage before each page load
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

  test('Dashboard page load performance', async ({ page }) => {
    test.setTimeout(45000);
    const consoleErrors = [];
    page.on('pageerror', exception => {
      consoleErrors.push(exception.message);
    });
    page.on('console', msg => {
      console.log(`[Browser ${msg.type().toUpperCase()}]`, msg.text());
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    console.log('Navigating to Dashboard...');
    const startDash = Date.now();
    await page.goto('/', { waitUntil: 'load' });
    
    // Wait for Dashboard header to confirm loading and rendering
    const dashHeader = page.locator('h1:has-text("Dashboard")');
    await expect(dashHeader).toBeVisible({ timeout: 25000 });
    
    // Confirm GRS widget and other sections render
    await expect(page.locator('text=Global Readiness Score').first()).toBeVisible();
    await expect(page.locator('text=Tested TTPs').first()).toBeVisible();
    await expect(page.locator('text=ATT&CK Coverage').first()).toBeVisible();
    await expect(page.locator('text=Active Gaps').first()).toBeVisible();

    const endDash = Date.now();
    
    // Collect Dashboard performance metrics
    const dashMetrics = await page.evaluate(() => {
      const [entry] = performance.getEntriesByType('navigation');
      const memory = window.performance.memory || {};
      return {
        pageLoadTimeMs: entry ? entry.duration : 0,
        domContentLoadedTimeMs: entry ? entry.domContentLoadedEventEnd : 0,
        usedJSHeapSize: memory.usedJSHeapSize || 0
      };
    });

    const result = {
      measuredPageLoadMs: endDash - startDash,
      navPageLoadMs: dashMetrics.pageLoadTimeMs,
      domContentLoadedMs: dashMetrics.domContentLoadedTimeMs,
      usedJSHeapMB: (dashMetrics.usedJSHeapSize / (1024 * 1024)).toFixed(2),
      status: 'PASS',
      errors: consoleErrors
    };

    saveResult('Dashboard', result);
    expect(consoleErrors.filter(e => e.includes('TypeError') || e.includes('Exception')).length).toBe(0);
  });

  test('MITRE Heatmap page load performance', async ({ page }) => {
    test.setTimeout(45000);
    const consoleErrors = [];
    page.on('pageerror', exception => {
      consoleErrors.push(exception.message);
    });
    page.on('console', msg => {
      console.log(`[Browser ${msg.type().toUpperCase()}]`, msg.text());
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    console.log('Navigating to Security Posture (MITRE Heatmap)...');
    const startPosture = Date.now();
    await page.goto('/posture', { waitUntil: 'load' });

    // Wait for Tactics Navigator sidebar header
    const sidebarHeader = page.locator('h3:has-text("Tactics Navigator")');
    
    let isHeaderVisible = false;
    let timingError = null;
    try {
      await expect(sidebarHeader).toBeVisible({ timeout: 25000 });
      isHeaderVisible = true;
    } catch (e) {
      timingError = e.message;
    }

    const endPosture = Date.now();

    // Collect Posture performance metrics
    const postureMetrics = await page.evaluate(() => {
      const [entry] = performance.getEntriesByType('navigation');
      const memory = window.performance.memory || {};
      return {
        pageLoadTimeMs: entry ? entry.duration : 0,
        domContentLoadedTimeMs: entry ? entry.domContentLoadedEventEnd : 0,
        usedJSHeapSize: memory.usedJSHeapSize || 0
      };
    });

    const result = {
      measuredPageLoadMs: endPosture - startPosture,
      navPageLoadMs: postureMetrics.pageLoadTimeMs,
      domContentLoadedMs: postureMetrics.domContentLoadedTimeMs,
      usedJSHeapMB: (postureMetrics.usedJSHeapSize / (1024 * 1024)).toFixed(2),
      status: isHeaderVisible ? 'PASS' : 'FAIL',
      errors: consoleErrors,
      timingError: timingError
    };

    saveResult('Posture', result);

    if (!isHeaderVisible) {
      console.log('MITRE Heatmap page failed to display properly. Found Console Errors:', consoleErrors);
    }

    expect(isHeaderVisible).toBeTruthy();
    expect(consoleErrors.filter(e => e.includes('TypeError') || e.includes('Exception') || e.includes('render')).length).toBe(0);
  });

  test('Gap Tracker page load performance', async ({ page }) => {
    test.setTimeout(90000); // Give the massive Kanban board 90s to render
    const consoleErrors = [];
    page.on('pageerror', exception => {
      consoleErrors.push(exception.message);
    });
    page.on('console', msg => {
      console.log(`[Browser ${msg.type().toUpperCase()}]`, msg.text());
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    console.log('Navigating to Gap Tracker...');
    const startGaps = Date.now();
    await page.goto('/gaps', { waitUntil: 'load' });

    // Wait for Gap Tracker elements to load (e.g. Kanban columns: Open, In Progress, Resolved)
    const openColumnHeader = page.locator('h3:has-text("Open")').first();
    
    let isGapsVisible = false;
    let timingError = null;
    try {
      await expect(openColumnHeader).toBeVisible({ timeout: 20000 });
      await expect(page.locator('h3:has-text("In Progress")').first()).toBeVisible({ timeout: 5000 });
      await expect(page.locator('h3:has-text("Resolved")').first()).toBeVisible({ timeout: 5000 });
      isGapsVisible = true;
    } catch (e) {
      timingError = e.message;
      console.log('--- GAP TRACKER TIMEOUT DIAGNOSTICS ---');
      console.log('localStorage keys:', await page.evaluate(() => Object.keys(localStorage)));
      console.log('localStorage db_config:', await page.evaluate(() => localStorage.getItem('db_config')));
      console.log('localStorage token:', await page.evaluate(() => localStorage.getItem('token')));
      console.log('PAGE TEXT CONTENT:', await page.evaluate(() => document.body.innerText));
      console.log('----------------------------------------');
    }

    const endGaps = Date.now();

    // Collect Gap Tracker performance metrics
    const gapsMetrics = await page.evaluate(() => {
      const [entry] = performance.getEntriesByType('navigation');
      const memory = window.performance.memory || {};
      return {
        pageLoadTimeMs: entry ? entry.duration : 0,
        domContentLoadedTimeMs: entry ? entry.domContentLoadedEventEnd : 0,
        usedJSHeapSize: memory.usedJSHeapSize || 0
      };
    });

    const result = {
      measuredPageLoadMs: endGaps - startGaps,
      navPageLoadMs: gapsMetrics.pageLoadTimeMs,
      domContentLoadedMs: gapsMetrics.domContentLoadedTimeMs,
      usedJSHeapMB: (gapsMetrics.usedJSHeapSize / (1024 * 1024)).toFixed(2),
      status: isGapsVisible ? 'PASS' : 'FAIL',
      errors: consoleErrors,
      timingError: timingError
    };

    saveResult('Gaps', result);

    expect(isGapsVisible).toBeTruthy();
    expect(consoleErrors.filter(e => e.includes('TypeError') || e.includes('Exception')).length).toBe(0);
  });
});
