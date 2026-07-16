const fs = require('fs');
const path = require('path');

const fileMap = {
    pages: [
        'Dashboard', 'Reports', 'Settings', 'GapTracker', 
        'RuleStudio', 'MitreHeatmap', 'ExerciseWizard', 'TestRunner'
    ],
    dropdowns: [
        'CoverageRatingDropdown', 'EnvironmentDropdown', 'EventTTPDropdown', 
        'EventTypeDropdown', 'InlineEnvironmentDropdown', 'InlineTagDropdown', 
        'OutcomeDropdown', 'SecurityControlFilterDropdown', 'SecurityControlsDropdown', 
        'SeverityDropdown', 'TagDropdown', 'ValidationOutcomeDropdown'
    ],
    ui: [
        'AuthOverlay', 'AuthScreen', 'CommandPalette', 'CustomIcons', 
        'CustomLogo', 'ErrorBoundary', 'ParticleBackground', 'SpaceBackground', 
        'Toast', 'UnifiedPosturePill', 'EventCard', 'MarkdownEditor', 
        'MarkdownRenderer', 'RichMarkdownEditor'
    ],
    features: [
        'AIAssistant', 'AttackPath', 'BattleGlobe', 'GapDetails', 
        'ReportPDF', 'TTPSelector'
    ]
};

const componentLocations = {};
Object.keys(fileMap).forEach(dir => {
    fileMap[dir].forEach(basename => {
        componentLocations[basename] = dir;
    });
});

const testsDir = path.join(__dirname, 'src', '__tests__');
const files = fs.readdirSync(testsDir);

files.forEach(file => {
    if (!file.endsWith('.js') && !file.endsWith('.jsx')) return;
    const filePath = path.join(testsDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    // Match vi.mock('../components/Something' ... ) or jest.mock('../components/Something')
    const regex = /(vi|jest)\.mock\(\s*['"]\.\.\/components\/([^'"]+)['"]/g;
    content = content.replace(regex, (match, prefix, compPath) => {
        // compPath might be 'Toast.jsx' or 'Toast'
        const basename = compPath.replace(/\.jsx?$/, '');
        const dir = componentLocations[basename];
        if (dir) {
            changed = true;
            return `${prefix}.mock('../components/${dir}/${compPath}'`;
        }
        return match;
    });

    if (changed) {
        fs.writeFileSync(filePath, content);
        console.log('Fixed vi.mock in', filePath);
    }
});
