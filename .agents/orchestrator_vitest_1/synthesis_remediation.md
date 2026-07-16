# Synthesis: Gate Failure Remediation

## 1. Case-Sensitive E2E Locator Bug
- **File**: `tests/wizard-e2e-10.spec.js` (line 349)
- **Problem**: The locator `page.locator('div', { hasText: /^Tested TTPs$/ })` is case-sensitive, but the DOM element contains `"TESTED TTPs"`.
- **Fix**: Update the regex to be case-insensitive: `/^Tested TTPs$/i`. Also, do the same for the Active Gaps locator `/^Active Gaps$/i` on line 346 for robustness.

## 2. REST API Database Performance Bottleneck
- **File**: `mock_database.js` (lines 377-434)
- **Problem**: Inside `recalculateMitreStatuses`, it repeatedly performs linear scans (`exercises.filter` and `exercises.find` on 100,000 items) inside a nested loop running for hundreds of techniques. This blocks Node's event loop and causes E2E tests to time out.
- **Fix**: Index `exercises` by `ttp` into a hash map before the loop. Replace `exercises.filter(ex => ex.ttp === t.id)` with hash map lookups.
  ```javascript
  const exercisesByTtp = {};
  exercises.forEach(ex => {
      if (!ex.ttp) return;
      if (!exercisesByTtp[ex.ttp]) exercisesByTtp[ex.ttp] = [];
      exercisesByTtp[ex.ttp].push(ex);
  });
  ```
  Then:
  - Replace `const targetExercises = exercises.filter(ex => ex.ttp === t.id);` with `const targetExercises = exercisesByTtp[t.id] || [];`.
  - Replace `const directExercise = exercises.find(ex => ex.ttp === t.id);` with `const directExercise = (exercisesByTtp[t.id] || [])[0];`.

## 3. Environment/Sandbox Pollution
- **Files**: `src/__tests__/useGapsData.test.js` and `src/__tests__/AppContext.test.jsx`
- **Problem**: If an expectation fails inside a test, the subsequent inline mock cleanup lines (such as `spy.mockRestore()`) are skipped, polluting subsequent tests.
- **Fix**: Consolidate cleanup/restore actions inside global `afterEach()` hooks using standard Vitest cleanups:
  - Add/ensure `afterEach(() => { vi.restoreAllMocks(); });` is defined at the top-level describe block.
  - Remove manual inline `.mockRestore()` calls inside individual test blocks.
