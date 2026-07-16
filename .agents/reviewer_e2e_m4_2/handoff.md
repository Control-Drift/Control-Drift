# Handoff Report: Aggregation Tests Review

## 1. Observation
During the review and execution of the unit tests in `src/__tests__/aggregation.test.jsx` and inspection of the underlying implementation code in `src/hooks/useMitreData.js` and `src/hooks/useExerciseActions.js`, we directly observed the following:

1. **Test Coverage in `src/__tests__/aggregation.test.jsx`**:
   - The initial test suite contained only 3 basic tests covering:
     - `useMitreData` status aggregation (high & low -> low)
     - `useMitreData` environment status rollup (Optimal & None -> low)
     - `ExerciseWizard` worst-case getAggregatedScore (Optimal & None -> None, low status)
   - It lacked coverage for critical edge cases: all N/A, all unknown, transitions, mixed N/A & valid status, and environment order dependency.

2. **`useMitreData.js` environment score accumulation (Lines 200-201)**:
   ```javascript
   else if (score === -1 && exMap[ex.ttp][env].scores.length === 0) exMap[ex.ttp][env].scores.push(-1);
   else if (score === -3) exMap[ex.ttp][env].scores.push(-3);
   ```
   *Observation*: The N/A score (`-1`) is only pushed to the `scores` array if the array is currently empty (`scores.length === 0`).

3. **`useMitreData.js` environment status rollup (Lines 250-253)**:
   ```javascript
   if (scores[0] === -1) {
       t.environments[env] = 'na';
       return;
   }
   ```
   *Observation*: The environment is rolled up to `'na'` if and only if the first score in the array is `-1`.

4. **`useExerciseActions.js` gap validation rollup (Lines 212-217)**:
   ```javascript
   const avg = validCount > 0 ? totalScore / validCount : 0;
   if (validCount === 0) finalAggOutcome = 'na';
   else if (avg >= 75) finalAggOutcome = 'high';
   else if (avg >= 25 && avg < 75) finalAggOutcome = 'medium';
   else if (avg > 0 && avg < 25) finalAggOutcome = 'minimal';
   else finalAggOutcome = 'low';
   ```
   *Observation*: Gap validation re-testing uses an average-based status rollup, whereas initial submissions and matrix recalculations utilize a worst-case status rollup.

---

## 2. Logic Chain
1. In `useMitreData.js`, if an exercise with `status === 'na'` is processed first, the scores array becomes `[-1]`. A subsequent valid status exercise (e.g. `Optimal`) pushes `100` resulting in `[-1, 100]`.
2. When evaluating rollup, `scores[0] === -1` evaluates to `true`, and the environment status is set to `'na'`.
3. If the valid status exercise is processed first, the scores array starts with `[100]`. The subsequent `status === 'na'` is not pushed because `scores.length` is no longer `0`.
4. When evaluating rollup, `scores[0] === -1` evaluates to `false`, and the environment status rolls up to `'high'`.
5. Because array traversal order dictates which exercise is processed first, the environment rollup status is order-dependent and flaky.
6. The inconsistency in rollup calculation logic (average-based in `updateExerciseValidation` vs worst-case in `useMitreData`) creates a risk where re-testing a gap resolves to a higher status than is reflected in the initial wizard view for identical exercise inputs.
7. We expanded `src/__tests__/aggregation.test.jsx` to test all `na`, all `unknown`, status transitions, mixed statuses, and order-dependency. The tests successfully ran and passed, confirming that Case A (N/A first) results in `'na'` and Case B (Optimal first) results in `'high'`.

---

## 3. Caveats
- No implementation code was modified in `src/hooks/` or `src/components/` due to the `Review-only` constraint.
- The order-dependency bug only manifests when a TTP has a mix of `status: 'na'` and valid status exercises under the same environment category.

---

## 4. Conclusion
Our final verdict is **REQUEST_CHANGES**. Although the newly added tests successfully pass, they have highlighted critical bugs and discrepancies in the underlying aggregation logic that must be resolved.

---

## 5. Verification Method
To verify:
1. Run `npx vitest run src/__tests__/aggregation.test.jsx`
2. Observe that 8 tests pass, particularly the newly added test `demonstrates order dependency bug in environment status rollup when N/A is present`, which asserts that `techA.environments['Windows Workstation'] !== techB.environments['Windows Workstation']`.

---

## Quality Review Report

### Review Summary
**Verdict**: REQUEST_CHANGES

### Findings
- **Major Finding 1: Environment Rollup Order Dependency (Bug)**
  - **Where**: `src/hooks/useMitreData.js` (Lines 200, 250)
  - **Why**: Evaluates to different environment statuses depending on the order of exercises inside the dataset array.
  - **Suggestion**: Store `na` as a separate flag/count rather than checking `scores[0] === -1`. Only return `'na'` if all exercises in that environment are `na`.
- **Major Finding 2: Average vs Worst-Case Rollup Discrepancy (Inconsistency)**
  - **Where**: `src/hooks/useExerciseActions.js` (Line 212) vs `src/hooks/useMitreData.js` (Line 47) and `src/components/pages/ExerciseWizard.jsx` (Line 337)
  - **Why**: Gap validation uses average score to determine status, whereas matrix recalculation uses worst-case. This leads to conflicting status indicators.
  - **Suggestion**: Align `updateExerciseValidation` to use the same worst-case rollup logic as the rest of the application.

### Verified Claims
- Worst-case status aggregation logic -> verified via `should aggregate status correctly for various status transitions` -> **PASS**
- All N/A status rollup -> verified via `should aggregate status to na when all exercises are na` -> **PASS**
- All Unknown status rollup -> verified via `should aggregate status to unknown when all exercises are unknown` -> **PASS**

### Coverage Gaps
- Gap validation re-testing metrics logic -> risk level: **Medium** -> Recommendation: Investigate and align the average-based calculation with the worst-case standard.

---

## Challenge Report (Adversarial Review)

### Challenge Summary
**Overall risk assessment**: HIGH

### Challenges
- **Challenge 1 (Order Dependency / Flakiness)**
  - **Assumption challenged**: Assumed that the exercise array ordering does not affect status rollups.
  - **Attack scenario**: Rearranging/sorting exercises by date or insertion order alters the calculated environment status.
  - **Blast radius**: User sees incorrect environment status (e.g. `'na'` instead of `'high'` or vice-versa), leading to false confidence or false alarms.
  - **Mitigation**: Calculate rollup statuses using order-independent set operations.

- **Challenge 2 (Discrepant Math)**
  - **Assumption challenged**: Assumed that validating a gap produces the same status as submitting it via the wizard.
  - **Attack scenario**: A user re-tests a gap with one Optimal and one None procedure. The Gap Tracker rolls up to `'medium'`, but the Heatmap rolls up to `'low'`.
  - **Blast radius**: Inconsistent operational views, rendering metrics unreliable.
