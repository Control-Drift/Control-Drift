const fs = require('fs');
const path = require('path');

function replaceInFiles(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (file === 'node_modules' || file === '.git' || file === 'dist' || file === 'replace.js') continue;
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            replaceInFiles(fullPath);
        } else if (stat.isFile()) {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (//i.test(content)) {
                console.log('Replacing in', fullPath);
                const newContent = content
                    .replace(//g, '')
                    .replace(//g, '')
                    .replace(//g, '');
                fs.writeFileSync(fullPath, newContent);
            }
        }
    }
}
replaceInFiles('.');
