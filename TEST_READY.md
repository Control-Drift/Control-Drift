# TEST READY: E2E Test Suite Validation Guide

This document describes how to execute the newly integrated E2E regression and validation test suite for the Iridescence application, and details the complete list of available test cases.

---

## 1. How to Run the E2E Test Suite

1. **Start the Application**:
   Ensure you have dependencies installed, then run the development server from the project root:
   ```bash
   npm run dev
   ```
   Alternatively, compile and preview the build:
   ```bash
   npm run build
   `npm run preview`
   ```

2. **Access the Test Runner**:
   - Open your browser and navigate to `http://localhost:5173/test-runner` (or the respective port indicated by Vite).
   - Alternatively, use the sidebar navigation link labeled **Test Runner** directly from the UI.

3. **Executing Tests**:
   - Click **Run Test Suite** in the top right to start programmatic testing.
   - Click any test case card to expand and view its step-by-step assertions as they execute.
   - Use **Reset Sandbox** to clear existing data and run the test cases from a clean slate.
   - Click **Restore Original State** at any time to return the application's local storage and context variables to their pre-test values.

---

## 2. Documented E2E Test Cases

### Tier 1: Environment & Config
- **Test 1.1: Default Environment Configuration**
  - *Goal*: Verify that the default environment configurations contain standard deployment platforms (Linux, macOS, Windows Server, Windows Workstation, Active Directory, Azure/Entra ID).
  - *Type*: Schema validation.
- **Test 1.2: Update Environment Configuration**
  - *Goal*: Programmatically toggle configuration flags in context and check if they update and synchronize state correctly.
  - *Type*: State transition check.
- **Test 1.3: Active Environment Filter Toggling**
  - *Goal*: Update active environment view filters and verify propagation in context.
  - *Type*: Context state propagation check.
- **Test 1.4: Dashboard Date & mitreData Guards**
  - *Goal*: Verify that dashboard trending does not crash on empty/invalid dates or empty mitreData.
  - *Type*: Robustness and crash prevention check.

### Tier 2: Exercise & Campaign
- **Test 2.1: Add Campaign Exercise**
  - *Goal*: Trigger `completeExercise` for a target TTP and verify that the exercise list incorporates the entry with exact parameters (finding, remediation, status, campaign).
  - *Type*: Write and query verification.
- **Test 2.2: Campaign Evidence Attachment**
  - *Goal*: Attach mock base64 evidence to a campaign and confirm it updates the `campaignEvidence` map correctly.
  - *Type*: Evidence upload simulation.
- **Test 2.3: Save Campaign Summary**
  - *Goal*: Persist campaign summaries and audit details in context and confirm the data schema matches.
  - *Type*: Schema write validation.
- **Test 2.4: PDF Export Data Alignment**
  - *Goal*: Verify that PDF export parameters contain participants and testResults, preventing N/A fallbacks.
  - *Type*: PDF payload schema verification.

### Tier 3: MITRE & Gap Management
- **Test 3.1: Security Gap Auto-Resolution**
  - *Goal*: Verify that completing an exercise with a `high` status (prevented) automatically transitions any associated `Open` security gaps to `Resolved` status, adding system notes.
  - *Type*: Logic & side effect integration.
- **Test 3.2: Validation Re-Testing & Recalculation**
  - *Goal*: Call `updateExerciseValidation` and verify that the gap status changes to `Resolved`, and the corresponding campaign summary's procedures recalculate to "Prevented ✓ Validated".
  - *Type*: State recalculation regression.
- **Test 3.3: Tactic & Technique Scope Toggles**
  - *Goal*: Trigger technique scoping modifications (toggling between `na` and `unknown`) and verify that tactic-level scores recalculate appropriately.
  - *Type*: Aggregation and scoping validation.
- **Test 3.4: Reopened Gaps State Synchronization**
  - *Goal*: Verify that dragging a resolved gap back to Open/In Progress reverts the TTP status to low/Missed in the exercises list.
  - *Type*: State sync validation.
- **Test 3.5: Manual Gap Creation Custom Fields**
  - *Goal*: Verify that manual gap creation form supports custom severity and priority score.
  - *Type*: Schema write validation.
- **Test 3.6: Sub-Technique TTP Name Resolution**
  - *Goal*: Verify that sub-techniques are resolved correctly without ReferenceErrors when validating remediation.
  - *Type*: Name resolution verification.
- **Test 3.7: Status Dropdown Sync Leak with Multiple TTPs**
  - *Goal*: Verify that changing status back from Resolved for a gap with multiple comma-separated TTPs reverts all of them to low and updates MITRE data reactively.
  - *Type*: Multi-TTP state sync validation.


### Tier 4: AI Copilot & Stream Parsing
- **Test 4.1: AI Missing API Key Check**
  - *Goal*: Clear settings API keys, trigger `generateAIContent`, and verify that it correctly throws validation errors (preventing unauthorized requests).
  - *Type*: Constraint verification.
- **Test 4.2: AI Stream Parsing Simulation**
  - *Goal*: Intercept network `fetch` requests with a chunked stream reader to confirm the stream aggregator properly translates streaming tokens and compiles the complete message.
  - *Type*: Stream decoder mock E2E test.
