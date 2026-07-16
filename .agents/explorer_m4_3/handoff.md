# Milestone 4 Performance Optimization Report

This report analyzes the Iridescence application codebase to identify React performance optimization opportunities for Milestone 4, focusing on reducing unnecessary re-renders, component loading optimization, and improving scroll/animation fluidity.

---

## 1. Observation

Direct observations of source files and lines exposing performance bottlenecks:

### A. Context Rendering Bottleneck (`src/AppContext.jsx`)
- **Observation**: In `src/AppContext.jsx` (lines 906–914), the context provider's `value` is passed as an inline object literal, and none of its custom state updater functions are memoized:
```javascript
906:   return (
907:     <AppContext.Provider value={{ 
908:         exercises, setExercises, mitreData, setMitreData, isMitreLoading, gaps, setGaps, activeEnvironmentFilter, setActiveEnvironmentFilter,
909:         environmentConfig, setEnvironmentConfig,
910:         campaignSummaries, setCampaignSummaries, saveCampaignSummary, 
911:         campaignEvidence, setCampaignEvidence, addCampaignEvidence, compressImage,
912:         completeExercise, updateExerciseValidation, toggleTacticScope, toggleTechniqueScope, aiSettings, setAiSettings, generateAIContent, generateAIContentStream,
913:         activeAiContext, setActiveAiContext, confirmAction
914:     }}>
```
- **Consequence**: Every consumer of `AppContext` re-renders on *any* state change within the provider because a new object reference is created on every render.

### B. MITRE Heatmap Search & 3D Render Overhead (`src/components/MitreHeatmap.jsx`)
- **Observation 1**: Search inputs update state on every keystroke (lines 772–774):
```javascript
768:                <input 
769:                  className="ai-input" 
...
772:                  value={searchTerm}
773:                  onChange={e => setSearchTerm(e.target.value)}
774:                />
```
- **Observation 2**: The `<Canvas>` and `<Scene>` components are nested directly inside `MitreHeatmap` and receive state changes on every keystroke, forcing R3F to re-evaluate (line 829):
```javascript
829:         <Scene mitreData={resolvedMitreData} activeTactic={activeTactic} setActiveTactic={setActiveTactic} handleTechClick={handleTechClick} quickFilter={quickFilter} />
```
- **Observation 3**: In `TechNode` (lines 260–324) and `MacroTechSpecks` (lines 326–352), Three.js geometries and materials (like `sphereGeometry`, `octahedronGeometry`, `meshStandardMaterial`) are created inline inside the rendering loop/definition. In R3F, creating objects dynamically in the component tree causes heavy memory allocation and garbage collection churn during re-renders.

### C. Attack Path Scroll and Hover Jank (`src/components/AttackPath.jsx`)
- **Observation 1**: A scroll listener is attached to `containerRef` inside `useEffect`, updating React state `paths` on every single scroll tick (lines 354–363):
```javascript
354:         const containerEl = containerRef.current;
355:         if (containerEl) {
356:             containerEl.addEventListener('scroll', updatePaths);
357:         }
```
- **Observation 2**: `updatePaths` calls `getBoundingClientRect()` on every node in the grid on each scroll frame (lines 316–329):
```javascript
316:                     const sourceEl = nodesRef.current.get(sourceGap.id);
317:                     if (!sourceEl) return;
318:                     const sourceRect = sourceEl.getBoundingClientRect();
```
- **Observation 3**: Selecting or hovering over any node updates `hoveredNode` (lines 525–526), re-rendering the entire component tree including all phase headers and non-highlighted nodes.

### D. Dashboard Widget Unmemoized Computations (`src/components/Dashboard.jsx`)
- **Observation 1**: The Dashboard component performs multiple loops, date parsing, and sorting operations directly in the render body (lines 75–187):
  - Linear loops on `exercises` to calculate `grsScore`.
  - Date parsing and sorting of `historicalScores`.
  - Nested loops mapping `filteredExercises` to `tacticExposure` (lines 130–139) by searching through `mitreData` tactics and techniques.
  - Mean Time to Remediate (MTTR) calculation looping on `filteredGaps`.
- **Observation 2**: The hover state `activePhaseSubject` triggers a full Dashboard re-render on every phase hover/selection (lines 355–356), forcing all these nested calculations to re-run.

### E. List Filtering Overhead in Gap Tracker (`src/components/GapTracker.jsx`)
- **Observation**: Gaps are filtered and sorted inline inside the column rendering map (lines 413–425) on every render:
```javascript
413:              const colGaps = gaps.filter(g => {
...
425:              }).sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));
```
- **Consequence**: When local dragging states (`draggedGapId`, `dragOverCol`) update, this complex filtering and sorting is recalculated for all columns.

### F. Reports Campaign Processing (`src/components/Reports.jsx`)
- **Observation**: The `campaigns` object mapping is recalculated from `exercises` and `gaps` on every render (lines 24–49).

---

## 2. Logic Chain

1. **Inline Object Value & Handlers in Context**: Passing inline object values and unmemoized callback references to `AppContext.Provider` changes the context reference on every render. Because context consumers trigger re-renders upon reference changes, minor updates anywhere in the app force components like `Dashboard`, `MitreHeatmap`, and `GapTracker` to re-render.
2. **Keystroke-driven Canvas Re-renders**: Because `searchTerm` updates on every keystroke, the parent `MitreHeatmap` re-renders. Since `<Scene>` is rendered inline inside the parent without memoization, it re-renders. Within `<Scene>`, Three.js geometries are constructed inline, triggering GPU memory churn on every keypress.
3. **Scroll-Driven Layout Thrashing**: Inside `AttackPath`, calling `getBoundingClientRect` on multiple DOM nodes on every scroll tick causes layout thrashing. Since the scroll container uses relative layout, elements do not move relative to the container contents. Calculating viewport scroll offsets dynamically is unnecessary, and updating React state on every frame introduces major jank.
4. **Unmemoized Loops on Hover**: Hovering over dashboard phases updates local component state (`activePhaseSubject`). Since statistics calculations (MTTR, GRS, campaign sorting) are written inline without `useMemo`, they execute costly linear and nested loops on every hover frame.
5. **Inline Array Operations on Local State Updates**: Updating drag-and-drop state triggers a re-render of `GapTracker`. Because the filtering and sorting of gaps is performed inline, the component re-filters/re-sorts the entire list of gaps three times per render tick, causing drag latency.

---

## 3. Caveats

- **No Code Changes Permitted**: This analysis is strictly read-only; actual implementation of the proposed code structures must be performed by the worker.
- **R3F Instance Optimization**: While memoizing R3F nodes reduces CPU overhead, utilizing `instancedMesh` for rendering hundreds of technique specks (`MacroTechSpecks`) requires refactoring how node positions/colors are bound. This is highly recommended but needs architectural care from the worker.
- **No Automated Test Coverage**: The `package.json` contains no test runner configuration (such as `jest` or `vitest`). Verification must rely on build correctness (`npm run build`) and manual performance inspection.

---

## 4. Conclusion

The Iridescence application exhibits significant React rendering bottlenecks due to:
1. Context value reference changes.
2. Scroll-driven layout thrashing and state updates.
3. Expensive array processing and date parsing running inline on hover state changes.
4. Redundant Three.js geometry allocations on input updates.

By applying `useMemo` for context values and expensive computations, debouncing input states, decoupling scroll positioning from React state, and wrapping sub-components in `React.memo`, these bottlenecks can be fully eliminated.

---

## 5. Optimization Plan & Strategy

The worker should implement the following changes:

### Step 1: Memoize AppContext Value & Callbacks (`src/AppContext.jsx`)
- Wrap all functions (`saveCampaignSummary`, `addCampaignEvidence`, `completeExercise`, `updateExerciseValidation`, `toggleTacticScope`, `toggleTechniqueScope`, `generateAIContent`, `generateAIContentStream`, `confirmAction`) in `useCallback`.
- Memoize the context value object using `useMemo`:
  ```javascript
  const contextValue = useMemo(() => ({
      exercises, setExercises, mitreData, setMitreData, isMitreLoading, gaps, setGaps,
      activeEnvironmentFilter, setActiveEnvironmentFilter, environmentConfig, setEnvironmentConfig,
      campaignSummaries, setCampaignSummaries, saveCampaignSummary, campaignEvidence,
      setCampaignEvidence, addCampaignEvidence, compressImage, completeExercise,
      updateExerciseValidation, toggleTacticScope, toggleTechniqueScope, aiSettings,
      setAiSettings, generateAIContent, generateAIContentStream, activeAiContext,
      setActiveAiContext, confirmAction
  }), [
      exercises, mitreData, isMitreLoading, gaps, activeEnvironmentFilter,
      environmentConfig, campaignSummaries, campaignEvidence, aiSettings, activeAiContext,
      saveCampaignSummary, addCampaignEvidence, completeExercise, updateExerciseValidation,
      toggleTacticScope, toggleTechniqueScope, generateAIContent, generateAIContentStream,
      confirmAction
  ]);
  ```

### Step 2: Decouple Search Input & Memoize R3F Scene (`src/components/MitreHeatmap.jsx`)
- Debounce `searchTerm` updates or use a separate local input state so that typing does not trigger instant renders of the parent and Canvas.
- Wrap `Scene`, `TacticNode`, and `TechNode` in `React.memo`.
- Move the Three.js geometry declarations (`octahedronGeometry`, `sphereGeometry`, `icosahedronGeometry`) out of the components or wrap them in `useMemo`.
- Refactor `MacroTechSpecks` to use an `instancedMesh` for rendering the global list of technique nodes.

### Step 3: Eliminate Scroll-Driven State Updates (`src/components/AttackPath.jsx`)
- Remove the scroll event listener from the container entirely.
- Position the SVG overlay container inside the scrollable content container using `position: absolute`, `top: 0`, `left: 0`. Compute path offsets relative to the parent content container instead of viewport coordinates so browser-native composite scrolling handles motion without layout updates.
- Wrap the individual gap cards and phase headers in a memoized component (`MemoizedGapNode` / `MemoizedPhaseHeader`).

### Step 4: Memoize Statistics Calculations (`src/components/Dashboard.jsx`)
- Wrap all statistics calculations (`grsScore`, `historicalScores`, `mttrText`, `radarData`, `areaData`) in `useMemo` hooks depending on `[exercises, gaps, mitreData]`.

### Step 5: Memoize List and Grid Filtering (`src/components/GapTracker.jsx` & `src/components/Reports.jsx`)
- In `GapTracker.jsx`, memoize the grouped column data:
  ```javascript
  const groupedGaps = useMemo(() => {
      const colData = { Open: [], "In Progress": [], Resolved: [] };
      // Perform filtering and sorting once here
      return colData;
  }, [gaps, severityFilter, activeEnvironmentFilter, searchQuery, ttpCache]);
  ```
- In `Reports.jsx`, wrap the `campaigns` mapping reducer in a `useMemo` block depending on `[exercises, gaps]`.

---

## 6. Verification Method

To independently verify the optimizations:
1. **Compilation/Build Check**: Run `npm run build` from the project root directory. Verify that Vite builds the bundle successfully with no syntax or compiler warnings.
2. **React Profiler Verification**:
   - Open the application in a browser.
   - Open React DevTools and start profiling under the **Profiler** tab.
   - Perform these actions:
     - Type rapidly in the MITRE Heatmap search box. Confirm no lag or frame drops occur.
     - Scroll the Attack Path graph. Confirm that the React component does not re-render during scroll (re-render count should remain 0).
     - Hover rapidly over the different phases of the Kill Chain Exposure card on the Dashboard. Confirm that no expensive statistics calculations trigger re-evaluation.
3. **GPU & Memory Check**: Verify that memory usage remains stable during long sessions of navigating the MITRE Heatmap globe.
