# Project: Iridescence Performance Optimization & Bug Fix Pass

## Architecture
- React front-end application built with Vite.
- Core views: Dashboard, Campaign Launcher (ExerciseWizard), Reports, Gap Tracker, MITRE Heatmap, Security Posture (Battle Globe), and Attack Path.
- Data Flow: Context-driven state managed in `AppContext.jsx`. Campaign Wizard writes exercises and summaries. Reports, Gap Tracker, MITRE Heatmap, Battle Globe, and Attack Path read and subscribe to the state.
- Metrics Engine: Computes Global Resilience Score (GRS), MTTR, Residual Risk, and rollup statuses.

## Code Layout
- `src/App.jsx` — Router and root structure.
- `src/AppContext.jsx` — State management, context provider, MITRE status recalculation, and validation logic.
- `src/components/Dashboard.jsx` — High-level metric visualizations and history graphs.
- `src/components/ExerciseWizard.jsx` — Configuration and execution of security campaigns/simulations.
- `src/components/GapTracker.jsx` & `GapDetails.jsx` — Kanban board and details drawer for gap management and re-testing.
- `src/components/Reports.jsx` — Exercise history and reports overview.
- `src/components/MitreHeatmap.jsx` — Heatmap view of MITRE ATT&CK techniques.
- `src/components/BattleGlobe.jsx` — 3D globe visualization representing security posture.
- `src/components/AttackPath.jsx` — Visual rendering of cyber kill chain and gap paths.
- `src/components/TestRunner.jsx` — E2E test runner running programmatically inside the React app.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| 1 | M1: Core State & Data Alignment | Fix context state, threshold discrepancies, roll-ups, and cache fallbacks (BUG-01, BUG-02, BUG-03, BUG-04, BUG-15, BUG-16) | none | DONE |
| 2 | M2: UI/UX & Flow Enhancements | Fix rendering crashes, PDF exports, manual gap creations, and state sync leaks (BUG-05, BUG-06, BUG-07, BUG-08, BUG-09, BUG-10, BUG-11) | M1 | DONE |
| 3 | M3: SVG & Layout Fixes | Fix SVG laser line misalignment, height clipping, squishing, animations in AttackPath (BUG-12, BUG-13, BUG-14, BUG-17), and status dropdown sync leak | M2 | DONE |
| 4 | M4: React Performance Optimization | Apply memoization, reduce re-renders, and optimize loading times across major views | M3 | DONE |
| 5 | M5: Automated Verification & Profiling | Implement automated headless E2E verification and performance profiler script, generating before/after reports | M4 | DONE |
| 6 | M6: UI/UX QoL Enhancements | Implement user-experience enhancements across sidebar navigation, MITRE heatmap overlapping filters, modal width transitions, responsive dashboard cards, Attack Path empty states, AI Assistant configuration prompts, Command Palette gap selection details, screenshot evidence deletion, and Kanban drag-to-accept-risk drop zones | M5 | DONE |
| 7 | M7: Production-Ready E2E Testing & CI/CD | Set up Playwright headless E2E testing suite, local server lifecycle configuration, and GitHub Actions workflow | M6 | DONE |

## Interface Contracts
### AppContext ↔ ExerciseWizard / GapTracker
- Gaps updated in GapTracker must sync with exercises state (e.g., reopening a resolved gap reverts validation status).
- Outcome scores and threshold alignments must map identically between wizard calculations and context recalculations.
- Exercise status updates in context trigger automatic recalculations of MITRE framework rollups.
