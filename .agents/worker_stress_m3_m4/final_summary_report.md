# Final Summary Report: Performance Profiling & Metrics Validation Audit

## Executive Summary
This report presents the findings from the Performance Profiling, Usability, and Logical Analysis (Milestone 3) and the final summary audit (Milestone 4) of the Eclipse Ops security posture validation platform. 

The audit subjected the platform to a stress dataset containing **10,500 exercises** and **1,050 gaps**, containing a variety of edge-case inputs (null/undefined dates, malformed formats, out-of-sync timestamps, and mixed status values). The system remained highly performant with load times under **1.0 second** and JS heap utilization under **50 MB**. However, several critical architectural bugs, logic drift, and synchronization leaks were uncovered.

---

## 1. Algorithmic Accuracy & Metrics Validation

### 1.1 Global Resilience Score (GRS)
* **Calculation Logic**: GRS represents the proportion of validated security controls that are robust. It filters out `na` statuses, assigns weights (`high = 1.0`, `medium = 0.5`, others = 0), and computes:
  $$\text{GRS} = \text{round}\left( \frac{\sum \text{weighted\_points}}{\text{total\_validated\_exercises}} \times 100 \right)$$
* **Stress Results**: Under stress scale, the GRS settled at **25%** across 8,998 validated exercises (2,243.5 weighted points).
* **Codebase Bugs & Drift**:
  * **Admin Config & Pagination Divergence**: GRS is calculated in two locations: the backend metrics endpoint (`/api/metrics`) and the client-side fallback component (`Dashboard.jsx`). The backend processes the entire database and includes exercises labeled as `"Admin Config"`. The frontend client-side fallback filters out `"Admin Config"` and is restricted to the paginated limit of 50 exercises. Under stress data, this results in a **10% divergence** in the GRS reported to the user.

### 1.2 Mean Time To Remediate (MTTR)
* **Calculation Logic**: MTTR calculates the average duration between gap creation and resolution:
  $$\text{MTTR} = \frac{\sum (\text{resolvedDate} - \text{createdDate})}{\text{total\_resolved\_gaps\_with\_dates}}$$
* **Stress Results**: Under the stress dataset:
  * Total Resolved Gaps: 263 (237 with valid dates)
  * Out-of-sync Resolved Gaps (`resolvedDate` < `createdDate`): 26
  * MTTR Method A (bounding negative intervals to 0): **9.10 days**
  * MTTR Method B (filtering out negative intervals): **10.22 days**
* **Codebase Bugs & Drift**:
  * **Negative Interval Modulo Failure**: For gaps with out-of-sync dates (e.g., due to system clock drift or manual data entries), the subtraction yields negative durations. Modulo operations (`meanSeconds % 86400`) fail on negative integers in JavaScript, yielding incorrect components (e.g., `-7200 seconds` translates to `days = -1` and `hours = -2`).
  * **Data Error Silencing**: Both calculation engines mask these errors. `mock_database.js` / `Dashboard.jsx` filter out negative intervals entirely, while `GapTracker.jsx` clamps negative intervals to 0. Both render as `"< 1h"` in the UI, silencing data integrity anomalies.

### 1.3 MITRE Heatmap Average Coverage Rollups
* **Calculation Logic**: The heatmap rollups assign numerical scores to technique/sub-technique statuses (`high = 100`, `medium = 50`, `minimal = 25`, `low/unknown = 0`) to compute average coverage for tactics, preventing a single "low" technique from pessimistically marking an entire tactic as "low" (which occurs under the alternative "weakest link" model).
* **Codebase Bugs & Drift**:
  * **Omission of Pending/Error Statuses**: Exercises marked as `pending` or `error` are omitted from the coverage rollup denominator. At stress scale, this masks a large volume of untested procedures (e.g., 51 errors and 59 pendings for a single TTP, representing 30%+ of the testing scope).
  * **Strict Weak Ordering Sort Violations**: Sorting exercises or campaigns by date fails when encountering invalid date strings or null values (e.g., `"invalid-resolved-date"`, `null`, `"2026-99-99"`). `new Date(invalid)` returns `NaN`. Comparing `NaN` in array sorting violates the strict weak ordering contract, leading to browser-dependent unstable sort order and rendering lag.
  * **AppContext Missing Guards**: `recalculateMitreStatuses` in `AppContext.jsx` lacks null guards for `mitreObj` and its child techniques array, causing crashes when loading empty or malformed tactical states.

---

## 2. Data Coherence & Logical Progression

### 2.1 Attack Path Progression (Cyber Kill Chain)
* **Path Generation**: The `AttackPath.jsx` component maps gaps onto 6 phases of the Cyber Kill Chain using a Depth-First Search (DFS) algorithm, identifying the "Critical Path" by summing severity weights.
* **Codebase Bugs & Drift**:
  * **Lack of Container Scroll Listener (BUG-12)**: While the SVG renderer correctly factors in `scrollLeft` and `scrollTop` of the container when plotting paths, it fails to register an active scroll listener on the container element. As a result, scrolling the panel vertically or horizontally causes the SVG lines to float and detach from card anchor points until a window resize or hover event forces a redraw.
  * **Inflexible Width Constraints (BUG-13)**: The columns in `AttackPath.jsx` use a fixed flex basis constraint `flex: '0 0 320px'` and `width: '320px'` rather than the flexible `flex: '1 0 220px'` and `minWidth: '220px'` expected in the spec.
  * **Pulsing Animation Period Drift (BUG-17)**: The card laser pulse animation in `AttackPath.jsx` is defined with a `6s` period instead of the `2s` period specified in QA matrices.

### 2.2 Gap Tracking & State Sync Reversion
* **Status Reversion Sync**: Comma-separated multi-TTP gaps (e.g., `"T1059.001, T1059.003"`) correctly propagate status changes. Resolving a multi-TTP gap updates all associated exercises to `high`. Reopening the gap (from `Resolved` to `In Progress` / `Open`) correctly reverts exercise statuses to `low`, triggering a reactive update of technique and tactic statuses inside `AppContext.jsx`.
* **Backend Persistence Leaks**: In frontend-fallback mode, dragging and dropping gaps across Kanban boards or updating exercise validation outcomes updates local React state but does not trigger `saveData` on the backend storage adapter. Any page refresh or route navigation reverts the data, constituting a state synchronization leak.

---

## 3. Scalability & Performance Profile

### 3.1 Load Times & Memory Footprint
Performance logs and baseline comparisons verify that the platform successfully handles a 10,000+ payload without suffering from rendering lag, infinite loops, or graphical glitches.

| Metric | Baseline Run (2026-06-16) | Current Run (2026-06-16) | Delta | Change % | Status |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Load Time** | 946 ms | 927 ms | -19 ms | -2.01% | Improved |
| **DOM Content Loaded** | 945 ms | 926 ms | -19 ms | -2.01% | Improved |
| **First Paint** | 948 ms | 928 ms | -20 ms | -2.11% | Improved |
| **First Contentful Paint** | 1016 ms | 992 ms | -24 ms | -2.36% | Improved |
| **Used JS Heap Size** | 36.72 MB | 47.44 MB | +10.72 MB | +29.19% | Acceptable |

* *Note: The used JS heap size grew by 29.19% under stress, remaining well within the 50 MB threshold.*

### 3.2 Memoization Strategy
Unnecessary DOM re-renders are prevented through structured React memoization hooks:
* **`MitreHeatmap.jsx`**: 4 `useMemo` blocks, 9 `useCallback` hooks, and 3 `React.memo` wraps to shield the heavy WebGL and tactical SVG layouts.
* **`AttackPath.jsx`**: 4 `useMemo` hooks to cache phase mapping and DFS path traversals, avoiding recalculation during hovers.
* **`GapTracker.jsx`**: 2 `useMemo` and 4 `useCallback` hooks, with 1 `React.memo` wrap on Kanban cards.

### 3.3 Three.js WebGL Resource Disposal
A programmatic review of the `MitreHeatmap` 3D component (specifically `GradientSphere`) confirmed that geometries and materials are properly disposed of during component unmount and dependency changes (`useEffect` cleanup calling `.dispose()`), eliminating potential GPU VRAM leaks.

### 3.4 Build Compilation
* Vite production build compiles successfully in **9.57 seconds** without errors, outputting minified HTML, CSS, and JS chunks.
