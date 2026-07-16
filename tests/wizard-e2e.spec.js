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
  }
} catch (e) {
  console.error('Failed to parse local MITRE cache:', e);
}

test.describe('Purple Team Simulation Wizard E2E Flow', () => {
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

  test('should complete wizard steps and verify reports metrics 3 times', async ({ page }) => {
    test.setTimeout(180000); // 3 minutes timeout for 3 iterations
    // Navigate to the Exercise Wizard
    console.log('Navigating to simulation launcher...');
    
    for (let i = 1; i <= 3; i++) {
      console.log(`\n--- STARTING SIMULATION ${i} OF 3 ---`);
      await page.goto('/exercise');
    
    // Wait for the scoping step to load
    await page.waitForSelector('text=Establishing secure database connection...', { state: 'detached', timeout: 30000 });
    await page.waitForSelector('input[placeholder="e.g., APT29 Emulation"]');

    // 2. Step 1 (Scoping)
    console.log(`Completing Step 1: Scoping for Simulation ${i}...`);
    
    // Fill in Simulation Name
    await page.getByPlaceholder('e.g., APT29 Emulation').fill(`Playwright Stress Test Auto-Sim ${i}`);

    // Select Target Environment
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

    // Fill Scenario Goals
    await page.locator('.rich-markdown-editor .ql-editor').first().fill(
      'Validate endpoint protection telemetry and alert generation for multiple initial access mechanisms.'
    );

    // Map TTPs by clicking an interactive pipeline node
    console.log('Opening TTP Selector inline...');
    await page.getByText('Initial Access', { exact: true }).click({ force: true });
    
    // Wait for the inline techniques to load
    await page.waitForSelector('.ttp-card', { state: 'visible' });

    const cards = page.locator('.ttp-card');

    // Dynamically retrieve the TTP IDs of the first 3 techniques so we can map them in Step 3
    const ttpIdMatch1 = (await cards.nth(0).innerText()).match(/T\d{4}(?:\.\d{3})?/);
    const ttpId1 = ttpIdMatch1 ? ttpIdMatch1[0] : `Unknown-0`;
    const ttpIdMatch2 = (await cards.nth(1).innerText()).match(/T\d{4}(?:\.\d{3})?/);
    const ttpId2 = ttpIdMatch2 ? ttpIdMatch2[0] : `Unknown-1`;
    const ttpIdMatch3 = (await cards.nth(2).innerText()).match(/T\d{4}(?:\.\d{3})?/);
    const ttpId3 = ttpIdMatch3 ? ttpIdMatch3[0] : `Unknown-2`;

    console.log(`Selecting techniques: ${ttpId1}, ${ttpId2}, ${ttpId3}`);

    // Click the "Select" buttons on the cards
    await cards.nth(0).getByText('Select', { exact: true }).first().click({ force: true });
    await cards.nth(1).getByText('Select', { exact: true }).first().click({ force: true });
    await cards.nth(2).getByText('Select', { exact: true }).first().click({ force: true });

    // Go to Step 2
    console.log('Proceeding to Step 2: Attack Chain Design...');
    await page.locator('button:has-text("Next Step")').click({ force: true });

    // 3. Step 2 (Attack Chain Design)
    console.log('Completing Step 2...');
    await page.waitForSelector('.rich-markdown-editor .ql-editor');
    await page.locator('.rich-markdown-editor .ql-editor').first().fill(
      '# Attack Chain\n\n1. Initial Access simulation payload execution.'
    );

    // Go to Step 3
    console.log('Proceeding to Step 3: Execution & Logging...');
    await page.locator('button:has-text("Next Step")').click({ force: true });

    // 4. Step 3 (Execution & Logging)
    console.log('Completing Step 3...');
    await page.waitForSelector('button:has-text("+ Add Event")');

    // --- Add Event 1: Prevented (Optimal Coverage) ---
    console.log(`Logging Event 1 for ${ttpId1} (Prevented)...`);
    await page.locator('button:has-text("+ Add Event")').click({ force: true });
    
    await page.getByPlaceholder('Payload Name').first().fill('Playwright Test Event 1');
    await page.getByPlaceholder('Red Team Notes (e.g. executed under SYSTEM)').first().fill('Executed execution payload.');
    await page.getByPlaceholder('Blue Team Notes (e.g. Found Event ID 4688)').first().fill('Successfully blocked by EDR rule.');

    // Map TTP 1
    const ttpDropdown1 = page.locator('label:has-text("Mapped TTPs")').first().locator('..').locator('button.dropdown-button');
    await ttpDropdown1.click({ force: true });
    await page.locator('.portal-dropdown-menu').getByText(ttpId1, { exact: true }).click({ force: true });
    await ttpDropdown1.click({ force: true }); // Close dropdown

    // Set Actual Outcome to Prevented
    const actualDropdown1 = page.locator('label:has-text("Actual Outcome")').first().locator('..').locator('button').first();
    await actualDropdown1.click({ force: true });
    await page.locator('.portal-dropdown-menu button:has-text("Prevented & Alerted")').first().click({ force: true });

    // --- Add Event 2: Logged (Partial Coverage) ---
    console.log(`Logging Event 2 for ${ttpId2} (Logged)...`);
    await page.locator('button:has-text("+ Add Event")').click({ force: true });
    
    await page.getByPlaceholder('Payload Name').nth(1).fill('Playwright Test Event 2');
    await page.getByPlaceholder('Red Team Notes (e.g. executed under SYSTEM)').nth(1).fill('Executed registry modifications.');
    await page.getByPlaceholder('Blue Team Notes (e.g. Found Event ID 4688)').nth(1).fill('Events logged in Event Viewer, no alert.');

    // Map TTP 2
    const ttpDropdown2 = page.locator('label:has-text("Mapped TTPs")').nth(1).locator('..').locator('button.dropdown-button');
    await ttpDropdown2.click({ force: true });
    await page.locator('.portal-dropdown-menu').getByText(ttpId2, { exact: true }).click({ force: true });
    await ttpDropdown2.click({ force: true }); // Close dropdown

    // Set Actual Outcome to Logged
    const actualDropdown2 = page.locator('label:has-text("Actual Outcome")').nth(1).locator('..').locator('button').first();
    await actualDropdown2.click({ force: true });
    await page.locator('.portal-dropdown-menu button:has-text("Logged")').first().click({ force: true });

    // --- Add Event 3: Missed (No Coverage) ---
    console.log(`Logging Event 3 for ${ttpId3} (Missed)...`);
    await page.locator('button:has-text("+ Add Event")').click({ force: true });
    
    await page.getByPlaceholder('Payload Name').nth(2).fill('Playwright Test Event 3');
    await page.getByPlaceholder('Red Team Notes (e.g. executed under SYSTEM)').nth(2).fill('Executed stealthy shellcode injection.');
    await page.getByPlaceholder('Blue Team Notes (e.g. Found Event ID 4688)').nth(2).fill('No logs or alerts generated.');

    // Map TTP 3
    const ttpDropdown3 = page.locator('label:has-text("Mapped TTPs")').nth(2).locator('..').locator('button.dropdown-button');
    await ttpDropdown3.click({ force: true });
    await page.locator('.portal-dropdown-menu').getByText(ttpId3, { exact: true }).click({ force: true });
    await ttpDropdown3.click({ force: true }); // Close dropdown

    // Set Actual Outcome to Missed
    const actualDropdown3 = page.locator('label:has-text("Actual Outcome")').nth(2).locator('..').locator('button').first();
    await actualDropdown3.click({ force: true });
    await page.locator('.portal-dropdown-menu button:has-text("Missed")').first().click({ force: true });

    // Go to Step 4
    console.log('Proceeding to Step 4: Reporting...');
    await page.locator('button:has-text("Next Step")').click({ force: true });

    // 5. Step 4 (Reporting)
    console.log('Reviewing Step 4 report preview...');
    await page.waitForSelector('#executive-report');
    await page.locator('.rich-markdown-editor .ql-editor').first().fill('This is a test executive summary.');

    // Submit Report and navigate to reports dashboard
    console.log('Submitting simulation campaign...');
    await page.locator('button:has-text("Submit")').click({ force: true });

    // 6. Verification on /reports Page
    console.log('Waiting for redirection to Reports page...');
    await page.waitForURL('**/reports');
    
    // Log body text to diagnose rendering
    await page.waitForTimeout(2000); // Wait 2 seconds for any state transitions
    console.log('PAGE TEXT CONTENT BELOW:');
    console.log(await page.locator('body').textContent());
    console.log('-------------------------');

    await page.waitForSelector('#historical-executive-report');

    console.log('Scraping high-level coverage metrics from DOM for validation...');
    
    // Scrape and assert optimal count
    const optimalLabel = page.locator('div', { hasText: /^Optimal Coverage$/ }).first();
    const optimalScore = await optimalLabel.locator('..').locator('div').first().textContent();
    console.log('Optimal Coverage Count:', optimalScore.trim());
    expect(optimalScore.trim()).toBe('1');

    // Scrape and assert partial count
    const partialLabel = page.locator('div', { hasText: /^Partial Coverage$/ }).first();
    const partialScore = await partialLabel.locator('..').locator('div').first().textContent();
    console.log('Partial Coverage Count:', partialScore.trim());
    expect(partialScore.trim()).toBe('1');

    // Scrape and assert no coverage count
    const noCoverageLabel = page.locator('div', { hasText: /^No Coverage$/ }).first();
    const noCoverageScore = await noCoverageLabel.locator('..').locator('div').first().textContent();
    console.log('No Coverage Count:', noCoverageScore.trim());
    expect(noCoverageScore.trim()).toBe('1');

    // Scrape and assert total count
    const totalLabel = page.locator('div', { hasText: /^Total Validated$/ }).first();
    const totalScore = await totalLabel.locator('..').locator('div').first().textContent();
    console.log('Total Validated TTPs Count:', totalScore.trim());
    expect(totalScore.trim()).toBe('3');

    console.log(`E2E Purple Team Wizard Simulation ${i} verified successfully!`);
    }
  });
});
