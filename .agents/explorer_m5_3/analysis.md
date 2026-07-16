# Milestone 5 Analysis Report: E2E Test Runner & Performance Profiler Design

## Executive Summary
This report presents the design and strategy for automating the End-to-End (E2E) testing framework and introducing performance profiling for the Iridescence application (Milestone 5). The solution is lightweight, requires no external dependencies (like Puppeteer, Cypress, or Express), and is optimized to run natively on Windows.

---

## 1. Analysis of the Existing E2E Test Suite (`TestRunner.jsx`)
In the current codebase, `src/components/TestRunner.jsx` houses the E2E verification infrastructure:
- **Tiers 1-4**: Contains 12 tests validating environment configuration, campaign execution, MITRE coverage score logic, and AI stream parsing simulation.
- **Asynchronous Execution Flow**: The `runAllTests` function resets test states to `'pending'` and runs them sequentially.
- **Context Polling**: The helper `waitForCondition(conditionFn, timeout)` polls a React ref mirroring the application state (`contextRef.current`) every 50ms to verify that state updates have occurred.
- **State Isolation**: It backs up the existing application state in-memory and in localStorage before run, and provides a "Restore Original State" option to prevent data corruption.
- **User Interface**: Rendered at `/test-runner`, providing manual buttons to trigger tests, reset the sandbox, restore state, and view assertions logs.

---

## 2. Implementing Query Parameter Support (`?run=true`)
To trigger test suite execution automatically upon loading the test-runner page, we will inspect the URL search parameters on mount.

### Proposed Code Change (TestRunner.jsx)
We will add a new `useEffect` hook that triggers `runAllTests()` after the initial test cases have been set up in the component state:

```javascript
// Inside src/components/TestRunner.jsx, below runAllTests definition

const testsLength = tests.length;
useEffect(() => {
  const queryParams = new URLSearchParams(window.location.search);
  if (queryParams.get('run') === 'true' && testsLength > 0 && !isRunning) {
    // Add a slight timeout to ensure page rendering and context initialization are stable
    const timer = setTimeout(() => {
      runAllTests();
    }, 500);
    return () => clearTimeout(timer);
  }
}, [testsLength]);
```

---

## 3. Implementing the Custom POST Callback
To report test results to a CI/CD orchestrator or a local controller script, `TestRunner.jsx` will support posting results to a callback endpoint (configured via query param `?callback=...` or defaulting to `http://localhost:3001/api/results`).

### Proposed Code Change (TestRunner.jsx)
We will modify the `runAllTests` function to accumulate test results in an array and POST the results as a JSON payload upon completion:

```javascript
// Modify runAllTests in src/components/TestRunner.jsx to track and send results:
const runAllTests = async () => {
  if (isRunning) return;
  setIsRunning(true);
  abortRef.current = false;

  // Reset status to pending
  setTests(prev => prev.map(t => ({ ...t, status: 'pending', assertions: [] })));

  const currentTests = testSuite.map(t => ({
    id: t.id,
    tier: t.tier,
    name: t.name,
    description: t.description,
    status: 'pending',
    assertions: [],
    run: t.run
  }));

  addToast('E2E Regression Testing Suite Started...', 'info');
  const resultsList = [];

  for (let i = 0; i < currentTests.length; i++) {
    if (abortRef.current) break;

    const t = currentTests[i];
    setActiveTestId(t.id);
    setTests(prev => prev.map(pt => pt.id === t.id ? { ...pt, status: 'running' } : pt));
    setExpandedTests(prev => ({ ...prev, [t.id]: true }));

    const assertions = [];
    const logAssertion = (msg, passed) => {
      assertions.push({ msg, passed });
      setTests(prev => prev.map(pt => pt.id === t.id ? { ...pt, assertions: [...assertions] } : pt));
    };

    let finalStatus = 'failed';
    try {
      await t.run(contextRef.current, logAssertion);
      const allPassed = assertions.length > 0 && assertions.every(a => a.passed);
      finalStatus = allPassed ? 'passed' : 'failed';
      if (assertions.length === 0) {
        logAssertion('No assertions executed', false);
      }
      setTests(prev => prev.map(pt => pt.id === t.id ? { ...pt, status: finalStatus } : pt));
    } catch (err) {
      logAssertion(`Critical error: ${err.message}`, false);
      setTests(prev => prev.map(pt => pt.id === t.id ? { ...pt, status: 'failed' } : pt));
    }

    resultsList.push({
      id: t.id,
      name: t.name,
      tier: t.tier,
      status: finalStatus,
      assertions: [...assertions]
    });

    await new Promise(resolve => setTimeout(resolve, 300));
  }

  setIsRunning(false);
  setActiveTestId(null);
  addToast('E2E Testing Suite completed execution.', 'info');

  // Retrieve Query Parameters for Auto-reporting
  const queryParams = new URLSearchParams(window.location.search);
  const isAutoRun = queryParams.get('run') === 'true';
  const callbackUrl = queryParams.get('callback');

  if (isAutoRun || callbackUrl) {
    const targetUrl = callbackUrl || 'http://localhost:3001/api/results';
    
    // Performance metrics collection
    const perfMetrics = {};
    if (window.performance) {
      const [navTiming] = performance.getEntriesByType('navigation');
      if (navTiming) {
        perfMetrics.pageLoadTime = Math.round(navTiming.loadEventEnd - navTiming.fetchStart);
        perfMetrics.domContentLoaded = Math.round(navTiming.domContentLoadedEventEnd - navTiming.fetchStart);
      }
      const paintEntries = performance.getEntriesByType('paint');
      paintEntries.forEach(entry => {
        if (entry.name === 'first-paint') perfMetrics.firstPaint = Math.round(entry.startTime);
        if (entry.name === 'first-contentful-paint') perfMetrics.firstContentfulPaint = Math.round(entry.startTime);
      });
    }
    // Attach collected React component render times
    perfMetrics.reactRenders = window.reactRenderMetrics || [];

    const payload = {
      summary: {
        total: resultsList.length,
        passed: resultsList.filter(r => r.status === 'passed').length,
        failed: resultsList.filter(r => r.status === 'failed').length,
        success: resultsList.every(r => r.status === 'passed')
      },
      results: resultsList,
      performance: perfMetrics
    };

    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        addToast('Test results successfully posted to callback.', 'success');
      } else {
        addToast(`Failed to post results: HTTP ${response.status}`, 'error');
      }
    } catch (err) {
      addToast(`Callback network error: ${err.message}`, 'error');
    }
  }
};
```

---

## 4. Design of the Lightweight Node Controller (`run_e2e.js`)
The `run_e2e.js` script handles starting the Vite development server, spinning up a local listener, spawning the headless browser, collecting results, cleaning up, and exiting with correct codes.

### Key Features
1. **Lightweight Server**: Written using Node's native `http` module.
2. **CORS Handling**: Properly responds to OPTIONS preflight requests from the browser app.
3. **Robust Windows Browser Detection**: Resolves common install paths for Chrome and Microsoft Edge on Windows.
4. **Reliable Process Termination**: Uses Windows native `taskkill /pid <PID> /T /F` to cleanly tear down spawned child process trees (Vite and browser).
5. **JSON Export Support**: Accept `--output=path.json` argument to write performance and results data to disk.

### Proposed Script Structure (`run_e2e.js`)
```javascript
const { spawn, execSync } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Parse CLI args
const args = process.argv.slice(2);
const outputArg = args.find(arg => arg.startsWith('--output='));
const outputPath = outputArg ? outputArg.split('=')[1] : null;

// Determine browser path on Windows
function getBrowserPath() {
  const paths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// Global process and server handles
let server, viteProcess, browserProcess;
let isExiting = false;

// Cleanup process tree on Windows
function killProcessTree(pid) {
  try {
    execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
  } catch (e) {
    // Process might already have exited
  }
}

function cleanupAndExit(exitCode) {
  if (isExiting) return;
  isExiting = true;
  console.log('\nCleaning up processes...');
  
  if (browserProcess && browserProcess.pid) killProcessTree(browserProcess.pid);
  if (viteProcess && viteProcess.pid) killProcessTree(viteProcess.pid);
  if (server) server.close();

  console.log(`Exiting with status code: ${exitCode}`);
  process.exit(exitCode);
}

// Start HTTP results receiver
let resolveResults;
const resultsPromise = new Promise((resolve) => { resolveResults = resolve; });

server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/api/results') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
        resolveResults(data);
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(3001, () => {
  console.log('Results receiver server listening on port 3001');
  startVite();
});

// Start Vite development server
function startVite() {
  console.log('Starting Vite development server...');
  viteProcess = spawn('npx', ['vite'], { shell: true });

  let port = 5173;
  let serverReady = false;

  const onData = (data) => {
    const output = data.toString();
    console.log(`[Vite] ${output.trim()}`);
    
    const portMatch = output.match(/localhost:(\d+)/) || output.match(/Local:\s+http:\/\/localhost:(\d+)/);
    if (portMatch && !serverReady) {
      port = parseInt(portMatch[1]);
      serverReady = true;
      launchBrowser(port);
    }
  };

  viteProcess.stdout.on('data', onData);
  viteProcess.stderr.on('data', (data) => {
    console.error(`[Vite Error] ${data.toString().trim()}`);
  });

  // Fallback timeout in case output doesn't match standard patterns
  setTimeout(() => {
    if (!serverReady) {
      serverReady = true;
      console.log('Vite startup timeout reached. Proceeding with port 5173...');
      launchBrowser(5173);
    }
  }, 4000);
}

// Launch Chrome/Edge Headlessly
function launchBrowser(port) {
  const browserPath = getBrowserPath();
  if (!browserPath) {
    console.error('CRITICAL: Chrome or Microsoft Edge was not found on this Windows system.');
    cleanupAndExit(1);
    return;
  }

  const url = `http://localhost:${port}/test-runner?run=true&callback=http://localhost:3001/api/results`;
  console.log(`Launching headless browser: ${browserPath}`);
  console.log(`Navigating to: ${url}`);

  browserProcess = spawn(browserPath, [
    '--headless=new',
    '--disable-gpu',
    url
  ]);

  browserProcess.on('exit', (code) => {
    console.log(`Headless browser closed with exit code ${code}`);
  });

  // Global timeout for the entire run
  setTimeout(() => {
    console.error('CRITICAL: Test execution timed out after 60 seconds.');
    cleanupAndExit(1);
  }, 60000);
}

// Wait for E2E results
resultsPromise.then((data) => {
  console.log('\n======================================');
  console.log('       E2E TEST RUN COMPLETED         ');
  console.log('======================================');
  console.log(`Overall Status : ${data.summary.success ? 'PASSED \u2713' : 'FAILED \u2717'}`);
  console.log(`Passed Cases   : ${data.summary.passed} / ${data.summary.total}`);
  console.log(`Failed Cases   : ${data.summary.failed}`);
  
  if (data.summary.failed > 0) {
    console.log('\n--- Failed Assertions Detail ---');
    data.results.filter(r => r.status === 'failed').forEach(r => {
      console.log(`\n[Test Case ${r.id}] ${r.name}`);
      r.assertions.forEach(a => {
        console.log(`  ${a.passed ? '\u2713' : '\u2717'} ${a.msg}`);
      });
    });
  }

  if (outputPath) {
    try {
      fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
      console.log(`\nExported E2E run data to: ${outputPath}`);
    } catch (err) {
      console.error(`Failed to write output file: ${err.message}`);
    }
  }

  cleanupAndExit(data.summary.success ? 0 : 1);
}).catch((err) => {
  console.error(`Results processing error: ${err.message}`);
  cleanupAndExit(1);
});
```

---

## 5. Performance Profiling Design & Comparison Tool
To measure page loading and React render durations before and after optimizations, we will log browser performance APIs and React `<Profiler>` data.

### Step 5a: React `<Profiler>` Integration
We will wrap major components in `src/App.jsx` with React's `<Profiler>` component. The profiler collects mount and update durations and writes them to a global array (`window.reactRenderMetrics`).

```javascript
// Inside src/App.jsx or wrapping route components:
import React, { lazy, Suspense, Profiler } from 'react';

const logRenderMetrics = (id, phase, actualDuration, baseDuration) => {
  window.reactRenderMetrics = window.reactRenderMetrics || [];
  window.reactRenderMetrics.push({
    component: id,
    phase: phase,
    actualDuration: Math.round(actualDuration * 100) / 100, // round to 2 decimals
    baseDuration: Math.round(baseDuration * 100) / 100
  });
};

// Route wrapper implementation inside <Routes>:
<Route path="/" element={
  <Profiler id="Dashboard" onRender={logRenderMetrics}>
    <Dashboard />
  </Profiler>
} />
<Route path="/attack-path" element={
  <Profiler id="AttackPath" onRender={logRenderMetrics}>
    <AttackPath />
  </Profiler>
} />
<Route path="/posture" element={
  <Profiler id="MitreHeatmap" onRender={logRenderMetrics}>
    <Suspense fallback={<div>Loading...</div>}>
      <MitreHeatmap />
    </Suspense>
  </Profiler>
} />
```

### Step 5b: Profile Comparison Script (`compare_perf.js`)
We will create a Node script `compare_perf.js` that compares two output files (e.g. `perf_baseline.json` and `perf_optimized.json`) and outputs a clean comparison table:

```javascript
// compare_perf.js
const fs = require('fs');
const path = require('path');

const [,, baselineFile, optimizedFile] = process.argv;

if (!baselineFile || !optimizedFile) {
  console.log('Usage: node compare_perf.js <baseline.json> <optimized.json>');
  process.exit(1);
}

const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
const optimized = JSON.parse(fs.readFileSync(optimizedFile, 'utf8'));

console.log('\n===============================================================');
  console.log('             PERFORMANCE OPTIMIZATION COMPARISON               ');
  console.log('===============================================================');

function formatDiff(base, opt) {
  if (!base || !opt) return 'N/A';
  const pct = ((opt - base) / base) * 100;
  const sign = pct > 0 ? '+' : '';
  const status = pct <= 0 ? 'IMPROVED' : 'DEGRADED';
  return `${base}ms -> ${opt}ms (${sign}${pct.toFixed(2)}%) [${status}]`;
}

// 1. Compare page loading metrics
const bPerf = baseline.performance || {};
const oPerf = optimized.performance || {};

console.log('\n--- Web Performance Timings ---');
console.log(`Page Load Time      : ${formatDiff(bPerf.pageLoadTime, oPerf.pageLoadTime)}`);
console.log(`DOM Content Loaded  : ${formatDiff(bPerf.domContentLoaded, oPerf.domContentLoaded)}`);
console.log(`First Paint         : ${formatDiff(bPerf.firstPaint, oPerf.firstPaint)}`);
console.log(`First Content Paint : ${formatDiff(bPerf.firstContentfulPaint, oPerf.firstContentfulPaint)}`);

// 2. Compare React Render times (group by component and phase)
function compileRenderTimes(renders) {
  const summary = {};
  if (!renders) return summary;
  renders.forEach(r => {
    const key = `${r.component} (${r.phase})`;
    if (!summary[key]) {
      summary[key] = { total: 0, count: 0 };
    }
    summary[key].total += r.actualDuration;
    summary[key].count += 1;
  });
  
  // Calculate average
  const averages = {};
  for (const key in summary) {
    averages[key] = summary[key].total / summary[key].count;
  }
  return averages;
}

const bRenders = compileRenderTimes(bPerf.reactRenders);
const oRenders = compileRenderTimes(oPerf.reactRenders);

console.log('\n--- React Component Average Render Durations ---');
const allKeys = Array.from(new Set([...Object.keys(bRenders), ...Object.keys(oRenders)]));
allKeys.sort().forEach(key => {
  const baseAvg = bRenders[key] ? Math.round(bRenders[key] * 100) / 100 : null;
  const optAvg = oRenders[key] ? Math.round(oRenders[key] * 100) / 100 : null;
  console.log(`${key.padEnd(25)} : ${formatDiff(baseAvg, optAvg)}`);
});
console.log('===============================================================\n');
```

---

## 6. Implementation and Execution Roadmap

1. **Step 1: Code Modifications**
   - Inject the `<Profiler>` component wraps inside `src/App.jsx`.
   - Update `src/components/TestRunner.jsx` to parse the search params, auto-run on mount, compile metrics, and POST to the custom callback endpoint.
2. **Step 2: Script Placement**
   - Save the lightweight Node controller as `run_e2e.js` in the project root.
   - Save the comparison utility as `compare_perf.js` in the project root.
3. **Step 3: Baseline Benchmark Collection**
   - Execute: `node run_e2e.js --output=perf_baseline.json`
4. **Step 4: React Performance Optimization Pass**
   - Apply memoization hooks (`useMemo`, `useCallback`, `React.memo`) in views like `AttackPath.jsx`, `MitreHeatmap.jsx`, `Dashboard.jsx`, and `BattleGlobe.jsx`.
5. **Step 5: Optimized Benchmark Collection**
   - Execute: `node run_e2e.js --output=perf_optimized.json`
6. **Step 6: Comparative Analysis**
   - Execute: `node compare_perf.js perf_baseline.json perf_optimized.json` to verify improvement percentages.
