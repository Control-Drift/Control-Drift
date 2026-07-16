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

test.describe('E2E Purple Team E2E Verification Flow - Worst Case Scenario Rollup', () => {
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

  test('should execute 10 sequential worst-case simulations and verify posture rollup', async ({ page }) => {
    // Set 12 minutes timeout for the whole test
    test.setTimeout(720000);

    // Keep track of dynamically selected TTP IDs for Sim 1 and Sim 8
    let sim1TtpId = '';
    let sim8TtpId = '';

    const campaignsConfig = [
      // Sim 1: Initial Access, TTP 1, Prevented & Alerted -> Optimal
      {
        id: 1,
        tactic: 'Initial Access',
        ttpIndices: [0], // Select first technique
        events: [
          {
            name: 'Sim 1 Event 1',
            ttpIdx: 0,
            outcome: 'Prevented & Alerted',
            overrideRating: null
          }
        ]
      },
      // Sim 2: Initial Access, TTP 2, Alerted -> Partial (manual override)
      {
        id: 2,
        tactic: 'Initial Access',
        ttpIndices: [1], // Select second technique
        events: [
          {
            name: 'Sim 2 Event 1',
            ttpIdx: 0, // Maps to the first selected TTP in this scoping session (which is TTP 2 of Initial Access)
            outcome: 'Alerted',
            overrideRating: 'Partial'
          }
        ]
      },
      // Sim 3: Initial Access, TTP 2, Prevented (No Alert) -> Partial
      {
        id: 3,
        tactic: 'Initial Access',
        ttpIndices: [2], // Select third technique
        events: [
          {
            name: 'Sim 3 Event 1',
            ttpIdx: 0,
            outcome: 'Prevented (No Alert)',
            overrideRating: null
          }
        ]
      },
      // Sim 4: Initial Access, TTP 2, Prevented (No Alert) -> Optimal (manual override)
      {
        id: 4,
        tactic: 'Initial Access',
        ttpIndices: [3], // Select fourth technique
        events: [
          {
            name: 'Sim 4 Event 1',
            ttpIdx: 0,
            outcome: 'Prevented (No Alert)',
            overrideRating: 'Optimal'
          }
        ]
      },
      // Sim 5: Execution, TTP 1, Logged -> Minimal (manual override)
      {
        id: 5,
        tactic: 'Execution',
        ttpIndices: [0], // Select first technique
        events: [
          {
            name: 'Sim 5 Event 1',
            ttpIdx: 0,
            outcome: 'Logged',
            overrideRating: 'Minimal'
          }
        ]
      },
      // Sim 6: Execution, TTP 1, Logged -> Partial
      {
        id: 6,
        tactic: 'Execution',
        ttpIndices: [1], // Select second technique
        events: [
          {
            name: 'Sim 6 Event 1',
            ttpIdx: 0,
            outcome: 'Logged',
            overrideRating: null
          }
        ]
      },
      // Sim 7: Persistence, TTP 1, Missed -> None
      {
        id: 7,
        tactic: 'Persistence',
        ttpIndices: [0], // Select first technique
        events: [
          {
            name: 'Sim 7 Event 1',
            ttpIdx: 0,
            outcome: 'Missed',
            overrideRating: null
          }
        ]
      },
      // Sim 8: Credential Access, TTP 1, Multi-Event Same TTP: Event 1 (Logged -> Partial) + Event 2 (Prevented & Alerted -> Optimal) -> Rolled up to Partial
      {
        id: 8,
        tactic: 'Credential Access',
        ttpIndices: [0], // Select first technique
        events: [
          {
            name: 'Sim 8 Event 1',
            ttpIdx: 0,
            outcome: 'Logged',
            overrideRating: null
          },
          {
            name: 'Sim 8 Event 2',
            ttpIdx: 0,
            outcome: 'Prevented & Alerted',
            overrideRating: null
          }
        ]
      },
      // Sim 9: Credential Access, TTP 1, Multi-Event Same TTP: Event 1 (Logged -> Minimal) + Event 2 (Missed -> None) -> Rolled up to None/No Coverage
      {
        id: 9,
        tactic: 'Credential Access',
        ttpIndices: [1], // Select second technique (to avoid conflict with Sim 8)
        events: [
          {
            name: 'Sim 9 Event 1',
            ttpIdx: 0,
            outcome: 'Logged',
            overrideRating: 'Minimal'
          },
          {
            name: 'Sim 9 Event 2',
            ttpIdx: 0,
            outcome: 'Missed',
            overrideRating: null
          }
        ]
      },
      // Sim 10: Discovery, TTP 1 and TTP 2, Multi-Event Diff TTPs: Event 1 (TTP 1, Alerted -> Optimal) + Event 2 (TTP 2, Logged -> Partial)
      {
        id: 10,
        tactic: 'Discovery',
        ttpIndices: [0, 1], // Select first and second techniques
        events: [
          {
            name: 'Sim 10 Event 1',
            ttpIdx: 0, // Mapped to TTP 1
            outcome: 'Alerted',
            overrideRating: null
          },
          {
            name: 'Sim 10 Event 2',
            ttpIdx: 1, // Mapped to TTP 2
            outcome: 'Logged',
            overrideRating: null
          }
        ]
      }
    ];

    for (const sim of campaignsConfig) {
      console.log(`\n--- Starting Simulation Campaign ${sim.id} of 10 (${sim.tactic}) ---`);
      await page.goto('/exercise');
      await page.waitForSelector('input[placeholder="e.g., APT29 Emulation"]');
      await humanPause(200, 500);

      // Step 1: Scoping
      const simName = `Worst Case Sim ${sim.id} - ${Math.random().toString(36).substring(2, 7)}`;
      const nameInput = page.getByPlaceholder('e.g., APT29 Emulation');
      await nameInput.click({ force: true });
      await humanType(nameInput, simName);
      await humanPause(100, 300);

      // Target Environment -> Production
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
      await humanType(goalsEditor, `E2E worst case simulation goals for campaign ${sim.id}.`);
      await humanPause(200, 400);

      // Map TTPs by clicking the pipeline node for the tactic
      await page.locator('div:has(> .ttp-node)').getByText(sim.tactic, { exact: true }).first().click({ force: true });
      await page.waitForSelector('text=sub-techniques');
      await humanPause(200, 400);

      // Dynamically retrieve the TTP IDs and select them
      const selectedTtpIds = [];
      for (const ttpIdx of sim.ttpIndices) {
        const cards = page.locator('div.ttp-card');
        const ttpIdMatch = (await cards.nth(ttpIdx).innerText()).match(/T\d{4}(?:\.\d{3})?/);
        const ttpId = ttpIdMatch ? ttpIdMatch[0] : `Unknown-${ttpIdx}`;
        selectedTtpIds.push(ttpId);
        
        // Select the technique by clicking the "Select" div
        await cards.nth(ttpIdx).locator('div', { hasText: /^Select(ed)?$/ }).first().click({ force: true });
        await humanPause(50, 150);
      }

      console.log(`Selected TTPs: ${selectedTtpIds.join(', ')}`);

      // Store specific TTP IDs for later posture assertions
      if (sim.id === 1) {
        sim1TtpId = selectedTtpIds[0];
        console.log(`Saved sim1TtpId as ${sim1TtpId}`);
      } else if (sim.id === 8) {
        sim8TtpId = selectedTtpIds[0];
        console.log(`Saved sim8TtpId as ${sim8TtpId}`);
      }

      // Close Modal (Go Back to pipeline view)
      await page.locator('button:has-text("Back")').first().click({ force: true });
      await humanPause(200, 400);

      // Next Step -> Step 2: Attack Chain Design
      await page.locator('button:has-text("Next Step")').click({ force: true });
      await humanPause(200, 400);

      // Step 2: Attack Chain Design
      await page.waitForSelector('.rich-markdown-editor .ql-editor');
      const chainEditor = page.locator('.rich-markdown-editor .ql-editor').first();
      await chainEditor.click({ force: true });
      await humanType(chainEditor, `# Attack Chain ${sim.id}\n\n- Executing simulation events.`);
      await humanPause(200, 400);

      // Next Step -> Step 3: Execution & Logging
      await page.locator('button:has-text("Next Step")').click({ force: true });
      await humanPause(200, 400);

      // Step 3: Execution & Logging
      await page.waitForSelector('button:has-text("+ Add Event")');
      await humanPause(200, 400);

      // Add each event
      for (let evtIdx = 0; evtIdx < sim.events.length; evtIdx++) {
        const evt = sim.events[evtIdx];
        const eventTtpId = selectedTtpIds[evt.ttpIdx];
        console.log(`Adding Event ${evtIdx + 1}: ${evt.name} for TTP ${eventTtpId}`);

        await page.locator('button:has-text("+ Add Event")').click({ force: true });
        await humanPause(100, 300);

        // Fill inputs
        await page.getByPlaceholder('Payload Name').nth(evtIdx).fill(evt.name);
        await page.getByPlaceholder('Red Team Notes (e.g. executed under SYSTEM)').nth(evtIdx).fill(`Red team notes for event ${evtIdx + 1}`);
        await page.getByPlaceholder('Blue Team Notes (e.g. Found Event ID 4688)').nth(evtIdx).fill(`Blue team notes for event ${evtIdx + 1}`);

        // Map TTP
        const ttpDropdown = page.locator('label:has-text("Mapped TTPs")').nth(evtIdx).locator('..').locator('button.dropdown-button');
        await ttpDropdown.click({ force: true });
        await humanPause(100, 200);
        await page.locator('.portal-dropdown-menu').getByText(eventTtpId, { exact: true }).click({ force: true });
        await ttpDropdown.click({ force: true }); // Close dropdown
        await humanPause(100, 200);

        // Set Actual Outcome
        const actualDropdown = page.locator('label:has-text("Actual Outcome")').nth(evtIdx).locator('..').locator('button').first();
        await actualDropdown.click({ force: true });
        await humanPause(100, 200);
        await page.locator('.portal-dropdown-menu').getByText(evt.outcome, { exact: true }).first().click({ force: true });
        await humanPause(200, 400);

        // If override is required
        if (evt.overrideRating) {
          console.log(`Manually overriding coverage rating to: ${evt.overrideRating}`);
          const coverageDropdown = page.locator('label:has-text("Coverage Rating")').nth(evtIdx).locator('..').locator('button').first();
          await coverageDropdown.click({ force: true });
          await humanPause(100, 200);
          await page.locator('.portal-dropdown-menu').getByText(evt.overrideRating, { exact: true }).first().click({ force: true });
          await humanPause(200, 400);
        }
      }

      // Next Step -> Step 4: Report preview and Submission
      await page.locator('button:has-text("Next Step")').click({ force: true });
      await humanPause(200, 400);

      // Step 4: Reporting
      await page.waitForSelector('#executive-report');
      await page.locator('.rich-markdown-editor .ql-editor').first().fill(`This is worst case simulation report executive summary for campaign ${sim.id}.`);
      await page.locator('button:has-text("Submit")').click({ force: true });

      // Verification on /reports Page
      await page.waitForURL('**/reports');
      await page.waitForSelector('#historical-executive-report');
      await humanPause(500, 1000);
      console.log(`Campaign ${sim.id} submitted successfully.`);
    }

    // Step 5: Assertions verifying strict worst-case scenario rollup
    console.log('\n--- Starting Posture Assertions ---');
    console.log('Navigating to /posture Heatmap...');
    await page.goto('/posture');
    await page.waitForSelector('h3:has-text("Tactics Navigator")');
    await humanPause(500, 1000);

    // Assertion 1: Credential Access (Sim 8)
    console.log(`Verifying Credential Access TTP ${sim8TtpId} status is Partial`);
    await page.locator('.heatmap-sidebar').getByText('Credential Access', { exact: true }).click({ force: true });
    await humanPause(500, 1000);

    // Find Technique card for TTP
    const techCard8 = page.locator('.tactic-details-panel').getByText(sim8TtpId, { exact: true }).first();
    await expect(techCard8).toBeVisible();
    await techCard8.click({ force: true });
    
    // Assert status is Partial (Partial Coverage or computed color rgb(245, 158, 11))
    await page.waitForSelector('.ttp-modal');
    const modalStatus8 = page.locator('.ttp-modal').getByText('Partial Coverage').first();
    await expect(modalStatus8).toBeVisible();
    
    const color8 = await modalStatus8.evaluate(el => window.getComputedStyle(el).color);
    console.log(`TTP ${sim8TtpId} status text is 'Partial Coverage', color: ${color8}`);
    expect(color8).toBe('rgb(245, 158, 11)');

    // Close Modal
    await page.locator('.ttp-modal button').first().click({ force: true });
    await page.waitForSelector('.ttp-modal', { state: 'detached' });
    await humanPause(500, 1000);

    // Assertion 2: Initial Access (Sim 1)
    console.log(`Verifying Initial Access TTP ${sim1TtpId} status is Optimal`);
    await page.locator('.heatmap-sidebar').getByText('Initial Access', { exact: true }).click({ force: true });
    await humanPause(500, 1000);

    // Find Technique card for TTP
    const techCard1 = page.locator('.tactic-details-panel').getByText(sim1TtpId, { exact: true }).first();
    await expect(techCard1).toBeVisible();
    await techCard1.click({ force: true });

    // Assert status is Optimal (Optimal Coverage or computed color rgb(16, 185, 129))
    await page.waitForSelector('.ttp-modal');
    const modalStatus1 = page.locator('.ttp-modal').getByText('Optimal Coverage').first();
    await expect(modalStatus1).toBeVisible();

    const color1 = await modalStatus1.evaluate(el => window.getComputedStyle(el).color);
    console.log(`TTP ${sim1TtpId} status text is 'Optimal Coverage', color: ${color1}`);
    expect(color1).toBe('rgb(16, 185, 129)');

    // Close Modal
    await page.locator('.ttp-modal button').first().click({ force: true });
    await page.waitForSelector('.ttp-modal', { state: 'detached' });
    
    console.log('All worst-case E2E assertions passed successfully!');
  });
});
