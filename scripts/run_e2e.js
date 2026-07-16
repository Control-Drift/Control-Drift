import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';

if (process.platform === 'win32') {
  process.env.PATH = `${process.env.PATH};C:\\Program Files\\nodejs`;
}

let viteProcess = null;
let browserProcess = null;
let dbProcess = null;

const TIMEOUT_MS = 60000;
const globalTimeout = setTimeout(() => {
  console.error(`E2E tests timed out after ${TIMEOUT_MS / 1000}s!`);
  shutdown(1);
}, TIMEOUT_MS);

function findBrowser() {
  const paths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ];

  for (const p of paths) {
    if (p && fs.existsSync(p)) {
      console.log(`Found browser executable at: ${p}`);
      return p;
    }
  }

  console.log('No local Windows browser installation found, falling back to "google-chrome"');
  return 'google-chrome';
}

function shutdown(exitCode) {
  console.log(`Shutting down with exit code ${exitCode}...`);

  const pidsToKill = [];
  if (browserProcess && browserProcess.pid) {
    pidsToKill.push(browserProcess.pid);
  }
  if (viteProcess && viteProcess.pid) {
    pidsToKill.push(viteProcess.pid);
  }
  if (dbProcess && dbProcess.pid) {
    pidsToKill.push(dbProcess.pid);
  }

  if (pidsToKill.length > 0) {
    pidsToKill.forEach(pid => {
      try {
        console.log(`Killing process tree for PID ${pid}...`);
        spawn('taskkill', ['/pid', pid.toString(), '/T', '/F'], { shell: true });
      } catch (err) {
        console.error(`Failed to kill process tree for PID ${pid}:`, err);
      }
    });
  }

  setTimeout(() => {
    server.close(() => {
      console.log('Server closed. Exiting.');
      process.exit(exitCode);
    });
  }, 1000);
}

function handleResults(payload) {
  clearTimeout(globalTimeout);

  const { summary, results, performance } = payload;

  console.log('\n==================================================');
  console.log('E2E TEST RUN RESULTS SUMMARY');
  console.log('==================================================');
  console.log(`Total Tests:  ${summary.total}`);
  console.log(`Passed:       ${summary.passed}`);
  console.log(`Failed:       ${summary.failed}`);
  console.log('==================================================\n');

  console.log('DETAILED TEST RESULTS AND ASSERTIONS:');
  let currentTier = '';
  if (results && Array.isArray(results)) {
    results.forEach(test => {
      if (test.tier !== currentTier) {
        currentTier = test.tier;
        console.log(`\n--- ${currentTier} ---`);
      }
      const statusIcon = test.status === 'passed' ? '✓' : '✗';
      console.log(` [${test.status.toUpperCase()}] ${statusIcon} ${test.id}: ${test.name}`);
      if (test.assertions && Array.isArray(test.assertions)) {
        test.assertions.forEach(assertion => {
          const assertIcon = assertion.passed ? '  ✓' : '  ✗';
          console.log(`${assertIcon} ${assertion.msg}`);
        });
      }
    });
  }

  console.log('\n==================================================');
  console.log('PERFORMANCE METRICS');
  console.log('==================================================');
  console.log(`Load Time:                  ${performance.loadTimeMs} ms`);
  console.log(`DOM Content Loaded Time:    ${performance.domContentLoadedMs} ms`);
  console.log(`First Paint:                ${performance.firstPaintMs} ms`);
  console.log(`First Contentful Paint:     ${performance.firstContentfulPaintMs} ms`);
  console.log(`JS Heap Size:               ${performance.usedJSHeapSizeMb} MB`);
  console.log('==================================================\n');

  const perfLogPath = path.join(process.cwd(), 'perf_log.json');
  let logs = [];
  if (fs.existsSync(perfLogPath)) {
    try {
      logs = JSON.parse(fs.readFileSync(perfLogPath, 'utf8'));
    } catch (e) {
      console.error('Error reading existing perf_log.json, resetting log:', e);
    }
  }

  const logEntry = {
    timestamp: new Date().toISOString(),
    ...performance
  };
  logs.push(logEntry);
  fs.writeFileSync(perfLogPath, JSON.stringify(logs, null, 2), 'utf8');
  console.log(`Performance metrics appended to ${perfLogPath}`);

  const exitCode = summary.failed > 0 || summary.passed === 0 ? 1 : 0;
  shutdown(exitCode);
}

const server = http.createServer((req, res) => {
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
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
        handleResults(payload);
      } catch (err) {
        console.error('Error parsing JSON payload:', err);
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Invalid JSON');
      }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(3002, '127.0.0.1', () => {
  console.log('HTTP Callback server listening on port 3002');

  // Spawn Mock DB server
  console.log('Spawning Mock DB server on port 3001...');
  dbProcess = spawn('node', ['mock_database.js'], { shell: true, cwd: process.cwd() });
  dbProcess.stdout.on('data', (data) => {
    console.log('[DB stdout]', data.toString().trim());
  });
  dbProcess.stderr.on('data', (data) => {
    console.error('[DB stderr]', data.toString().trim());
  });

  // Spawn Vite dev server
  console.log('Spawning Vite dev server on port 5173...');
  viteProcess = spawn('npx', ['vite', '--port', '5173', '--host', '127.0.0.1'], { shell: true, cwd: process.cwd() });

  let viteReady = false;
  let accumulatedOutput = '';
  viteProcess.stdout.on('data', (data) => {
    const chunkStr = data.toString();
    accumulatedOutput += chunkStr;
    console.log('[Vite stdout]', chunkStr.trim());
    
    if (!viteReady) {
      const cleanOutput = accumulatedOutput.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
      const match = cleanOutput.match(/http:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):(\d+)/i);
      if (match) {
        viteReady = true;
        const port = match[1];
        console.log(`Detected Vite dev server is running on port ${port}.`);
        
        // Launch browser
        const browserPath = findBrowser();
        const tempProfileDir = path.join(os.tmpdir(), 'chrome-e2e-profile-static');
        try {
          if (fs.existsSync(tempProfileDir)) {
            fs.rmSync(tempProfileDir, { recursive: true, force: true });
            console.log(`Cleaned up temporary profile directory: ${tempProfileDir}`);
          }
        } catch (e) {
          console.error(`Failed to clean up temp profile directory: ${e.message}`);
        }
        const args = [
          '--headless=new',
          '--disable-gpu',
          '--no-sandbox',
          '--remote-debugging-port=0',
          '--enable-logging',
          '--log-level=0',
          `--user-data-dir=${tempProfileDir}`,
          `http://127.0.0.1:${port}/test-runner?run=true&callback=http://127.0.0.1:3002/api/results`
        ];
        console.log(`Launching browser targeting port ${port}: ${browserPath}`);
        browserProcess = spawn(browserPath, args, { shell: false });

        browserProcess.on('error', (err) => {
          console.error('Failed to start browser process:', err);
          shutdown(1);
        });

        browserProcess.stdout.on('data', (data) => {
          console.log('[Browser stdout]', data.toString().trim());
        });

        browserProcess.stderr.on('data', (data) => {
          console.log('[Browser stderr]', data.toString().trim());
        });
      }
    }
  });

  viteProcess.stderr.on('data', (data) => {
    console.error('[Vite stderr]', data.toString().trim());
  });

  viteProcess.on('error', (err) => {
    console.error('Failed to start Vite process:', err);
    shutdown(1);
  });
});
