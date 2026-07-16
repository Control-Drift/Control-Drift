# Handoff Report: E2E Test Suite Adversarial Testing & Verification

## 1. Observation

- **Inspected Files**:
  - `tests/wizard-e2e.spec.js`
  - `tests/wizard-e2e-10.spec.js`
  - `tests/ui-load-perf.spec.js`
  - `playwright.config.js`
  - `src/components/TTPSelector.jsx`
  - `src/hooks/useDbConnection.js`

- **Verbatim Codes with Sleep-Based Timings**:
  - In `tests/wizard-e2e.spec.js`:
    ```javascript
    await page.waitForTimeout(2000); // Wait 2 seconds for any state transitions
    ```
  - In `tests/wizard-e2e-10.spec.js`:
    ```javascript
    // Helper for human-like pause
    async function humanPause(min = 100, max = 300) {
      const delay = Math.floor(Math.random() * (max - min) + min);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    ```
    This function is used for arbitrary pauses throughout the sequential simulation loops (e.g. `await humanPause(500, 1000);`).

- **Verbatim Codes with Brittle CSS Locators**:
  - In `tests/wizard-e2e.spec.js`:
    ```javascript
    const ttpId1 = (await page.locator('button[title="Select Parent Technique"] + div span').nth(0).textContent()).trim();
    const ttpId2 = (await page.locator('button[title="Select Parent Technique"] + div span').nth(2).textContent()).trim();
    const ttpId3 = (await page.locator('button[title="Select Parent Technique"] + div span').nth(4).textContent()).trim();
    ```
  - This relies on specific DOM hierarchy inside `src/components/TTPSelector.jsx`:
    ```javascript
    <button 
        type="button"
        ...
        title="Select Parent Technique"
    >
        {isParentSelected ? <CheckSquare size={18} /> : <Square size={18} />}
    </button>

    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ ... }}>
                {group.parent.id}
            </span>
            ...
        </div>
        <span style={{ ... }}>
            {group.parent.name}
        </span>
    </div>
    ```

- **Verbatim WebServer Startup Timeouts**:
  - In `playwright.config.js`:
    ```javascript
    webServer: [
      {
        command: 'node mock_database.js',
        url: 'http://127.0.0.1:3001/', // Wait for this URL to be ready
        reuseExistingServer: true,
        timeout: 10 * 1000,
      },
      {
        command: 'npx vite --port 5173 --host 127.0.0.1',
        url: 'http://127.0.0.1:5173', // Wait for this URL to be ready
        reuseExistingServer: true,
        timeout: 15 * 1000,
      }
    ],
    ```

- **Database Provider Configuration**:
  - In `tests/wizard-e2e.spec.js` and `tests/wizard-e2e-10.spec.js`:
    ```javascript
    localStorage.setItem('db_config', JSON.stringify({
      provider: 'local',
      endpoint: '',
      apiKey: ''
    }));
    ```
    This causes the application to run with the `local` localStorage database adapter rather than making actual network requests to the mock REST API.

- **Baseline Test Execution**:
  - Command: `npm run test:e2e` (which maps to `playwright test --grep-invert @stress`)
  - Output: `5 passed (2.3m)`
  - Run duration: 2.3 minutes.

- **Vite Production Build**:
  - Command: `npm run build`
  - Output: `✓ built in 16.53s` (with generated chunk files under `dist/assets/`).

---

## 2. Logic Chain

1. **Test Success is Environment Dependent**: The test suite currently passes successfully (`5 passed`) under local execution. However, the presence of hardcoded pauses (`waitForTimeout(2000)`, `humanPause(500, 1000)`) makes the success fragile. If Vite loading is slightly delayed or the CPU runs under heavy load, the actual rendering or state transition time will exceed the hardcoded thresholds.
2. **Structural Dependency is Fragile**: The selectors used to extract technique IDs (`button[title="Select Parent Technique"] + div span`) rely on the exact sibling layout in `TTPSelector.jsx`. Any presentation changes (e.g. wrapping elements, adding badges) will alter the `nth(0)`, `nth(2)`, `nth(4)` indexing sequence, failing the tests immediately despite no behavioral regression.
3. **Database Integration Bypassed in E2E**: The primary E2E tests are initialized with the `local` database provider. Consequently, any backend regressions in the REST API adapter, security filters, or JSON endpoints will not be caught by E2E specs, because the application runs in sandbox mode storing data entirely in `localStorage`.
4. **Boot-Up Flakiness Danger**: A 15-second timeout for Vite development server boot-up is low. If CI runners experience high load, Vite transpile boot-up will exceed 15s and cause immediate test suite failure.

---

## 3. Caveats

- **No Active Network Speed Throttling Conducted**: While network emulation can be configured in Playwright via custom browser context options, we did not run active throttling because the primary E2E tests bypass all network data requests via the `local` provider. Throttling would only affect initial Vite script loading, which is already verified by generous test-level timeouts.
- **REST API verified in Stress Tests Only**: Verification of database API performance is restricted to `wizard-stress.spec.js` and `ui-load-perf.spec.js` which use the `rest` database provider.

---

## 4. Conclusion

The E2E test suite functions correctly under baseline conditions, but contains significant latency hazards (sleep-based delays), structural brittleness (relative selectors), and integration gaps (E2E bypasses database server calls). Mitigating these issues will safeguard the test suite from CI flakiness and integration escapes.

---

## 5. Verification Method

To verify the test suite run locally on Windows:
```powershell
npm run test:e2e
```
Verify that all 5 tests pass successfully.

To verify production Vite compilation:
```powershell
npm run build
```
Verify the build command returns code 0 and bundles assets under `dist/assets/`.
