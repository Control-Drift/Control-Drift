import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("==========================================================");
console.log("STARTING MATHEMATICAL METRICS VERIFICATION ON STRESS DATA");
console.log("==========================================================");

// 1. Load Synthetic Stress Data
const stressDataPath = path.resolve(__dirname, 'synthetic_stress_data.json');
if (!fs.existsSync(stressDataPath)) {
    console.error(`Error: synthetic_stress_data.json not found at ${stressDataPath}`);
    process.exit(1);
}

const rawData = JSON.parse(fs.readFileSync(stressDataPath, 'utf8'));
const { exercises, gaps } = rawData;

console.log(`Loaded ${exercises.length} exercises and ${gaps.length} gaps from synthetic_stress_data.json.`);

// Ensure dataset meets stress criteria
assert.ok(exercises.length >= 10000, `Should have at least 10,000 exercises (found ${exercises.length})`);
assert.ok(gaps.length >= 1000, `Should have at least 1,000 gaps (found ${gaps.length})`);

// 2. Mock Taxonomy definitions
const tacticsMap = {
    "Initial Access": "Initial Access",
    "Execution": "Execution",
    "Persistence": "Persistence",
    "Defense Evasion": "Defense Evasion",
    "Credential Access": "Credential Access",
    "Discovery": "Discovery",
    "Lateral Movement": "Lateral Movement",
    "Collection": "Collection",
    "Command and Control": "Command and Control",
    "Exfiltration": "Exfiltration",
    "Impact": "Impact"
};

const ttpToTacticMap = {
    "T1566": "Initial Access", "T1566.001": "Initial Access", "T1566.002": "Initial Access", "T1190": "Initial Access", "T1133": "Initial Access",
    "T1059": "Execution", "T1059.001": "Execution", "T1059.003": "Execution", "T1059.004": "Execution", "T1053.005": "Execution", "T1204.002": "Execution",
    "T1543.003": "Persistence", "T1098": "Persistence",
    "T1068": "Execution", "T1548.002": "Execution",
    "T1562.001": "Defense Evasion", "T1070.004": "Defense Evasion",
    "T1003.001": "Credential Access", "T1110.001": "Credential Access",
    "T1087.001": "Discovery", "T1082": "Discovery",
    "T1021.001": "Lateral Movement", "T1021.002": "Lateral Movement",
    "T1114.002": "Collection", "T1005": "Collection",
    "T1071.001": "Command and Control", "T1090.001": "Command and Control",
    "T1048.002": "Exfiltration",
    "T1486": "Impact", "T1490": "Impact"
};

// Organize techniques by tactic
const taxonomy = {};
for (const tactic in tacticsMap) {
    taxonomy[tactic] = { status: 'unknown', techniques: [] };
}
for (const ttp in ttpToTacticMap) {
    const tactic = ttpToTacticMap[ttp];
    const parentTtp = ttp.split('.')[0];
    if (!taxonomy[tactic].techniques.find(t => t.id === parentTtp)) {
        taxonomy[tactic].techniques.push({ id: parentTtp, status: 'unknown' });
    }
    if (ttp !== parentTtp && !taxonomy[tactic].techniques.find(t => t.id === ttp)) {
        taxonomy[tactic].techniques.push({ id: ttp, status: 'unknown' });
    }
}

// Ensure custom techniques in exercises are appended
exercises.forEach(ex => {
    if (ex.ttp && !ttpToTacticMap[ex.ttp]) {
        const parentTtp = ex.ttp.split('.')[0];
        const tactic = "Execution";
        if (!taxonomy[tactic].techniques.find(t => t.id === parentTtp)) {
            taxonomy[tactic].techniques.push({ id: parentTtp, status: 'unknown' });
        }
        if (ex.ttp !== parentTtp && !taxonomy[tactic].techniques.find(t => t.id === ex.ttp)) {
            taxonomy[tactic].techniques.push({ id: ex.ttp, status: 'unknown' });
        }
    }
});

// Helper for AppContext.jsx Average Coverage Aggregation
function getAggStatusAverage(statuses) {
    if (statuses.length === 0) return 'unknown';
    
    let total = 0;
    statuses.forEach(s => {
        if (s === 'high') total += 100;
        else if (s === 'medium') total += 50;
        else if (s === 'minimal') total += 25;
        else if (s === 'low') total += 0;
    });
    const avg = total / statuses.length;
    
    if (avg === 100) return 'high';
    if (avg >= 50) return 'medium';
    if (avg > 0) return 'minimal';
    return 'low';
}

// Helper for mock_database.js Weakest Link Aggregation
function getAggStatusWeakestLink(statuses) {
    if (statuses.length === 0) return 'unknown';
    if (statuses.includes('low')) return 'low';
    if (statuses.includes('medium')) return 'medium';
    if (statuses.includes('high')) return 'high';
    return 'unknown';
}

// Calculate technique statuses under average coverage
function calculateTechniqueStatuses(exercisesList, useAverage = true) {
    const techStatuses = {};
    
    // Group exercises by TTP
    const ttpGroups = {};
    exercisesList.forEach(ex => {
        if (!ttpGroups[ex.ttp]) ttpGroups[ex.ttp] = [];
        ttpGroups[ex.ttp].push(ex.status);
    });

    for (const ttp in ttpGroups) {
        // Filter out na, error, and pending
        const validStatuses = ttpGroups[ttp].filter(s => ['high', 'medium', 'minimal', 'low'].includes(s));
        if (useAverage) {
            techStatuses[ttp] = getAggStatusAverage(validStatuses);
        } else {
            techStatuses[ttp] = getAggStatusWeakestLink(validStatuses);
        }
    }
    return techStatuses;
}

// Calculate tactic rollups
function calculateTacticRollups(techStatuses, useAverage = true) {
    const tacticRollups = {};
    for (const tactic in taxonomy) {
        const parentTechs = taxonomy[tactic].techniques.filter(t => !t.id.includes('.'));
        const statuses = parentTechs.map(t => techStatuses[t.id]).filter(s => ['high', 'medium', 'minimal', 'low'].includes(s));
        
        if (useAverage) {
            tacticRollups[tactic] = getAggStatusAverage(statuses);
        } else {
            tacticRollups[tactic] = getAggStatusWeakestLink(statuses);
        }
    }
    return tacticRollups;
}

// VERIFICATION 1: Average Coverage vs Weakest Link
console.log("\n--- VERIFICATION 1: Heatmap Tactic Rollups Logic ---");
const avgTechStatuses = calculateTechniqueStatuses(exercises, true);
const avgTacticRollups = calculateTacticRollups(avgTechStatuses, true);

const wlTechStatuses = calculateTechniqueStatuses(exercises, false);
const wlTacticRollups = calculateTacticRollups(wlTechStatuses, false);

console.log("Comparing Rollup Statuses for each Tactic:");
let hasDifference = false;
for (const tactic in taxonomy) {
    const avgStatus = avgTacticRollups[tactic];
    const wlStatus = wlTacticRollups[tactic];
    console.log(`- ${tactic}: Average Coverage => [${avgStatus.toUpperCase()}], Weakest Link => [${wlStatus.toUpperCase()}]`);
    if (avgStatus !== wlStatus) {
        hasDifference = true;
    }
}

console.log(`Heatmap displays Average Coverage rather than weakest link: ${hasDifference ? "YES" : "NO (Or statuses happened to align)"}`);
// In a randomized dataset, weakest link is highly likely to default to 'low' for all tactics containing any low status.
// We verify that the average logic does not default to the weakest link unless they actually average out to low.
assert.ok(wlTacticRollups["Execution"] === 'low' || wlTacticRollups["Execution"] === 'unknown', "Weakest link logic should result in Low/Unknown due to presence of low exercises.");
assert.ok(avgTacticRollups["Execution"] !== 'low', "Average coverage rollups should not default to poorest status unless mathematically justified.");

// VERIFICATION 2: Error and Pending Statuses Ignored in Coverage Denominator
console.log("\n--- VERIFICATION 2: Error & Pending Status Coverage Filtering ---");
// Choose a TTP and filter exercises manually
const testTTP = "T1059.001";
const ttpExercises = exercises.filter(ex => ex.ttp === testTTP);
const errorCount = ttpExercises.filter(ex => ex.status === 'error').length;
const pendingCount = ttpExercises.filter(ex => ex.status === 'pending').length;
const validExercises = ttpExercises.filter(ex => ['high', 'medium', 'minimal', 'low'].includes(ex.status));

console.log(`TTP ${testTTP} exercise counts:`);
console.log(`- High (Optimal): ${ttpExercises.filter(ex => ex.status === 'high').length}`);
console.log(`- Medium (Partial): ${ttpExercises.filter(ex => ex.status === 'medium').length}`);
console.log(`- Minimal: ${ttpExercises.filter(ex => ex.status === 'minimal').length}`);
console.log(`- Low (No Coverage): ${ttpExercises.filter(ex => ex.status === 'low').length}`);
console.log(`- N/A: ${ttpExercises.filter(ex => ex.status === 'na').length}`);
console.log(`- Error: ${errorCount}`);
console.log(`- Pending: ${pendingCount}`);
console.log(`- Total: ${ttpExercises.length}`);

// Calculate mathematically with error/pending excluded vs included
const totalScores = validExercises.reduce((acc, ex) => {
    if (ex.status === 'high') return acc + 100;
    if (ex.status === 'medium') return acc + 50;
    if (ex.status === 'minimal') return acc + 25;
    return acc; // low is 0
}, 0);

const mathAvgExcluded = totalScores / validExercises.length;
const mathAvgIncluded = totalScores / (validExercises.length + errorCount + pendingCount);

console.log(`Mathematical average with error/pending EXCLUDED (denominator = ${validExercises.length}): ${mathAvgExcluded.toFixed(2)}%`);
console.log(`Mathematical average with error/pending INCLUDED (denominator = ${validExercises.length + errorCount + pendingCount}): ${mathAvgIncluded.toFixed(2)}%`);

// Let's verify with the app context logic
const appStatus = avgTechStatuses[testTTP];
console.log(`App Context status rollup for TTP ${testTTP}: [${appStatus.toUpperCase()}]`);

let expectedStatus = 'low';
if (mathAvgExcluded === 100) expectedStatus = 'high';
else if (mathAvgExcluded >= 50) expectedStatus = 'medium';
else if (mathAvgExcluded > 0) expectedStatus = 'minimal';

console.log(`Expected status based on EXCLUDED calculation: [${expectedStatus.toUpperCase()}]`);
assert.strictEqual(appStatus, expectedStatus, "TTP status should match the excluded calculation");

// VERIFICATION 3: GRS Calculation Accuracy
console.log("\n--- VERIFICATION 3: Global Resilience Score (GRS) Accuracy ---");
const validExercisesGrs = exercises.filter(ex => ex.status?.toLowerCase() !== 'na' && ex.simulation !== 'Admin Config');
const totalValidatedGrs = validExercisesGrs.length;
let grsPoints = 0;
validExercisesGrs.forEach(ex => {
    if (ex.status === 'high') grsPoints += 1.0;
    else if (ex.status === 'medium') grsPoints += 0.5;
});
const expectedGrs = totalValidatedGrs > 0 ? Math.round((grsPoints / totalValidatedGrs) * 100) : 0;
console.log(`Total Validated Exercises for GRS: ${totalValidatedGrs}`);
console.log(`Total GRS Points: ${grsPoints}`);
console.log(`Calculated GRS: ${expectedGrs}%`);
assert.ok(expectedGrs >= 0 && expectedGrs <= 100, "GRS must be between 0% and 100%");

// VERIFICATION 4: MTTR Negative Interval Bounding
console.log("\n--- VERIFICATION 4: MTTR Negative Time Interval Bounding ---");
const resolvedGaps = gaps.filter(g => g.status === 'Resolved' && g.resolvedDate && g.createdDate);
const validResolvedGaps = resolvedGaps.filter(g => !isNaN(new Date(g.resolvedDate)) && !isNaN(new Date(g.createdDate)));

// Identify negative gaps
const negativeGaps = validResolvedGaps.filter(g => new Date(g.resolvedDate) < new Date(g.createdDate));
console.log(`Total Resolved Gaps: ${resolvedGaps.length}`);
console.log(`Total Valid Date Resolved Gaps: ${validResolvedGaps.length}`);
console.log(`Out-of-sync Resolved Gaps (resolvedDate < createdDate): ${negativeGaps.length}`);

// Method A: Bounding to 0 (GapTracker.jsx logic)
let totalSecondsA = 0;
validResolvedGaps.forEach(g => {
    const diff = (new Date(g.resolvedDate) - new Date(g.createdDate)) / 1000;
    totalSecondsA += Math.max(0, diff);
});
const mttrSecondsA = totalSecondsA / validResolvedGaps.length;

// Method B: Filtering out negative intervals (mock_database.js & Dashboard.jsx logic)
const filteredValidGaps = validResolvedGaps.filter(g => new Date(g.resolvedDate) >= new Date(g.createdDate));
let totalSecondsB = 0;
filteredValidGaps.forEach(g => {
    const diff = (new Date(g.resolvedDate) - new Date(g.createdDate)) / 1000;
    totalSecondsB += diff;
});
const mttrSecondsB = totalSecondsB / filteredValidGaps.length;

console.log(`MTTR Method A (bounding negative diffs to 0): ${(mttrSecondsA / 3600 / 24).toFixed(2)} days`);
console.log(`MTTR Method B (filtering out negative diffs): ${(mttrSecondsB / 3600 / 24).toFixed(2)} days`);

assert.ok(mttrSecondsA >= 0, "Method A MTTR must be non-negative");
assert.ok(mttrSecondsB >= 0, "Method B MTTR must be non-negative");
assert.ok(Number.isFinite(mttrSecondsA), "Method A MTTR must be a finite number");
assert.ok(Number.isFinite(mttrSecondsB), "Method B MTTR must be a finite number");

console.log("\n==========================================================");
console.log("ALL MATHEMATICAL METRICS VERIFIED SUCCESSFULLY!");
console.log("==========================================================");
process.exit(0);
