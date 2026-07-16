# Handoff Report — E2E Test Suite Adversarial Testing & Verification

This report documents the empirical findings, logic chains, and verification methods for the adversarial testing of the Playwright E2E test suite in the Iridescence application.

---

## 1. Observation

We executed the full E2E test suite using Playwright locally and verified that all tests passed under normal network conditions:
- `npx playwright test tests/wizard-e2e.spec.js` (passed in 10.3s)
- `npx playwright test tests/wizard-e2e-10.spec.js` (passed in 2.1m)
- `npx playwright test tests/ui-load-perf.spec.js` (passed in 6.1s)

### Loader Overlay Race Condition
By creating a temporary test file `tests/throttled-e2e.spec.js` with REST database provider enabled and mock API call delays (5 seconds delay on `/auth/sso` and `/data/*`), we observed the following behavior verbatim:
```
Running 1 test using 1 worker

[1/1] tests\throttled-e2e.spec.js:84:3 › Throttled Network & Delayed Loading Verification › should verify E2E behavior under simulated network latency
Navigating to simulation launcher with delayed DB...
Waiting for input field presence in DOM...
Input field found in DOM in 314ms.
Is database connection loading screen visible? true
Attempting to fill simulation name...
Is name input visible to user (not display: none)? true

Click without force failed as expected: locator.click: Timeout 1000ms exceeded.
Call log:
  - waiting for getByPlaceholder('e.g., APT29 Emulation')
    - locator resolved to <input value="" class="ai-input" placeholder="e.g., APT29 Emulation"/>
  - attempting click action
  ...
    - <div>…</div> intercepts pointer events
  ...
Fill succeeded. Clickable without force? false
```

### Accumulative Sleep Delays
We inspected `tests/wizard-e2e-10.spec.js` and observed:
- A custom `humanPause(min, max)` helper (wrapping `setTimeout`) is used.
- It is called 22 times per wizard campaign iteration.
- Across 10 sequential iterations, this adds up to **~62 seconds of pure, idle sleeping** per test run, making up ~50% of the total test execution time.

### Brittle Locators
We observed position-dependent traversing locators across all spec files:
- `page.locator('label:has-text("Target Environment") + div')` (relic on adjacent sibling element)
- `page.locator('button[title="Select Parent Technique"] + div span').nth(0)` (relic on sibling text formatting)
- `page.locator('label:has-text("Mapped TTPs")').first().locator('..').locator('button.dropdown-button')` (relic on parent-to-child hierarchy)

---

## 2. Logic Chain

### Race Condition Logic
1. **Initial Mount**: During initial page load, `App.jsx` displays a loading overlay (`Establishing secure database connection...`) while `isDbLoading` is true. The `app-container` is mounted in the DOM but hidden via CSS `display: none`.
2. **Selector Match**: The E2E tests wait for `input[placeholder="e.g., APT29 Emulation"]`. Playwright's `waitForSelector` defaults to waiting for DOM presence (attached state) rather than visual visibility. It matches and resolves immediately (~314ms).
3. **Hidden Click**: The E2E test immediately proceeds to fill in the form using `{ force: true }` to bypass Playwright's actionability checks (since the loader intercepts clicks).
4. **Conclusion**: Under slow network speed or Vite delays, the loader stays up longer, but the test forces clicks/types on hidden inputs. Once the database connection finally completes, it updates the state, potentially overwriting/wiping out the inputs already typed by the test, causing state corruption or flakiness.

### Timing & Performance Drag Logic
1. The custom `humanPause` sleeps are hardcoded to handle transient states.
2. Under slow loading, these sleeps are too short to guarantee the UI has updated, leading to failures.
3. Under normal/fast execution, they introduce massive, static overhead (62s per run), dragging down developer productivity and wasting CI resources.

---

## 3. Caveats

- We only ran tests on Chromium (default browser in `playwright.config.js`). Other browser engines (Firefox, WebKit) were not tested under throttled conditions.
- We did not stress-test the `wizard-stress.spec.js` file (which runs up to 200 parallel simulations) as it requires a multi-worker setup and is designed for database stress testing rather than UI-level flakiness verification.

---

## 4. Conclusion

The E2E test suite contains structural flakiness and race conditions:
1. **Critical Race Condition**: Form filling begins before the database finishes loading. It is masked only by `{ force: true }` click actions on hidden elements.
2. **Suboptimal Timing**: High reliance on arbitrary sleeps (`humanPause`) slows down execution and fails to guarantee correctness under load.
3. **Maintenance Overhead**: High fragility due to brittle structural locators.

---

## 5. Verification Method

To independently verify the database loading race condition:
1. Create a test that launches Playwright with a delayed database provider.
2. Assert that `Establishing secure database connection...` loading overlay is visible when `waitForSelector('input[placeholder="e.g., APT29 Emulation"]')` resolves.
3. Confirm that clicking the input field without `{ force: true }` fails because the loader overlay intercepts the pointer event.
