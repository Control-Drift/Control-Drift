# Playwright E2E Abuse-Testing Suite Specification

This document provides a comprehensive analysis of the validation enforcement and cascading metrics logic in the Eclipse Ops React application and designs a detailed Playwright test specification for the E2E abuse-testing suite.

---

## 1. Exercise Wizard Validation Enforcement & UI Boundaries

### 1.1 Step-by-Step Validation Analysis
In `src/components/ExerciseWizard.jsx`, navigation is controlled by the `step` state. Progress validation occurs inside `handleNext` (lines 392–436):

*   **Step 1: Scoping Step**
    *   **Simulation Name Validation**: Checks `!simulationDetails.name.trim()`. 
        *   *Warning Toast*: `"Please provide a Simulation Name before proceeding."` (type: `'warning'`).
        *   *Selector*: `input[placeholder="e.g., APT29 Emulation"]`.
    *   **Target Environment Validation**: Checks `!simulationDetails.environmentCategory || simulationDetails.environmentCategory.length === 0`.
        *   *Warning Toast*: `"Please select a Target Environment before proceeding."` (type: `'warning'`).
        *   *Selector*: `label:has-text("Target Environment") + div` (triggers the `InlineEnvironmentDropdown`).
    *   **TTP Selection Validation**: Checks `selectedTTPs.length === 0`.
        *   *Warning Toast*: `"Please select at least one MITRE TTP to proceed."` (type: `'warning'`).
        *   *Selector*: Interactive pipeline tactic node like `text=Initial Access` which opens the `TTPSelector` modal, then technique select buttons `button[title="Select Parent Technique"]`.

*   **Step 2: Attack Chain Design**
    *   No hard blockers on formatting. Rich editor is filled, but step transition is allowed even if blank or unstructured.

*   **Step 3: Execution & Logging Step**
    *   **Event Count Validation**: Checks `testResults.length === 0`.
        *   *Warning Toast*: `"Please add at least one event to proceed."` (type: `'warning'`).
        *   *Selector*: `button:has-text("+ Add Event")`.
    *   **Actual Outcome Documentation Validation**: Checks `!testResults.some(p => p.outcome && p.outcome !== 'N/A' && p.outcome !== 'Error')`.
        *   *Warning Toast*: `"Please document and select an outcome for at least one payload execution to proceed to reporting."` (type: `'warning'`).
        *   *Selector*: Dropdown trigger `label:has-text("Actual Outcome")` parent's locator select/button, followed by actual outcome options.
    *   **TTP Mapping Validation**: Checks `testResults.some(p => !p.ttps || p.ttps.length === 0)`.
        *   *Warning Toast*: `"Please map at least one TTP to every event."` (type: `'warning'`).
        *   *Selector*: Dropdown trigger `label:has-text("Mapped TTPs")` parent's locator `button.dropdown-button`, followed by options in `.portal-dropdown-menu`.
    *   **Missing Event Name Validation**: Checks `testResults.some(p => !p.name || p.name.trim() === '' || /^Event \d+$/.test(p.name.trim()))`.
        *   *Warning Toast*: `"1 or more events are missing a name."` (type: `'warning'`).
        *   *Selector*: `input[placeholder="Payload Name"]`.
        *   *Crucial Detail*: Default names matching the pattern `"Event <number>"` (e.g. `"Event 1"`, `"Event 12"`) are treated as missing/invalid and will block progress.

*   **Step 4: Reporting Step (Submission)**
    *   **Executive Summary Validation**: Evaluated inside `finishExercise` (line 671). Checks `!reportData.executiveSummary || reportData.executiveSummary.trim() === ''`.
        *   *Warning Toast*: `"Please write or auto-generate an Executive Summary before completing the simulation."` (type: `'warning'`).
        *   *Selector*: `button:has-text("Submit")`. The text area is `.rich-markdown-editor .ql-editor` under the active "Executive Summary" label (if toggled).

### 1.2 Abuse Opportunities
1.  **Skipping Steps**: Users cannot use the progress tabs to skip steps because they lack `onClick` handlers. However, users can try to bypass required fields using boundary input (whitespaces, empty Markdown lists, null values).
2.  **Duplicate Simulation Names**: The application does not block duplicate names. If a user submits a simulation with a name that matches an existing simulation, `saveSimulationSummary` in `useSimulationsData.js` merges or overwrites the existing entry (`nextSummary = { ...existingCamp, ...summary }`).
3.  **Duplicate Event Names**: The wizard allows multiple events in the same session to have the exact same name (e.g., two events named "Dump LSASS"), which is not validated.

---

## 2. Gap Tracker State Transitions & Cascading Metrics

### 2.1 Kanban Board Structures & Selectors
*   **Kanban Columns**: 
    *   Open column: `div` containing `<h3>Open <span ...>(Count)</span></h3>`
    *   In Progress column: `div` containing `<h3>In Progress <span ...>(Count)</span></h3>`
    *   Resolved column: `div` containing `<h3>Resolved <span ...>(Count)</span></h3>`
*   **Risk Accepted Section**: An expandable `<details>` element with a summary element having the class `risk-summary-hover` and text `"Risk Accepted Gaps"`.
*   **Gap Cards**: `div` draggable cards with `className="glass-panel hover-lift"`. Each card contains the `displayId` (e.g. `GAP-1234`), the associated simulation name, environment, and an `Accept Risk` button.
    *   *Card Selector*: `page.locator('.glass-panel', { hasText: 'GAP-XXXX' })`
    *   *Column Drop Target*: `page.locator('div.glass-panel', { has: page.locator('h3', { hasText: col }) })`

### 2.2 Cascading Posture Updates
State changes in the Gap Tracker trigger critical database and metric updates that cascade to other views:

1.  **Drop to 'Resolved' (Validation Modal Flow)**:
    *   Triggers the "Validate Remediation" modal overlay portal.
    *   *Form Selectors*:
        *   Validation Outcome Dropdown: `ValidationOutcomeDropdown` component. Click to open, select from portal `document.body` options using `.portal-dropdown-menu button:has-text("Prevented & Alerted")` or `"Alerted"`.
        *   Date Remediated: `input[type="datetime-local"]`
        *   Validation Notes: `textarea[placeholder*="Tested newly deployed Sigma rule"]`
        *   Submit Button: `button:has-text("Submit Validation")` (disabled if outcome or notes are empty).
    *   *Cascade Mechanics*:
        *   If the outcome is **optimal** (`'Prevented & Alerted'`, `'Prevented (No Alert)'`, `'Prevented'`, `'Alerted'`):
            *   The gap status moves to `'Resolved'`.
            *   Associated exercises update status to `'high'` (Optimal coverage) and coverageRating to the new value.
            *   The simulation's `testResults` procedure outcomes update to the validation outcome format: `Missed ➔ Prevented & Alerted ✓` (coverageRating becomes `'Optimal'`).
            *   Metrics on `/reports` and the Dashboard reflect this: **Optimal Coverage count increases**, and **No Coverage / Partial count decreases**.
        *   If the outcome is **non-optimal** (`'Logged'`, `'Missed'`):
            *   The gap is blocked from moving to Resolved and remains `In Progress` (or reverts).
            *   Warning toast fires: `"Gap remains In Progress. Optimal coverage (Prevented/Alerted) is required to resolve."`

2.  **Drop to 'Risk Accepted' (Risk Acceptance Flow)**:
    *   Triggers the "Accept Risk" modal overlay portal.
    *   *Form Selectors*:
        *   Approving Authority: `input[placeholder="e.g. CISO, Risk Committee"]`
        *   Risk Justification: `textarea[placeholder*="Provide business or technical rationale"]`
        *   Submit Button: `button:has-text("Accept Risk")`
    *   *Cascade Mechanics*:
        *   If submitted successfully:
            *   The gap status moves to `'Risk Accepted'`.
            *   Associated exercises set status to `'exception'` (Exception coverage).
            *   The associated procedure outcomes in `testResults` are set to `'Missed'` and coverageRating is set to `'None'`.
            *   Postures update on Dashboard/Reports: The TTP counts as an **exception** instead of active risk, modifying risk priority scores and reducing active gap queues.
        *   If fields are empty and submitted:
            *   Toast displays: `"Both Approving Authority and Justification are required."`

3.  **Revocation (Dragging back to Open or In Progress)**:
    *   *Resolved -> Open/In Progress*: Cascades back to reset the simulation test results to `'Missed'` and coverageRating to `'None'`. Associated exercise status is reset to `'low'`.
    *   *Risk Accepted -> Open/In Progress*: Prompts confirmation modal. Rationale and approving authority fields are cleared. Exercise status resets.

---

## 3. Existing Playwright Setup & Auth Injection

The E2E test suite utilizes a programmatically fetched SSO token. In the `beforeAll` block, the test calls the backend SSO endpoint:

```javascript
test.beforeAll(async ({ request }) => {
  const ssoResponse = await request.get('http://127.0.0.1:3001/auth/sso?role=admin');
  expect(ssoResponse.ok()).toBeTruthy();
  const ssoData = await ssoResponse.json();
  token = ssoData.token;
  role = ssoData.role;
});
```

Before each test, the token, role, and local database settings are injected using Playwright's `addInitScript`:

```javascript
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
```

---

## 4. Playwright Abuse E2E Test Specification (`tests/abuse-e2e.spec.js`)

Here is the exact design specification for `tests/abuse-e2e.spec.js` that the Implementer Worker must implement.

### Test Case 1: Wizard Progress Guardrails (Boundary Testing)
*   **Objective**: Verify that the wizard blocks incomplete, invalid, or default data at step transitions, maintaining strict step integrity.
*   **Step-by-Step Flow**:
    1.  Navigate to `/exercise`.
    2.  **Verify Step 1 block**: Click `Next Step` button immediately. Verify a Toast containing `"Please provide a Simulation Name before proceeding."` is displayed. Check that `step` remains `1` in session storage (or scoping fields are still active).
    3.  Fill in the Simulation Name: `"Playwright Wizard Abuse Test"`. Click `Next Step`. Verify Toast containing `"Please select a Target Environment before proceeding."` appears.
    4.  Select Target Environment: Click the dropdown trigger next to "Target Environment". Search and select `"Staging"`. Click `Next Step`. Verify Toast containing `"Please select at least one MITRE TTP to proceed."` appears.
    5.  Map TTP: Click tactic node `"Initial Access"`. Check first Technique (e.g. `T1566`). Close modal. Click `Next Step`. Proceed to Step 2.
    6.  **Step 2 (Attack Chain Design)**: Fill goals with dummy text. Click `Next Step`. Proceed to Step 3.
    7.  **Verify Step 3 block**: Click `Next Step` immediately. Verify Toast `"Please add at least one event to proceed."` is displayed.
    8.  Click `+ Add Event`. Do not fill the name (keep empty). Click `Next Step`. Verify Toast `"1 or more events are missing a name."` is displayed.
    9.  Fill the name as `"Event 1"` (the default name format). Fill out Red/Blue notes. Map a TTP and set outcome to `"Prevented"`. Click `Next Step`. Verify Toast `"1 or more events are missing a name."` is still displayed (default name pattern rejected).
    10. Change the name to `"Abuse Test Process Execution"`. Change outcome to `"N/A"`. Click `Next Step`. Verify Toast `"Please document and select an outcome for at least one payload execution to proceed to reporting."` is displayed.
    11. Change outcome to `"Logged"`. Clear mapped TTPs. Click `Next Step`. Verify Toast `"Please map at least one TTP to every event."` is displayed.
    12. Map a TTP. Change outcome to `"Logged"`. Click `Next Step`. Proceed to Step 4.
    13. **Verify Step 4 block**: Under Narrative Builder, clear the Executive Summary text area. Click `Submit`. Verify Toast `"Please write or auto-generate an Executive Summary before completing the simulation."` is displayed.
    14. Fill in Executive Summary and Submit. Verify redirection to `/reports`.

### Test Case 2: Duplicate Scenarios & Event Merging
*   **Objective**: Verify system tolerance for duplicate simulation names (triggers merge/overwrite) and duplicate event names (maps multiple events correctly).
*   **Step-by-Step Flow**:
    1.  Create a simulation named `"Duplicate Campaign A"` with Event 1: `"Dumping LSASS"` (outcome: `"Prevented"`) and TTP: `T1003.001`. Submit and verify it shows up on `/reports`.
    2.  Launch another simulation using the exact same name: `"Duplicate Campaign A"`. Add two events, both named `"Dumping LSASS"` (outcome: `"Missed"`). Map both to `T1003.001`.
    3.  Submit.
    4.  Verify on `/reports` and the backend database that `"Duplicate Campaign A"` has merged data (testResults contains multiple procedures under the same campaign).

### Test Case 3: Gap Tracker Risk Acceptance Cascade
*   **Objective**: Verify the risk acceptance flow, validation of CISO approval details, and posture status cascade to exceptions.
*   **Step-by-Step Flow**:
    1.  Locate an active open gap card on the Kanban board (e.g. created from the `"Logged"` or `"Missed"` results in Test 1).
    2.  Drag the card to the `"Risk Accepted"` section (or click `"Accept Risk"` directly on the card).
    3.  Verify the "Accept Risk" modal overlay is displayed.
    4.  Click `"Accept Risk"` inside the modal without filling out the inputs. Verify a Toast warning `"Both Approving Authority and Justification are required."` is displayed.
    5.  Fill Approving Authority: `"CISO Security Committee"`. Fill Justification: `"Accepted due to legacy system incompatibility with the EDR agent."`. Click `"Accept Risk"`.
    6.  Verify the card now resides in the `"Risk Accepted"` list.
    7.  Navigate to `/reports`. Verify that the TTP is marked with status `'exception'` and is not categorized as active risk.

### Test Case 4: Gap Tracker Resolution & Validation Blockers
*   **Objective**: Verify that resolving a gap requires a verified optimal validation outcome, and that resolving cascades to optimal posture metrics.
*   **Step-by-Step Flow**:
    1.  Locate an active open gap card on the Kanban board.
    2.  Drag it to the `"Resolved"` column.
    3.  Verify the "Validate Remediation" modal overlay opens.
    4.  **Verify Non-Optimal validation block**: In the Outcome dropdown, select `"Logged"` (non-optimal). Fill in Validation Notes. Click `"Submit Validation"`.
    5.  Verify the gap does NOT move to Resolved and remains in In Progress/Open. Verify Toast `"Gap remains In Progress. Optimal coverage (Prevented/Alerted) is required to resolve."` is displayed.
    6.  Drag the card to `"Resolved"` again.
    7.  **Verify Optimal validation resolution**: Select `"Prevented & Alerted"` (optimal). Fill in Validation Notes: `"Verified new detection rule works in Splunk."`. Submit.
    8.  Verify the card successfully moves to the `"Resolved"` column.
    9.  Verify Toast `"Gap Resolved successfully."` appears.
    10. Navigate to `/reports` and the Dashboard. Verify the global metric counters update: **Optimal Coverage count increases by 1**, and the corresponding gap's status cascades to **Resolved** across the metrics.

### Test Case 5: Revoking Resolution & Risk Acceptance
*   **Objective**: Verify that pulling cards back from Resolved/Risk Accepted resets state and telemetry metrics.
*   **Step-by-Step Flow**:
    1.  Drag the Resolved gap card back to the `"In Progress"` column.
    2.  Verify that on `/reports` and the database, the simulation outcome reverts back to `'Missed'`/`'None'` and the exercise status resets to `'low'`.
    3.  Drag the Risk Accepted gap card back to the `"In Progress"` column. Confirm the dialog warning that risk justification logs will be cleared.
    4.  Verify the risk authority and justification details are cleared on the card details.
