# Component Testing Strategy Report: Core UI Components

This report provides a read-only investigation and concrete testing strategy for four core components of the application: `Reports.jsx`, `GapTracker.jsx`, `Settings.jsx`, and `AttackPath.jsx`.

---

## 1. Observation

### Reports.jsx
- **File Path**: `C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\src\components\Reports.jsx`
- **Context Dependencies**: Consumes a massive set of keys from `useAppContext()` (lines 16-17):
  ```javascript
  const { dbAdapter, exercises, completeExercise, simulationSummaries, saveSimulationSummary, simulationEvidence, addSimulationEvidence, compressImage, mitreData, aiSettings, generateAIContent, gaps, setActiveAiContext, isAuthenticated, isAiActive } = useAppContext();
  const { addToast } = useToast();
  ```
- **External Library / Routing imports**:
  - `@react-pdf/renderer` is imported for `<PDFDownloadLink>` at line 10.
  - `useLocation` and `useNavigate` are imported from `react-router-dom` at line 9.
- **Critical Features**:
  - Renders list of simulations based on `simulationList` (lines 986-1048).
  - Triggers selection of simulation which loads exercises in paginated tables (lines 862-899).
  - Form validation and submittal on "Log External Simulation" modal (lines 297-380).
  - Asynchronous AI Drafting capability using `generateAIContent(prompt, systemInstruction)` (lines 382-411).
  - Complex nested modals for Drilldowns (lines 421-568).

### GapTracker.jsx
- **File Path**: `C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\src\components\GapTracker.jsx`
- **Context Dependencies**: Consumes context states and update functions (lines 151-152):
  ```javascript
  const { gaps, updateGap, createGap, deleteGap, isReadOnly, mitreData, updateExerciseValidation, aiSettings, setActiveAiContext, activeEnvironmentFilter, activeTagFilter, targetEnvironments, simulationSummaries, setSimulationSummaries, setExercises, setAllExercisesData, dbAdapter, confirmAction } = useAppContext();
  const { addToast } = useToast();
  ```
- **Portals**:
  - Employs `createPortal` for the Validation Modal (line 782), Risk Acceptance Modal (line 829), and Gap Details Modal (line 924):
  ```javascript
  {showRiskModal && createPortal(..., document.getElementById('root'))}
  ```
- **Libraries**:
  - Imports Recharts components (line 10) though they are primarily used in metrics (it is imported here and should be stubbed to prevent canvas context errors in tests).

### Settings.jsx
- **File Path**: `C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\src\components\Settings.jsx`
- **Context Dependencies**:
  ```javascript
  const { aiSettings, setAiSettings, targetEnvironments, deleteEnvironment, targetTags, deleteTag, targetSecurityControls, deleteSecurityControl, addSecurityControl, confirmAction, dbConfig, setDbConfig, dbAdapter, testDbConnection: pingDb } = useAppContext();
  const { gaps, exercises, simulationSummaries, simulationEvidence, setGaps, setExercises, setSimulationSummaries, setSimulationEvidence, setActiveAiContext, injectTestData } = useAppContext();
  ```
- **Network Requests**:
  - Executes real network pings to test AI endpoints (lines 183-232) and Database endpoints (lines 234-262) using global `fetch()`:
  ```javascript
  res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`, { ... })
  ```
- **Cryptographic Operations**:
  - Uses helper utility functions `encryptData` and `decryptData` (line 3) for Backup / Restore.
- **Validations**:
  - Uses `validateBulkData` and schemas from `../lib/schemas` (line 6) to sanitize and validate uploaded files.

### AttackPath.jsx
- **File Path**: `C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\src\components\AttackPath.jsx`
- **Context Dependencies**:
  ```javascript
  const { gaps, exercises, mitreData, setActiveAiContext, generateAIContent, aiSettings, isAiActive } = useAppContext();
  ```
- **Mathematical / SVG Logic**:
  - Calculates start/end coordinates of SVG paths dynamically using `getBoundingClientRect()` of nodes cached in `nodesRef` (lines 429-445):
  ```javascript
  const sourceEl = nodesRef.current.get(String(sourceGapId));
  const targetEl = nodesRef.current.get(String(targetGapId));
  ...
  const startX = sourceRect.right - containerRect.left + scrollLeft;
  const startY = sourceRect.top + sourceRect.height / 2 - containerRect.top + scrollTop;
  ```
- **Interactive States**:
  - Graph traversal based on hovered node (`activeTraceNodes`) to highlight paths (lines 476-519).
  - Tooltips rendered in a portal based on hovered edge coordinate mapping (lines 759-779).

---

## 2. Logic Chain

1. **Reports.jsx**:
   - *Observation*: The component uses `generateAIContent` (Obs: Reports.jsx line 404) and `completeExercise`/`saveSimulationSummary` (Obs: Reports.jsx lines 351, 373) when drafting summaries or submitting external logs.
   - *Reasoning*: A reliable unit test must verify that clicking "Draft Summary" triggers the correct prompt and updates the executive summary text box, and that submitting calls the context handlers with matching payloads. Mocks are needed for the context adapters and `generateAIContent`.
   - *Observation*: The component imports `@react-pdf/renderer` to prepare files for download (Obs: Reports.jsx lines 10, 613).
   - *Reasoning*: PDF rendering will fail in JSDOM due to node canvas limitations. Therefore, `@react-pdf/renderer` must be mocked, replacing `PDFDownloadLink` with a simple anchor element button.

2. **GapTracker.jsx**:
   - *Observation*: The component invokes React Portals targeted at `document.getElementById('root')` (Obs: GapTracker.jsx line 825, 920, 931).
   - *Reasoning*: If tests are run directly using standard React Testing Library rendering, `document.getElementById('root')` will evaluate to `null` in JSDOM, causing component runtime crashes.
   - *Conclusion*: The test suite setup must programmatically insert a `<div id="root"></div>` into `document.body` prior to mounting, or `createPortal` itself must be mocked out.
   - *Observation*: Drag-and-drop operations alter the gap status, triggering modals (Obs: GapTracker.jsx lines 256-265).
   - *Reasoning*: Test cases must simulate dragging by dispatching custom mock events (`dragstart`, `dragover`, `drop`) populated with `dataTransfer` payloads, asserting that status change forms are rendered upon dropping.

3. **Settings.jsx**:
   - *Observation*: The connection testing functions make direct, un-mocked global `fetch()` calls to external AI endpoints and supabase rest tables (Obs: Settings.jsx lines 202, 246).
   - *Reasoning*: Because these tests run in an offline (CODE_ONLY) environment, actual HTTP requests will immediately throw connection failures.
   - *Conclusion*: We must spy on and mock `global.fetch` to return stubbed Response objects (both 200 OK and 500 error scenarios) to verify connection successes and error prompts.
   - *Observation*: Backup export/import runs `encryptData` / `decryptData` (Obs: Settings.jsx lines 85, 120).
   - *Reasoning*: Web Crypto might not be fully operational or fast in JSDOM. Stubbing out `cryptoUtils` ensures the file conversion flow behaves predictably.

4. **AttackPath.jsx**:
   - *Observation*: SVG layout pathways are derived by fetching positions of child elements using `getBoundingClientRect()` (Obs: AttackPath.jsx line 433-434).
   - *Reasoning*: Under JSDOM, all DOM nodes report dimensions and offsets of `0`. This means SVG paths will all collapse into coordinates `(0, 0)`.
   - *Conclusion*: Testing the SVG drawing logic, path highlights, and hover tooltips requires stubbing `getBoundingClientRect` on selected DOM elements inside the test runner so they return mock boundaries.

---

## 3. Caveats

- **JSDOM Layout Mocking**: JSDOM does not calculate CSS rules, margins, or relative flexbox positions. Any coordinate-based tooltips in `AttackPath.jsx` and `GapTracker.jsx` must be tested using unit mocks of `getBoundingClientRect` or structural presence assertions rather than testing pixel accuracy.
- **Web Crypto Mocking**: In JSDOM environments, `window.crypto` is often undefined or missing key algorithms (like PBKDF2 or AES-GCM). `cryptoUtils` **must** be mocked explicitly to resolve with plain text or simple encodings to bypass the crypto engine.
- **Portals Placement**: Ensure global configuration scripts in Vitest handle root node injection (`<div id="root"></div>`) so that portal-heavy components do not throw "Target container is not a DOM element."
- **Recharts Support**: Recharts requires canvas capabilities. Vitest tests should mock the entire `recharts` package to render simplified SVG components rather than failing on layout cycles.

---

## 4. Conclusion: Concrete Test Strategies

### Component: `Reports.jsx`
* **Target Elements & Queries**:
  - `screen.getByPlaceholderText(/search by name/i)`: Query search box.
  - `screen.getByRole('button', { name: /log external simulation/i })`: Log button.
  - `screen.getByText(/no simulations logged/i)`: Verify empty state.
  - `screen.getByText(/executive report/i)`: Selection verification.
* **States to Assert**:
  - **Initial Empty State**: Ensure empty placeholder is shown when `simulationList` is empty.
  - **Simulation Grid**: Verify correct names are listed for active simulations.
  - **Simulation Detail State**: Clicking a simulation details card renders the summary block, TTP statistics, and paginated exercise table.
  - **AI Drafting State**: Click AI Draft, ensure loading state spinner displays, followed by text box value updates.
* **Events to Simulate**:
  - Type query into Search input -> verify cards count matches.
  - Click simulation card -> verify view updates with selection details.
  - Open Log Modal -> input simulation name, select TTP -> click submit -> verify `completeExercise` calls.
* **Mock Requirements**:
  - `AppContext`: Provide mock state for exercises, mitreData, summaries, gaps.
  - `react-router-dom`: Mock `useNavigate`, `useLocation` hooks.
  - `@react-pdf/renderer`: Mock `PDFDownloadLink` to render a simple `<button>` to avoid PDF compiler crashes.

### Component: `GapTracker.jsx`
* **Target Elements & Queries**:
  - `screen.getByText(/discovered gaps/i)`: Verification of board header.
  - `screen.getByText(/accept risk/i)`: Button inside card.
  - `screen.getByRole('button', { name: /submit validation/i })`: Modal button.
  - `screen.getByLabelText(/approving authority/i)`: Input in Risk Acceptance.
* **States to Assert**:
  - **Kanban Columns**: Verify column lists (Open, In Progress, Resolved) and item counts.
  - **Validation Dialog State**: Dropping a card onto "Resolved" shows the validation inputs.
  - **Risk Accepted State**: Dropping a card onto "Risk Accepted" or clicking the button displays CISO Approving Authority inputs.
* **Events to Simulate**:
  - Drag card by firing `dragstart` event -> fire `dragover` on target column -> fire `drop` event -> verify dialog is shown or status is modified.
  - Submit forms within portals -> assert callbacks `updateGap` and `updateExerciseValidation`.
* **Mock Requirements**:
  - Portal `#root` node initialization.
  - Recharts component stubbing.
  - `AppContext`: Mock `gaps`, `updateGap`, `updateExerciseValidation`, `confirmAction`.

### Component: `Settings.jsx`
* **Target Elements & Queries**:
  - `screen.getByRole('button', { name: /test ai connection/i })`
  - `screen.getByRole('button', { name: /test database connection/i })`
  - `screen.getByRole('button', { name: /export backup/i })`
  - `screen.getByRole('button', { name: /save settings/i })`
  - Input fields for AI API key, database endpoint, and security control names.
* **States to Assert**:
  - **Collapsible Toggle State**: Clicking header panels hides/shows configuration sections.
  - **AI / DB Connection Success**: Status message turns green with `Connection successful!` text.
  - **AI / DB Connection Failure**: Status turns red and prints the exact error response message.
  - **Export Password Dialog**: Opens upon clicking backup.
* **Events to Simulate**:
  - Select different AI providers -> check inputs toggle accordingly (e.g. custom endpoints only show on Azure or Custom).
  - Simulate typing API credentials.
  - Click connection pings -> assert HTTP mock calls are made.
  - Trigger backup upload -> parse file, input password, trigger schema checks.
* **Mock Requirements**:
  - `fetch` spy: Intercept `fetch` for AI and DB connection URLs.
  - `cryptoUtils` stubs: Intercept `encryptData` and `decryptData` to avoid JSDOM pbkdf2 errors.
  - File reading: Mock `FileReader` prototype for testing file uploads.
  - `window.URL.createObjectURL` mock implementation.

### Component: `AttackPath.jsx`
* **Target Elements & Queries**:
  - `screen.getByRole('button', { name: /map viable paths/i })`
  - SVG elements (`svg`, `path`, `g`).
  - Tooltip container with `AI Escalation Rationale`.
  - Node card containers.
* **States to Assert**:
  - **Phases List**: Render of kill-chain stages.
  - **Plotted Paths State**: Presence of SVG `path` elements matching the coordinate connections.
  - **Hover Highlight State**: When hovering node X, verify target nodes in its trace receive active scaling classes, while other nodes are dimmed.
  - **AI Tooltip State**: Hovering path edge draws coordinates, text rationale tooltip appears.
* **Events to Simulate**:
  - Click "Map Viable Paths" -> verify loading spinner -> resolve mock JSON response -> verify path overlays draw.
  - Mouseover node card -> check active trace highlight sets.
  - Mouseover connection lines -> check hover-tooltip portal drawing.
* **Mock Requirements**:
  - `getBoundingClientRect` override:
    ```javascript
    Element.prototype.getBoundingClientRect = function() {
        if (this.classList.contains('hover-lift')) {
            // Mock gap card coordinate boundaries
            return { top: 100, left: 100, right: 250, bottom: 245, width: 150, height: 145 };
        }
        // Mock container bounds
        return { top: 0, left: 0, right: 1000, bottom: 800, width: 1000, height: 800 };
    };
    ```
  - `AppContext`: Mock `gaps`, `generateAIContent`, `isAiActive`.

---

## 5. Verification Method

To verify these testing strategies are correct:
1. Inspect the Vitest test suites at `src/components/__tests__/` (e.g., creating test specs like `Reports.test.jsx`, `GapTracker.test.jsx`, etc.).
2. Execute the test command on the system:
   ```bash
   npm run test
   ```
   Or explicitly target a component spec:
   ```bash
   npx vitest run src/components/__tests__/Reports.test.jsx
   ```
3. Verify test runs without throwing JSDOM-specific rendering errors related to:
   - React portals missing root nodes.
   - SVG layout dimensions (`getBoundingClientRect` returning zero).
   - `@react-pdf/renderer` font and canvas compiling.
   - Cryptographic functions failing on undefined properties.
