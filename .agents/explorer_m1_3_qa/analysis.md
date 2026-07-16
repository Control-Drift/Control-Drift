# Visualization Components Analysis: 3D Battle Globe & Attack Path

This report presents findings from a read-only investigation of the visualization components in the Iridescence application, specifically the **3D Battle Globe** (`BattleGlobe.jsx`) and the **Attack Path** (`AttackPath.jsx`). It covers their status rendering logic, data bindings to `AppContext`, and critical bugs, potential crashes, and logic flaws identified during the code audit.

---

## 1. Status Rendering Analysis

### A. 3D Battle Globe (`BattleGlobe.jsx`)
* **Purpose**: Displays a high-density, cyberpunk-themed wireframe globe that blends Crimson (Red Team / adversary control) and Cobalt (Blue Team / defensive coverage) based on a computed ratio.
* **Tactic/Technique Status Rendering**:
  * The Battle Globe does **not** render individual tactic or technique statuses.
  * Instead, it represents the **macroscopic adversary control ratio** (Red Team vs. Blue Team) across the current campaign/simulation.
  * The colors used are:
    * **Crimson (`#dc143c`)**: Represents Red Team / adversary success.
    * **Purple (`#7b2cbf`)**: Represents the blend/overlap boundary.
    * **Cobalt (`#0047ab`)**: Represents Blue Team / defensive protection.
  * A gradient (`#fluid-grad`) interpolates between Crimson and Cobalt using offset markers (`stop1Ref`, `stop2Ref`, `stop3Ref`) driven by an animation loop using `requestAnimationFrame` and `easeInOutCubic` easing.

### B. Attack Path (`AttackPath.jsx`)
* **Purpose**: Visualizes a chain of open coverage gaps mapped across the Cyber Kill Chain phases.
* **Tactic/Technique Status Rendering**:
  * Attack Path does **not** display MITRE technique statuses (`high`, `medium`, `low`, etc.) from `mitreData`.
  * It maps **unresolved coverage gaps** (`gaps` filter where `status !== 'Resolved'`) to Cyber Kill Chain phases using the gap's associated TTP ID.
  * It translates MITRE Tactics to six Cyber Kill Chain phases:
    1. **Delivery**: Maps `Initial Access`.
    2. **Exploitation**: Maps `Execution`, `Privilege Escalation`, `Defense Evasion`.
    3. **Installation**: Maps `Persistence`.
    4. **Command and Control**: Maps `Command and Control`.
    5. **Lateral Movement**: Maps `Discovery`, `Lateral Movement`, `Credential Access`, `Collection`.
    6. **Actions on Objectives**: Maps `Exfiltration`, `Impact`, and defaults (e.g., custom TTPs).
  * Color coding is determined by the **gap's severity level** (`gap.severity`) rather than its MITRE status:
    * **Critical**: `#ef4444` (Red)
    * **High**: `#f59e0b` (Amber)
    * **Medium**: `#38bdf8` (Light Blue)
    * **Low / Default**: `#10b981` (Emerald)

---

## 2. Data Binding & State Integration

### A. Battle Globe Data Binding
* Bound to the `ratio` prop in `ExerciseWizard.jsx:1428`, which is computed from the `testResults` local array:
  ```javascript
  const getAdversaryControlRatio = () => {
     let totalScore = 0;
     let maxScore = 0;
     testResults.forEach(p => {
        const out = p.outcome || 'Prevented';
        if (out === 'N/A' || out === 'Error') return;
        maxScore += 1.0;
        if (out === 'Missed') totalScore += 1.0;
        else if (out === 'Logged') totalScore += 0.75;
     });
     if (maxScore === 0) return 0.5;
     return totalScore / maxScore;
  };
  ```
* **Indirect MITRE Binding**: The `testResults` outcomes directly drive the globe's ratio. Once a campaign is saved/finalized, these outcomes determine the TTP status in `mitreData` (via `completeExercise`), but the globe itself remains bound strictly to the active test results ratio.

### B. Attack Path Data Binding
* Bound to `gaps` and `mitreData` from `AppContext`:
  * `gaps` provides the list of open items.
  * `mitreData` is scanned to match `gap.ttp` to its parent MITRE Tactic to place it in the correct phase column.
  * `getTTPName` queries `mitreData` to resolve technique and sub-technique names (e.g. `T1566.001` to "Phishing: Spearphishing Attachment").

---

## 3. Identified Bugs, Crashes, and Logic Flaws

During inspection, **six significant issues** were identified:

### 🔴 1. App Crash in GapDetails.jsx (ReferenceError: `getTTPName` is not defined)
* **Location**: `src/components/GapDetails.jsx:631`
* **Observation**: The standalone "Validate Remediation" modal attempts to render the TTP name:
  `value={gap.ttp ? `${gap.ttp} - ${getTTPName(gap.ttp)}` : 'General/Unmapped Procedure'}`
  However, `getTTPName` is **neither imported nor defined** inside `GapDetails.jsx`. 
* **Impact**: Clicking to validate a gap immediately throws a `ReferenceError` and crashes the React UI.
* **Fix**: Port the `getTTPName` helper function from `AttackPath.jsx` or `GapTracker.jsx` into `GapDetails.jsx`.

### 🔴 2. SVG Path Drifting and Misalignment on Scroll in AttackPath.jsx
* **Location**: `src/components/AttackPath.jsx` (lines 296-305)
* **Observation**: `updatePaths` calculates relative SVG positions using `getBoundingClientRect()` of nodes and the container:
  `const startX = sourceRect.right - containerRect.left;`
  `const startY = sourceRect.top + sourceRect.height / 2 - containerRect.top;`
  This does **not** account for `container.scrollLeft` or `container.scrollTop`.
* **Impact**: If the container is scrolled when path coordinates are computed (e.g. on load, resize, or when hovering/unhovering a node to trigger an update), the coordinates will be calculated relative to the viewport rather than the absolute canvas space. Because the SVG itself is absolute-positioned and scrolls with the canvas, the lines will be offset by the scroll amount, detaching entirely from the nodes.
* **Fix**: Add scroll offsets to the calculation:
  `const startX = sourceRect.right - containerRect.left + containerRef.current.scrollLeft;`
  `const startY = sourceRect.top + sourceRect.height / 2 - containerRect.top + containerRef.current.scrollTop;`

### 🟡 3. Column Squishing and Broken Horizontal Scroll in AttackPath.jsx
* **Location**: `src/components/AttackPath.jsx:459`
* **Observation**: The phase columns have `flex: 1` and `minWidth: 0`. The columns container has `width: '100%'`.
* **Impact**: When the viewport narrows, instead of keeping a readable width and triggering horizontal scroll (using `overflowX: 'auto'` on the parent), the columns shrink towards 0px. The gap cards are squished to a few pixels wide, rendering text completely unreadable.
* **Fix**: Apply a reasonable minimum width on each column:
  `style={{ ..., flex: 1, minWidth: '200px' }}`

### 🟡 4. Broken SVG/Laser Height Clipping in AttackPath.jsx
* **Location**: `src/components/AttackPath.jsx:411`
* **Observation**: The `<svg>` container has `width: '100%', height: '100%', position: 'absolute'`.
* **Impact**: In HTML/CSS, an absolute positioned child with `height: '100%'` scales only to the parent's *viewport* height, not its *scrollable scrollHeight*. If a phase column contains many gaps, the container will scroll vertically. However, the SVG will remain capped at the viewport height. Paths linking to elements scrolled below the viewport will be clipped and will not render.
* **Fix**: Dynamically set SVG height to `scrollHeight` or stretch the SVG container using CSS grid/flex layout instead of absolute positioning relative to a scroll parent.

### 🟡 5. Skewed Globe Ratio due to Validated Exercise Outcomes
* **Location**: `src/components/ExerciseWizard.jsx` (lines 443-455)
* **Observation**: `getAdversaryControlRatio` checks outcome strings using exact matches:
  `if (out === 'Missed') totalScore += 1.0;`
  `else if (out === 'Logged') totalScore += 0.75;`
  However, in `updateExerciseValidation` (in `AppContext.jsx`), validated outcomes are saved as `'Missed (Validation)'`, `'Logged (Validation)'`, or `'Prevented ✓ Validated'`.
* **Impact**: Because `getAdversaryControlRatio` does not use `.startsWith()` (unlike other parts of the UI), validated re-test outcomes are ignored by the ratio calculation, defaulting to `0` adversary control. This skews the Battle Globe color balance.
* **Fix**: Update the checks to use `.startsWith()`:
  `if (out.startsWith('Missed')) totalScore += 1.0;`
  `else if (out.startsWith('Logged')) totalScore += 0.75;`

### 🟡 6. Offline Load Failure of MITRE Data (Failure to Fall Back to Expired Cache)
* **Location**: `src/AppContext.jsx` (lines 257-267, 309-313)
* **Observation**: `fetchMitreData` checks if `localStorage` has a cache less than 7 days old. If the cache is older than 7 days, or if it is the first load, it attempts to fetch from GitHub CTI. In offline network mode (or during GitHub downtime), this fetch fails. The catch block simply logs the error.
* **Impact**: If the cache is 8 days old and the system is offline, the fetch fails, and the cache is **not** loaded. `mitreData` remains `{}`. The entire heatmaps, gap details, and Attack Path components break because they cannot resolve TTP tactics or names, even though a slightly older cache was locally available.
* **Fix**: Fall back to the cached data inside the `catch` block regardless of cache age.

### 🔵 7. Static/Invisible Gap Card Animation in AttackPath.jsx
* **Location**: `src/components/AttackPath.jsx:527`
* **Observation**: The "Fake data stream line" div uses `animation: 'laserPulse 2s linear infinite'`.
* **Impact**: The `@keyframes laserPulse` in `index.css` only animates `stroke-dashoffset`. Since `stroke-dashoffset` is an SVG-only attribute, it has no effect on a standard HTML `<div>`. The div remains static at `left: '-100%'`, making the data stream visual completely invisible.
* **Fix**: Create a separate CSS animation for HTML divs (e.g., `shimmer` or `translateX`) and assign it to the card's data stream div.

### 🔵 8. Dead Code in Technique Mapping (`subTechniques`)
* **Location**: `AttackPath.jsx`, `GapTracker.jsx`, `Reports.jsx`, `RuleStudio.jsx`
* **Observation**: These files check `t.subTechniques && t.subTechniques.find(...)`. However, `mitreData` parsed in `AppContext.jsx` is flat; sub-techniques are stored directly as flat elements in the `techniques` array and **never** grouped under a `subTechniques` key.
* **Impact**: This does not cause a crash (thanks to defensive `if (t.subTechniques)` guards), but it constitutes dead code. Since the sub-techniques are in the flat list, they are successfully found by parent checks anyway, but the code should be cleaned up.
