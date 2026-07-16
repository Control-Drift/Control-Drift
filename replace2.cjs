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
    if (content.match(/prevented \(no alert\)/i)) {
        let newContent = content.replace(/prevented \(no alert\)/ig, 'prevented');
        // Fix any duplicate 'prevented' checking
        newContent = newContent.replace(/out\.toLowerCase\(\) === 'prevented' \|\| out\.toLowerCase\(\) === 'prevented'/g, "out.toLowerCase() === 'prevented'");
        newContent = newContent.replace(/statusLower === 'prevented' \|\| statusLower === 'prevented'/g, "statusLower === 'prevented'");
        
        fs.writeFileSync(f, newContent);
        console.log('Updated ' + f);
    }
});
