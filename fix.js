const fs = require('fs');
const content = fs.readFileSync('src/index.css', 'utf8');
const lines = content.split('\n');

// We want to delete from the duplicate `@media (max-width: 768px)`
// down to the line BEFORE `/* Small Desktop / Tablet Landscape Breakpoint for Heatmap */` which is around 1174
// Let's find the first index of `/* Reports Grid Layout */` and `::-webkit-scrollbar` etc and delete them.
// Actually, let's just find the duplicate `@media (max-width: 768px) {` which is around line 959.
// And the CORRECT `/* Small Desktop / Tablet Landscape Breakpoint for Heatmap */` which is around line 1174.

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
    // the lines to keep BEFORE startIdx:
    const before = lines.slice(0, startIdx);
    
    // We need to add the closing braces for the previous media query (max-width: 1600px)
    // The original file had:
    //   .hidden-on-mobile-tactic {
    //     display: none !important;
    //   }
    // }
    // Wait, no. Before the hallucinated `@media (max-width: 768px)`, what was there?
    // Let's look at `index.css` line 950-958.
    // 950: @media (min-width: 1600px) {
    // 951:   .ttp-modal {
    // 952:     max-width: 850px;
    // 953:   }
    // 954: }
    // So line 954 is `}`. Then blank lines.
    // We just want to DELETE from startIdx to endIdx - 1.
    
    const after = lines.slice(endIdx); // from 1174 onwards
    
    const newLines = [...before, ...after];
    fs.writeFileSync('src/index.css', newLines.join('\n'), 'utf8');
    console.log('Fixed index.css: deleted from ' + startIdx + ' to ' + (endIdx - 1));
} else {
    console.log('Could not find indices', startIdx, endIdx);
}
