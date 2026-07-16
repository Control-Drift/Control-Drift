const fs = require('fs');
const content = fs.readFileSync('src/index.css', 'utf8');
const lines = content.split('\n');

let startIdx = -1;
let endIdx = -1;

for (let i = 800; i < lines.length; i++) {
    if (startIdx === -1 && lines[i].includes('@media (max-width: 768px) {')) {
        startIdx = i; // Line 959
    }
    if (startIdx !== -1 && i > startIdx + 10 && lines[i].includes('/* Small Desktop / Tablet Landscape Breakpoint for Heatmap */')) {
        endIdx = i; // Line 1174
        break;
    }
}

if (startIdx !== -1 && endIdx !== -1) {
    const before = lines.slice(0, startIdx);
    const after = lines.slice(endIdx);
    const newLines = [...before, ...after];
    fs.writeFileSync('src/index.css', newLines.join('\n'), 'utf8');
    console.log('Fixed index.css: deleted from ' + startIdx + ' to ' + (endIdx - 1));
} else {
    console.log('Could not find indices', startIdx, endIdx);
}
