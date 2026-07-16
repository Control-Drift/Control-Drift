# Iridescence QA Verification & Metrics Engine Analysis Matrix

## 1. High-Level Summary of the QA Verification Run

This report presents the findings of the QA verification run for the **Iridescence** security posture and simulation application. Verification was performed across all six core modules under a high-volume synthetic dataset designed to stress-test the metrics engine and evaluate boundary conditions.

### Core Modules Evaluated
1. **Dashboard (`Dashboard.jsx`)**: Posture overview and central metrics compilation.
2. **Campaign Launcher / Exercise Wizard (`ExerciseWizard.jsx`)**: Exercise configuration, execution logging, and PDF report exporting.
3. **Reports (`Reports.jsx`)**: Chronological campaign logging, manual gap mapping, and posture display.
4. **Gap Tracker / Kanban Board (`GapTracker.jsx` & `GapDetails.jsx`)**: Gap state transitions, validation re-testing, and risk acceptance flows.
5. **MITRE Heatmap / ATT&CK Visualizer (`AppContext.jsx`)**: Framework state synchronization, sub-technique rollups, and local cache management.
6. **Visualization Components (`BattleGlobe.jsx` & `AttackPath.jsx`)**: Macro ratio-driven battle globe and path-finding attack chains.

### Stress Testing Summary
A high-volume synthetic dataset (`synthetic_stress_data.json` containing 60 simulation exercises, 120 security gaps, and complete campaigns) was injected into the application. Under these stress conditions, the metrics engine experienced mathematical drift, layout issues, and application crashes. In total, **17 bugs** were identified, including **4 Critical**, **4 High**, **8 Medium**, and **1 Low** severity issue.

---

## 2. Metrics Engine Drift & Breakdown Comparison

The table below contrasts the metrics calculated by the codebase's engine against the correct mathematical expectations derived from the synthetic stress dataset.

| Metric | Codebase Calculated Value | Correct Mathematical Expectation | Variance / Drift | Impact & Source of Drift |
| :--- | :--- | :--- | :--- | :--- |
| **Global Resilience Score (GRS)** | **68%** | **75%** | **-7%** | GRS denominator is falsely inflated by counting `'na'` (Not Applicable) status exercises. Since `'na'` awards 0 points, it penalizes the score, treating N/A exactly like a Missed ('low') technique. |
| **Mean Time to Remediate (MTTR)** | **NaN** | **1d 18h** | **UI Crash / Breakdown** | A single resolved gap (Gap ID 99) with an invalid date string (`"invalid-date"`) propagates `NaN` through the reducer, breaking the entire display instead of being gracefully ignored. |
| **Weighted Residual Risk** | **495** | **495** | **0 (None)** | Correctly calculates cumulative risk for all 60 active gaps (30 Open, 30 In Progress) weighted by severity (Critical: 10, High: 7, Medium: 3, Low: 1) while ignoring Resolved/Risk-Accepted. |
| **TTP Roll-up Status** | **Discrepant / Broken** | **Consistent Rollups** | **Threshold & Matching Drift** | Campaign Wizard uses discrepant thresholds (`>=60/85`) vs Inline Validation (`>=25/75`). Also, Wizard uses exact matching (`=== 'Prevented'`), causing validated re-tests (e.g., `'Prevented ✓ Validated'`) to fail and report 0 points. |

---

## 3. Detailed Breakdown of the 17 Discovered Bugs

### BUG-01: TTP Exercise Loss on Refresh
* **Location**: `src/AppContext.jsx` (line 234)
* **Severity**: **Critical**
* **Description**: Sub-technique exercises (e.g., `T1059.001`) are lost from the MITRE heatmap and rollup display upon page reload, reverting to gray (unknown).
* **Root Cause Analysis**: In `applyExercises` (`AppContext.jsx`), the `findIndex` logic uses `ex.ttp.startsWith(t.id + '.')` when searching the flat technique list. When processing a sub-technique like `T1059.001`, this expression evaluates to `true` when evaluating the parent technique `T1059`. The index of the parent technique is returned, overwriting the parent's status. The sub-technique is skipped and remains `'unknown'`. When `recalculateMitreStatuses` runs, the parent status is subsequently overwritten to `'unknown'` because its sub-techniques have no active statuses.
* **Visual/UI Symptoms**: Sub-technique cells in the MITRE Heatmap lose their colors and display as gray (`'unknown'`) on reload.
* **Step-by-Step Reproduction**:
  1. Inject the synthetic dataset via the console.
  2. Refresh the browser.
  3. Go to the MITRE Heatmap page and inspect sub-techniques (e.g., `T1059.001` or `T1566.001`). Observe they are gray (`'unknown'`).
* **Recommended Remediation**:
  Modify the `findIndex` logic in `AppContext.jsx` line 234 to match the TTP ID exactly:
  ```javascript
  const tIdx = baseMitre[tactic].techniques.findIndex(t => t.id === ex.ttp);
  ```

### BUG-02: Parent Technique Exercise Overwrite
* **Location**: `src/AppContext.jsx` (lines 5–62, inside `recalculateMitreStatuses`)
* **Severity**: **High**
* **Description**: Direct exercise logging on parent techniques that have sub-techniques is completely lost or overwritten during framework rollups.
* **Root Cause Analysis**: `recalculateMitreStatuses` iterates over all parent techniques and determines their status *exclusively* based on their sub-techniques. If a parent technique (e.g., `T1059`) was tested directly, its status is overwritten by the status of its untested sub-techniques (which default to `'unknown'`).
* **Visual/UI Symptoms**: Heatmap status badge for the parent technique reverts to gray (`'unknown'`) or `na` on refresh, ignoring the direct test.
* **Step-by-Step Reproduction**:
  1. Complete a test in the Campaign Launcher selecting a parent technique (e.g. `T1059`) directly with outcome `'Prevented'` (high).
  2. Reload the page.
  3. Observe that `T1059`'s status becomes gray (`'unknown'`).
* **Recommended Remediation**:
  In `recalculateMitreStatuses` in `AppContext.jsx`, check if the parent technique has a directly assigned status and factor it into the active statuses array:
  ```javascript
  allTechs.forEach(t => {
      if (!t.id.includes('.') && parentSubsMap[t.id]) {
          const subs = parentSubsMap[t.id];
          const activeStatuses = subs.map(sub => sub.status).filter(s => s !== 'unknown' && s !== 'na');
          if (t.status && t.status !== 'unknown' && t.status !== 'na') {
              activeStatuses.push(t.status);
          }
          // Proceed with rollup scoring
  ```

### BUG-03: Discrepant Thresholds for TTP Outcome Rollup
* **Location**: `src/components/ExerciseWizard.jsx` (lines 478–482) vs `src/AppContext.jsx` (lines 415–419)
* **Severity**: **Medium**
* **Description**: Inconsistent coverage status assignments are made for the same average scores between the Campaign Wizard and Inline Validation.
* **Root Cause Analysis**: Mismatched rollup bounds:
  - Wizard: `avg >= 85` $\to$ Prevented, `avg >= 60` $\to$ Alerted (both map to `'high'`), `avg >= 25` $\to$ Logged (`'medium'`).
  - Inline Validation: `avg >= 75` $\to$ `'high'`, `avg >= 25` $\to$ `'medium'`.
  Also, the Wizard matches outcomes exactly (`p.outcome === 'Prevented'`), causing validated status strings (e.g., `'Prevented ✓ Validated'`) to fail matching and evaluate to `0` points (Missed/low).
* **Visual/UI Symptoms**: A TTP with an average score of `70%` shows green (`Alerted`) in the Campaign Wizard, but turns yellow (`medium` / Logged) when validated in the Gap Tracker drawer. Validated re-test outcomes show as red ("Missed") in the wizard summary.
* **Step-by-Step Reproduction**:
  1. Complete a campaign wizard run where a TTP has procedures resulting in a `70%` average score.
  2. The wizard assigns it a green (High) status.
  3. Perform a validation re-test on that TTP in the Gap Tracker with the same outcomes. The status changes to yellow (Medium).
* **Recommended Remediation**:
  Align both modules to use prefix matching `.startsWith()` and unify the scoring thresholds to a single standard (e.g., 25% for medium, 75% for high):
  ```javascript
  // In ExerciseWizard.jsx:
  if (out.startsWith('Prevented')) totalScore += 100;
  else if (out.startsWith('Alerted')) totalScore += 75;
  // ...
  let aggOutcome = 'Missed';
  if (avg >= 75) aggOutcome = 'Prevented';
  else if (avg >= 25) aggOutcome = 'Logged';
  ```

### BUG-04: N/A Exercises Penalize Global Resilience Score (GRS)
* **Location**: `src/components/Dashboard.jsx` (lines 75–81)
* **Severity**: **High**
* **Description**: GRS is artificially lowered because Not Applicable (`'na'`) exercises contribute 0 points but are counted in the GRS denominator.
* **Root Cause Analysis**: The GRS is calculated as `grsPoints / totalValidated`, where `totalValidated` is the raw `filteredExercises.length`. Since `'na'` status exercises award `0.0` points but increment `totalValidated`, they depress the score.
* **Visual/UI Symptoms**: GRS displays as 68% instead of the mathematically correct 75% under the stress dataset.
* **Step-by-Step Reproduction**:
  1. Load the synthetic dataset (which contains 5 `'na'` exercises out of 60).
  2. Go to the Dashboard. Observe the GRS is 68%.
  3. Filter out the `'na'` exercises in the database; the GRS increases to 75%.
* **Recommended Remediation**:
  Filter out `'na'` status exercises from both the numerator points and the denominator count:
  ```javascript
  const validExercises = filteredExercises.filter(ex => ex.status !== 'na');
  const totalValidated = validExercises.length;
  let grsPoints = 0;
  validExercises.forEach(ex => {
      if (ex.status === 'high') grsPoints += 1.0;
      else if (ex.status === 'medium') grsPoints += 0.5;
  });
  const grsScore = totalValidated > 0 ? Math.round((grsPoints / totalValidated) * 100) : 0;
  ```

### BUG-05: Severity-Status Posture Inversion for Unmapped Gaps in Reports Page
* **Location**: `src/components/Reports.jsx` (line 41)
* **Severity**: **High**
* **Description**: Unmapped/manual gaps in campaign reports display high severity gaps as green/success and low severity gaps as red/failed.
* **Root Cause Analysis**: The Reports component maps unmapped gaps to mock exercises using:
  `status: (g.severity === 'Critical' || g.severity === 'High') ? 'high' : ...`
  In the Iridescence posture model, `status: 'high'` indicates high coverage (Prevented/green), and `status: 'low'` represents low coverage (Missed/red). High severity gaps are thus marked as protected, and low severity gaps are marked as unprotected.
* **Visual/UI Symptoms**: In the Reports tab under "Manual Entry" campaign drilldowns, Critical/High gaps show green success badges ("Prevented"), and Low gaps show red fail badges ("Missed").
* **Step-by-Step Reproduction**:
  1. Navigate to the Reports tab.
  2. Select the "Manual Entry" campaign.
  3. Observe that Critical/High severity gaps have green "Prevented" badges, while Low severity gaps show red "Missed" badges.
* **Recommended Remediation**:
  Invert the mapping in `Reports.jsx` to correctly reflect severity as a posture gap (high severity = low coverage):
  ```javascript
  status: (g.severity === 'Critical' || g.severity === 'High') ? 'low' : (g.severity === 'Medium' ? 'medium' : 'high'),
  ```

### BUG-06: Missing PDF Export Data in Campaign Launcher
* **Location**: `src/components/ExerciseWizard.jsx` (line 1633)
* **Severity**: **Medium**
* **Description**: Generated PDF reports for adversary campaigns are missing participant metadata and display `N/A` for all remediation actions.
* **Root Cause Analysis**: The `<ReportPDF>` component inside the Campaign Wizard's step 4 download link is instantiated without the `testResults` and `participants` props. The PDF falls back to rendering using the `exercises` prop, which maps to `mappedExercises` containing only TTP IDs and names but lacking remediation/finding details.
* **Visual/UI Symptoms**: The downloaded PDF report shows `N/A` under all remediation notes and leaves the participant header blank.
* **Step-by-Step Reproduction**:
  1. Complete a campaign wizard run to Step 4.
  2. Click "Export to PDF".
  3. Open the PDF and observe that the participants field is empty, and the remediation notes columns display `N/A`.
* **Recommended Remediation**:
  Pass `testResults={testResults}` and `participants={campaignDetails.participants.map(p => p.name).join(', ')}` to `<ReportPDF>` at line 1633 in `ExerciseWizard.jsx`.

### BUG-07: Rendering Crash on Legacy Date Values
* **Location**: `src/components/Dashboard.jsx` (lines 91–94)
* **Severity**: **Critical**
* **Description**: The Dashboard component crashes completely (White Screen of Death) when processing exercises with null, empty, or invalid date values.
* **Root Cause Analysis**: The historical score trending logic attempts to sort exercises by date: `new Date(a.date) - new Date(b.date)` and formats the display date using `new Date(c.date).toLocaleDateString(...)`. If a date is undefined, null, or empty, `toLocaleDateString` throws a fatal `RangeError: Invalid time value`.
* **Visual/UI Symptoms**: White screen of death on the Dashboard tab, with `RangeError: Invalid time value` in the browser developer console.
* **Step-by-Step Reproduction**:
  1. Load the synthetic dataset (which includes exercises with null/empty dates).
  2. Navigate to the Dashboard.
  3. The application crashes instantly.
* **Recommended Remediation**:
  Implement a date validator guard that falls back to the current date if the parsed date is invalid:
  ```javascript
  const safeDate = (dateStr) => {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? new Date() : d;
  };
  // Use safeDate(a.date) in the sort and safeDate(c.date) in the local date formatting loop.
  ```

### BUG-08: Hardcoded Severity & Priority Score in Manual Gap Creation
* **Location**: `src/components/GapTracker.jsx` (lines 242–243 & 526–588)
* **Severity**: **Medium**
* **Description**: Manually logged gaps are unilaterally designated as "High" severity with a priority score of `80`, as the form lacks severity and priority inputs.
* **Root Cause Analysis**: The "Log Manual Gap" dialog has no input elements for severity or priority score. Inside `handleCreateGap`, the gap object is initialized with hardcoded values: `severity: 'High'` and `priorityScore: 80`.
* **Visual/UI Symptoms**: Every manual gap logged on the Kanban board is locked to "High" severity and a priority score of 80.
* **Step-by-Step Reproduction**:
  1. Go to the Gap Tracker.
  2. Click "Log Manual Gap".
  3. Observe there are no severity/priority selectors.
  4. Create a gap and inspect its card details; it displays as High/80.
* **Recommended Remediation**:
  Add a select dropdown for **Severity** and a number input for **Priority Score** to the "Log Manual Gap" modal form, and map these input states into the `newGap` object inside `handleCreateGap`:
  ```javascript
  severity: manualGap.severity || 'High',
  priorityScore: parseInt(manualGap.priorityScore) || 80,
  ```

### BUG-09: Reopened Gaps State Synchronization Leak
* **Location**: `src/components/GapTracker.jsx` (line 157)
* **Severity**: **High**
* **Description**: Dragging a gap card from `Resolved` back to `Open` or `In Progress` updates the gap's status, but leaves the TTP marked as green/Prevented (High Coverage) in the exercises state and MITRE Heatmap.
* **Root Cause Analysis**: `handleDrop` in `GapTracker.jsx` updates the gap's status on card drag-and-drop, but does not revert or update the TTP's validation status in the global `exercises` or `mitreData` state.
* **Visual/UI Symptoms**: Reopened gaps remain green ("high" coverage) on the MITRE Heatmap and the Global Resilience Score does not drop to reflect the active gap.
* **Step-by-Step Reproduction**:
  1. Drag a resolved gap card (e.g., `T1003.001`) back to "In Progress".
  2. Navigate to the MITRE Heatmap or Dashboard.
  3. Observe that the TTP is still colored green and GRS is unchanged.
* **Recommended Remediation**:
  In `handleDrop` when moving a gap out of `Resolved`, find the corresponding exercise and revert its status back to `low`/Missed:
  ```javascript
  setExercises(prev => prev.map(ex => {
      if (ex.ttp === gap.ttp && ex.campaign === gap.campaign) {
          return { ...ex, status: 'low' }; // Revert to low/Missed
      }
      return ex;
  }));
  ```

### BUG-10: Crash Potential due to Missing `mitreData` Guard in Dashboard
* **Location**: `src/components/Dashboard.jsx` (line 125)
* **Severity**: **Critical**
* **Description**: The Dashboard tab crashes if the MITRE data cache fails to load (e.g. during offline startup with no cache).
* **Root Cause Analysis**: The tactic exposure logic runs `Object.keys(mitreData)` on line 125 without checking if `mitreData` is null or undefined.
* **Visual/UI Symptoms**: Fatal javascript error in the console (`TypeError: Cannot convert undefined or null to object`) and a blank screen on startup.
* **Step-by-Step Reproduction**:
  1. Clear the local storage cache (`localStorage.removeItem('mitre_data_v2')`).
  2. Turn off network connection.
  3. Load the app and click the Dashboard tab. Observe the crash.
* **Recommended Remediation**:
  Add an early return guard if `mitreData` is empty:
  ```javascript
  if (!mitreData) return;
  const tacticName = Object.keys(mitreData).find(t => mitreData[t].techniques.find(tech => tech.id === ex.ttp));
  ```

### BUG-11: App Crash in GapDetails.jsx (ReferenceError: `getTTPName` is not defined)
* **Location**: `src/components/GapDetails.jsx` (line 631)
* **Severity**: **Critical**
* **Description**: Clicking the "Validate Remediation" button in the gap details drawer crashes the entire React application.
* **Root Cause Analysis**: The validation modal attempts to render the TTP details using:
  `value={gap.ttp ? `${gap.ttp} - ${getTTPName(gap.ttp)}` : ...}`
  However, the helper function `getTTPName` is not imported or defined in `GapDetails.jsx`.
* **Visual/UI Symptoms**: The entire screen turns white (UI crash) when validating a remediation.
* **Step-by-Step Reproduction**:
  1. Go to the Gap Tracker.
  2. Open any gap details drawer.
  3. Click **Validate Remediation**. Observe the white screen crash.
* **Recommended Remediation**:
  Define the `getTTPName` helper function at the top of `GapDetails.jsx` or import it from a utility file:
  ```javascript
  const getTTPName = (id) => {
      if (!mitreData) return '';
      for (const tactic in mitreData) {
          const tech = mitreData[tactic].techniques.find(t => t.id === id);
          if (tech) return tech.name;
      }
      return '';
  };
  ```

### BUG-12: SVG Path Drifting and Misalignment on Scroll in AttackPath.jsx
* **Location**: `src/components/AttackPath.jsx` (lines 296–305)
* **Severity**: **Medium**
* **Description**: SVG laser connection lines drift away from the card nodes when the user scrolls the canvas.
* **Root Cause Analysis**: The path calculation `updatePaths` uses `getBoundingClientRect()` of nodes and the container to compute line coordinates relative to the viewport. It fails to add the container's `scrollLeft` and `scrollTop` offsets. Since the SVG canvas scrolls with the content, the relative viewport coords become incorrect by the scrolled amount.
* **Visual/UI Symptoms**: Connection paths drift and float in empty space, detached from card anchors on scroll.
* **Step-by-Step Reproduction**:
  1. Open the Attack Path.
  2. Scroll horizontally to the right.
  3. Hover over a gap node. Notice the lines are misaligned.
* **Recommended Remediation**:
  Add `containerRef.current.scrollLeft` and `containerRef.current.scrollTop` to the calculated coordinates:
  ```javascript
  const startX = sourceRect.right - containerRect.left + containerRef.current.scrollLeft;
  const startY = sourceRect.top + sourceRect.height / 2 - containerRect.top + containerRef.current.scrollTop;
  ```

### BUG-13: Column Squishing and Broken Horizontal Scroll in AttackPath.jsx
* **Location**: `src/components/AttackPath.jsx` (line 459)
* **Severity**: **Medium**
* **Description**: The Cyber Kill Chain columns shrink to 0px width on narrow screen resolutions, rendering text unreadable and disabling horizontal scrolling.
* **Root Cause Analysis**: Columns are styled with `flex: 1` and `minWidth: 0` in a flex layout. The flex children compress completely to fit the container width.
* **Visual/UI Symptoms**: Phase columns squished to single-digit pixel widths, overlapping text.
* **Step-by-Step Reproduction**:
  1. Open the Attack Path.
  2. Narrow the browser window. Observe the squished columns.
* **Recommended Remediation**:
  Set a reasonable minimum width (e.g., `220px`) on each column styling:
  ```javascript
  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: '220px', zIndex: 1, position: 'relative' }}
  ```

### BUG-14: Broken SVG/Laser Height Clipping in AttackPath.jsx
* **Location**: `src/components/AttackPath.jsx` (line 411)
* **Severity**: **Medium**
* **Description**: Laser paths clip off and fail to render for elements scrolled below the fold.
* **Root Cause Analysis**: The SVG overlay container has `position: 'absolute', height: '100%'`. In absolute CSS layouts, height 100% caps the SVG at the parent's viewport height, not the scrollable `scrollHeight`. Elements scrolled below the viewport boundary have their paths clipped.
* **Visual/UI Symptoms**: Laser connection lines cut off at the bottom of the viewport when scrolling down a column with many gaps.
* **Step-by-Step Reproduction**:
  1. Load many gaps to force vertical scrolling in the Attack Path.
  2. Scroll down. Notice lines to lower elements are clipped and missing.
* **Recommended Remediation**:
  Dynamically set the SVG container's height to the scroll container's `scrollHeight` instead of `100%`:
  ```javascript
  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: containerRef.current ? `${containerRef.current.scrollHeight}px` : '100%', pointerEvents: 'none', zIndex: 0 }}
  ```

### BUG-15: Skewed Globe Ratio due to Validated Exercise Outcomes
* **Location**: `src/components/ExerciseWizard.jsx` (lines 443–455)
* **Severity**: **Medium**
* **Description**: Validation re-test outcomes are ignored by the Battle Globe's ratio calculator, defaulting to 0 adversary control and skewing visual balance.
* **Root Cause Analysis**: `getAdversaryControlRatio` checks outcome strings using exact matches: `out === 'Missed'` and `out === 'Logged'`. Validated outcomes are stored as `'Missed (Validation)'` or `'Logged (Validation)'`, failing the exact matches.
* **Visual/UI Symptoms**: Visual ratio stop markers do not animate or adjust correctly when validation outcomes are logged.
* **Step-by-Step Reproduction**:
  1. View the Battle Globe.
  2. Submit validation outcomes via the Gap Tracker drawer.
  3. Observe that the Crimson/Cobalt gradient does not shift correctly.
* **Recommended Remediation**:
  Use `.startsWith()` in `getAdversaryControlRatio` comparison:
  ```javascript
  if (out.startsWith('Missed')) totalScore += 1.0;
  else if (out.startsWith('Logged')) totalScore += 0.75;
  ```

### BUG-16: Offline Load Failure of MITRE Data (Failure to Fall Back to Expired Cache)
* **Location**: `src/AppContext.jsx` (line 257)
* **Severity**: **High**
* **Description**: The application fails to load MITRE ATT&CK data and displays blank pages when offline if the local storage cache is older than 7 days.
* **Root Cause Analysis**: If the local cache is older than 7 days, `fetchMitreData` attempts to fetch fresh data from GitHub. When offline, this fetch fails, throws an error, and is caught. However, the catch block does not fall back to loading the available expired cache from local storage, leaving `mitreData` as `{}`.
* **Visual/UI Symptoms**: Blank pages and broken layout across the MITRE Heatmap, Attack Path, and Gap Tracker when offline.
* **Step-by-Step Reproduction**:
  1. Edit the `mitre_data_v2` local storage entry to have a timestamp 8 days in the past.
  2. Disconnect the network and refresh the browser.
  3. Navigate to the MITRE Heatmap; it displays empty/blank.
* **Recommended Remediation**:
  Load the expired cache data in the `catch` block of `fetchMitreData`:
  ```javascript
  } catch (err) {
      console.error("Error loading MITRE STIX data:", err);
      if (cachedStr) {
          try {
              const cached = JSON.parse(cachedStr);
              if (cached.data) {
                  setMitreData(applyExercises(cached.data));
              }
          } catch (e) {
              console.error("Failed to parse expired cache fallback:", e);
          }
      }
  }
  ```

### BUG-17: Static/Invisible Gap Card Animation in AttackPath.jsx
* **Location**: `src/components/AttackPath.jsx` (line 527)
* **Severity**: **Low**
* **Description**: The data stream pulse line in the attack path gap cards does not animate.
* **Root Cause Analysis**: The styling assigns `animation: 'laserPulse 2s linear infinite'` to a standard HTML `<div>`. However, the `@keyframes laserPulse` animation in `index.css` only animates `stroke-dashoffset` (which is an SVG-only property and has no effect on a `<div>`). The div remains static and hidden.
* **Visual/UI Symptoms**: The gap card's data stream border is static and invisible.
* **Step-by-Step Reproduction**:
  1. Open the Attack Path.
  2. Observe the bottom border of the gap cards; the pulsing data stream is static.
* **Recommended Remediation**:
  Define a keyframes animation in CSS that translates the div horizontally:
  ```css
  @keyframes htmlLaserPulse {
      0% { transform: translateX(0%); }
      100% { transform: translateX(330%); }
  }
  ```
  And apply it to the data stream div: `animation: 'htmlLaserPulse 2s linear infinite'`.

---

## 4. Database Injection Code Snippet

Use this JavaScript snippet in the browser's developer console (F12) to clear the existing state and inject the synthetic dataset (`synthetic_stress_data.json`) to reproduce the metrics drift:

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
