# Project Plan: E2E Verification and Data Integrity Audit

## Architecture
- React front-end application built with Vite.
- Views involved: Dashboard, Campaign Launcher (ExerciseWizard), Reports, Gap Tracker, MITRE Heatmap, Security Posture (Battle Globe), and Attack Path.
- Metrics Engine: Computes Global Resilience Score (GRS), MTTR, Residual Risk, and rollup statuses.
- E2E Tests: Playwright tests located in `tests/` directory.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| 1 | M1: Exploration & Test Planning | Investigate existing E2E test scripts, database structure, and propagation mechanisms. Create a detailed test plan for the 10 simulations. | None | DONE |
| 2 | M2: E2E Execution & Integrity Verification | Execute 10 realistic simulations via automation, verify data propagation to heatmap, resolve/modify gaps to verify cascading updates, and assert dashboard metrics match raw database. | M1 | DONE |
| 3 | M3: UI/UX & Metrics Audit | Inspect for UI glitches, memory issues, console warnings, and verify the accuracy of metrics calculations. Run Forensic Auditor. | M2 | DONE |
| 4 | M4: Final Synthesis & Reporting | Generate the final testing summary artifact detailing execution paths, validations, and UX anomalies. | M3 | DONE |

## Interface Contracts & Testing Targets
- 10 simulations executed through Campaign Launcher UI.
- Posture Heatmap updates match simulation outcome statuses.
- Resolving/modifying gaps updates original report status, heatmaps, and attack paths.
- All high-level dashboard metrics match raw underlying data counts exactly.
