# Handoff Report — explorer_m1_3_qa

## 1. Observation
We observed the following inside the visualization and data-binding codebases:
* **GapDetails.jsx:631**: The code contains `value={gap.ttp ? `${gap.ttp} - ${getTTPName(gap.ttp)}` : 'General/Unmapped Procedure'}` but `getTTPName` is not defined anywhere in the file or imported.
* **AttackPath.jsx:296-297, 304-305**: SVG coordinate offsets are calculated using `sourceRect.right - containerRect.left` and `sourceRect.top + sourceRect.height / 2 - containerRect.top` without adding scroll offset (`scrollLeft` or `scrollTop`).
* **AttackPath.jsx:459**: The CSS style has `flex: 1, minWidth: 0` for phase columns, allowing them to shrink to 0px on small screen sizes.
* **AttackPath.jsx:411**: The `<svg>` has `width: '100%', height: '100%', position: 'absolute'` inside a scrollable container.
* **ExerciseWizard.jsx:443-455**: `getAdversaryControlRatio()` performs exact string checks `out === 'Missed'` and `out === 'Logged'`. However, `updateExerciseValidation` (AppContext.jsx:393-398) sets validated outcomes to strings like `'Missed (Validation)'` and `'Logged (Validation)'`.
* **AppContext.jsx:257-267, 309-313**: `fetchMitreData()` checks if the cache is < 7 days old, and if older, tries to fetch from GitHub CTI. In offline network mode, this fetch fails, and the catch block does not load the expired cache from `localStorage`, leaving `mitreData` empty `{}`.
* **AttackPath.jsx:527**: The "Fake data stream line" `div` uses `animation: 'laserPulse 2s linear infinite'`. However, `@keyframes laserPulse` (index.css:510) only animates `stroke-dashoffset` which has no effect on standard HTML `div` elements.
* **AttackPath.jsx, GapTracker.jsx, Reports.jsx, RuleStudio.jsx**: Code checks for `t.subTechniques && t.subTechniques.find(...)`. However, `mitreData` parsed in `AppContext.jsx` is flat; sub-techniques are stored directly as flat elements in the `techniques` array and never grouped under a `subTechniques` key.

## 2. Logic Chain
1. **GapDetails Crash**: Since `getTTPName` is not defined in `GapDetails.jsx` but called on line 631, opening the "Validate Remediation" modal will result in a `ReferenceError` and immediately crash the UI.
2. **AttackPath Scroll Alignment**: Since scroll positions are omitted from absolute coordinate calculations, any scroll action in `AttackPath.jsx` shifts elements but leaves SVG lines offset by the scroll amount. If coordinates are recalculated when the container is scrolled (e.g. during a hover state update), the path lines will detach from the nodes.
3. **Column Squishing**: `minWidth: 0` combined with `flex: 1` allows flex items to shrink below their content size. If the viewport is narrower than 6 columns, columns will shrink to thin strips rather than triggering horizontal scrolling.
4. **SVG Clipping**: An absolute element with `height: 100%` is bounded by the container viewport height. When vertical overflow occurs, the SVG does not stretch to the scroll height, clipping any connecting lines at the viewport fold.
5. **Skewed Globe Ratio**: Exact checks for `=== 'Missed'` will evaluate to false for `'Missed (Validation)'`. Thus, validated outcomes will not be scored for adversary control, skewing the Battle Globe's color balance towards Cobalt (defense).
6. **Offline MITRE Data Failure**: Since the catch block does not fall back to the old cache, any offline scenario with a cache older than 7 days results in empty `mitreData`, breaking all MITRE mappings and visualizations.
7. **Static Data Stream Animation**: Standard HTML `div` elements ignore SVG `stroke-dashoffset` animations. As a result, the fake data stream animation on the cards is invisible and static.

## 3. Caveats
* We assumed that the local `localStorage` holds the cache for offline testing.
* We did not test real-time network failure behaviors directly because the network is in `CODE_ONLY` mode, which matches the offline test conditions.
* We did not implement fixes because our role is read-only explorer.

## 4. Conclusion
The visualization components (`BattleGlobe.jsx`, `AttackPath.jsx`) and their data-binding hooks contain critical crash bugs, alignment/layout rendering issues under scroll or narrow viewports, skewed metrics, and robustness failures. Addressing these bugs will significantly improve the stability, correctness, and responsiveness of the Purple Team dashboards.

## 5. Verification Method
* **To verify GapDetails crash**: Run the application, create a coverage gap, navigate to its Gap Details page, and click the "Validate Remediation" button to open the modal. Observe the console error/crash.
* **To verify scroll misalignment**: Populate the Attack Path with multiple gaps in adjacent columns. Scroll horizontally or vertically, hover over a node to trigger an update, and verify that the paths misalign or jump away from the nodes.
* **To verify globe ratio skew**: Run a purple team simulation, validation-test a gap, select "Logged (Validation)" or "Missed (Validation)" as the outcome, and observe that the Battle Globe's adversary control ratio remains unchanged or incorrect.
