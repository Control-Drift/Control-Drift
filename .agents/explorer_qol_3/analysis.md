# Eclipse Ops (Iridescence) - UI/UX Quality of Life (QoL) Assessment Report

**Author**: UX/UI QoL Explorer 3  
**Date**: June 15, 2026  
**Status**: Comprehensive Assessment Complete  

---

## Executive Summary
This report presents a detailed UX/UI and Quality of Life (QoL) audit of the Eclipse Ops React-based front-end. The assessment identified several layout inconsistencies, clipped elements, missing empty/loading states, data entry and navigation friction points, and opportunities to elevate the dark-mode iridescent theme. The recommended fixes are non-intrusive, concrete, and highly actionable, targeting specific line numbers and CSS classes to ensure high impact with minimal risk.

---

## 1. Layout Inconsistencies, Clipped Elements & Overflow Issues

### 1.1 Redundant Scrollbars (Double Scrolling)
* **Components Affected**: `src/components/Dashboard.jsx`, `src/components/Reports.jsx`, `src/index.css`
* **File Locations**: 
  - `src/index.css` (Line 212–217)
  - `src/components/Dashboard.jsx` (Line 213)
  - `src/components/Reports.jsx` (Line 718, 729)
* **Observed Issue**: 
  The routing container `.main-content` in `index.css` is styled with `overflow-y: auto`. However, individual page views (`Dashboard.jsx` and `Reports.jsx`) also enforce height restrictions (`height: '100%'`) and `overflowY: 'auto'` on their outer containers. This results in double scrollbars on smaller viewports, redundant scroll tracks, and laggy trackpad/mousewheel scroll momentum.
* **Concrete Recommendation**:
  Let the main router view container (`.main-content`) handle scrolling globally. 
  - In `Dashboard.jsx`, remove `overflowY: 'auto'` and `height: '100%'` from the wrapper `div` (line 213).
  - In `Reports.jsx`, remove the child scroll wrapper `style={{ flex: 1, overflowY: 'auto', paddingRight: '10px' }}` (line 729) and let the main content area flow naturally, or set `overflow-y: hidden` on the page views.

### 1.2 TTPSelector Fixed Width & Column Squishing inside Modals
* **Components Affected**: `src/components/TTPSelector.jsx`, `src/components/GapTracker.jsx` (Manual Gap Modal), `src/components/Reports.jsx` (Manual Exercise Log Modal)
* **File Locations**:
  - `src/components/TTPSelector.jsx` (Line 41–45)
  - `src/components/GapTracker.jsx` (Line 587–602)
  - `src/components/Reports.jsx` (Line 803–816)
* **Observed Issue**:
  The `TTPSelector` component has a hardcoded width transition: `width: activeGroup ? '860px' : '380px'`. When expanded to `860px` to show sub-techniques inside narrow modal containers (such as the Manual Gap modal in `GapTracker.jsx` or the Log Modal in `Reports.jsx`), the left column grows to `860px`. On a standard 1280px laptop screen (where the modal's actual body width is ~1200px), this leaves only ~340px for the right column. This causes severe horizontal clipping, forcing the form inputs (Target Environment, Coverage, Severity, Gap Details) to squish, wrap text illegibly, and overlap.
* **Concrete Recommendation**:
  - Make `TTPSelector` responsive using CSS flex-basis or percentage-based media queries rather than hardcoded pixel widths.
  - In `GapTracker.jsx` (lines 593–602) and `Reports.jsx` (lines 809–818), apply a CSS Grid or Flex Wrap layout to the modal content container so that the form collapses below the TTPSelector on smaller viewports:
    ```css
    @media (max-width: 1024px) {
      .modal-body { flex-direction: column !important; overflow-y: auto !important; }
      .ttp-selector-container { width: 100% !important; height: auto !important; }
    }
    ```

### 1.3 Rigid Step-4 Reporting Height Constraint
* **Components Affected**: `src/components/ExerciseWizard.jsx` (Step 4: Campaign Narrative & Review)
* **File Locations**:
  - `src/components/ExerciseWizard.jsx` (Line 1547)
* **Observed Issue**:
  The Narrative Builder and PDF Report Preview container is locked to a rigid height of `65vh`: `<div style={{ display: 'flex', gap: '20px', height: '65vh' }}>`.
  - On low-resolution viewports, `65vh` is extremely short, forcing small scroll areas and double scrollbars on rich text editors, which makes editing text highly cramped.
  - On high-resolution viewports (1440p+), `65vh` leaves a large empty gap at the bottom of the screen, failing to utilize the screen estate.
* **Concrete Recommendation**:
  Change the height property to `flex: 1` or use a responsive range, such as `minHeight: '600px', height: 'calc(100vh - 250px)'` to dynamically fill the remaining viewport height.

### 1.4 Reports Table Column Squishing
* **Components Affected**: `src/components/Reports.jsx` (Technical Findings Table)
* **File Locations**:
  - `src/components/Reports.jsx` (Line 596–597, 626, 643)
* **Observed Issue**:
  The "Outcome" and "Gap Severity" columns are constrained to exactly `15%` of the table width. In `Reports.jsx`, the "Outcome" column renders two side-by-side labeled pills representing "Expected" and "Actual" coverage outcomes. At `15%` width, these pills wrap vertically, overlap, and clip on standard screens, making it difficult to read at a glance.
* **Concrete Recommendation**:
  - Increase the "Outcome" column width to `25%` and reduce the "Notes" column (currently `35%`) to `25%`.
  - Use flex layout inside the cell or set `whiteSpace: 'nowrap'` for the badges with a responsive font size to prevent overlapping.

---

## 2. Missing Loading & Empty States

### 2.1 Tactics Navigator Sidebar Empty State
* **Components Affected**: `src/components/MitreHeatmap.jsx`
* **File Locations**:
  - `src/components/MitreHeatmap.jsx` (Line 862–899)
* **Observed Issue**:
  When a user types a query in the "Tactics Navigator" search input (e.g. a specific TTP id or technique name) that returns zero matches, the sidebar renders a blank black panel. It lacks any empty-state text or feedback to indicate that no tactics match the query.
* **Concrete Recommendation**:
  Add an explicit check for the filtered tactics list length. If empty, render a placeholder message:
  ```jsx
  const filteredTactics = Object.keys(resolvedMitreData).filter(tactic => { ... });
  if (filteredTactics.length === 0) {
      return (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No tactics or techniques match the search criteria.
          </div>
      );
  }
  ```

### 2.2 AIAssistant Chat Welcome State & Suggestions
* **Components Affected**: `src/components/AIAssistant.jsx`
* **File Locations**:
  - `src/components/AIAssistant.jsx` (Line 208–213)
* **Observed Issue**:
  When the message history is empty (`messages.length === 0`), the AI Assistant chat panel is completely blank. The user is presented with a dark, empty box, offering no visual guide or suggestion chips to initiate the conversation.
* **Concrete Recommendation**:
  Introduce a welcome state when `messages.length === 0`. Display an introductory title (e.g., "How can I help you today?") and a set of clickable suggestion chips:
  - "Draft a Sigma rule for local privilege escalation"
  - "Explain MITRE ATT&CK technique T1059"
  - "Summarize active coverage gaps"
  Clicking a chip will pre-populate the input field or immediately trigger the prompt.

---

## 3. Unintuitive Navigation Flows & Interaction Friction

### 3.1 RuleStudio Standalone Crash (High Severity)
* **Components Affected**: `src/components/RuleStudio.jsx`, `src/components/GapDetails.jsx`
* **File Locations**:
  - `src/components/RuleStudio.jsx` (Line 15, 63–66)
  - `src/components/GapDetails.jsx` (Line 434–441)
* **Observed Issue**:
  In `RuleStudio.jsx`, saving the code calls `onClose()` unconditionally inside `handleSave`:
  ```javascript
  const handleSave = () => {
      if (onSave) onSave(code);
      onClose();
  };
  ```
  However, when `RuleStudio` is rendered inside `GapDetails.jsx`'s "Code Studio" tab, it is loaded as a standalone component (`isStandalone={true}`) without an `onClose` prop. This causes a complete application crash (`TypeError: onClose is not a function`) whenever a user attempts to save their rule edits in the Gap details view.
* **Concrete Recommendation**:
  Add a safety check to make `onClose` optional:
  ```javascript
  const handleSave = () => {
      if (onSave) onSave(code);
      if (onClose) onClose();
  };
  ```

### 3.2 Sidebar Active Navigation Indicators Missing
* **Components Affected**: `src/App.jsx`, `src/index.css`
* **File Locations**:
  - `src/App.jsx` (Line 53–75)
  - `src/index.css` (Line 206–210)
* **Observed Issue**:
  Although `index.css` defines style overrides for active navigation links (`.nav-item.active`), the links in the sidebar are implemented as plain `Link` tags with hardcoded inline colors and styles. As a result, the sidebar completely lacks any visual indication of the user's current route or active state.
* **Concrete Recommendation**:
  Replace `Link` with `NavLink` from `react-router-dom` and apply the defined class names dynamically:
  ```jsx
  import { NavLink } from 'react-router-dom';
  
  // Example usage:
  <NavLink 
      to="/" 
      className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
  >
      <LayoutDashboard size={20} /> Dashboard
  </NavLink>
  ```

### 3.3 Drag-and-Drop Drop Validation Friction
* **Components Affected**: `src/components/GapTracker.jsx`
* **File Locations**:
  - `src/components/GapTracker.jsx` (Line 204–213)
* **Observed Issue**:
  When dragging a gap card from the "Open" column directly to the "Resolved" column, the application throws a Toast warning: *"Gaps must be moved to 'In Progress' before they can be Resolved"* and snaps the card back to "Open". The user must execute two separate drag operations.
* **Concrete Recommendation**:
  Reduce this friction by allowing direct drops onto "Resolved" and:
  - Automatically updating the status to "In Progress" in the background before opening the validation modal/drawer.
  - Or, displaying a prompt in the validation flow: *"This gap will be marked as In Progress and validated. Proceed?"*

### 3.4 Hardcoded Tactic Exclusions (Data Flow Friction)
* **Components Affected**: `src/components/ExerciseWizard.jsx`, `src/components/MitreHeatmap.jsx`, `src/components/AttackPath.jsx`
* **File Locations**:
  - `src/components/ExerciseWizard.jsx` (Line 1070)
  - `src/components/MitreHeatmap.jsx` (Line 790–791)
  - `src/components/AttackPath.jsx` (Line 245)
* **Observed Issue**:
  "Reconnaissance" and "Resource Development" tactics are hardcoded to be filtered out/deleted from the campaign pipeline and heatmaps. This blocks purple teams from tracking early-stage pre-exploitation TTP gaps (e.g. credentials harvesting setups, scanning, target profiling) within the app.
* **Concrete Recommendation**:
  Make pre-exploitation tactics a toggleable configuration in the "Settings" tab rather than hardcoding their exclusion, allowing organizations with external log sources to model the entire cyber kill chain.

### 3.5 AIAssistant Offscreen Drift on Window Resize
* **Components Affected**: `src/components/AIAssistant.jsx`
* **File Locations**:
  - `src/components/AIAssistant.jsx` (Line 28, 41–77)
* **Observed Issue**:
  The floating `AIAssistant` panel coordinates are relative to the initial screen size. If the browser window is resized smaller, the panel drifts offscreen because there is no resize listener to clamp coordinates dynamically.
* **Concrete Recommendation**:
  Implement a window resize listener inside `useEffect` in `AIAssistant.jsx` to clamp position values:
  ```javascript
  useEffect(() => {
      const handleResize = () => {
          setPosition(prev => {
              const panelWidth = 450;
              const newX = Math.min(prev.x, window.innerWidth - panelWidth);
              const newY = Math.min(prev.y, window.innerHeight - 300);
              return { x: Math.max(0, newX), y: Math.max(0, newY) };
          });
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
  }, []);
  ```

---

## 4. Dark-Mode Iridescent Theme Visual Cue Enhancements

### 4.1 Drag-Over Column Glow
* **Components Affected**: `src/components/GapTracker.jsx`
* **File Locations**:
  - `src/components/GapTracker.jsx` (Line 491–494)
* **Observed Issue**:
  When dragging cards, the column background changes to a flat `rgba(59, 130, 246, 0.1)` and the border turns to a dashed line. This feels basic compared to the rest of the application's rich iridescent theme.
* **Concrete Recommendation**:
  Incorporate a subtle purple/blue iridescent outer glow box shadow to fit the dark-mode aesthetic:
  ```javascript
  boxShadow: dragOverCol === col ? '0 0 25px rgba(156, 39, 176, 0.35)' : 'none',
  borderColor: dragOverCol === col ? 'var(--accent-primary)' : 'var(--glass-border)',
  background: dragOverCol === col ? 'rgba(156, 39, 176, 0.05)' : 'rgba(10,11,16,0.6)'
  ```

### 4.2 Interactive Button/Dropdown Hover States
* **Components Affected**: `src/index.css` (Button hover styling)
* **File Locations**:
  - `src/index.css` (Line 138–144)
* **Observed Issue**:
  Buttons transition to flat colors on hover. The iridescence gradient exists but is static.
* **Concrete Recommendation**:
  Make hover states dynamically shifting by applying an animated gradient transition on button hover:
  ```css
  .btn:hover:not(:disabled) {
    background: var(--iridescent-gradient);
    background-size: 200% 200%;
    animation: iridescentFlow 3s linear infinite;
    box-shadow: 0 0 15px rgba(156, 39, 176, 0.5);
  }
  ```

---

## Conclusion
Resolving these QoL issues will significantly enhance Eclipse Ops' usability. The high-severity standalone save crash in `RuleStudio` should be fixed immediately, followed by the sidebar navigation links alignment and layout scroll optimizations. 
