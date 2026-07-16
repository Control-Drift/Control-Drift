# Handoff Report - Component Testing Strategy (Milestone 2)

## 1. Observation

Direct observations made on files, configurations, and structures in the workspace:

- **Vitest Configuration**: File `vitest.config.js` exists at `C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\vitest.config.js` and contains:
  ```js
  8:     setupFiles: ['./src/setupTests.js'],
  9:     globals: true,
  10:     include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}']
  ```
- **Test Setup File**: File `src/setupTests.js` exists and contains:
  ```js
  1: import '@testing-library/jest-dom';
  ```
- **Settings Component**: Located at `src/components/Settings.jsx`.
  - Imports: `DOMPurify` (line 2), `encryptData` and `decryptData` from `../lib/cryptoUtils` (line 3), `useAppContext` from `../AppContext` (line 4), and schemas from `../lib/schemas` (line 6).
  - Consumes context values (line 11): `aiSettings`, `setAiSettings`, `targetEnvironments`, `deleteEnvironment`, `targetTags`, `deleteTag`, `targetSecurityControls`, `deleteSecurityControl`, `addSecurityControl`, `confirmAction`, `dbConfig`, `setDbConfig`, `dbAdapter`, `testDbConnection: pingDb`.
  - Consumes additional context values (line 49): `gaps`, `exercises`, `simulationSummaries`, `simulationEvidence`, `setGaps`, `setExercises`, `setSimulationSummaries`, `setSimulationEvidence`, `setActiveAiContext`, `injectTestData`.
- **AttackPath Component**: Located at `src/components/AttackPath.jsx`.
  - Consumes context values (line 199): `gaps`, `exercises`, `mitreData`, `setActiveAiContext`, `generateAIContent`, `aiSettings`, `isAiActive`.
  - Renders dynamic SVG paths between elements mapped in `nodesRef.current` (lines 429-458).
  - Integrates AI logic: calls `generateAIContent` in `handleGeneratePaths` (line 247).
  - Uses `react-router-dom`'s `useNavigate` (line 208) to navigate to `/gaps` with state (line 907).
- **GapTracker Component**: Located at `src/components/GapTracker.jsx`.
  - Consumes context values (line 151): `gaps`, `updateGap`, `createGap`, `deleteGap`, `isReadOnly`, `mitreData`, `updateExerciseValidation`, `aiSettings`, `setActiveAiContext`, `activeEnvironmentFilter`, `activeTagFilter`, `targetEnvironments`, `simulationSummaries`, `setSimulationSummaries`, `setExercises`, `setAllExercisesData`, `dbAdapter`, `confirmAction`.
  - Implements drag and drop handlers: `handleDragStart` (line 226), `handleDragEnd` (line 233), `handleDragOver` (line 240), `handleDrop` (line 247).
  - Renders portals using `createPortal` for Submit Validation (line 741), Risk Acceptance (line 829), and Gap Details (line 924).
  - Imports Recharts elements on line 10, but none are used in the component body.
- **Reports Component**: Located at `src/components/Reports.jsx`.
  - Consumes context values (line 16): `dbAdapter`, `exercises`, `completeExercise`, `simulationSummaries`, `saveSimulationSummary`, `simulationEvidence`, `addSimulationEvidence`, `compressImage`, `mitreData`, `aiSettings`, `generateAIContent`, `gaps`, `setActiveAiContext`, `isAuthenticated`, `isAiActive`.
  - Imports `PDFDownloadLink` from `@react-pdf/renderer` (line 10) and renders `ReportPDF` dynamically (lines 613-643).
  - Renders subcomponents: `CoverageRatingDropdown`, `SeverityDropdown`, `ValidationOutcomeDropdown`, `TTPSelector`, `UnifiedPosturePill`, `EventCard`.

---

## 2. Logic Chain

Based on the observations above, the logical steps to formulate the testing strategy are:

1. **Test Environment Scope**: Since `vitest.config.js` is set to `jsdom` (Observation 1) and imports `@testing-library/jest-dom` (Observation 2), all component tests should be run in a browser-like DOM environment utilizing `@testing-library/react` and `vitest`.
2. **Context Mocking Requirement**: All four components consume a large number of states, setters, and actions from `AppContext` (Observations 3, 4, 5, 6). Therefore, each test suite must mock `useAppContext` or render components wrapped in a custom mock `AppContext.Provider` containing necessary mocked values and spies.
3. **Third-Party Mocking (Avoid Failures)**:
   - `@react-pdf/renderer` (`PDFDownloadLink` in Observation 6) attempts to use browser APIs like canvas and PDF workers which are unsupported or highly unstable under `jsdom`. Stubbing `PDFDownloadLink` to render a simple anchor/button is required.
   - Recharts (Observation 5) imports in `GapTracker.jsx` are unused but might cause parsing overhead. No direct rendering of charts is present in `GapTracker.jsx`, so mocking is optional but good practice to avoid layout sizing warnings in jsdom.
   - `react-router-dom` (`useNavigate`, `useLocation`, `Link`) is used across the components (Observations 4, 5, 6). React-router hooks must be mocked or components must be wrapped in `MemoryRouter`.
4. **Browser API Stubs**:
   - `cryptoUtils` (`encryptData`, `decryptData` in Observation 3) uses Node/Browser web crypto APIs. Unit tests for `Settings.jsx` must mock these functions.
   - DOM APIs like `FileReader`, `URL.createObjectURL`, and `sessionStorage` are used (Observations 3, 4, 5). These must be mocked or stubbed.
5. **Component Partitioning**: Tests should be isolated by mocking subcomponents (e.g., `GapDetails`, `TTPSelector`, `EventCard`, `SeverityDropdown`) to ensure unit-test purity and avoid cascading test failures.

---

## 3. Caveats

- **Visual Layout Verification**: We are using jsdom, which does not compute physical coordinates, layout positions, or compute SVG dimensions. Test verification for `AttackPath.jsx` SVG lines (Observation 4) will only assert that `<path>` tags are rendered with valid string attributes, rather than verifying they connect visually correct points.
- **AI Hook/Integration**: AI generation (`generateAIContent` in `Reports.jsx` and `AttackPath.jsx`) is tested by resolving mocked promises with static JSON mock structures, rather than testing real AI responses.
- **Database Adapters**: The database adapter (`dbAdapter`) will be mocked as a plain object with spy methods (`bulkImport`, `fetchExercises`, etc.) rather than testing actual Supabase, REST, or LocalStorage adapters.

---

## 4. Conclusion

A comprehensive component testing strategy has been created. The strategy divides work into four separate unit/integration test files mapping to each core component, outlining exact mock configurations, elements to query, events to trigger, and assertions to verify.

Below is the concrete testing strategy for each component:

### Strategy: Settings.jsx Test Suite (`src/__tests__/Settings.test.jsx`)

#### 1. Mocks and Environment Setup
- **AppContext Mock**:
  - Custom `confirmAction` mock that immediately calls its callback (allowing synchronous flows).
  - Mock state values: `aiSettings` (Gemini), `dbConfig` (local), arrays for `targetEnvironments`, `targetTags`, `targetSecurityControls`.
  - Spies: `deleteEnvironment`, `deleteTag`, `deleteSecurityControl`, `addSecurityControl`, `setAiSettings`, `setDbConfig`.
- **Crypto Mock**: Mock `encryptData` and `decryptData` from `../lib/cryptoUtils` to return resolved strings/ciphertexts.
- **Global Fetch Mock**: Mock `global.fetch` to intercept AI & DB connection pings.
- **DOM/Global Stubs**:
  - Stub `URL.createObjectURL` to return a dummy blob URL.
  - Stub `URL.revokeObjectURL` as an empty mock.
  - Mock `window.location` assignment to verify Danger Zone routing.
  - Mock `FileReader` prototype `readAsText` to simulate loading backup files.

#### 2. Key Test Cases, Queries, and Assertions
- **Initial Render**:
  - Assert sections like "Generative AI Integration" and "Danger Zone" are visible.
  - Assert AI provider options (Gemini, OpenAI, Anthropic, etc.) render.
- **Panel Toggles**:
  - Click on "Database & Sync" panel header. Assert that its height/expanded state changes and inner forms are rendered.
- **Form Input & Key Visibility**:
  - Type in the API Key input. Assert local state updates.
  - Click the eye icon. Assert that input type changes from `password` to `text`.
- **Test AI Connection**:
  - Set provider to "Gemini" and click "Test AI Connection".
  - Intercept fetch to googleapis. Resolve with HTTP 200. Assert status displays "Connection successful!".
  - Trigger failure (HTTP 500). Assert error message is visible.
- **Test DB Connection**:
  - Set provider to "supabase", type endpoint, and click "Test Database Connection".
  - Assert it queries `${endpoint}/rest/v1/gaps?limit=1` with headers. Resolve with HTTP 200. Assert success message.
- **Target Environments / Tags / Controls**:
  - Assert listed custom environments, tags, and controls.
  - Click the delete (trash) button. Verify `confirmAction` is called. Assert deletion callback runs.
  - Type in "Add Control" input, press Enter. Assert `addSecurityControl` is called.
- **Danger Zone**:
  - Click "Erase All Application Data". Assert `confirmAction` triggers. On confirm, assert `localStorage.clear()` is called and `window.location.href` is updated.
- **Backup Export & Import**:
  - Export: click "Export Backup", enter password. Assert `encryptData` runs. Assert anchor element is created and clicked.
  - Import: simulate file input change. Assert `FileReader` reads file, `decryptData` decrypts, schemas validate, and `dbAdapter.bulkImport` is called.

---

### Strategy: AttackPath.jsx Test Suite (`src/__tests__/AttackPath.test.jsx`)

#### 1. Mocks and Environment Setup
- **AppContext Mock**:
  - `gaps`: list of mock gap objects (e.g. Critical, High, Medium, Low) mapped to different MITRE Tactics.
  - `exercises`: list of defense exercises.
  - `mitreData`: mock MITRE skeleton structure mapping Tactics (Initial Access, Execution, etc.) to Technique IDs.
  - `generateAIContent`: mock resolving promise with simulated red team JSON output `{"edges": [{"sourceId": "GAP-1", "targetId": "GAP-2", "rationale": "Pivot vector"}]}`.
  - `isAiActive`: `true`.
  - Spies: `setActiveAiContext`.
- **Router Mock**: Mock `useNavigate` from `react-router-dom` to return a spy.
- **SessionStorage Mock**: Spy on `sessionStorage.getItem` and `setItem`.
- **HTML Portal Target**: Create `<div id="root"></div>` in document body to support portal mounting.

#### 2. Key Test Cases, Queries, and Assertions
- **Empty State**:
  - Render with empty `gaps` list.
  - Assert message "No Active Attack Paths" is displayed.
  - Assert "Map Viable Paths" button is disabled.
- **Gap Plotting Logic**:
  - Provide gaps mapped to T1190 (Initial Access) and T1059 (Execution).
  - Assert they render under their respective Cyber Kill Chain phase columns: "Delivery" and "Exploitation".
  - Verify card contents: severity badge, TTP name, and environment tag.
- **AI Path Generation**:
  - Click "Map Viable Paths".
  - Verify "AI Assessing Vectors..." state is displayed.
  - Resolve `generateAIContent`. Verify that the threat vectors count badge updates to `1` (or correct edge count).
  - Verify SVG paths (`<path>` elements) are drawn.
- **Interactive Tooltips & Hovers**:
  - Fire hover event over SVG path. Assert that the AI Escalation Rationale tooltip renders in a Portal containing the mock rationale text.
  - Fire hover event over a gap card. Assert that class names/styles of downstream and upstream nodes update to apply highlighting/dimming.
- **Detail Modal & Navigation**:
  - Click on a gap card. Assert that the Detail Modal opens via Portal.
  - Verify details: outcome, coverage, description, remediation.
  - Click "View Raw Payload". Assert pre-formatted code block expands.
  - Click "Open in Gap Tracker". Assert router `navigate` is called with `/gaps` and state containing the gap's ID.

---

### Strategy: GapTracker.jsx Test Suite (`src/__tests__/GapTracker.test.jsx`)

#### 1. Mocks and Environment Setup
- **AppContext Mock**:
  - `gaps`: lists of mock gaps across status columns (Open, In Progress, Resolved).
  - `mitreData`: mock techniques lookup mapping.
  - `updateExerciseValidation`: mock resolving promise.
  - `dbAdapter`: mock adapter.
  - Spies: `updateGap`, `setActiveAiContext`, `setSimulationSummaries`, `setExercises`, `setAllExercisesData`.
  - `confirmAction`: Mock to immediately call its callback.
- **Toast Mock**: Mock `useToast` to return a spy `addToast`.
- **Router Mock**: Mock `useNavigate` and `useLocation` from `react-router-dom`.
- **Child Component Stubs**: Stub `GapDetails`, `TTPSelector`, `EnvironmentDropdown`, `TagDropdown`, `SeverityDropdown` to isolate `GapTracker` layout testing.
- **HTML Portal Target**: Create `<div id="root"></div>` in document body.

#### 2. Key Test Cases, Queries, and Assertions
- **Kanban Board Layout & Sorting**:
  - Render gaps with various priority scores.
  - Assert that cards are placed in their respective status columns (Open, In Progress, Resolved).
  - Assert they are sorted in descending order of priority/risk score.
  - Assert Discovered, Open, In-Progress, Resolved count metrics match gap counts.
- **MTTR Calculation**:
  - Render resolved gaps with known `createdDate` and `resolvedDate`. Assert the MTTR badge correctly displays calculated mean time (e.g. `2d 4h`).
  - Render with no resolved gaps. Assert MTTR displays `N/A`.
- **Filtering**:
  - Type query in search input. Assert that the list of gaps is filtered by query text.
  - Select "Critical" in severity dropdown. Assert only Critical gaps remain in the open column list.
- **Drag and Drop Transitions**:
  - Drag a card from Open to In Progress. Assert `updateGap` is called with `status: 'In Progress'`.
  - Drag a card to "Resolved". Assert Validation Modal opens.
  - Drag a card to "Risk Accepted". Assert Risk Acceptance Modal opens.
- **Validation Modal**:
  - On dragging card to Resolved, submit modal with "Logged" outcome.
  - Assert `updateExerciseValidation` is called.
  - If resolved returns false (coverage not optimal), assert warning toast "Gap remains In Progress...".
  - If resolved returns true, assert success toast.
- **Risk Acceptance Modal**:
  - Click "Accept Risk" on a card.
  - Assert error validation if fields are blank.
  - Type approving authority and justification. Click Submit.
  - Assert associated exercises are updated to status `exception` in DB/context and gap is moved to 'Risk Accepted' status.
- **Risk Revocation**:
  - Drag card out of 'Risk Accepted' to 'In Progress'. Assert warning confirmation displays. Confirm and assert status updates.

---

### Strategy: Reports.jsx Test Suite (`src/__tests__/Reports.test.jsx`)

#### 1. Mocks and Environment Setup
- **AppContext Mock**:
  - `exercises`, `gaps`, `simulationSummaries`, `simulationEvidence`.
  - Spies: `completeExercise`, `saveSimulationSummary`, `addSimulationEvidence`, `generateAIContent`, `setActiveAiContext`.
  - `isAuthenticated`: `true`.
  - `isAiActive`: `true`.
- **Toast Mock**: Mock `useToast` to return `addToast` spy.
- **Router Mock**: Mock `useNavigate` and `useLocation` with custom location state.
- **PDF Renderer Mock**: Stub `@react-pdf/renderer` component `PDFDownloadLink` to render a simple button: `({ children }) => children({ loading: false })`.
- **Child Component Stubs**: Stub `EventCard`, `TTPSelector`, `ReportPDF`.
- **HTML Portal Target**: Create `<div id="root"></div>` in document body.

#### 2. Key Test Cases, Queries, and Assertions
- **Simulations Archive Grid**:
  - Render with list of simulations in `simulationList` (loaded via context).
  - Verify cards render name, date, and outcome count badges (Prevented, Alerted, Logged, Missed).
- **Search Filtration**:
  - Type search query. Assert that simulation cards are filtered by name or date.
- **Simulation Details Render**:
  - Click on a simulation card. Assert view switches to Executive Report details.
  - Verify back breadcrumb navigation: click back button and assert grid view returns or `navigate` executes with location state history.
  - Assert Executive Summary renders correctly (headers, tables, lists).
- **Drilldown and Code Modals**:
  - Click "Open Drilldown". Assert Drilldown Modal opens. Verify Scoping details and event logs are correct.
  - Click "View Payload" in event. Assert Code view modal displays raw payload code.
- **Log External Simulation**:
  - Click "Log External Simulation". Assert modal opens.
  - Click "Add Another Event". Assert a new `EventCard` stub is appended.
  - Trigger validation: click Submit with empty simulation name. Assert warning toast.
  - Map TTP, fill details, and submit. Assert `completeExercise` is invoked for mapped TTPs with correct calculated outcomes and `saveSimulationSummary` is called with the metadata.
  - Click "Draft Summary". Assert `generateAIContent` is called with procedures payload and text area updates with generated executive summary.

---

## 5. Verification Method

To verify the strategy and configuration are sound:

1. **Dry Run / Sanity Check**: Run the existing test suite to ensure the testing dependencies are functional:
   ```powershell
   npm run test -- --run
   ```
2. **Implementation Verification**:
   - Inspect files under `src/__tests__/` (e.g. `CustomLogo.test.jsx`) to confirm the imports are consistent.
   - Verify that test files for these components are created inside `src/__tests__/` using the `.test.jsx` file naming convention.
   - Assert that no files are written in the `.agents/` folder except analysis and handoff logs, conforming to layout compliance requirements.
