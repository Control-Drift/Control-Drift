# Scope: Iridescence Deep QA & Auditing Phase

## Architecture
- React front-end application built with Vite.
- Backend database: REST API or local storage adapters managed by `mock_database.js` on port 3001.
- State: `AppContext.jsx` manages exercises, gaps, and MITRE status recalculation.
- Core Views: Dashboard (Global Resilience Score, MTTR, Residual Risk), Campaign Launcher (ExerciseWizard), Reports, Gap Tracker, MITRE Heatmap, Security Posture (Battle Globe), Attack Path.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Exploration & Codebase Analysis | Analyze code paths, components, metrics calculations, and local E2E harness. | none | DONE (d3b0adf8-6348-46cb-881a-f9d5fc2f2a32) |
| 2 | Write Validation and QA scripts | Author programmatic simulation and QA scripts (Node/Jest) to mock data, invoke core logic, and trace state. | M1 | DONE (2d210729-8cd7-42c3-9a59-423280139ce6) |
| 3 | Execute Audits & Trace State | Run test scripts to audit edge cases, GRS, MTTR, Heatmap status rollups, and Gap Tracker sync. | M2 | DONE (2d210729-8cd7-42c3-9a59-423280139ce6) |
| 4 | Generate bug_report.md | Formulate structured bug report at workspace root with reproduction steps, payloads, and verified script outputs. | M3 | DONE (2d210729-8cd7-42c3-9a59-423280139ce6) |

## Interface Contracts
- Tests must execute in the React workspace (C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops).
- Test outputs must be logged and verified programmatically.
- No source code changes are allowed (discovery and reporting only).
