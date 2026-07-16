const fs = require('fs');
const path = require('path');
const dirs = ['pages', 'dropdowns', 'ui', 'features'];
dirs.forEach(dir => {
    const dirPath = path.join('src', 'components', dir);
    if (!fs.existsSync(dirPath)) return;
    const files = fs.readdirSync(dirPath);
    files.forEach(file => {
        if (!file.endsWith('.jsx')) return;
        const filePath = path.join(dirPath, file);
        let content = fs.readFileSync(filePath, 'utf8');
        let changed = false;
        
        // Find imports that start with './../' and fix them to '../../'
        content = content.replace(/from\s+['"]\.\/\.\.\/([^'"]+)['"]/g, (match, p1) => {
            changed = true;
            return `from '../../${p1}'`;
        });
        
        if (changed) {
            fs.writeFileSync(filePath, content);
            console.log('Fixed ./../ imports in', filePath);
        }
    });
});
