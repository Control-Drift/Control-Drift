# Scope: E2E Verification and Aggregation Math updates

## Architecture
- React front-end application built with Vite.
- Core views: Dashboard, Campaign Launcher (ExerciseWizard), Reports, Gap Tracker, MITRE Heatmap, Security Posture (Battle Globe), and Attack Path.
- Data Flow: Context-driven state managed in `AppContext.jsx`. Mitre statuses calculated in `useMitreData.js` and updated in `AppContext.jsx`.
- Testing framework: Playwright for automated E2E tests.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| 1 | M1: Explore and plan | Explorer investigates existing tests, AppContext, useMitreData and design of worst-case scenario aggregation logic | None | DONE |
| 2 | M2: Implement worst-case aggregation math | Implement strict worst-case scenario aggregation logic in useMitreData.js and verify via Vitest unit tests | M1 | DONE |
| 3 | M3: Implement & run 10-sim verification suite | Implement persistent automated E2E test suite running 10 diverse simulations via Exercise Wizard UI, verifying edge cases and worst-case scenario math | M2 | DONE |
| 4 | M4: Review and Auditing | Reviewers, Challenger, and Forensic Auditor verify correctness and integrity of updates | M3 | IN_PROGRESS |

## Interface Contracts
### Mitre Aggregation
- If a TTP has mixed underlying event scores (e.g. Optimal + Partial), the aggregate heatmap status correctly downgrades to Partial.
- If a TTP has exclusively Optimal underlying events, the aggregate heatmap status correctly reports Optimal.
- TTP detail pills and global heatmap statuses reflect worst-case scenario math.
