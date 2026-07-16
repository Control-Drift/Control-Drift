# Handoff Report — UI/UX QoL Assessment

## 1. Observation
We observed the following UI/UX QoL issues across the React source components under `src/`:

1.  **Sidebar Links Navigation**:
    *   **File**: `src/App.jsx` (Lines 54–74)
    *   **Snippet**: `<Link to="/" style={{ color: 'var(--text-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', borderRadius: '8px', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'var(--glass-bg)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>`
    *   **Styling File**: `src/index.css` (Lines 206–210) defines `.nav-item.active { background: rgba(156, 39, 176, 0.15); color: var(--text-primary); border-left: 3px solid #9c27b0; }`

2.  **MITRE Heatmap Detail Panel overlapping filter dropdown**:
    *   **File**: `src/components/MitreHeatmap.jsx` (Lines 837–839)
    *   **Snippet**: `<div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 10 }}> <EnvironmentDropdown /> </div>`
    *   **Details Panel Snippet (Line 917)**: `<div className="glass-panel animate-fade-in" style={{ position: 'absolute', right: '20px', top: '20px', bottom: '20px', width: '400px', background: 'rgba(5, 5, 8, 0.75)', backdropFilter: 'blur(30px)', display: 'flex', flexDirection: 'column', zIndex: 10, border: '1px solid rgba(192, 132, 252, 0.2)', ... }}`

3.  **TTP Selector modal squishing**:
    *   **File**: `src/components/TTPSelector.jsx` (Lines 37–45)
    *   **Snippet**: `width: activeGroup ? '860px' : '380px', maxWidth: '100vw', ...`
    *   **Form columns wrapper in Reports.jsx (Line 809–818)**:
        ```jsx
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            <div style={{ borderRight: '1px solid var(--glass-border)', overflowY: 'auto' }}>
                <TTPSelector ... />
            </div>
            <div style={{ padding: '25px', flex: 1, overflowY: 'auto', display: 'flex', ... }}>
        ```

4.  **Dashboard Kill Chain Exposure Card Overlap**:
    *   **File**: `src/components/Dashboard.jsx` (Lines 275, 336, 345–353)
    *   **Snippet**: `style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '25px', marginBottom: '40px' }}`

5.  **Attack Path empty state**:
    *   **File**: `src/components/AttackPath.jsx` (Lines 521–522)
    *   **Snippet**: `{phases.map((phase, i) => { const phaseGaps = gapsByPhase[phase.id]; ... return ( ... ) })}` (renders columns with `0 nodes` when `activeGaps.length === 0`).

6.  **AI Assistant offline state**:
    *   **File**: `src/components/AIAssistant.jsx` (Line 129)
    *   **Snippet**: `if (!aiSettings?.apiKey) return null;`

7.  **Command Palette navigation fallback**:
    *   **File**: `src/components/CommandPalette.jsx` (Lines 53–60, 89–92)
    *   **Snippet**: `items.push(...gaps.map(g => ({ name: \`View Gap: \${g.id}\`, path: '/gaps', ... }))); navigate(item.path);`

8.  **Missing Evidence deletion**:
    *   **File**: `src/components/ExerciseWizard.jsx` (Lines 1445–1451)
    *   **Snippet**: `{proc.evidence.map((img, i) => ( <img key={i} src={img} alt="Evidence" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--glass-border)', cursor: 'pointer' }} title="Attached Evidence" onClick={() => setExpandedImage(img)} /> ))}`

---

## 2. Logic Chain
1.  **Sidebar active states**: Since the navigation links in `App.jsx` are standard `Link` tags without class assignments corresponding to path matches, the active route is never selected, failing to apply the `.active` style.
2.  **MITRE Heatmap Filter occlusion**: Since both `EnvironmentDropdown` and the `Expanded Tactic Details Panel` share the absolute position `right: 20px` and the same `zIndex`, the Details Panel overlays the dropdown, blocking interaction with the environment filter.
3.  **TTP Selector modal layout instability**: Dynamic expansion of `TTPSelector` from `380px` to `860px` in a column with no defined flex-basis in `Reports.jsx` and `GapTracker.jsx` causes the right column containing the form inputs to contract, squishing fields on small screen sizes.
4.  **Dashboard layout squishing**: A hardcoded `repeat(3, 1fr)` grid forces the Kill Chain Exposure widget into a narrow container, causing the 5 horizontally aligned nodes to squeeze, overlap, and clip.
5.  **Attack Path empty state failure**: Lacking conditional checks on `activeGaps.length === 0` inside the main layout wrapper leaves the screen rendering a blank grid with "0 nodes" columns, giving the appearance of broken telemetry.
6.  **AI Assistant silence**: By returning `null` when the API key is not configured, the assistant remains unresponsive to clicking the link or using hotkeys, offering no help or setup guidelines.
7.  **Command Palette gap tracking link break**: Navigating to `'/gaps'` without conveying the selected gap ID (`state: { openGapId }`) dumps the user onto the raw board, failing to open the drawer.
8.  **Evidence screenshot delete restriction**: Pushing images into `proc.evidence` without presenting a deletion trigger button locks the state, preventing users from removing wrong screenshots without deleting the entire procedure card.

---

## 3. Caveats
- No code modification was made during this investigation (conforming to read-only constraints).
- Visual layouts were assessed by inspecting styling rules and JSX hierarchy. Responsive behavior was evaluated based on flex/grid rules and hardcoded pixel/percent layouts.
- Performance implications of React rerendering during 3D scene loading in `MitreHeatmap.jsx` were not profiled (assumed out-of-scope for visual layout/QoL pass).

---

## 4. Conclusion
The Eclipse Ops application contains several high-impact UI/UX QoL bugs and design inconsistencies:
- Sidebar active navigation link tracking is non-functional.
- Overlapping controls on the MITRE Heatmap block usability.
- Dynamic modal layouts are unstable, squishing form entries on small screens.
- Command Palette redirects to gap tracking without opening the selected gap.
- Simulation evidence lacks a delete option.
- Key views lack proper empty/inactive states (Attack Path, AI Assistant).

Implementing the concrete fixes proposed in `analysis.md` will resolve these issues.

---

## 5. Verification Method
To verify these findings and check future fixes, inspect the target components and CSS:
1.  **Sidebar active state**: Inspect `src/App.jsx` navigation tags. Verify they use `NavLink` and match active routing.
2.  **Overlap**: In `src/components/MitreHeatmap.jsx`, verify that `EnvironmentDropdown` positions dynamically based on whether the Details Panel is open.
3.  **Command Palette**: Search for a gap and press Enter. Verify the application loads the board and opens the drawer.
4.  **Evidence**: Add a screenshot to an event in `ExerciseWizard`. Verify a delete button appears on the thumbnail and removes the image when clicked.
5.  **Attack Path**: Wipe all active gaps. Verify that a success illustration/message appears instead of empty columns.
