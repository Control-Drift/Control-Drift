import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe.configure({ mode: 'parallel' });

const TOTAL_SIMULATIONS = parseInt(process.env.STRESS_TEST_COUNT || '200', 10);

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

// Helper for human-like typing delay
async function humanType(locator, text) {
  await locator.pressSequentially(text, { delay: 10 + Math.random() * 15 });
}

// Helper for human-like pause
async function humanPause(min = 100, max = 300) {
  const delay = Math.floor(Math.random() * (max - min) + min);
  await new Promise(resolve => setTimeout(resolve, delay));
}

for (let i = 1; i <= TOTAL_SIMULATIONS; i++) {
  const isSmoke = i === 1;
  const tag = isSmoke ? '@smoke' : '';
  
  test(`Purple Team Simulation Stress Test Iteration ${i} @stress ${tag}`, async ({ page, request }) => {
    page.on('console', msg => console.log(msg.text()));
    page.on('response', response => {
        if (response.status() === 404) {
            console.log(`[404] ${response.request().method()} ${response.url()}`);
        }
    });
    
    // Set 90 seconds timeout for this test
    test.setTimeout(90000);

    console.log(`[Worker ${test.info().workerIndex}] Starting stress simulation ${i}`);

    // Programmatically fetch an admin SSO token from the backend
    const ssoResponse = await request.get('http://127.0.0.1:3001/auth/sso?role=admin');
    expect(ssoResponse.ok()).toBeTruthy();
    const ssoData = await ssoResponse.json();
    const token = ssoData.token;
    const role = ssoData.role;

    // Inject token, roles, MITRE data, and force REST database provider during page initialization
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

    // Navigate to the Exercise Wizard
    await page.goto('/exercise');
    
    // Check storage
    const tokenInStorage = await page.evaluate(() => localStorage.getItem('token'));
    const mitreDataInStorage = await page.evaluate(() => localStorage.getItem('mitre_data_v2'));
    console.log(`[Storage Check] token: ${tokenInStorage ? 'exists' : 'missing'}, mitreData: ${mitreDataInStorage ? 'exists' : 'missing'}`);
    
    await page.waitForSelector('input[placeholder="e.g., APT29 Emulation"]');
    await humanPause(200, 500);

    // Step 1: Scoping
    console.log(`[Worker ${test.info().workerIndex}] Completing Step 1 (Scoping) for Iteration ${i}`);
    
    // Fill in simulation name human-like
    const simName = `Stress Test Auto-Sim ${i} - W${test.info().workerIndex} - ${Math.random().toString(36).substring(2, 7)}`;
    const nameInput = page.getByPlaceholder('e.g., APT29 Emulation');
    await nameInput.click({ force: true });
    await humanType(nameInput, simName);
    await humanPause(100, 300);

    // Select target environment
    const envDropdown = page.locator('label:has-text("Target Environment") + div');
    await envDropdown.click({ force: true });
    await humanPause(100, 300);

    const stagingBtn = page.locator('button:has-text("Staging")');
    if (await stagingBtn.isVisible()) {
      await stagingBtn.click({ force: true });
    } else {
      const searchInput = page.locator('input[placeholder="Type to search or create..."]');
      await searchInput.click({ force: true });
      await humanType(searchInput, 'Staging');
      await humanPause(100, 300);
      const createBtn = page.locator('button:has-text("Create \\"Staging\\"")');
      await createBtn.click({ force: true });
    }
    await humanPause(200, 400);

    // Fill scenario goals
    const goalsEditor = page.locator('.rich-markdown-editor .ql-editor').first();
    await goalsEditor.click({ force: true });
    await humanType(goalsEditor, 'Validate endpoint protection telemetry and alert generation for stress testing.');
    await humanPause(200, 400);

    // Select TTPs from Inline TTP Selector
    await page.getByText('Initial Access', { exact: true }).click({ force: true });
    await page.waitForSelector('.ttp-card', { state: 'visible' });
    await humanPause(200, 400);

    const cards = page.locator('.ttp-card');

    // Dynamically retrieve the TTP IDs of the first 3 techniques so we can map them in Step 3
    const ttpIdMatch1 = (await cards.nth(0).innerText()).match(/T\d{4}(?:\.\d{3})?/);
    const ttpId1 = ttpIdMatch1 ? ttpIdMatch1[0] : `Unknown-0`;
    const ttpIdMatch2 = (await cards.nth(1).innerText()).match(/T\d{4}(?:\.\d{3})?/);
    const ttpId2 = ttpIdMatch2 ? ttpIdMatch2[0] : `Unknown-1`;
    const ttpIdMatch3 = (await cards.nth(2).innerText()).match(/T\d{4}(?:\.\d{3})?/);
    const ttpId3 = ttpIdMatch3 ? ttpIdMatch3[0] : `Unknown-2`;

    console.log(`[Worker ${test.info().workerIndex}] Selected techniques: ${ttpId1}, ${ttpId2}, ${ttpId3}`);

    // Click check boxes to select them
    await cards.nth(0).getByText('Select', { exact: true }).first().click({ force: true });
    await humanPause(50, 150);
    await cards.nth(1).getByText('Select', { exact: true }).first().click({ force: true });
    await humanPause(50, 150);
    await cards.nth(2).getByText('Select', { exact: true }).first().click({ force: true });
    await humanPause(100, 300);

    // Go to Step 2
    await page.locator('button:has-text("Next Step")').click({ force: true });
    await humanPause(200, 400);

    // Step 2: Attack Chain Design
    console.log(`[Worker ${test.info().workerIndex}] Completing Step 2 (Attack Chain) for Iteration ${i}`);
    await page.waitForSelector('.rich-markdown-editor .ql-editor');
    const chainEditor = page.locator('.rich-markdown-editor .ql-editor').first();
    await chainEditor.click({ force: true });
    await humanType(chainEditor, '# Attack Chain\n\n1. Initial Access simulation payload execution.');
    await humanPause(200, 400);

    // Go to Step 3
    await page.locator('button:has-text("Next Step")').click({ force: true });
    await humanPause(200, 400);

    // Step 3: Execution & Logging
    console.log(`[Worker ${test.info().workerIndex}] Completing Step 3 (Execution & Logging) for Iteration ${i}`);
    await page.waitForSelector('button:has-text("+ Add Event")');
    await humanPause(200, 400);

    // --- Add Event 1: Prevented (Optimal Coverage) ---
    await page.locator('button:has-text("+ Add Event")').click({ force: true });
    await humanPause(100, 300);
    
    const payload1 = page.getByPlaceholder('Payload Name').first();
    await payload1.click({ force: true });
    await humanType(payload1, 'Stress Test Event 1');
    
    const redNotes1 = page.getByPlaceholder('Red Team Notes (e.g. executed under SYSTEM)').first();
    await redNotes1.click({ force: true });
    await humanType(redNotes1, 'Executed execution payload.');

    const blueNotes1 = page.getByPlaceholder('Blue Team Notes (e.g. Found Event ID 4688)').first();
    await blueNotes1.click({ force: true });
    await humanType(blueNotes1, 'Successfully blocked by EDR rule.');
    await humanPause(100, 300);

    // Map TTP 1
    const ttpDropdown1 = page.locator('label:has-text("Mapped TTPs")').first().locator('..').locator('button.dropdown-button');
    await ttpDropdown1.click({ force: true });
    await humanPause(100, 200);
    await page.locator('.portal-dropdown-menu').getByText(ttpId1, { exact: true }).click({ force: true });
    await humanPause(100, 200);
    await ttpDropdown1.click({ force: true }); // Close
    await humanPause(100, 200);

    // Set Actual Outcome to Prevented
    const actualDropdown1 = page.locator('label:has-text("Actual Outcome")').first().locator('..').locator('button').first();
    await actualDropdown1.click({ force: true });
    await humanPause(100, 200);
    await page.locator('.portal-dropdown-menu button:has-text("Prevented & Alerted")').first().click({ force: true });
    await humanPause(200, 400);

    // --- Add Event 2: Logged (Partial Coverage) ---
    await page.locator('button:has-text("+ Add Event")').click({ force: true });
    await humanPause(100, 300);

    const payload2 = page.getByPlaceholder('Payload Name').nth(1);
    await payload2.click({ force: true });
    await humanType(payload2, 'Stress Test Event 2');

    const redNotes2 = page.getByPlaceholder('Red Team Notes (e.g. executed under SYSTEM)').nth(1);
    await redNotes2.click({ force: true });
    await humanType(redNotes2, 'Executed registry modifications.');

    const blueNotes2 = page.getByPlaceholder('Blue Team Notes (e.g. Found Event ID 4688)').nth(1);
    await blueNotes2.click({ force: true });
    await humanType(blueNotes2, 'Events logged in Event Viewer, no alert.');
    await humanPause(100, 300);

    // Map TTP 2
    const ttpDropdown2 = page.locator('label:has-text("Mapped TTPs")').nth(1).locator('..').locator('button.dropdown-button');
    await ttpDropdown2.click({ force: true });
    await humanPause(100, 200);
    await page.locator('.portal-dropdown-menu').getByText(ttpId2, { exact: true }).click({ force: true });
    await humanPause(100, 200);
    await ttpDropdown2.click({ force: true }); // Close
    await humanPause(100, 200);

    // Set Actual Outcome to Logged
    const actualDropdown2 = page.locator('label:has-text("Actual Outcome")').nth(1).locator('..').locator('button').first();
    await actualDropdown2.click({ force: true });
    await humanPause(100, 200);
    await page.locator('.portal-dropdown-menu button:has-text("Logged")').first().click({ force: true });
    await humanPause(200, 400);

    // --- Add Event 3: Missed (No Coverage) ---
    await page.locator('button:has-text("+ Add Event")').click({ force: true });
    await humanPause(100, 300);

    const payload3 = page.getByPlaceholder('Payload Name').nth(2);
    await payload3.click({ force: true });
    await humanType(payload3, 'Stress Test Event 3');

    const redNotes3 = page.getByPlaceholder('Red Team Notes (e.g. executed under SYSTEM)').nth(2);
    await redNotes3.click({ force: true });
    await humanType(redNotes3, 'Executed stealthy shellcode injection.');

    const blueNotes3 = page.getByPlaceholder('Blue Team Notes (e.g. Found Event ID 4688)').nth(2);
    await blueNotes3.click({ force: true });
    await humanType(blueNotes3, 'No logs or alerts generated.');
    await humanPause(100, 300);

    // Map TTP 3
    const ttpDropdown3 = page.locator('label:has-text("Mapped TTPs")').nth(2).locator('..').locator('button.dropdown-button');
    await ttpDropdown3.click({ force: true });
    await humanPause(100, 200);
    await page.locator('.portal-dropdown-menu').getByText(ttpId3, { exact: true }).click({ force: true });
    await humanPause(100, 200);
    await ttpDropdown3.click({ force: true }); // Close
    await humanPause(100, 200);

    // Set Actual Outcome to Missed
    const actualDropdown3 = page.locator('label:has-text("Actual Outcome")').nth(2).locator('..').locator('button').first();
    await actualDropdown3.click({ force: true });
    await humanPause(100, 200);
    await page.locator('.portal-dropdown-menu button:has-text("Missed")').first().click({ force: true });
    await humanPause(200, 400);

    // Go to Step 4
    await page.locator('button:has-text("Next Step")').click({ force: true });
    await humanPause(200, 400);

    // Step 4: Reporting
    console.log(`[Worker ${test.info().workerIndex}] Reviewing Step 4 report preview for Iteration ${i}`);
    await page.waitForSelector('#executive-report');
    await humanPause(200, 400);
    await page.locator('.rich-markdown-editor .ql-editor').first().fill('This is a test executive summary.');

    // Submit Report and navigate to reports dashboard
    await page.locator('button:has-text("Submit")').click({ force: true });

    // Verification on /reports Page
    await page.waitForURL('**/reports');
    await page.waitForSelector('#historical-executive-report');
    await humanPause(500, 1000);

    // Assert counts
    const optimalLabel = page.locator('div', { hasText: /^Optimal Coverage$/ }).first();
    const optimalScore = await optimalLabel.locator('..').locator('div').first().textContent();
    expect(optimalScore.trim()).toBe('1');

    const partialLabel = page.locator('div', { hasText: /^Partial Coverage$/ }).first();
    const partialScore = await partialLabel.locator('..').locator('div').first().textContent();
    expect(partialScore.trim()).toBe('1');

    const noCoverageLabel = page.locator('div', { hasText: /^No Coverage$/ }).first();
    const noCoverageScore = await noCoverageLabel.locator('..').locator('div').first().textContent();
    expect(noCoverageScore.trim()).toBe('1');

    console.log(`[Worker ${test.info().workerIndex}] Simulation stress test iteration ${i} completed successfully!`);
  });
}
