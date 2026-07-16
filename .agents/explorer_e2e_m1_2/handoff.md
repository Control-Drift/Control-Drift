# MITRE ATT&CK Status Aggregation Math Investigation Report

## 1. Observation

During the read-only investigation, the following files were analyzed for calculating, aggregating, and rolling up MITRE ATT&CK framework technique and tactic statuses:

1. **`src/hooks/useMitreData.js`**:
   - **`calculateAverageStatus`** (lines 47–64):
     ```javascript
     const calculateAverageStatus = (statuses) => {
         const valid = statuses.filter(s => s === 'high' || s === 'medium' || s === 'minimal' || s === 'low');
         if (valid.length === 0) {
             if (statuses.every(s => s === 'na')) return 'na';
             return 'unknown';
         }
         let total = 0;
         valid.forEach(s => {
             if (s === 'high') total += 100;
             else if (s === 'medium') total += 50;
             else if (s === 'minimal') total += 25;
         });
         const avg = total / valid.length;
         if (avg === 100) return 'high';
         if (avg >= 50) return 'medium';
         if (avg > 0) return 'minimal';
         return 'low';
     };
     ```
   - **`mitreDataCalculated` environment status calculation** (lines 271–280):
     ```javascript
     let finalStatus = 'low';
     if (b === total && total > 0) {
         finalStatus = 'high';
     } else if (b > 0 || l > 0) {
         finalStatus = 'medium';
     } else if (min > 0) {
         finalStatus = 'minimal';
     } else {
         finalStatus = 'low';
     }
     ```

2. **`src/components/pages/MitreHeatmap.jsx`**:
   - **Technique environment rollup** (lines 1107–1118):
     ```javascript
     let totalScore = 0;
     activeEnvStatuses.forEach(s => {
         if (s === 'high') totalScore += 100;
         else if (s === 'medium') totalScore += 50;
         else if (s === 'minimal') totalScore += 25;
     });
     const avg = totalScore / activeEnvStatuses.length;
     if (avg === 100) techs[i].status = 'high';
     else if (avg >= 50) techs[i].status = 'medium';
     else if (avg > 0) techs[i].status = 'minimal';
     else techs[i].status = 'low';
     ```
   - **Tactic rollup** (lines 1154–1165):
     ```javascript
     let totalScore = 0;
     activeStatuses.forEach(s => {
         if (s === 'high') totalScore += 100;
         else if (s === 'medium') totalScore += 50;
         else if (s === 'minimal') totalScore += 25;
     });
     const avg = totalScore / activeStatuses.length;
     if (avg === 100) resolved[tactic].status = 'high';
     else if (avg >= 50) resolved[tactic].status = 'medium';
     else if (avg > 0) resolved[tactic].status = 'minimal';
     else resolved[tactic].status = 'low';
     ```

3. **Other files examined**:
   - `src/AppContext.jsx`: Solely passes down pre-computed `mitreData` and delegates environment/tactic scoping.
   - `src/components/pages/Dashboard.jsx`: Performs Global Readiness Score (GRS) computation, but utilizes pre-calculated status values directly.
   - `src/components/features/AttackPath.jsx` and `src/components/features/GapDetails.jsx`: Used only for lookup or rendering and do not calculate any statuses.
   - `src/old_AppContext.jsx`: Identifed as a dead backup file which is not imported or used anywhere.

## 2. Logic Chain

1. The target requirement is to implement the **strict worst-case scenario aggregation math**, where any lower status (such as `low`, `minimal`, `medium`) overrides any higher status.
2. In the hierarchy of coverage ratings, `high` represents optimal coverage, while `low` represents no coverage. The severity order from worst-case (lowest coverage) to best-case (highest coverage) is:
   `low` (worst) > `minimal` > `medium` > `high` (best).
3. If any `low` status is present in the aggregation pool, the outcome must be `low`. If no `low` is present but `minimal` is present, the outcome must be `minimal`, and so forth.
4. The hook `useMitreData.js` uses `calculateAverageStatus` to aggregate sub-technique and parent technique statuses from individual exercise histories, and inline environment-specific calculations for parent techniques.
5. Additionally, `MitreHeatmap.jsx` independently aggregates technique environment statuses and tactic statuses under the same average-score model.
6. Therefore, to correctly achieve worst-case override consistency across the application, all four points of average-score math must be replaced with priority-based worst-case inclusion checks.

## 3. Caveats

- We assumed that `na` (Not Applicable) and `unknown` (Untested) statuses do not count as "lower coverage status" in worst-case override rules, but rather remain out-of-scope or de-scoped. This matches the existing logic which filters them out of `valid`/`activeStatuses` collections.
- We did not update the dead/unused file `src/old_AppContext.jsx` since it has been completely replaced by `src/AppContext.jsx` and the modular hooks architecture.

## 4. Conclusion

To implement strict worst-case scenario aggregation math, the following four exact edits are proposed.

### Edit 1: `src/hooks/useMitreData.js` - `calculateAverageStatus` (Lines 47-64)

```diff
<<<<
        const calculateAverageStatus = (statuses) => {
            const valid = statuses.filter(s => s === 'high' || s === 'medium' || s === 'minimal' || s === 'low');
            if (valid.length === 0) {
                if (statuses.every(s => s === 'na')) return 'na';
                return 'unknown';
            }
            let total = 0;
            valid.forEach(s => {
                if (s === 'high') total += 100;
                else if (s === 'medium') total += 50;
                else if (s === 'minimal') total += 25;
            });
            const avg = total / valid.length;
            if (avg === 100) return 'high';
            if (avg >= 50) return 'medium';
            if (avg > 0) return 'minimal';
            return 'low';
        };
====
        const calculateAverageStatus = (statuses) => {
            const valid = statuses.filter(s => s === 'high' || s === 'medium' || s === 'minimal' || s === 'low');
            if (valid.length === 0) {
                if (statuses.every(s => s === 'na')) return 'na';
                return 'unknown';
            }
            if (valid.includes('low')) return 'low';
            if (valid.includes('minimal')) return 'minimal';
            if (valid.includes('medium')) return 'medium';
            return 'high';
        };
>>>>
```

### Edit 2: `src/hooks/useMitreData.js` - environment status rollup (Lines 271-280)

```diff
<<<<
                        let finalStatus = 'low';
                        if (b === total && total > 0) {
                            finalStatus = 'high';
                        } else if (b > 0 || l > 0) {
                            finalStatus = 'medium';
                        } else if (min > 0) {
                            finalStatus = 'minimal';
                        } else {
                            finalStatus = 'low';
                        }
====
                        let finalStatus = 'low';
                        if (m > 0) {
                            finalStatus = 'low';
                        } else if (min > 0) {
                            finalStatus = 'minimal';
                        } else if (l > 0) {
                            finalStatus = 'medium';
                        } else if (b > 0) {
                            finalStatus = 'high';
                        }
>>>>
```

### Edit 3: `src/components/pages/MitreHeatmap.jsx` - technique environment rollup (Lines 1107-1118)

```diff
<<<<
                      let totalScore = 0;
                      activeEnvStatuses.forEach(s => {
                          if (s === 'high') totalScore += 100;
                          else if (s === 'medium') totalScore += 50;
                          else if (s === 'minimal') totalScore += 25;
                      });
                      const avg = totalScore / activeEnvStatuses.length;
                      if (avg === 100) techs[i].status = 'high';
                      else if (avg >= 50) techs[i].status = 'medium';
                      else if (avg > 0) techs[i].status = 'minimal';
                      else techs[i].status = 'low';
====
                      if (activeEnvStatuses.includes('low')) techs[i].status = 'low';
                      else if (activeEnvStatuses.includes('minimal')) techs[i].status = 'minimal';
                      else if (activeEnvStatuses.includes('medium')) techs[i].status = 'medium';
                      else techs[i].status = 'high';
>>>>
```

### Edit 4: `src/components/pages/MitreHeatmap.jsx` - tactic rollup (Lines 1154-1165)

```diff
<<<<
              let totalScore = 0;
              activeStatuses.forEach(s => {
                  if (s === 'high') totalScore += 100;
                  else if (s === 'medium') totalScore += 50;
                  else if (s === 'minimal') totalScore += 25;
              });
              const avg = totalScore / activeStatuses.length;
              if (avg === 100) resolved[tactic].status = 'high';
              else if (avg >= 50) resolved[tactic].status = 'medium';
              else if (avg > 0) resolved[tactic].status = 'minimal';
              else resolved[tactic].status = 'low';
====
              if (activeStatuses.includes('low')) resolved[tactic].status = 'low';
              else if (activeStatuses.includes('minimal')) resolved[tactic].status = 'minimal';
              else if (activeStatuses.includes('medium')) resolved[tactic].status = 'medium';
              else resolved[tactic].status = 'high';
>>>>
```

## 5. Verification Method

To independently verify the implementation:
1. **Unit Tests**: Run unit tests using Vitest:
   ```bash
   npx vitest run
   ```
2. **E2E Tests**: Run end-to-end flows with Playwright to verify that de-scoping and gap resolution remain green:
   ```bash
   npx playwright test
   ```
3. **Manual Validation**: Inject mixed mock exercise ratings for a technique (e.g. one `high` and one `medium`). Check the technique status in the UI or local storage; it must show `medium`. Inject a `low` rating; it must immediately override all and show `low`.
