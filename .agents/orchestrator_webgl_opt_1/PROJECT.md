# Project: WebGL 3D Globe Performance Optimization

## Architecture
- React / Vite application using `@react-three/fiber` (R3F) and `@react-three/drei` for 3D rendering.
- `MitreHeatmap.jsx` renders a 3D Battle Globe with a wireframe mesh, rotating stars, custom tactic and technique nodes, and Bloom post-processing effects.
- Current state: Continuous rendering on every animation frame (60fps+) even when idle, causing high CPU/GPU load. Multiple active `useFrame` hooks are running concurrently.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: Performance Baselining | Write Playwright CDP performance script, measure current idle CPU/GPU rendering metrics, and take initial screenshots. | none | DONE (Baseline: Scripting=895.5ms, RecalcStyle=26.9ms, Tasks=2775.2ms) |
| 2 | M2: WebGL Optimization | Optimize `MitreHeatmap.jsx` to reduce idle rendering/animation overhead using frameloop demand and throttling. | M1 | PLANNED |
| 3 | M3: Verification & Auditing | Run Playwright CDP performance script post-optimization, verify >= 30% reduction, run Agent-as-Judge check, and run Forensic Audit. | M2 | PLANNED |

## Interface Contracts
### Playwright CDP ↔ MitreHeatmap Page
- Playwright script navigates to the MITRE Heatmap page.
- Playwright script collects CDP performance metrics (`Trace` or `Performance` API) over a 5-second idle period.
- Playwright script captures page screenshots before and after optimization.
