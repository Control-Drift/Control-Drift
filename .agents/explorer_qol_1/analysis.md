# UI/UX Quality of Life (QoL) Assessment Report

## Executive Summary
This report presents the findings of a comprehensive UI/UX QoL assessment of the Eclipse Ops (Iridescence) application. Several interface friction points, layout bugs, and functional gaps have been identified across the React codebase under `src/`. Implementing the proposed modifications will significantly improve application layout stability, reduce user confusion, streamline navigation flows, and enhance visual polished-ness in line with the iridescent dark-mode theme.

---

## Detailed Findings

### Category 1: Layout Inconsistencies, Clipped Elements, and Squishing Issues

#### 1.1. Sidebar Active State & Navigation Style Deficiencies
*   **File Path**: `src/App.jsx` (Lines 48–90) & `src/index.css` (Lines 206–210)
*   **Observation**: The sidebar navigation links are rendered using standard React Router `<Link>` components with inline hover handlers. However, there is no logic to track the active route and apply the `.active` CSS class (defined in `index.css`).
*   **Friction**: The sidebar never highlights the active route. The user has no visual indicator of where they are in the application. Furthermore, the inline hover handlers use imperative JavaScript styling (`onMouseOver`, `onMouseOut`) rather than CSS transitions, which causes jerky styling and ignores keyboard/focus navigation.

#### 1.2. MITRE Heatmap Details Panel Overlaying Filter Dropdown
*   **File Path**: `src/components/MitreHeatmap.jsx` (Lines 837–839, 917)
*   **Observation**: Both the `EnvironmentDropdown` (line 837) and the `Expanded Tactic Details Panel` (line 917) are positioned using absolute positioning at `right: '20px', top: '20px'`. Both are assigned `zIndex: 10`.
*   **Friction**: When a tactic card is expanded, the details drawer completely overlays the `EnvironmentDropdown` filter, blocking the user from filtering the viewport by environment category while viewing details. The overlapping layout is visually messy and breaks context-driven filtering.

#### 1.3. TTP Selector Modal Form Squishing
*   **File Path**: `src/components/TTPSelector.jsx` (Lines 37–45), `src/components/GapTracker.jsx` (Lines 594–600), & `src/components/Reports.jsx` (Lines 810–816)
*   **Observation**: In both `GapTracker.jsx` and `Reports.jsx`, `TTPSelector` is rendered in the left column of a flexbox container modal. The selector is styled to dynamically expand its width from `380px` to `860px` when a technique with sub-techniques is selected (`width: activeGroup ? '860px' : '380px'`).
*   **Friction**: Because the parent containers do not constrain the left column or set a fixed layout flex-basis, this expansion directly squishes the right-side form content (e.g. Campaign Name, Executive Summary, Event inputs). On standard viewports (under 1400px wide), the right-side forms are severely squished or clipped, making text areas and dropdowns virtually unusable.

#### 1.4. Dashboard Kill Chain Exposure Card Overlap
*   **File Path**: `src/components/Dashboard.jsx` (Lines 275, 336, 345–353)
*   **Observation**: The Dashboard view uses a grid structure styled with `gridTemplateColumns: 'repeat(3, 1fr)'` without media queries or responsive wrap. The "Kill Chain Exposure" card lays out five nodes horizontally.
*   **Friction**: The five horizontal nodes require a minimum width of ~400px. At resolutions below 1500px, the card's width drops below 350px. The nodes, lines, and text labels overlap and clip, rendering the visual chain unreadable and broken.

---

### Category 2: Missing Loading & Empty States

#### 2.1. Attack Path Empty State
*   **File Path**: `src/components/AttackPath.jsx` (Lines 470–600)
*   **Observation**: When a user resolves all gaps, `activeGaps.length` becomes `0`. The canvas render logic falls back to drawing empty cyber columns with "0 nodes" labels.
*   **Friction**: The empty grid looks broken or incomplete. There is no positive visual empty state celebrating complete remediation (e.g. "Defensive Perimeter Secure: All identified gaps have been remediated. No chainable threat paths detected.").

#### 2.2. AI Assistant Setup/Offline State
*   **File Path**: `src/components/AIAssistant.jsx` (Line 129)
*   **Observation**: If the user has not configured their API key in Settings, the component returns `null` and remains hidden.
*   **Friction**: If the user clicks "AI Assistant" in the sidebar or presses the global hotkey `Ctrl + J`, nothing happens. They receive no feedback indicating that AI is disabled or explaining how to enable it by configuring an API key.

---

### Category 3: Unintuitive Data Entry & Navigation Flow Friction

#### 3.1. Command Palette Navigation Failure
*   **File Path**: `src/components/CommandPalette.jsx` (Lines 53–60, 89–92) & `src/components/GapTracker.jsx` (Lines 146–152)
*   **Observation**: Searching for a gap and hitting Enter executes `navigate('/gaps')`. It does not supply the `openGapId` state parameter that `GapTracker` relies on to open the details drawer.
*   **Friction**: The user expects the selected gap details to load upon selection. Instead, they are dumped onto the generic Kanban board and must re-search for the card.

#### 3.2. Missing Screenshot Evidence Deletion
*   **File Path**: `src/components/ExerciseWizard.jsx` (Lines 1445–1451)
*   **Observation**: Simulation event procedures render attached image evidence as `40px` thumbnails.
*   **Friction**: There is no delete button, overlay, or action on the thumbnails. If a user accidentally uploads the wrong screenshot, they cannot remove it without deleting and re-creating the entire procedure card.

#### 3.3. TTP Selector Scrollbar Clashes
*   **File Path**: `src/components/TTPSelector.jsx` (Lines 46–57) & Modal Wrappers in `Reports.jsx`/`GapTracker.jsx`
*   **Observation**: The parent modal columns wrapper and the inner `TTPSelector` menu both declare `overflowY: 'auto'`.
*   **Friction**: This results in double scrollbars, rendering adjacent vertical scroll widgets. This leads to scrolling lag and visual layout noise.

---

### Category 4: Dark-Mode Iridescent Theme & Micro-animation Opportunities

#### 4.1. Static Sidebar Elements
*   **Friction**: The sidebar elements are visually flat and use standard instant hover changes.
*   **Opportunity**: Replacing the instant hovers with CSS transitions featuring a subtle iridescent left-border gradient animation or a glow drop-shadow would heighten the application's cyberpunk styling.

#### 4.2. Lack of Visual Focus Cues
*   **Friction**: Native browser focus outlines clash with the dark-mode aesthetic.
*   **Opportunity**: Customizing focus rings with a glowing, animated outline utilizing the variable `--accent-secondary` or `--iridescent-gradient` would align focus indicators with the design.

---

## Concrete Recommendations for QoL Fixes

### 1. Fix Sidebar Navigation Active State
*   **Target File**: `src/App.jsx`
*   **Change**: Replace React Router `Link` with `NavLink` and map classes dynamically based on the active state.
```jsx
// Before (Line 54)
<Link to="/" style={{ ... }} onMouseOver={...}>

// After
<NavLink 
  to="/" 
  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
  style={{ textDecoration: 'none' }}
>
  <LayoutDashboard size={20} /> Dashboard
</NavLink>
```
*   **CSS Update**: Remove inline JS mouse event handlers from links. Use CSS transitions in `src/index.css` under `.nav-item` to handle smooth background fade and glows:
```css
.nav-item {
  color: var(--text-secondary);
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.nav-item:hover {
  background: var(--glass-bg);
  color: var(--text-primary);
  box-shadow: 0 0 15px rgba(255, 255, 255, 0.02);
}
.nav-item.active {
  background: rgba(156, 39, 176, 0.15);
  color: var(--text-primary);
  border-left: 3px solid var(--accent-primary);
  box-shadow: inset 5px 0 15px rgba(156, 39, 176, 0.1);
}
```

### 2. Relocate Environment Filter in MITRE Heatmap
*   **Target File**: `src/components/MitreHeatmap.jsx`
*   **Change**: Relocate the `EnvironmentDropdown` container outside of the absolute overlapping viewport, placing it in the header banner next to the title or offset it horizontally when the drawer is open.
```jsx
// Before (Line 837)
<div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 10 }}>
   <EnvironmentDropdown />
</div>

// After (Shift EnvironmentDropdown to top-left header zone or dynamically offset it)
<div style={{ 
    position: 'absolute', 
    top: '20px', 
    right: activeInfo ? '440px' : '20px', // Push left if details panel is open
    zIndex: 10,
    transition: 'right 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
}}>
   <EnvironmentDropdown />
</div>
```

### 3. Handle Modal Columns and TTP Selector Width Shifts
*   **Target Files**: `src/components/GapTracker.jsx` & `src/components/Reports.jsx`
*   **Change**: Configure the left modal column enclosing the `TTPSelector` to have a fixed width or maximum width constraint, allowing the right-side form column to shrink-to-fit smoothly, or render the sub-techniques pane as a floating overlay.
```jsx
// In Reports.jsx / GapTracker.jsx modal rendering:
// Before
<div style={{ borderRight: '1px solid var(--glass-border)', overflowY: 'auto' }}>
    <TTPSelector ... />
</div>

// After (Fix the width of the column, hide scrollbars on outer parent)
<div style={{ 
    width: isMapTtpExpanded ? '860px' : '380px', 
    borderRight: '1px solid var(--glass-border)',
    overflow: 'hidden', // Let TTPSelector handle its own scroll
    transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)' 
}}>
    <TTPSelector ... />
</div>
```
Ensure that the modal container itself has a flexible but robust minimum width to prevent form squishing:
`style={{ width: '90vw', maxWidth: '1400px', ... }}`

### 4. Correct Command Palette Gap Navigation
*   **Target File**: `src/components/CommandPalette.jsx`
*   **Change**: Update `executeAction` to pass the `openGapId` in navigation state if the selected item is a gap.
```jsx
// Before (Line 89)
const executeAction = (item) => {
    navigate(item.path);
    setIsOpen(false);
};

// After
const executeAction = (item) => {
    if (item.type === 'Tracked Gaps' && item.gapId) {
        navigate(item.path, { state: { openGapId: item.gapId } });
    } else {
        navigate(item.path);
    }
    setIsOpen(false);
};

// Update search items push (Line 52)
items.push(...gaps.map(g => ({
    name: `View Gap: ${g.id}`,
    desc: g.details,
    gapId: g.id, // Keep reference to gap ID
    icon: <AlertCircle size={16} color="var(--warning)" />,
    path: '/gaps',
    type: 'Tracked Gaps'
})));
```

### 5. Add Delete Capability for Screenshot Evidence
*   **Target File**: `src/components/ExerciseWizard.jsx`
*   **Change**: Wrap the thumbnail image in a relative div container featuring a hover delete button.
```jsx
// Before (Line 1447)
{proc.evidence.map((img, i) => (
    <img key={i} src={img} alt="Evidence" style={{ width: '40px', height: '40px', objectFit: 'cover', ... }} onClick={() => setExpandedImage(img)} />
))}

// After
{proc.evidence.map((img, i) => (
    <div key={i} style={{ position: 'relative', width: '40px', height: '40px' }} className="evidence-thumbnail-container">
        <img src={img} alt="Evidence" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--glass-border)', cursor: 'pointer' }} onClick={() => setExpandedImage(img)} />
        <button 
            type="button"
            onClick={(e) => {
                e.stopPropagation();
                const filtered = proc.evidence.filter((_, idx) => idx !== i);
                updateProcedure(proc.id, 'evidence', filtered);
            }}
            style={{
                position: 'absolute', top: '-4px', right: '-4px',
                background: 'var(--danger)', color: '#fff', border: 'none',
                borderRadius: '50%', width: '14px', height: '14px',
                fontSize: '9px', display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.5)'
            }}
        >
            ×
        </button>
    </div>
))}
```

### 6. Introduce Attack Path Empty State
*   **Target File**: `src/components/AttackPath.jsx`
*   **Change**: Conditionally render a success summary panel when there are no active threat vectors.
```jsx
// After line 474:
{activeGaps.length === 0 ? (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', background: '#08090c', zIndex: 1 }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', border: '2px solid var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px', boxShadow: '0 0 20px rgba(16, 185, 129, 0.3)' }}>
            <Zap size={40} color="var(--success)" />
        </div>
        <h2 className="iridescent-text" style={{ fontSize: '1.8rem', margin: '0 0 10px 0' }}>Perimeter Secure</h2>
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', maxWidth: '500px', lineHeight: 1.6, margin: 0 }}>
            All identified security gaps have been resolved! No chainable threat vectors are currently present in the environment.
        </p>
    </div>
) : (
    /* Existing columns and nodes map rendering */
)}
```

### 7. Provide Config Prompt inside AI Assistant
*   **Target File**: `src/components/AIAssistant.jsx`
*   **Change**: Instead of returning `null` when `apiKey` is missing, render a friendly setup helper inside the slide-out panel advising the user how to configure their integrations.
```jsx
// Replace Line 129:
// Before: if (!aiSettings?.apiKey) return null;

// After: Render the panel but with a setup view if the API key is not configured
const hasApiKey = !!aiSettings?.apiKey;

return (
  <>
    {!isOpen && (
      <button 
        className="btn animate-fade-in" 
        onClick={() => setIsOpen(true)}
        style={{ position: 'fixed', right: '30px', bottom: '30px', zIndex: 90, borderRadius: '50%', width: '60px', height: '60px', display: 'flex', alignItems: 'center', ... }}
      >
         <MessageSquare size={26} />
      </button>
    )}
    
    <div className="ai-panel" style={{ ... }}>
      {/* Header */}
      ...
      
      {/* Body Content */}
      {!hasApiKey ? (
         <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', textAlign: 'center' }}>
             <BrainCircuit size={48} color="var(--text-muted)" style={{ marginBottom: '20px' }} />
             <h4 style={{ color: 'var(--text-primary)', margin: '0 0 10px 0' }}>AI Integration Offline</h4>
             <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '20px' }}>
                 To leverage the Purple Team AI Co-Pilot for log validation, script generation, and threat hunting, please configure an API Key.
             </p>
             <button className="btn" onClick={() => { setIsOpen(false); navigate('/settings'); }} style={{ background: 'var(--accent-primary)', border: 'none' }}>
                 Go to Settings
             </button>
         </div>
      ) : (
         /* Existing messages list and inputs area */
      )}
    </div>
  </>
);
```

### 8. Implement Responsive Layout for Dashboard Cards
*   **Target File**: `src/components/Dashboard.jsx`
*   **Change**: Apply CSS classes rather than hardcoded inline grid configurations to allow wrapping on smaller screens.
```css
/* Add to src/index.css */
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 25px;
  margin-bottom: 40px;
}
```
Replace inline style grids on line 275 and 336 of `Dashboard.jsx`:
```jsx
// Before
<div className="slide-in-staggered" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '25px', marginBottom: '40px' }}>

// After
<div className="slide-in-staggered dashboard-grid">
```
