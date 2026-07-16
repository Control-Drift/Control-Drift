const fs = require('fs');
const path = require('path');

const progressPath = 'C:/Users/thoma/.gemini/antigravity/scratch/eclipse-ops/.agents/orchestrator_stress_test_1/progress.md';

if (fs.existsSync(progressPath)) {
  const stat = fs.statSync(progressPath);
  const ageSeconds = (Date.now() - stat.mtimeMs) / 1000;
  console.log(JSON.stringify({
    exists: true,
    mtime: stat.mtime.toISOString(),
    ageSeconds: ageSeconds,
    stale: ageSeconds > (20 * 60) // 20 minutes
  }, null, 2));
} else {
  console.log(JSON.stringify({
    exists: false,
    stale: true
  }, null, 2));
}
