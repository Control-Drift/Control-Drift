# Handoff Report: Stress Test Data Injection and E2E Verification Analysis

## 1. Observation

### A. ES Module / CommonJS Compatibility Failures
When attempting to execute `generate_synthetic_stress_data.js` and `inject_chaos.js` directly with Node.js, they fail with the following errors:
- Command: `node generate_synthetic_stress_data.js`
  - Output:
    ```
    ReferenceError: require is not defined in ES module scope, you can use import instead
    This file is being treated as an ES module because it has a '.js' file extension and 'C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\package.json' contains "type": "module". To treat it as a CommonJS script, rename it to use the '.cjs' file extension.
        at file:///C:/Users/thoma/.gemini/antigravity/scratch/eclipse-ops/generate_synthetic_stress_data.js:1:12
    ```
- Command: `node inject_chaos.js`
  - Output:
    ```
    ReferenceError: require is not defined in ES module scope, you can use import instead
    ```
In contrast, running the pre-existing CommonJS equivalents (`generate_synthetic_stress_data.cjs` and `inject_chaos.cjs`) succeeds:
- Command: `node generate_synthetic_stress_data.cjs`
  - Output:
    ```
    Successfully generated massive synthetic stress dataset at C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\synthetic_stress_data.json
    Generated 10500 exercises and 1050 gaps.
    ```
- Command: `node inject_chaos.cjs`
  - Output:
    ```
    Injected chaos into exercises: 2506, 10432, 1053, 2956, 8403, 3771, 4347, 8913, 5659, 1805
    Injected chaos into gaps: 405, 722, 626, 824, 138, 726, 67, 870, 633, 807
    ```

### B. Mathematical Verification of Metrics
When `synthetic_stress_data.json` had insufficient exercises (5,384 instead of the minimum 10,000), `verify_metrics_stress.js` failed:
- Output:
  ```
  AssertionError [ERR_ASSERTION]: Should have at least 10,000 exercises (found 5384)
      at file:///C:/Users/thoma/.gemini/antigravity/scratch/eclipse-ops/verify_metrics_stress.js:26:8
  ```
After generating the full dataset via the `.cjs` script, `verify_metrics_stress.js` and `verify_dashboard_stress.cjs` pass.
- Output from `verify_metrics_stress.js` includes:
  - Tactic rollups verify Average Coverage vs Weakest Link.
  - Error and Pending states are ignored in the coverage calculation denominator.
  - Global Resilience Score (GRS) is verified.
  - Mean Time to Remediate (MTTR) negative intervals are bounded/filtered.

### C. Offline MITRE ATT&CK Fetch Failure in E2E Tests
When running `npx playwright test tests/wizard-e2e.spec.js`, the test hangs and eventually times out.
- Command: `npx playwright test tests/wizard-e2e.spec.js`
  - Log output:
    ```
    [1/1] tests\wizard-e2e.spec.js:4:3 › Purple Team Simulation Wizard E2E Flow › should complete wizard steps and verify reports metrics 20 times
    Navigating to simulation launcher...
    --- STARTING SIMULATION 1 OF 20 ---
    Completing Step 1: Scoping for Simulation 1...
    Opening TTP Selector Modal...
    ```
Looking at the codebase, `tests/wizard-e2e.spec.js` does not initialize the browser's local storage with the local MITRE cache (`mitre_stix_cache.json`). As a result, the application executes a fetch request to `https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json` (line 294 in `src/hooks/useMitreData.js`). In a `CODE_ONLY` air-gapped network mode, this request fails or times out.
Since `localStorage.getItem('mitre_data_v2')` is empty, the application falls back to an empty matrix (`baseMitreData` set to `{}`). The scoping selector `button[title="Select Parent Technique"]` is never rendered, and the Playwright selector times out:
- Line 46 in `tests/wizard-e2e.spec.js`:
  ```javascript
  await page.waitForSelector('button[title="Select Parent Technique"]');
  ```
Conversely, `tests/wizard-e2e-10.spec.js` and `tests/wizard-stress.spec.js` parse the local `mitre_stix_cache.json` inside Node.js and inject it into `localStorage` during page initialization (via `page.addInitScript`).

### D. Playwright Sequential Test Iteration Overhead
In `tests/wizard-stress.spec.js`, the default number of simulations (`TOTAL_SIMULATIONS`) is set to 200:
- Line 7 in `tests/wizard-stress.spec.js`:
  ```javascript
  const TOTAL_SIMULATIONS = parseInt(process.env.STRESS_TEST_COUNT || '200', 10);
  ```
Since `playwright.config.js` sets `workers: 1`, these 200 iterations execute sequentially. Because each iteration mimics human interactions (typing delays, modal interactions), 200 simulations would take ~1 hour, exceeding the Playwright test/step timeouts.

---

## 2. Logic Chain

1. **CommonJS Mismatch**: Since `package.json` specifies `"type": "module"`, Node.js treats all `.js` files in the workspace as ES Modules. Files using `require()` (like `generate_synthetic_stress_data.js` and `inject_chaos.js`) fail on launch. Renaming them to `.cjs` (or using the pre-existing `.cjs` files) forces CommonJS execution, bypassing the error.
2. **Offline Hanging**: `tests/wizard-e2e.spec.js` does not populate `localStorage` with the local STIX data. In an air-gapped execution environment, the application's fetch to GitHub fails. This prevents the MITRE taxonomy matrix from loading, so the TTP Selector Modal remains empty, and the Playwright step hangs on waiting for selector `button[title="Select Parent Technique"]`.
3. **Storage Leak Block**: If the database provider is set to `'rest'` from previous test runs, `tests/wizard-e2e.spec.js` gets blocked by the login screen (`AuthScreen`) because it does not set the `db_config` to `'local'` or supply a valid authentication token.
4. **Stress Test Timeouts**: Since `playwright.config.js` enforces `workers: 1`, tests run sequentially. Running 200 full-wizard iterations in `tests/wizard-stress.spec.js` sequentially will exceed standard step timeouts unless `STRESS_TEST_COUNT` is explicitly restricted to a smaller value.

---

## 3. Caveats
- We did not test performance on actual DOM rendering when loading the full 100k+ exercises (which `mock_database.js` can generate if `synthetic_stress_data.json` is empty).
- The mock database server handles SSO callback and tokens, but we assume the admin role is configured with correct write access.

---

## 4. Conclusion
1. **Stress-Test Utilities**: The generation utility creates 10,500 exercises and 1,050 gaps, writing to `synthetic_stress_data.json`. The chaos script injects long strings, Zalgo text, HTML injection scripts, and nested quotes into random exercises/gaps.
   - *Issues*: Direct execution of `.js` files fails due to ES module conflicts. The pre-existing `.cjs` equivalents must be used. Additionally, `inject_chaos.js` / `.cjs` target fields that do not exist in the exercises schema (e.g. `executionNotes`, `tactic`), so they add new properties rather than corrupting existing ones, though `verify_stress_data_injected.js` applies its own schema-compliant chaos.
2. **E2E Audit**: The test runner audits integrity across the app:
   - **Launcher / Scoping**: Verifies dynamic environment selection and TTP mapping.
   - **Gap Tracker**: Verifies gap auto-resolution on `high` exercises and updates validation outcomes.
   - **Heatmap**: Verifies average coverage tactic rollup and scope toggling.
   - **Metrics**: Verifies mathematical correctness of GRS, resolution rate, residual risk, and MTTR.
3. **Workspace Modifications**:
   - Rename/call the CommonJS files (`generate_synthetic_stress_data.cjs` and `inject_chaos.cjs`) for data generation.
   - Modify `tests/wizard-e2e.spec.js` to parse local `mitre_stix_cache.json` and inject it into `localStorage` during page init, as well as set database configuration to `'local'`.
   - Restrict `STRESS_TEST_COUNT` when executing `tests/wizard-stress.spec.js`.

---

## 5. Verification Method

To verify these findings, run the following commands:
1. **Regenerate stress data**:
   ```bash
   node generate_synthetic_stress_data.cjs
   node inject_chaos.cjs
   ```
2. **Verify metrics & calculations mathematically**:
   ```bash
   node verify_metrics_stress.js
   node verify_dashboard_stress.cjs
   ```
3. **Verify API and database injection integrity**:
   ```bash
   node verify_stress_data_injected.js
   ```
4. **Execute isolated E2E tests**:
   ```bash
   npx playwright test tests/wizard-e2e-10.spec.js
   ```
   (Wait for campaigns to run, then check console log output for successful validation checks).
