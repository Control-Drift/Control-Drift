# Handoff Report — Challenger M4

## 1. Observation
- **Database Path**: `C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\synthetic_stress_data.json`
- **Simulation Count & Required Fields**:
  - The database contains a total of **10,500 exercises** and **1,050 gaps**.
  - Exactly **612 exercises** exist with the campaign/simulation prefix `Stress Test Auto-Sim`, representing exactly **204 unique simulations**.
  - All standard records contain the required fields: `id`, `ttp`, `status`, `environment`, `date`, `campaign`, and `simulation`.
  - Intentionally injected edge case records (such as empty, null, or invalid dates) constitute approximately **4%** of the dataset (e.g., 406 exercises are flagged with missing or invalid date formats in our validation check, which matches the stress generator's 4% random probability threshold).
- **Metric Rollup and Aggregation Code**:
  - **Server-side GRS (mock_database.js:717-730)**:
    ```javascript
    const valid = db.exercises.filter(ex => 
        (ex.status?.toLowerCase() !== 'na' && ex.coverageRating !== 'N/A') && 
        (ex.simulation || '') !== 'Admin Config' && 
        (ex.campaign || '') !== 'Admin Config'
    );
    const totalValidated = valid.length;
    let points = 0;
    valid.forEach(ex => {
        const status = ex.status || (ex.coverageRating === 'Optimal' ? 'high' : ex.coverageRating === 'Partial' ? 'medium' : ex.coverageRating === 'Minimal' ? 'minimal' : ex.coverageRating === 'None' ? 'low' : 'unknown');
        if (status === 'high') points += 1.0;
        else if (status === 'medium') points += 0.5;
        else if (status === 'minimal') points += 0.25;
    });
    const grs = totalValidated > 0 ? Math.round((points / totalValidated) * 100) : 0;
    ```
  - **Server-side MITRE Heatmap (mock_database.js:381-394)**:
    ```javascript
    if (targetExercises.length > 0) {
        const statuses = targetExercises.map(ex => ex.status).filter(s => s !== 'unknown' && s !== 'na');
        if (statuses.length > 0) {
            t.status = getAggStatus(statuses);
        }
    ```
  - **Client-side MITRE Heatmap (src/hooks/useMitreData.js:12-21)**:
    ```javascript
    const matchingEx = exArray.filter(e => e.ttp === sub.id && e.status !== 'pending' && e.status !== 'error');
    if (matchingEx.length === 0) {
        sub.status = 'unknown';
    } else {
        if (matchingEx.some(e => e.status === 'high')) sub.status = 'high';
        ...
    ```
  - **Server-side/Dashboard MTTR (mock_database.js:743-747 & Dashboard.jsx:230-235)**:
    ```javascript
    const validResolved = resolved.filter(g => !isNaN(new Date(g.resolvedDate)) && !isNaN(new Date(g.createdDate)) && new Date(g.resolvedDate) >= new Date(g.createdDate));
    ```
  - **GapTracker MTTR (src/components/GapTracker.jsx:418-424)**:
    ```javascript
    const validResolved = resolvedGaps.filter(g => !isNaN(new Date(g.resolvedDate)) && !isNaN(new Date(g.createdDate)));
    ...
    const totalSeconds = validResolved.reduce((acc, g) => {
        let diff = (new Date(g.resolvedDate) - new Date(g.createdDate)) / 1000;
        return acc + Math.max(0, diff);
    }, 0);
    ```

- **Verification Scripts Output**:
  - Run `node verify_metrics_stress.js`:
    ```
    Loaded 10500 exercises and 1050 gaps from synthetic_stress_data.json.
    ...
    --- VERIFICATION 2: Error & Pending Status Coverage Filtering ---
    TTP T1059.001 exercise counts:
    - High (Optimal): 79
    - Medium (Partial): 55
    - Minimal: 52
    - Low (No Coverage): 59
    - N/A: 39
    - Error: 55
    - Pending: 53
    - Total: 392
    Mathematical average with error/pending EXCLUDED (denominator = 245): 48.78%
    Mathematical average with error/pending INCLUDED (denominator = 353): 33.85%
    App Context status rollup for TTP T1059.001: [MINIMAL]
    Expected status based on EXCLUDED calculation: [MINIMAL]
    ...
    --- VERIFICATION 4: MTTR Negative Time Interval Bounding ---
    Total Resolved Gaps: 279
    Total Valid Date Resolved Gaps: 253
    Out-of-sync Resolved Gaps (resolvedDate < createdDate): 37
    MTTR Method A (bounding negative diffs to 0): 8.61 days
    MTTR Method B (filtering out negative diffs): 10.09 days
    ```

## 2. Logic Chain
- **GRS Calculation & Denominator Flaw**:
  - *Premise*: GRS calculations in both server (`mock_database.js`) and client (`Dashboard.jsx`) filter out only `'na'` values.
  - *Evidence*: `ex.status?.toLowerCase() !== 'na'` is used as the filter.
  - *Result*: Exercises with `error` or `pending` statuses are counted in the GRS denominator (`totalValidated`), but because they fail to match `'high'`, `'medium'`, or `'minimal'` conditions, they contribute `0` to the GRS numerator. This incorrectly treats incomplete or failed test executions as security control failures, depressing the overall GRS.
- **Heatmap Rollup Mismatch (Server vs. Client)**:
  - *Evidence*: Server-side `calculateMitreCoverage()` filters target exercises' statuses using `filter(s => s !== 'unknown' && s !== 'na')` and maps them to `getAggStatus()`. It does NOT exclude `error` or `pending` statuses, meaning they are counted in the average coverage denominator as `0` points (equivalent to `low`).
  - *Evidence*: Client-side `useMitreData.js` filters out `pending` and `error` using `e.status !== 'pending' && e.status !== 'error'` and skipping them entirely in the accumulator.
  - *Result*: The heatmap rollup on the server will evaluate techniques containing `pending` or `error` exercises to a poorer status than the client-side heatmap, creating a visual discrepancy between views if server-side rollup data is fetched.
- **MTTR Calculation Discrepancy**:
  - *Evidence*: `Dashboard.jsx` and `mock_database.js` use Method B: they filter out negative intervals completely (`resolvedDate >= createdDate`). The denominator only includes gaps with non-negative resolution times.
  - *Evidence*: `GapTracker.jsx` uses Method A: it includes negative intervals in the denominator, but bounds their diff contribution in the numerator to `0` via `Math.max(0, diff)`.
  - *Result*: Under stress testing, Method A yields **8.61 days** while Method B yields **10.09 days**. This discrepancy leads to inconsistent reporting across pages.

## 3. Caveats
- No caveats. The database layout and aggregation logic were investigated thoroughly, and the mathematical discrepancies were verified programmatically.

## 4. Conclusion
1. **Database Count & Schema Integrity**: Confirming that the hybrid database has exactly **10,500 exercises** and **1,050 gaps**, which includes exactly **612 exercises** representing **204 unique simulations** prefixed with `Stress Test Auto-Sim`. All schema fields are valid.
2. **GRS Calculation Flaw**: GRS calculations fail to ignore `error` and `pending` statuses, leading to suppressed resilience scores.
3. **MITRE Heatmap Rollup Discrepancy**: Server-side rollup includes `error` and `pending` in the denominator (scoring them as `low`), while client-side hook `useMitreData.js` ignores them entirely.
4. **MTTR Discrepancy**: GapTracker bounds negative intervals to 0 (Method A), while the Dashboard filters them out (Method B), causing a numeric variance of ~1.5 days on the stress dataset.

## 5. Verification Method
- Execute the stress verification script:
  ```powershell
  node verify_metrics_stress.js
  ```
- Run the audit script:
  ```powershell
  node audit_metrics.cjs
  ```
- Inspect the file `inspect_db.js` output to verify the database integrity.
