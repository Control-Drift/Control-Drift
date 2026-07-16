# Test Plan: Automated Load & UI Verification

This plan outlines the steps to implement, execute, and verify human-like browser automation tests for the Iridescence application, generate synthetic simulations, analyze the local database, and perform load testing on the dashboard and heatmaps.

## Architecture & Infrastructure
- **Frontend**: React application built with Vite (running on http://127.0.0.1:5173).
- **Backend/Database**: Local mock database server `mock_database.js` (running on http://127.0.0.1:3001) which handles user sessions, exercises, gaps, and campaigns.
- **Test Framework**: Playwright automation framework.

## Milestones

### Milestone 1: Analysis & Test Scoping
- **Objective**: Explore the current Playwright setup (`tests/wizard-e2e.spec.js`), the local database API (`mock_database.js`), and identify where/how to persist database updates and enforce human-like interaction patterns.
- **Tasks**:
  1. Inspect the existing Playwright E2E spec.
  2. Locate the database adapter initialization in the frontend and determine how to configure the Playwright test browser to default to the REST database provider.
  3. Formulate a strategy to persist the generated data from memory in `mock_database.js` to a local file (`synthetic_stress_data.json` or another JSON file) on changes or via a `/api/save` endpoint.
- **Verification**: Milestone handoff report from Explorer.

### Milestone 2: Test Suite Refactoring & Auditing (Human-like Patterns)
- **Objective**: Refactor the browser automation tests to use human-like interaction patterns (delays, waits) and support parallel execution to generate hundreds of simulations quickly.
- **Tasks**:
  1. Enhance `mock_database.js` to persist its in-memory database state back to `synthetic_stress_data.json` (or a designated file) on write operations (POST, PUT, DELETE) so that data is not lost when the server restarts.
  2. Implement/enhance the Playwright test suite (e.g., in `tests/wizard-stress.spec.js`) to:
     - Log in as `admin` to allow write operations.
     - Set the frontend database config to REST provider in `localStorage`.
     - Perform human-like typing delays (e.g., using a custom typing speed or page delay helper) and click paths.
     - Parameterize the script to loop/generate multiple simulations.
  3. Review/audit the Playwright automation code via a Reviewer/Auditor to verify it uses natural delays and explicit waits rather than API bypassing.
- **Verification**: Auditor report confirming human-like patterns and review approval.

### Milestone 3: Scale Data Generation Execution
- **Objective**: Execute the Playwright test suite to generate hundreds of simulations into the local database.
- **Tasks**:
  1. Configure Playwright to run with multiple parallel workers (e.g. 4-8 workers) to generate 200+ simulations in parallel.
  2. Execute the test suite and verify that all simulations are successfully completed.
  3. Ensure that the mock database persists the newly created simulation records.
- **Verification**: Run log showing successful completion of the test suite and check database size.

### Milestone 4: Database-level Validation & Analysis
- **Objective**: Programmatically query and analyze the generated simulations in the local database to verify metric logic, MTTR, and check for anomalies.
- **Tasks**:
  1. Create a validation script (or use existing tools) that parses `synthetic_stress_data.json` (the persisted database file).
  2. Perform database-level checks:
     - Verify simulation count matches expected.
     - Confirm all required fields are present in the simulation entries.
     - Check for MTTR logic flaws (e.g. negative time intervals, invalid dates).
     - Check for GRS and MITRE Heatmap score calculations.
     - Identify any metric errors, scaling issues, or logic flaws in the database.
  3. Produce a detailed data analysis report.
- **Verification**: Data Analyst agent report.

### Milestone 5: UI Load & Performance Verification
- **Objective**: Verify that the application UI remains stable, responsive, and renders correctly when populated with the generated simulations.
- **Tasks**:
  1. Start the database and Vite dev server with the generated large dataset loaded.
  2. Execute Playwright tests targeting the Dashboard, MITRE Heatmap, and Gap Tracker.
  3. Verify that there are no console errors, white screens, infinite loops, or overlapping UI elements.
  4. Collect performance metrics (page load times, memory consumption) and verify responsiveness.
- **Verification**: Performance/QA agent report and screenshots/metrics.

### Milestone 6: Final Review & Handoff
- **Objective**: Synthesize all subagent results and deliver the final report to the Sentinel.
- **Tasks**:
  1. Consolidate results from the code audit, database analysis, and UI performance load tests.
  2. Write the final test report.
- **Verification**: All pass criteria met.
