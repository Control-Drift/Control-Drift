# Iridescence Application Metrics Engine & AppContext.jsx Analysis Report

## Executive Summary
This report analyzes the global state structure, local storage integration, and calculation formulas within the Iridescence application (specifically focusing on `AppContext.jsx`, `Dashboard.jsx`, `ExerciseWizard.jsx`, `GapTracker.jsx`, and `Reports.jsx`). 

Multiple critical logic bugs, formula discrepancies, and state synchronization issues have been identified. The most severe of these are the **TTP sub-technique exercise loss on refresh**, the **tactic/parent technique status rollup overwrite**, the **discrepant thresholds for coverage rollup** between Campaign Launcher and Inline Validation, and the **incorrect GRS penalization** by N/A status outcomes.

---

## 1. AppContext.jsx State Structure & Local Storage Integration

`AppContext.jsx` acts as the central state provider for the application, initializing state variables from `localStorage` and syncing changes back via React `useEffect` hooks.

### State Variables & Local Storage Mappings

| State Variable | Type | Local Storage Key | Initializer / Default Value | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `exercises` | Array | `exercises` | `[]` (filters out `'Admin Config'` campaigns) | Stores logged simulation exercise records (TTP, campaign, finding, remediation, status, environment, date). |
| `gaps` | Array | `gaps` | `[]` (migrates legacy statuses `'To Do'` $\to$ `'Open'` and `'Closed'` $\to$ `'Resolved'`) | Tracks open, in-progress, resolved, or risk-accepted security coverage gaps. |
| `campaignSummaries` | Object | `campaignSummaries` | `{}` | Stores metadata, goals, procedures, and test results for completed adversary campaigns. |
| `campaignEvidence` | Object | `campaignEvidence` | `{}` | Maps campaigns to arrays of Base64 encoded screenshot/log evidence images. |
| `activeEnvironmentFilter`| String | None (Session) | `'All'` | Tracks the currently active environment view filter (e.g., `'Windows Server'`). |
| `environmentConfig` | Object | `env_config` | Default boolean mapping for 8 environment types | Controls which environments are active/in-scope. |
| `mitreData` | Object | `mitre_data_v2` | Cached MITRE data or fetches from GitHub | Standard MITRE Enterprise ATT&CK framework representation dynamically replayed with exercise statuses. |
| `isMitreLoading` | Boolean | None (Session) | `true` | Loading spinner state for MITRE STIX JSON downloads. |
| `aiSettings` | Object | `ai_settings` | Gemini default settings or environment variables | Stores provider, model, API key, and custom endpoint URL. |
| `activeAiContext` | Object | None (Session) | `null` | Sends context about the active page (objectives, logs, gaps) to the AI Copilot. |
| `confirmConfig` | Object | None (Session) | `{ isOpen: false, message: '', onConfirm: null }` | Controls the global confirmation dialog modal. |

---

## 2. Analysis of Metrics & Calculation Formulas

### A. Global Resilience Score (GRS)
* **Location:** `src/components/Dashboard.jsx` (lines 74–81, 91–97)
* **Formula:**
  $$\text{GRS Score} = \text{Math.round}\left(\frac{\sum \text{Exercise Points}}{N_{\text{total\_exercises}}} \times 100\right)$$
  Where points are awarded per exercise based on status:
  * `high` (Prevented / Alerted) $\to 1.0$ point
  * `medium` (Logged) $\to 0.5$ point
  * `low` (Missed) $\to 0.0$ points
  * `na` (Not Applicable) $\to 0.0$ points (Critical Bug!)
* **Mathematical Discrepancy:** If an exercise has an outcome status of `'na'` (N/A), it contributes $0.0$ points to the numerator but is still counted in the denominator $N_{\text{total\_exercises}}$ (which is simply `filteredExercises.length`). This mathematically penalizes the Global Resilience Score for N/A techniques, treating them exactly like a complete protection failure (`'low'` / Missed).

---

### B. Mean Time to Remediate (MTTR)
* **Location:** `src/components/Dashboard.jsx` (lines 109–120) and `src/components/GapTracker.jsx` (lines 252–267)
* **Formula:**
  $$\text{MTTR (in seconds)} = \frac{\sum (\text{resolvedDate} - \text{createdDate})}{N_{\text{resolved\_gaps}} \times 1000}$$
  * Formatted output:
    * If $\ge 24\text{ hours} \to \text{"[Days]d [Hours]h"}$
    * If $\ge 1\text{ hour} \text{ and } < 24\text{ hours} \to \text{"[Hours]h"}$
    * If $< 1\text{ hour} \to \text{"< 1h"}$
* **Analysis:** The MTTR formula is robust, safe from null references, and consistent between the dashboard and gap tracker. It correctly filters out resolved gaps that lack timestamps.

---

### C. Weighted Residual Risk
* **Location:** `src/components/Dashboard.jsx` (lines 104–107)
* **Formula:**
  $$\text{Weighted Residual Risk} = \sum_{\text{gap } \in \text{ Active Gaps}} \text{SeverityWeight}(\text{gap.severity})$$
  Where Severity Weights are:
  * `'Critical'` $\to 10$
  * `'High'` $\to 7$
  * `'Medium'` $\to 3$
  * `'Low'` $\to 1$
  * Active Gaps are filtered where `status === 'Open'` or `status === 'In Progress'`.
* **Analysis:** Conceptually sound. Gaps that are `'Risk Accepted'` or `'Resolved'` are excluded, which aligns with standard risk management frameworks.

---

### D. Gap Priority Score
* **Location:** `src/components/ExerciseWizard.jsx` (lines 915–917)
* **Formula:**
  $$\text{Priority Score} = \text{Math.round}\left(\text{BaseScore}(\text{severity}) \times \text{VisibilityMultiplier}(\text{outcome})\right)$$
  Where:
  * **Base Score:** `'Critical'` $\to 100$, `'High'` $\to 80$, `'Medium'` $\to 50$, `'Low'` $\to 20$
  * **Visibility Multiplier:** `'Missed'` $\to 1.0$, `'Logged'` $\to 0.6$
  * **Resulting Priority Scores:**
    * Critical Missed $\to 100$
    * Critical Logged $\to 60$
    * High Missed $\to 80$
    * High Logged $\to 48$
    * Medium Missed $\to 50$
    * Medium Logged $\to 30$
    * Low Missed $\to 20$
    * Low Logged $\to 12$
* **Analysis:** Correctly reflects that completely missed techniques present higher immediate risk than those logged but not alerted.
* **Discrepancy:** If a user logs a manual gap in the tracker, it is assigned a hardcoded priority score of `80` (assuming high severity and 1.0 multiplier). There is no logic in `GapDetails.jsx` to dynamically recalculate this score if the user changes the gap status, severity, or details.

---

### E. TTP Outcome Status Roll-up & MITRE Recalculation

#### 1. Procedure-to-TTP Roll-up
When multiple testing procedures target the same TTP, their outcomes are aggregated. This logic differs drastically between the Campaign Launcher and Inline Validation (see Section 3).

#### 2. Sub-Technique-to-Parent Roll-up
In `recalculateMitreStatuses` (`AppContext.jsx`, lines 5–62):
* **Parent Status:** If a parent technique has sub-techniques, its status is determined **exclusively** by rolling up sub-techniques:
  * If all sub-techniques are `'na'`, parent $\to `'na'`$.
  * If no sub-techniques have active statuses (all `'unknown'` or `'na'`), parent $\to `'unknown'`$.
  * If all active sub-techniques are `'high'`, parent $\to `'high'`$.
  * If any active sub-technique is `'low'`, parent $\to `'low'`$.
  * Otherwise, parent $\to `'medium'`$.
* **Tactic Status:** Calculated using **only** parent techniques (excluding sub-techniques directly):
  * Same logical rollup rules as parent techniques, applied over the set of parent techniques in that tactic.

---

## 3. Discrepancies and Logic Bugs

### Bug 1: TTP Exercise Loss on Refresh (Severe React State Bug)
* **Location:** `AppContext.jsx` (line 234, inside `applyExercises`)
* **Verbatim Code:**
  ```javascript
  const tIdx = baseMitre[tactic].techniques.findIndex(t => t.id === ex.ttp || ex.ttp.startsWith(t.id + '.'));
  ```
* **Mechanism of Failure:**
  1. Suppose an exercise is completed for sub-technique `T1059.001` with status `'high'`.
  2. Upon page refresh, `fetchMitreData` runs and replays exercises via `applyExercises`.
  3. For the exercise where `ex.ttp === 'T1059.001'`, `findIndex` evaluates techniques in order.
  4. When evaluating parent technique `T1059`, the clause `ex.ttp.startsWith(t.id + '.')` evaluates to `'T1059.001'.startsWith('T1059.')` which is `true`.
  5. `findIndex` immediately returns the index of the parent technique `T1059`.
  6. The parent technique `T1059`'s status is set to `'high'`. The sub-technique `T1059.001` is skipped and remains `'unknown'`.
  7. Next, `recalculateMitreStatuses` is called.
  8. Since parent technique `T1059` has sub-techniques (namely `T1059.001` which is `'unknown'`), it groups them and recalculates the parent's status.
  9. Since the sub-techniques have no active statuses (only `'unknown'`), the parent technique's status is overwritten to `'unknown'`.
* **Consequence:** All completed exercises for sub-techniques are completely wiped out of the MITRE heatmap and rollup display upon page reload/refresh. They only show correctly in memory before a refresh.
* **Proposed Fix:** Modify the `findIndex` logic to match the TTP ID exactly:
  ```javascript
  const tIdx = baseMitre[tactic].techniques.findIndex(t => t.id === ex.ttp);
  ```

---

### Bug 2: Parent Technique Exercise Overwrite
* **Location:** `AppContext.jsx` (lines 5–62, inside `recalculateMitreStatuses`)
* **Mechanism of Failure:** If a parent technique (e.g., `T1059`) is tested directly and has sub-techniques defined in the MITRE matrix, `recalculateMitreStatuses` will completely overwrite the parent's status based on its sub-techniques (which will default to `'unknown'`).
* **Consequence:** Direct exercise results on parent techniques that have sub-techniques are immediately lost/overwritten by the rollup logic.
* **Proposed Fix:** In `recalculateMitreStatuses`, if a parent technique was directly tested (present in the exercises list), it should either:
  * Be factored into the active statuses array as an additional entry.
  * Or its status should only be overwritten if it does not have a directly assigned status.

---

### Bug 3: Discrepant Thresholds for TTP Outcome Rollup
There is a major mathematical mismatch between how procedure outcomes roll up into TTP statuses:

| Variable / Component | ExerciseWizard.jsx (Campaign Launcher) | AppContext.jsx (Inline Validation) |
| :--- | :--- | :--- |
| **Score calculation method** | Exact match on outcome strings | Matches outcome using `startsWith` |
| **Outcome status `'high'`** | Average score $\ge 60$ | Average score $\ge 75$ |
| **Outcome status `'medium'`** | $25 \le \text{Average score} < 60$ | $25 \le \text{Average score} < 75$ |
| **Outcome status `'low'`** | Average score $< 25$ | Average score $< 25$ |

* **Consequences:**
  1. A campaign completed in the wizard with an average score of $70$ rolls up to a `'high'` status (green). If the exact same campaign is updated via the Inline Validation re-test in the Gap Tracker with an average score of $70$, it rolls up to `'medium'` (yellow).
  2. Because the wizard uses exact matching (`p.outcome === 'Prevented'`), if a procedure outcome was validated to `'Prevented ✓ Validated'` in a previous run, the wizard's `getAggregatedScore` will fail to match it, giving it a score of $0$ and marking the TTP as Missed/low.
* **Proposed Fix:** Align both files to use exact matching or `startsWith` consistently, and unify the rollup thresholds to either $[60, 85]$ or $[25, 75]$.

---

### Bug 4: N/A Exercises Penalize Global Resilience Score (GRS)
* **Location:** `src/components/Dashboard.jsx` (lines 74–81)
* **Mechanism of Failure:** When calculating the denominator of the GRS (`totalValidated`), the code uses the raw length of the `exercises` array. If any exercise is marked as `'na'`, it receives $0.0$ points but increases the denominator, lowering the score.
* **Proposed Fix:** Filter out `'na'` statuses from the GRS calculation:
  ```javascript
  const validExercises = filteredExercises.filter(ex => ex.status !== 'na');
  const totalValidated = validExercises.length;
  let grsPoints = 0;
  validExercises.forEach(ex => {
      if (ex.status === 'high') grsPoints += 1.0;
      else if (ex.status === 'medium') grsPoints += 0.5;
  });
  ```

---

### Bug 5: Inverted Status Color-Coding for Manual Gaps in Reports Page
* **Location:** `src/components/Reports.jsx` (line 41)
* **Verbatim Code:**
  ```javascript
  status: (g.severity === 'Critical' || g.severity === 'High') ? 'high' : (g.severity === 'Medium' ? 'medium' : 'low'),
  ```
* **Mechanism of Failure:** In the Reports component, mock exercises are generated from manual gaps to display them in the drilldown. The mock exercise's `status` (which controls coloring: `'high'` $\to$ green, `'low'` $\to$ red) is set to `'high'` if the gap has a severity of `'Critical'` or `'High'`.
* **Consequence:** Critical and High severity gaps are rendered as `'high'` coverage (green success badges) in reports, and Low severity gaps are rendered as `'low'` coverage (red gap badges). This is the exact inverse of the intended visualization.
* **Proposed Fix:** Invert the mapping to correctly reflect gaps as gaps:
  ```javascript
  status: (g.severity === 'Critical' || g.severity === 'High') ? 'low' : (g.severity === 'Medium' ? 'medium' : 'high'),
  ```

---

## 4. Verification Methods

To independently verify these findings:
1. **Verify Bug 1 (TTP Exercise Loss on Refresh):**
   * Log an exercise on a sub-technique (e.g., `T1059.001`). Note that the MITRE Heatmap shows `T1059` and `T1059.001` with correct colors.
   * Refresh the page.
   * Observe that the heatmap color for `T1059` and `T1059.001` reverts to Gray (`'unknown'`).
2. **Verify Bug 3 (Discrepant Thresholds):**
   * Trace lines 458–484 in `src/components/ExerciseWizard.jsx` against lines 403–420 in `src/AppContext.jsx`.
   * Note the mismatched threshold comparisons (`>= 75` vs `>= 60`, `>= 85`).
3. **Verify Bug 5 (Inverted status in Reports):**
   * Trace line 41 in `src/components/Reports.jsx`. 
   * Create a manual gap with `'Critical'` severity in the Gap Tracker.
   * Go to the Reports tab, open the campaign details drilldown, and inspect the coloring and status badge of the manual gap. It will show as green/Prevented.
