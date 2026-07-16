const fs = require('fs');
const path = require('path');

const rootDir = 'C:/Users/thoma/.gemini/antigravity/scratch/eclipse-ops';
const excludes = ['node_modules', '.git', '.agents'];

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    if (excludes.some(ex => filePath.includes(ex))) {
      continue;
    }
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      results = results.concat(walk(filePath));
    } else {
      results.push({ path: filePath, mtime: stat.mtimeMs });
    }
  }
  return results;
}

try {
  const allFiles = walk(rootDir);
  allFiles.sort((a, b) => b.mtime - a.mtime);
  const top5 = allFiles.slice(0, 5);

  console.log(JSON.stringify(top5.map(f => {
    // Read first 30 lines of each file
    let content = '';
    try {
      const text = fs.readFileSync(f.path, 'utf8');
      content = text.split('\n').slice(0, 30).join('\n');
    } catch (e) {
      content = `Error reading file: ${e.message}`;
    }
    return {
      path: f.path,
      mtime: new Date(f.mtime).toISOString(),
      content: content
    };
  }), null, 2));
} catch (e) {
  console.error(e);
}
