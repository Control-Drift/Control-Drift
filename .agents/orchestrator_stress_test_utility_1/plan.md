# Plan: Stress Test Data Injection Utility

This plan decomposes the requirements for building and integrating a stress-test data injection utility in the Eclipse Ops application.

## Architecture & Layout
- Front-end: React application using Vite.
- Backend: Local Node.js server (`mock_database.js`) simulating a database via JSON files.
- State: AppContext.jsx manages the application context and DB adapter.

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|--------------|--------|
| 1 | M1: Exploration & Requirement Analysis | Analyze existing data structures, TTP mapping, outcomes, and identify button placement in Dashboard/Settings. | none | DONE |
| 2 | M2: Chaos Data Generator Implementation | Implement data generator function producing 50+ chaotic events with spectrum of outcomes, severities, and edge cases (null fields, impossible combinations). Add backend injection API support if needed. | M1 | DONE |
| 3 | M3: UI Integration (Inject Button) | Add "Inject Test Data" debug button in UI, integrate click handler to wipe current database and insert stress-test data, and verify frontend re-renders immediately. | M2 | DONE |
| 4 | M4: System QA & Assessment Report | Run E2E tests, check for crashes, division by zero, layout issues, and write `assessment_report.md`. | M3 | DONE |

## Interface Contracts
- **Inject Test Data Endpoint / Action**: A function or endpoint that wipes the existing exercises and simulation summaries, then inserts the generated 50+ chaotic events.
- **Chaos Payload Schema**: Array of exercises mapping to TTPs, including simulated outcomes (Prevented, Alerted, Logged, Missed, N/A, Error), various severities, and explicit edge cases (empty TTP arrays, missing fields).
