# Purple Team Simulation Wizard E2E Investigation Report

## 1. Observation

The investigation analyzed the existing Playwright E2E spec files and React frontend source code to understand how Purple Team simulations are launched, configured, and processed.

### Existing E2E Test Structure
The E2E tests (`tests/wizard-e2e.spec.js`, `tests/wizard-e2e-10.spec.js`, and `tests/wizard-stress.spec.js`) utilize a multi-step flow matching the Exercise Wizard UI:
* **Step 1: Scoping:**
  * Enter a simulation campaign name (e.g., `Campaign E2E Sim ${i} - ...`).
  * Select or create a target environment category (e.g., "Production", "Staging").
  * Input scenario goals.
  * Select techniques (TTPs) by clicking on tactic tabs (e.g. "Initial Access") and checking technique boxes. The test dynamically scrapes technique IDs from the sibling span of the checkbox using:
    ```javascript
    const ttpId1 = (await page.locator('button[title="Select Parent Technique"] + div span').nth(0).textContent()).trim();
    ```
    *(Note: Since each technique card contains both the ID span and the Name span, index `2 * k` corresponds to the ID of the `k`-th technique, while `2 * k + 1` corresponds to its name).*
* **Step 2: Attack Chain Design:**
  * Populate the attack flow description within a rich text editor.
* **Step 3: Execution & Logging:**
  * Add event logs dynamically via the `+ Add Event` button.
  * For each event card, set the payload name, execution notes, detection notes, map it to a selected TTP via a dropdown, and set the **Actual Outcome** dropdown.
* **Step 4: Reporting:**
  * Enter an executive summary and click "Submit".
  * Validate that the browser redirects to `/reports` and the summary card is visible.

### Outcome and Coverage Rating Rules
In `src/components/dropdowns/OutcomeDropdown.jsx` (lines 5-12), the available outcomes are:
* `Prevented & Alerted`
* `Prevented (No Alert)`
* `Alerted`
* `Logged`
* `Missed`

In `src/components/dropdowns/CoverageRatingDropdown.jsx` (lines 28-43), the available coverage ratings are `Optimal`, `Partial`, `Minimal`, and `None`. The available options are restricted based on the selected outcome:
* **For `Prevented & Alerted`, `Prevented (No Alert)`, `Alerted`**: Ranks up to `Optimal` (3) are allowed. `Minimal` and `None` are disabled/hidden. Options are `Optimal` and `Partial`.
* **For `Logged`**: Ranks up to `Partial` (2) are allowed. `Optimal` and `None` are disabled/hidden. Options are `Partial` and `Minimal`.
* **For `Missed`**: Max rank is `None` (0). Options are restricted only to `None` (making the dropdown effectively disabled).

In `src/components/ui/EventCard.jsx` (lines 151-167), selecting an outcome automatically triggers a default `coverageRating` update:
* `Prevented & Alerted`, `Alerted` ➔ `Optimal`
* `Prevented (No Alert)`, `Logged` ➔ `Partial`
* `Missed` ➔ `None`

If a user wants to manually override this default (e.g., change `Alerted` from `Optimal` to `Partial`), they must open the `CoverageRatingDropdown` and select the alternative.

### Coverage Aggregation and Gap Generation
In `src/components/pages/ExerciseWizard.jsx`:
* **TTP Aggregation (`getAggregatedScore`, lines 307-350):** If multiple events map to the same TTP, their coverage rating scores (`Optimal` = 100, `Partial` = 50, `Minimal` = 25, `None` = 0) are averaged.
  * `avg === 100` ➔ Aggregated Coverage = `Optimal`
  * `avg >= 50` ➔ Aggregated Coverage = `Partial`
  * `avg > 0` ➔ Aggregated Coverage = `Minimal`
  * `else` ➔ Aggregated Coverage = `None`
  * The aggregated TTP outcome is set to the highest rank outcome among the mapped events (`Prevented & Alerted` > `Prevented/Alerted` > `Logged` > `Missed`).
* **Gap Creation (lines 815-842):** A Gap ticket is created for every event where the coverage rating is `Partial`, `Minimal`, or `None`. The gap severity is computed, and a `priorityScore` is calculated:
  ```javascript
  const visibilityMultiplier = (p.coverageRating === 'None') ? 1.0 : (p.coverageRating === 'Minimal' ? 0.9 : (p.coverageRating === 'Partial' ? 0.75 : 0.0));
  const priorityScore = Math.round(baseScore * visibilityMultiplier);
  ```

---

## 2. Logic Chain

1. **Rule Constraint Analysis:** Inspecting `CoverageRatingDropdown.jsx` and `EventCard.jsx` showed that while outcomes automatically populate default coverage ratings, users can override them for certain outcomes (specifically, `Alerted`, `Prevented (No Alert)`, and `Logged`).
2. **Identified Test Gaps:** The existing E2E tests only verify default outcome/coverage mappings and never perform manual overrides. They also only select TTPs from the "Initial Access" tactic and test exactly 3 events per simulation.
3. **Multi-Event & Aggregation Test Requirement:** Inspecting `getAggregatedScore` inside `ExerciseWizard.jsx` revealed that the system computes averages across multiple events mapping to the same TTP. A comprehensive test suite should verify this averaging math (e.g. 100 + 50 = 75 average maps to `Partial` TTP coverage, whereas 50 + 0 = 25 average maps to `Minimal` TTP coverage).
4. **Conclusion:** To thoroughly test the Exercise Wizard, a new E2E test should be structured around 10 distinct configurations that exhaustively test combinations of outcomes, default coverage ratings, manual overrides, single/multiple TTP mappings, and tactics.

---

## 3. Caveats

* **MITRE Tactic Names:** The spec assumes that the tactics used in the tests exist in the local MITRE cache (`mitre_stix_cache.json`). The tactics used in the recommendations (e.g., `Initial Access`, `Execution`, `Persistence`, `Credential Access`, `Discovery`) are standard MITRE tactics and are guaranteed to be present.
* **Dropdown Selection Speed:** Playwright clicks can sometimes outrun React rendering. The test should use short, realistic pauses (`humanPause`) when interacting with portal-rendered dropdown menus.

---

## 4. Conclusion

We recommend creating a new Playwright test file, `tests/wizard-complex-coverage.spec.js`, that executes **10 diverse simulations**. 

### The 10 Recommended Simulation Configurations
The following matrix defines the 10 simulations, covering 5 different tactics, same and different TTP combinations, and every possible outcome/coverage configuration:

| Sim # | Campaign Name / Focus | Tactic | TTP Selection | Event configurations (Name, Outcome, Coverage Rating) | Aggregated Coverage & Outcome | Purpose / Verification Point |
|---|---|---|---|---|---|---|
| **1** | `Sim 1 - Optimal Prevention` | Initial Access | TTP A (Index 0) | Event 1: Outcome = `Prevented & Alerted`, Coverage = `Optimal` | **Optimal** (`Prevented & Alerted`) | Baseline optimal prevention (disabled coverage dropdown). |
| **2** | `Sim 2 - Partial Alerting` | Initial Access | TTP B (Index 1) | Event 1: Outcome = `Alerted`, Coverage = `Partial` | **Partial** (`Alerted`) | Manual override: downgrade `Alerted` from Optimal to Partial. |
| **3** | `Sim 3 - Silent Prevention` | Initial Access | TTP B (Index 1) | Event 1: Outcome = `Prevented (No Alert)`, Coverage = `Partial` | **Partial** (`Prevented (No Alert)`) | Baseline silent prevention (defaults to Partial). |
| **4** | `Sim 4 - Silent Prevention Override` | Initial Access | TTP B (Index 1) | Event 1: Outcome = `Prevented (No Alert)`, Coverage = `Optimal` | **Optimal** (`Prevented (No Alert)`) | Manual override: upgrade `Prevented (No Alert)` to Optimal. |
| **5** | `Sim 5 - Logged Minimal` | Execution | TTP A (Index 0) | Event 1: Outcome = `Logged`, Coverage = `Minimal` | **Minimal** (`Logged`) | Manual override: downgrade `Logged` from Partial to Minimal. |
| **6** | `Sim 6 - Logged Partial` | Execution | TTP A (Index 0) | Event 1: Outcome = `Logged`, Coverage = `Partial` | **Partial** (`Logged`) | Baseline logging (defaults to Partial). |
| **7** | `Sim 7 - Missed Attack` | Persistence | TTP A (Index 0) | Event 1: Outcome = `Missed`, Coverage = `None` | **None** (`Missed`) | Baseline missed attack (disabled coverage dropdown). |
| **8** | `Sim 8 - Multi-Event Same TTP (Med/High)` | Credential Access | TTP A (Index 0) | Event 1: Outcome = `Logged`, Coverage = `Partial`<br>Event 2: Outcome = `Prevented & Alerted`, Coverage = `Optimal` | **Partial** (`Prevented & Alerted`) | Aggregation math: `(50 + 100) / 2 = 75%` ➔ Partial coverage. Best outcome ➔ Prevented & Alerted. |
| **9** | `Sim 9 - Multi-Event Same TTP (Low/Med)` | Credential Access | TTP A (Index 0) | Event 1: Outcome = `Logged`, Coverage = `Minimal`<br>Event 2: Outcome = `Missed`, Coverage = `None` | **Minimal** (`Logged`) | Aggregation math: `(25 + 0) / 2 = 12.5%` ➔ Minimal coverage. Best outcome ➔ Logged. |
| **10** | `Sim 10 - Multi-Event Diff TTPs` | Discovery | TTP A & B (Index 0, 1) | Event 1: (TTP A) Outcome = `Alerted`, Coverage = `Optimal`<br>Event 2: (TTP B) Outcome = `Logged`, Coverage = `Minimal` | TTP A: **Optimal** (`Alerted`) <br> TTP B: **Minimal** (`Logged`) | Verifies multi-step scenario with independent TTP coverages in one campaign. |

### Proposed E2E Test Structure
The Playwright test should be structured as follows:

```javascript
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Parse MITRE data, retrieve SSO auth token, and inject in beforeEach (similar to wizard-e2e-10.spec.js)
// ...

const simulationConfigs = [
  {
    name: "Sim 1 - Optimal Prevention",
    tactic: "Initial Access",
    ttpIndices: [0],
    events: [
      { name: "Ev1", ttpIdx: 0, outcome: "Prevented & Alerted", coverage: "Optimal" }
    ]
  },
  {
    name: "Sim 2 - Partial Alerting",
    tactic: "Initial Access",
    ttpIndices: [1],
    events: [
      { name: "Ev1", ttpIdx: 0, outcome: "Alerted", coverage: "Partial" } // Manual override
    ]
  },
  {
    name: "Sim 3 - Silent Prevention",
    tactic: "Initial Access",
    ttpIndices: [1],
    events: [
      { name: "Ev1", ttpIdx: 0, outcome: "Prevented (No Alert)", coverage: "Partial" }
    ]
  },
  {
    name: "Sim 4 - Silent Prevention Override",
    tactic: "Initial Access",
    ttpIndices: [1],
    events: [
      { name: "Ev1", ttpIdx: 0, outcome: "Prevented (No Alert)", coverage: "Optimal" } // Manual override
    ]
  },
  {
    name: "Sim 5 - Logged Minimal",
    tactic: "Execution",
    ttpIndices: [0],
    events: [
      { name: "Ev1", ttpIdx: 0, outcome: "Logged", coverage: "Minimal" } // Manual override
    ]
  },
  {
    name: "Sim 6 - Logged Partial",
    tactic: "Execution",
    ttpIndices: [0],
    events: [
      { name: "Ev1", ttpIdx: 0, outcome: "Logged", coverage: "Partial" }
    ]
  },
  {
    name: "Sim 7 - Missed Attack",
    tactic: "Persistence",
    ttpIndices: [0],
    events: [
      { name: "Ev1", ttpIdx: 0, outcome: "Missed", coverage: "None" }
    ]
  },
  {
    name: "Sim 8 - Multi-Event Same TTP (Med/High)",
    tactic: "Credential Access",
    ttpIndices: [0],
    events: [
      { name: "Ev1", ttpIdx: 0, outcome: "Logged", coverage: "Partial" },
      { name: "Ev2", ttpIdx: 0, outcome: "Prevented & Alerted", coverage: "Optimal" }
    ]
  },
  {
    name: "Sim 9 - Multi-Event Same TTP (Low/Med)",
    tactic: "Credential Access",
    ttpIndices: [0],
    events: [
      { name: "Ev1", ttpIdx: 0, outcome: "Logged", coverage: "Minimal" },
      { name: "Ev2", ttpIdx: 0, outcome: "Missed", coverage: "None" }
    ]
  },
  {
    name: "Sim 10 - Multi-Event Diff TTPs",
    tactic: "Discovery",
    ttpIndices: [0, 1],
    events: [
      { name: "Ev1", ttpIdx: 0, outcome: "Alerted", coverage: "Optimal" },
      { name: "Ev2", ttpIdx: 1, outcome: "Logged", coverage: "Minimal" }
    ]
  }
];

test('should execute 10 diverse simulations and verify complex outcome/coverage configurations', async ({ page }) => {
  test.setTimeout(600000); // 10 minutes timeout

  for (const config of simulationConfigs) {
    await page.goto('/exercise');
    await page.waitForSelector('input[placeholder="e.g., APT29 Emulation"]');

    // --- Step 1: Scoping ---
    await page.getByPlaceholder('e.g., APT29 Emulation').fill(config.name);
    
    // Select Target Environment
    const envDropdown = page.locator('label:has-text("Target Environment") + div');
    await envDropdown.click({ force: true });
    await page.locator('button:has-text("Production")').click({ force: true });

    // Open TTP Selector Modal
    await page.getByText(config.tactic, { exact: true }).click({ force: true });
    await page.waitForSelector('button[title="Select Parent Technique"]');

    // Extract technique IDs mapping to indices
    const selectedTtpIds = [];
    for (const idx of config.ttpIndices) {
      const ttpId = (await page.locator('button[title="Select Parent Technique"] + div span').nth(2 * idx).textContent()).trim();
      selectedTtpIds.push(ttpId);
      
      // Select the TTP
      await page.locator('button[title="Select Parent Technique"]').nth(idx).click({ force: true });
    }
    
    await page.locator('button:has-text("Close")').click({ force: true });
    await page.locator('button:has-text("Next Step")').click({ force: true });

    // --- Step 2: Attack Chain Design ---
    await page.waitForSelector('.rich-markdown-editor .ql-editor');
    await page.locator('.rich-markdown-editor .ql-editor').first().fill('# Design\nTesting complex coverage.');
    await page.locator('button:has-text("Next Step")').click({ force: true });

    // --- Step 3: Execution & Logging ---
    await page.waitForSelector('button:has-text("+ Add Event")');

    for (let eventIdx = 0; eventIdx < config.events.length; eventIdx++) {
      const event = config.events[eventIdx];
      await page.locator('button:has-text("+ Add Event")').click({ force: true });
      
      // Fill inputs
      await page.getByPlaceholder('Payload Name').nth(eventIdx).fill(event.name);
      
      // Map TTP
      const mappedTtpId = selectedTtpIds[event.ttpIdx];
      const ttpDropdown = page.locator('label:has-text("Mapped TTPs")').nth(eventIdx).locator('..').locator('button.dropdown-button');
      await ttpDropdown.click({ force: true });
      await page.locator('.portal-dropdown-menu').getByText(mappedTtpId, { exact: true }).click({ force: true });
      await ttpDropdown.click({ force: true }); // Close dropdown

      // Select Outcome
      const actualDropdown = page.locator('label:has-text("Actual Outcome")').nth(eventIdx).locator('..').locator('button').first();
      await actualDropdown.click({ force: true });
      await page.locator('.portal-dropdown-menu button').filter({ hasText: event.outcome }).first().click({ force: true });

      // Handle Manual Coverage Rating Override (if different from default outcome rating)
      const defaultRatings = {
        'Prevented & Alerted': 'Optimal',
        'Prevented (No Alert)': 'Partial',
        'Alerted': 'Optimal',
        'Logged': 'Partial',
        'Missed': 'None'
      };
      if (event.coverage !== defaultRatings[event.outcome]) {
        const coverageDropdown = page.locator('label:has-text("Coverage Rating")').nth(eventIdx).locator('..').locator('button').first();
        await coverageDropdown.click({ force: true });
        await page.locator('.portal-dropdown-menu button').filter({ hasText: event.coverage }).first().click({ force: true });
      }
    }

    await page.locator('button:has-text("Next Step")').click({ force: true });

    // --- Step 4: Submit ---
    await page.waitForSelector('#executive-report');
    await page.locator('button:has-text("Submit")').click({ force: true });
    await page.waitForURL('**/reports');
    await page.waitForSelector('#historical-executive-report');
  }
});
```

---

## 5. Verification Method

To verify the logic and findings:
1. **Inspect Dropdown Filtering:** Open `src/components/dropdowns/CoverageRatingDropdown.jsx` and review lines 37-43. Check that the array of options returned matches the expected outcomes.
2. **Inspect Event Card Defaults:** Open `src/components/ui/EventCard.jsx` and review lines 151-167 to verify that changing the outcome updates the coverage rating to the exact defaults cited.
3. **Inspect Aggregation Logic:** Open `src/components/pages/ExerciseWizard.jsx` and review lines 307-350 to verify that the `getAggregatedScore` math correctly computes averages and assigns aggregated technique coverage ratings (Optimal, Partial, Minimal, None).
4. **Execution of play-testing:** Add the proposed test to the test folder and run it using the project's Playwright command:
   ```powershell
   npx playwright test tests/wizard-complex-coverage.spec.js
   ```
