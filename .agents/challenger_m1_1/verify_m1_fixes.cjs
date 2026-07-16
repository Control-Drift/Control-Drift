// verify_m1_fixes.cjs - Empirical test harness for Iridescence Milestone 1 bugs
const fs = require('fs');
const path = require('path');

console.log("=== RUNNING MILESTONE 1 BUG FIX VERIFICATION ===");

const appContextPath = path.resolve(__dirname, '..', '..', 'src', 'AppContext.jsx');
const dashboardPath = path.resolve(__dirname, '..', '..', 'src', 'components', 'Dashboard.jsx');
const wizardPath = path.resolve(__dirname, '..', '..', 'src', 'components', 'ExerciseWizard.jsx');

const appContextContent = fs.readFileSync(appContextPath, 'utf8');
const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
const wizardContent = fs.readFileSync(wizardPath, 'utf8');

// Global test variables
let passedTests = 0;
let totalTests = 0;

function assert(description, condition) {
    totalTests++;
    if (condition) {
        console.log(`[PASS] ${description}`);
        passedTests++;
    } else {
        console.error(`[FAIL] ${description}`);
    }
}

// ----------------------------------------------------
// BUG-01 & BUG-02: recalculateMitreStatuses & applyExercises
// ----------------------------------------------------
console.log("\n--- Verifying BUG-01 & BUG-02 (MITRE Rollups & Ex Overwrite) ---");

// Extract recalculateMitreStatuses
const startRecalc = appContextContent.indexOf('const recalculateMitreStatuses =');
const endRecalc = appContextContent.indexOf('export const useAppContext =');
if (startRecalc === -1 || endRecalc === -1) {
    console.error("FAIL: Could not locate recalculateMitreStatuses in AppContext.jsx");
    process.exit(1);
}
let recalcCode = appContextContent.substring(startRecalc, endRecalc);
// Remove any "export" if present
recalcCode = recalcCode.replace(/export\s+/, '');

// Extract applyExercises
const startApply = appContextContent.indexOf('const applyExercises = (baseMitre) => {');
const endApply = appContextContent.indexOf('const cachedStr = localStorage.getItem(\'mitre_data_v2\');');
if (startApply === -1 || endApply === -1) {
    console.error("FAIL: Could not locate applyExercises in AppContext.jsx");
    process.exit(1);
}
let applyCode = appContextContent.substring(startApply, endApply);
const lastClosingBrace = applyCode.lastIndexOf('};');
applyCode = applyCode.substring(0, lastClosingBrace + 2);

// Mock localStorage on global scope
global.localStorage = {
    store: {},
    getItem(key) { return this.store[key] || null; },
    setItem(key, val) { this.store[key] = String(val); }
};

// Evaluate the functions in the sandbox scope
const evalContext = `
    ${recalcCode}
    ${applyCode}
    
    // Export to outer scope
    global.recalculateMitreStatuses = recalculateMitreStatuses;
    global.applyExercises = applyExercises;
`;

try {
    eval(evalContext);
} catch (e) {
    console.error("FAIL: Error evaluating AppContext code in sandbox:", e);
    process.exit(1);
}

// Set up mock baseMitre structure
const createBaseMitre = () => ({
    'Execution': {
        status: 'unknown',
        techniques: [
            { id: 'T1059', name: 'Command and Scripting Interpreter', status: 'unknown' },
            { id: 'T1059.001', name: 'PowerShell', status: 'unknown' },
            { id: 'T1059.003', name: 'Windows Command Shell', status: 'unknown' }
        ]
    }
});

// TEST BUG-01: Sub-technique status is correctly mapped and parent rolls up without overwriting parent's status
const baseMitre1 = createBaseMitre();
global.localStorage.setItem('exercises', JSON.stringify([
    { ttp: 'T1059.001', status: 'high', campaign: 'TestCampaign', environment: 'Miscellaneous' }
]));

const resultMitre1 = global.applyExercises(baseMitre1);
const t1059_001 = resultMitre1['Execution'].techniques.find(t => t.id === 'T1059.001');
const t1059 = resultMitre1['Execution'].techniques.find(t => t.id === 'T1059');

assert("BUG-01: Sub-technique T1059.001 receives status 'high'", t1059_001.status === 'high');
assert("BUG-01: Parent technique T1059 rolls up to 'high' based on sub-technique", t1059.status === 'high');

// TEST BUG-02: Parent technique direct exercise is preserved and factored into rollup
const baseMitre2 = createBaseMitre();
global.localStorage.setItem('exercises', JSON.stringify([
    { ttp: 'T1059', status: 'medium', campaign: 'TestCampaign', environment: 'Miscellaneous' }
]));

const resultMitre2 = global.applyExercises(baseMitre2);
const parentTech = resultMitre2['Execution'].techniques.find(t => t.id === 'T1059');
assert("BUG-02: Parent technique T1059 direct exercise is preserved and status is 'medium'", parentTech.status === 'medium');

// Another test for BUG-02: Mixed rollup (Parent direct 'medium', Sub 'high')
const baseMitre3 = createBaseMitre();
global.localStorage.setItem('exercises', JSON.stringify([
    { ttp: 'T1059', status: 'medium', campaign: 'TestCampaign', environment: 'Miscellaneous' },
    { ttp: 'T1059.001', status: 'high', campaign: 'TestCampaign', environment: 'Miscellaneous' }
]));
const resultMitre3 = global.applyExercises(baseMitre3);
const parentTech3 = resultMitre3['Execution'].techniques.find(t => t.id === 'T1059');
assert("BUG-02: Parent technique status is correctly rolled up combining sub-technique and parent direct status", parentTech3.status === 'high');


// ----------------------------------------------------
// BUG-03: Threshold Matching & Outcoming Alignment
// ----------------------------------------------------
console.log("\n--- Verifying BUG-03 (Scoring Thresholds) ---");

// Check AppContext.jsx threshold matching
const hasAppContextThresholds = appContextContent.includes('avg >= 75') && appContextContent.includes('avg >= 25');
assert("BUG-03: AppContext.jsx uses unified thresholds (avg >= 75 for high, avg >= 25 for medium)", hasAppContextThresholds);

// Check ExerciseWizard.jsx threshold matching
const hasWizardThresholds = wizardContent.includes('avg >= 75') && wizardContent.includes('avg >= 25');
assert("BUG-03: ExerciseWizard.jsx uses unified thresholds (avg >= 75 for high, avg >= 25 for medium)", hasWizardThresholds);

// Check prefix outcome matching in AppContext.jsx
const hasAppContextPrefixMatching = appContextContent.includes('out.startsWith(\'Prevented\')') &&
                                    appContextContent.includes('out.startsWith(\'Alerted\')') &&
                                    appContextContent.includes('out.startsWith(\'Logged\')') &&
                                    appContextContent.includes('out.startsWith(\'Missed\')');
assert("BUG-03: AppContext.jsx uses .startsWith() prefix matching for outcomes", hasAppContextPrefixMatching);

// Check prefix outcome matching in ExerciseWizard.jsx
const hasWizardPrefixMatching = wizardContent.includes('out.startsWith(\'Prevented\')') &&
                                 wizardContent.includes('out.startsWith(\'Alerted\')') &&
                                 wizardContent.includes('out.startsWith(\'Logged\')') &&
                                 wizardContent.includes('out.startsWith(\'Missed\')');
assert("BUG-03: ExerciseWizard.jsx uses .startsWith() prefix matching for outcomes", hasWizardPrefixMatching);


// ----------------------------------------------------
// BUG-04: N/A Exercises Penalize GRS
// ----------------------------------------------------
console.log("\n--- Verifying BUG-04 (GRS Calculation with N/A) ---");

// Let's extract and execute the GRS scoring block from Dashboard.jsx
const grsStartIdx = dashboardContent.indexOf('// 1. Global Resilience Score (GRS)');
const grsEndIdx = dashboardContent.indexOf('// Group exercises by campaign for historical trend');

if (grsStartIdx === -1 || grsEndIdx === -1) {
    console.error("FAIL: Could not locate GRS calculation block in Dashboard.jsx");
    process.exit(1);
}

const grsBlock = dashboardContent.substring(grsStartIdx, grsEndIdx);

// Let's create a test function containing this code
const calculateGRS = (filteredExercises) => {
    // Evaluate extracted block by substituting filteredExercises and converting const to var
    const evalBlock = grsBlock.replace('const grsScore', 'var grsScore');
    let result;
    eval(`
        ${evalBlock}
        result = grsScore; // export back
    `);
    return result;
};

// Synthetic test data for GRS: 3 normal exercises, 2 NA exercises
const testExercises = [
    { id: 1, ttp: 'T1003.001', status: 'high', campaign: 'Camp1' },    // 1.0 pt
    { id: 2, ttp: 'T1059.001', status: 'medium', campaign: 'Camp1' },  // 0.5 pt
    { id: 3, ttp: 'T1027', status: 'low', campaign: 'Camp1' },         // 0.0 pt
    { id: 4, ttp: 'T1566', status: 'na', campaign: 'Camp1' },          // Should be filtered out
    { id: 5, ttp: 'T1210', status: 'na', campaign: 'Camp1' }           // Should be filtered out
];

const computedGrs = calculateGRS(testExercises);
assert("BUG-04: GRS ignores 'na' status and evaluates correctly to 50% instead of 30%", computedGrs === 50);


// ----------------------------------------------------
// BUG-15: Skewed Globe Ratio due to Validated Exercise Outcomes
// ----------------------------------------------------
console.log("\n--- Verifying BUG-15 (Adversary Control Ratio) ---");

// Extract getAdversaryControlRatio from ExerciseWizard.jsx
const startRatio = wizardContent.indexOf('const getAdversaryControlRatio = () => {');
const endRatio = wizardContent.indexOf('const getAggregatedScore =');
if (startRatio === -1 || endRatio === -1) {
    console.error("FAIL: Could not locate getAdversaryControlRatio in ExerciseWizard.jsx");
    process.exit(1);
}
const ratioBlock = wizardContent.substring(startRatio, endRatio);

const calculateAdversaryRatio = (testResults) => {
    let ratio = 0;
    eval(`
        ${ratioBlock}
        ratio = getAdversaryControlRatio();
    `);
    return ratio;
};

// Validated outcomes
const testResults = [
    { outcome: 'Missed (Validation)' },   // should count as Missed (+1.0)
    { outcome: 'Logged (Validation)' },   // should count as Logged (+0.75)
    { outcome: 'Prevented ✓ Validated' }  // should count as Prevented (+0)
];

const computedRatio = calculateAdversaryRatio(testResults);
const expectedRatio = 1.75 / 3.0;
assert("BUG-15: getAdversaryControlRatio handles validation suffix outcomes correctly", Math.abs(computedRatio - expectedRatio) < 0.001);


// ----------------------------------------------------
// BUG-16: Offline Load Fallback
// ----------------------------------------------------
console.log("\n--- Verifying BUG-16 (Expired Cache Fallback in Offline Mode) ---");

// Verify that AppContext's fetchMitreData catch block loads the local storage fallback
const catchBlockStart = appContextContent.indexOf('} catch (err) {');
const catchBlockEnd = appContextContent.indexOf('} finally {', catchBlockStart);

if (catchBlockStart === -1 || catchBlockEnd === -1) {
    console.error("FAIL: Could not locate catch block in AppContext.jsx");
    process.exit(1);
}

const catchBlock = appContextContent.substring(catchBlockStart, catchBlockEnd);
const hasCacheFallback = catchBlock.includes('localStorage.getItem(\'mitre_data_v2\')') &&
                          catchBlock.includes('JSON.parse') &&
                          catchBlock.includes('setMitreData');

assert("BUG-16: Catch block of fetchMitreData contains fallback load from expired cache", hasCacheFallback);

// ----------------------------------------------------
// Final Summary
// ----------------------------------------------------
console.log(`\n=== VERIFICATION SUMMARY: ${passedTests}/${totalTests} PASSED ===`);
if (passedTests === totalTests) {
    console.log("All Milestone 1 bug fixes are successfully verified.");
    process.exit(0);
} else {
    console.error("Some verifications failed!");
    process.exit(1);
}
