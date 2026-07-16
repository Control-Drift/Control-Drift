# Playwright E2E Abuse-Testing Suite - Test Design & Specification

This analysis report provides a comprehensive review of validations, error handling, state transitions, and metric cascades within the Eclipse Ops React application. It outlines a detailed E2E Playwright test specification for implementing destructive and boundary test scenarios under `tests/abuse-e2e.spec.js`.

---

## 1. Project Scope & Architecture Summary
* **Frontend**: Vite + React, styled using tailwind/CSS modules with custom glassmorphism panels.
* **State Management**: React Context (`src/AppContext.jsx`) using entity hooks (`useExercisesData`, `useGapsData`, `useSimulationsData`, `useExerciseActions`).
* **Database Connections**: Supports local storage or REST API backend syncing. For E2E testing, browser state is initialized programmatically with SSO auth tokens and localized MITRE STIX JSON payloads.
* **Testing Objective**: Establish a robust suite of Playwright test cases that abuse input fields, attempt wizard step-skipping, trigger form errors, and verify the correct propagation of security gap states and metrics to the reports and dashboard.

---

## 2. Exercise Wizard Validation Analysis (`src/components/ExerciseWizard.jsx`)

The Exercise Wizard is a multi-step workflow. Here is the step structure, required fields, and validation boundaries:

### Step-by-Step Validation Rules

| Step | Phase Name | Enforced Fields & Validations | UI Selector | Exact Error Toast Message |
|---|---|---|---|---|
| **Step 1** | Scoping | **Simulation Name**: Must not be empty. | `input[placeholder="e.g., APT29 Emulation"]` | `"Please provide a Simulation Name before proceeding."` |
| | | **Target Environment**: Must have at least 1 category selected. | `label:has-text("Target Environment") + div` | `"Please select a Target Environment before proceeding."` |
| | | **MITRE TTPs**: Must select at least 1 TTP from map nodes. | `.ttp-node` inside tactics grid | `"Please select at least one MITRE TTP to proceed."` |
| **Step 2** | Attack Chain Design | No hard validations. | `.rich-markdown-editor` editor area | None |
| **Step 3** | Execution & Logging | **Procedure Count**: Must have at least 1 event added. | `button:has-text("+ Add Event")` | `"Please add at least one event to proceed."` |
| | | **Actual Outcome**: Must have at least 1 actual outcome not set to `N/A` or `Error`. | `label:has-text("Actual Outcome") + div button` | `"Please document and select an outcome for at least one payload execution to proceed to reporting."` |
| | | **Mapped TTPs**: Every event must have at least 1 TTP mapped. | `label:has-text("Mapped TTPs") + div button` | `"Please map at least one TTP to every event."` |
| | | **Event Names**: Must not be empty, and must not match `/^Event \d+$/` (default titles like "Event 1", "Event 2" are rejected). | `input[placeholder="Payload Name"]` | `"1 or more events are missing a name."` |
| **Step 4** | Reporting | **Executive Summary**: Must not be empty. | `.rich-markdown-editor` (for summary) | `"Please write or auto-generate an Executive Summary before completing the simulation."` |

### Validation Abuse & Vulnerabilities Identified
1. **Step-Skipping (SessionStorage Hijacking)**: 
   The component initializes step state on mount from `sessionStorage.getItem('wizard_step')` without verifying whether previous step validations were satisfied. An attacker or E2E script can inject `sessionStorage.setItem('wizard_step', 4)` and refresh, bypassing scoping and execution validations. When submitting, it defaults the simulation name to `"Ad-hoc Simulation"` and proceeds, potentially creating a corrupted state in the database.
2. **Duplicate Campaign/Simulation Names**: 
   There is no uniqueness check for simulation names. Submitting a new simulation with an existing campaign name merges and overwrites the previous simulation's outcomes and exercises (via `saveSimulationSummary` in `useSimulationsData.js`), which breaks historic audit integrity.
3. **Duplicate Event Names**: 
   Within Step 3, multiple events can have identical names. If multiple events share a name, the `updateExerciseValidation` action will update outcomes for both, targeting the same exercise record since queries match on `finding === procName`.
4. **TTP Selector Modal Flow**: 
   Tactic categories are mapped as grid nodes (e.g. `text=Initial Access`). Clicking a node opens a nested sub-pane containing TTP check boxes. Sub-techniques are hidden inside slide-out sub-panes.

---

## 3. Gap Tracker State Cascades & Metrics (`src/components/GapTracker.jsx`)

The Security Gaps backlog is displayed as a Kanban board (Open, In Progress, Resolved) with a separate collapsible drawer for "Risk Accepted" gaps. 

### Gap Status Cascade Logic
* **Resolving a Gap**: Resolving a gap requires inputting a validation outcome (e.g., `Prevented & Alerted`) and validation notes.
  * If validation outcome is **Optimal** (`Prevented & Alerted`, `Prevented`, `Alerted`, `Prevented (No Alert)`):
    * The associated gap status transitions to `'Resolved'`.
    * The corresponding exercise status is set to `'high'`.
    * The overall Organization Readiness Score (GRS) increases.
  * If validation outcome is **Non-Optimal** (`Logged`, `Missed`):
    * The gap status remains `In Progress`.
    * The exercise status is set to `'medium'` or `'low'`.
    * The GRS score does not increase, and the gap remains active.
* **Risk Accepted Gaps**: Dragging a gap to `Risk Accepted` opens a modal that enforces:
  * **Approving Authority**: `input[placeholder="e.g. CISO, Risk Committee"]`
  * **Justification**: `textarea[placeholder="Provide business or technical rationale for accepting this gap..."]`
  * *Abuse behavior*: Attempting to save without these fields triggers: `"Both Approving Authority and Justification are required."`
  * Transitioning to `Risk Accepted` clears it from the active backlog. It reduces `Active Gaps` count and decreases `Weighted Residual Risk`.

### Metric Calculations & Selectors

| Metric | Core Calculation Logic | Selector (Reports Page) | Selector (Dashboard) |
|---|---|---|---|
| **Tested TTPs** | Count of unique TTP IDs validated in exercises. | `div:has-text("Total Validated") div` | `div:has(div:text("Tested TTPs")) div.font-mono` |
| **Optimal / Blocked** | Exercises with `status === 'high'`. | `div:has-text("Optimal Coverage") div` | Computed via GRS / Radar |
| **Partial / Logged** | Exercises with `status === 'medium'` or `'minimal'`. | `div:has-text("Partial Coverage") div` | Computed via Radar |
| **No Coverage / Missed** | Exercises with `status === 'low'`. | `div:has-text("No Coverage") div` | Computed via Radar |
| **Active Gaps** | Count of Gaps where `status` is `'Open'` or `'In Progress'`. | `div:has-text("Open") div` / `div:has-text("In-Progress") div` | `div:has(div:text("Active Gaps")) div.font-mono` |
| **Weighted Residual Risk** | Sum of open gaps weighted by severity: Critical = 10, High = 7, Medium = 3, Low = 1. | N/A | `div:has(h3:has-text("Weighted Residual Risk")) div.font-extrabold` |
| **Resolution Rate** | `(Closed Gaps / (Total Gaps - Risk Accepted Gaps)) * 100` | N/A | `div:has(h3:has-text("Remediation Resolution Rate")) div.font-extrabold` |

---

## 4. Auth & State Injection Setup (from `wizard-e2e.spec.js`)

To simulate test runs without dependency on external endpoints:
1. **SSO Auth Token Injection**:
   Fetch token before tests:
   ```javascript
   const ssoResponse = await request.get('http://127.0.0.1:3001/auth/sso?role=admin');
   const ssoData = await ssoResponse.json();
   const { token, role } = ssoData;
   ```
2. **Browser State Setup**:
   Inject token, roles, database config, and pre-seeded MITRE cache via local storage in `page.addInitScript`:
   ```javascript
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
   }, { token, role, mitreData });
   ```

---

## 5. Playwright Test Specification: `tests/abuse-e2e.spec.js`

Here is the exact test suite specification to be implemented by the implementer worker.

### Test Configuration
* **File Location**: `tests/abuse-e2e.spec.js`
* **Execution Mode**: Runs against Vite dev server at `http://localhost:5173` (or configured dev server base URL).
* **Setup**: SSO admin auth token fetched and local storage injected in `beforeEach`. Parses tactic/techniques from `mitre_stix_cache.json` if available to populate local storage.

---

### Test Case 1: Scoping Step Validations & Toast Checks
* **Objective**: Verify that form submission is blocked and toast alerts are triggered for missing scoping fields in Step 1.
* **Pre-conditions**: Navigated to `/exercise`.
* **Execution Steps**:
  1. Click `button:has-text("Next Step")` immediately.
  2. Verify toast message `Please provide a Simulation Name before proceeding.` is visible and has a warning/danger icon.
  3. Fill the campaign name input `input[placeholder="e.g., APT29 Emulation"]` with `Abuse Campaign Alpha`.
  4. Click `button:has-text("Next Step")`.
  5. Verify toast message `Please select a Target Environment before proceeding.` is visible.
  6. Click target environment dropdown `label:has-text("Target Environment") + div`. Type `Corporate Net` in search and select `Create "Corporate Net"` (or select a pre-existing option like "Staging").
  7. Click `button:has-text("Next Step")`.
  8. Verify toast message `Please select at least one MITRE TTP to proceed.` is visible.
  9. Open TTP modal: Click tactic node `text=Initial Access` (or other tactic name).
  10. Select the first technique's parent checkbox `button[title="Select Parent Technique"]` (index 0).
  11. Click `button:has-text("Close")` to close the modal.
  12. Click `button:has-text("Next Step")`.
  13. Verify step advances to Step 2 (URL path/session state contains step 2, or goals editor is visible).

---

### Test Case 2: Execution Step Name Enforcements & Outcome Blocks
* **Objective**: Enforce strict validation on event naming conventions and required outcomes in Step 3.
* **Pre-conditions**: Scoping step completed with name `Abuse Campaign Beta`, target environment set, and TTP selected. Advanced to Step 3.
* **Execution Steps**:
  1. Click `button:has-text("Next Step")` immediately.
  2. Verify toast message `Please add at least one event to proceed.` is visible.
  3. Click `button:has-text("+ Add Event")`.
  4. Click `button:has-text("Next Step")`.
  5. Verify toast message `1 or more events are missing a name.` is visible.
  6. Locate the Event Name input (e.g. `input[placeholder="Payload Name"]`). Type `Event 1`.
  7. Click `button:has-text("Next Step")`.
  8. Verify toast message `1 or more events are missing a name.` is visible (confirming that regex `/^Event \d+$/` blocks default names).
  9. Edit the Event Name input to `Malicious DLL Side-load`.
  10. Click `button:has-text("Next Step")`.
  11. Verify toast message `Please map at least one TTP to every event.` is visible.
  12. Open the event TTP dropdown. Select the TTP ID mapped in Step 1. Close the dropdown.
  13. Click `button:has-text("Next Step")`.
  14. Verify toast message `Please document and select an outcome for at least one payload execution to proceed to reporting.` is visible.
  15. Open the event's "Actual Outcome" dropdown. Select `Missed`.
  16. Click `button:has-text("Next Step")`.
  17. Verify it successfully advances to Step 4 (Report preview page).

---

### Test Case 3: SessionStorage Step Skipping Abuse
* **Objective**: Verify that bypassing the scoping step via `sessionStorage` manipulation is either blocked or handled gracefully when completing a report.
* **Pre-conditions**: Authenticated, navigated to `/exercise`.
* **Execution Steps**:
  1. Run `sessionStorage.setItem('wizard_step', '4')` via browser execution.
  2. Reload the page. Verify the wizard loads Step 4 (Reporting/Submit) directly.
  3. Click `button:has-text("Submit")` without scoping parameters.
  4. Verify toast message `Please write or auto-generate an Executive Summary before completing the simulation.` is triggered.
  5. Fill in a mock executive summary inside the editor.
  6. Click `button:has-text("Submit")`.
  7. Verify redirection to `/reports` and ensure the simulation is saved with a fallback campaign name like `"Ad-hoc Simulation"` without crashing the app.

---

### Test Case 4: Duplicate Campaign Overwrite Abuse
* **Objective**: Verify how the system handles name collisions when submitting multiple campaigns with duplicate names.
* **Pre-conditions**: Completed a simulation campaign named `Campaign Overwrite Test` with TTP `T1566.001` and outcome `Prevented`.
* **Execution Steps**:
  1. Launch a new simulation. Set campaign name to `Campaign Overwrite Test`.
  2. Map a different TTP (e.g., `T1059.001`). Set outcome to `Missed`.
  3. Advance to Step 4 and submit the report.
  4. Navigate to `/reports` and select `Campaign Overwrite Test`.
  5. Verify if the report contains both TTPs (T1566.001 and T1059.001) merged under the same campaign or if it overwrote the previous one. Ensure the metrics reflect the correct state (e.g. 1 optimal, 1 missed).

---

### Test Case 5: Gap Resolution and Acceptance Cascade
* **Objective**: Verify that gap lifecycle transitions (resolved, risk accepted) update GRS and dashboard risk metrics correctly.
* **Pre-conditions**: Completed a simulation that creates two open gaps:
  * Gap A (TTP `T1566.001` - Critical Severity, Missed outcome).
  * Gap B (TTP `T1059.001` - Medium Severity, Logged outcome).
* **Execution Steps**:
  1. Navigate to `/` (Dashboard). Record starting metrics:
     * `Tested TTPs` = 2.
     * `Active Gaps` = 2.
     * `Weighted Residual Risk` = 13 (Critical = 10, Medium = 3).
  2. Navigate to `/gaps`. Find the Kanban board.
  3. **Risk Acceptance**:
     * Drag Gap B card to the `Risk Accepted` drop-zone (or trigger status dropdown selection to "Risk Accepted").
     * Attempt to submit the risk modal empty. Assert toast: `Both Approving Authority and Justification are required.`
     * Fill justification with `Compensating control active` and authority with `CISO`. Save.
     * Verify Gap B moves to `Risk Accepted` backlog.
     * Go to Dashboard (`/`). Assert metrics:
       * `Active Gaps` = 1.
       * `Weighted Residual Risk` = 10 (only Critical Gap A is active).
  4. **Gap Resolution Validation**:
     * Navigate to `/gaps`. Click Gap A card to open the Details drawer.
     * Click the Status dropdown, select `Resolved`. The validation modal opens.
     * Attempt to submit validation with empty notes. Verify the Submit button is disabled.
     * Select outcome `Logged` (non-optimal) and fill in notes. Click `Submit Validation`.
     * Verify toast message: `Gap remains In Progress. Optimal coverage (Prevented/Alerted) is required to resolve.`
     * Verify Gap A status is still `In Progress`/`Open`.
     * Select `Resolved` again. Select outcome `Prevented & Alerted` (optimal), enter notes, and click `Submit Validation`.
     * Verify toast message: `Gap Resolved successfully.`
     * Verify Gap A status is now `Resolved`.
  5. Go to Dashboard (`/`). Assert metrics:
     * `Active Gaps` = 0.
     * `Weighted Residual Risk` = 0.
     * `Resolution Rate` = 100% (since Gap A is resolved and Gap B is risk-accepted).
     * GRS score reflects successful resolution.
