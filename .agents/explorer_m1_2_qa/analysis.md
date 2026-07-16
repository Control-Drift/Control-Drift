# Iridescence UI Components and Rendering Logic Analysis

This report synthesizes findings from an in-depth read-only investigation of the **Dashboard**, **Campaign Launcher (ExerciseWizard)**, **Reports**, and **Gap Tracker** modules in the Iridescence application.

---

## 1. Context State and Rendering Data Calculations

### A. Dashboard (`Dashboard.jsx`)
The Dashboard serves as the central security posture console, subscribing to context variables via `useAppContext()`:
- **`exercises`**: Maps to `filteredExercises` to calculate:
  - **Global Resilience Score (GRS)**:
    $$\text{GRS} = \text{round}\left(\frac{\sum (\text{high} \times 1.0) + (\text{medium} \times 0.5)}{\text{totalValidated}} \times 100\right)$$
    *Note: `low` or `'na'` status receives 0 points, which penalizes the score.*
  - **Recent Activity**: Displays the 4 most recent exercises chronologically by slicing the `exercises` array.
- **`gaps`**: Maps to `filteredGaps` to calculate:
  - **Remediation Resolution Rate**: Percentage of resolved gaps over total gaps:
    $$\text{Resolution Rate} = \text{round}\left(\frac{\text{Resolved Gaps}}{\text{Total Gaps}} \times 100\right)$$
  - **Weighted Residual Risk**: Cumulative risk score based on open or in-progress gaps, weighted by severity:
    $$\text{Risk} = \sum (\text{Critical} \times 10) + (\text{High} \times 7) + (\text{Medium} \times 3) + (\text{Low} \times 1)$$
  - **Mean Time To Remediate (MTTR)**: Average time elapsed between `createdDate` and `resolvedDate` for resolved gaps.
- **`mitreData`**: Used for mapping techniques to their parent tactics and phases to populate the **Kill Chain Exposure** radar and status cards.

### B. Campaign Launcher (`ExerciseWizard.jsx`)
A 4-step wizard that manages internal component state alongside global context hooks:
- **Step 1 (Scoping)**: Populates `campaignDetails` (Name, Goals, Target Environment, and Participants). Selects TTPs from the MITRE framework. If AI settings are configured, it can stream prompt requests to map the objectives to STIX IDs.
- **Step 2 (Attack Chain Design)**: Generates execution playbooks using AI streaming. Allows manual markdown editing and script downloads.
- **Step 3 (Execution & Logging)**: Captures procedural events (test results). Users set expected vs. actual outcomes (`Prevented`, `Alerted`, `Logged`, `Missed`) and gap severities. Evidence screenshots can be uploaded and compressed as Base64.
- **Step 4 (Reporting & Submission)**: Provides a report preview and exports it to PDF via `ReportPDF`. Submission (`finishExercise`) pushes updates to the global context state (`exercises` and `gaps`) and saves the campaign summary.

### C. Campaign Reports (`Reports.jsx`)
- Groups exercises from `useAppContext()` by their campaign name into a local dictionary.
- Merges unmapped gaps into a pseudo-campaign named `"Manual Entry"` or associates them with legacy campaigns based on the gap's campaign name.
- Allows PDF exports and launches a manual campaign entry logger.

### D. Gap Tracker (`GapTracker.jsx` & `GapDetails.jsx`)
- Visualizes gaps in a Kanban board categorized by status (`Open`, `In Progress`, `Resolved`, `Risk Accepted`).
- Transitions gap statuses using HTML5 drag-and-drop.
- Details drawer (`GapDetails.jsx`) queries `campaignSummaries` to find the exact procedure name and logs corresponding technical execution details.

---

## 2. Identified Rendering Bugs, Logic Issues, and Vulnerabilities

We identified several critical rendering, logical, and crash-susceptible bugs:

### Bug 1: Missing PDF Export Data in Campaign Launcher
- **Location**: `src/components/ExerciseWizard.jsx` (Step 4, line 1633)
- **Problem**: When rendering `<ReportPDF>` for the Step 4 preview and PDF download, the component is missing key props:
  1. `testResults` is **completely omitted**.
  2. `participants` is **completely omitted**.
  3. `exercises` is passed `mappedExercises` (which is a transformed list containing `ttp`, `name`, `status`, `aggOutcome`, and `procedures`).
- **Impact**: In `ReportPDF.jsx`, if `testResults` is undefined, the component falls back to rendering using `exercises.map`. However, because `mappedExercises` is missing the `remediation` and `finding` fields, the fallback rendering displays `N/A` for all remediation notes, and the outcome column displays raw status text (`high`/`medium`/`low`) instead of actual outcomes. Furthermore, campaign participants are omitted from the PDF header.

### Bug 2: Severity-Status Posture Inversion for Unmapped Gaps
- **Location**: `src/components/Reports.jsx` (Line 41)
- **Problem**: When parsing unmapped/manual gaps to display as pseudo-exercises, the status is determined as follows:
  ```javascript
  status: (g.severity === 'Critical' || g.severity === 'High') ? 'high' : (g.severity === 'Medium' ? 'medium' : 'low')
  ```
- **Impact**: In the Iridescence posture model, `status: 'high'` represents **high coverage** (Prevented/Alerted), whereas `status: 'low'` represents a **coverage gap** (Missed). This mapping means that **Critical** or **High** severity gaps are counted under **Prevented** (High Coverage) in campaign reports, while **Low** severity gaps are counted under **Missed** (Coverage Gap). This completely inverts security posture metrics in the Reports module.

### Bug 3: Rendering Crash on Legacy Date Values
- **Location**: `src/components/Dashboard.jsx` (Lines 91-94)
- **Problem**: The historical trend score sorts and processes exercises by date:
  ```javascript
  const historicalScores = Object.values(campaignsByName).sort((a,b) => new Date(a.date) - new Date(b.date)).map(c => {
      const score = Math.round(((c.high + (c.medium * 0.5)) / c.total) * 100);
      return {
          name: new Date(c.date).toLocaleDateString('default', { month: 'short', day: 'numeric' }),
          score: score
      };
  });
  ```
- **Impact**: If an exercise lacks a `date` field (or has a null/undefined date), `new Date(undefined).toLocaleDateString()` throws `RangeError: Invalid time value`, crashing the entire Dashboard component. In addition, sorting by invalid dates returns `NaN`, breaking the trend chart ordering.

### Bug 4: Hardcoded Severity & Priority Score in Manual Gap Creation
- **Location**: `src/components/GapTracker.jsx` (Lines 242-243 & 526-588)
- **Problem**: The "Log Manual Gap" modal is completely missing inputs for **Severity** and **Priority Score**. When the form is submitted, the code hardcodes these values:
  ```javascript
  severity: 'High',
  priorityScore: 80,
  ```
- **Impact**: Users cannot designate manually created gaps as Critical, Medium, or Low severity. They are all unilaterally tracked as "High" severity with a priority score of 80.

### Bug 5: Reopened Gaps State Synchronization Leak
- **Location**: `src/components/GapTracker.jsx` (Line 157)
- **Problem**: When a user drags a gap card from `Resolved` back to `Open` or `In Progress`, `GapTracker.jsx` updates the gap object's status in `gaps` state, but **does not** revert or update the TTP's validation status in `exercises` or `mitreData` state.
- **Impact**: The Global Resilience Score and posture map continue to display the TTP as "Prevented" (High Coverage), even though the gap has been reopened and is actively being worked on.

### Bug 6: Crash Potential due to Missing `mitreData` Guard
- **Location**: `src/components/Dashboard.jsx` (Line 125)
- **Problem**: The tactic exposure calculation evaluates:
  ```javascript
  const tacticName = Object.keys(mitreData).find(t => mitreData[t].techniques.find(tech => tech.id === ex.ttp));
  ```
- **Impact**: If `mitreData` is `null` or `undefined` (which can happen on local storage corruption or STIX fetch failures), `Object.keys(mitreData)` will throw a `TypeError` and crash the Dashboard. Unlike the getTTPDetails helper, this line has no null check.

---

## 3. Simulated User Journeys & Local Storage Interactions

To inspect states and test flows, a QA engineer can interact with context states and local storage:

| Journey / Test Case | Input Action | Local Storage Key | expected Post-Condition |
| :--- | :--- | :--- | :--- |
| **1. Empty State Boot** | Clear all local storage. | N/A | Dashboard displays 0 resilience score; Reports and Gap Tracker show empty states. |
| **2. Draft Persistence** | Create campaign in wizard, enter name & objectives, click "Save Draft". | `'wizard_drafts'` | Draft object is stored in JSON format with current step and details. |
| **3. Draft Restore** | Open wizard, click "Load Draft", select draft. | `'wizard_drafts'` | Component state is successfully hydrated back into step inputs and TTP selections. |
| **4. Gap Auto-Resolution** | Log a gap for T1003. Execute and complete a campaign with T1003 as "Prevented". | `'exercises'`, `'gaps'` | Gap status transitions from `'Open'` to `'Resolved'` with system auto-resolution notes. |
| **5. Gap Validation Retest** | Drag gap from `In Progress` to `Resolved` in Kanban. | `'gaps'` | Validation Re-Test Modal opens. Submitting with outcome `high` resolves the gap and updates posture coverage. |
| **6. Risk Acceptance Bypass** | Drag gap from `In Progress` to `Risk Accepted`. | `'gaps'` | Risk Acceptance Modal requests authority & justification. Submitting transitions status to `'Risk Accepted'`. |

---

## 4. Key Recommendations for Implementation

1. **Fix ExerciseWizard PDF Props**: Update `PDFDownloadLink` in `ExerciseWizard.jsx` to pass `testResults={testResults}`, `participants={campaignDetails.participants.map(p => p.name).join(', ')}`, and map `exercises` correctly or avoid fallback.
2. **Correct Manual Posture Mapping**: Fix the status-severity mapping in `Reports.jsx` to reflect true posture mapping:
   - Gap Severity `'Critical'`/`'High'` $\rightarrow$ `status: 'low'` (Missed).
   - Gap Severity `'Medium'`/`'Low'` $\rightarrow$ `status: 'medium'` (Logged).
3. **Guard Dates**: Add guards in `Dashboard.jsx` when sorting and formatting dates:
   ```javascript
   const validDate = ex.date ? new Date(ex.date) : new Date();
   ```
4. **Expand Manual Gap Form**: Add select dropdowns for **Severity** and **Priority Score** inside the "Log Manual Gap" modal.
5. **Revert Status on Reopen**: Add a handler in `GapTracker.jsx` to downgrade the validation status in `exercises` state when a gap is dragged out of `Resolved`.
6. **Guard `mitreData` keys**: Add a null/undefined check before executing `Object.keys(mitreData)`.
