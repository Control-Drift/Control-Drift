# Project: Iridescence QA Validation & Metrics Engine Stress-Testing

## Architecture
- React front-end using Vite.
- Views: Dashboard, Campaign Launcher (ExerciseWizard), Reports, Gap Tracker, Battle Globe, Attack Path.
- Data Flow: Campaign Launcher generates test data, which correlates to Reports, Gap Tracker, Battle Globe, and Attack Path.
- Metrics Engine: Calculates Global Resilience Score (GRS), MTTR, Residual Risk, Kill Chain Exposure, Gaps Priority Score, and TTP roll-up outcomes.

## Milestones
| # | Name | Scope | Dependencies | Status | Conv ID |
|---|---|---|---|---|---|
| 1 | M1: Exploration & Metrics Analysis | Analyze metrics engine, roll-up calculations, and UI dependencies | none | DONE | 39adcf1a-d0cb-4cb1-a664-01d5b6c376af, 901ea1a2-021c-4bff-b474-dc66a614adb2, 0c3067fa-d15a-4a5c-a857-e8758d20ce84 |
| 2 | M2: Manual QA Validation | Test the core workflows (Launcher, Gaps, Reports, Dashboard, Globe, Attack Path) by injecting state | M1 | DONE | 901ea1a2-021c-4bff-b474-dc66a614adb2, 0c3067fa-d15a-4a5c-a857-e8758d20ce84 |
| 3 | M3: Synthetic Data Stress-Testing | Feed high-volume, complex synthetic data into the application and inspect behavior | M2 | DONE | e568f4cd-051d-452e-923d-13b95edc8362 |
| 4 | M4: Synthesis & Reporting | Synthesize findings and write qa_matrix.md in the project root | M2, M3 | DONE | 61ff9319-69a3-4c44-bb18-ea00f66d3ed5 |

## Interface Contracts
### Campaign Launcher ↔ Reports / Gap Tracker / Globe
- Campaign creation generates events and states (high/medium/low/untested status) in the React global or context state.
- Reports and Gap Tracker read from this shared context state.
- Battle Globe displays status per Tactics and Techniques (MITRE ATT&CK maps).
- Attack Path graphs display nodes and edges based on campaign simulation.
