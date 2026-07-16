# Handoff Report: E2E Test Selectors and DOM Text Patterns for Security Posture and Heatmap Statuses

## 1. Observation
We investigated React components that render adversary simulation outcomes and security coverage statuses.

### UnifiedPosturePill.jsx
- **File Path**: `src/components/ui/UnifiedPosturePill.jsx`
- **Line 24-26**: Color mapping for Coverage:
  ```javascript
  const coverageColor = effectiveCoverage === 'None' ? 'var(--danger)' : effectiveCoverage === 'Minimal' ? 'var(--minimal)' : effectiveCoverage === 'Partial' ? 'var(--warning)' : 'var(--success)';
  const coverageBg = effectiveCoverage === 'None' ? 'rgba(239, 68, 68, 0.15)' : effectiveCoverage === 'Minimal' ? 'rgba(249, 115, 22, 0.15)' : effectiveCoverage === 'Partial' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)';
  const coverageBorder = effectiveCoverage === 'None' ? 'rgba(239, 68, 68, 0.3)' : effectiveCoverage === 'Minimal' ? 'rgba(249, 115, 22, 0.3)' : effectiveCoverage === 'Partial' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)';
  ```
- **Line 33-57**: Color mapping for Outcome:
  - `'Prevented & Alerted'`: `var(--success)`
  - `'Prevented'` / `'Prevented (No Alert)'`: `#06b6d4`
  - `'Alerted'`: `#3b82f6`
  - Starts with `'Logged'`: `var(--warning)`
  - Starts with `'Minimal'`: `var(--minimal)`
  - `'Missed'`: `var(--danger)`
- **Line 75**: Tooltip for control drift:
  ```javascript
  title={isDrift ? `Control Drift: Outcome was ${safeOutcome}, but operator assessed coverage as ${coverage}` : `Outcome: ${safeOutcome}`}
  ```
- **Line 77**: Drift alert icon:
  ```javascript
  {isDrift && <AlertTriangle size={12} color="var(--warning)" style={{ flexShrink: 0 }} />}
  ```
- **Line 81**: Coverage text rendering:
  ```javascript
  {effectiveCoverage === 'None' || effectiveCoverage === 'Zero' ? 'No' : effectiveCoverage} Coverage
  ```

### MitreHeatmap.jsx
- **File Path**: `src/components/pages/MitreHeatmap.jsx`
- **Line 40-48**: Tactic/Technique status color mapping (`statusColors`):
  ```javascript
  const statusColors = {
    high: '#10b981', // green
    medium: '#f59e0b', // yellow
    minimal: '#f97316', // orange
    low: '#ef4444', // red
    unknown: '#9ca3af', // gray
    na: '#475569',
    exception: '#a78bfa' // purple
  };
  ```
- **Line 1256**: Main container: `<div className="mitre-heatmap-root" ...>`
- **Line 1276**: Header metrics selector: `.responsive-row.header-metrics` containing:
  - Text pattern `'ATT&CK Coverage: [0-100]%'`
  - Text pattern `'Tested TTPs: [Count]'`
- **Line 1296**: Tactics Navigator sidebar: `.glass-panel.animate-fade-in.heatmap-sidebar` containing:
  - Input: `input.ai-input[placeholder="Search Tactics..."]`
  - Individual Tactic items with inline color dot: `div` styled with `width: 8px, height: 8px, borderRadius: 50%` and background color from `statusColors`.
- **Line 1392**: Expanded Tactic Details Panel: `.glass-panel.animate-fade-in.tactic-details-panel` containing:
  - Active Tactic title: `h3`
  - Status pill with background and border mapping to `statusColors` and text matching `'Optimal Coverage'`, `'Partial Coverage'`, `'Minimal Coverage'`, `'No Coverage'`, or `'Untested'`.
  - Technique cards in a list under selector `.tactic-details-panel >> div[style*="flex: 1"] >> div[style*="cursor: pointer"]`, displaying Technique ID and name. If status is `'na'`, name text has style `textDecoration: 'line-through'`.
- **Line 1571**: TTP Modal: `.glass-panel.ttp-modal` containing:
  - Technique ID: `h2`
  - Coverage Status Pill (same rendering as tactic panel)
  - Outcomes Count Pill summary (`[Count] Prevented`, `[Count] Alerted`, etc.)
  - Cards representing simulation history.
- **Line 912**: `TechnicalDetails` component rendering cards with `UnifiedPosturePill` inside them.

### Reports.jsx
- **File Path**: `src/components/pages/Reports.jsx`
- **Line 67, 805, 811, 815, 820**: Outcome column renderings in procedures table using `getOutcomeColor`, `getOutcomeBg`, `getOutcomeBorder` helpers mapping outcomes to colors:
  - `'Prevented & Alerted'`: `var(--success)`
  - `'Prevented'` / `'Prevented (No Alert)'`: `#06b6d4`
  - `'Alerted'`: `#3b82f6`
  - `'Logged'` / `'Partial'`: `var(--warning)`
  - `'Missed'`: `var(--danger)`
  - Control Drift warning text: `Control Drift` (if `expectedOutcome !== outcome`).
- **Line 1150**: Coverage column rendering in table:
  - Text: `'Optimal'`, `'Partial'`, `'Minimal'`, `'None'`, or `'N/A'`
  - CSS style mappings matching standard status colors.
- **Line 1155**: Severity column rendering:
  - Text: `'Critical'`, `'High'`, `'Medium'`, `'Low'`, or `'N/A'`
  - Color mapping: Critical -> `var(--danger)`, High -> `#f97316`, Medium -> `var(--warning)`, Low -> `var(--success)`.

### EventCard.jsx
- **File Path**: `src/components/ui/EventCard.jsx`
- **Line 44**: Thick left-border indicating coverage: `borderLeft: 4px solid [Color]`.
- **Line 66**: Outcome pill displayed when card is collapsed.

---

## 2. Logic Chain
1. To write reliable E2E tests, the test suite must target stable DOM selectors and look for precise text patterns and CSS color property assertions.
2. Based on `UnifiedPosturePill.jsx` observations, actual outcome spans are styled inline with specific hex values or CSS variables (such as `var(--success)` or `#06b6d4` or `var(--warning)`). Coverage spans are styled using status colors, and their text contains `' Coverage'` (e.g. `'Optimal Coverage'`).
3. Under `MitreHeatmap.jsx`, global security coverage is contained in the `.header-metrics` container, tactics lists are contained in `.heatmap-sidebar`, tactic details are in `.tactic-details-panel`, and technique drilldowns are in `.ttp-modal`.
4. Tests can verify high/medium/minimal/low status mapping by selecting the respective status pill or dot and asserting that its CSS color value matches the expected RGB/Hex values defined in `statusColors` or `getOutcomeStyle`.
5. Drilldown tables in `Reports.jsx` display expected/actual outcomes and coverage using elements with specific text (e.g. `'Optimal'`, `'Partial'`, `'Control Drift'`) and background/text colors matching the taxonomy.
6. Therefore, the E2E test suite should assert specific CSS selectors, DOM text patterns, and computed color styles as detailed in the conclusion.

---

## 3. Caveats
- Colors specified as CSS variables (like `var(--success)`, `var(--warning)`) are resolved by the browser to actual computed color values (e.g., `rgb(16, 185, 129)` or `rgb(245, 158, 11)`). E2E tests in Playwright or Cypress using `.toHaveCSS('color', ...)` must check the computed rgb/rgba values or CSS variable names depending on the test environment setup.
- The 3D globe itself is rendered inside a `<canvas>` element using WebGL/Three.js. E2E tests cannot directly query DOM text patterns inside the WebGL canvas, but they can hover/click elements by position, or verify visual statuses through the HTML overlay elements (like tooltip tooltips `<Html>` nodes) and the sidebar/panel overlays which are standard DOM elements.

---

## 4. Conclusion
The E2E test suite can assert visual correctness using the following specific CSS selectors and DOM text patterns:

### A. Outcome and Coverage Ratings (UnifiedPosturePill)
- **Outcome Span Selector**: `.tactic-details-panel span[title^="Outcome:"]` or `.ttp-modal span[title^="Outcome:"]`
  - Assert Text Patterns: `'PREVENTED & ALERTED'`, `'PREVENTED'`, `'PREVENTED (NO ALERT)'`, `'ALERTED'`, `'LOGGED'`, `'MINIMAL'`, `'MISSED'`.
  - Assert Computed Colors:
    - Green (Optimal/Prevented & Alerted): `rgb(16, 185, 129)`
    - Cyan (Prevented / Prevented (No Alert)): `rgb(6, 182, 212)`
    - Blue (Alerted): `rgb(59, 130, 246)`
    - Yellow/Orange (Logged): `rgb(245, 158, 11)`
    - Orange (Minimal): `rgb(249, 115, 22)`
    - Red (Missed): `rgb(239, 68, 68)`
- **Coverage Span Selector**: Target the sibling span next to the outcome span.
  - Assert Text Patterns: `'OPTIMAL COVERAGE'`, `'PARTIAL COVERAGE'`, `'MINIMAL COVERAGE'`, `'NO COVERAGE'`.
  - Assert Computed Colors:
    - Optimal: `rgb(16, 185, 129)` (Green)
    - Partial: `rgb(245, 158, 11)` (Yellow)
    - Minimal: `rgb(249, 115, 22)` (Orange)
    - None (No Coverage): `rgb(239, 68, 68)` (Red)
- **Control Drift Indicator Selector**: `span[title^="Control Drift:"] svg.lucide-alert-triangle` (should be visible when actual outcome differs from expected outcome).

### B. Global Posture and Heatmap Overlays
- **Global Coverage Badge**: `.header-metrics >> text=/ATT&CK Coverage: \d+%/`
- **Global Tested TTPs Badge**: `.header-metrics >> text=/Tested TTPs: \d+/`
- **Sidebar Tactic Dot Selector**: `.heatmap-sidebar >> div[style*="border-radius: 50%"]`
  - Assert Background Colors (mapping to `statusColors`):
    - High (Green): `#10b981` / `rgb(16, 185, 129)`
    - Medium (Yellow): `#f59e0b` / `rgb(245, 158, 11)`
    - Minimal (Orange): `#f97316` / `rgb(249, 115, 22)`
    - Low (Red): `#ef4444` / `rgb(239, 68, 68)`
    - Unknown (Gray): `#9ca3af` / `rgb(156, 163, 175)`
    - N/A (Slate): `#475569` / `rgb(71, 85, 105)`
- **Expanded Tactic Panel**: `.tactic-details-panel`
  - Title: `.tactic-details-panel h3` (active tactic name)
  - Overall Status Badge: `.tactic-details-panel >> div[style*="letter-spacing: 0.5px"]`
    - Assert text: `'Optimal Coverage'`, `'Partial Coverage'`, `'Minimal Coverage'`, `'No Coverage'`, or `'Untested'`.
  - De-scoped Techniques: `.tactic-details-panel span[style*="line-through"]` (assert technique name has line-through text decoration when de-scoped).
- **TTP Modal**: `.ttp-modal`
  - Title: `.ttp-modal h2` (technique ID) and `h3` (technique name)
  - Historical Outcomes Summary Pills: `.ttp-modal span[style*="border-radius: 20px"]`
    - Assert text patterns: `[0-9]+ Prevented`, `[0-9]+ Alerted`, `[0-9]+ Prevented & Alerted`, `[0-9]+ Logged`, `[0-9]+ Missed`.

### C. Simulation Reports Page
- **Procedures Table Columns**:
  - **Expected Outcome Badge**: `td >> text=/Prevented|Alerted|Logged|Missed/` (under "Expected" header)
  - **Actual Outcome Badge**: `td >> text=/Prevented|Alerted|Logged|Missed/` (under "Actual" header)
  - **Control Drift**: `td >> text="Control Drift"` (assert visibility when expected and actual outcomes diverge)
  - **Coverage Rating Badge**: `td >> text=/Optimal|Partial|Minimal|None/`
    - Assert CSS Colors: Green for Optimal, Yellow for Partial, Orange for Minimal, Red for None.
  - **Severity Badge**: `td >> text=/Critical|High|Medium|Low/`
    - Assert CSS Colors: Red for Critical, Orange for High, Yellow for Medium, Green for Low.

---

## 5. Verification Method
- Execute the Playwright E2E test suite locally using the command:
  ```bash
  npm run test:e2e
  ```
  or run a specific spec file:
  ```bash
  npx playwright test tests/gap-tracker-e2e.spec.js
  ```
- Inspect target elements using developer tools on `/posture` and `/reports` views.
- Visual assertion can be validated by running existing E2E specs and ensuring color properties resolve correctly.
