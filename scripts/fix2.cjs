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
        
        // Find imports that start with '../../pages', '../../ui', etc and fix them to '../pages', '../ui'
        const regex = /from\s+['"]\.\.\/\.\.\/(pages|dropdowns|ui|features)\/([^'"]+)['"]/g;
        content = content.replace(regex, (match, folder, component) => {
            changed = true;
            return `from '../${folder}/${component}'`;
        });
        
        if (changed) {
            fs.writeFileSync(filePath, content);
            console.log('Fixed over-corrected imports in', filePath);
        }
    });
});
