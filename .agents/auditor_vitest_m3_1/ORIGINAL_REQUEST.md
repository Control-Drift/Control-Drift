## 2026-06-27T22:55:56-04:00
You are teamwork_preview_auditor.
Your working directory is: C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\.agents\auditor_vitest_m3_1
Project directory is: C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops

OBJECTIVE:
Perform a forensic integrity audit on all implemented tests under Milestone 3 and E2E modifications.

INSTRUCTIONS:
1. Inspect `src/__tests__/useGapsData.test.js`, `src/__tests__/AppContext.test.jsx` and the E2E modifications in `tests/` (`wizard-e2e.spec.js`, `wizard-e2e-10.spec.js`, `wizard-stress.spec.js`).
2. Run integrity forensics:
   - Ensure there are NO hardcoded test results, expected outputs, or verification strings in the production source code.
   - Verify that there are NO dummy or facade implementations that produce correct-looking outputs without genuine logic.
   - Verify that the tests themselves do not bypass verification or fabricate outputs.
   - Run the build and test scripts to verify compliance.
3. Write your findings to a detailed report (`C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\.agents\auditor_vitest_m3_1\handoff.md`). State your final verdict clearly: CLEAN or INTEGRITY VIOLATION.
4. When complete, send a message to the orchestrator (conversation ID: 34a14340-4350-4597-a981-ffe2200a18da) with your audit report.
