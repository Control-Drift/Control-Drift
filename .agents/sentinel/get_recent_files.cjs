const fs = require('fs');
const path = require('path');

const rootDir = 'C:/Users/thoma/.gemini/antigravity/scratch/eclipse-ops';
const excludes = ['node_modules', '.git', '.agents', 'dist'];

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

  const data = top5.map(f => {
    let content = '';
    try {
      const text = fs.readFileSync(f.path, 'utf8');
      const lines = text.split('\n').slice(0, 30);
      content = lines.map(line => line.substring(0, 200)).join('\n');
      if (content.length > 5000) {
        content = content.substring(0, 5000) + '... [TRUNCATED]';
      }
    } catch (e) {
      content = `Error reading file: ${e.message}`;
    }
    return {
      path: f.path,
      mtime: new Date(f.mtime).toISOString(),
      content: content
    };
  });

  fs.writeFileSync('C:/Users/thoma/.gemini/antigravity/scratch/eclipse-ops/.agents/sentinel/recent_files_output.json', JSON.stringify(data, null, 2), 'utf8');
} catch (e) {
  console.error(e);
}
