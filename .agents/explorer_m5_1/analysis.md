# Milestone 5 Analysis Report: Automated E2E Test Runner & Performance Profiler Design

## Executive Summary
This report presents the design and strategy for the automated programmatic End-to-End (E2E) regression test runner and performance profiling harness for the Iridescence application. 

By utilizing the existing `TestRunner.jsx` structure, which evaluates application logic directly through React Context state and simulated streams, we can enable seamless automation by adding:
1. **Query parameter detection** (`?run=true`) to auto-start the test suite on component mount.
2. **Post-execution webhook integration** to transmit test status, assertion logs, and browser-side performance metrics to a custom callback URL.
3. A **headless browser automation script** (`run_e2e.js`) running natively on Node.js without heavy framework dependencies (like Cypress/Playwright) to control the lifecycle.
4. A **performance profiling framework** to track paint times, heap sizes, and rendering times to evaluate optimization impact.

---

## 1. Analysis of `src/components/TestRunner.jsx`

### Current State
* **Test Architecture**: Runs programmatically inside the client app at the `/test-runner` route. It has direct access to `AppContext` and mirrors it reactively via a mutable React Ref (`contextRef`).
* **Async Verification**: Uses `waitForCondition(conditionFn, timeout)` to poll for state updates every 50ms, resolving when assertions match.
* **Tiers Covered**:
  * **Tier 1**: Environment filters & configuration toggle checks.
  * **Tier 2**: Exercise wizard addition, evidence attachment, summaries, and PDF export schema.
  * **Tier 3**: MITRE heatmap, auto-resolution, validation re-testing, technique scoping, and multi-TTP sync status leak.
  * **Tier 4**: AI Copilot key requirements and chunked stream parsing simulation.
* **Limitations**: 
  * Currently requires manual user interaction (clicking the "Run Test Suite" button).
  * Has no mechanism to report outcomes back to a CI/CD process or external system.

---

## 2. Design: Query Parameter Support (`?run=true`)

To allow programmatic triggers (e.g. from headless browsers), `TestRunner.jsx` will support `?run=true` to initiate testing upon mount.

### Implementation Strategy
We will use a `useEffect` hook that checks the query parameters once the component mounts and the tests are loaded in state.

```javascript
// Proposed addition to src/components/TestRunner.jsx

const autoRunTriggered = useRef(false);

useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const shouldAutoRun = params.get('run') === 'true';

  if (shouldAutoRun && tests.length > 0 && !autoRunTriggered.current && !isRunning) {
    autoRunTriggered.current = true;
    runAllTests();
  }
}, [tests, isRunning]);
```

---

## 3. Design: Custom Callback integration (POST to Port 3001)

When tests are executed automatically, the runner must collect the results and transmit them via HTTP POST to a listener server.

### Result Payload Schema
We define a robust JSON payload structured to deliver summary statistics, specific assertion logs, and performance metrics:

```json
{
  "timestamp": "2026-06-14T18:30:00.000Z",
  "summary": {
    "total": 15,
    "passed": 15,
    "failed": 0
  },
  "results": [
    {
      "id": "1.1",
      "tier": "Tier 1: Environment & Config",
      "name": "Default Environment Configuration",
      "status": "passed",
      "assertions": [
        { "msg": "Verify environment config has key \"Linux\": true", "passed": true }
      ]
    }
  ],
  "performance": {
    "loadTimeMs": 234.50,
    "domContentLoadedMs": 182.20,
    "firstPaintMs": 105.10,
    "firstContentfulPaintMs": 105.10,
    "usedJSHeapSizeMb": 24.30
  }
}
```

### Proposed Code Changes in `TestRunner.jsx`
1. Ensure the loop inside `runAllTests` updates the local mutable `currentTests` array elements with their final status and assertion list:
   ```javascript
   t.status = finalStatus;
   t.assertions = assertions;
   ```
2. Append the POST callback transmission at the very end of `runAllTests`:

```javascript
// At the end of runAllTests() inside TestRunner.jsx
setIsRunning(false);
setActiveTestId(null);
addToast('E2E Testing Suite completed execution.', 'info');

// Handle programmatic result callback
const params = new URLSearchParams(window.location.search);
if (params.get('run') === 'true') {
  const callbackUrl = params.get('callback') || 'http://localhost:3001/api/results';
  
  // Extract browser performance metrics
  const performanceMetrics = getPerformanceMetrics();

  const payload = {
    timestamp: new Date().toISOString(),
    summary: {
      total: currentTests.length,
      passed: currentTests.filter(t => t.status === 'passed').length,
      failed: currentTests.filter(t => t.status === 'failed').length
    },
    results: currentTests.map(t => ({
      id: t.id,
      tier: t.tier,
      name: t.name,
      status: t.status || 'failed',
      assertions: t.assertions || []
    })),
    performance: performanceMetrics
  };

  try {
    const response = await fetch(callbackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (response.ok) {
      addToast('Automation results and metrics posted successfully!', 'success');
    } else {
      addToast(`Webhook failed: ${response.statusText}`, 'error');
    }
  } catch (err) {
    addToast(`Failed to connect to callback server: ${err.message}`, 'error');
  }
}
```

---

## 4. Design: Lightweight Node Controller (`run_e2e.js`)

A local Node script will manage the server start, browser launch, results capture, and cleanup processes.

```javascript
/**
 * Proposed Design for run_e2e.js
 * Location: root of the project (C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\run_e2e.js)
 */

const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT_CALLBACK = 3001;
const PORT_VITE = 5173;
const TEST_TIMEOUT_MS = 60000;

let server = null;
let viteProcess = null;
let browserProcess = null;
let timeoutId = null;

// 1. Native HTTP Server to Collect Results
function startCallbackServer() {
  server = http.createServer((req, res) => {
    // Enable CORS for Vite dev server origin
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'POST' && req.url === '/api/results') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'received' }));
          
          clearTimeout(timeoutId);
          handleTestOutput(payload);
        } catch (e) {
          res.writeHead(400);
          res.end('Invalid JSON');
        }
      });
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(PORT_CALLBACK, () => {
    console.log(`[Server] Webhook server listening on http://localhost:${PORT_CALLBACK}`);
  });
}

// 2. Launch Vite dev server
function startViteServer() {
  console.log(`[Vite] Starting dev server on port ${PORT_VITE}...`);
  viteProcess = spawn('npx', ['vite', '--port', PORT_VITE.toString(), '--strictPort'], {
    shell: true,
    stdio: 'pipe'
  });

  viteProcess.stdout.on('data', (data) => {
    const output = data.toString();
    if (output.includes(`localhost:${PORT_VITE}`)) {
      console.log('[Vite] Server is ready.');
      launchBrowser();
    }
  });

  viteProcess.stderr.on('data', (data) => {
    console.error(`[Vite Error] ${data.toString()}`);
  });
}

// 3. Locate and Launch headlessly Chrome or Edge on Windows/Mac/Linux
function getBrowserPath() {
  const plat = process.platform;
  if (plat === 'win32') {
    const pf = process.env['ProgramFiles'] || 'C:\\Program Files';
    const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const local = process.env['LOCALAPPDATA'];
    const candidates = [
      path.join(pf, 'Google/Chrome/Application/chrome.exe'),
      path.join(pf86, 'Google/Chrome/Application/chrome.exe'),
      path.join(local, 'Google/Chrome/Application/chrome.exe'),
      path.join(pf86, 'Microsoft/Edge/Application/msedge.exe'),
      path.join(pf, 'Microsoft/Edge/Application/msedge.exe')
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
  } else if (plat === 'darwin') {
    const candidates = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
  }
  return 'google-chrome'; // Fallback for Linux or in PATH
}

function launchBrowser() {
  const browserPath = getBrowserPath();
  console.log(`[Browser] Spawning browser headlessly: ${browserPath}`);
  
  const targetUrl = `http://localhost:${PORT_VITE}/test-runner?run=true&callback=http://localhost:${PORT_CALLBACK}/api/results`;
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    targetUrl
  ];

  browserProcess = spawn(browserPath, args, { stdio: 'ignore' });

  // Safety Timeout
  timeoutId = setTimeout(() => {
    console.error('[Timeout] Execution timed out without receiving results.');
    cleanupAndExit(1);
  }, TEST_TIMEOUT_MS);
}

// 4. Handle Results and Write Perf Log
function handleTestOutput(payload) {
  console.log('\n======================================');
  console.log('         E2E TEST RUN SUMMARY         ');
  console.log('======================================');
  console.log(`Tests Run: ${payload.summary.total}`);
  console.log(`Passed:    ${payload.summary.passed}`);
  console.log(`Failed:    ${payload.summary.failed}`);
  console.log('======================================\n');

  let failed = false;
  payload.results.forEach(test => {
    const mark = test.status === 'passed' ? '✓' : '✗';
    console.log(`[${test.status.toUpperCase()}] ${mark} [${test.id}] ${test.name}`);
    if (test.status === 'failed') {
      failed = true;
      test.assertions.forEach(assertion => {
        if (!assertion.passed) {
          console.log(`   └─ Failed Assertion: ${assertion.msg}`);
        }
      });
    }
  });

  // Log performance metrics
  if (payload.performance) {
    console.log('\n======================================');
    console.log('         PERFORMANCE METRICS          ');
    console.log('======================================');
    console.log(`Page Load Time:           ${payload.performance.loadTimeMs.toFixed(2)} ms`);
    console.log(`DOM Content Loaded:       ${payload.performance.domContentLoadedMs.toFixed(2)} ms`);
    console.log(`First Paint:              ${payload.performance.firstPaintMs?.toFixed(2) || 'N/A'} ms`);
    console.log(`First Contentful Paint:   ${payload.performance.firstContentfulPaintMs?.toFixed(2) || 'N/A'} ms`);
    if (payload.performance.usedJSHeapSizeMb) {
      console.log(`JS Heap Size:             ${payload.performance.usedJSHeapSizeMb.toFixed(2)} MB`);
    }
    console.log('======================================\n');
    
    // Save to historical performance log file
    savePerformanceHistory(payload.performance);
  }

  cleanupAndExit(failed ? 1 : 0);
}

function savePerformanceHistory(metrics) {
  const logPath = path.resolve(__dirname, 'perf_log.json');
  let history = [];
  try {
    if (fs.existsSync(logPath)) {
      history = JSON.parse(fs.readFileSync(logPath, 'utf8'));
    }
  } catch (e) {
    history = [];
  }

  history.push({
    timestamp: new Date().toISOString(),
    ...metrics
  });

  fs.writeFileSync(logPath, JSON.stringify(history, null, 2));
  console.log(`[Performance] Metrics recorded in ${logPath}`);
}

// 5. Cleanup Process Hooks
function cleanupAndExit(code) {
  console.log('[Cleanup] Terminating background processes...');
  
  if (browserProcess) {
    try { browserProcess.kill(); } catch (e) {}
  }
  if (viteProcess) {
    try { viteProcess.kill(); } catch (e) {}
  }
  if (server) {
    server.close(() => {
      console.log('[Server] Webhook server closed.');
      process.exit(code);
    });
  } else {
    process.exit(code);
  }

  setTimeout(() => {
    process.exit(code);
  }, 1000);
}

// Initialize execution
startCallbackServer();
startViteServer();
```

---

## 5. Performance Profiling Framework

We leverage native browser performance instrumentation to profile the application, logging core Web Vitals and resource usage.

### Browser-Side Metrics Collector
This method extracts timing data and returns it to `TestRunner.jsx` for payload inclusion:

```javascript
// Add to src/components/TestRunner.jsx

function getPerformanceMetrics() {
  const perf = window.performance;
  const metrics = {
    loadTimeMs: 0,
    domContentLoadedMs: 0,
    firstPaintMs: null,
    firstContentfulPaintMs: null,
    usedJSHeapSizeMb: null
  };

  if (!perf) return metrics;

  // 1. Read Navigation Timing
  const navs = perf.getEntriesByType('navigation');
  if (navs.length > 0) {
    const nav = navs[0];
    metrics.loadTimeMs = nav.duration;
    metrics.domContentLoadedMs = nav.domContentLoadedEventEnd;
  } else if (perf.timing) {
    // Legacy fallback
    metrics.loadTimeMs = perf.timing.loadEventEnd - perf.timing.navigationStart;
    metrics.domContentLoadedMs = perf.timing.domContentLoadedEventEnd - perf.timing.navigationStart;
  }

  // 2. Read Paint Timing
  const paints = perf.getEntriesByType('paint');
  paints.forEach(paint => {
    if (paint.name === 'first-paint') {
      metrics.firstPaintMs = paint.startTime;
    } else if (paint.name === 'first-contentful-paint') {
      metrics.firstContentfulPaintMs = paint.startTime;
    }
  });

  // 3. Read memory footprint (Chrome/Edge extension)
  if (perf.memory) {
    metrics.usedJSHeapSizeMb = perf.memory.usedJSHeapSize / (1024 * 1024);
  }

  return metrics;
}
```

### Performance Comparison Tool (`compare_perf.js`)
To assess the impact of code optimizations before and after refactoring, we design a comparison script `compare_perf.js` that compares the latest run with preceding entries.

```javascript
/**
 * Proposed Design for compare_perf.js
 * Usage: node compare_perf.js
 */
const fs = require('fs');
const path = require('path');

const logPath = path.resolve(__dirname, 'perf_log.json');

if (!fs.existsSync(logPath)) {
  console.log('No performance logs found. Please run the E2E test runner first.');
  process.exit(0);
}

const history = JSON.parse(fs.readFileSync(logPath, 'utf8'));
if (history.length < 2) {
  console.log('Need at least 2 logged runs to compare performance changes.');
  console.log(`Current logs count: ${history.length}`);
  process.exit(0);
}

const baseline = history[history.length - 2];
const current = history[history.length - 1];

console.log(`\n======================================================`);
console.log(`   PERFORMANCE COMPARISON REPORT (BEFORE vs AFTER)`);
console.log(`   Baseline: ${baseline.timestamp}`);
console.log(`   Current:  ${current.timestamp}`);
console.log(`======================================================\n`);

function printMetricRow(name, baseVal, curVal, unit = 'ms') {
  if (baseVal === null || curVal === null || baseVal === undefined || curVal === undefined) {
    return;
  }
  const diff = curVal - baseVal;
  const pct = (diff / baseVal) * 100;
  const direction = diff <= 0 ? 'Improved ✓' : 'Regressed ✗';
  const color = diff <= 0 ? '\x1b[32m' : '\x1b[31m'; // green vs red
  const reset = '\x1b[0m';
  
  console.log(
    `${name.padEnd(25)} | ` +
    `${baseVal.toFixed(2).padStart(8)} ${unit} | ` +
    `${curVal.toFixed(2).padStart(8)} ${unit} | ` +
    `${color}${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% (${direction})${reset}`
  );
}

printMetricRow('Page Load Time', baseline.loadTimeMs, current.loadTimeMs);
printMetricRow('DOM Content Loaded', baseline.domContentLoadedMs, current.domContentLoadedMs);
printMetricRow('First Paint', baseline.firstPaintMs, current.firstPaintMs);
printMetricRow('First Contentful Paint', baseline.firstContentfulPaintMs, current.firstContentfulPaintMs);
printMetricRow('JS Heap Memory Size', baseline.usedJSHeapSizeMb, current.usedJSHeapSizeMb, 'MB');

console.log(`\n======================================================`);
```

---

## 6. Implementation and Verification Plan

### Verification Command
To verify the E2E runner changes and Node controller launch:
```bash
node run_e2e.js
```
Expected execution sequence:
1. Webhook server starts listening on port 3001.
2. Vite server starts on port 5173.
3. Browser is launched headlessly, loading the `/test-runner?run=true` page.
4. Test runner executes all 15 regression test cases.
5. React collects metrics, compiles results, and POSTs to port 3001.
6. Node controller prints console outputs, writes `perf_log.json`, and exits with code `0`.

To run comparison check:
```bash
node compare_perf.js
```
Outputs tabular before/after differences.
