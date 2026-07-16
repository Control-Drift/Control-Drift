const fs = require('fs');
const path = require('path');

const fileMap = {
    pages: [
        'Dashboard.jsx', 'Reports.jsx', 'Settings.jsx', 'GapTracker.jsx', 
        'RuleStudio.jsx', 'MitreHeatmap.jsx', 'ExerciseWizard.jsx', 'TestRunner.jsx'
    ],
    dropdowns: [
        'CoverageRatingDropdown.jsx', 'EnvironmentDropdown.jsx', 'EventTTPDropdown.jsx', 
        'EventTypeDropdown.jsx', 'InlineEnvironmentDropdown.jsx', 'InlineTagDropdown.jsx', 
        'OutcomeDropdown.jsx', 'SecurityControlFilterDropdown.jsx', 'SecurityControlsDropdown.jsx', 
        'SeverityDropdown.jsx', 'TagDropdown.jsx', 'ValidationOutcomeDropdown.jsx'
    ],
    ui: [
        'AuthOverlay.jsx', 'AuthScreen.jsx', 'CommandPalette.jsx', 'CustomIcons.jsx', 
        'CustomLogo.jsx', 'ErrorBoundary.jsx', 'ParticleBackground.jsx', 'SpaceBackground.jsx', 
        'Toast.jsx', 'UnifiedPosturePill.jsx', 'EventCard.jsx', 'MarkdownEditor.jsx', 
        'MarkdownRenderer.jsx', 'RichMarkdownEditor.jsx'
    ],
    features: [
        'AIAssistant.jsx', 'AttackPath.jsx', 'BattleGlobe.jsx', 'GapDetails.jsx', 
        'ReportPDF.jsx', 'TTPSelector.jsx'
    ]
};

// Create directories
const componentsDir = path.join(__dirname, 'src', 'components');
Object.keys(fileMap).forEach(dir => {
    const dirPath = path.join(componentsDir, dir);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
});

// Build a lookup map: componentFilename -> newRelativePath (e.g., 'pages/Dashboard')
const componentLocations = {};
Object.keys(fileMap).forEach(dir => {
    fileMap[dir].forEach(file => {
        const basename = file.replace(/\.jsx?$/, '');
        componentLocations[basename] = `${dir}/${basename}`;
    });
});

// Step 1: Move the files
Object.keys(fileMap).forEach(dir => {
    fileMap[dir].forEach(file => {
        const oldPath = path.join(componentsDir, file);
        const newPath = path.join(componentsDir, dir, file);
        if (fs.existsSync(oldPath)) {
            fs.renameSync(oldPath, newPath);
            console.log(`Moved ${file} to ${dir}`);
        }
    });
});

// We need to update imports across the codebase.
// 1. Files inside src/components/*/*.jsx
// 2. Files inside src/components/*.jsx (if any remain)
// 3. Files inside src/*.jsx (App, main, etc.)
// 4. Files inside src/hooks/*.js
// 5. Files inside src/__tests__/*.js

function getNewImportPath(importerPath, targetComponent) {
    // Both absolute paths
    const importerDir = path.dirname(importerPath);
    const targetDir = path.join(componentsDir, path.dirname(componentLocations[targetComponent]));
    
    let relative = path.relative(importerDir, targetDir).replace(/\\/g, '/');
    if (!relative.startsWith('.')) {
        relative = './' + relative;
    }
    return `${relative}/${targetComponent}`;
}

function processFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
        const children = fs.readdirSync(filePath);
        for (const child of children) {
            processFile(path.join(filePath, child));
        }
    } else if (stat.isFile() && /\.(jsx?)$/.test(filePath)) {
        // Don't process node_modules or dist
        if (filePath.includes('node_modules') || filePath.includes('dist')) return;
        
        let content = fs.readFileSync(filePath, 'utf8');
        let changed = false;

        // Regex to find all imports: import ... from '...';
        // Match standard relative imports that might point to components
        // e.g. import Dashboard from './Dashboard';
        // e.g. import Dashboard from './components/Dashboard';
        // e.g. import Dashboard from '../components/Dashboard';

        const importRegex = /from\s+['"]([^'"]+)['"]/g;
        content = content.replace(importRegex, (match, importPath) => {
            // Does this import path point to one of our migrated components?
            // Let's resolve the import path against the file's directory
            const absoluteImportPath = path.resolve(path.dirname(filePath), importPath);
            
            // Check if it resolves to something in src/components
            if (absoluteImportPath.startsWith(componentsDir)) {
                // Get the basename (e.g. Dashboard)
                const basename = path.basename(absoluteImportPath);
                if (componentLocations[basename]) {
                    // It's a migrated component!
                    const newImportPath = getNewImportPath(filePath, basename);
                    changed = true;
                    return `from '${newImportPath}'`;
                }
            }
            return match;
        });
        
        // Also support dynamic imports e.g. React.lazy(() => import('./Dashboard'))
        const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
        content = content.replace(dynamicImportRegex, (match, importPath) => {
            const absoluteImportPath = path.resolve(path.dirname(filePath), importPath);
            if (absoluteImportPath.startsWith(componentsDir)) {
                const basename = path.basename(absoluteImportPath);
                if (componentLocations[basename]) {
                    const newImportPath = getNewImportPath(filePath, basename);
                    changed = true;
                    return `import('${newImportPath}')`;
                }
            }
            return match;
        });

        if (changed) {
            fs.writeFileSync(filePath, content);
            console.log(`Updated imports in ${filePath}`);
        }
    }
}

// Process the whole src directory
processFile(path.join(__dirname, 'src'));
