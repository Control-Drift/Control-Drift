# Adversarial Review of E2E Test Suite

## Challenge Summary

**Overall risk assessment**: MEDIUM

While the E2E test suite covers critical flows and successfully verifies major metrics (posture, gaps, dashboard rollups), there are design decisions, hard-coded timings, and brittle selectors that introduce risks of flakiness and false confidence.

---

## Challenges

### [High] Challenge 1: Hard-coded Delays and Sleep-Based Timings

- **Assumption challenged**: The tests assume that hard-coded delays (`await page.waitForTimeout(2000)` in `wizard-e2e.spec.js` and `await humanPause(...)` in `wizard-e2e-10.spec.js`) are sufficient to guarantee UI elements are loaded, rendered, and stable.
- **Attack scenario**: Under heavy CPU load or during temporary Vite/network slowdowns, the actual rendering or database persistence delay might exceed the hardcoded threshold (e.g. 500ms or 2000ms). The test will proceed to downstream assertions before the application state settles, resulting in false test failures.
- **Blast radius**: Increased flakiness in CI pipelines, leading to developers wasting time debugging flaky tests rather than real issues.
- **Mitigation**: Replace all hardcoded sleep-based timings (`waitForTimeout`, `humanPause`) with explicit Playwright assertions that wait for state conditions (e.g., `await expect(page.locator(...)).toBeVisible()`, `await page.waitForSelector(...)`, or listening for API endpoint responses using `await page.waitForResponse(...)`).

### [Medium] Challenge 2: Highly Brittle Structural CSS Locators

- **Assumption challenged**: The tests assume that the DOM layout for the technique selection panel will always remain rigid (specifically, `button[title="Select Parent Technique"] + div span`).
- **Attack scenario**: A frontend developer modifies the structure of `TTPSelector.jsx` (e.g. wrapping the technique ID inside an extra layout `div`, adding a status badge, or changing the tag type). Since the test relies on relative selector offsets (e.g. `.nth(0)` to read technique ID and `.nth(2)` for the next technique ID), any structural modification or adding of extra elements shifts the query indices, causing the test to read wrong text or crash.
- **Blast radius**: Brittle locators couple the test logic directly to styling and presentational layout, making code maintenance and UI redesigns highly painful.
- **Mitigation**: Add test-specific data attributes (like `data-testid="ttp-id"` and `data-testid="ttp-name"`) to the interactive and data-containing elements. Query them using `page.getByTestId(...)` in the E2E specifications.

### [Medium] Challenge 3: Incomplete Full-Stack Verification (Local Mock Provider)

- **Assumption challenged**: E2E verification tests (`wizard-e2e.spec.js` and `wizard-e2e-10.spec.js`) use the `local` localStorage database provider. It is assumed that this adequately represents production E2E environment behaviors.
- **Attack scenario**: If a regression occurs in the `RestApiAdapter.js` or backend API endpoints (e.g. permission checks, DB schema updates, server-side aggregation failures), the E2E tests will continue to pass because they bypass the API completely and operate purely within the browser's localStorage.
- **Blast radius**: Production-critical integration bugs in the REST adapter or database integration can slip through CI unnoticed.
- **Mitigation**: Configure the primary E2E tests to run against the mock database server (`provider: 'rest'`) rather than isolated `local` mock storage to verify real network interactions and full-stack behavior.

### [Low] Challenge 4: Short WebServer Boot Timeout

- **Assumption challenged**: Config assumes the mock database and Vite development server will always start up within 10 and 15 seconds respectively.
- **Attack scenario**: Under heavy CI server load or initial package resolution delays, Vite may take slightly longer than 15 seconds to transpile and serve the dev URL.
- **Blast radius**: Sudden and complete failure of the E2E pipeline run during setup.
- **Mitigation**: Increase the `timeout` parameter in `playwright.config.js` webServer block for both mock DB and Vite commands to at least `60000` (60s).

---

## Stress Test Results

- **Vite Startup / Network Speed Variation**: With high CPU load or delayed Vite server response, the current configuration is vulnerable to startup timeouts (webServer timeout: 15s) and execution timeouts (due to fixed 2000ms pauses).
- **Concurrent DB Access**: Because `fullyParallel: false` and `workers: 1` are set, the spec files do not run concurrently, masking potential race conditions on the mock database backend when multiple sessions execute tests concurrently.

---

## Unchallenged Areas

- **SSO Auth Token Mechanism**: Left unchallenged because SSO token generation is mocked directly via `/auth/sso?role=admin` without integration with a real identity provider (IDP).
