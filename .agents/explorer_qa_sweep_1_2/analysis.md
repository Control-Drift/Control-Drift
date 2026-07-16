# Eclipse Ops React App - Playwright E2E Abuse-Testing Suite Specification

This document provides a comprehensive analysis and design specification for the Playwright E2E abuse-testing suite (`tests/abuse-e2e.spec.js`). It details potential vectors for user input abuse, business logic bypasses, and metrics-tampering vulnerability states, and outlines the exact tests, selectors, and assertion logic required for implementation.

---

## 1. Project Scope & Architecture Reference
Based on `.agents/orchestrator_qa_sweep_1/PROJECT.md` and codebase analysis:
*   **Frontend**: React (Vite-based) using context state (`AppContext.jsx`) and local hooks.
*   **State Syncing**: Standard browser `localStorage` and `sessionStorage` are utilized.
*   **Authentication**: SSO token injection (`token` and `roles`).
*   **Database Config**: Configured via `db_config` in `localStorage`.
*   **MITRE Data Cache**: Injected into `localStorage` as `mitre_data_v2` to avoid external API calls.

---

## 2. Exercise Wizard Validation & Abuse Vectors
(`src/components/ExerciseWizard.jsx` & `src/AppContext.jsx`)

### Validation Rules and UI Boundaries
*   **Step 1: Scoping**
    *   **Simulation Name Input**: Selector `input[placeholder="e.g., APT29 Emulation"]`. Validation: Must not be blank. If blank, triggers Toast: `"Please provide a Simulation Name before proceeding."`
    *   **Target Environment Dropdown**: Selector `label:has-text("Target Environment") + div` (triggers `InlineEnvironmentDropdown`). Validation: Must select at least one environment. If empty, triggers Toast: `"Please select a Target Environment before proceeding."`
    *   **MITRE TTP Selection**: Interactive nodes selected by clicking tactics (e.g., `text=Initial Access`). Validation: Must select at least one TTP. If empty, triggers Toast: `"Please select at least one MITRE TTP to proceed."`
*   **Step 3: Execution & Logging**
    *   **Event Count**: Must have at least 1 event. If 0, triggers Toast: `"Please add at least one event to proceed."`
    *   **Event Name Input**: Selector `input[placeholder="Payload Name"]` or `input[placeholder="Procedure Name"]`. Validation: Must be non-blank and must NOT match the default pattern `/^Event \d+$/` (e.g., `"Event 1"` is rejected). If invalid, triggers Toast: `"1 or more events are missing a name."`
    *   **Mapped TTPs**: Dropdown selector `label:has-text("Mapped TTPs")` sibling. Validation: Every event must have at least one mapped TTP. If unmapped, triggers Toast: `"Please map at least one TTP to every event."`
    *   **Actual Outcome Dropdown**: Selector `label:has-text("Actual Outcome")` sibling. Validation: At least one event must have a valid actual outcome (not `'N/A'` or `'Error'`). If not, triggers Toast: `"Please document and select an outcome for at least one payload execution to proceed to reporting."`

### Identified Abuse Vectors & Flaws
1.  **Wizard Step Bypassing (State Injection)**:
    *   The wizard initializes its active step from `sessionStorage.getItem('wizard_step')` (lines 194-246).
    *   *Abuse Vector*: A user or script can bypass all Step 1 and Step 2 validation requirements by injecting `sessionStorage.setItem('wizard_step', 4)` and reloading the page, which directly exposes the Report/Submit view (Step 4).
2.  **Duplicate Campaign/Simulation Names (State Collisions)**:
    *   In `useExerciseActions.js` (line 44), exercises are matched using `ex.simulation === simulationName`.
    *   *Abuse Vector*: Submitting two separate simulations with the exact same name causes exercises/results to overwrite or merge into each other, creating corrupted data states.
3.  **Duplicate Event Names (Validation Desync)**:
    *   In `useExerciseActions.js` (line 120), when updating exercise validation, the system searches for procedures using: `proc = simulationData.testResults.find(p => p.name === procName);`.
    *   *Abuse Vector*: If a user creates two events with the same name in the same simulation, `find()` will always match and update the first event, leaving the second event unvalidated/desynced.
4.  **Special Characters & HTML Injection**:
    *   Simulation names, goals, and event names do not appear to sanitize input against HTML/script tags, presenting a potential persistent XSS risk in the generated reports.

---

## 3. Gap Tracker, Details Drawer, & Metrics Cascade
(`src/components/GapTracker.jsx`, `src/components/GapDetails.jsx`, `src/components/Dashboard.jsx`)

### State Cascade Mechanism
*   **Active Gaps**: Gaps in `Open` or `In Progress` status.
*   **GRS (Global Readiness Score) Calculation**:
    *   Calculated as `points / totalValidated * 100`.
    *   Any TTP associated with an *active gap* is added to `processedTTPs` but receives **0 points**, dragging the GRS score down.
    *   If a gap is resolved, it is no longer active. Its TTP status in MITRE is updated to `high` (re-evaluated in `updateExerciseValidation`), earning **1.0 point**, which increases the GRS.
    *   If a gap is marked as `Risk Accepted`, it is no longer an active gap. It stops penalizing GRS with 0 points. GRS reverts to whatever points the under-remediation TTP status originally earned (e.g. 0.5 points for Partial).
*   **Resolution Rate Calculation**:
    *   Calculated as `closedGaps / totalGaps * 100` where:
        *   `totalGaps` = all gaps with `status !== 'Risk Accepted'`.
        *   `closedGaps` = all gaps with `status === 'Resolved'`.
*   **Weighted Residual Risk Calculation**:
    *   Calculated as `sum(severityWeights[g.severity])` for all active gaps. Gaps marked `Resolved` or `Risk Accepted` contribute 0 to this risk score.

### Identified Abuse Vectors & Metrics Inflation
1.  **Risk Acceptance Metrics Inflation (Gaming the System)**:
    *   *Abuse Vector*: Since `Risk Accepted` gaps are completely removed from both the numerator and denominator of `resolutionRate`, a user can artificially inflate their "Remediation Resolution Rate" to **100%** and reduce "Weighted Residual Risk" to **0** by simply marking all unresolved/open gaps as `Risk Accepted`.
2.  **Validation Bypass (Standalone Validation Drawer)**:
    *   When transitioning a gap to `Resolved`, `GapDetails.jsx` opens a Validation Modal.
    *   *Abuse Vector*: The Submit button is only disabled if `validationOutcome` is empty or `validationNotes` is empty/whitespace. A user can bypass actual technical validation by typing single letters or spaces, and selecting `"Prevented & Alerted"` to force a status transition to `Resolved` and artificially raise the GRS score.

---

## 4. Playwright E2E Setup & Token Injection
Based on `tests/wizard-e2e.spec.js`, E2E tests should utilize the following hook setup to inject admin authentication, local database settings, and preload the local MITRE STIX cache:

```javascript
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Pre-parse the local MITRE STIX cache to feed to local storage
let mitreOutput = null;
try {
  const cachePath = path.resolve(process.cwd(), 'mitre_stix_cache.json');
  if (fs.existsSync(cachePath)) {
    const rawData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    // (Parsing logic matches tests/wizard-e2e.spec.js...)
    // ...
  }
} catch (e) {
  console.error('Failed to parse local MITRE cache:', e);
}

test.describe('E2E Abuse and Cascade Testing Suite', () => {
  let token = null;
  let role = null;

  test.beforeAll(async ({ request }) => {
    // Obtain SSO Auth Token (Admin Role)
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
  
  // (Tests defined below...)
});
```

---

## 5. Detailed Test Plan for `tests/abuse-e2e.spec.js`

### Test 1: Exercise Wizard Client-Side Scoping Validation and Step Bypassing
*   **Objective**: Verify that Step 1 scoping fields block progression when invalid, and that session-state manipulation allows bypassing scoping validations.
*   **Steps**:
    1.  Navigate to `/exercise`.
    2.  Wait for page load. Click "Next Step" immediately.
    3.  Assert Toast appears with text: `"Please provide a Simulation Name before proceeding."`
    4.  Fill in Simulation Name `input[placeholder="e.g., APT29 Emulation"]` with `"Abuse Test Name"`. Click "Next Step".
    5.  Assert Toast appears with text: `"Please select a Target Environment before proceeding."`
    6.  Locate `label:has-text("Target Environment") + div` and select `"Staging"`. Click "Next Step".
    7.  Assert Toast appears with text: `"Please select at least one MITRE TTP to proceed."`
    8.  Execute a state bypass using `page.evaluate()` to manipulate sessionStorage:
        ```javascript
        await page.evaluate(() => {
          sessionStorage.setItem('wizard_step', '4');
        });
        ```
    9.  Reload page: `await page.reload();`
    10. Verify that Step 4 (Reporting) is displayed directly (bypassing validation checks).

### Test 2: Exercise Wizard Event Validation Abuse (Step 3)
*   **Objective**: Test boundary constraints on event creation in Step 3, specifically verifying that empty names, default naming patterns, unmapped TTPs, and missing outcomes block campaign completion.
*   **Steps**:
    1.  Navigate to `/exercise`.
    2.  Click "Auto-Fill Scenario" button (`button:has-text("Auto-Fill Scenario")`).
    3.  Select first scenario (`"APT29 Ransomware Emulation"`) to populate Step 1 and 2.
    4.  Click "Next Step" twice to reach Step 3 (Execution).
    5.  Assert event cards exist. Locate and click `"Remove Event"` (`button[title="Remove Event"]`) on all pre-populated events. Confirm each deletion dialog via `page.click('button:has-text("Confirm")')`.
    6.  With 0 events remaining, click "Next Step". Assert Toast warning: `"Please add at least one event to proceed."`
    7.  Click `"+ Add Event"` (`button:has-text("+ Add Event")`).
    8.  Leave name empty, select Mapped TTP, select Actual Outcome. Click "Next Step". Assert Toast warning: `"1 or more events are missing a name."`
    9.  Fill in Name as `"Event 1"`. Click "Next Step". Assert Toast warning: `"1 or more events are missing a name."` (default naming pattern block).
    10. Change Name to `"Malicious Activity Event"`. Remove Mapped TTP. Click "Next Step". Assert Toast warning: `"Please map at least one TTP to every event."`
    11. Select a TTP. Change Actual Outcome to `N/A`. Click "Next Step". Assert Toast warning: `"Please document and select an outcome for at least one payload execution to proceed to reporting."`

### Test 3: Exercise Wizard Duplicate Event Names State Collision
*   **Objective**: Demonstrate that duplicate event names cause validation state desync due to simple `find()` matching.
*   **Steps**:
    1.  Navigate to `/exercise`, use "Auto-Fill Scenario" to populate steps 1 and 2, proceed to Step 3.
    2.  Delete all existing events.
    3.  Click `"+ Add Event"` twice to create two events.
    4.  Name both events exactly `"Duplicate Event"`.
    5.  Map TTP 1 to Event 1, and TTP 2 to Event 2.
    6.  Set Event 1 outcome to `"Missed"` and Event 2 outcome to `"Missed"`.
    7.  Proceed to Step 4, click `"Submit"`.
    8.  Go to Gap Tracker page (`/gaps`).
    9.  Locate the card for the second TTP. Click to open `GapDetails` drawer.
    10. Attempt to resolve/validate the gap. Change status to `"Resolved"`.
    11. Fill out validation form with outcome `"Prevented & Alerted"`. Submit.
    12. Observe which event gets updated in the background. The system will find and update the *first* `"Duplicate Event"` in the simulation test results, causing the second event to remain unvalidated despite the UI showing validation success.

### Test 4: Gap Tracker Risk Acceptance Metrics Inflation Abuse
*   **Objective**: Verify the cascade of `Risk Accepted` status to the global Dashboard and demonstrate that accepting risk on all open gaps inflates the Resolution Rate to 100% and reduces Residual Risk to 0.
*   **Steps**:
    1.  Navigate to Dashboard `/`. Wait for charts to load.
    2.  Scrape/record initial baseline metrics:
        *   Global Readiness Score: `page.locator('circle + div span').first()`
        *   Resolution Rate: `page.locator('h3:has-text("Resolution Rate") + div')`
        *   Residual Risk: `page.locator('h3:has-text("Residual Risk") + div > div').first()`
    3.  Navigate to `/gaps`. Ensure there are multiple gaps in `"Open"` or `"In Progress"` status.
    4.  Open the details drawer for an Open gap.
    5.  In the status dropdown, select `"Risk Accepted"`.
    6.  In the Risk Acceptance modal, click `"Accept Risk"` immediately (without filling form).
    7.  Assert Toast appears: `"Both Approving Authority and Justification are required."`
    8.  Fill `"CISO"` into the Approving Authority input `input[placeholder="e.g. CISO, Risk Committee"]` and `"Bypassed for legacy system"` into the justification textarea. Click `"Accept Risk"`.
    9.  Close the drawer. Repeat this for ALL remaining open/in-progress gaps.
    10. Navigate back to `/`.
    11. Verify that:
        *   **Remediation Resolution Rate** is now **100%**.
        *   **Weighted Residual Risk** is now **0**.
        *   **Global Readiness Score** has increased (active gap penalty removed).

### Test 5: Gap Details Validation and Status Cascade
*   **Objective**: Verify that only optimal outcomes are selectable in the validation modal, and that submitting validation cascades to GRS score and MTTR metrics.
*   **Steps**:
    1.  Navigate to `/gaps`.
    2.  Select an open gap card to open the details drawer.
    3.  Change status to `"Resolved"` to open the Validation Re-Test Modal.
    4.  Assert the validation submit button `button:has-text("Submit Validation")` is disabled.
    5.  Type validation notes: `"Verified new Sigma rule"` into `textarea[placeholder*="Tested newly deployed"]`.
    6.  Select `"Prevented & Alerted"` from the outcome dropdown.
    7.  Assert the submit button is now enabled. Click `"Submit Validation"`.
    8.  Assert Toast appears: `"Gap Resolved successfully."`
    9.  Verify the gap card is moved to the `"Resolved"` column on the Kanban board.
    10. Verify that MTTR (Mean Time to Remediate) widget on the Gap Tracker page updates to reflect a valid duration.
    11. Navigate to `/` and assert that the GRS score circle has increased.
