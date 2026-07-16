import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
        results = results.concat(walk(file));
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
        results.push(file);
    }
  });
  return results;
}

const files = walk('./src');

files.forEach(f => {
    let content = fs.readFileSync(f, 'utf8');
    let original = content;
    
    // Perform safe replacements
    content = content.replace(/Campaign/g, 'Simulation');
    content = content.replace(/campaign/g, 'simulation');
    content = content.replace(/CAMPAIGN/g, 'SIMULATION');

    if (content !== original) {
        fs.writeFileSync(f, content, 'utf8');
        console.log(`Updated Text: ${f}`);
    }
});

// Rename the physical file
const oldPath = path.join(__dirname, 'src', 'components', 'SimulationTracker.jsx'); 
const origPath = path.join(__dirname, 'src', 'components', 'CampaignTracker.jsx');

if (fs.existsSync(origPath)) {
    fs.renameSync(origPath, oldPath);
    console.log(`Renamed: CampaignTracker.jsx -> SimulationTracker.jsx`);
}

console.log('Refactor complete!');
