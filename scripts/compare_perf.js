import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const perfLogPath = fs.existsSync(path.join(process.cwd(), 'perf_log.json'))
  ? path.join(process.cwd(), 'perf_log.json')
  : path.join(__dirname, 'perf_log.json');


if (!fs.existsSync(perfLogPath)) {
  console.log('Error: perf_log.json not found. Run E2E tests first.');
  process.exit(1);
}

let logs = [];
try {
  logs = JSON.parse(fs.readFileSync(perfLogPath, 'utf8'));
} catch (e) {
  console.error('Error reading perf_log.json:', e);
  process.exit(1);
}

if (logs.length < 2) {
  console.log(`Found ${logs.length} performance run(s). Need at least 2 runs to compare.`);
  process.exit(0);
}

const before = logs[logs.length - 2];
const after = logs[logs.length - 1];

console.log('\n==================================================');
console.log('PERFORMANCE REGRESSION COMPARISON REPORT');
console.log('==================================================');
console.log(`Baseline run:  ${before.timestamp}`);
console.log(`Current run:   ${after.timestamp}`);
console.log('==================================================\n');

const metrics = [
  { name: 'Load Time', key: 'loadTimeMs', unit: 'ms' },
  { name: 'DOM Content Loaded', key: 'domContentLoadedMs', unit: 'ms' },
  { name: 'First Paint', key: 'firstPaintMs', unit: 'ms' },
  { name: 'First Contentful Paint', key: 'firstContentfulPaintMs', unit: 'ms' },
  { name: 'Used JS Heap Size', key: 'usedJSHeapSizeMb', unit: 'MB' }
];

// Simple padding helper
function pad(str, length) {
  str = String(str);
  if (str.length >= length) return str;
  const spaces = ' '.repeat(length - str.length);
  return str + spaces;
}

console.log(
  pad('Metric', 25) +
  pad('Before', 12) +
  pad('After', 12) +
  pad('Delta', 12) +
  'Change %'
);
console.log('-'.repeat(70));

metrics.forEach(m => {
  const vBefore = before[m.key] !== undefined ? before[m.key] : 0;
  const vAfter = after[m.key] !== undefined ? after[m.key] : 0;
  const delta = vAfter - vBefore;
  
  let pct = 0;
  if (vBefore !== 0) {
    pct = (delta / vBefore) * 100;
  }
  
  const pctStr = pct === 0 ? '0.00%' : `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%`;
  const deltaStr = `${delta > 0 ? '+' : ''}${delta.toFixed(m.key === 'usedJSHeapSizeMb' ? 2 : 0)} ${m.unit}`;
  
  // Green for improvement (negative delta), Red for regression (positive delta)
  let color = '\x1b[0m'; // Reset
  if (delta < 0) {
    color = '\x1b[32m'; // Green
  } else if (delta > 0) {
    color = '\x1b[31m'; // Red
  }
  
  const formattedBefore = `${vBefore} ${m.unit}`;
  const formattedAfter = `${vAfter} ${m.unit}`;
  
  console.log(
    pad(m.name, 25) +
    pad(formattedBefore, 12) +
    pad(formattedAfter, 12) +
    color + pad(deltaStr, 12) +
    pad(pctStr, 10) + '\x1b[0m'
  );
});

console.log('\n==================================================\n');
