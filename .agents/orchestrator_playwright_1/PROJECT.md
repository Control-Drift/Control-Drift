# Project: Automated UI Testing with Playwright

## Architecture
- Frontend application: React web application built with Vite (accessible on http://localhost:5173).
- Test tool: Playwright E2E UI testing framework.
- Core target workflows to test: Exercise Wizard (Campaign simulation launcher), Reports / Dashboard page metrics.

## Code Layout
- `package.json` — application package definitions and scripts.
- `playwright.config.js` or `playwright.config.ts` — configuration of Playwright.
- `tests/` or similar directory containing Playwright test scripts.
- `src/components/ExerciseWizard.jsx` — wizard UI flow to click through.
- `src/components/Dashboard.jsx` / `src/components/Reports.jsx` — dashboard/reports rendering metrics to scrape and assert.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| 1 | M1: Environment Analysis & Setup | Analyze codebase, check existing scripts, install Playwright dependencies, verify package.json structure | none | PLANNED |
| 2 | M2: E2E Wizard Playwright Test | Write Playwright test to launch server, go to http://localhost:5173, navigate Exercise Wizard, add multiple events with different Outcomes | M1 | PLANNED |
| 3 | M3: Dashboard Metrics Assertion | Scrape metrics from Dashboard/Reports page, assert they match events added in the Wizard | M2 | PLANNED |
| 4 | M4: Final Review & Auditor Verification | Run the full test suite, verify clean exit codes, run Forensic Auditor, produce final report | M3 | PLANNED |

## Interface Contracts / Testing Boundaries
- Wizard selectors: selectors for wizard steps, inputs, buttons (next, add event, finish).
- Metric selectors: DOM selectors for Optimal, Partial, No Coverage, etc. counts.
- Port: Local server runs on port 5173, Playwright must target it.
