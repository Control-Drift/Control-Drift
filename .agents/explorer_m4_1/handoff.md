# React Performance Optimization Report (Milestone 4)

This report details React performance bottlenecks identified in the Iridescence application, maps out the underlying cause-and-effect relationships, and provides a concrete optimization plan for the worker agent.

---

## 1. Observation

During read-only inspection of the codebase, the following patterns and segments of code were identified as performance bottlenecks:

### A. Context Propagation & Re-renders (`src/AppContext.jsx`)
*   **Observation A.1 (Unstable Context Value)**: At lines 907-932:
    ```javascript
    return (
      <AppContext.Provider value={{ 
          exercises, setExercises, mitreData, setMitreData, isMitreLoading, gaps, setGaps, activeEnvironmentFilter, setActiveEnvironmentFilter,
          environmentConfig, setEnvironmentConfig,
          campaignSummaries, setCampaignSummaries, saveCampaignSummary, 
          campaignEvidence, setCampaignEvidence, addCampaignEvidence, compressImage,
          completeExercise, updateExerciseValidation, toggleTacticScope, toggleTechniqueScope, aiSettings, setAiSettings, generateAIContent, generateAIContentStream,
          activeAiContext, setActiveAiContext, confirmAction
      }}>
    ```
    An inline object is passed as the `value` prop to `AppContext.Provider`.
*   **Observation A.2 (Unstable Action Handlers)**: Functions like `saveCampaignSummary`, `addCampaignEvidence`, `completeExercise`, `toggleTacticScope`, and `toggleTechniqueScope` are defined inside the `AppProvider` body without `useCallback` wrapping.

### B. Scroll Lag & Layout Thrashing (`src/components/AttackPath.jsx`)
*   **Observation B.1 (Scroll Event Listener & Layout Queries)**: At lines 299-365:
    ```javascript
    useEffect(() => {
        const updatePaths = () => {
            if (!containerRef.current) return;
            const containerRect = containerRef.current.getBoundingClientRect();
            const scrollLeft = containerRef.current.scrollLeft;
            const scrollTop = containerRef.current.scrollTop;
            setScrollHeight(containerRef.current.scrollHeight);
            ...
            currentPhaseGaps.forEach(sourceGap => {
                const sourceEl = nodesRef.current.get(sourceGap.id);
                if (!sourceEl) return;
                const sourceRect = sourceEl.getBoundingClientRect();
                ...
    ```
    `updatePaths` is registered as a listener to container `'scroll'` events and calls `.getBoundingClientRect()` inside a nested loop.
*   **Observation B.2 (Render-Triggering State Change in Scroll)**: `setPaths(newPaths)` is called inside the `updatePaths` scroll handler, updating the component's state on every single scroll tick.
*   **Observation B.3 (Inefficient Nested Render Lookups)**: At line 553:
    ```javascript
    {getTTPName(gap.ttp)}
    ```
    Where `getTTPName` (lines 205-232) performs a deep nested traversal of `mitreData` to resolve TTP names, executed for every gap node on every render of `AttackPath`.

### C. 3D Globe Render Redundancy (`src/components/MitreHeatmap.jsx`)
*   **Observation C.1 (Unmemoized Sub-components)**: `TacticNode` (lines 195-258), `TechNode` (lines 260-324), `MacroTechSpecks` (lines 326-352), and `RotatingStars` (lines 354-368) are not memoized via `React.memo`.
*   **Observation C.2 (Inline Functions & Broken Memoization)**: At lines 518, 538-540:
    ```javascript
    onClick={() => setActiveTactic(node.label)}
    ...
    onClick={() => handleTechClick(node.techFull)} 
    onHover={() => setHoveredTech(node)}
    onUnhover={() => setHoveredTech(null)}
    ```
    Inline functions are passed as props to node sub-components, creating new function references on every render.
*   **Observation C.3 (Frequent Vector Clones in Loops)**:
    - Line 201 (`TacticNode` position): `position.clone().multiplyScalar(1.02)`
    - Line 287 (`TechNode` position): `position.clone().multiplyScalar(1.02)`
    - Line 337 (`MacroTechSpecks` position): `n.position.clone().multiplyScalar(1.01)` (inside `map` loop)
    These clone operations allocate new `THREE.Vector3` instances on every render.

### D. Redundant Render Calculations (`src/components/Dashboard.jsx`)
*   **Observation D.1 (Unmemoized Stats Calculations)**: GRS (lines 75-82), historical scores (lines 85-104), resolution rate (lines 107-109), residual risk (lines 111-114), MTTR (lines 116-127), and `radarData` (lines 130-172) are computed directly in the component body.
*   **Observation D.2 (Hover-Triggered Parent Re-renders)**: When hovering over phase nodes in the "Kill Chain Exposure" card (line 355), `setActivePhaseSubject` is invoked, causing a full state update and re-render of `Dashboard` and re-evaluation of all calculations in D.1.
*   **Observation D.3 (Deep Loop in Render List)**: At line 503, `getTTPDetails(ex.ttp)` executes a nested search over `mitreData` inside a `slice` map.

### E. Heavy Component Bundle Loading (`src/App.jsx`)
*   **Observation E.1 (Synchronous Imports)**: `MitreHeatmap` and `AttackPath` are imported synchronously at lines 9 and 13.

---

## 2. Logic Chain

1.  **Unstable Context Value Propagates Re-renders Globally**:
    *   In React, when a context provider's `value` reference changes, all component consumers of that context are forced to re-render.
    *   Because `AppProvider` passes an inline object (`value={{ ... }}`) (**Observation A.1**) and recreates handlers (**Observation A.2**) on every state update, *every context-consuming component* (Dashboard, MitreHeatmap, AttackPath, etc.) is forced to re-render whenever *any* unrelated state in `AppContext` changes.

2.  **Forced Reflows and State Updates Cause Scroll Lag**:
    *   Registering `updatePaths` on scroll (**Observation B.1**) causes code to execute multiple times per second during scroll.
    *   Inside the scroll callback, calling `.getBoundingClientRect()` (**Observation B.1**) forces the browser engine to perform synchronous layouts (layout thrashing), which blocks the main thread.
    *   Triggering `setPaths` (**Observation B.2**) forces React to queue a full component re-render on every scroll event tick.
    *   Since the SVG canvas is absolutely positioned inside a relative scroll container, it natively scrolls with the content without needing coordinates recalculated in real-time. Thus, scroll event layout queries are completely redundant.

3.  **Nested Traversals in Render Cycles Waste CPU Cycles**:
    *   `getTTPName` (**Observation B.3**), `getTTPDetails` (**Observation D.3**), and campaigns mapping in `Reports.jsx` run deep loops over `mitreData` and arrays on every render.
    *   Because hovering over a node updates local state (`hoveredNode` in `AttackPath`, `activePhaseSubject` in `Dashboard`), the components re-render, forcing these O(N*M) nested loops to execute repeatedly, leading to micro-stutters and input lag.

4.  **Inline Functions Break Node Memoization & Vector Clones Thrash GC**:
    *   React.memo relies on shallow reference equality of props to skip rendering.
    *   Passing inline functions (**Observation C.2**) invalidates memoization because a new function reference is created on every parent render.
    *   Additionally, cloning Three.js vectors in render cycles (**Observation C.3**) creates excessive garbage collection (GC) pressure, causing frame rate drops (stutters) during 3D scene interactions.

5.  **Heavy Initial Bundle Size Slows Initial Paint**:
    *   Synchronous imports of `@react-three/fiber` and `three` via `MitreHeatmap` (**Observation E.1**) significantly inflate the initial JS bundle size.
    *   This blocks the initial page loading speed of the dashboard.

---

## 3. Caveats

*   **Investigation Scope**: The investigation was strictly read-only. We did not run profile trace sessions in Chrome DevTools to measure exact millisecond improvements.
*   **External Data Dependents**: `MitreHeatmap` loads its base dataset from a public GitHub STIX URL. Network delays or caching behavior under `AppContext` fetch rules were not benchmarked beyond local React-level performance.

---

## 4. Conclusion

The React performance bottlenecks in the Iridescence application stem from **unstable context values**, **unnecessary layout thrashing on scroll events**, **inefficient O(N*M) lookups inside render loops**, and **lack of memoization on heavy node and 3D sub-components**. 

By applying standard React optimizations (memoization, stable references, event throttling/elimination, lazy loading), the application's responsiveness, scroll performance, and initial loading speed will be dramatically improved.

---

## 5. Verification Method

### A. Static Verification
Verify that the following modifications have been successfully implemented:
1.  **`src/AppContext.jsx`**: Verify that context values are wrapped in a `useMemo` block, and that all actions are wrapped in `useCallback`.
2.  **`src/components/AttackPath.jsx`**: Verify that the `scroll` event listener on `containerEl` is completely removed, and that `updatePaths` is only triggered by mount, window `resize`, and data dependency changes.
3.  **`src/components/MitreHeatmap.jsx`**: Verify that `TacticNode` and `TechNode` are exported as `React.memo` components, and that no inline arrow functions are passed directly in the render mapping block.

### B. Build Verification
Run the build command to ensure there are no compilation errors:
```powershell
npm run build
```

### C. Performance Validation (DevTools)
1.  Open the application in Chrome.
2.  Open **React Developer Tools** -> **Profiler**.
3.  Start profiling and hover over nodes in the `AttackPath` and `Dashboard` components.
4.  Verify that components like stats cards or non-hovered nodes do not re-render (marked as grey/skipped in the Flamegraph).
5.  Scroll the `AttackPath` container and verify in the **Performance** tab that there are no forced reflows or long tasks (over 50ms) blocking the main thread.
