# Handoff Report — explorer_qa_m1_1

## 1. Observation
We observed and inspected the following code implementations and behaviors in `C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops`:
*   **GRS Fallback Calculation (`src/components/Dashboard.jsx:132-139`)**:
    ```javascript
    const valid = contextExercises.filter(ex => ex.status?.toLowerCase() !== 'na');
    const totalValidated = valid.length;
    let points = 0;
    valid.forEach(ex => {
        if (ex.status === 'high') points += 1.0;
        else if (ex.status === 'medium') points += 0.5;
    });
    const grsScore = totalValidated > 0 ? Math.round((points / totalValidated) * 100) : 0;
    ```
*   **GRS Backend Calculation (`mock_database.js:656-663`)**:
    ```javascript
    const valid = db.exercises.filter(ex => ex.status?.toLowerCase() !== 'na');
    const totalValidated = valid.length;
    let points = 0;
    valid.forEach(ex => {
        if (ex.status === 'high') points += 1.0;
        else if (ex.status === 'medium') points += 0.5;
    });
    const grs = totalValidated > 0 ? Math.round((points / totalValidated) * 100) : 0;
    ```
*   **Residual Risk Formula (`mock_database.js:670-673` and `src/components/Dashboard.jsx:145-148`)**:
    ```javascript
    const open = db.gaps.filter(g => g.status === 'Open' || g.status === 'In Progress');
    const openGapsCount = open.length;
    const severityWeights = { 'Critical': 10, 'High': 7, 'Medium': 3, 'Low': 1 };
    const residualRisk = open.reduce((acc, g) => acc + (severityWeights[g.severity] || 0), 0);
    ```
*   **Missing Persistence in `updateExerciseValidation` (`src/AppContext.jsx:834-842`)**:
    ```javascript
        if (['prevented', 'alerted', 'logged'].includes(newOutcomeStatus)) {
            setGaps(prev => prev.map(gap => {
                if (String(gap.id) === String(gapObj.id) && gap.status !== 'Resolved') {
                    return { ...gap, status: 'Resolved', resolvedDate: new Date().toISOString(), resolutionNotes: (gap.resolutionNotes || '') + '\n[System] Auto-resolved via inline validation.' };
                }
                return gap;
            }));
        }
    ```
    This updates the state but does not call `dbAdapter.saveData('gaps', next)`.
*   **Missing Persistence in `handleDrop` (`src/components/GapTracker.jsx:232-240`)**:
    ```javascript
    if (gap.status === 'Resolved') {
        setExercises(prev => prev.map(ex => {
            const gapTTPs = (gap.ttp || '').split(',').map(t => t.trim());
            if (gapTTPs.includes(ex.ttp) && ex.simulation === gap.simulation) {
                return { ...ex, status: 'low' };
            }
            return ex;
        }));
    }
    ```
    This calls `setExercises` but does not save the exercises list using `dbAdapter.saveData('exercises', ...)`.
*   **Attack Path Width Clipping (`src/components/AttackPath.jsx:569`)**:
    ```html
    <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: typeof scrollHeight === 'number' ? `${scrollHeight}px` : scrollHeight, pointerEvents: 'none', zIndex: 0, overflow: 'visible' }}>
    ```
    Absolute child of a scroll container with `width: '100%'` clips to visible viewport width.
*   **Battle Globe SVG render (`src/components/BattleGlobe.jsx:83-112`)**:
    Contains `<svg width="180" height="180"...>` and `<feTurbulence...>` filters. There are no Three.js or WebGL contexts. The Security Posture page renders `MitreHeatmap.jsx`, which *does* use Three.js and correctly disposes geometries (`geometry.dispose()` inside `useEffect` in line 89).

## 2. Logic Chain
1.  **Scope Differences in GRS**: The frontend GRS calculation filters out `'Admin Config'` simulations, but the backend `/api/metrics` does not. When the REST API is used, `contextExercises` is paginated to 50 items, meaning any frontend fallback calculation on this state will be incorrect.
2.  **Persistence Leaks**: Auto-save effects were removed from `AppContext.jsx` (lines 434-446) for gaps and exercises, but the local fallback branch of `updateExerciseValidation` and `handleDrop` in `GapTracker.jsx` update the React state without manually calling `dbAdapter.saveData()`. Therefore, those changes are lost on page reload.
3.  **Layout bugs**: An absolutely positioned SVG with `width: '100%'` inside a container with `overflow-x: auto` is only sized to the container's visible width. When scrolled horizontally, the SVG is clipped, making paths drawn on the right side disappear.
4.  **No Three.js in BattleGlobe**: Code inspection of `src/components/BattleGlobe.jsx` shows it is entirely 2D SVG filters, and it is rendered on the simulation page, not the posture page. The actual 3D posture component is `MitreHeatmap.jsx`, which correctly disposes of its sphere geometry.

## 3. Caveats
*   We did not run the Vite server or open a browser; all observations are based on read-only code analysis.
*   No modifications were made to the source files as per constraints.
*   We assume that Chrome or Edge is available on the local OS at the paths listed in `run_e2e.js` if the E2E script is executed.

## 4. Conclusion
The codebase is highly functional and incorporates a robust local regression testing framework. However, there are significant data discrepancies between frontend/backend calculations, sync/persistence leaks when using local/fallback database adapters, and layout glitches in the Attack Path SVG canvas. Correcting these will require aligning calculations, adding manual database save calls for gaps/exercises, and adjusting the Attack Path SVG width styles.

## 5. Verification Method
1.  **E2E Test Run**: Propose to run `npm run test:e2e` in the `eclipse-ops` directory. The test harness will start mock servers and execute Tier 1-5 tests.
2.  **Code Inspection**:
    *   Inspect `analysis.md` at `C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\.agents\explorer_qa_m1_1\analysis.md` for detailed results.
    *   Inspect `src/AppContext.jsx`, `src/components/AttackPath.jsx`, `src/components/BattleGlobe.jsx`, and `mock_database.js` to verify findings.
