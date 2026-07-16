# Analysis Report: Automated E2E Test Runner & Performance Profiler Design (Milestone 5)

## Executive Summary
This report analyzes the existing `src/components/TestRunner.jsx` harness and designs an automated, dependency-free E2E test execution framework and performance profiler. The design requires zero external testing frameworks (such as Cypress, Puppeteer, or Playwright), utilizing native browser CLI commands and React integration to execute tests headlessly, collect assertions, profile performance, and clean up process trees.

---

## 1. Review of current `TestRunner.jsx` structure
`src/components/TestRunner.jsx` implements an E2E testing interface within the React app:
- **Test Definition**: It defines an array `testSuite` (lines 148–762) containing 13 test cases organized by tiers:
  - **Tier 1**: Environment & Config (1.1, 1.2, 1.3, 1.4)
  - **Tier 2**: Exercise & Campaign (2.1, 2.2, 2.3, 2.4)
  - **Tier 3**: MITRE & Gap Management (3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7)
  - **Tier 4**: AI Copilot & Stream Simulation (4.1, 4.2)
- **Execution Loop**: The function `runAllTests` (lines 778–842) resets the component state and loops through `testSuite` sequentially. It passes a mutable reference to the React Context (`contextRef.current`) and an assertion logger (`logAssertion`) to each test function, executing `await t.run(contextRef.current, logAssertion)` with a `300ms` delay between cases.
- **Context Dependencies**: The runner interacts directly with application state (`exercises`, `gaps`, `mitreData`). Because `mitreData` is fetched asynchronously on mount in `AppContext.jsx` (lines 273–387), any immediate test execution must account for this loading delay to prevent false negatives in Tier 3 tests.

---

## 2. Implementing Query Param Support (`?run=true`) on Mount
To trigger the tests automatically when the browser loads the test runner page:
1. **Query Detection**: Use the browser standard `URLSearchParams` on `window.location.search` to check for `run=true`.
2. **Loading Guard**: Ensure that `contextRef.current.isMitreLoading` is `false` before starting the suite. Since `isMitreLoading` changes asynchronously, we can poll for completion.
3. **Trigger**: Invoke `runAllTests()`.

### Proposed Code Block (inside `TestRunner.jsx`):
```javascript
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('run') === 'true') {
    const checkReadyAndRun = () => {
      // Ensure MITRE STIX data has finished downloading/loading in AppContext
      if (contextRef.current && !contextRef.current.isMitreLoading) {
        runAllTests();
      } else {
        setTimeout(checkReadyAndRun, 100);
      }
    };
    checkReadyAndRun();
  }
}, []);
```

---

## 3. Implementing POST Callback for Test Results
To transmit results to the controller script:
1. **Capture Test Results**: React state updates (`tests` state) are batched and asynchronous. We should accumulate the final test statuses and assertion logs into a local array or copy of the suite inside `runAllTests` as it runs.
2. **Collect Performance Data**: Gather Paint Timing and Navigation Timing parameters from the browser window.
3. **POST Payload**: Trigger a `fetch()` POST request to the callback URL (defaulting to `http://localhost:3001/api/results`) when the loop completes.

### Proposed Code Modifications in `runAllTests`:
At the start of `runAllTests`, we maintain a local results copy:
```javascript
const currentTests = testSuite.map(t => ({
  id: t.id,
  tier: t.tier,
  name: t.name,
  status: 'pending',
  assertions: []
}));
```
In the test loop, we update `currentTests[i].status` and `currentTests[i].assertions` alongside `setTests`.
At the end of the loop:
```javascript
// Calculate performance metrics
const performanceMetrics = (() => {
  const perf = window.performance;
  if (!perf) return null;
  const timing = perf.timing;
  const paint = perf.getEntriesByType('paint') || [];
  return {
    loadTime: timing.loadEventEnd - timing.navigationStart,
    domInteractive: timing.domInteractive - timing.navigationStart,
    firstPaint: Math.round(paint.find(e => e.name === 'first-paint')?.startTime || 0),
    firstContentfulPaint: Math.round(paint.find(e => e.name === 'first-contentful-paint')?.startTime || 0)
  };
})();

// Send callback POST
const params = new URLSearchParams(window.location.search);
const callbackUrl = params.get('callback') || 'http://localhost:3001/api/results';

try {
  await fetch(callbackUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      total: currentTests.length,
      passed: currentTests.filter(t => t.status === 'passed').length,
      failed: currentTests.filter(t => t.status === 'failed').length,
      tests: currentTests,
      performance: performanceMetrics
    })
  });
  addToast('Test results and performance metrics reported.', 'success');
} catch (err) {
  console.error('Failed to post results:', err);
}
```

---

## 4. Design of the Node Controller Script (`run_e2e.js`)
The `run_e2e.js` script coordinates starting the dev server, launching the browser, receiving the results, and stopping all processes.

### Key Components of `run_e2e.js`:
- **HTTP Server**: Uses the native Node.js `http` module to listen on port 3001. Handles CORS options preflight.
- **Vite Lifecycle**: Spawns `npx vite` as a child process. Monitors standard output for `http://localhost:5173` or `Local:` to determine when the dev server is active.
- **Browser Execution**: Detects Google Chrome or Microsoft Edge executable paths in standard Windows directory structures. Spawns the browser headlessly pointing to `http://localhost:5173/test-runner?run=true`.
- **Cleanup / Taskkill**: Terminate both Vite (using process tree kill) and Chrome/Edge.

### Proposed Structure for `run_e2e.js`:
```javascript
import http from 'http';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

let viteProcess = null;
let browserProcess = null;
let server = null;
let exited = false;

// Search for native Chrome or Edge executables on Windows
function findBrowser() {
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

function handleCleanup(exitCode) {
  if (exited) return;
  exited = true;
  console.log('\nCleaning up processes...');

  if (browserProcess) {
    console.log('Terminating browser...');
    browserProcess.kill();
  }

  if (viteProcess) {
    console.log('Terminating Vite dev server process tree...');
    // Kill process tree on Windows using taskkill
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', viteProcess.pid, '/f', '/t']);
    } else {
      viteProcess.kill();
    }
  }

  if (server) {
    server.close(() => {
      console.log(`Finished. Exiting with code: ${exitCode}`);
      process.exit(exitCode);
    });
  }
}

// 1. Start HTTP Callback server
server = http.createServer((req, res) => {
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
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        console.log('\n======================================');
        console.log('         E2E TEST RUN SUMMARY         ');
        console.log('======================================');
        console.log(`PASSED: ${payload.passed} / ${payload.total}`);
        console.log(`FAILED: ${payload.failed}`);
        
        console.log('\nDetailed Test Cases:');
        payload.tests.forEach(t => {
          console.log(`[${t.status.toUpperCase()}] ${t.id} - ${t.name}`);
        });

        if (payload.performance) {
          console.log('\nPerformance Profile:');
          console.log(`- Page Load Time:       ${payload.performance.loadTime} ms`);
          console.log(`- DOM Interactive:      ${payload.performance.domInteractive} ms`);
          console.log(`- First Paint:          ${payload.performance.firstPaint} ms`);
          console.log(`- First Contentful Paint: ${payload.performance.firstContentfulPaint} ms`);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'success' }));
        
        handleCleanup(payload.failed === 0 ? 0 : 1);
      } catch (err) {
        console.error('Error parsing test payload:', err);
        res.writeHead(400);
        res.end();
        handleCleanup(1);
      }
    });
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(3001, () => {
  console.log('Listening for E2E callback results on http://localhost:3001');
  
  // 2. Start Vite Dev Server
  viteProcess = spawn('npx', ['vite'], { shell: true });
  
  viteProcess.stdout.on('data', data => {
    const output = data.toString();
    if (output.includes('Local:') || output.includes('localhost:5173')) {
      console.log('Vite dev server is ready. Launching headless browser...');
      
      // 3. Launch Headless Browser
      const browserPath = findBrowser();
      if (!browserPath) {
        console.error('Failure: Chrome or Edge browser executable not found.');
        handleCleanup(1);
        return;
      }
      
      const args = [
        '--headless',
        '--disable-gpu',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        'http://localhost:5173/test-runner?run=true'
      ];
      browserProcess = spawn(browserPath, args);

      // Fail-safe timeout in case of infinite loop / hang (60 seconds)
      setTimeout(() => {
        console.error('Error: E2E Run timed out after 60 seconds.');
        handleCleanup(1);
      }, 60000);
    }
  });
});
```

---

## 5. Performance Profiling Metrics & Benchmarking
To benchmark rendering efficiency before and after application optimizations (e.g. memoizing components, disposing of Three.js assets):

### A. Key Metrics Collected
- **Page Load Time (`loadTime`)**: Total duration to fully load resources.
- **DOM Interactive (`domInteractive`)**: Time until the HTML is fully parsed and interactive (good indicator of bundle size and parse speed).
- **First Paint (`firstPaint`)**: Point at which the browser renders the first pixel.
- **First Contentful Paint (`firstContentfulPaint`)**: Point at which the browser renders the first piece of DOM content (text, image, canvas).

### B. Benchmarking Script Design
We can extend `run_e2e.js` to log these metrics to a JSON log file:
1. Append results to `performance_log.json`.
2. Structure of the log entry:
   ```json
   {
     "timestamp": "2026-06-14T18:16:20Z",
     "gitCommit": "optional_git_hash",
     "metrics": {
       "loadTime": 842,
       "domInteractive": 451,
       "firstPaint": 210,
       "firstContentfulPaint": 212
     }
   }
   ```
3. A separate comparison utility (`compare_perf.js`) can read the performance history, calculate the percentage delta between runs, and output a markdown benchmark report, verifying whether optimizations successfully decreased paint and interactive times.
