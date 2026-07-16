## 2026-06-17T18:38:20Z
You are a Software Engineer for the "Stress Test Data Injection Utility" project.
Your task is to implement the following changes in the codebase:

1. Backend API Alignment (mock_database.js):
- Modify the GET endpoint for `/api/campaigns` to also support `/api/simulations` path names.
- Update `/api/simulations` and `/api/campaigns` handler to extract and set campaign/simulation names from both `ex.campaign` and `ex.simulation` properties.
- Update the `/api/exercises` GET handler: when filtering on campaign/simulation, accept both `reqUrl.query.campaign` and `reqUrl.query.simulation` parameters, and check both `ex.campaign` and `ex.simulation` properties.
- Update `/api/metrics` GET handler: in GRS and historical trend calculations, handle both `ex.campaign` and `ex.simulation` properties interchangeably.

2. Chaos Data Generator & UI Integration (src/components/Settings.jsx & src/AppContext.jsx):
- Create a random data generator function that constructs a "Stress Test" simulation with 50+ diverse, chaotic events mapped to various MITRE ATT&CK TTPs.
  - The generated events must use a spectrum of outcomes (Prevented, Alerted, Logged, Missed, N/A, Error) and severities.
  - Explicitly include chaotic edge cases: N/A outcomes, empty TTP arrays, undefined severities, and impossible combinations (e.g. status: high and severity: critical, or error status, or missing fields).
  - Ensure the exercises generated have both `campaign: "Stress Test"` and `simulation: "Stress Test"` properties for backend compatibility.
- Implement the "Inject Test Data" debug button in `src/components/Settings.jsx` next to the import/export backup buttons in the "Database & Sync" panel.
- Implement the `injectTestData` function:
  - Clicking this button must completely wipe the existing database/state (exercises, gaps, simulationSummaries, simulationEvidence) by writing empty collections/objects to the dbAdapter / backend database.
  - Then, it must inject the newly generated 50+ event Stress Test simulation exercises, the corresponding simulationSummary under key `"Stress Test"`, and a couple of gaps for missed/low coverage TTPs.
  - Trigger a full refresh of the application state (e.g. by calling `loadData(dbAdapter)`, `fetchExercisesPage(1, 50)`, and `loadMitreCoverage()`) so that the Dashboard, Heatmap, and Reports update immediately.
  - Show a success toast using `addToast` once completed.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your working directory is: C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\.agents\worker_stress_m2_m3
Write a detailed report in C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\.agents\worker_stress_m2_m3\handoff.md of what files were modified, what changes were made, and how they were tested. Verify that the React application builds successfully and the mock database server runs.
