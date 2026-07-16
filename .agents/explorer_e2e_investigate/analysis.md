# E2E Testing Infrastructure Analysis and Recommendations

## 1. Vite & Mock Database Analysis

### 1.1 Vite Dev Server
- **Service**: Vite Dev Server
- **Configuration File**: `vite.config.js`
- **Port**: `5173` (defined in `playwright.config.js` and `run_e2e.js`)
- **Host**: `127.0.0.1` (configured in both `playwright.config.js` and `run_e2e.js` to ensure local loopback resolution)
- **Status**: **Healthy**. Vite launches correctly and hosts the React single page application.

### 1.2 Mock Database
- **Service**: Raw Node.js HTTP Server (`mock_database.js`)
- **Port**: `3001`
- **Data Source**: Loads data from `synthetic_stress_data.json` if available; falls back to generating 100,000 synthetic exercises if the file is missing or empty.
- **Key Features**:
  - Handles JWT authentication token generation `/auth/login` and `/auth/sso`.
  - Enforces Role-Based Access Control (RBAC) (write requests like POST/PUT/DELETE require the `admin` role).
  - Implements storage CRUD endpoints under `/data/:key` and `/api/gaps`, `/api/exercises`.
  - Calculates server-side MITRE ATT&CK coverage rolling metrics `/api/mitre-coverage`.
  - Provides a root health check endpoint (`/`) that returns `{"status":"healthy","service":"eclipse-ops-mock-db"}` with status code `200 OK` and does not require authentication.
- **Status**: **Healthy**. The mock database launches, serves APIs, and correctly performs rollup calculations.

---

## 2. Playwright Configuration and Spec Files Assessment

### 2.1 Configuration: `playwright.config.js`
- **Completeness**: Excellent. Defines browser settings, timeout (30 seconds), workers count (1), HTML reporter, trace settings on first retry, and automatic server lifecycle via the `webServer` block.
- **Stability Issues & Refinement**:
  - **Issue**: The current webServer block for the mock database is configured to ping `http://127.0.0.1:3001/api/exercises`. This endpoint requires authorization. Pinging it without a JWT token results in a `401 Unauthorized` response. Although Playwright proceeds (since any HTTP status response is recognized as the server being "up"), it generates auth failure logs.
  - **Recommendation**: Change the ping URL for the database to the root health check endpoint `http://127.0.0.1:3001/` which responds with `200 OK` and requires no credentials.

### 2.2 Spec File: `tests/wizard-e2e.spec.js`
- **Critical Correctness/Stability Defect**:
  - **The Defect**: This test suite does NOT inject authorization tokens, user roles, or the cached MITRE data into the browser's `localStorage` before navigating. 
  - **Impact in CI/Offline Environments**: When navigating to `/exercise`, the React application attempts to fetch the MITRE database from `https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json`. In a sandboxed, offline environment, this fetch times out after 2 seconds. The app catches this error and attempts to fall back to `mitre_data_v2` in `localStorage`. Because the test did not inject this cache, the local storage value is empty, causing the TTP Selector modal to display no techniques. The Playwright test hangs waiting for `button[title="Select Parent Technique"]` and eventually fails.
  - **Resolution**: Use `page.addInitScript` to pre-populate `localStorage` before running the test, fetching the token and loading `mitre_stix_cache.json` in the Node environment (matching the implementation in `wizard-e2e-10.spec.js`).
- **Minor Discrepancy**:
  - The test title says `should complete wizard steps and verify reports metrics 20 times` and log outputs state `--- STARTING SIMULATION i OF 20 ---`. However, the loop is hardcoded as `for (let i = 1; i <= 3; i++)`. The loop count should be renamed or adjusted.

### 2.3 Spec File: `tests/wizard-e2e-10.spec.js`
- **Completeness/Stability**: **Excellent**. It correctly reads the local `mitre_stix_cache.json` file in Node, obtains an SSO auth token via an API request to the backend, and injects both into `localStorage` before test execution. It runs successfully.

### 2.4 Spec File: `tests/wizard-stress.spec.js`
- **Stability/Configuration Issue**:
  - **Issue 1**: The test runs a massive workload by default: 200 sequential simulation runs (`STRESS_TEST_COUNT || '200'`).
  - **Issue 2**: The spec configures parallel execution via `test.describe.configure({ mode: 'parallel' })`. However, `playwright.config.js` enforces `workers: 1`. This conflicts with parallel mode, forcing all 200 tests to run sequentially on a single worker, which takes excessive time and causes timeouts.
  - **Recommendation**: Categorize stress tests separately, set `STRESS_TEST_COUNT` to 1 for standard validation runs, and override workers count on the CLI (e.g. `--workers=4`) when performing real stress testing.

### 2.5 Spec File: `tests/ui-load-perf.spec.js`
- **Completeness/Stability**: **Excellent**. Properly uses `addInitScript` to inject the MITRE cache and token, and successfully saves measured timing metrics to `ui_load_perf_results.json`.

---

## 3. Remapping `npm run test:e2e`

Currently, `npm run test:e2e` points to `run_e2e.js`, which is a custom Node script that manually spawns Chrome with command-line flags and listens on a custom HTTP port 3002 callback. It is not integrated with Playwright.

To switch to Playwright headlessly with automated server lifecycle management:
1. Re-map `test:e2e` in `package.json` to execute `playwright test`.
2. Configure it to run headlessly (which `playwright.config.js` does by default via `headless: true` under `use`).
3. Ensure it runs smoothly by excluding heavy stress tests under standard runs.

We recommend adding the following scripts to `package.json`:
- `"test:e2e": "playwright test --grep-invert @stress"` (Runs all E2E, UI load, and verification tests while skipping the 200-iteration stress tests)
- `"test:e2e:stress": "cross-env STRESS_TEST_COUNT=20 playwright test tests/wizard-stress.spec.js --workers=4"` (Dedicated command for stress testing with multi-worker support)

---

## 4. GitHub Actions CI/CD Configuration

Below is the draft CI/CD workflow configuration to be written to `.github/workflows/e2e.yml`. It handles:
- Checking out the repository
- Setting up Node.js with dependency caching
- Installing npm packages (`npm ci`)
- Installing Playwright system dependencies and browser binaries
- Running `npm run test:e2e`
- Uploads Playwright HTML report and performance results as artifacts.

```yaml
name: End-to-End Testing

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]

jobs:
  e2e-tests:
    timeout-minutes: 15
    runs-on: ubuntu-latest

    steps:
    - name: Checkout Repository
      uses: actions/checkout@v4

    - name: Set up Node.js
      uses: actions/setup-node@v4
      with:
        node-version: 18
        cache: 'npm'

    - name: Install Dependencies
      run: npm ci

    - name: Install Playwright Browsers and System Dependencies
      run: npx playwright install --with-deps chromium

    - name: Run E2E Test Suite
      run: npm run test:e2e
      env:
        CI: true

    - name: Upload Playwright Report
      uses: actions/upload-artifact@v4
      if: always()
      with:
        name: playwright-report
        path: playwright-report/
        retention-days: 30

    - name: Upload Performance Results
      uses: actions/upload-artifact@v4
      if: always()
      with:
        name: ui-load-performance-results
        path: ui_load_perf_results.json
        retention-days: 30
```
