# Handoff Report — Vitest & Playwright E2E Verification Challenge

## 1. Observation

During empirical validation of the test suite and application environment, the following observations were recorded:

### 1.1. Build & Vitest Performance
- **Command**: `npm run build`
  - **Result**: Success. Built in `19.59s`.
- **Command**: `npx vitest run`
  - **Result**: Success. 59/59 tests passed in `4.65s` across 8 files:
    ```
    Test Files  8 passed (8)
    Tests  59 passed (59)
    Start at  22:56:43
    Duration  4.65s
    ```

### 1.2. E2E Test Failures (Playwright)
- **Command**: `npx playwright test --grep-invert "@stress"`
  - **Result**: Failed. `tests/wizard-e2e-10.spec.js` timed out at 10 minutes (600,000ms).
  - **Log traceback**:
    ```
    Error: locator.textContent: Test timeout of 600000ms exceeded.
    Call log:
      - waiting for locator('div').filter({ hasText: /^Tested TTPs$/ }).locator('..').locator('div').nth(1)

      347 |     const activeGapsDashboard = parseInt(activeGapsDashboardText.trim(), 10);
      348 |
    > 349 |     const testedTTPsDashboardText = await page.locator('div', { hasText: /^Tested TTPs$/ }).locator('..').locator('div').nth(1).textContent();
          |                                                                                                                                 ^
      350 |     const testedTTPsDashboard = parseInt(testedTTPsDashboardText.trim(), 10);
      351 |
      352 |     console.log(`Dashboard metrics: Active Gaps = ${activeGapsDashboard}, Tested TTPs = ${testedTTPsDashboard}`);
        at C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\tests\wizard-e2e-10.spec.js:349:129
    ```

- **Command**: `npx cross-env STRESS_TEST_COUNT=2 playwright test tests/wizard-stress.spec.js`
  - **Result**: Failed. Iteration 1 completed successfully, but Iteration 2 timed out at 90,000ms waiting for the `/reports` page:
    ```
    Error: page.waitForSelector: Test timeout of 90000ms exceeded.
    Call log:
      - waiting for locator('#historical-executive-report') to be visible

      324 |     // Verification on /reports Page
      325 |     await page.waitForURL('**/reports');
    > 326 |     await page.waitForSelector('#historical-executive-report');
          |                ^
      327 |     await humanPause(500, 1000);
        at C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\tests\wizard-stress.spec.js:326:16
    ```

### 1.3. Code Analysis - Dashboard Rendering (`src/components/Dashboard.jsx`)
- In `src/components/Dashboard.jsx` (lines 537–540), the tested TTPs card is rendered as:
  ```jsx
  <div style={{ background: 'rgba(255,255,255,0.03)', ... }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', letterSpacing: '1.5px', marginBottom: '8px', fontWeight: 'bold' }}>TESTED TTPs</div>
      <div style={{ fontSize: '2.2rem', fontWeight: '900', color: 'var(--text-primary)', fontFamily: 'monospace', lineHeight: 1 }}>{totalValidated}</div>
  </div>
  ```
  Note that the text label is `"TESTED TTPs"` (uppercase), while the Playwright locator in `wizard-e2e-10.spec.js:349` is searching case-sensitively for `hasText: /^Tested TTPs$/` (mixed case).

### 1.4. Code Analysis - Backend REST Bottleneck (`mock_database.js`)
- In `mock_database.js` (lines 51–63), the mock server seeds 100,000 synthetic exercises if none are present in storage:
  ```javascript
  if (db.exercises.length === 0) {
      console.log('Generating 100,000 synthetic exercises for stress testing...');
      for (let i = 0; i < 100000; i++) {
          db.exercises.push({
              id: `mock-ex-${i}`,
              ttp: 'T1059.001',
              status: i % 2 === 0 ? 'high' : 'low',
              date: new Date().toISOString()
          });
      }
  }
  ```
- On routes such as `/api/metrics` (lines 713–853) and `/api/mitre-coverage` (lines 700–710), the server performs multiple O(N) filters and nested loops over these 100,000 records. For example:
  ```javascript
  db.exercises.forEach(ex => {
      let tacticName = null;
      for (const tac in fallbackTaxonomy) {
          if (fallbackTaxonomy[tac].techniques.some(t => t.id === ex.ttp)) { ... }
      }
      ...
  });
  ```
  This single-threaded Node.js event-loop block takes several seconds per request, causing client-side REST calls to timeout.

### 1.5. Cleanups & Environment Pollution in Unit Tests
- In `src/__tests__/AppContext.test.jsx`, `global.Image` is overridden inside the tests (e.g. line 491):
  ```javascript
  const originalImage = global.Image;
  global.Image = class extends MockImage { ... };
  ...
  global.Image = originalImage;
  ```
  If an assertion fails, the test exits early, skipping the cleanup line `global.Image = originalImage`. This leaves the global `Image` object polluted for subsequent tests.
- In `src/__tests__/useGapsData.test.js` (e.g. line 13), a `vi.spyOn(Storage.prototype, 'getItem')` is used, and `.mockRestore()` is called at the end of the test. Similar to above, if an assertion fails, `spyGet.mockRestore()` is never called, polluting the storage mock environment.

---

## 2. Logic Chain

1. **E2E Case-Sensitivity Defect**:
   - Playwright uses case-sensitive matching by default for regular expressions in `hasText` constraints.
   - The test `tests/wizard-e2e-10.spec.js` attempts to locate the Tested TTPs metric card using `/^Tested TTPs$/`.
   - The UI in `Dashboard.jsx` actually renders this label as `"TESTED TTPs"`.
   - Consequently, Playwright's locator never resolves, leading to an action timeout and test failure.

2. **REST API Performance Bottleneck**:
   - The E2E stress test `tests/wizard-stress.spec.js` switches the DB config provider to `rest`, making API calls to `mock_database.js`.
   - The backend seeds 100,000 exercises.
   - Recalculating metrics and coverage over 100,000 records with nested loops causes the single-threaded Node.js server to block on CPU-bound operations.
   - This causes subsequent REST requests from the client (such as loading the `/reports` page) to freeze, triggering a 90,000ms Playwright timeout.

3. **Global Mock Pollution**:
   - Spies and global overrides (like `global.Image` and `Storage.prototype.getItem`) in `AppContext.test.jsx` and `useGapsData.test.js` are cleaned up synchronously at the end of individual test blocks.
   - If an assertion fails, execution jumps out of the block, preventing cleanup and causing state leakage to other tests.

---

## 3. Caveats

- Playwright E2E tests were executed in headless chromium mode. Visual rendering in headed mode or other browsers (firefox/webkit) was not evaluated.
- Playwright's native timeouts were verified under CPU stress. Resource availability on local developer environments may vary, potentially exacerbating the REST database bottleneck.
- We did not modify any source code or test files, adhering to the "review-only" constraint.

---

## 4. Conclusion

**VERIFICATION STATUS**: **FAIL**

While the build commands compile successfully and the Vitest unit tests pass under normal conditions, the E2E verification suite has critical correctness, performance, and robustness defects:

1. **Correctness/Flakiness Defect (FAIL)**: `tests/wizard-e2e-10.spec.js` fails due to a case-sensitive mismatch between the locator query (`/^Tested TTPs$/`) and the rendered UI string (`"TESTED TTPs"`).
2. **Performance Defect (FAIL)**: The E2E stress test fails under REST mode because the backend server gets CPU-blocked by O(N) operations over 100,000 synthetic records, causing subsequent dashboard/reporting requests to time out.
3. **Environment Pollution (CRITICAL)**: Unit/integration tests (`AppContext.test.jsx` and `useGapsData.test.js`) lack resilient teardown mechanisms (`try/finally` or `afterEach`) for global mock and spy restorations, risking cascade failures on any test assertion failure.

### Mitigations Suggested:
- **For E2E Locator**: Update the locator regex in `tests/wizard-e2e-10.spec.js` to be case-insensitive: `/^Tested TTPs$/i`.
- **For Backend REST Performance**: Optimize metric computation in `mock_database.js` (e.g. pre-aggregating metrics or indexing exercises by TTP) to avoid nested O(N) loops on every request, or reduce the synthetic generation size from 100,000 to a more realistic figure (e.g., 2,000).
- **For Environment Pollution**: Move all global restorations (`global.Image = originalImage`, `.mockRestore()`) into `afterEach` hooks or wrap test blocks in `try...finally` structures.

---

## 5. Verification Method

To verify these findings:
1. Run E2E tests excluding stress tests:
   ```powershell
   npx playwright test --grep-invert "@stress"
   ```
   Observe the timeout failure in `tests/wizard-e2e-10.spec.js`.
2. Run E2E stress tests:
   ```powershell
   npx cross-env STRESS_TEST_COUNT=2 playwright test tests/wizard-stress.spec.js
   ```
   Observe the timeout on the `/reports` page navigation in iteration 2.
3. To inspect file references:
   - Check `tests/wizard-e2e-10.spec.js` line 349 for the `/^Tested TTPs$/` regex.
   - Check `src/components/Dashboard.jsx` line 538 for `"TESTED TTPs"` casing.
   - Check `mock_database.js` line 53 and line 759 for 100,000 records loops.
