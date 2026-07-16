## 2026-06-13T14:13:32Z
You are worker_stress_testing. Your working directory is C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\.agents\worker_stress_testing.
Your role is to conduct the synthetic data generation and stress-testing analysis for Iridescence.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your objective is:
1. Write a Node.js script (e.g. `generate_stress_data.js` in your folder) to programmatically generate a high-volume, high-quality synthetic dataset containing:
   - A list of at least 50+ exercises targeting various MITRE TTPs (including sub-techniques like `T1059.001`, `T1059.003`, etc.).
   - A list of at least 100+ gaps containing varying severities (Critical, High, Medium, Low) and statuses (Open, In Progress, Resolved, Risk Accepted).
   - Campaign summaries with multiple procedures, including validated outcomes (e.g. `'Logged (Validation)'`, `'Missed (Validation)'`, `'Prevented ✓ Validated'`).
   - Legacy exercises with empty/invalid dates.
   - Gaps resolved on different dates to test MTTR.
   - Exercises marked with `'na'` status.
2. Run the script using Node to write the synthetic data to a file named `synthetic_stress_data.json` in the project root: `C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\synthetic_stress_data.json`.
3. In your Node script, calculate what the metrics (Global Resilience Score, MTTR, Weighted Residual Risk, and TTP roll-up outcomes) *should* be, and compare them to what the *current codebase's formulas* actually compute. Report the exact numeric differences and gaps in your report.
4. Write a comprehensive `reproduction_guide.md` in your working directory outlining:
   - Detailed JavaScript snippets that a tester can copy-paste into the browser developer console (or local storage) to inject the synthetic dataset.
   - Step-by-step instructions on how to observe each of the 17 discovered bugs (from explorer reports) using the injected synthetic data.
   - How the metrics engine calculations drift or error out under this high volume.
5. Do NOT modify any files in `src/` or write any automation tests (Cypress/Jest). Focus purely on dataset generation, metrics calculation, and documentation.
Write your reports to C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\.agents\worker_stress_testing\handoff.md and notify the orchestrator when done.
