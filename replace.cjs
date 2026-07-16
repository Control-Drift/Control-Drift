const fs = require('fs');
const path = require('path');
function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else {
            if (file.endsWith('.js') || file.endsWith('.jsx')) results.push(file);
        }
    });
    return results;
}
const files = walk('C:\\\\Users\\\\thoma\\\\.gemini\\\\antigravity\\\\scratch\\\\eclipse-ops\\\\src');
files.forEach(f => {
    let content = fs.readFileSync(f, 'utf8');
    if (content.includes('Prevented (No Alert)')) {
        let newContent = content.replace(/Prevented \(No Alert\)/g, 'Prevented');
        // Fix any duplicate 'Prevented' checking
        newContent = newContent.replace(/out === 'Prevented' \|\| out === 'Prevented'/g, "out === 'Prevented'");
        newContent = newContent.replace(/cleaned === 'Prevented' \|\| cleaned === 'Prevented'/g, "cleaned === 'Prevented'");
        newContent = newContent.replace(/cleanStr === 'Prevented' \|\| cleanStr === 'Prevented'/g, "cleanStr === 'Prevented'");
        newContent = newContent.replace(/p\.outcome === 'Prevented' \|\| p\.outcome === 'Prevented'/g, "p.outcome === 'Prevented'");
        newContent = newContent.replace(/safeOutcome = safeOutcome\.replace\('Prevented', 'Prevented'\);/g, "");
        
        fs.writeFileSync(f, newContent);
        console.log('Updated ' + f);
    }
});
