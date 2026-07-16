# Iridescence Metrics Stress-Testing & Bug Reproduction Guide

This guide provides the instructions and JavaScript snippets to inject the synthetic dataset (`synthetic_stress_data.json`) into the browser's local storage and step-by-step reproduction flows for each of the 17 identified bugs.

---

## 1. Database Injection Code Snippet

To load the generated high-volume synthetic dataset into the Iridescence application, copy and paste the following JavaScript code snippet into the browser's developer console (F12 -> Console) while on the application's page:

```javascript
(async () => {
  try {
    // 1. Fetch the synthetic data file from the root directory
    const response = await fetch('/synthetic_stress_data.json');
    if (!response.ok) {
      throw new Error(`Failed to fetch synthetic data: ${response.statusText}`);
    }
    const data = await response.json();
    
    // 2. Clear old state
    localStorage.removeItem('exercises');
    localStorage.removeItem('gaps');
    localStorage.removeItem('campaignSummaries');
    localStorage.removeItem('campaignEvidence');
    
    // 3. Inject synthetic dataset
    localStorage.setItem('exercises', JSON.stringify(data.exercises));
    localStorage.setItem('gaps', JSON.stringify(data.gaps));
    localStorage.setItem('campaignSummaries', JSON.stringify(data.campaignSummaries));
    localStorage.setItem('campaignEvidence', JSON.stringify(data.campaignEvidence));
    
    console.log("SUCCESS: Synthetic dataset successfully injected into Local Storage!");
    console.log(`- Loaded ${data.exercises.length} exercises`);
    console.log(`- Loaded ${data.gaps.length} security gaps`);
    console.log(`- Loaded ${Object.keys(data.campaignSummaries).length} campaign summaries`);
    
    // 4. Force reload page to hydrate context state
    window.location.reload();
  } catch (err) {
    console.error("ERROR injecting synthetic dataset:", err);
  }
})();
```

---

## 2. Metrics Engine Drift & Breakdown Analysis

Under the high volume of this synthetic dataset, the metrics engine experiences significant drift and crashes:

1. **Global Resilience Score (GRS) Drift (-7% Discrepancy)**
   - **Codebase Formula:** `68%`
   - **Correct Mathematical Formula:** `75%`
   - **Why it Drifts:** The codebase counts exercises with status `'na'` (Not Applicable) in the denominator (`filteredExercises.length`), but awards them `0.0` points. In the synthetic dataset, 5 out of 60 exercises are `'na'`. This penalizes the GRS, dragging it down by 7 percentage points.

2. **Mean Time to Remediate (MTTR) Breakdown (NaN UI Crash)**
   - **Codebase Formula:** `NaN`
   - **Correct Mathematical Formula:** `1d 18h` (or ~1.75 days)
   - **Why it Breaks:** We injected a single resolved gap (Gap ID 99) with an invalid `resolvedDate` value (`"invalid-date"`). When the codebase calculates `new Date(g.resolvedDate) - new Date(g.createdDate)`, it evaluates to `NaN`. This `NaN` propagates through the reduction sum, causing the entire MTTR display to show `NaN` or break, rather than safely filtering out or ignoring invalid date entries.

3. **Weighted Residual Risk (495 Active Risk Points)**
   - **Calculated Score:** `495`
   - **Active Gaps Count:** `60` (30 Open, 30 In Progress)
   - **Distribution:** Critical severity gaps (25 gaps × 10 pts = 250) + High severity gaps (35 gaps × 7 pts = 245) = `495`.
   - **Note:** In-progress and open gaps contribute to risk, while risk-accepted gaps (20 gaps) and resolved gaps (40 gaps) are excluded.

4. **TTP Roll-up Outcomes Mismatches**
   - **Threshold Drift (15% mismatch):** If a technique has procedure outcomes with an average score of `70%`:
     - **Campaign Launcher (ExerciseWizard):** Evaluates `avg >= 60` to `Alerted` (`high` status, green).
     - **Inline Validation (AppContext):** Evaluates `avg < 75` to `medium` status (yellow).
   - **Validated Outcome Match Failure:** The Campaign Launcher uses exact string matches (`p.outcome === 'Prevented'`). Validated outcomes (e.g. `'Prevented ✓ Validated'`) fail this check, resulting in `0` points, rolling up the TTP to a `low` status (Missed/red) in the wizard summary. The Inline Validation correctly uses `.startsWith()`, resolving this issue.

---

## 3. Step-by-Step Reproduction of the 17 Discovered Bugs

### Bug 1: TTP Exercise Loss on Refresh (Severe React State Bug)
- **Location:** `src/AppContext.jsx:234`
- **Symptom:** Sub-technique exercises (e.g. `T1059.001`) are lost from the heatmap and rollup upon page refresh.
- **Step-by-Step Reproduction:**
  1. Inject the synthetic dataset using the script.
  2. Navigate to the **Battle Globe** or **Dashboard** and look at the MITRE Heatmap.
  3. Observe that sub-techniques like `T1059.001` (PowerShell) and `T1059.003` are represented as gray (`'unknown'`).
  4. Inspect the code in `AppContext.jsx` line 234: `findIndex(t => t.id === ex.ttp || ex.ttp.startsWith(t.id + '.'))` returns the parent technique `T1059`'s index instead of the sub-technique's, overwriting it and causing it to be wiped out by rollup.

### Bug 2: Parent Technique Exercise Overwrite
- **Location:** `src/AppContext.jsx:5-62`
- **Symptom:** Direct exercises on parent techniques with sub-techniques are overwritten.
- **Step-by-Step Reproduction:**
  1. Complete a test on a parent technique (e.g. `T1059` directly) with status `'high'`.
  2. Observe that upon refresh, `recalculateMitreStatuses` overwrites `T1059`'s status to `'unknown'` because its sub-techniques are `'unknown'`.

### Bug 3: Discrepant Thresholds for TTP Outcome Rollup
- **Location:** `src/components/ExerciseWizard.jsx:458` vs `src/AppContext.jsx:417`
- **Symptom:** Inconsistent status assignment for average scores between `60%` and `75%`.
- **Step-by-Step Reproduction:**
  1. Go to the Campaign Launcher and design an execution with procedures yielding a `70%` average score for a TTP (e.g. 1 Prevented, 2 Logged).
  2. The wizard assigns it a green (High Coverage / Alerted) status.
  3. Re-test this same TTP in the Gap Tracker validation drawer with the same outcomes. The inline validation assigns it a yellow (Medium Coverage / Logged) status.

### Bug 4: N/A Exercises Penalize Global Resilience Score (GRS)
- **Location:** `src/components/Dashboard.jsx:75-81`
- **Symptom:** GRS is mathematically lower due to N/A techniques.
- **Step-by-Step Reproduction:**
  1. Open the Dashboard with the synthetic dataset loaded.
  2. Observe the GRS shows `68%`.
  3. Manually filter out the 5 exercises in the database where `status === 'na'`. The GRS mathematically rises to `75%`.

### Bug 5: Severity-Status Posture Inversion for Unmapped Gaps in Reports Page
- **Location:** `src/components/Reports.jsx:41`
- **Symptom:** High-severity gaps show as green (high coverage) and low-severity gaps show as red (low coverage) under the "Manual Entry" campaign reports.
- **Step-by-Step Reproduction:**
  1. Open the **Reports** page.
  2. Click on the `"Manual Entry"` or `"Ad-hoc Campaign"` drilldown containing unmapped gaps.
  3. Observe that gaps with Critical or High severity display green badges ("Prevented"), and Low severity gaps show red badges ("Missed").

### Bug 6: Missing PDF Export Data in Campaign Launcher
- **Location:** `src/components/ExerciseWizard.jsx:1633`
- **Symptom:** PDF exports are empty of notes and list statuses as raw strings.
- **Step-by-Step Reproduction:**
  1. Navigate to Step 4 of the Campaign Launcher.
  2. Click **Download PDF** or view the inline report PDF preview.
  3. Observe that participant headers are missing and all remediation columns show `N/A`.

### Bug 7: Rendering Crash on Legacy Date Values
- **Location:** `src/components/Dashboard.jsx:91-94`
- **Symptom:** Dashboard crashes on null or empty date values.
- **Step-by-Step Reproduction:**
  1. Load the synthetic dataset (which includes exercises with empty dates, e.g. `""` and `null`).
  2. Navigate to the **Dashboard**.
  3. Observe the white screen of death. The console displays: `RangeError: Invalid time value` at `Date.toLocaleDateString()`.

### Bug 8: Hardcoded Severity & Priority Score in Manual Gap Creation
- **Location:** `src/components/GapTracker.jsx:242-243`
- **Symptom:** Severity is hardcoded to `'High'` and priority to `80`.
- **Step-by-Step Reproduction:**
  1. Go to the **Gap Tracker** and click **Log Manual Gap**.
  2. Notice the form lacks inputs for severity and priority score.
  3. Log the gap. It appears on the board. Expand it: it is labeled "High" severity with a priority score of `80`.

### Bug 9: Reopened Gaps State Synchronization Leak
- **Location:** `src/components/GapTracker.jsx:157`
- **Symptom:** Reopening resolved gaps does not update the GRS or MITRE Heatmap.
- **Step-by-Step Reproduction:**
  1. Drag a resolved gap (e.g. `T1003.001`) from the **Resolved** column back to **In Progress** or **Open**.
  2. Go to the **Dashboard** or **MITRE Heatmap**.
  3. Observe that `T1003.001` remains green ("high" coverage) and the GRS is unchanged.

### Bug 10: Crash Potential due to Missing `mitreData` Guard in Dashboard
- **Location:** `src/components/Dashboard.jsx:125`
- **Symptom:** Dashboard crashes if MITRE cache fails to load or is cleared.
- **Step-by-Step Reproduction:**
  1. Run `localStorage.removeItem('mitre_data_v2')`.
  2. Refresh the browser and block the GitHub raw fetch (or pull network connection).
  3. Go to the **Dashboard**.
  4. The application crashes at `Object.keys(mitreData)`.

### Bug 11: App Crash in GapDetails.jsx (ReferenceError: `getTTPName` is not defined)
- **Location:** `src/components/GapDetails.jsx:631`
- **Symptom:** Standalone "Validate Remediation" drawer crashes the app.
- **Step-by-Step Reproduction:**
  1. Open the **Gap Tracker**.
  2. Expand a gap card to open its detail drawer.
  3. Click the **Validate Remediation** re-test button.
  4. The screen crashes. Inspect console: `ReferenceError: getTTPName is not defined`.

### Bug 12: SVG Path Drifting and Misalignment on Scroll in AttackPath.jsx
- **Location:** `src/components/AttackPath.jsx:296-305`
- **Symptom:** Laser connections drift away from cards when scrolled.
- **Step-by-Step Reproduction:**
  1. Open the **Attack Path** view.
  2. Scroll horizontally to the right.
  3. Hover over a gap node. Notice the SVG connection paths are shifted and detached from the nodes.

### Bug 13: Column Squishing and Broken Horizontal Scroll in AttackPath.jsx
- **Location:** `src/components/AttackPath.jsx:459`
- **Symptom:** Text is unreadable in narrow screen resolutions.
- **Step-by-Step Reproduction:**
  1. Navigate to the **Attack Path** page.
  2. Narrow your browser window.
  3. Observe that columns shrink to near 0px width rather than maintaining layout integrity and displaying a horizontal scrollbar.

### Bug 14: Broken SVG/Laser Height Clipping in AttackPath.jsx
- **Location:** `src/components/AttackPath.jsx:411`
- **Symptom:** Connection paths clip off and are not drawn for cards below the fold.
- **Step-by-Step Reproduction:**
  1. Navigate to the **Attack Path** page with many gaps.
  2. Scroll down vertically.
  3. Observe that laser paths do not render for elements scrolled below the viewport fold because the SVG container height is locked to `100%` of the viewport instead of `scrollHeight`.

### Bug 15: Skewed Globe Ratio due to Validated Exercise Outcomes
- **Location:** `src/components/ExerciseWizard.jsx:443-455`
- **Symptom:** Validated outcomes (`'Missed (Validation)'`, `'Logged (Validation)'`) default to `0` adversary control.
- **Step-by-Step Reproduction:**
  1. Go to the **Battle Globe** with validated outcomes in the dataset.
  2. Note that validated outcomes do not shift the fluid gradient stops because they are ignored by `getAdversaryControlRatio`'s exact string matching.

### Bug 16: Offline Load Failure of MITRE Data (Failure to Fall Back to Expired Cache)
- **Location:** `src/AppContext.jsx:257`
- **Symptom:** App fails to load MITRE framework offline if cache is older than 7 days.
- **Step-by-Step Reproduction:**
  1. Modify `mitre_data_v2` timestamp to be 8 days old in localStorage.
  2. Refresh the browser offline.
  3. The catch block executes, but no fallback is loaded, leaving `mitreData` empty.

### Bug 17: Static/Invisible Gap Card Animation in AttackPath.jsx
- **Location:** `src/components/AttackPath.jsx:527`
- **Symptom:** Card stream animation is not visible.
- **Step-by-Step Reproduction:**
  1. Look at the laser pulse element inside the Attack Path nodes.
  2. The pulse is static and invisible because it is a regular HTML `<div>` styled with SVG attributes.
