# Handoff Report — E2E Abuse Testing Design

## 1. Observation
1.  **Wizard step state initialization**: `src/components/ExerciseWizard.jsx:194`
    ```javascript
    const [step, setStep] = useState(() => { const s = sessionStorage.getItem('wizard_step'); return s ? parseInt(s, 10) : 1; });
    ```
2.  **Exercise wizard scoping validation**: `src/components/ExerciseWizard.jsx:393-406`
    ```javascript
    if (step === 1) {
      if (!simulationDetails.name.trim()) {
          addToast("Please provide a Simulation Name before proceeding.", 'warning');
          return;
      }
      if (!simulationDetails.environmentCategory || simulationDetails.environmentCategory.length === 0) {
          addToast("Please select a Target Environment before proceeding.", 'warning');
          return;
      }
      if (selectedTTPs.length === 0) {
          addToast("Please select at least one MITRE TTP to proceed.", 'warning');
          return;
      }
    }
    ```
3.  **Exercise wizard event logging validation**: `src/components/ExerciseWizard.jsx:407-434`
    ```javascript
    if (step === 3) {
      if (testResults.length === 0) { ... }
      const hasActualOutcome = testResults.some(p => p.outcome && p.outcome !== 'N/A' && p.outcome !== 'Error');
      if (!hasActualOutcome) { ... }
      if (testResults.some(p => !p.ttps || p.ttps.length === 0)) { ... }
      ...
      if (testResults.some(p => !p.name || p.name.trim() === '' || /^Event \d+$/.test(p.name.trim()))) {
          setShowNameErrors(true);
          addToast("1 or more events are missing a name.", 'warning');
          return;
      }
    }
    ```
4.  **State Lookup Vulnerabilities**: `src/hooks/useExerciseActions.js:120`
    ```javascript
    proc = simulationData.testResults.find(p => p.name === procName);
    ```
5.  **Metrics Calculations**: `src/components/Dashboard.jsx:272-280`
    ```javascript
    const applicableGaps = allGaps.filter(g => g.status !== 'Risk Accepted');
    const totalGaps = applicableGaps.length;
    const closedGaps = applicableGaps.filter(g => g.status === 'Resolved').length;
    const resolutionRate = totalGaps > 0 ? Math.round((closedGaps / totalGaps) * 100) : 100;
    
    const open = allGaps.filter(g => g.status === 'Open' || g.status === 'In Progress');
    const openGapsCount = open.length;
    const severityWeights = { 'Critical': 10, 'High': 7, 'Medium': 3, 'Low': 1 };
    const residualRisk = open.reduce((acc, g) => acc + (severityWeights[g.severity] || 0), 0);
    ```

---

## 2. Logic Chain
1.  Since the wizard loads `step` directly from `sessionStorage` (Obs 1) without checking if prior steps have been completed, we can inject a higher step number and bypass Step 1 validation (Obs 2).
2.  Event logging (Obs 3) blocks empty event names and default naming patterns like `"Event 1"`. However, duplicate event names are allowed by the UI but looked up by name via `.find()` (Obs 4). If a user logs multiple events with the same name, updating the validation of the second event will overwrite or desync the first event's state.
3.  The global Dashboard calculates metrics (Obs 5) by filtering out `"Risk Accepted"` gaps. If a user has active open gaps dragging down their GRS or resolution rate, they can transition them all to `"Risk Accepted"` to artificially force the resolution rate to `100%`, reduce residual risk to `0`, and remove GRS score penalties without implementing any fixes.
4.  Consequently, five robust Playwright abuse test cases were drafted to target these behaviors in `/exercise`, `/gaps`, and `/` pages.

---

## 3. Caveats
No caveats.

---

## 4. Conclusion
A detailed testing plan and specification has been compiled and saved as `analysis.md` in this directory. It defines specific selectors, exact user actions, expected Toast warnings, and DOM metrics values needed to implement `tests/abuse-e2e.spec.js`.

---

## 5. Verification Method
1.  Read `C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\.agents\explorer_qa_sweep_1_2\analysis.md` to verify the presence of exact Playwright test cases and selectors.
2.  Once implemented by the Worker, run `npx playwright test tests/abuse-e2e.spec.js` in the project root directory (`C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops`) to execute the test suite and confirm it succeeds.
