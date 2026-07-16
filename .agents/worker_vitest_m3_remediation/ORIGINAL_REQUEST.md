# ORIGINAL REQUEST - 2026-06-27T23:11:03-04:00

Apply remediation fixes for E2E locator casing, mock database performance loop, and Vitest test mock cleanups.

INPUT INFORMATION:
Read the remediation design synthesis file at: C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\.agents\orchestrator_vitest_1\synthesis_remediation.md
Target files to modify:
- `tests/wizard-e2e-10.spec.js`
- `mock_database.js`
- `src/__tests__/useGapsData.test.js`
- `src/__tests__/AppContext.test.jsx`

REQUIREMENTS:
1. Modify `tests/wizard-e2e-10.spec.js` to make the dashboard metric locators case-insensitive (e.g. `/^Tested TTPs$/i` and `/^Active Gaps$/i`), as detailed in `synthesis_remediation.md`.
2. Modify `mock_database.js` to optimize the `recalculateMitreStatuses` function by grouping exercises by TTP in a hash map before the loop. This will eliminate the nested O(N*T) performance bottleneck.
3. Modify `src/__tests__/useGapsData.test.js` and `src/__tests__/AppContext.test.jsx` to move mock restoration and cleanup actions into a global `afterEach` hook (`afterEach(() => { vi.restoreAllMocks(); });`) and remove inline mock restores from individual tests, preventing sandbox/test environment pollution if assertions fail.
4. Verify your work by running:
   - Playwright E2E tests: `npm run test:e2e` to ensure all tests pass (including `wizard-e2e-10.spec.js` which should run much faster now).
   - Vitest tests: `npm run test` or `npx vitest run` to ensure unit tests run and pass without pollution.
   - Production build: `npm run build` to verify the build completes successfully.
5. Create a `handoff.md` in your working directory summarizing:
   - What modifications were made to each file.
   - The exact test execution commands and their terminal output results.
6. When complete, send a message to the orchestrator (conversation ID: 34a14340-4350-4597-a981-ffe2200a18da).
