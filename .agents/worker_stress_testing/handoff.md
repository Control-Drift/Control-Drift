# Handoff Report

## 1. Observation

During our read-only analysis of the metrics engine and visualization components, and execution of the synthetic data generation script, we made the following direct observations:

1. **Global Resilience Score (GRS) Formula:**
   - In `src/components/Dashboard.jsx` (lines 75–81):
     ```javascript
     const totalValidated = filteredExercises.length;
     let grsPoints = 0;
     filteredExercises.forEach(ex => {
         if (ex.status === 'high') grsPoints += 1.0;
         else if (ex.status === 'medium') grsPoints += 0.5;
     });
     const grsScore = totalValidated > 0 ? Math.round((grsPoints / totalValidated) * 100) : 0;
     ```
     We observed that `totalValidated` is set to `filteredExercises.length`, which includes exercises with a status of `'na'`.

2. **Mean Time To Remediate (MTTR) Date Parsing:**
   - In `src/components/Dashboard.jsx` (lines 110–120) and `src/components/GapTracker.jsx` (lines 253–267), we observed:
     ```javascript
     const totalSeconds = resolvedGaps.reduce((acc, g) => acc + (new Date(g.resolvedDate) - new Date(g.createdDate)) / 1000, 0);
     ```
     This does not validate that `new Date(g.resolvedDate)` is a valid date object. If any resolved gap contains an invalid date, the result is `NaN`.

3. **TTP Outcome Roll-up Thresholds:**
   - In `src/components/ExerciseWizard.jsx` (lines 478–482):
     ```javascript
     let aggOutcome = 'Missed';
     if (avg >= 85) aggOutcome = 'Prevented';
     else if (avg >= 60) aggOutcome = 'Alerted';
     else if (avg >= 25) aggOutcome = 'Logged';
     ```
   - In `src/AppContext.jsx` (lines 415–419):
     ```javascript
     const avg = validCount > 0 ? totalScore / validCount : 0;
     if (validCount === 0) finalAggOutcome = 'low';
     else if (avg >= 75) finalAggOutcome = 'high';
     else if (avg >= 25) finalAggOutcome = 'medium';
     else finalAggOutcome = 'low';
     ```
     We observed that the average score bounds for status assignment are discrepant (`>= 85/60/25` vs `>= 75/25`).

4. **Synthetic Data Execution Output:**
   Running `& "C:\Program Files\nodejs\node.exe" .agents/worker_stress_testing/generate_stress_data.js` resulted in:
   - **Codebase GRS:** `68%`
   - **Correct GRS:** `75%`
   - **Codebase MTTR:** `NaN`
   - **Correct MTTR:** `1d 18h`
   - **Weighted Residual Risk:** `495`

---

## 2. Logic Chain

1. **GRS Score Mismatch:**
   - From Observation 1, the codebase GRS denominator includes all filtered exercises.
   - When we loaded our synthetic dataset (60 exercises, including 5 `'na'` status exercises), the codebase formula counted 60 as the denominator.
   - Since `'na'` exercises award `0.0` points (same as `'low'`/Missed), the total points sum to `41.0` (35 × 1.0 + 12 × 0.5 = 41.0).
   - Codebase GRS: `Math.round((41.0 / 60) * 100) = 68%`.
   - Correct GRS (excluding `'na'`): `Math.round((41.0 / 55) * 100) = 75%`.
   - This results in a `-7%` artificial score penalty in the codebase.

2. **MTTR Calculation Failure:**
   - From Observation 2, the MTTR calculation parses date strings without safety checks.
   - In our generated dataset, Gap ID 99 was given a `resolvedDate` of `"invalid-date"`.
   - The expression `new Date("invalid-date")` evaluates to `Invalid Date`, which yields `NaN` when subtracted.
   - Due to the reduction accumulator, this single `NaN` value infects the sum and causes the overall MTTR calculation to return `NaN` (Observation 4).

3. **TTP Outcome Classifications Mismatch:**
   - From Observation 3, a technique with an average score of `70%` will fall into different categories.
   - In `ExerciseWizard.jsx`, since `70 >= 60`, it resolves to `'Alerted'` (which maps to `'high'` status, green).
   - In `AppContext.jsx` inline validation, since `70 < 75`, it resolves to `'medium'` status (yellow).
   - This causes visual discrepancies when validation re-tests are run.
   - Furthermore, `ExerciseWizard.jsx` fails to match validated outcomes like `'Prevented ✓ Validated'` because it uses exact matching (`=== 'Prevented'`) instead of prefix matching (`.startsWith('Prevented')`).

---

## 3. Caveats

- We did not investigate browser-specific differences in local storage limits, but the size of our synthetic JSON (~40KB) is well within the standard 5MB local storage quota.
- We assumed that the default environment configurations match the options displayed in the environment config sidebar panel.

---

## 4. Conclusion

The metrics engine in the current codebase suffers from significant formula drift and robustness bugs under high volumes of synthetic data. Specifically:
- GRS is penalized by `'na'` techniques (-7% drift on our test set).
- MTTR crashes to `NaN` due to date parsing vulnerabilities (which can be introduced by invalid date inputs).
- TTP outcome rollup thresholds drift between wizard completions and validation re-tests.
These issues are fully documented and reproducible with our synthetic dataset `synthetic_stress_data.json` and `reproduction_guide.md`.

---

## 5. Verification Method

1. **Verify Metric Drift and Breakdown:**
   Run the programmatic script:
   ```powershell
   & "C:\Program Files\nodejs\node.exe" C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\.agents\worker_stress_testing\generate_stress_data.js
   ```
   Inspect the comparison report outputted in console to verify the exact GRS difference of `-7%`, MTTR returning `NaN`, and TTP roll-up outcomes.

2. **Inspect Output Files:**
   - `C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\synthetic_stress_data.json`
   - `C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\.agents\worker_stress_testing\reproduction_guide.md`

3. **Console Injection Verification:**
   Following the instructions in `reproduction_guide.md`, paste the injection script in the browser console. Navigate through the dashboard and other views to observe the 17 bugs.
