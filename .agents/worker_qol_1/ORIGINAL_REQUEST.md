## 2026-06-15T13:56:33Z
You are the UX/UI QoL Worker. Your working directory is C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\.agents\worker_qol_1.
Your task is to implement the recommended QoL enhancements directly into the React codebase of the Eclipse Ops application.

MANDATORY INTEGRITY WARNING — DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Here is the exact set of QoL improvements to implement:
1. **Sidebar Navigation Link Active State & Transitions** (in `src/App.jsx` and `src/index.css`):
   - Replace standard `Link` with `NavLink` (using `className={({ isActive }) => \`nav-item \${isActive ? 'active' : ''}\``). Remove inline hover JS mouse event handlers (`onMouseOver`, `onMouseOut`, `style` adjustments).
   - Update CSS in `src/index.css` under `.nav-item` to support transitions, hover background/color, and `.nav-item.active` (with glowing accent styling matching the iridescent theme, background, purple left-border, etc.).
2. **Double Scrollbar Elimination** (in `src/components/Dashboard.jsx` and `src/components/Reports.jsx`):
   - Remove `overflowY: 'auto'` from style of main wrappers in `Dashboard.jsx` (line 213) and `Reports.jsx` (line 729) to avoid scroll clashes with `.main-content`.
3. **MITRE Heatmap Environment Filter Occlusion** (in `src/components/MitreHeatmap.jsx`):
   - Offset the `EnvironmentDropdown` container horizontally when details panel is open (e.g. `right: activeInfo ? '440px' : '20px'`, adding a nice transition).
4. **TTP Selector Modal Form Squishing** (in `src/components/GapTracker.jsx`, `src/components/Reports.jsx`, `src/components/TTPSelector.jsx`):
   - Enforce transition width style on TTPSelector wrapper (`width: activeGroup ? '860px' : '380px'`) and clean up scrollbar rules to avoid double scrollbars.
   - Constrain parent modal wrapper width to a responsive max width like `width: '90vw', maxWidth: '1400px'` and ensure it doesn't get squished.
5. **Dashboard Cards & Kill Chain exposure responsiveness** (in `src/components/Dashboard.jsx` and `src/index.css`):
   - Replace rigid inline layout grids with CSS `.dashboard-grid` class to allow responsive wrapping. Add the class in `src/index.css`.
6. **Command Palette Gap Navigation Drawer Sync** (in `src/components/CommandPalette.jsx`):
   - Convey `openGapId` in router state when jumping to `/gaps` for a gap item.
7. **Screenshot Evidence Deletion** (in `src/components/ExerciseWizard.jsx`):
   - Wrap attached image thumbnails in a relative div container featuring a hover delete button (×) that filters out the image from `proc.evidence`.
8. **Attack Path Success Empty State** (in `src/components/AttackPath.jsx`):
   - Render a friendly success panel when `activeGaps.length === 0` to celebrate complete remediation.
9. **RuleStudio Standalone Crash Guard** (in `src/components/RuleStudio.jsx`):
   - Wrap `onClose()` inside a safety check `if (onClose) onClose();` to prevent crashes when saving inside `GapDetails.jsx` (which is standalone and lacks `onClose`).
10. **"Risk Accepted" Kanban Drop Zone** (in `src/components/GapTracker.jsx`):
    - Add drag-over and drop event handlers on the "Risk Accepted" accordion/details section at the bottom, so users can drag gaps there directly to accept risk.
11. **Smooth DND State Transition** (in `src/components/GapTracker.jsx`):
    - When a card is dragged from "Open" to "Resolved", instead of displaying a blocking toast warning, let the transition go through and automatically change status to "Resolved" directly.
12. **Tactics Navigator Sidebar Empty State** (in `src/components/MitreHeatmap.jsx`):
    - Show a fallback message like "No tactics match search filters" if the filtered tactics list length is 0.
13. **AI Assistant Welcome State & Setup Helper** (in `src/components/AIAssistant.jsx`):
    - If API key is missing, render a setup helper inside the panel instead of returning `null`. If key is present but history is empty, show quick suggestion chips to start conversation.

Please implement these 13 improvements.
After implementing:
1. Run `npm run build` to verify the application builds successfully without fatal syntax or compilation errors.
2. Run `npm run test:e2e` to verify that all programmatic tests continue to pass.
3. Verify that changes do not cause fatal React render errors.
4. Document all implemented improvements in your handoff report and send it back to the Project Orchestrator (conversation ID: abfcf375-9237-49bc-9f4b-61019ffb581a).
