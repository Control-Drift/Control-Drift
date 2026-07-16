# Verification Plan - E2E Verification Test Suite

This plan details the steps to empirically verify the E2E verification test suite (`tests/wizard-worst-case-e2e.spec.js`) fully headlessly, executing without timeouts or flakes, and meeting all assertions.

## Steps

1. **Verify environment readiness**
   - Run a basic package list check or npm install to ensure all dependencies and playwright browsers are available.
   - Command: `npm ls --depth=0` and check if `@playwright/test` is present.
   - Expected Result: Dependencies are resolved.

2. **Verify Playwright browser availability**
   - Ensure the Playwright browser binaries are installed on the system.
   - Command: `npx playwright install chromium`
   - Expected Result: Chromium browser binary is downloaded and ready.

3. **Run the Playwright test**
   - Execute the target Playwright spec.
   - Command: `npx playwright test tests/wizard-worst-case-e2e.spec.js`
   - Cwd: `C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops`
   - Expected Result: The test completes successfully with 1 passed test, outputting logs for each of the 10 campaigns and the posture assertions.

4. **Verify headlessness and config constraints**
   - Inspect the test run output logs to confirm Playwright runs in headless mode.
   - Check `playwright.config.js` contents to ensure `headless: true` is configured and used.

5. **Examine test execution metrics (Stress / Flakiness check)**
   - Run the test multiple times (e.g. 3 times) to ensure there is zero flakiness, no timeouts, and consistency.
   - Command: `npx playwright test tests/wizard-worst-case-e2e.spec.js --repeat-each=3` (or sequential runs)
   - Expected Result: All runs pass consistently with no flakes.

6. **Compile Verification Report**
   - Write `handoff.md` with:
     - Observations (exact commands, logs, execution time)
     - Logic Chain (how observations support the conclusion of successful headless/flake-free run)
     - Caveats (any environmental limitations, etc.)
     - Conclusion
     - Verification Method (commands to run)
