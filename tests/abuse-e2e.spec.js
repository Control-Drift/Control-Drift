import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Helper for human-like typing delay
async function humanType(locator, text) {
  await locator.pressSequentially(text, { delay: 10 + Math.random() * 15 });
}

// Helper for human-like pause
async function humanPause(min = 100, max = 300) {
  const delay = Math.floor(Math.random() * (max - min) + min);
  await new Promise(resolve => setTimeout(resolve, delay));
}

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
  }
} catch (e) {
  console.error('Failed to parse local MITRE cache:', e);
}

// Helper to seed localStorage databases atomically before the page loads
async function seedData(page, gaps = [], exercises = [], summaries = {}) {
  await page.addInitScript(({ gaps, exercises, summaries }) => {
    localStorage.setItem('gaps', JSON.stringify(gaps));
    localStorage.setItem('exercises', JSON.stringify(exercises));
    localStorage.setItem('simulations_table', JSON.stringify(
      Object.keys(summaries).map(id => ({
        id,
        summary: summaries[id],
        evidence: []
      }))
    ));
  }, { gaps, exercises, summaries });
}

test.describe('Purple Team Simulation Wizard Abuse & Boundary Testing', () => {
  let token = null;
  let role = null;

  test.beforeAll(async ({ request }) => {
    // Obtain SSO Auth Token
    const ssoResponse = await request.get('http://127.0.0.1:3001/auth/sso?role=admin');
    expect(ssoResponse.ok()).toBeTruthy();
    const ssoData = await ssoResponse.json();
    token = ssoData.token;
    role = ssoData.role;
  });

  test.beforeEach(async ({ page }) => {
    // Enable browser console logging in tests for diagnostics
    page.on('console', msg => {
      console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`);
    });

    await page.addInitScript(({ token, role, mitreData }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('roles', JSON.stringify([role]));
      localStorage.setItem('db_config', JSON.stringify({
        provider: 'local',
        endpoint: '',
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

  // 1. Wizard Progress Guardrails
  test('Wizard Progress Guardrails', async ({ page }) => {
    test.setTimeout(120000);
    await page.goto('/exercise');
    await page.waitForSelector('input[placeholder="e.g., APT29 Emulation"]');
    
    // Missing name validation block
    await page.locator('button:has-text("Next Step")').click({ force: true });
    await expect(page.getByText('Please provide a Simulation Name before proceeding.')).toBeVisible();

    // Fill name
    await page.getByPlaceholder('e.g., APT29 Emulation').fill('Playwright Wizard Abuse Test');

    // Missing environment validation block
    await page.locator('button:has-text("Next Step")').click({ force: true });
    await expect(page.getByText('Please select a Target Environment before proceeding.')).toBeVisible();

    // Select target environment
    const envDropdown = page.locator('label:has-text("Target Environment") + div');
    await envDropdown.click({ force: true });
    const stagingBtn = page.locator('button:has-text("Staging")');
    if (await stagingBtn.isVisible()) {
      await stagingBtn.click({ force: true });
    } else {
      await page.locator('input[placeholder="Type to search or create..."]').fill('Staging');
      const createBtn = page.locator('button:has-text("Create \\"Staging\\"")');
      await createBtn.click({ force: true });
    }

    // Missing TTP selection validation block
    await page.locator('button:has-text("Next Step")').click({ force: true });
    await expect(page.getByText('Please select at least one MITRE TTP to proceed.')).toBeVisible();

    // Select TTP technique
    await page.getByText('Initial Access', { exact: true }).click({ force: true });
    await page.waitForSelector('.ttp-card', { state: 'visible' });
    const cards = page.locator('.ttp-card');
    const ttpIdMatch1 = (await cards.nth(0).innerText()).match(/T\d{4}(?:\.\d{3})?/);
    const ttpId1 = ttpIdMatch1 ? ttpIdMatch1[0] : `Unknown-0`;
    await cards.nth(0).getByText('Select', { exact: true }).first().click({ force: true });

    // Step 1 to Step 2
    await page.locator('button:has-text("Next Step")').click({ force: true });
    await page.waitForSelector('.rich-markdown-editor .ql-editor');
    
    // Fill step 2 goals
    await page.locator('.rich-markdown-editor .ql-editor').first().fill('Abuse test goals');

    // Step 2 to Step 3
    await page.locator('button:has-text("Next Step")').click({ force: true });
    await page.waitForSelector('button:has-text("+ Add Event")');

    // Missing event count validation block
    await page.locator('button:has-text("Next Step")').click({ force: true });
    await expect(page.getByText('Please add at least one event to proceed.')).toBeVisible();

    // Reload page to clear any modal overlay or toast blocking state before clicking "+ Add Event"
    await page.reload();
    await page.waitForSelector('button:has-text("+ Add Event")');

    // Add event with click retry validation to avoid race conditions/layout shifts
    await page.locator('button:has-text("+ Add Event")').click({ force: true });
    try {
      await page.getByPlaceholder('Payload Name').first().waitFor({ state: 'visible', timeout: 3000 });
    } catch (e) {
      console.log("First event input did not appear, clicking again...");
      await page.locator('button:has-text("+ Add Event")').click({ force: true });
      await page.getByPlaceholder('Payload Name').first().waitFor({ state: 'visible', timeout: 5000 });
    }

    // Enforce outcome and TTP mapping first to isolate name checking
    const actualDropdown0 = page.locator('label:has-text("Actual Outcome")').first().locator('..').locator('button').first();
    await actualDropdown0.click({ force: true });
    await page.locator('.portal-dropdown-menu button:has-text("Logged")').click({ force: true });

    const ttpDropdown0 = page.locator('label:has-text("Mapped TTPs")').first().locator('..').locator('button.dropdown-button');
    await ttpDropdown0.click({ force: true });
    await page.locator('.portal-dropdown-menu').getByText(ttpId1, { exact: true }).click({ force: true });
    await ttpDropdown0.click({ force: true });

    // Empty event name validation block
    await page.locator('button:has-text("Next Step")').click({ force: true });
    await expect(page.getByText('1 or more events are missing a name.').first()).toBeVisible();

    // Default name validation block (e.g. Event 1)
    await page.getByPlaceholder('Payload Name').first().fill('Event 1');
    await page.locator('button:has-text("Next Step")').click({ force: true });
    await expect(page.getByText('1 or more events are missing a name.').first()).toBeVisible();

    // Change name, check missing outcome block
    await page.getByPlaceholder('Payload Name').first().fill('Abuse Test Process Execution');
    // Set outcome to N/A using sessionStorage manipulation & reload
    await page.evaluate(() => {
      const results = JSON.parse(sessionStorage.getItem('wizard_results') || '[]');
      if (results[0]) {
        results[0].outcome = 'N/A';
        sessionStorage.setItem('wizard_results', JSON.stringify(results));
      }
    });
    await page.reload();
    await page.waitForSelector('button:has-text("+ Add Event")');

    await page.locator('button:has-text("Next Step")').click({ force: true });
    await expect(page.getByText('Please document and select an outcome for at least one payload execution to proceed to reporting.')).toBeVisible();

    // Check missing TTP mapping block
    // Set outcome to Logged
    const actualDropdown2 = page.locator('label:has-text("Actual Outcome")').first().locator('..').locator('button').first();
    await actualDropdown2.click({ force: true });
    await page.locator('.portal-dropdown-menu button:has-text("Logged")').click({ force: true });

    // Clear Mapped TTPs
    const ttpDropdown2 = page.locator('label:has-text("Mapped TTPs")').first().locator('..').locator('button.dropdown-button');
    await ttpDropdown2.click({ force: true });
    await page.locator('.portal-dropdown-menu').getByText(ttpId1, { exact: true }).click({ force: true });
    await ttpDropdown2.click({ force: true });

    await page.locator('button:has-text("Next Step")').click({ force: true });
    await expect(page.getByText('Please map at least one TTP to every event.')).toBeVisible();

    // Map TTP correctly & advance to Step 4
    await ttpDropdown2.click({ force: true });
    await page.locator('.portal-dropdown-menu').getByText(ttpId1, { exact: true }).click({ force: true });
    await ttpDropdown2.click({ force: true });

    await page.locator('button:has-text("Next Step")').click({ force: true });
    await page.waitForSelector('#executive-report');

    // Missing executive summary validation block
    await page.locator('.rich-markdown-editor .ql-editor').first().fill('');
    await page.locator('button:has-text("Submit")').click({ force: true });
    await expect(page.getByText('Please write or auto-generate an Executive Summary before completing the simulation.')).toBeVisible();

    // Complete successfully
    await page.locator('.rich-markdown-editor .ql-editor').first().fill('Abuse test executive summary');
    await page.locator('button:has-text("Submit")').click({ force: true });
    await page.waitForURL('**/reports');
    await expect(page.locator('#historical-executive-report')).toBeVisible();
  });

  // 2. Step-Skipping Bypass Check
  test('Step-Skipping Bypass Check', async ({ page }) => {
    test.setTimeout(120000);
    await page.goto('/exercise');
    await page.waitForSelector('input[placeholder="e.g., APT29 Emulation"]');
    
    // Inject step 4 directly and reload
    await page.evaluate(() => sessionStorage.setItem('wizard_step', '4'));
    await page.reload();
    await page.waitForSelector('#executive-report');

    // Attempt submit, should block on executive summary first
    await page.locator('button:has-text("Submit")').click({ force: true });
    await expect(page.getByText('Please write or auto-generate an Executive Summary before completing the simulation.')).toBeVisible();

    // Fill executive summary and submit
    await page.locator('.rich-markdown-editor .ql-editor').first().fill('Executive summary from bypass step');
    await page.locator('button:has-text("Submit")').click({ force: true });
    
    await page.waitForURL('**/reports');

    // Check fallback campaign name "Ad-hoc Simulation" was stored in localStorage simulations table
    const summaries = await page.evaluate(() => JSON.parse(localStorage.getItem('simulations_table') || '[]'));
    expect(summaries.some(s => s.id === 'Ad-hoc Simulation')).toBeTruthy();
  });

  // 3. Duplicate Simulation Names and Event Merging
  test('Duplicate Simulation Names and Event Merging', async ({ page }) => {
    test.setTimeout(120000);
    // Part A: Submit campaign "Duplicate Campaign A"
    await page.goto('/exercise');
    await page.waitForSelector('input[placeholder="e.g., APT29 Emulation"]');

    await page.getByPlaceholder('e.g., APT29 Emulation').fill('Duplicate Campaign A');
    
    const envDropdown = page.locator('label:has-text("Target Environment") + div');
    await envDropdown.click({ force: true });
    const stagingBtn = page.locator('button:has-text("Staging")');
    if (await stagingBtn.isVisible()) {
      await stagingBtn.click({ force: true });
    } else {
      await page.locator('input[placeholder="Type to search or create..."]').fill('Staging');
      const createBtn = page.locator('button:has-text("Create \\"Staging\\"")');
      await createBtn.click({ force: true });
    }

    await page.getByText('Initial Access', { exact: true }).click({ force: true });
    await page.waitForSelector('.ttp-card', { state: 'visible' });
    const cards2 = page.locator('.ttp-card');
    const ttpIdMatch2 = (await cards2.nth(0).innerText()).match(/T\d{4}(?:\.\d{3})?/);
    const ttpId2 = ttpIdMatch2 ? ttpIdMatch2[0] : `Unknown-0`; // although ttpId1 is reused later, let's redefine it correctly below if needed
    // Actually, wait, the original code used `const ttpId1 = ...`. I'll just change the variable name here if it's block-scoped, but wait, the whole script is a test block.
    // wait, I can just use let or var if needed. Let's see what the original did: `const ttpId1 = ...` again? Ah, maybe it's in a different test block.
    // Let me just replace the logic and keep `const ttpId1` or whatever it had.
    const ttpIdMatch_dup = (await cards2.nth(0).innerText()).match(/T\d{4}(?:\.\d{3})?/);
    const ttpId1 = ttpIdMatch_dup ? ttpIdMatch_dup[0] : `Unknown-0`;
    await cards2.nth(0).getByText('Select', { exact: true }).first().click({ force: true });

    await page.locator('button:has-text("Next Step")').click({ force: true });
    await page.waitForSelector('.rich-markdown-editor .ql-editor');
    await page.locator('.rich-markdown-editor .ql-editor').first().fill('Goals A');

    await page.locator('button:has-text("Next Step")').click({ force: true });
    await page.waitForSelector('button:has-text("+ Add Event")');

    await page.locator('button:has-text("+ Add Event")').click({ force: true });
    try {
      await page.getByPlaceholder('Payload Name').first().waitFor({ state: 'visible', timeout: 3000 });
    } catch (e) {
      console.log("First event input did not appear in Duplicate A, clicking again...");
      await page.locator('button:has-text("+ Add Event")').click({ force: true });
      await page.getByPlaceholder('Payload Name').first().waitFor({ state: 'visible', timeout: 5000 });
    }
    await page.getByPlaceholder('Payload Name').first().fill('Dumping LSASS');
    
    const ttpDropdown1 = page.locator('label:has-text("Mapped TTPs")').first().locator('..').locator('button.dropdown-button');
    await ttpDropdown1.click({ force: true });
    await page.locator('.portal-dropdown-menu').getByText(ttpId1, { exact: true }).click({ force: true });
    await ttpDropdown1.click({ force: true });

    const actualDropdown1 = page.locator('label:has-text("Actual Outcome")').first().locator('..').locator('button').first();
    await actualDropdown1.click({ force: true });
    await page.locator('.portal-dropdown-menu button:has-text("Prevented & Alerted")').click({ force: true });

    await page.locator('button:has-text("Next Step")').click({ force: true });
    await page.waitForSelector('#executive-report');
    await page.locator('.rich-markdown-editor .ql-editor').first().fill('Executive summary campaign A');
    await page.locator('button:has-text("Submit")').click({ force: true });
    await page.waitForURL('**/reports');

    // Part B: Submit duplicate campaign name "Duplicate Campaign A"
    await page.goto('/exercise');
    await page.waitForSelector('input[placeholder="e.g., APT29 Emulation"]');

    await page.getByPlaceholder('e.g., APT29 Emulation').fill('Duplicate Campaign A');

    const envDropdown2 = page.locator('label:has-text("Target Environment") + div');
    await envDropdown2.click({ force: true });
    const stagingBtn2 = page.locator('button:has-text("Staging")');
    if (await stagingBtn2.isVisible()) {
      await stagingBtn2.click({ force: true });
    }
    
    await page.getByText('Initial Access', { exact: true }).click({ force: true });
    await page.waitForSelector('.ttp-card', { state: 'visible' });
    const cards3 = page.locator('.ttp-card');
    await cards3.nth(0).getByText('Select', { exact: true }).first().click({ force: true });

    await page.locator('button:has-text("Next Step")').click({ force: true });
    await page.waitForSelector('.rich-markdown-editor .ql-editor');
    await page.locator('.rich-markdown-editor .ql-editor').first().fill('Goals A2');

    await page.locator('button:has-text("Next Step")').click({ force: true });
    await page.waitForSelector('button:has-text("+ Add Event")');

    // Add two events with the same name "Dumping LSASS"
    await page.locator('button:has-text("+ Add Event")').click({ force: true });
    try {
      await page.getByPlaceholder('Payload Name').first().waitFor({ state: 'visible', timeout: 3000 });
    } catch (e) {
      console.log("First duplicate input did not appear, clicking again...");
      await page.locator('button:has-text("+ Add Event")').click({ force: true });
      await page.getByPlaceholder('Payload Name').first().waitFor({ state: 'visible', timeout: 5000 });
    }
    await page.getByPlaceholder('Payload Name').first().fill('Dumping LSASS');
    const ttpDropdownA = page.locator('label:has-text("Mapped TTPs")').first().locator('..').locator('button.dropdown-button');
    await ttpDropdownA.click({ force: true });
    await page.locator('.portal-dropdown-menu').getByText(ttpId1, { exact: true }).click({ force: true });
    await ttpDropdownA.click({ force: true });
    const actualDropdownA = page.locator('label:has-text("Actual Outcome")').first().locator('..').locator('button').first();
    await actualDropdownA.click({ force: true });
    await page.locator('.portal-dropdown-menu button:has-text("Missed")').click({ force: true });

    await page.locator('button:has-text("+ Add Event")').click({ force: true });
    try {
      await page.getByPlaceholder('Payload Name').nth(1).waitFor({ state: 'visible', timeout: 3000 });
    } catch (e) {
      console.log("Second duplicate input did not appear, clicking again...");
      await page.locator('button:has-text("+ Add Event")').click({ force: true });
      await page.getByPlaceholder('Payload Name').nth(1).waitFor({ state: 'visible', timeout: 5000 });
    }
    await page.getByPlaceholder('Payload Name').nth(1).fill('Dumping LSASS');
    const ttpDropdownB = page.locator('label:has-text("Mapped TTPs")').nth(1).locator('..').locator('button.dropdown-button');
    await ttpDropdownB.click({ force: true });
    await page.locator('.portal-dropdown-menu').getByText(ttpId1, { exact: true }).click({ force: true });
    await ttpDropdownB.click({ force: true });
    const actualDropdownB = page.locator('label:has-text("Actual Outcome")').nth(1).locator('..').locator('button').first();
    await actualDropdownB.click({ force: true });
    await page.locator('.portal-dropdown-menu button:has-text("Missed")').click({ force: true });

    await page.locator('button:has-text("Next Step")').click({ force: true });
    await page.waitForSelector('#executive-report');
    await page.locator('.rich-markdown-editor .ql-editor').first().fill('Executive summary duplicate name check');
    await page.locator('button:has-text("Submit")').click({ force: true });
    await page.waitForURL('**/reports');

    await expect(page.locator('#historical-executive-report')).toBeVisible();
  });

  // 4. Gap Tracker Risk Acceptance Cascade
  test('Gap Tracker Risk Acceptance Cascade', async ({ page }) => {
    test.setTimeout(120000);
    // Seed initial gap
    const gaps = [
      {
        id: "GAP-1001",
        displayId: "GAP-1001",
        title: "Coverage Gap: T1566",
        ttp: "T1566",
        simulation: "Campaign A",
        finding: "Dumping LSASS",
        details: "Execution: notes\nDetection: notes",
        environment: ["Staging"],
        actionItems: "Review telemetry and develop detection logic.",
        stakeholders: ["Detection Engineering"],
        severity: "High",
        priorityScore: 80,
        status: "Open",
        createdDate: new Date().toISOString()
      }
    ];
    await seedData(page, gaps);

    await page.goto('/gaps');
    await page.waitForSelector('h1:has-text("Gap & Remediation Tracker")');

    // Locate open gap card by its finding text instead of 'GAP-' Display ID
    const openCard = page.locator('.glass-panel', { hasText: 'Dumping LSASS' }).first();
    await expect(openCard).toBeVisible();

    // Click Accept Risk
    const acceptRiskBtn = openCard.locator('button:has-text("Accept Risk")');
    await acceptRiskBtn.click({ force: true });

    // Validate modal validation triggers warning
    await page.waitForSelector('h2:has-text("Accept Risk")');
    
    // Click Accept Risk button inside modal using precise combined selector
    await page.locator('div.glass-panel:has(h2:has-text("Accept Risk")) button:has-text("Accept Risk")').click();
    await expect(page.getByText('Both Approving Authority and Justification are required.')).toBeVisible();

    // Fill in CISO approval details using unique placeholders
    await page.locator('div.glass-panel:has(h2:has-text("Accept Risk")) input[placeholder="e.g. CISO, Risk Committee"]').fill('CISO Security Committee');
    await page.locator('div.glass-panel:has(h2:has-text("Accept Risk")) textarea[placeholder*="business or technical rationale"]').fill('Accepted due to legacy system incompatibility with the EDR agent.');
    
    // Add small pause to let React batch state updates
    await page.waitForTimeout(500);

    // Save by clicking the modal button
    await page.locator('div.glass-panel:has(h2:has-text("Accept Risk")) button:has-text("Accept Risk")').click();
    
    // Wait for the modal itself to disappear, indicating successful save
    await expect(page.locator('div.glass-panel:has(h2:has-text("Accept Risk"))')).not.toBeVisible();

    // Verify card cascades to Risk Accepted
    const riskDetails = page.locator('details.risk-details');
    if (!(await riskDetails.getAttribute('open'))) {
      await page.locator('summary.risk-summary-hover').click({ force: true });
    }
    await expect(riskDetails.locator('.glass-panel', { hasText: 'CISO Security Committee' })).toBeVisible();
  });

  // 5. Gap Tracker Resolution & Validation Blockers
  test('Gap Tracker Resolution & Validation Blockers', async ({ page }) => {
    test.setTimeout(120000);
    // Seed initial state
    const gaps = [
      {
        id: "GAP-1001",
        displayId: "GAP-1001",
        title: "Coverage Gap: T1566",
        ttp: "T1566",
        simulation: "Campaign A",
        finding: "Dumping LSASS",
        details: "Execution: notes\nDetection: notes",
        environment: ["Staging"],
        actionItems: "Review telemetry and develop detection logic.",
        stakeholders: ["Detection Engineering"],
        severity: "High",
        priorityScore: 80,
        status: "In Progress",
        createdDate: new Date().toISOString()
      }
    ];
    const exercises = [
      {
        id: "ex-1",
        ttp: "T1566",
        simulation: "Campaign A",
        finding: "Dumping LSASS",
        status: "low",
        severity: "High",
        date: new Date().toISOString(),
        environment: ["Staging"]
      }
    ];
    const summaries = {
      "Campaign A": {
        testResults: [
          {
            name: "Dumping LSASS",
            ttps: ["T1566"],
            outcome: "Missed",
            coverageRating: "None",
            severity: "High"
          }
        ]
      }
    };
    await seedData(page, gaps, exercises, summaries);
    
    await page.goto('/gaps');
    await page.waitForSelector('h1:has-text("Gap & Remediation Tracker")');

    // Inject non-optimal outcome Logged to sessionStorage AFTER page loaded to avoid SecurityError
    await page.evaluate(() => sessionStorage.setItem('gap_val_outcome', 'Logged'));
    await page.reload();
    await page.waitForSelector('h1:has-text("Gap & Remediation Tracker")');
    await page.waitForTimeout(2000); // Allow async database loads to fully settle

    const stateCheck = await page.evaluate(() => ({
      outcome: sessionStorage.getItem('gap_val_outcome'),
      notes: sessionStorage.getItem('gap_val_notes')
    }));
    console.log("Seeded validation state:", stateCheck);

    // Drag open card to Resolved column
    const card = page.locator('div.glass-panel', { hasText: 'Dumping LSASS' }).first();
    await expect(card).toBeVisible();

    const resolvedCol = page.locator('div.glass-panel', { has: page.locator('h3', { hasText: 'Resolved' }) });
    await card.dragTo(resolvedCol);

    // Verify validation modal opens
    await page.waitForSelector('h2:has-text("Validate Remediation")');

    // Fill notes using precise modal selector
    await page.locator('div.glass-panel:has(h2:has-text("Validate Remediation")) textarea[placeholder*="Sigma rule"]').fill('Testing non-optimal outcome validation notes.');

    // Add small pause to let React state catch up
    await page.waitForTimeout(500);

    const btnState = await page.locator('div.glass-panel:has(h2:has-text("Validate Remediation")) button:has-text("Submit Validation")').evaluate(el => ({
      disabled: el.disabled,
      outerHTML: el.outerHTML
    }));
    console.log("Submit button state:", btnState);

    // Click submit using precise modal selector
    await page.locator('div.glass-panel:has(h2:has-text("Validate Remediation")) button:has-text("Submit Validation")').click();
    await expect(page.getByText('Gap remains In Progress. Optimal coverage (Prevented/Alerted) is required to resolve.')).toBeVisible({ timeout: 10000 });

    // Drag again
    await card.dragTo(resolvedCol);
    await page.waitForSelector('h2:has-text("Validate Remediation")');

    // Change validation outcome to Prevented & Alerted using precise modal dropdown selector
    await page.locator('div.glass-panel:has(h2:has-text("Validate Remediation")) button:has-text("Select Validation Outcome...")').click();
    await page.waitForSelector('.portal-dropdown-menu button:has-text("Prevented & Alerted")');
    await page.locator('.portal-dropdown-menu button:has-text("Prevented & Alerted")').click();

    // Fill notes
    await page.locator('div.glass-panel:has(h2:has-text("Validate Remediation")) textarea[placeholder*="Sigma rule"]').fill('Verified optimal validation resolution.');
    
    // Add small pause to let React state catch up
    await page.waitForTimeout(500);

    // Click submit
    await page.locator('div.glass-panel:has(h2:has-text("Validate Remediation")) button:has-text("Submit Validation")').click();
    await expect(page.getByText('Gap Resolved successfully.')).toBeVisible({ timeout: 10000 });

    // Verify card moves to Resolved column
    await expect(resolvedCol.locator('.glass-panel', { hasText: 'Dumping LSASS' }).first()).toBeVisible();
  });

  // 6. Revocation of Resolution & Risk Acceptance
  test('Revocation of Resolution & Risk Acceptance', async ({ page }) => {
    test.setTimeout(120000);
    // Seed initial Resolved and Risk Accepted state
    const gaps = [
      {
        id: "GAP-1001",
        displayId: "GAP-1001",
        title: "Coverage Gap: T1566",
        ttp: "T1566",
        simulation: "Campaign A",
        finding: "Dumping LSASS",
        details: "Execution: notes\nDetection: notes",
        environment: ["Staging"],
        actionItems: "Review telemetry and develop detection logic.",
        stakeholders: ["Detection Engineering"],
        severity: "High",
        priorityScore: 80,
        status: "Resolved",
        createdDate: new Date().toISOString()
      },
      {
        id: "GAP-1002",
        displayId: "GAP-1002",
        title: "Coverage Gap: T1059",
        ttp: "T1059",
        simulation: "Campaign A",
        finding: "Process Execution",
        details: "Execution: notes\nDetection: notes",
        environment: ["Staging"],
        actionItems: "Review telemetry.",
        stakeholders: ["Detection Engineering"],
        severity: "High",
        priorityScore: 80,
        status: "Risk Accepted",
        riskAcceptedBy: "CISO Security Committee",
        riskJustification: "Accepted due to legacy system incompatibility with the EDR agent.",
        riskAcceptedDate: new Date().toISOString(),
        createdDate: new Date().toISOString()
      }
    ];
    const exercises = [
      {
        id: "ex-1",
        ttp: "T1566",
        simulation: "Campaign A",
        finding: "Dumping LSASS",
        status: "high",
        severity: "High",
        date: new Date().toISOString(),
        environment: ["Staging"]
      },
      {
        id: "ex-2",
        ttp: "T1059",
        simulation: "Campaign A",
        finding: "Process Execution",
        status: "exception",
        severity: "High",
        date: new Date().toISOString(),
        environment: ["Staging"]
      }
    ];
    const summaries = {
      "Campaign A": {
        testResults: [
          {
            name: "Dumping LSASS",
            ttps: ["T1566"],
            outcome: "Missed ➔ Prevented & Alerted ✓",
            coverageRating: "Optimal",
            severity: "High"
          },
          {
            name: "Process Execution",
            ttps: ["T1059"],
            outcome: "Missed",
            coverageRating: "None",
            severity: "High"
          }
        ]
      }
    };
    await seedData(page, gaps, exercises, summaries);

    await page.goto('/gaps');
    await page.waitForSelector('h1:has-text("Gap & Remediation Tracker")');

    // Drag Resolved card back to In Progress
    const resolvedCol = page.locator('div.glass-panel', { has: page.locator('h3', { hasText: 'Resolved' }) });
    const resolvedCard = resolvedCol.locator('div.glass-panel', { hasText: 'Dumping LSASS' }).first();
    await expect(resolvedCard).toBeVisible();

    const inProgressCol = page.locator('div.glass-panel', { has: page.locator('h3', { hasText: 'In Progress' }) });
    await resolvedCard.dragTo(inProgressCol);

    // Verify card is now in In Progress
    await expect(inProgressCol.locator('.glass-panel', { hasText: 'Dumping LSASS' }).first()).toBeVisible();

    // Drag Risk Accepted card back to In Progress
    const riskDetails = page.locator('details.risk-details');
    if (!(await riskDetails.getAttribute('open'))) {
      await page.locator('summary.risk-summary-hover').click({ force: true });
    }
    const riskCard = riskDetails.locator('.glass-panel', { hasText: 'Process Execution' }).first();
    await expect(riskCard).toBeVisible();

    await riskCard.dragTo(inProgressCol);

    // Confirm custom dialog warning
    await page.waitForSelector('h3:has-text("Confirmation Required")');
    const confirmModal = page.locator('.glass-panel', { has: page.locator('h3:has-text("Confirmation Required")') });
    await confirmModal.locator('button:has-text("Confirm")').click();

    // Verify risk justification/approver logs are cleared on card details
    const inProgressCard = inProgressCol.locator('.glass-panel', { hasText: 'Process Execution' }).first();
    await inProgressCard.click({ force: true });
    await page.waitForSelector('h1:has-text("Process Execution")');
    
    // Check justification is empty/cleared
    const justificationText = await page.locator('body').textContent();
    expect(justificationText.includes('CISO Security Committee')).toBeFalsy();
  });
});
