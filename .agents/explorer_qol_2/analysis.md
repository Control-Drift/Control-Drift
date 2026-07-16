# Comprehensive UX/UI Quality of Life (QoL) Assessment
**Project**: Eclipse Ops (Iridescence)
**Investigator**: UX/UI QoL Explorer 2
**Date**: 2026-06-15

---

## Executive Summary
This report identifies critical Quality of Life (QoL) issues, layout clipping, navigation friction, missing states, and opportunities for visual theme enhancements in the Eclipse Ops React codebase under `src/`. Concrete component-specific fixes are proposed to improve user experience, responsiveness, and aesthetic alignment with the dark-mode iridescent theme.

---

## 1. Layout Inconsistencies, Clipped Elements & Overflow Issues

### 1.1 Dashboard Grid Responsive Squishing
- **Observation**:
  - Component: `src/components/Dashboard.jsx` (lines 275 and 336)
  - Code: `<div className="slide-in-staggered" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '25px', ... }}>`
  - Issue: The grid columns are set to a fixed `repeat(3, 1fr)` without responsive media queries. When the browser width is reduced, or on smaller displays, the cards squish horizontally. The large metric values (e.g., `4rem` in `Weighted Residual Risk` and `Remediation Resolution Rate` cards) overlap or clip outside their parent borders.
- **Proposed Fix**:
  - Define a responsive class in `src/index.css` (e.g., `.dashboard-grid`) using CSS grid with `grid-template-columns: repeat(auto-fit, minmax(300px, 1fr))` instead of inline style definitions of `repeat(3, 1fr)`.
  - Introduce scaling fonts using standard media queries or `clamp()` (e.g., `font-size: clamp(2.5rem, 5vw, 4rem)`).

### 1.2 AttackPath SVG Laser Web Horizontal Alignment & Clipping
- **Observation**:
  - Component: `src/components/AttackPath.jsx` (lines 472-479)
  - Code:
    ```javascript
    <div ref={containerRef} className="glass-panel" style={{ flex: 1, position: 'relative', overflowX: 'auto', ... }}>
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: scrollHeight, ... }}>
    ```
  - Issue: The parent `.glass-panel` container is scrollable horizontally (`overflowX: 'auto'`) with child content width set to `width: 'max-content'` (line 521). The SVG layer is absolutely positioned with `width: '100%'`. This matches the *clientWidth* (visible viewport width) of the container, rather than its *scrollWidth*. If the user scrolls horizontally to view later phases, the SVG does not span the entire width. Consequently, laser lines drawn to off-screen nodes are clipped, and the lines fail to align with the nodes as the user scrolls.
- **Proposed Fix**:
  - Dynamically track and update `scrollWidth` in the component state, similarly to `scrollHeight`:
    ```javascript
    const [scrollWidth, setScrollWidth] = useState('100%');
    // inside useEffect:
    setScrollWidth(containerRef.current.scrollWidth);
    ```
  - Alternatively, nest the `<svg>` overlay inside the scrollable content container `<div style={{ display: 'flex', padding: '40px', gap: '20px', width: 'max-content', ... }}>` so that it naturally inherits the full scrollable bounds of the content.

### 1.3 Fixed Modal Heights & Scrolling Limitations
- **Observation**:
  - Components: `src/components/GapTracker.jsx` (line 587) and `src/components/Reports.jsx` (line 803)
  - Code: `style={{ width: '100%', maxWidth: '1400px', height: '85vh', ... }}`
  - Issue: Logging modals (manual gaps and external campaigns) have fixed heights (`85vh`) with multiple textareas and multi-select forms. On low-resolution screens, these forms overflow the modal bounds, causing double scrollbars or hiding crucial buttons (like "Save Gap" / "Submit") at the bottom of the viewport.
- **Proposed Fix**:
  - Restructure the modal style to have a flexible height with scrolling restricted to the content container:
    - Set `max-height: '90vh'`, `height: 'auto'`.
    - Apply `overflow-y: 'auto'` strictly to the form-body container, and keep the header and footer fixed.

### 1.4 ExerciseWizard Step 3 Grid Squishing
- **Observation**:
  - Component: `src/components/ExerciseWizard.jsx` (line 1342)
  - Code: `style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', ... }}`
  - Issue: In Step 3 (Simulation Events), event cards display four dropdown selections side-by-side: Expected Outcome, Actual Outcome, Coverage Rating, and Gap Severity. On standard or narrow displays, these dropdowns squish to the point where text option labels are clipped, and the dropdown arrows overlap the text.
- **Proposed Fix**:
  - Change `gridTemplateColumns` to `repeat(auto-fit, minmax(180px, 1fr))` or stack them in two columns of two (`repeat(2, 1fr)`) on narrower screens using a media query class.

---

## 2. Missing Loading / Empty / Error States

### 2.1 AIAssistant Initial Welcome State
- **Observation**:
  - Component: `src/components/AIAssistant.jsx` (line 208)
  - Issue: When the chat panel is opened for the first time, it is completely empty. There is no welcome message, greeting, or guidance.
- **Proposed Fix**:
  - Add an initial welcome message when `messages.length === 0`:
    ```javascript
    {messages.length === 0 && (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
        <Sparkles size={32} color="var(--accent-primary)" style={{ marginBottom: '12px' }} />
        <h3>Iridescence Copilot</h3>
        <p style={{ fontSize: '0.85rem' }}>Ask me to help write rule signatures, draft remediation plans, or explore MITRE techniques.</p>
      </div>
    )}
    ```

### 2.2 Kanban Column Empty States
- **Observation**:
  - Component: `src/components/GapTracker.jsx` (line 482)
  - Issue: When a Kanban column (Open, In Progress, Resolved) has no gaps, it displays a blank vertical channel. This looks incomplete and does not prompt the user to drag items there.
- **Proposed Fix**:
  - Render a dashed drop zone card when a column is empty:
    ```javascript
    {colGaps.length === 0 && (
      <div style={{ border: '2px dashed var(--glass-border)', borderRadius: '8px', padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        No gaps in this state. Drag cards here to transition status.
      </div>
    )}
    ```

### 2.3 CommandPalette Empty State & Suggestions
- **Observation**:
  - Component: `src/components/CommandPalette.jsx` (line 129)
  - Issue: When no results match the search query, the palette displays a generic "No results found" message.
- **Proposed Fix**:
  - Display helpful suggestions when search yields no matches, such as: "Try searching for: 'Dashboard', 'MITRE', 'GAP-'".

### 2.4 ExerciseWizard Step 2 Empty Payload CTA
- **Observation**:
  - Component: `src/components/ExerciseWizard.jsx` (line 1265)
  - Issue: In Step 3, if the user skipped generating a payload in Step 2, the left-hand column displays a static warning message: "No attack chain was created in Step 2." This forces the user to navigate back to Step 2 to generate it.
- **Proposed Fix**:
  - Add a direct Call-To-Action button in the empty state card to let the user auto-generate the campaign payload inline without losing their place:
    ```javascript
    <button className="btn" onClick={generatePayloads} style={{ marginTop: '10px' }}>Auto-Generate Now</button>
    ```

---

## 3. Unintuitive Data Entry & Navigation Flow Friction

### 3.1 CommandPalette Gap Navigation Sync
- **Observation**:
  - Component: `src/components/CommandPalette.jsx` (line 57 & 89)
  - Issue: Clicking on a tracked gap search result (e.g., `View Gap: GAP-1234`) navigates the user to `/gaps` but does *not* open the gap. The user has to manually re-locate the gap card on the Kanban board.
- **Proposed Fix**:
  - Change the gap item's navigation behavior to pass the gap ID in the router state:
    ```javascript
    // In items array creation (line 57)
    path: '/gaps',
    state: { openGapId: g.id }
    
    // In executeAction (line 89)
    navigate(item.path, { state: item.state });
    ```
  - This matches the state reader already implemented in `GapTracker.jsx` line 147.

### 3.2 GapTracker Kanban "Risk Accepted" Drop Zone
- **Observation**:
  - Component: `src/components/GapTracker.jsx` (line 482 & 521)
  - Issue: Gaps can be placed in "Risk Accepted" status, but this column is hidden from the main Kanban board and is instead displayed in a separate `<details>` section at the bottom. However, this section does *not* support drag-and-drop drop events (no `onDragOver` or `onDrop` handlers). If a user attempts to drag a card to the "Risk Accepted" drawer, it fails. The *only* way to transition a gap to "Risk Accepted" is to open the gap details modal and select the status dropdown.
- **Proposed Fix**:
  - Implement drag-and-drop handlers on the `<details>` header/body for the "Risk Accepted" column:
    ```javascript
    <details 
      onDragOver={(e) => handleDragOver(e, 'Risk Accepted')}
      onDrop={(e) => handleDrop(e, 'Risk Accepted')}
      ...
    >
    ```
  - This allows a seamless drag transition to "Risk Accepted" just like any other column.

### 3.3 AIAssistant Context Visibility
- **Observation**:
  - Component: `src/components/AIAssistant.jsx` (line 195)
  - Issue: The assistant displays a small badge: `Context: Active`. However, there is no way for the user to inspect what active application context (objectives, TTPs, gaps) is currently loaded and shared with the AI.
- **Proposed Fix**:
  - Add a hover tooltip or click-to-expand popover on the context badge that displays a clean JSON or bulleted representation of `activeAiContext` details.

---

## 4. Dark-Mode Iridescent Theme & Micro-Animation Opportunities

### 4.1 Navigation Hover Iridescent Sliding Accents
- **Observation**:
  - Component: `src/App.jsx` (aside sidebar, line 53)
  - Opportunity: Sidebar links currently use a static hover background (`var(--glass-bg)`). Adding an animated, sliding gradient border or glowing side indicator would reinforce the "iridescent" theme.
- **Proposed Fix**:
  - Create a CSS transition class for `.nav-item` in `src/index.css` that draws an iridescent underline or left border on hover and active states using `--iridescent-gradient`.

### 4.2 Interactive Kanban Card Transitions & Glows
- **Observation**:
  - Component: `src/components/GapTracker.jsx` (line 90, `MemoizedGapCard`)
  - Opportunity: Gaps can be dragged across the board. While hovering over columns, adding a glowing border effect (`box-shadow: 0 0 15px rgba(0, 188, 212, 0.2)`) on the columns would enhance the sci-fi cyberpunk HUD feel.
- **Proposed Fix**:
  - Add a transition to the column container border and background colors, triggering a neon color change on `dragOverCol === col`.

### 4.3 Flowing Laser Lines in AttackPath
- **Observation**:
  - Component: `src/components/AttackPath.jsx` (line 513)
  - Opportunity: The laser lines use standard dash-arrays with `laserPulse` animation. Making this pulse flow dynamically across the path curves using SVG `stroke-dashoffset` transition styles would visually resemble a real network data packet.
- **Proposed Fix**:
  - Create a custom animation in CSS:
    ```css
    @keyframes flowingLaser {
      0% { stroke-dashoffset: 100; }
      100% { stroke-dashoffset: 0; }
    }
    ```
  - Apply it to the highlighting overlay path: `animation: flowingLaser 2s linear infinite;`.

---

## Summary of Fix Priority & Impact

| Priority | Component | Issue | Impact | Difficulty |
| --- | --- | --- | --- | --- |
| **High** | `AttackPath.jsx` | SVG overlay width clips off-screen laser lines | High (Fixes broken visual rendering) | Medium |
| **High** | `GapTracker.jsx` | No drag-and-drop support for "Risk Accepted" | High (Fixes feature flow break) | Medium |
| **Medium** | `CommandPalette.jsx` | Gap search result navigation does not open gap | Medium (Improves search usage) | Easy |
| **Medium** | `Dashboard.jsx` | Responsive card layout grid squishing / clipping | Medium (Fixes smaller screens styling) | Easy |
| **Medium** | `AIAssistant.jsx` | Empty initial chat panel / hidden AI context | Medium (Improves AI UX clarity) | Easy |
| **Low** | `App.jsx` | Static sidebar nav hover styles | Low (Aesthetic improvement) | Easy |
