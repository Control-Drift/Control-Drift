# Handoff Report: E2E Playwright, Database Configuration, and Mock Persistence Analysis

This report documents findings from an E2E Playwright analysis, the application's database provider configuration behavior, and mock database persistence options for `eclipse-ops`.

## 1. Observation

### Playwright E2E Test Behavior (`tests/wizard-e2e.spec.js`)
* **File Path**: `C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\tests\wizard-e2e.spec.js`
* **Observation**:
  - The script executes a single test `should complete wizard steps and verify reports metrics 20 times` inside a 20-iteration loop (`for (let i = 1; i <= 20; i++)`).
  - Sets test timeout to 3 minutes (`180000` ms) to accommodate the iterations.
  - **Iteration UI Flow**:
    1. **Navigation**: Navigates to `/exercise` via `page.goto('/exercise')` (Line 11).
    2. **Step 1 (Scoping)**:
       - Fills Simulation Name with `Playwright Stress Test Auto-Sim ${i}` via `page.getByPlaceholder('e.g., APT29 Emulation')` (Line 20).
       - Selects environment category. Attempts to click `button:has-text("Staging")` inside `label:has-text("Target Environment") + div`. If not visible, searches for `Staging` in input and clicks the create button (Lines 23-33).
       - Fills Scenario Goals rich text editor with fixed text (Line 36).
       - Opens TTP selector modal by clicking "Initial Access" text (Line 42).
       - Parses TTP IDs of the first 3 techniques via `button[title="Select Parent Technique"] + div span` `nth(0)`, `nth(2)`, and `nth(4)` (Lines 49-51).
       - Checks the first three techniques (`nth(0)`, `nth(1)`, `nth(2)` of `button[title="Select Parent Technique"]`) and closes modal (Lines 56-61).
       - Clicks "Next Step" button (Line 65).
    3. **Step 2 (Attack Chain Design)**:
       - Fills attack chain editor with markdown content (Line 70).
       - Clicks "Next Step" button (Line 76).
    4. **Step 3 (Execution & Logging)**:
       - Creates three event logs by clicking `+ Add Event` three times:
         - **Event 1 (Prevented - Optimal Coverage)**: Payload Name = `Playwright Test Event 1`, Mapped TTP = `ttpId1`, Actual Outcome = `Prevented` (Lines 83-99).
         - **Event 2 (Logged - Partial Coverage)**: Payload Name = `Playwright Test Event 2`, Mapped TTP = `ttpId2`, Actual Outcome = `Logged` (Lines 101-118).
         - **Event 3 (Missed - No Coverage)**: Payload Name = `Playwright Test Event 3`, Mapped TTP = `ttpId3`, Actual Outcome = `Missed` (Lines 120-137).
       - Clicks "Next Step" button (Line 141).
    5. **Step 4 (Reporting)**:
       - Waits for `#executive-report` element (Line 145) and clicks `Submit` button (Line 149).
    6. **Verification on `/reports`**:
       - Waits for URL redirect to `**/reports` (Line 153).
       - Checks presence of `#historical-executive-report` (Line 161).
       - Asserts that the scraped metric counts on the TTP Coverage card match:
         - Optimal Coverage Count = `1` (Line 169)
         - Partial Coverage Count = `1` (Line 175)
         - No Coverage Count = `1` (Line 181)
         - Total Validated TTPs Count = `3` (Line 187)

### Client Database Configuration Mechanism
* **Key Components**:
  - **Local Storage Key**: `db_config` holds the provider settings (e.g. `{"provider":"rest","endpoint":"http://127.0.0.1:3001","apiKey":""}`).
  - **Auth Credentials**: `token` stores the JWT token; `roles` stores the JSON array of user roles (e.g., `["admin"]`).
* **Source Code Tracing**:
  - `src/hooks/useDbConnection.js` loads the configuration on mount (Line 7-15) and deobfuscates the API key if present. It writes the configuration to `db_config` in a `useEffect` hook (Line 22-28).
  - `src/lib/db/core.js` initializes the adapter based on the provider config. Setting `provider: 'rest'` imports and instantiates the `RestApiAdapter` (Line 53-56).
  - `src/lib/db/adapters/RestApiAdapter.js` reads `token` and `roles` on instantiation (Lines 11-14).
    - It sets request headers with `Authorization: Bearer <token>` and `x-api-key: <apiKey>` (Lines 17-22).
    - `checkAuth()` returns `!!this.token` (Line 25), blocking the app if false.
    - SSO redirection redirects to `${this.endpoint}/auth/sso` and appends `?token=...` in the callback URL on success (Lines 41-44).
    - `handleSsoCallback(token)` parses/decodes the base64-encoded JWT payload to read the `role` claim, then stores both token and roles in localStorage (Lines 69-84).

### Mock Database Implementation (`mock_database.js`)
* **File Path**: `C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\mock_database.js`
* **Observations**:
  - Loads in-memory `db` state from `synthetic_stress_data.json` at startup if the file exists (Lines 20-33).
  - Generates 100,000 mock exercises if `db.exercises` is empty (Lines 35-47).
  - Exposes route handlers `/api/exercises`, `/api/gaps`, `/api/gaps/:id`, and `/data/:key`.
  - While it processes mutations in memory (using `POST`, `PUT`, `DELETE` operations), it **never** writes updates back to the filesystem, causing all changes to be lost when the server shuts down or restarts.

---

## 2. Logic Chain

1. **E2E Wizard UI Interactions**: Tracing `tests/wizard-e2e.spec.js` shows that the test mimics user behaviors, using Playwright `locator` chains to select parent techniques, add event cards, map them to extracted TTP IDs, toggle their actual outcomes to verify metric categories, and submit the form to assertion elements.
2. **Local Storage Config Manipulation**: Since the client React hook `useDbConnection.js` queries `localStorage` immediately upon rendering, calling `page.addInitScript` in Playwright allows seeding `db_config` before page scripts execute. This forces the React application to initialize `RestApiAdapter` pointing to the target port.
3. **SSO Programmatic Bypass**: Since `RestApiAdapter` checks authentication by checking the presence of a token (`token`), and retrieves user roles from `roles`, we can bypass the SSO redirect flow in Playwright E2E tests by:
   - Programmatically calling `/auth/sso?role=admin` via a background API fetch to obtain a signed JWT token.
   - Injecting both the `token` and `roles` into localStorage alongside the provider config via `page.addInitScript`.
4. **Mock DB Server Persistence**: Because the database loads from `STRESS_DATA_PATH = './synthetic_stress_data.json'` at start, writing the `db` variable back to `STRESS_DATA_PATH` whenever a write method (`POST`, `PUT`, `DELETE`) is handled ensures modifications survive restarts.

---

## 3. Caveats

* **XOR Obfuscation**: If an API key is specified in the configuration, `useDbConnection` attempts to obfuscate it using the salt array inside `src/lib/obfuscator.js`. Setting `apiKey: ""` avoids obfuscation complications as empty strings bypass encoding.
* **Large File I/O Overhead**: If the mock database runs with 100,000 generated exercises, calling `fs.writeFileSync` on every request will cause disk write overhead of ~15-20MB. Since tests typically start with an existing `synthetic_stress_data.json` containing a subset of entries, I/O overhead will be minimal.

---

## 4. Conclusion

1. **Wizard Interactions**: The test interacts with Step 1 (fills name, category, selects first 3 techniques), Step 2 (inputs attack chain markdown), Step 3 (creates 3 events with outcomes `Prevented`, `Logged`, `Missed` mapped to the techniques), and Step 4 (submits and asserts `1` for Optimal, Partial, No Coverage, and `3` total on `/reports`).
2. **REST Adapter Override**: Seeding `localStorage` keys `db_config`, `token`, and `roles` before page load forces the app to mount using the REST provider with authenticated administrator rights.
3. **Mock DB Persistence**: We can implement persistence in the mock database by injecting a `saveDatabase()` function called inside all write endpoints in `mock_database.js`.

### Suggested Playwright Seeding Integration
```javascript
test.beforeEach(async ({ page }) => {
  // 1. Fetch SSO token programmatically
  const response = await fetch('http://127.0.0.1:3001/auth/sso?role=admin');
  const data = await response.json();
  const token = data.token;
  
  // 2. Decode role claim
  const payloadBase64 = token.split('.')[1];
  const payloadJson = Buffer.from(payloadBase64, 'base64').toString();
  const payload = JSON.parse(payloadJson);
  const roles = Array.isArray(payload.role) ? payload.role : [payload.role];

  // 3. Inject configuration and auth state into page local storage before load
  await page.addInitScript(({ token, roles }) => {
    localStorage.setItem('db_config', JSON.stringify({
      provider: 'rest',
      endpoint: 'http://127.0.0.1:3001',
      apiKey: ''
    }));
    localStorage.setItem('token', token);
    localStorage.setItem('roles', JSON.stringify(roles));
  }, { token, roles });
});
```

### Proposed Patch for `mock_database.js`
A patch file containing all required modifications has been generated at:
`C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\.agents\explorer_m1\mock_database_persistence.patch`

---

## 5. Verification Method

To verify the E2E behavior and test runner execution:
1. Run Playwright E2E tests:
   ```powershell
   npx playwright test
   ```
2. Verify that mock DB persistence functions write correctly by posting to `/api/exercises` or `/api/gaps` using a HTTP tool, stopping the server, restarting, and checking if the record persists in `synthetic_stress_data.json`.
