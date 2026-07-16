# Component Testing Analysis and Strategy Report (Milestone 2)

## 1. Observation

During my read-only investigation, I analyzed the project metadata, root package details, and core component files in the workspace. Here are my direct observations:

*   **Project Meta and Environment**:
    *   File path: `C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\.agents\orchestrator_vitest_1\PROJECT.md`
    *   Line 4: `- React 18, Vite, Vitest, React Testing Library, jsdom.`
    *   Line 8: `- Integration environment: tests run with npm run test or npx vitest run.`
    *   Line 20-21: `Components must consume state and actions from AppContext via React's useContext or hooks. Mocking AppContext is required for testing individual components in isolation.`
    *   `package.json` specifies `"dependencies"` (lines 22, 38, 40) including `@react-pdf/renderer`, `react-router-dom`, `recharts`, and `lucide-react`. It also specifies `"devDependencies"` (lines 47, 48, 49, 54, 56) including `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`, and `vitest`.
*   **`Reports.jsx`**:
    *   File path: `src/components/Reports.jsx`
    *   Uses `@react-pdf/renderer` via `PDFDownloadLink` and `ReportPDF` (lines 10-11):
        ```javascript
        import { PDFDownloadLink } from '@react-pdf/renderer';
        import ReportPDF from './ReportPDF';
        ```
    *   Consumes many context values via `useAppContext()` (line 16):
        ```javascript
        const { dbAdapter, exercises, completeExercise, simulationSummaries, saveSimulationSummary, simulationEvidence, addSimulationEvidence, compressImage, mitreData, aiSettings, generateAIContent, gaps, setActiveAiContext, isAuthenticated, isAiActive } = useAppContext();
        ```
    *   Renders a search input (lines 963-964), custom dropdowns (`CoverageRatingDropdown`, `SeverityDropdown`, `ValidationOutcomeDropdown`), and a manual logging modal (lines 1052-1130) with dynamic procedure cards (`EventCard`) and submitting logic via `completeExercise` (lines 351-359).
*   **`GapTracker.jsx`**:
    *   File path: `src/components/GapTracker.jsx`
    *   Uses recharts elements (line 10) and custom dropdowns / helpers:
        ```javascript
        import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area, ReferenceLine, ScatterChart, Scatter, ZAxis } from 'recharts';
        ```
    *   Relies on drag-and-drop state handlers (`handleDragStart`, `handleDragOver`, `handleDrop`) to move gaps between Kanban statuses (lines 226-300).
    *   Listens to a custom event `'open-risk-modal'` on the global document object to trigger the risk acceptance modal (lines 217-224).
    *   Accesses `sessionStorage` (lines 187, 188, 189, 192, 193) to restore filter query and forms.
*   **`Settings.jsx`**:
    *   File path: `src/components/Settings.jsx`
    *   Uses `encryptData` and `decryptData` from `../lib/cryptoUtils.js` (line 3):
        ```javascript
        import { encryptData, decryptData } from '../lib/cryptoUtils';
        ```
    *   `src/lib/cryptoUtils.js` relies heavily on `window.crypto.subtle` PBKDF2 and AES-GCM operations (lines 5, 13, 29, 30, 33, 66).
    *   Performs connection pings via the browser's global `fetch` (lines 202, 209, 218, 246) inside `testAiConnection` and `testDbConnection`.
    *   Performs backup exports via dynamic creation of an anchor `<a>` element, `Blob` writing, and `URL.createObjectURL` (lines 87-93).
    *   Performs file imports via a `FileReader` instance (line 117) and schema validation.
*   **`AttackPath.jsx`**:
    *   File path: `src/components/AttackPath.jsx`
    *   Uses `generateAIContent` and `isAiActive` from context to dynamically construct attack graphs via LLM prompts (lines 232-264).
    *   Uses `sessionStorage` to cache generated paths (lines 217-228).
    *   Requires actual coordinate measurements of DOM elements inside an `useEffect` calling `getBoundingClientRect()` to compute `d` coordinates for SVGs (lines 409-461).

---

## 2. Logic Chain

Based on these observations, the following step-by-step reasoning defines our component testing strategy:

1.  **Isolation & Context Mocking**:
    *   *Premise*: All components rely on `useAppContext` for application state, database access, and global actions. They also use `useToast` for user alerts.
    *   *Step*: To test these components in isolation, we must mock `useAppContext` and `useToast`. Wrapping them in custom context mock providers allows tests to inject custom initial state (such as gaps, exercises) and spy on actions (such as `completeExercise`, `updateGap`, `addToast`).
2.  **Routing Mocking**:
    *   *Premise*: Components use `useLocation` and `useNavigate` from `react-router-dom`.
    *   *Step*: Tests must wrap the components under test in `<MemoryRouter>` or mock the routing module to stub `navigate` and `location.state`.
3.  **Bypassing Layout & External Render Issues**:
    *   *Premise*: `recharts` graphs (in `GapTracker.jsx`) and `@react-pdf/renderer` (in `Reports.jsx`) use Canvas and browser dimensions which do not exist or behave poorly in headless JSDOM environments.
    *   *Step*: We must mock `recharts` (rendering simple placeholders or sub-stubs) and `@react-pdf/renderer` (specifically stubbing `PDFDownloadLink` to immediately return mock children) to prevent test crashes and memory leaks.
4.  **Bypassing Web Crypto & Web APIs**:
    *   *Premise*: `Settings.jsx` calls `encryptData` and `decryptData`, which depend on Web Crypto (`window.crypto.subtle`) which is missing or incomplete in JSDOM.
    *   *Step*: Mock `cryptoUtils` directly at the module import layer to return plain strings, bypassing the crypto APIs.
    *   *Premise*: `Settings.jsx` uses `Blob`, `URL.createObjectURL`, `FileReader`, and `fetch`.
    *   *Step*: Stub `window.URL.createObjectURL`, `window.URL.revokeObjectURL`, `FileReader`, and global `fetch` to simulate successful operations, errors, and files.
5.  **Handling DOM Dimensions in AttackPath**:
    *   *Premise*: `AttackPath.jsx` maps SVG edges by reading element boundaries with `getBoundingClientRect()`.
    *   *Step*: Stub `Element.prototype.getBoundingClientRect` to return dummy non-zero coordinates (`{ top: 10, left: 10, right: 100, bottom: 50, width: 90, height: 40 }`) so SVG path computations execute successfully without generating `NaN` coordinates.

---

## 3. Caveats

*   **No Actual Visual Rendering Checks**: JSDOM does not perform layout or painting. Testing the position/alignment of attack path nodes or SVG curves is not possible; tests are constrained to checking that the appropriate elements/paths exist in the DOM with estimated coordinates and hover classes.
*   **Web Cryptography API**: If any integration test relies on the real `cryptoUtils` behavior, a global polyfill for Web Crypto (e.g. using `crypto` from Node.js) would be needed. However, since the task is testing individual UI components in isolation, mocking the crypto utility functions directly is the safest, most performant, and recommended approach.
*   **File Uploader**: Testing the file import upload relies on triggering change events with mock files on `<input type="file">`. This requires mocking the `FileReader` APIs inside the test runtime.

---

## 4. Conclusion

We can successfully test all four components using Vitest, React Testing Library, and JSDOM by implementing targeted mocks for external libraries, routing hooks, context hooks, Web Cryptography, and DOM APIs. The concrete testing strategies for each component are outlined below.

### Mock Configurations

#### Global Mocks (to be defined in `vitest.setup.js` or top of tests)

```javascript
import { vi } from 'vitest';

// 1. Mock recharts to prevent ResizeObserver errors
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div data-testid="responsive-container">{children}</div>,
  LineChart: ({ children }) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  AreaChart: ({ children }) => <div data-testid="area-chart">{children}</div>,
  Area: () => null,
  ReferenceLine: () => null,
  ScatterChart: ({ children }) => <div data-testid="scatter-chart">{children}</div>,
  Scatter: () => null,
  ZAxis: () => null,
}));

// 2. Mock @react-pdf/renderer
vi.mock('@react-pdf/renderer', () => ({
  PDFDownloadLink: ({ children }) => children({ loading: false }),
  Document: () => null,
  Page: () => null,
  Text: () => null,
  View: () => null,
  StyleSheet: { create: (s) => s },
}));
vi.mock('./ReportPDF', () => ({
  default: () => <div data-testid="mock-pdf">PDF Document</div>,
}));

// 3. Mock cryptoUtils
vi.mock('../lib/cryptoUtils', () => ({
  encryptData: vi.fn((data) => Promise.resolve(`ENCRYPTED:${data}`)),
  decryptData: vi.fn((encrypted) => Promise.resolve(encrypted.replace('ENCRYPTED:', ''))),
}));
```

---

### Component Testing Strategies

#### A. `Reports.jsx` Test Strategy

*   **Mock Dependencies**:
    *   `useAppContext`: Provide mock `exercises` list, `simulationSummaries` map, `mitreData` mapping. Mock actions: `completeExercise`, `saveSimulationSummary`.
    *   `react-router-dom`: Wrappers for router state.
*   **Key Test Cases**:
    1.  **Simulations Archive List**:
        *   *Setup*: Provide a list of simulations in `exercises` or via `dbAdapter.fetchSimulations`.
        *   *Assert*: Confirm simulation cards are rendered with names and counts of outcomes (Prevented, Alerted, Logged, Missed).
    2.  **Filter & Search**:
        *   *Action*: Type in the simulation search input.
        *   *Assert*: Verify only matching simulation cards are displayed.
    3.  **Selected Simulation Drilldown Modal**:
        *   *Action*: Click a simulation card to select it.
        *   *Assert*: Verify page shows drilldown details, paginated events list, and the "Download PDF" button (renders mock `PDFDownloadLink`).
    4.  **Log External Simulation Modal (Form Submission)**:
        *   *Action*: Click "Log External Simulation", fill in the "Simulation Name", "Executive Summary", map a TTP using the TTP selector, and click "Submit External Simulation".
        *   *Assert*: Verify `completeExercise` and `saveSimulationSummary` are called with the correct parameters, and the modal closes.
    5.  **Validation & Errors**:
        *   *Action*: Click "Submit External Simulation" without supplying a simulation name.
        *   *Assert*: Check that a toast alert is emitted (`addToast` called with warning message).

#### B. `GapTracker.jsx` Test Strategy

*   **Mock Dependencies**:
    *   `useAppContext`: Inject list of `gaps` (containing different statuses: 'Identified', 'Validating', 'Resolved', 'Risk Accepted'), `isReadOnly` flag, actions: `updateGap`, `createGap`, `deleteGap`, `confirmAction`.
*   **Key Test Cases**:
    1.  **Kanban Columns Render**:
        *   *Assert*: Confirm columns exist ('Identified', 'Validating', 'Resolved', 'Risk Accepted') and each displays correct gap cards.
    2.  **Filter Gaps**:
        *   *Action*: Select a severity from the dropdown filters or type a query.
        *   *Assert*: Verify that the cards displayed update accordingly.
    3.  **Drag and Drop Flow**:
        *   *Action*: Fire drag start, drag enter, and drop events moving a gap from 'Identified' to 'Validating'.
        *   *Assert*: Verify that the drag actions resolve with correct state calls (calls `updateGap` with new status).
    4.  **Accepting Risk Flow**:
        *   *Action*: Dispatch custom event `'open-risk-modal'` with detail `gap` OR drop a gap card into the 'Risk Accepted' column.
        *   *Assert*: Risk modal renders. Type justification and click submit. Verify the gap status changes to 'Risk Accepted' and fields updated.
    5.  **Validation Modal Flow**:
        *   *Action*: Drop a gap into 'Resolved'.
        *   *Assert*: Validation modal appears. Enter validation outcomes, select outcome rating, and submit. Verify validation updates are sent to the context.

#### C. `Settings.jsx` Test Strategy

*   **Mock Dependencies**:
    *   `useAppContext`: Mock settings (`aiSettings`, `dbConfig`, `targetEnvironments`), functions: `setAiSettings`, `setDbConfig`, `deleteEnvironment`, `confirmAction`.
    *   `window.fetch`: Mock globally to intercept API requests.
    *   `window.URL.createObjectURL` & `window.URL.revokeObjectURL`: Mock as dummy functions.
*   **Key Test Cases**:
    1.  **AI Provider Configuration**:
        *   *Action*: Select Gemini, type a mock API Key, and save.
        *   *Assert*: Verify `setAiSettings` is called with updated settings.
    2.  **AI & Database Connection Testing**:
        *   *Action*: Click "Test AI Connection" or "Test DB Connection" (mock `fetch` to return `ok: true` or `ok: false`).
        *   *Assert*: Confirm UI transitions to "testing" then to "Connection successful!" or displays error message.
    3.  **Data Backup Export**:
        *   *Action*: Click "Export Database Backup", enter password.
        *   *Assert*: Check that `encryptData` is invoked with current context state and password, and dummy `<a>` is created with encrypted data blob.
    4.  **Data Import Restore**:
        *   *Action*: Mock upload of a file containing JSON, input password, click Import.
        *   *Assert*: Confirm `FileReader` reads the mock file, `decryptData` is invoked, and `dbAdapter.bulkImport` is called with decrypted structure.

#### D. `AttackPath.jsx` Test Strategy

*   **Mock Dependencies**:
    *   `useAppContext`: Provide active gaps list, actions: `generateAIContent`, `isAiActive`.
    *   `Element.prototype.getBoundingClientRect`: Stub this method to return mock positions.
*   **Key Test Cases**:
    1.  **Cyber Kill Chain Phases Render**:
        *   *Assert*: Renders columns matching the 6 kill chain phases (Delivery, Exploitation, Installation, Command and Control, Lateral Movement, Actions on Objectives).
    2.  **AI Path Generation**:
        *   *Action*: Set `isAiActive` to true, click "Generate Escalation Paths" (mock AI return value to contain valid edges JSON).
        *   *Assert*: Verify `generateAIContent` is triggered, state parses result, and displays connecting SVG edges.
    3.  **Interactive Highlighting (Hover)**:
        *   *Action*: Hover over a node (fire `onMouseEnter`).
        *   *Assert*: Ensure hovered node and its traversed upstream/downstream nodes are highlighted, while other unrelated nodes apply dimmed styles (e.g. `opacity: 0.2`).
    4.  **Gap Drilldown Modal**:
        *   *Action*: Click a node.
        *   *Assert*: Renders gap details/code modal correctly.

---

## 5. Verification Method

To verify these testing strategies are sound and can be integrated:

1.  **Verify Command**:
    Once implemented, run `npm run test` or `npx vitest run` in the project root directory.
2.  **Inspect Files**:
    Ensure the test files are created under a standard test structure alongside their respective components (or under a designated `tests/` directory if specified in `PROJECT.md`).
3.  **Invalidation Conditions**:
    *   If `@react-pdf/renderer` or `recharts` mocks are missing, the test run will fail due to environment crashes (e.g., canvas/ResizeObserver errors).
    *   If `cryptoUtils` is not mocked, the backup and import test cases will fail inside jsdom due to `window.crypto.subtle` being undefined.
    *   If `getBoundingClientRect` is not stubbed for `AttackPath`, SVG path generation may output invalid XML coordinate attributes (`d="M NaN NaN..."`), throwing SVG parsing errors in rendering tests.
