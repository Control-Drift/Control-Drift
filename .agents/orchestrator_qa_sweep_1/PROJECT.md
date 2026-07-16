# Project: QA Sweep and Edge-Case Test Suite

## Architecture
- React Frontend (Vite) with local state context (AppContext.jsx).
- Tests are executed via Playwright against the local Vite dev server.
- The `abuse-e2e.spec.js` test file runs destructive and boundary scenarios against `ExerciseWizard.jsx` (Campaign Scoping and Event logging steps) and `GapTracker.jsx` / `GapDetails.jsx` (cascading state updates to reports, metrics).

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| 1 | M1: Exploration & Test Design | Analyze ExerciseWizard, GapTracker, and AppContext to design abuse and state cascade scenarios. | none | DONE |
| 2 | M2: Test Implementation | Implement `tests/abuse-e2e.spec.js` with comprehensive Playwright test cases. | M1 | DONE |
| 3 | M3: Review & Validation | Perform code review of tests, run execution validation, and resolve any vulnerabilities. | M2 | DONE |
| 4 | M4: Forensic Audit | Perform runtime execution validation and check for implementation cheats. | M3 | DONE |
| 5 | M5: Summary Reporting | Document discovered vulnerabilities and exceptions in a markdown report. | M4 | DONE |

## Interface Contracts
### Playwright Tests ↔ Exercise Wizard / Gap Tracker UI
- Exercise Wizard fields: Scoping name input (`input[placeholder="e.g., APT29 Emulation"]`), target environment dropdown, rich markdown editors, interactive pipeline nodes (TTP selector modal), add event button (`+ Add Event`), outcome dropdowns.
- Gap Tracker: board columns, card clicks, details drawer, risk dropdown status, close/resolve gap action button, verification cascading to Reports (`/reports` metrics) and Dashboard metrics.
