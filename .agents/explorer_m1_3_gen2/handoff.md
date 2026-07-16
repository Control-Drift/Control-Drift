# Handoff Report: Gap Tracker, 3D Battle Globe, and Attack Path Inspection

## 1. Observation
We located and inspected the three critical visualization and tracking components in the codebase. Below are direct observations of their file locations, code snippets, and design decisions:

### A. Gap Tracker (`src/components/GapTracker.jsx` & `src/components/GapDetails.jsx`)
- **State and Context**: Connected to `useAppContext()` for state management (retrieves `gaps`, `setGaps`, `mitreData`, `campaignSummaries`).
- **Data Insertion**: In `src/components/ExerciseWizard.jsx` (lines 812–835), gaps are generated at the end of a Purple Team campaign for each test result with an outcome of `'Missed'` or `'Logged'`:
  ```javascript
  812:       finalizedTestResults.forEach(p => {
  813:          if (p.outcome === 'Missed' || p.outcome === 'Logged') {
  814:              const severity = p.severity || 'Medium';
  815:              const baseScore = severity === 'Critical' ? 100 : severity === 'High' ? 80 : severity === 'Medium' ? 50 : 20;
  816:              const visibilityMultiplier = p.outcome === 'Missed' ? 1.0 : 0.6;
  817:              const priorityScore = Math.round(baseScore * visibilityMultiplier);
  818:              
  819:              const newGap = {
  820:                  id: Date.now() + Math.random(),
  821:                  ttp: (p.ttps || []).join(', ') || 'Unmapped',
  822:                  campaign: finalCampaignName,
  823:                  finding: p.name || 'Unnamed Event',
  824:                  details: `Execution: ${p.execNotes || 'N/A'}\nDetection: ${p.detNotes || 'N/A'}`,
  825:                  severity: severity,
  826:                  priorityScore: priorityScore,
  827:                  status: 'Open',
  828:                  actionItems: 'Review telemetry and develop detection logic.',
  829:                  stakeholders: 'Detection Engineering',
  830:                  environment: campaignDetails.environmentCategory,
  831:                  createdDate: new Date().toISOString()
  832:              };
  833:              setGaps(prev => [...prev, newGap]);
  834:          }
  835:      });
  ```
- **Auto-Resolution and Validation**:
  - In `src/AppContext.jsx` (lines 303–311), running a new test that achieves a `'high'` (Prevented) status checks gaps by TTP and moves them to `'Resolved'`:
    ```javascript
    303:     if (outcomeStatus === 'high') {
    304:        setGaps(prev => prev.map(gap => {
    305:            const gapTTPs = (gap.ttp || '').split(',').map(t => t.trim());
    306:            if (gapTTPs.includes(ttp) && gap.status !== 'Resolved') {
    307:                return { ...gap, status: 'Resolved', resolvedDate: new Date().toISOString(), resolutionNotes: (gap.resolutionNotes || '') + '\n[System] Auto-resolved via successful Purple Team test.' };
    ...
    ```
  - In `src/AppContext.jsx` (lines 349–467), manual re-testing of a gap via `updateExerciseValidation` recalculates the aggregate TTP outcome and, if high, sets that specific gap's status to `'Resolved'`.
- **Kanban Columns**: In `src/components/GapTracker.jsx` (lines 249), the Kanban columns are declared as:
  ```javascript
  249:   const columns = ['Open', 'In Progress', 'Resolved'];
  ```
  However, `handleDrop` includes a check for `'Risk Accepted'`:
  ```javascript
  153:       } else if (col === 'Risk Accepted') {
  154:           setRiskForm({ gapId: gap.id, justification: gap.riskJustification || '', acceptedBy: gap.riskAcceptedBy || '' });
  ...
  ```
- **Manual Gap Fields**: The "Track New Gap" modal inside `GapTracker.jsx` does not include an environment selection dropdown, but the column filter in `GapTracker.jsx` expects `g.environment` to match:
  ```javascript
  375:                  if (activeEnvironmentFilter !== 'All' && !(Array.isArray(g.environment) ? g.environment.includes(activeEnvironmentFilter) : g.environment === activeEnvironmentFilter)) return false;
  ```

### B. 3D Battle Globe (`src/components/BattleGlobe.jsx`)
- **Adversary Control Ratio Calculation**: In `src/components/ExerciseWizard.jsx` (lines 343–355), the ratio is calculated based on test outcomes:
  ```javascript
  343:   const getAdversaryControlRatio = () => {
  344:      let totalScore = 0;
  345:      let maxScore = 0;
  346:      testResults.forEach(p => {
  347:         const out = p.outcome || 'Prevented';
  348:         if (out === 'N/A' || out === 'Error') return;
  349:         maxScore += 1.0;
  350:         if (out === 'Missed') totalScore += 1.0;
  351:         else if (out === 'Logged') totalScore += 0.75;
  352:      });
  353:      if (maxScore === 0) return 0.5;
  354:      return totalScore / maxScore;
  355:   };
  ```
- **Visual Mapping**: The ratio is mapped to SVG linear gradient stops representing control:
  - Stop 1 (Crimson/Red Team): `Math.max(0, redPercent - 15)`
  - Stop 2 (Purple/Balanced): `redPercent`
  - Stop 3 (Cobalt/Blue Team): `Math.min(100, redPercent + 15)`
- **Animation and Display discrepancy**: The metrics update instantly when the `ratio` prop changes:
  ```javascript
  71:   const targetRedPercent = ratio * 100;
  72:   const targetBluePercent = 100 - targetRedPercent;
  ```
  But the visual globe colors and shadows glide over a 2.5-second easing transition:
  ```javascript
  17:     const duration = 2500; // 2.5 seconds majestic slow glide
  ```

### C. Attack Path (`src/components/AttackPath.jsx`)
- **Phases definition**: Defined on lines 169–177 as a 7-phase cyber kill chain:
  ```javascript
  169:     const phases = useMemo(() => [
  170:         { id: 'Reconnaissance', icon: <CyberEyeIcon size={32} /> },
  171:         { id: 'Weaponization', icon: <LaserGunIcon size={32} /> },
  ...
  ```
- **Tactic to Phase Mapping**: Active gaps are grouped into kill chain phases based on their MITRE tactics on lines 226–233:
  ```javascript
  226:             let assignedPhase = 'Actions on Objectives';
  227:             if (['Reconnaissance'].includes(foundTactic)) assignedPhase = 'Reconnaissance';
  228:             else if (['Resource Development'].includes(foundTactic)) assignedPhase = 'Weaponization';
  ...
  ```
- **Edge Drawing (Bezier Curves)**: In the `useEffect` on lines 254–310, it loops over adjacent phases and creates SVG Bezier curves from the right side of nodes in phase `i` to the left side of nodes in phase `i+1`:
  ```javascript
  293:                             d: `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`,
  ```
- **Unimported Icons**: On lines 537, 558, and 580, `AttackPath.jsx` renders `X`, `Package`, `Monitor`, and `Zap`:
  ```javascript
  537:                                 Close <X size={16} />
  ...
  558:                                         {(!selectedGap.environment || selectedGap.environment === 'Miscellaneous') ? <Package size={14} color="var(--accent-secondary)" /> : <Monitor size={14} color="var(--accent-secondary)" />} {selectedGap.environment || 'Miscellaneous'}
  ...
  580:                                     <Zap size={18} /> Open in Gap Tracker
  ```
  However, look at the imports in `AttackPath.jsx` (lines 1–4):
  ```javascript
  1: import React, { useMemo, useState, useRef, useEffect } from 'react';
  2: import { useNavigate } from 'react-router-dom';
  3: import { useAppContext } from '../AppContext';
  4: import { ShieldAlert } from 'lucide-react';
  ```
- **Infinite Loop**: The paths state is set inside a `useEffect` whose dependency list includes `gapsByPhase`:
  ```javascript
  310:     }, [gapsByPhase, phases]);
  ```
  `gapsByPhase` is memoized on `activeGaps`:
  ```javascript
  240:     }, [activeGaps, mitreData]);
  ```
  However, `activeGaps` is recalculated on every render as a new array:
  ```javascript
  208:     const activeGaps = gaps.filter(g => g.status !== 'Resolved');
  ```

---

## 2. Logic Chain
- **Correlation of Campaign Data to Gaps**:
  1. The `ExerciseWizard` compiles campaign results (`finalizedTestResults`). Gaps are logged for any failed tests (`Missed` or `Logged`) with a severity-based priority score.
  2. Gaps are automatically updated in `AppContext.jsx` via either a new Purple Team campaign completion (`completeExercise`) or an inline validation re-test (`updateExerciseValidation`). If the re-test reaches `'high'` (Prevented), the corresponding gap is resolved.
- **3D Battle Globe Mapping**:
  1. The Adversary Control Ratio is calculated as `totalScore / maxScore` across active procedures, where `Missed = 1.0`, `Logged = 0.75`, and all others are `0.0`.
  2. The linear gradient shifts color stops dynamically from Red Team (Crimson) to Blue Team (Cobalt) to reflect this ratio, displaying a visual representation of team control.
- **Attack Path Edge Rendering**:
  1. Gaps are grouped into 7 Cyber Kill Chain columns depending on their associated MITRE tactic.
  2. The `useEffect` traces DOM positions using `getBoundingClientRect` for nodes in adjacent columns, drawing Bezier curves (`d="M ... C ..."`) from right to left edges.
  3. Interactive hover traces upstream/downstream nodes recursively using active edge connections, highlighting the path using Glow filters and SVG animations.

---

## 3. Caveats
- No direct code modifications were made as the current mission is read-only.
- Image assets (e.g. icons, ThreeJS globes, style animations) were verified by static analysis of the source code.
- Assumptions are made that `gaps` and `mitreData` are loaded correctly from `localStorage` or remote STIX file fetching before rendering these pages.

---

## 4. Conclusion
We identified several critical bugs and design/logic flaws across the three inspected components:

1. **Attack Path Fatal Crash (High Impact)**: The `AttackPath.jsx` component uses `X`, `Package`, `Monitor`, and `Zap` icons inside the gap detail modal, but none of these are imported from `lucide-react` (only `ShieldAlert` is imported). Clicking any node to view details will result in an immediate runtime exception.
2. **Attack Path Infinite Render Loop (High Impact)**: `activeGaps` is recalculated as a new array ref on every render. This forces `gapsByPhase` to return a new object ref on every render, triggering the path calculation `useEffect` to call `setPaths` infinitely. This causes high CPU/GPU usage and browser tab freezes.
3. **Gap Tracker Unreachable Risk-Acceptance Drag-and-Drop (Medium Impact)**: The Kanban columns array does not contain `'Risk Accepted'`. The code in `handleDrop` that handles dropping a card onto `'Risk Accepted'` is unreachable via drag-and-drop.
4. **Gap Tracker Manual Gap Environment Filter Bug (Medium Impact)**: Manually created gaps have `environment` set to `undefined`. When filtering by any environment in `GapTracker.jsx` (including `'Miscellaneous'`), manual gaps are hidden because `undefined !== activeEnvironmentFilter`.
5. **Inconsistent ID Types (Low Impact)**: Campaign-generated gaps use numerical IDs, while manually created gaps use string IDs (`'GAP-XXXX'`), which necessitates complex type coercion throughout the codebase.
6. **3D Globe Unsynchronized Text and Animation (Low Impact)**: The percentage metrics displayed as text update instantly, whereas the globe visualization and its drop shadow animate over 2.5 seconds, causing a temporary visual desynchronization.

---

## 5. Verification Method
To verify these findings, inspect the following files:
1. **Missing Icons**: View `src/components/AttackPath.jsx` lines 1–4 and lines 537, 558, and 580 to verify that `X`, `Package`, `Monitor`, and `Zap` are used but not imported.
2. **Infinite Loop**: Trace `src/components/AttackPath.jsx` lines 208, 210–240, and 254–310. Note that `activeGaps` is re-filtered on every render, causing the dependency tree for `setPaths` to always run.
3. **Unreachable Drag-and-Drop**: Observe `src/components/GapTracker.jsx` line 249 (`columns`) and line 153 (`handleDrop`).
4. **Manual Gap Environment Filter**: Observe `src/components/GapTracker.jsx` lines 233–244 (new manual gap structure) and lines 372–384 (column filter logic).
