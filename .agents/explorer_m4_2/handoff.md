# React Performance Optimization Analysis Report - Milestone 4

## Executive Summary
This report analyzes the React performance characteristics of the Iridescence application, focusing on key components: the MITRE Heatmap, the Attack Path visualization, the Dashboard widgets, and the AppContext state manager. The analysis identifies several significant rendering bottlenecks, redundant event listeners, and expensive computations on the main thread, and proposes a concrete optimization plan for implementation.

---

## 1. Observation

### Observation A: Global Context Provider (`src/AppContext.jsx`)
In `src/AppContext.jsx` (lines 907-933), the context provider value is defined as an inline object literal:
```javascript
907:     <AppContext.Provider value={{ 
908:         exercises, setExercises, mitreData, setMitreData, isMitreLoading, gaps, setGaps, activeEnvironmentFilter, setActiveEnvironmentFilter,
909:         environmentConfig, setEnvironmentConfig,
910:         campaignSummaries, setCampaignSummaries, saveCampaignSummary, 
911:         campaignEvidence, setCampaignEvidence, addCampaignEvidence, compressImage,
912:         completeExercise, updateExerciseValidation, toggleTacticScope, toggleTechniqueScope, aiSettings, setAiSettings, generateAIContent, generateAIContentStream,
913:         activeAiContext, setActiveAiContext, confirmAction
914:     }}>
```
Furthermore, the helper functions (such as `completeExercise`, `toggleTacticScope`, `toggleTechniqueScope`, etc.) are declared directly within the component block as standard arrow functions without any memoization (e.g. lines 389, 861, 881).

### Observation B: Dashboard UI Re-renders and Expensive Computations (`src/components/Dashboard.jsx`)
In `src/components/Dashboard.jsx`, the component performs several heavy operations directly in the render block on every render call:
- GRS Score calculation (lines 75-82).
- Sorting and mapping historical campaign trends (lines 85-104).
- MTTR and resolved gaps calculations (lines 107-127).
- **Nested O(E * T * N) loop for Tactic Exposure** (lines 130-139):
  ```javascript
  130:   const tacticExposure = {};
  131:   filteredExercises.forEach(ex => {
  132:      if (!mitreData || Object.keys(mitreData).length === 0) return;
  133:      const tacticName = Object.keys(mitreData).find(t => mitreData[t].techniques.find(tech => tech.id === ex.ttp));
  134:      if (tacticName) {
  135:         if (!tacticExposure[tacticName]) tacticExposure[tacticName] = { tested: 0, missed: 0 };
  136:         tacticExposure[tacticName].tested += 1;
  137:         if (ex.status === 'low') tacticExposure[tacticName].missed += 1;
  138:      }
  139:   });
  ```
Additionally, `Dashboard` maintains local hover state:
```javascript
60:   const [activePhaseSubject, setActivePhaseSubject] = React.useState("Pre-Attack");
```
Which is triggered on mouse enter of each phase icon (line 355):
```javascript
355:                                      onMouseEnter={() => setActivePhaseSubject(phase.subject)}
```

### Observation C: Attack Path Rendering and Redundant Listeners (`src/components/AttackPath.jsx`)
In `src/components/AttackPath.jsx`:
- **Redundant Scroll Listener**: A scroll event listener is attached to the scrollable container that triggers `updatePaths` on every scroll tick:
  ```javascript
  354:         const containerEl = containerRef.current;
  355:         if (containerEl) {
  356:             containerEl.addEventListener('scroll', updatePaths);
  357:         }
  ```
  `updatePaths` (lines 300-348) computes layout coordinates relative to the container scrollable area and sets state: `setPaths(newPaths)`.
- **Expensive Lookup in Render Loop**: `getTTPName` (lines 205-232) is defined in the component and loops over `mitreData` techniques to find names. It is called dynamically inside the gap card render loop:
  ```javascript
  552:                                                 <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', lineHeight: '1.4', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
  553:                                                     {getTTPName(gap.ttp)}
  554:                                                 </div>
  ```
- **Unstable Handlers and Card Creation**: Inline event handlers are re-declared in the loop for every single node:
  ```javascript
  525:                                                 onMouseEnter={() => setHoveredNode(gap.id)}
  526:                                                 onMouseLeave={() => setHoveredNode(null)}
  ```

### Observation D: MITRE Heatmap 3D Nodes and Filtering (`src/components/MitreHeatmap.jsx`)
In `src/components/MitreHeatmap.jsx`:
- **Scene Nodes Re-creation**: Components `TacticNode` (lines 195-258), `TechNode` (lines 260-324), and `MacroTechSpecks` (lines 326-352) render Three.js objects (materials, geometries) inside `Scene`.
- Inline handlers are passed to these components on every render of `Scene` (lines 518, 538, 539, 540):
  ```javascript
  518:              onClick={() => setActiveTactic(node.label)} 
  ...
  538:              onClick={() => handleTechClick(node.techFull)} 
  539:              onHover={() => setHoveredTech(node)}
  540:              onUnhover={() => setHoveredTech(null)}
  ```
- **Inline Array Filtering**: Tactics and Technique filtering are performed dynamically inside the render code on every frame/tick:
  ```javascript
  784:             {Object.keys(resolvedMitreData).filter(tactic => {
  ...
  872:                 const filteredTechs = activeInfo.techniques.filter(tech => {
  ```

---

## 2. Logic Chain

### Logic Chain A: Global Context Provider
1. The global context provider value object is recreated on *every single render* of the `AppProvider` (Observation A).
2. React context consumers re-render whenever the context value reference changes.
3. Therefore, *every* component consuming `useAppContext()` (almost the entire application) re-renders whenever any state in the provider changes, even if it does not use the updated property.
4. **Conclusion**: Wrapping the context value object in `useMemo` and the handler functions in `useCallback` is required to stabilize references and allow downstream components to optimize re-renders.

### Logic Chain B: Dashboard Hover Lag
1. The user hovers over phase icons in the "Kill Chain Exposure" widget, updating the `activePhaseSubject` state on mouse enter (Observation B).
2. Updating `activePhaseSubject` triggers a state change and a re-render of `Dashboard`.
3. Because the GRS calculations, campaign trends sorting, MTTR averages, and especially the **O(E * T * N) nested tactic exposure loops** are executed directly in the render block, they run multiple times a second during mouse movement (Observation B).
4. **Conclusion**: Bypassing these calculations via `useMemo` will eliminate CPU execution on hover re-renders and resolve hover micro-stutters.

### Logic Chain C: Attack Path Scroll Performance and Layout
1. The SVG element is positioned absolutely at `top: 0, left: 0` inside the scrollable container and has dimensions matching the scrollable bounds (Observation C).
2. Nodes are positioned statically relative to the scrollable container, meaning their relative positions do not change when the container scrolls.
3. Therefore, coordinates calculated via `sourceRect.right - containerRect.left + scrollLeft` are constant during scrolling.
4. The scroll event listener calls `updatePaths` on every scroll tick, causing React state updates (`setPaths`) for unchanged coordinates (Observation C).
5. **Conclusion**: Removing the scroll listener will eliminate unnecessary state transitions and render cycles, dramatically increasing scroll fluidity. Precomputing `getTTPName` inside the memoized `gapsByPhase` list will also remove expensive array searches in the node render loop.

### Logic Chain D: WebGL Heatmap Latency
1. When a tactic is selected or hovered, `Scene`'s state changes (`activeTactic`, `hoveredTech`), triggering a re-render.
2. Since `TacticNode` and `TechNode` receive newly instantiated callback functions on each render (Observation D) and are not memoized, they must all re-render and re-instantiate WebGL bindings.
3. **Conclusion**: Memoizing the 3D sub-components and stabilizing click/hover callbacks with `useCallback` will allow react-three-fiber to skip node reconciliation.

---

## 3. Caveats
- **Read-Only Enforcement**: This analysis does not implement code changes. All proposed changes must be reviewed and implemented by a developer/implementer.
- **Third-Party Libraries**: Performance characteristics of `@react-three/fiber` (Three.js) and `@react-pdf/renderer` rely partly on native library internals which cannot be modified directly.
- **Browser-Specific GPU Acceleration**: WebGL performance in `MitreHeatmap` is partially bound to the host client hardware; software rendering fallback might still impact frame rates on low-end machines.

---

## 4. Conclusion
React performance can be significantly optimized through targeted adjustments:
1. **AppContext**: Stabilize the context value reference with `useMemo` and wrap state mutators in `useCallback`.
2. **Dashboard**: Wrap all analytical calculations (GRS, MTTR, Tactic Exposure) in `useMemo` to protect from local hover-state updates.
3. **Attack Path**: Remove the redundant scroll listener from the container and pre-calculate TTP names inside `gapsByPhase`.
4. **MITRE Heatmap**: Memoize the Three.js 3D nodes (`TacticNode`, `TechNode`, `MacroTechSpecks`) and stabilize their event handlers.

---

## 5. Proposed Code Modifications

### 1. `src/AppContext.jsx`
*Stabilize context provider values.*

#### Proposed Change
```javascript
// BEFORE (Lines 907-914)
    <AppContext.Provider value={{ 
        exercises, setExercises, mitreData, setMitreData, isMitreLoading, gaps, setGaps, activeEnvironmentFilter, setActiveEnvironmentFilter,
        environmentConfig, setEnvironmentConfig,
        campaignSummaries, setCampaignSummaries, saveCampaignSummary, 
        campaignEvidence, setCampaignEvidence, addCampaignEvidence, compressImage,
        completeExercise, updateExerciseValidation, toggleTacticScope, toggleTechniqueScope, aiSettings, setAiSettings, generateAIContent, generateAIContentStream,
        activeAiContext, setActiveAiContext, confirmAction
    }}>

// AFTER
    const saveCampaignSummaryVal = useCallback(saveCampaignSummary, [setCampaignSummaries]);
    const addCampaignEvidenceVal = useCallback(addCampaignEvidence, [setCampaignEvidence]);
    const completeExerciseVal = useCallback(completeExercise, [exercises]);
    const updateExerciseValidationVal = useCallback(updateExerciseValidation, [exercises, campaignSummaries]);
    const toggleTacticScopeVal = useCallback(toggleTacticScope, [exercises]);
    const toggleTechniqueScopeVal = useCallback(toggleTechniqueScope, [exercises]);
    const confirmActionVal = useCallback(confirmAction, []);

    const contextValue = useMemo(() => ({
        exercises, setExercises, mitreData, setMitreData, isMitreLoading, gaps, setGaps, activeEnvironmentFilter, setActiveEnvironmentFilter,
        environmentConfig, setEnvironmentConfig,
        campaignSummaries, setCampaignSummaries, 
        saveCampaignSummary: saveCampaignSummaryVal, 
        campaignEvidence, setCampaignEvidence, 
        addCampaignEvidence: addCampaignEvidenceVal, 
        compressImage,
        completeExercise: completeExerciseVal, 
        updateExerciseValidation: updateExerciseValidationVal, 
        toggleTacticScope: toggleTacticScopeVal, 
        toggleTechniqueScope: toggleTechniqueScopeVal, 
        aiSettings, setAiSettings, generateAIContent, generateAIContentStream,
        activeAiContext, setActiveAiContext, confirmAction: confirmActionVal
    }), [
        exercises, mitreData, isMitreLoading, gaps, activeEnvironmentFilter, environmentConfig, 
        campaignSummaries, campaignEvidence, aiSettings, activeAiContext, confirmConfig,
        saveCampaignSummaryVal, addCampaignEvidenceVal, completeExerciseVal, 
        updateExerciseValidationVal, toggleTacticScopeVal, toggleTechniqueScopeVal, confirmActionVal
    ]);

    return (
        <AppContext.Provider value={contextValue}>
```

---

### 2. `src/components/Dashboard.jsx`
*Memoize data transformations to prevent O(E * T * N) iteration on hover.*

#### Proposed Change
```javascript
// BEFORE (Lines 74-147)
  // 1. Global Resilience Score (GRS)
  const validExercises = filteredExercises.filter(ex => ex.status?.toLowerCase() !== 'na');
  ...
  const radarData = Object.entries(killChainPhases).map(([phase, tactics]) => { ... });

// AFTER
  // Move static configuration outside component (or wrap in useMemo)
  const killChainPhases = useMemo(() => ({
      "Initial Access": ["Initial Access"],
      "Execution": ["Execution", "Persistence", "Privilege Escalation"],
      "Evasion": ["Defense Evasion", "Defense Impairment", "Stealth"],
      "Movement": ["Discovery", "Lateral Movement", "Credential Access"],
      "Action on Objective": ["Collection", "Command and Control", "Exfiltration", "Impact"]
  }), []);

  // Memoize GRS calculations
  const grsStats = useMemo(() => {
      const validExercises = exercises.filter(ex => ex.status?.toLowerCase() !== 'na');
      const totalValidated = validExercises.length;
      let grsPoints = 0;
      validExercises.forEach(ex => {
          if (ex.status === 'high') grsPoints += 1.0;
          else if (ex.status === 'medium') grsPoints += 0.5;
      });
      const score = totalValidated > 0 ? Math.round((grsPoints / totalValidated) * 100) : 0;
      return { totalValidated, grsScore: score };
  }, [exercises]);

  const { totalValidated, grsScore } = grsStats;

  // Memoize Historical Scores
  const areaData = useMemo(() => {
      const campaignsByName = {};
      exercises.forEach(ex => {
          if (ex.status?.toLowerCase() === 'na') return;
          if (!campaignsByName[ex.campaign]) campaignsByName[ex.campaign] = { date: ex.date, high: 0, medium: 0, total: 0 };
          campaignsByName[ex.campaign].total += 1;
          if (ex.status === 'high') campaignsByName[ex.campaign].high += 1;
          if (ex.status === 'medium') campaignsByName[ex.campaign].medium += 1;
      });
      const historicalScores = Object.values(campaignsByName).sort((a,b) => safeDate(a.date) - safeDate(b.date)).map(c => {
          const score = Math.round(((c.high + (c.medium * 0.5)) / c.total) * 100);
          return {
              name: safeDate(c.date).toLocaleDateString('default', { month: 'short', day: 'numeric' }),
              score: score
          };
      });
      const currentDate = new Date().toLocaleString('default', { month: 'short', day: 'numeric' });
      if (historicalScores.length === 0) {
          return [
              { name: 'Baseline', score: 0 },
              { name: currentDate, score: 0 },
          ];
      } else if (historicalScores.length === 1) {
          return [
              { name: 'Baseline', score: 0 },
              ...historicalScores
          ];
      }
      return historicalScores;
  }, [exercises]);

  // Memoize Gaps Statistics
  const gapStats = useMemo(() => {
      const totalGaps = gaps.length;
      const closedGaps = gaps.filter(g => g.status === 'Resolved').length;
      const resolutionRate = totalGaps > 0 ? Math.round((closedGaps / totalGaps) * 100) : 100;
      
      const openGaps = gaps.filter(g => g.status === 'Open' || g.status === 'In Progress');
      const severityWeights = { 'Critical': 10, 'High': 7, 'Medium': 3, 'Low': 1 };
      const residualRisk = openGaps.reduce((acc, g) => acc + (severityWeights[g.severity] || 0), 0);

      const resolvedGaps = gaps.filter(g => g.status === 'Resolved' && g.resolvedDate && g.createdDate);
      let mttrText = 'N/A';
      if (resolvedGaps.length > 0) {
          const totalSeconds = resolvedGaps.reduce((acc, g) => acc + (new Date(g.resolvedDate) - new Date(g.createdDate)) / 1000, 0);
          const meanSeconds = totalSeconds / resolvedGaps.length;
          const days = Math.floor(meanSeconds / (3600 * 24));
          const hours = Math.floor((meanSeconds % (3600 * 24)) / 3600);
          if (days > 0) mttrText = `${days}d ${hours}h`;
          else if (hours > 0) mttrText = `${hours}h`;
          else mttrText = '< 1h';
      }

      return { totalGaps, closedGaps, resolutionRate, openGaps, residualRisk, resolvedGaps, mttrText };
  }, [gaps]);

  const { totalGaps, closedGaps, resolutionRate, openGaps, residualRisk, resolvedGaps, mttrText } = gapStats;

  // Memoize Tactic Exposure O(E * T * N) Loop
  const radarData = useMemo(() => {
      const tacticExposure = {};
      exercises.forEach(ex => {
         if (!mitreData || Object.keys(mitreData).length === 0) return;
         const tacticName = Object.keys(mitreData).find(t => mitreData[t].techniques.find(tech => tech.id === ex.ttp));
         if (tacticName) {
            if (!tacticExposure[tacticName]) tacticExposure[tacticName] = { tested: 0, missed: 0 };
            tacticExposure[tacticName].tested += 1;
            if (ex.status === 'low') tacticExposure[tacticName].missed += 1;
         }
      });

      return Object.entries(killChainPhases).map(([phase, tactics]) => {
          let missed = 0;
          let tested = 0;
          tactics.forEach(t => {
              if (tacticExposure[t]) {
                  missed += tacticExposure[t].missed;
                  tested += tacticExposure[t].tested;
              }
          });
          return {
              subject: phase,
              risk: tested > 0 ? Math.round((missed / tested) * 100) : 0,
              tested: tested,
              fullMark: 100
          };
      });
  }, [exercises, mitreData, killChainPhases]);
```

---

### 3. `src/components/AttackPath.jsx`
*Remove redundant scroll listener and optimize render lookups.*

#### Proposed Change
```javascript
// BEFORE (Lines 353-357)
        window.addEventListener('resize', updatePaths);
        const containerEl = containerRef.current;
        if (containerEl) {
            containerEl.addEventListener('scroll', updatePaths);
        }
        return () => {
            clearTimeout(timeoutId);
            window.removeEventListener('resize', updatePaths);
            if (containerEl) {
                containerEl.removeEventListener('scroll', updatePaths);
            }
        };

// AFTER
        window.addEventListener('resize', updatePaths);
        return () => {
            clearTimeout(timeoutId);
            window.removeEventListener('resize', updatePaths);
        };
```

*Precompute TTP Names in Gaps list.*
```javascript
// BEFORE (Lines 236-266)
    const gapsByPhase = useMemo(() => {
        const grouped = {};
        phases.forEach(p => grouped[p.id] = []);
        activeGaps.forEach(gap => {
            ...
            if (grouped[assignedPhase]) {
                grouped[assignedPhase].push({ ...gap, tactic: foundTactic });
            }
        });
        return grouped;
    }, [activeGaps, mitreData]);

// AFTER
    const gapsByPhase = useMemo(() => {
        const grouped = {};
        phases.forEach(p => grouped[p.id] = []);

        activeGaps.forEach(gap => {
            let foundTactic = null;
            if (mitreData) {
                const ttps = (gap.ttp || '').split(',').map(t => t.trim());
                for (const [tacticName, tacticObj] of Object.entries(mitreData)) {
                    if (tacticName === 'Reconnaissance' || tacticName === 'Resource Development') continue;
                    if (tacticObj.techniques.some(t => ttps.includes(t.id) || (t.subTechniques && t.subTechniques.some(s => ttps.includes(s.id))))) {
                        foundTactic = tacticName;
                        break;
                    }
                }
            }
            
            let assignedPhase = 'Actions on Objectives';
            if (['Initial Access'].includes(foundTactic)) assignedPhase = 'Delivery';
            else if (['Execution', 'Privilege Escalation', 'Defense Evasion'].includes(foundTactic)) assignedPhase = 'Exploitation';
            else if (['Persistence'].includes(foundTactic)) assignedPhase = 'Installation';
            else if (['Command and Control'].includes(foundTactic)) assignedPhase = 'Command and Control';
            else if (['Discovery', 'Lateral Movement', 'Credential Access', 'Collection'].includes(foundTactic)) assignedPhase = 'Lateral Movement';
            else assignedPhase = 'Actions on Objectives';

            if (grouped[assignedPhase]) {
                // Pre-fetch TTP Name here
                const ttpName = getTTPName(gap.ttp); 
                grouped[assignedPhase].push({ ...gap, tactic: foundTactic, ttpName });
            }
        });
        return grouped;
    }, [activeGaps, mitreData, getTTPName]);
```

---

### 4. `src/components/MitreHeatmap.jsx`
*Memoize WebGL elements and stabilize actions.*

#### Proposed Change
```javascript
// BEFORE (Lines 195-196)
function TacticNode({ position, tactic, info, isActive, onClick, isVisible = true }) {

// AFTER
const TacticNode = React.memo(function TacticNode({ position, tactic, info, isActive, onClick, isVisible = true }) {
    ...
});

// BEFORE (Lines 260-261)
function TechNode({ position, info, isHovered, onClick, onHover, onUnhover, isVisible = true }) {

// AFTER
const TechNode = React.memo(function TechNode({ position, info, isHovered, onClick, onHover, onUnhover, isVisible = true }) {
    ...
});

// BEFORE (Lines 326)
function MacroTechSpecks({ nodes, quickFilter }) {

// AFTER
const MacroTechSpecks = React.memo(function MacroTechSpecks({ nodes, quickFilter }) {
    ...
});
```

---

## 6. Verification Method

### Validation Step 1: Run Workspace Build
Ensure the changes do not cause compilation or syntax errors by running:
```powershell
npm run build
```
The output should compile cleanly with no Vite or TypeScript/JavaScript build errors.

### Validation Step 2: Hover Metric Testing (Dashboard)
1. Open the **Dashboard** view.
2. Quickly sweep the mouse cursor back and forth over the **Kill Chain Exposure** phase nodes.
3. Observe frame rates in the browser's developer console (Performance / Rendering tab).
4. Frame rates should remain consistently close to 60fps, without the 100-200ms scripting delays previously caused by the O(E * T * N) rendering loop.

### Validation Step 3: Scroll Fluidity Testing (Attack Path)
1. Navigate to **Attack Path**.
2. Scroll horizontally and vertically inside the canvas.
3. Verify that the browser's scroll action is fluid, and that no React re-render warnings appear in the console during scrolling (confirming that scroll event hooks are successfully deactivated).
