# plan.md - Deep QA & System Analysis Plan

## Objectives
1. Perform exploration to map out frontend/backend endpoints, metrics formulas, and state components.
2. Design and write local Node/Jest validation scripts to simulate user journeys, mock data, and trace states.
3. Audit edge cases: GRS, MTTR, Residual Risk rollups, MITRE Heatmap, and Gap Tracker status sync.
4. Run scripts to verify findings and gather reproduction payloads/steps.
5. Create a comprehensive, structured `bug_report.md` in the project root detailing all bugs, UI issues, calculation errors, and inconsistencies, without fixing them.

## Decomposed Steps
- **Step 1: Codebase Analysis and Setup**: Use explorer subagents to map state triggers in AppContext, DB CRUD interfaces in mock_database, and metrics recalculations in components.
- **Step 2: Script Development**: Build/adapt validation scripts. Add test scripts in the project directory that simulate purple team exercises, validate GRS calculations, verify MTTR, and check RBAC and pagination.
- **Step 3: Verification Run**: Execute the test scripts to verify bugs programmatically. Capture exact logs, execution outputs, and data payloads.
- **Step 4: Audit & Inspect Results**: Analyze components (MITRE Heatmap, Attack Path, Gap Tracker) for visual or logic flaws.
- **Step 5: Bug Report Compilation**: Write `bug_report.md` with structured reproduction tables and steps.
- **Step 6: Completion Report**: Hand off and notify Sentinel.
