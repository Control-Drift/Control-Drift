# Handoff Report — explorer_m1_1_qa

## 1. Observation
I observed the following files and code snippets in the workspace:

1. **`src/AppContext.jsx` (lines 231-247):**
   ```javascript
   chronological.forEach(ex => {
       const envArray = Array.isArray(ex.environment) ? ex.environment : [ex.environment || 'Miscellaneous'];
       for (const tactic in baseMitre) {
           const tIdx = baseMitre[tactic].techniques.findIndex(t => t.id === ex.ttp || ex.ttp.startsWith(t.id + '.'));
           if (tIdx > -1) {
               baseMitre[tactic].techniques[tIdx].status = ex.status;
   ```

2. **`src/AppContext.jsx` (lines 5-62 recalculateMitreStatuses):**
   ```javascript
   const recalculateMitreStatuses = (mitreObj) => {
       for (const tactic in mitreObj) {
           const allTechs = mitreObj[tactic].techniques;
           // Group sub-techniques by parent
           const parentSubsMap = {};
           allTechs.forEach(t => {
               if (t.id.includes('.')) {
                   const parentId = t.id.split('.')[0];
                   if (!parentSubsMap[parentId]) parentSubsMap[parentId] = [];
                   parentSubsMap[parentId].push(t);
               }
           });

           // 1. Calculate parent technique statuses based ONLY on their sub-techniques
           allTechs.forEach(t => {
               if (!t.id.includes('.') && parentSubsMap[t.id]) {
                   const subs = parentSubsMap[t.id];
                   const activeStatuses = subs.map(sub => sub.status).filter(s => s !== 'unknown' && s !== 'na');
                   if (activeStatuses.length === 0) { ... t.status = 'unknown'; } ...
   ```

3. **`src/components/ExerciseWizard.jsx` (lines 458-484 getAggregatedScore):**
   ```javascript
   const getAggregatedScore = (ttpId) => {
     const procs = testResults.filter(p => (p.ttps || []).includes(ttpId));
     if (procs.length === 0) return { score: 0, outcome: 'Missed', count: 0 };
     ...
     procs.forEach(p => {
        const out = p.outcome || 'Prevented';
        if (out === 'N/A' || out === 'Error') return;
        validCount++;
        if (out === 'Prevented') totalScore += 100;
        else if (out === 'Alerted') totalScore += 75;
        else if (out === 'Logged') totalScore += 50;
        else if (out === 'Missed') totalScore += 0;
     });
     
     if (validCount === 0) return { score: 0, outcome: 'N/A', count: 0 };
     const avg = totalScore / validCount;
     
     let aggOutcome = 'Missed';
     if (avg >= 85) aggOutcome = 'Prevented';
     else if (avg >= 60) aggOutcome = 'Alerted';
     else if (avg >= 25) aggOutcome = 'Logged';
     
     return { score: avg, outcome: aggOutcome, count: validCount };
   };
   ```

4. **`src/AppContext.jsx` (lines 403-420 inside updateExerciseValidation):**
   ```javascript
        const proceduresForTTP = campaignData.testResults.filter(p => (p.ttps || []).includes(ttp));
        
        let totalScore = 0;
        let validCount = 0;
        proceduresForTTP.forEach(p => {
            let out = p.outcome || '';
            if (out.startsWith('Prevented')) { totalScore += 100; validCount++; }
            else if (out.startsWith('Alerted')) { totalScore += 75; validCount++; }
            else if (out.startsWith('Logged')) { totalScore += 50; validCount++; }
            else if (out.startsWith('Missed')) { totalScore += 0; validCount++; }
        });
        
        const avg = validCount > 0 ? totalScore / validCount : 0;
        if (validCount === 0) finalAggOutcome = 'low';
        else if (avg >= 75) finalAggOutcome = 'high';
        else if (avg >= 25) finalAggOutcome = 'medium';
        else finalAggOutcome = 'low';
   ```

5. **`src/components/Dashboard.jsx` (lines 74-81):**
   ```javascript
   const totalValidated = filteredExercises.length;
   let grsPoints = 0;
   filteredExercises.forEach(ex => {
       if (ex.status === 'high') grsPoints += 1.0;
       else if (ex.status === 'medium') grsPoints += 0.5;
   });
   const grsScore = totalValidated > 0 ? Math.round((grsPoints / totalValidated) * 100) : 0;
   ```

6. **`src/components/Reports.jsx` (lines 40-42):**
   ```javascript
   finding: g.finding || g.details || 'Manual Gap',
   status: (g.severity === 'Critical' || g.severity === 'High') ? 'high' : (g.severity === 'Medium' ? 'medium' : 'low'),
   severity: g.severity || 'High',
   ```

---

## 2. Logic Chain
1. **Observation 1** shows that `applyExercises` searches for the technique index in the MITRE data array using `findIndex` with the clause `t.id === ex.ttp || ex.ttp.startsWith(t.id + '.')`. 
2. If `ex.ttp` is a sub-technique like `T1059.001`, `ex.ttp.startsWith('T1059.')` will evaluate to `true` when evaluating parent technique `T1059`. Since parent `T1059` comes first, `tIdx` is the index of `T1059`.
3. Thus, `baseMitre[tactic].techniques[tIdx].status` updates the parent's status to the exercise's status, leaving the sub-technique `T1059.001`'s status as `'unknown'`.
4. **Observation 2** shows that `recalculateMitreStatuses` runs right after `applyExercises`. For each parent technique (like `T1059`) that has sub-techniques, its status is recalculated based **only** on its sub-techniques. Since `T1059.001` is still `'unknown'` (because it was skipped), the parent's status is overwritten to `'unknown'`.
5. This leads to the **Conclusion** that replayed exercises for sub-techniques are completely lost from the MITRE heatmap display on page refresh (Bug 1).

6. Similarly, **Observation 2** shows that if a parent technique itself was directly tested, its status is also overwritten by the sub-technique rollup logic, losing the direct test results (Bug 2).

7. Comparing **Observation 3** and **Observation 4**, we see that `ExerciseWizard.jsx` uses threshold limits $[25, 60, 85]$ to map average procedure scores to TTP outcomes, and uses exact matching (`out === 'Prevented'`). In contrast, `AppContext.jsx` (`updateExerciseValidation`) uses threshold limits $[25, 75]$ to map average procedure scores to TTP outcomes, and uses substring matching (`out.startsWith('Prevented')`).
8. This leads to the **Conclusion** that the rollup logic between Campaign Launcher and Inline Validation is discrepant (Bug 3). For example, an average score of $70$ produces a `'high'` status in the wizard but a `'medium'` status in inline validation. Furthermore, a validated procedure outcome (e.g. `'Prevented ✓ Validated'`) will fail to score any points in the wizard because of exact string matching.

9. **Observation 5** shows that the denominator `totalValidated` for the Global Resilience Score (GRS) is the total length of the exercises array. If an exercise is `'na'` (N/A), it yields $0$ points but increases the denominator.
10. This leads to the **Conclusion** that N/A techniques artificially penalize the Global Resilience Score (Bug 4).

11. **Observation 6** shows that when `Reports.jsx` creates mock exercises for manual gaps, it maps `Critical` or `High` severity gaps to `status: 'high'` (which is color-coded green and represents success/high-coverage in exercises) and `Low` severity gaps to `status: 'low'` (which is color-coded red and represents a gap/Missed).
12. This leads to the **Conclusion** that reports render High severity gaps as success (green) and Low severity gaps as failures (red) (Bug 5).

---

## 3. Caveats
- No code was modified during this investigation (read-only constraint).
- It is assumed that the official MITRE Enterprise ATT&CK framework representation matches the standard STIX mapping, which flat-lists techniques and sub-techniques.

---

## 4. Conclusion
The Iridescence application contains five major logic bugs and discrepancies in its metrics engine:
1. **TTP Exercise Loss on Page Refresh (Bug 1):** Sub-technique exercise statuses are set on their parents during local storage reload and then overwritten to `'unknown'`.
2. **Parent Technique Overwrite (Bug 2):** Direct tests on parent techniques are overwritten by their sub-techniques rollup.
3. **Mismatched Rollup Thresholds & Exact Matching (Bug 3):** Campaign Launcher uses thresholds $[25, 60, 85]$ and exact matching; Inline Validation uses $[25, 75]$ and `startsWith` matching.
4. **GRS N/A Penalization (Bug 4):** Exercises marked as N/A are counted in the GRS denominator with 0 points, skewing the resilience score downward.
5. **Inverted Gap Color-coding in Reports (Bug 5):** High/Critical manual gaps are shown as green ('high') and Low gaps as red ('low') in the Reports drilldown.

These should be resolved by the implementer.

---

## 5. Verification Method
Detailed reproduction steps for each bug are described in the accompanying `analysis.md` file located at:
`C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\.agents\explorer_m1_1_qa\analysis.md`
To verify:
- Inspect the file paths and line numbers outlined in Section 1.
- Open the application, log a sub-technique exercise, reload the page, and observe the MITRE heatmap state reversion.
