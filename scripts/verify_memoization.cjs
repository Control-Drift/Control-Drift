const fs = require('fs');
const path = require('path');

const filesToCheck = [
    'src/AppContext.jsx',
    'src/components/Dashboard.jsx',
    'src/components/AttackPath.jsx',
    'src/components/MitreHeatmap.jsx',
    'src/components/GapTracker.jsx'
];

const patterns = {
    useMemo: /useMemo\s*\(/g,
    useCallback: /useCallback\s*\(/g,
    memo: /(?:React\.)?memo\s*\(/g
};

let allPassed = true;
const results = [];

console.log('=== React Memoization Structure Verification ===');

filesToCheck.forEach(relativePath => {
    const absolutePath = path.resolve(__dirname, relativePath);
    if (!fs.existsSync(absolutePath)) {
        console.error(`Error: File does not exist at ${absolutePath}`);
        allPassed = false;
        results.push({ file: relativePath, exists: false });
        return;
    }

    const content = fs.readFileSync(absolutePath, 'utf8');
    const fileResult = {
        file: relativePath,
        exists: true,
        useMemoCount: (content.match(patterns.useMemo) || []).length,
        useCallbackCount: (content.match(patterns.useCallback) || []).length,
        memoCount: (content.match(patterns.memo) || []).length
    };

    const hasMemoization = fileResult.useMemoCount > 0 || fileResult.useCallbackCount > 0 || fileResult.memoCount > 0;
    
    if (!hasMemoization) {
        allPassed = false;
    }
    results.push(fileResult);
});

// Print results in a neat format
console.log('\nResults:');
results.forEach(res => {
    if (!res.exists) {
        console.log(`[FAIL] ${res.file} - File not found!`);
        return;
    }
    const hasMemo = res.useMemoCount > 0 || res.useCallbackCount > 0 || res.memoCount > 0;
    const status = hasMemo ? 'PASS' : 'FAIL';
    console.log(`[${status}] ${res.file}`);
    console.log(`       - useMemo calls: ${res.useMemoCount}`);
    console.log(`       - useCallback calls: ${res.useCallbackCount}`);
    console.log(`       - memo/React.memo wraps: ${res.memoCount}`);
});

if (allPassed) {
    console.log('\n[SUCCESS] All target files successfully verified to contain React memoization structures.');
    process.exit(0);
} else {
    console.error('\n[FAILURE] One or more target files do not contain React memoization structures or do not exist.');
    process.exit(1);
}
