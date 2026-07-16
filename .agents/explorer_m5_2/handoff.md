# Handoff Report: Automated E2E Test Runner & Performance Profiler Design (Milestone 5)

## 1. Observation
- `src/components/TestRunner.jsx`:
  - Contains test definitions in `testSuite` (lines 148–762).
  - Test loop in `runAllTests` (lines 778–842) iterates over `testSuite`, executing each asynchronously with `await t.run(contextRef.current, logAssertion)`.
  - State updates are done via React `setTests` (e.g. line 806: `setTests(prev => prev.map(...))`), which are asynchronous.
- `src/App.jsx` (lines 97, 51–53) mounts `<TestRunner />` under route `/test-runner`.
- `src/AppContext.jsx` (lines 273–387) loads MITRE data asynchronously using `fetchMitreData()`.
- `package.json` does not have any external E2E testing framework dependency (e.g., Cypress, Puppeteer, Playwright).

## 2. Logic Chain
- To run tests automatically, we must intercept the URL query parameters on component mount. Since React Router is used, we can parse parameters using `window.location.search` or `URLSearchParams`.
- Because MITRE data is loaded asynchronously (`isMitreLoading` in AppContext), immediate test triggering could cause Tier 3 tests to fail due to missing TTP techniques. Therefore, we must wait for `isMitreLoading === false` before starting execution.
- React state updates are asynchronous, meaning `tests` state read immediately after `runAllTests` loop won't contain final outcomes. Thus, we need to accumulate final status in a local array inside `runAllTests` to be sent in the POST payload.
- Lacking E2E dependencies in `package.json`, we can run Chrome or Edge headlessly via native command line execution (e.g. `chrome --headless`).
- The headless browser needs a local listener to collect results and coordinate exit status. A lightweight Node HTTP server on port 3001 using the native `http` module is fully self-contained and avoids adding package dependencies.
- Page load and rendering performance metrics can be gathered directly in-browser using standard Performance Timing (`performance.timing`) and Paint Timing (`performance.getEntriesByType('paint')`) APIs, then sent to the Node listener in the POST payload.

## 3. Caveats
- No actual browser automation API (like Playwright/Puppeteer) is used. Instead, the React application itself acts as the test execution engine, driving its own assertions and reporting back. This means we are testing the application logic via the React state context, but we cannot test raw user interactions (e.g. clicking coordinates, file uploads) that React itself cannot execute.
- Chrome or Edge paths assumed are default Windows directory locations. If standard paths are modified or the browser is not installed, the script will fall back and fail with an exit code of 1.

## 4. Conclusion
We have designed a robust, zero-dependency, automated E2E test runner framework and performance profiler. The plan includes:
1. Enhancing `TestRunner.jsx` to support the `?run=true` query parameter, ensuring it waits for async context state (MITRE data) to be loaded before automatically executing.
2. Collecting and transmitting the final results and paint/load timing metrics to a POST endpoint (`http://localhost:3001/api/results`) when execution finishes.
3. A controller script `run_e2e.js` that runs Vite, launches the headless browser natively, receives the POST callback, and exits with 0 or 1.

## 5. Verification Method
1. Review the proposed changes in `C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\.agents\explorer_m5_2\analysis.md`.
2. Inspect `TestRunner.jsx` to verify that proposed hook logic matches local React patterns.
3. Validate that standard Windows executable paths for Chrome and Edge correspond to target environments.
