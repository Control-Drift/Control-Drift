## 2026-06-26T22:32:52-04:00
You are a Playwright test implementer. Your objective is to create a robust E2E test suite in `tests/abuse-e2e.spec.js` based on the explorer's test specifications.

First, read:
- `C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\.agents\explorer_qa_sweep_1_1\analysis.md`
- `C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\.agents\explorer_qa_sweep_1_3\analysis.md`
- `C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\tests\wizard-e2e.spec.js` (for authentication/local storage setup).

You must write a Playwright E2E test file at:
`C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\tests\abuse-e2e.spec.js`

Implement the following test cases in `tests/abuse-e2e.spec.js`:
1. **Wizard Progress Guardrails**: Navigate step-by-step through the exercise wizard. Validate that the application triggers the warning toasts and blocks navigation when name is missing, environment is missing, TTP is missing, events are missing, event names are default or empty, outcomes are undocumented, and the executive summary is missing.
2. **Step-Skipping Bypass Check**: Verify that when `sessionStorage.setItem('wizard_step', 4)` is executed and the page is reloaded, the application handles it gracefully (e.g. redirects to Step 1 or blocks submission if fields are missing).
3. **Duplicate Simulation Names and Event Merging**: Run a simulation with a duplicate name and verify that the application merges or overwrites the data cleanly without crashing.
4. **Gap Tracker Risk Acceptance Cascade**: Verify the risk acceptance modal validation (requires authority and justification), submit risk acceptance, and verify that the gap card moves to the 'Risk Accepted' section and status cascades to reports/metrics.
5. **Gap Tracker Resolution & Validation Blockers**: Verify that resolving a gap requires an optimal validation outcome. Test that non-optimal outcomes (like Logged) block resolution, and optimal outcomes (like Prevented & Alerted) succeed and update the reports coverage scores.
6. **Revocation of Resolution & Risk Acceptance**: Drag a Resolved card back to In Progress and verify state resets. Drag a Risk Accepted card back to In Progress and verify justification/approver logs are cleared.

Once you have written `tests/abuse-e2e.spec.js`, execute the test suite to verify it works using:
`npx playwright test tests/abuse-e2e.spec.js`

Provide a handoff report documenting the test code structure, commands run, and test execution results.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
