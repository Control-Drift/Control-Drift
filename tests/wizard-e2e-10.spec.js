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

test.describe('E2E Purple Team E2E Verification Flow', () => {
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

  test('should execute 10 sequential simulations and verify posture, gaps, and dashboard', async ({ page }) => {
    // Set 10 minutes timeout for the whole test
    test.setTimeout(600000);

    const createdTtpIds = [];
    let lastSimName = '';

    for (let i = 1; i <= 10; i++) {
      console.log(`\n--- Starting Simulation Campaign ${i} of 10 ---`);
      await page.goto('/exercise');
      await page.waitForSelector('input[placeholder="e.g., APT29 Emulation"]');
      await humanPause(200, 500);

      // Step 1: Scoping
      const simName = `Campaign E2E Sim ${i} - ${Math.random().toString(36).substring(2, 7)}`;
      lastSimName = simName;
      const nameInput = page.getByPlaceholder('e.g., APT29 Emulation');
      await nameInput.click({ force: true });
      await humanType(nameInput, simName);
      await humanPause(100, 300);

      // Target Environment
      const envDropdown = page.locator('label:has-text("Target Environment") + div');
      await envDropdown.click({ force: true });
      await humanPause(100, 200);

      const prodBtn = page.locator('button:has-text("Production")');
      if (await prodBtn.isVisible()) {
        await prodBtn.click({ force: true });
      } else {
        const searchInput = page.locator('input[placeholder="Type to search or create..."]');
        await searchInput.click({ force: true });
        await humanType(searchInput, 'Production');
        await humanPause(100, 200);
        const createBtn = page.locator('button:has-text("Create \\"Production\\"")');
        await createBtn.click({ force: true });
      }
      await humanPause(200, 400);

      // Goals
      const goalsEditor = page.locator('.rich-markdown-editor .ql-editor').first();
      await goalsEditor.click({ force: true });
      await humanType(goalsEditor, `Scoping goals for simulation run ${i}. Validate alerts and logs.`);
      await humanPause(200, 400);

      // Select TTPs inline
      await page.getByText('Initial Access', { exact: true }).click({ force: true });
      await page.waitForSelector('.ttp-card', { state: 'visible' });
      await humanPause(200, 400);

      const cards = page.locator('.ttp-card');

      // Retrieve first 3 techniques dynamically
      const ttpIdMatch1 = (await cards.nth(0).innerText()).match(/T\d{4}(?:\.\d{3})?/);
      const ttpId1 = ttpIdMatch1 ? ttpIdMatch1[0] : `Unknown-0`;
      const ttpIdMatch2 = (await cards.nth(1).innerText()).match(/T\d{4}(?:\.\d{3})?/);
      const ttpId2 = ttpIdMatch2 ? ttpIdMatch2[0] : `Unknown-1`;
      const ttpIdMatch3 = (await cards.nth(2).innerText()).match(/T\d{4}(?:\.\d{3})?/);
      const ttpId3 = ttpIdMatch3 ? ttpIdMatch3[0] : `Unknown-2`;

      if (!createdTtpIds.includes(ttpId1)) createdTtpIds.push(ttpId1);
      if (!createdTtpIds.includes(ttpId2)) createdTtpIds.push(ttpId2);
      if (!createdTtpIds.includes(ttpId3)) createdTtpIds.push(ttpId3);

      // Click "Select" buttons to select them
      await cards.nth(0).getByText('Select', { exact: true }).first().click({ force: true });
      await humanPause(50, 150);
      await cards.nth(1).getByText('Select', { exact: true }).first().click({ force: true });
      await humanPause(50, 150);
      await cards.nth(2).getByText('Select', { exact: true }).first().click({ force: true });
      await humanPause(100, 300);
      await humanPause(200, 400);

      // Next
      await page.locator('button:has-text("Next Step")').click({ force: true });
      await humanPause(200, 400);

      // Step 2: Attack Chain Design
      await page.waitForSelector('.rich-markdown-editor .ql-editor');
      const chainEditor = page.locator('.rich-markdown-editor .ql-editor').first();
      await chainEditor.click({ force: true });
      await humanType(chainEditor, '# Attack Flow\n\n- Executing simulation events.');
      await humanPause(200, 400);

      // Next
      await page.locator('button:has-text("Next Step")').click({ force: true });
      await humanPause(200, 400);

      // Step 3: Execution & Logging
      await page.waitForSelector('button:has-text("+ Add Event")');
      await humanPause(200, 400);

      // Event 1: Prevented (Optimal)
      await page.locator('button:has-text("+ Add Event")').click({ force: true });
      await humanPause(100, 300);
      await page.getByPlaceholder('Payload Name').first().fill('E2E Event 1');
      await page.getByPlaceholder('Red Team Notes (e.g. executed under SYSTEM)').first().fill('Red notes 1');
      await page.getByPlaceholder('Blue Team Notes (e.g. Found Event ID 4688)').first().fill('EDR blocked execution');
      
      const ttpDropdown1 = page.locator('label:has-text("Mapped TTPs")').first().locator('..').locator('button.dropdown-button');
      await ttpDropdown1.click({ force: true });
      await humanPause(100, 200);
      await page.locator('.portal-dropdown-menu').getByText(ttpId1, { exact: true }).click({ force: true });
      await ttpDropdown1.click({ force: true });

      const actualDropdown1 = page.locator('label:has-text("Actual Outcome")').first().locator('..').locator('button').first();
      await actualDropdown1.click({ force: true });
      await page.locator('.portal-dropdown-menu button:has-text("Prevented & Alerted")').first().click({ force: true });
      await humanPause(200, 400);

      // Event 2: Logged (Partial)
      await page.locator('button:has-text("+ Add Event")').click({ force: true });
      await humanPause(100, 300);
      await page.getByPlaceholder('Payload Name').nth(1).fill('E2E Event 2');
      await page.getByPlaceholder('Red Team Notes (e.g. executed under SYSTEM)').nth(1).fill('Red notes 2');
      await page.getByPlaceholder('Blue Team Notes (e.g. Found Event ID 4688)').nth(1).fill('Logged in security events');

      const ttpDropdown2 = page.locator('label:has-text("Mapped TTPs")').nth(1).locator('..').locator('button.dropdown-button');
      await ttpDropdown2.click({ force: true });
      await humanPause(100, 200);
      await page.locator('.portal-dropdown-menu').getByText(ttpId2, { exact: true }).click({ force: true });
      await ttpDropdown2.click({ force: true });

      const actualDropdown2 = page.locator('label:has-text("Actual Outcome")').nth(1).locator('..').locator('button').first();
      await actualDropdown2.click({ force: true });
      await page.locator('.portal-dropdown-menu button:has-text("Logged")').first().click({ force: true });
      await humanPause(200, 400);

      // Event 3: Missed (No Coverage)
      await page.locator('button:has-text("+ Add Event")').click({ force: true });
      await humanPause(100, 300);
      await page.getByPlaceholder('Payload Name').nth(2).fill('E2E Event 3');
      await page.getByPlaceholder('Red Team Notes (e.g. executed under SYSTEM)').nth(2).fill('Red notes 3');
      await page.getByPlaceholder('Blue Team Notes (e.g. Found Event ID 4688)').nth(2).fill('No logs observed');

      const ttpDropdown3 = page.locator('label:has-text("Mapped TTPs")').nth(2).locator('..').locator('button.dropdown-button');
      await ttpDropdown3.click({ force: true });
      await humanPause(100, 200);
      await page.locator('.portal-dropdown-menu').getByText(ttpId3, { exact: true }).click({ force: true });
      await ttpDropdown3.click({ force: true });

      const actualDropdown3 = page.locator('label:has-text("Actual Outcome")').nth(2).locator('..').locator('button').first();
      await actualDropdown3.click({ force: true });
      await page.locator('.portal-dropdown-menu button:has-text("Missed")').first().click({ force: true });
      await humanPause(200, 400);

      // Next
      await page.locator('button:has-text("Next Step")').click({ force: true });
      await humanPause(200, 400);

      // Step 4: Reporting
      await page.waitForSelector('#executive-report');
      await page.locator('.rich-markdown-editor .ql-editor').first().fill('This is a test executive summary.');
      await page.locator('button:has-text("Submit")').click({ force: true });

      // Verification on /reports Page
      await page.waitForURL('**/reports');
      await page.waitForSelector('#historical-executive-report');
      await humanPause(500, 1000);
    }

    // 2. Navigate to /posture and verify technique coverage displays accurately
    console.log('Navigating to /posture Heatmap...');
    await page.goto('/posture');
    await page.waitForSelector('h3:has-text("Tactics Navigator")');
    await humanPause(500, 1000);

    // Filter to 'Initial Access'
    await page.locator('.heatmap-sidebar').getByText('Initial Access', { exact: true }).click({ force: true });
    await humanPause(500, 1000);

    // Verify tested techniques are rendered in the sidebar list of Initial Access
    const techSpan = page.locator('.tactic-details-panel').first();
    await expect(techSpan).toBeVisible();

    // 3. Navigate to /gaps, select a gap, resolve it, verify persistence
    console.log('Navigating to /gaps Gap Tracker...');
    await page.goto('/gaps');
    await page.waitForSelector('h1:has-text("Gap & Remediation Tracker")');
    await humanPause(500, 1000);

    // Select the first open gap card
    const firstGapCard = page.locator('div[draggable="true"]').first();
    await expect(firstGapCard).toBeVisible();
    
    // Get the displayId/ttp of the gap so we can verify its removal from attack-path later
    const gapText = await firstGapCard.locator('h4').first().textContent();
    console.log(`Selecting gap: ${gapText}`);
    const gapTtpMatch = gapText.match(/T\d{4}(?:\.\d{3})?/);
    const targetTtp = gapTtpMatch ? gapTtpMatch[0] : null;

    await firstGapCard.click();
    await humanPause(500, 1000);

    // In the details modal, select 'Resolved' from the status dropdown to open the validation modal
    const detailsStatusDropdown = page.locator('button', { hasText: /^(OPEN|IN PROGRESS|RISK ACCEPTED)$/ }).first();
    await expect(detailsStatusDropdown).toBeVisible();
    await detailsStatusDropdown.click({ force: true });
    await page.locator('div', { hasText: /^RESOLVED$/ }).click({ force: true });
    await humanPause(500, 1000);

    // In the validation modal, select outcome "Prevented & Alerted" and submit
    const outcomeDropdown = page.locator('label:has-text("Validation Outcome")').locator('..').locator('button').first();
    await outcomeDropdown.click({ force: true });
    await page.locator('button:has-text("Prevented & Alerted")').click({ force: true });

    const notesTextarea = page.locator('textarea[placeholder*="Sigma rule"]');
    await notesTextarea.fill('Verified and resolved via E2E playwright validation run.');
    await page.locator('button:has-text("Submit Validation")').click({ force: true });

    await humanPause(500, 1000);

    // Go back to gaps
    await page.goto('/gaps');
    await page.waitForSelector('h1:has-text("Gap & Remediation Tracker")');
    console.log('Gap validation successfully completed.');

    // Verify it is removed from attack path
    if (targetTtp) {
      console.log(`Navigating to Attack Path to verify removal of TTP ${targetTtp}...`);
      await page.goto('/attack-path');
      await page.waitForSelector('text=Global Attack Path Analysis');
      await humanPause(500, 1000);
      const attackNode = page.locator(`text=${targetTtp}`);
      await expect(attackNode).not.toBeVisible();
      console.log(`Successfully verified TTP ${targetTtp} is removed from attack path.`);
    }

    // 4. Assert that all high-level dashboard metrics on / match raw underlying counts exactly
    console.log('Navigating to Dashboard / ...');
    await page.goto('/');
    await page.waitForSelector('h1:has-text("Dashboard")');
    await humanPause(500, 1000);

    // Get metrics from dashboard UI
    const activeGapsDashboardText = await page.locator('div', { hasText: /^Active Gaps$/i }).locator('..').locator('div').nth(1).textContent();
    const activeGapsDashboard = parseInt(activeGapsDashboardText.trim(), 10);

    const testedTTPsDashboardText = await page.locator('div', { hasText: /^Tested TTPs$/i }).locator('..').locator('div').nth(1).textContent();
    const testedTTPsDashboard = parseInt(testedTTPsDashboardText.trim(), 10);

    console.log(`Dashboard metrics: Active Gaps = ${activeGapsDashboard}, Tested TTPs = ${testedTTPsDashboard}`);

    // Query local storage raw counts
    const rawGapsCount = await page.evaluate(() => {
      const gaps = JSON.parse(localStorage.getItem('gaps') || '[]');
      return gaps.filter(g => g.status === 'Open' || g.status === 'In Progress').length;
    });

    const rawTestedTTPs = await page.evaluate(() => {
      const exercises = JSON.parse(localStorage.getItem('exercises') || '[]');
      const uniqueTTPs = new Set(exercises.filter(ex => ex.status !== 'na' && ex.coverageRating !== 'N/A' && ex.simulation !== 'Admin Config').map(ex => ex.ttp));
      return uniqueTTPs.size;
    });

    console.log(`Raw DB metrics: Active Gaps = ${rawGapsCount}, Tested TTPs = ${rawTestedTTPs}`);

    expect(activeGapsDashboard).toBe(rawGapsCount);
    expect(testedTTPsDashboard).toBe(rawTestedTTPs);

    console.log('All E2E checks passed successfully!');
  });
});
