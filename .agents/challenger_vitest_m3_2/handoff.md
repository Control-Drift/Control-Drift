# Handoff Report - Vitest & Playwright Empirical Verification

**Overall Assessment**: **FAIL** (Due to case-sensitivity selector timeout in `tests/wizard-e2e-10.spec.js` causing E2E suite failure under pressure; and multiple environment pollution vulnerabilities in unit/integration tests).

---

## 1. Observation

### Unit / Integration Tests (Vitest)
- Command run: `npm run test -- --run`
- Output: 
  ```
  Test Files  8 passed (8)
  Tests  59 passed (59)
  Start at  22:56:08
  Duration  2.38s (transform 1.12s, setup 1.09s, tests 2.01s)
  ```
- Verbatim code from `src/__tests__/useGapsData.test.js` showing inline spy creation and manual restoration:
  ```js
  12:         it('should initialize targetEnvironments from localStorage if it has a valid JSON array', () => {
  13:             const spyGet = vi.spyOn(Storage.prototype, 'getItem');
  ...
  19:             expect(spyGet).toHaveBeenCalledWith('target_envs');
  20:             expect(result.current.targetEnvironments).toEqual(initialEnvs);
  21:             spyGet.mockRestore();
  22:         });
  ```
- Verbatim code from `src/__tests__/AppContext.test.jsx` showing inline global monkeypatching and restoration:
  ```js
  489:         it('resolves with the original dataUrl if image width is less than or equal to maxWidth', async () => {
  490:             const originalImage = global.Image;
  491:             global.Image = class extends MockImage { ... };
  ...
  506:             const result = await context.compressImage('data:image/png;base64,original', 800);
  507:             expect(result).toBe('data:image/png;base64,original');
  508: 
  509:             global.Image = originalImage;
  510:         });
  ```

### E2E Tests (Playwright)
- Command run: `npm run test:e2e`
- Output:
  ```
  1 failed
    tests\wizard-e2e-10.spec.js:113:3 › E2E Purple Team E2E Verification Flow › should execute 10 sequential simulations and verify posture, gaps, and dashboard 
  10 passed (10.6m)
  ```
- Verbatim failure trace:
  ```
  1) tests\wizard-e2e-10.spec.js:113:3 › E2E Purple Team E2E Verification Flow › should execute 10 sequential simulations and verify posture, gaps, and dashboard 

    Test timeout of 600000ms exceeded.

    Error: locator.textContent: Test timeout of 600000ms exceeded.
    Call log:
      - waiting for locator('div').filter({ hasText: /^Tested TTPs$/ }).locator('..').locator('div').nth(1)


      347 |     const activeGapsDashboard = parseInt(activeGapsDashboardText.trim(), 10);
      348 |
    > 349 |     const testedTTPsDashboardText = await page.locator('div', { hasText: /^Tested TTPs$/ }).locator('..').locator('div').nth(1).textContent();
          |                                                                                                                                 ^
      350 |     const testedTTPsDashboard = parseInt(testedTTPsDashboardText.trim(), 10);
  ```
- Verbatim layout from `src/components/Dashboard.jsx` (line 538) showing how the label is actually rendered:
  ```jsx
  538:                       <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', letterSpacing: '1.5px', marginBottom: '8px', fontWeight: 'bold' }}>TESTED TTPs</div>
  ```

---

## 2. Logic Chain

1. **E2E Selector Hang**: In `tests/wizard-e2e-10.spec.js` (line 349), the test attempts to locate the "Tested TTPs" widget using a case-sensitive regular expression: `page.locator('div', { hasText: /^Tested TTPs$/ })`.
2. **Case Mismatch**: In `src/components/Dashboard.jsx` (line 538), the text inside that element is rendered in ALL CAPS: `TESTED TTPs`.
3. **Infinite Wait & Timeout**: Because of the case mismatch, the Playwright locator fails to match the DOM element. The test hangs waiting for the element to appear until it exceeds the 10-minute timeout (`test.setTimeout(600000)`), causing the test suite to fail.
4. **Environment Pollution Vulnerability**: In both `useGapsData.test.js` and `AppContext.test.jsx`, spies and global overrides (`Storage.prototype.getItem`, `global.Image`, `document.createElement`, `global.clearInterval`) are restored manually at the very end of the test cases. If any assertion (e.g. `expect(result).toBe(...)`) fails, the test exits early, skipping the cleanup code. This pollutes the shared vitest thread context, which leads to unpredictable test flakiness in subsequent runs.

---

## 3. Caveats

- **Network restrictions**: No external requests were made during testing (run in CODE_ONLY network mode). Playwright tests were run using local mock services started via `playwright.config.js`.
- **System differences**: Playwright E2E tests were executed on a Windows host using Chromium. Behavioral variance on other browser engines (Webkit/Firefox) was not tested but is expected to show the same selector matching failure.

---

## 4. Conclusion

- **Vitest Unit/Integration Suite**: Passes functionally, but is highly vulnerable to environment pollution/leakage.
- **Playwright E2E Suite**: Fails under pressure during sequential simulation runs due to a case-sensitive regular expression selector mismatch on the dashboard scraper.
- **Actionable recommendation**:
  1. Fix `tests/wizard-e2e-10.spec.js:349` to use a case-insensitive match (e.g., `/^Tested TTPs$/i` or `/^TESTED TTPs$/i`).
  2. Refactor unit/integration tests to perform spy/timer/global cleanups in `afterEach` hooks or `try...finally` blocks to ensure robust state isolation.

---

## 5. Verification Method

To verify the E2E failure:
1. Run `npx playwright test tests/wizard-e2e-10.spec.js`
2. Observe the test timing out after 10 minutes at the line:
   ```js
   const testedTTPsDashboardText = await page.locator('div', { hasText: /^Tested TTPs$/ }).locator('..').locator('div').nth(1).textContent();
   ```
To verify the unit test flakiness:
1. Introduce a deliberate failure in `AppContext.test.jsx` inside the first `compressImage` test (before `global.Image = originalImage`).
2. Run `npm run test` and note how subsequent tests referencing image handling or rendering fail or exhibit polluted environment behaviors.
