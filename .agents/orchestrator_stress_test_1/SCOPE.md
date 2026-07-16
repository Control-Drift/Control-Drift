# Scope: Stress Testing and Metrics Validation Audit

## Architecture
- React front-end application with state in `AppContext.jsx`.
- LocalStorage and REST API adapters in `src/lib/db/adapters/`.
- Mock DB server (`mock_database.js`) for REST API backend.
- Opaque-box programmatic test runner in `src/components/TestRunner.jsx`.
- Dashboard calculations for GRS, MTTR, Residual Risk, and MITRE average/weakest link rollup.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| 1 | M1: Data Generation & Injection | Write and execute a script to generate and inject 10,000+ randomized synthetic records (exercises) and gaps with staggered creation/resolution dates and negative bounds into `synthetic_stress_data.json` and local storage / mock DB. | none | DONE |
| 2 | M2: Metrics Validation & Programmatic Verification | Programmatically verify GRS, MTTR (negative bounding), MITRE Heatmap average coverage calculations, and ignoring of error/pending statuses under scale. | M1 | DONE |
| 3 | M3: Performance Profiling and Logical Usability Analysis | Verify UI components render 10,000+ records, generate performance profiles, and check logical progression of attack paths. | M2 | DONE |
| 4 | M4: Final Summary Report | Produce final summary artifact detailing algorithmic accuracy, data coherence, and scalability. | M3 | DONE |

## Interface Contracts
### AppContext ↔ Dashboard / MitreHeatmap / Reports / AttackPath
- GRS, MTTR, and Heatmap rollups calculated on the loaded dataset must match the validated formulas.
- `error` and `pending` statuses must be ignored from the denominator of calculations.
- MTTR must ignore/bound negative time intervals.
