# Handoff Report — explorer_2_qa

## 1. Observation
We observed the following files and code logic in the codebase:

### A. Missing `testResults` and `participants` in PDF Export inside Campaign Launcher
- **File**: `C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\src\components\ExerciseWizard.jsx` (Lines 1633–1656)
- **Verbatim Code**:
  ```javascript
  <PDFDownloadLink
    document={
      <ReportPDF 
         campaignName={campaignDetails.name || 'Ad-hoc Campaign'}
         date={new Date().toISOString()}
         summary={compiledSummary}
         exercises={mappedExercises}
         blocked={blocked}
         medium={detected}
         missed={missed}
         total={selectedTTPs.length}
         evidence={campaignEvidence[campaignDetails.name || 'Ad-hoc Campaign'] || []}
      />
    }
  ```
- **File**: `C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\src\components\ReportPDF.jsx` (Lines 235–239)
- **Verbatim Code**:
  ```javascript
  {testResults && testResults.length > 0 ? (
     testResults.map((proc, j) => ( ... ))
  ) : (
     exercises.map((ex, i) => { ... })
  )}
  ```

### B. Inverted Severity Status Mapping in Reports
- **File**: `C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\src\components\Reports.jsx` (Line 41)
- **Verbatim Code**:
  ```javascript
  status: (g.severity === 'Critical' || g.severity === 'High') ? 'high' : (g.severity === 'Medium' ? 'medium' : 'low'),
  ```

### C. Legacy Date Range Error Crash Risk
- **File**: `C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\src\components\Dashboard.jsx` (Lines 91–96)
- **Verbatim Code**:
  ```javascript
  const historicalScores = Object.values(campaignsByName).sort((a,b) => new Date(a.date) - new Date(b.date)).map(c => {
      const score = Math.round(((c.high + (c.medium * 0.5)) / c.total) * 100);
      return {
          name: new Date(c.date).toLocaleDateString('default', { month: 'short', day: 'numeric' }),
          score: score
      };
  });
  ```

### D. Hardcoded Severity and Score for Manual Gaps
- **File**: `C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\src\components\GapTracker.jsx` (Lines 242–243, and modal block from 526–588)
- **Verbatim Code**:
  ```javascript
  severity: 'High',
  priorityScore: 80,
  ```

### E. Lack of State Reversion on Kanban Reopen
- **File**: `C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\src\components\GapTracker.jsx` (Line 157)
- **Verbatim Code**:
  ```javascript
  updateStatus(draggedGapId, col);
  ```

### F. Lack of `mitreData` Guard in Dashboard
- **File**: `C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\src\components\Dashboard.jsx` (Line 125)
- **Verbatim Code**:
  ```javascript
  const tacticName = Object.keys(mitreData).find(t => mitreData[t].techniques.find(tech => tech.id === ex.ttp));
  ```

---

## 2. Logic Chain

1. **Bug A (PDF Export)**:
   - In `ExerciseWizard.jsx`, `<ReportPDF>` does not receive the `testResults` prop.
   - Therefore, inside `ReportPDF.jsx`, `testResults` resolves to undefined, which triggers the fallback `exercises.map` branch.
   - Because `mappedExercises` (passed as `exercises`) lacks `finding` and `remediation` fields, the fallback renders `N/A` for all remediation notes, and displays raw status strings (`high`/`medium`/`low`) as outcomes in the generated PDF.
   - Also, because `participants` is omitted, the PDF header will always show undefined/empty for participants.

2. **Bug B (Status Inversion)**:
   - In `Reports.jsx`, manual gaps are mapped to exercises where severity is checked.
   - Critical or High severity gaps (worst posture) map to `status: 'high'`.
   - Low severity gaps (least impact posture) map to `status: 'low'`.
   - In the global schema, `status: 'high'` represents **Prevented** (high coverage) and `status: 'low'` represents **Missed** (gap).
   - Therefore, the metrics are inverted: severe vulnerabilities show up as resolved/prevented, and minor ones show up as coverage gaps.

3. **Bug C (Legacy Date Crash)**:
   - If an exercise was logged without a `date` string (e.g. from prior versions of local storage), `new Date(c.date)` evaluates to an invalid date.
   - `toLocaleDateString` on an invalid date throws a `RangeError`. This crashes the entire Dashboard component because it occurs synchronously in the render tree.

4. **Bug D (Manual Gap Hardcoding)**:
   - The manual gap modal has fields for TTP, Campaign, Environment, Details, Action Items, and Stakeholders.
   - It contains no dropdowns/inputs for severity or priority score.
   - Thus, `handleCreateGap` hardcodes them to `'High'` and `80`, preventing users from setting other values.

5. **Bug E (Synchronization Leak)**:
   - Moving a card from `Resolved` back to `Open` in `GapTracker.jsx` only triggers `updateStatus` which updates the status field in the local `gaps` state.
   - It fails to notify the `exercises` or `mitreData` context, meaning the posture map and resilience score will falsely show that the TTP is still validated.

6. **Bug F (Missing Guard)**:
   - If the STIX database fetch fails (e.g. offline boot) or `mitreData` is empty/null, calling `Object.keys(mitreData)` throws a `TypeError`.

---

## 3. Caveats
- We did not write automated regression tests because this is a read-only investigation.
- We assume that `wizard_drafts` stores the step state accurately across VITE hot-reloads. We did not test indexDB or sessionStorage fallback.

---

## 4. Conclusion
The codebase has several critical logic bugs and crash opportunities:
- **PDF Generation Bug** in Campaign Launcher causes user documentation loss.
- **Posture Inversion Bug** in Reports corrupts security posture metrics.
- **Date Crash Potential** in Dashboard poses stability risks.
- **Synchronization Leak** in Gap Tracker causes stale posture scoring.
- **Modal Hardcoding** in Gap Tracker limits manual gap utility.

Fixes should be implemented in `ExerciseWizard.jsx`, `Reports.jsx`, `Dashboard.jsx`, and `GapTracker.jsx`.

---

## 5. Verification Method

1. **Compilation Verification**:
   Verify that the project compiles cleanly after any edits by running:
   ```powershell
   npm run build
   ```
2. **PDF Verification**:
   Inspect the exported PDF from both `ExerciseWizard.jsx` (Step 4) and `Reports.jsx` (drilldown view) and ensure that:
   - Technical findings show the execution/detection notes.
   - Outcome columns display human-readable outcomes (e.g., "Prevented", "Logged") rather than "high" or "medium".
3. **Reports Metric Verification**:
   Add a gap with `severity: "Critical"` and `campaign: "Manual Entry"`. Go to the Reports module, open the Manual Entry report card, and confirm that the Critical gap is categorized under **Missed** (Coverage Gaps) rather than **Prevented**.
4. **Date Integrity Verification**:
   Clear local storage, add an exercise manually with `date: null`, and confirm that the Dashboard does not crash and renders the chart baseline.
5. **Manual Gap Severity Verification**:
   Confirm that the "Log Manual Gap" modal exposes "Severity" and "Priority Score" inputs.
