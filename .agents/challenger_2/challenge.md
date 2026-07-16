## Challenge Summary

**Overall risk assessment**: MEDIUM

The E2E test suite (`wizard-e2e.spec.js`, `wizard-e2e-10.spec.js`, `ui-load-perf.spec.js`) contains functional E2E tests, but displays critical flaws regarding timing resilience, race conditions, and locator stability. Under simulated network delays and database latency, the tests suffer from race conditions that are masked only by forceful clicks (`{ force: true }`) on hidden elements, and they suffer from high flakiness and performance drag due to heavy reliance on sleep-based pauses.

---

## Challenges

### [High] Challenge 1: Race Condition between Database Loading Screen and Form Interaction

- **Assumption challenged**: The tests assume that when form inputs (like `input[placeholder="e.g., APT29 Emulation"]`) are present in the DOM, the application is fully loaded and ready for interaction.
- **Attack scenario**: In `wizard-e2e-10.spec.js` and `wizard-stress.spec.js`, the tests wait for the input element to be present in the DOM:
  ```javascript
  await page.waitForSelector('input[placeholder="e.g., APT29 Emulation"]');
  ```
  However, during initial load, the application renders a loading overlay `Establishing secure database connection...` (`isDbLoading = true`). During this time, the main `app-container` is mounted in the DOM but hidden via CSS style `display: none`. 
  Because `waitForSelector` only checks for presence in the DOM (unless `{ state: 'visible' }` is passed), it resolves immediately (in ~300ms) while the loader is still active and the input is hidden. 
  The tests then attempt to click and type into this hidden input. To bypass the fact that the loader intercepts clicks, the tests use `{ force: true }`:
  ```javascript
  await nameInput.click({ force: true });
  ```
  Interacting with a hidden input while the database is still loading can cause state corruption or result in inputs being overwritten/wiped once the database load finally resolves and updates the application state.
- **Blast radius**: High. Under delayed database initialization, test inputs can be silently wiped, or the test can execute clicks on hidden elements, leading to flakiness or state mismatch.
- **Mitigation**: Remove `{ force: true }` and implement a proper loading guard. Wait for the database connection loading overlay to detach before continuing, as done correctly in `wizard-e2e.spec.js`:
  ```javascript
  await page.waitForSelector('text=Establishing secure database connection...', { state: 'detached', timeout: 30000 });
  ```

### [Medium] Challenge 2: Heavy Reliance on Sleep-Based Timings (Performance and Flakiness)

- **Assumption challenged**: The tests assume that arbitrary pauses using a custom `humanPause(min, max)` helper (which wraps `setTimeout`) will reliably stabilize the tests against async timing issues and API state propagation.
- **Attack scenario**: In `wizard-e2e-10.spec.js` (and `wizard-stress.spec.js`), the tests call `humanPause` multiple times per iteration (e.g. after typing, clicking dropdowns, closing modals).
  Across a single run of `wizard-e2e-10.spec.js` (10 iterations), there are 220+ invocations of `humanPause`, resulting in **~62 seconds of pure sleeping** per test run.
  - If the database API or network speed is slower than the arbitrary sleep durations, the sleeps are insufficient, and the test fails due to race conditions.
  - If the network/database is fast, the sleeps introduce massive, unnecessary performance overhead.
- **Blast radius**: Medium. Increases test execution time significantly and introduces flakiness when environment performance degrades below the hardcoded sleep thresholds.
- **Mitigation**: Replace `humanPause` sleeps with Playwright auto-waiting assertions (e.g., `expect(locator).toBeVisible()`) or wait for API network responses (e.g., `page.waitForResponse('**/data/**')`) to ensure the application state has synchronized before proceeding.

### [Medium] Challenge 3: Brittle Structural and Traversing Locators

- **Assumption challenged**: The tests assume that the DOM hierarchy, CSS class structures, and sibling relations will remain constant.
- **Attack scenario**: The tests locate critical elements using structural traversals:
  - `page.locator('label:has-text("Target Environment") + div')` (relic on sibling div)
  - `page.locator('button[title="Select Parent Technique"] + div span').nth(0)` (sibling div text parsing)
  - `page.locator('label:has-text("Mapped TTPs")').first().locator('..').locator('button.dropdown-button')` (parent-to-child traversal)
  - `page.locator('label:has-text("Actual Outcome")').first().locator('..').locator('button').first()`
- **Blast radius**: Medium. Any styling updates, wrapper divs, helper text, tooltips, or minor layout adjustments will break the tests immediately, resulting in high maintenance overhead.
- **Mitigation**: Define dedicated test IDs (e.g., `data-testid="target-environment-dropdown"`) on elements and select them using `page.getByTestId()`, or use Playwright's role locators (`page.getByRole('button', { name: '...' })`).

### [Low] Challenge 4: Web Server Startup Timeout Risks in Slow Environments

- **Assumption challenged**: The tests assume that the mock database server and Vite server will start and bind to their ports within 10 seconds and 15 seconds, respectively.
- **Attack scenario**: Under resource-constrained CI/CD environments or high CPU usage, Node.js or Vite startup times can exceed these limits.
- **Blast radius**: Low. Playwright fails to launch the web servers, crashing the entire test suite run before any tests execute.
- **Mitigation**: Increase the `timeout` values in `playwright.config.js` webServer configurations to 30000ms (30 seconds) to tolerate startup lag in CI systems.

---

## Stress Test Results

- **Network Delay Interception & Delayed DB Connection** → Input field found in DOM in ~314ms but covered by active loading screen. Click without force fails (times out). Click with force succeeds but operates on hidden state. → **FAIL** (when loader visibility assert is enabled, showing the hidden click race condition).
- **Sequential E2E Flow (wizard-e2e.spec.js)** → Executes 3 wizard campaigns sequentially under normal speed. → **PASS** (10.3s).
- **Sequential 10x E2E Flow (wizard-e2e-10.spec.js)** → Executes 10 campaigns sequentially. Sleeps 62+ seconds. → **PASS** (2.1m).
- **Performance Load Test (ui-load-perf.spec.js)** → Measures loading performance of Dashboard, Posture, and Gaps pages. → **PASS** (6.1s).

---

## Unchallenged Areas

- **AI Copilot & Stream Parsing (Tier 4)** — Out of scope. Insufficient API configuration for Gemini in this offline execution environment to test live completions.
