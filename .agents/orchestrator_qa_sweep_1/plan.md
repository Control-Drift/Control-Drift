# plan.md — QA Sweep & Edge-case Testing Plan

This plan details the strategy for writing and executing the QA sweep and edge-case testing suite (using Playwright) for the Eclipse Ops application, specifically targetting the Exercise Wizard and Gap Tracker.

## Milestones

### Milestone 1: Analysis & Exploration (Explorer)
- **Objective**: Explore the application's implementation of the Exercise Wizard (`ExerciseWizard.jsx`), Gap Tracker (`GapTracker.jsx`, `GapDetails.jsx`), and state context (`AppContext.jsx`) to understand validations, error handling, missing field checks, and how gap updates cascade.
- **Worker**: `teamwork_preview_explorer`
- **Output**: Analysis report highlighting component structures, selectors, expected error states, and a detailed specification of test scenarios for `abuse-e2e.spec.js`.
- **Verification**: Handoff containing verified evidence of the codebase structure and a detailed test specification.

### Milestone 2: Implementation of E2E Abuse & Integrity Tests (Worker)
- **Objective**: Write the Playwright test suite `tests/abuse-e2e.spec.js` according to the specification.
- **Worker**: `teamwork_preview_worker`
- **Output**: Completed `tests/abuse-e2e.spec.js` implementation, and verification run command outputs.
- **Verification**: Run `npx playwright test tests/abuse-e2e.spec.js` and verify it succeeds (exit code 0).

### Milestone 3: Independent Review & Validation (Reviewer)
- **Objective**: Review the test code for correctness, completeness, robustness, and ensure that it is free of flakiness.
- **Worker**: `teamwork_preview_reviewer`
- **Output**: Review report verifying code quality and assertions.
- **Verification**: Both reviewers approve the implementation and verify execution.

### Milestone 4: Forensic Integrity Audit (Auditor)
- **Objective**: Audit the codebase and tests to ensure no cheating, mock bypasses, or hardcoded test assertions.
- **Worker**: `teamwork_preview_auditor`
- **Output**: Clean audit report.
- **Verification**: Auditor verdict is CLEAN.

### Milestone 5: Discovered Vulnerabilities Report & Fixes
- **Objective**: Document any vulnerabilities, crashes, or unhandled exceptions found during the abuse testing in a markdown report (`vulnerabilities_report.md`). If there are trivial bugs in the application UI that cause crashes during the tests, patch them (via Worker) and re-verify.
- **Worker**: `teamwork_preview_worker` (if patching is needed) + Orchestrator synthesis.
- **Output**: `vulnerabilities_report.md` at root or in working directory.
- **Verification**: Reviewer checks report and any patches.
