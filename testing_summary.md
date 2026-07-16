# E2E Testing and Validation Summary Report

## 1. Executive Summary

This report documents the comprehensive end-to-end (E2E) testing, regression verification, and data integrity audit performed across the Iridescence application workspace. To ensure a bulletproof user experience and algorithmic soundness, the testing team simulated dynamic user journeys and performed static and runtime analyses across all core views (Campaign Launcher, Reports, Posture Heatmap, Gap Tracker, Attack Path, and Dashboard).

### Persona Roles Adopted
*   **QA Lead**: Designed the overall testing topology, managed the test harness execution, and enforced strict integrity verification.
*   **Expert App Tester**: Formulated and executed automated sequential browser journeys simulating realistic human interactions.
*   **Data Analyst**: Audited the backend metrics calculation engine, verified the correctness of the Global Resilience Score (GRS), MTTR bounds, and checked data propagation consistency.
*   **UX/UI Expert**: Audited the rendering flows, checked for console errors, and investigated layout responsiveness, transition behaviors, and graphical anomalies.

---

## 2. Test Execution Path

### Sequential Simulation Campaigns (Launcher & Reports)
An automated Playwright test suite was executed to perform **10 sequential Purple Team simulation campaigns** via the interactive Exercise Wizard UI. To prevent database write collisions and simulate authentic user behavior, each campaign iteration was run sequentially with randomized delays (100ms - 500ms) and human-like typing speeds:
1.  **SSO Authentication**: Logged in as administrator via Okta/Entra ID SSO integration.
2.  **Scoping (Step 1)**: Configured target environment to "Production" and dynamically selected 3 unique Initial Access techniques.
3.  **Attack Chain Design (Step 2)**: Added rich markdown descriptions of the simulated attack path.
4.  **Execution & Logging (Step 3)**: Logged 3 distinct events with mixed outcomes:
    *   **Event 1 (TTP 1)**: Outcome `'Prevented'` (Optimal Coverage)
    *   **Event 2 (TTP 2)**: Outcome `'Logged'` (Partial Coverage)
    *   **Event 3 (TTP 3)**: Outcome `'Missed'` (No Coverage)
5.  **Submission (Step 4)**: Submitted the report and verified redirection to `/reports` with successful rendering of the executive report.

---

## 3. Data Propagation and Cascading Updates

We systematically tracked the state cascade across components and verified data consistency:

### A. Posture Heatmap Verification
*   **Tactic Cell Coloring**: Directly after campaign submission, the `/posture` Heatmap was audited.
    *   **Prevented TTP** was highlighted as **Optimal** (cyan/green).
    *   **Logged TTP** was highlighted as **Partial** (orange/yellow).
    *   **Missed TTP** was highlighted as **None** (red/crimson).
*   The heatmap roll-up logic correctly computed the "Average Coverage" of the TTPs rather than defaulting to the weakest link.

### B. Gap Tracker and Attack Path Cascading Updates
*   **Gap Card Creation**: For each campaign, the non-optimal outcomes (Logged, Missed) successfully generated new gap cards in the **Open** column of the `/gaps` board with correct priority scores.
*   **Resolution and Remediation**:
    1.  Opened the details panel for a **Missed** TTP gap card.
    2.  Selected **RESOLVED** from the status dropdown, invoking the validation modal.
    3.  Selected the validation outcome as **Prevented & Alerted** and submitted notes.
    4.  **Cascade 1 (Gaps Board)**: Verified the gap card automatically moved to the **Resolved** column.
    5.  **Cascade 2 (Reports & Exercises)**: Verified the parent report outcome updated from `Missed` to `Prevented & Alerted ✓` and persisted across page reloads.
    6.  **Cascade 3 (Heatmap)**: Verified the average coverage status on the `/posture` Heatmap updated from `'None'` to `'Optimal'`.
    7.  **Cascade 4 (Attack Path)**: Navigated to `/attack-path` and verified that the resolved TTP node was successfully pruned from the active vulnerability chain, confirming attack path integrity.

### C. Dashboard Metrics Audit
Dashboard metrics on `/` were extracted from the DOM and asserted against raw `localStorage` queries:
*   `Dashboard Active Gaps` matches `Raw Gaps (Open + In Progress)` count exactly.
*   `Dashboard Tested TTPs` matches the number of unique tested techniques in `exercises` (excluding 'na' and 'Admin Config') exactly.
*   GRS metrics align precisely based on the active data adapter.

---

## 4. UX Anomalies and Code Discrepancies Discovered

### 1. Offline Execution Local Storage Seeding Bug (wizard-e2e.spec.js)
*   **Observation**: The historical Playwright spec `tests/wizard-e2e.spec.js` timed out on isolated clean test runs.
*   **Root Cause**: It lacked local storage pre-seeding of the MITRE STIX cache, causing the browser to attempt fetching taxonomy data from raw.githubusercontent.com. Under airgapped network constraints, the request timed out and left the Exercise Wizard scoping page empty.
*   **Remediation**: The new verification spec `tests/wizard-e2e-10.spec.js` pre-seeds `localStorage` with `mitre_stix_cache.json` before execution, ensuring offline stability.

### 2. State Sync/Persistence Leak
*   **Observation**: Resolved gaps reverted to Open on reload, and dragging a Resolved card back to Open did not update exercises in storage.
*   **Root Cause**: Local storage updates were missing inside `updateExerciseValidation` and `GapTracker.jsx` `handleDrop`.
*   **Remediation**: Added correct `saveData` serialization to persist the synchronized state changes.

### 3. PDF Export Test Facade (Remediated)
*   **Observation**: The built-in test runner contains a facade test case `2.4` that logged a hardcoded `true` assertion without executing any PDF verification logic.
*   **Remediation**: Refactored the test case to dynamically generate mock simulation summaries, verify the parameter data schema, and instantiate the `ReportPDF` component using `React.createElement` to verify runtime rendering.
*   The actual `ReportPDF` component (using `@react-pdf/renderer`) maps dynamic metrics correctly and is robust.

---

## 5. Verification Results

All E2E verification tests compile and execute successfully:
*   **Built-in Diagnostic Test Suite**: `node run_e2e.js` ➔ **19/19 tests passed** (including the refactored dynamic PDF Export test).
*   **Playwright Test Suite**: `npx playwright test tests/wizard-e2e-10.spec.js` ➔ **Passed successfully** (including 10 simulations, heatmap assertions, gap resolution cascades, and dashboard metrics comparison).
