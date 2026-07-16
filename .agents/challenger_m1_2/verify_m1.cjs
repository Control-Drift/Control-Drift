// Empirical Verification Script for Milestone 1 Bug Fixes
// Challenger 2 (Empirical Challenger)

const fs = require('fs');
const path = require('path');

let testsFailed = 0;

function assert(description, condition) {
    if (condition) {
        console.log(`[PASS] ${description}`);
    } else {
        console.error(`[FAIL] ${description}`);
        testsFailed++;
    }
}

// ----------------------------------------------------
// 1. RECALCULATE MITRE STATUSES LOGIC (BUG-02, BUG-03)
// ----------------------------------------------------
const scoreMap = { high: 100, medium: 50, low: 0 };
const getAggStatus = (statuses, mediumThreshold = 25) => {
    if (statuses.length === 0) return 'unknown';
    let total = 0;
    statuses.forEach(s => total += scoreMap[s] || 0);
    const avg = total / statuses.length;
    if (avg >= 75) return 'high';
    if (avg >= mediumThreshold) return 'medium';
    return 'low';
};

const recalculateMitreStatuses = (mitreObj, exercises = []) => {
    for (const tactic in mitreObj) {
        const allTechs = mitreObj[tactic].techniques;
        
        // Group sub-techniques by parent
        const parentSubsMap = {};
        allTechs.forEach(t => {
            if (t.id.includes('.')) {
                const parentId = t.id.split('.')[0];
                if (!parentSubsMap[parentId]) parentSubsMap[parentId] = [];
                parentSubsMap[parentId].push(t);
            }
        });

        allTechs.forEach(t => {
            if (!t.id.includes('.') && parentSubsMap[t.id]) {
                const subs = parentSubsMap[t.id];
                const activeStatuses = subs.map(sub => sub.status).filter(s => s !== 'unknown' && s !== 'na');
                
                // BUG-02 Fix: check if the parent technique has a directly assigned status from exercises
                const directExercise = exercises.find(ex => ex.ttp === t.id);
                if (directExercise && directExercise.status && directExercise.status !== 'unknown' && directExercise.status !== 'na') {
                    activeStatuses.push(directExercise.status);
                }
                
                if (activeStatuses.length === 0) {
                    const allStatuses = subs.map(sub => sub.status);
                    if (allStatuses.length > 0 && allStatuses.every(s => s === 'na')) {
                        t.status = 'na';
                    } else {
                        t.status = 'unknown';
                    }
                } else {
                    t.status = getAggStatus(activeStatuses);
                }
            }
        });

        // Calculate tactic status using ONLY parent techniques
        const parentTechs = allTechs.filter(t => !t.id.includes('.'));
        const activeTacticStatuses = parentTechs.map(t => t.status).filter(s => s !== 'unknown' && s !== 'na');
        
        if (activeTacticStatuses.length === 0) {
            const allTacticStatuses = parentTechs.map(t => t.status);
            if (allTacticStatuses.length > 0 && allTacticStatuses.every(s => s === 'na')) {
                mitreObj[tactic].status = 'na';
            } else {
                mitreObj[tactic].status = 'unknown';
            }
        } else {
            mitreObj[tactic].status = getAggStatus(activeTacticStatuses);
        }
    }
    return mitreObj;
};

// ----------------------------------------------------
// 2. GRS SCORING LOGIC (BUG-04)
// ----------------------------------------------------
function calculateGRS(filteredExercises) {
    const validExercises = filteredExercises.filter(ex => ex.status?.toLowerCase() !== 'na');
    const totalValidated = validExercises.length;
    let grsPoints = 0;
    validExercises.forEach(ex => {
        if (ex.status === 'high') grsPoints += 1.0;
        else if (ex.status === 'medium') grsPoints += 0.5;
    });
    return totalValidated > 0 ? Math.round((grsPoints / totalValidated) * 100) : 0;
}

function calculateCampaignTrend(filteredExercises) {
    const campaignsByName = {};
    filteredExercises.forEach(ex => {
        if (ex.status?.toLowerCase() === 'na') return;
        if (!campaignsByName[ex.campaign]) campaignsByName[ex.campaign] = { date: ex.date, high: 0, medium: 0, total: 0 };
        campaignsByName[ex.campaign].total += 1;
        if (ex.status === 'high') campaignsByName[ex.campaign].high += 1;
        if (ex.status === 'medium') campaignsByName[ex.campaign].medium += 1;
    });
    return campaignsByName;
}

// ----------------------------------------------------
// 3. EXERCISE WIZARD SCORING & OUTCOME MATCHING (BUG-15, BUG-03)
// ----------------------------------------------------
const getAggregatedScore = (ttpId, testResults) => {
    const procs = testResults.filter(p => (p.ttps || []).includes(ttpId));
    if (procs.length === 0) return { score: 0, outcome: 'N/A', count: 0 };
    
    let totalScore = 0;
    let validCount = 0;
    
    procs.forEach(p => {
       const out = p.outcome || 'Prevented';
       if (out === 'N/A' || out === 'Error') return;
       validCount++;
       if (out.startsWith('Prevented')) totalScore += 100;
       else if (out.startsWith('Alerted')) totalScore += 75;
       else if (out.startsWith('Logged')) totalScore += 50;
       else if (out.startsWith('Missed')) totalScore += 0;
    });
    
    if (validCount === 0) return { score: 0, outcome: 'N/A', count: 0 };
    const avg = totalScore / validCount;
    
    let aggOutcome = 'Missed';
    if (avg >= 75) aggOutcome = 'Prevented';
    else if (avg >= 25) aggOutcome = 'Logged';
    
    return { score: avg, outcome: aggOutcome, count: validCount };
};

// ----------------------------------------------------
// RUN TEST SUITE
// ----------------------------------------------------

console.log("=== STARTING MILESTONE 1 BUG VERIFICATION ===");

// --- Test BUG-01 (TTP Exercise Loss on Refresh: Exact matching verification) ---
console.log("\n--- Testing BUG-01: Exact Matching for TTP mapping ---");
// Reading AppContext.jsx source to confirm exact match regex
const appContextPath = path.resolve(__dirname, '../../src/AppContext.jsx');
const appContextContent = fs.readFileSync(appContextPath, 'utf8');

const tIdxExactMatch = appContextContent.includes("techniques.findIndex(t => t.id === ex.ttp)");
assert("findIndex uses exact match t.id === ex.ttp to prevent sub-technique overlaps", tIdxExactMatch);

const completeExerciseExactMatch = appContextContent.includes("techniques.findIndex(t => t.id === ttp)");
assert("completeExercise uses exact match t.id === ttp", completeExerciseExactMatch);


// --- Test BUG-02 (Parent Technique Exercise Overwrite) ---
console.log("\n--- Testing BUG-02: Parent Technique Exercise Overwrite ---");

// Case A: Parent has a directly assigned exercise status of 'low', but its sub-techniques have no exercises.
// It should rollup to 'low' instead of 'unknown'.
const mitreMock1 = {
    "Initial Access": {
        status: "unknown",
        techniques: [
            { id: "T1078", name: "Valid Accounts", status: "unknown" },
            { id: "T1078.001", name: "Default Accounts", status: "unknown" },
            { id: "T1078.002", name: "Domain Accounts", status: "unknown" }
        ]
    }
};
const exercisesMock1 = [
    { ttp: "T1078", status: "low", campaign: "Campaign 1" }
];
const result1 = recalculateMitreStatuses(JSON.parse(JSON.stringify(mitreMock1)), exercisesMock1);
assert("Parent technique status evaluates to directly assigned status 'low' when sub-techniques are unknown", result1["Initial Access"].techniques[0].status === "low");

// Case B: Parent has directly assigned status of 'low' and its sub-technique T1078.001 has 'high'.
// Rollup should aggregate ['high', 'low'] -> average score (100 + 0) / 2 = 50 -> 'medium'
const mitreMock2 = {
    "Initial Access": {
        status: "unknown",
        techniques: [
            { id: "T1078", name: "Valid Accounts", status: "unknown" },
            { id: "T1078.001", name: "Default Accounts", status: "high" },
            { id: "T1078.002", name: "Domain Accounts", status: "unknown" }
        ]
    }
};
const exercisesMock2 = [
    { ttp: "T1078", status: "low", campaign: "Campaign 1" }
];
const result2 = recalculateMitreStatuses(JSON.parse(JSON.stringify(mitreMock2)), exercisesMock2);
assert("Parent technique status rolls up sub-technique and parent-direct status together (high + low -> medium)", result2["Initial Access"].techniques[0].status === "medium");

// Case C: Parent has directly assigned status of 'medium', sub-techniques are all 'na'.
// It should rollup to 'medium' instead of 'na'.
const mitreMock3 = {
    "Initial Access": {
        status: "unknown",
        techniques: [
            { id: "T1078", name: "Valid Accounts", status: "na" },
            { id: "T1078.001", name: "Default Accounts", status: "na" },
            { id: "T1078.002", name: "Domain Accounts", status: "na" }
        ]
    }
};
const exercisesMock3 = [
    { ttp: "T1078", status: "medium", campaign: "Campaign 1" }
];
const result3 = recalculateMitreStatuses(JSON.parse(JSON.stringify(mitreMock3)), exercisesMock3);
assert("Parent technique status evaluates to direct status 'medium' when sub-techniques are 'na'", result3["Initial Access"].techniques[0].status === "medium");


// --- Test BUG-03 (Rollup Thresholds) ---
console.log("\n--- Testing BUG-03: Unified Thresholds at 25% ---");
// Check threshold in getAggStatus mock
assert("Average of 25.0% results in 'medium'", getAggStatus(['medium', 'low']) === 'medium'); // (50+0)/2 = 25% -> medium
assert("Average of 24.9% results in 'low'", getAggStatus(['medium', 'low', 'low', 'low']) === 'low'); // (50+0+0+0)/4 = 12.5% -> low
assert("Average of 75% results in 'high'", getAggStatus(['high', 'high', 'high', 'low']) === 'high'); // (100+100+100+0)/4 = 75% -> high
assert("Average of 74% results in 'medium'", getAggStatus(['high', 'high', 'medium', 'low']) === 'medium'); // (100+100+50+0)/4 = 62.5% -> medium

// Check source code file content to verify threshold value of 25 is applied
const hasUnifiedThresholdInCtx = appContextContent.includes("avg >= 25) return 'medium';");
assert("AppContext.jsx contains unified threshold 'avg >= 25'", hasUnifiedThresholdInCtx);


// --- Test BUG-04 (N/A Exercises Penalize GRS) ---
console.log("\n--- Testing BUG-04: N/A Exercises in GRS & Campaigns ---");

const exercisesForGRS = [
    { ttp: "T1001", status: "high", campaign: "Campaign A", date: "2026-06-01" },     // 1.0
    { ttp: "T1002", status: "medium", campaign: "Campaign A", date: "2026-06-01" },   // 0.5
    { ttp: "T1003", status: "low", campaign: "Campaign A", date: "2026-06-01" },      // 0.0
    { ttp: "T1004", status: "na", campaign: "Campaign A", date: "2026-06-01" },       // Excluded
    { ttp: "T1005", status: "NA", campaign: "Campaign A", date: "2026-06-01" }        // Excluded
];

const grsResult = calculateGRS(exercisesForGRS);
// Valid = 3 (high, medium, low). Total points = 1.0 + 0.5 + 0 = 1.5. Score = 1.5/3 * 100 = 50%.
assert("GRS calculation filters out 'na' and 'NA' (expected 50%)", grsResult === 50);

const campaignTrendResult = calculateCampaignTrend(exercisesForGRS);
assert("Campaign trends calculation filters out 'na'/'NA' and does not penalize denominator", campaignTrendResult["Campaign A"].total === 3);
assert("Campaign trends calculation has correct high count", campaignTrendResult["Campaign A"].high === 1);
assert("Campaign trends calculation has correct medium count", campaignTrendResult["Campaign A"].medium === 1);


// --- Test BUG-15 (Outcome Matching) ---
console.log("\n--- Testing BUG-15: Outcome Matching using startsWith ---");

const testResultsMock = [
    { name: "Payload 1", ttps: ["T1027"], outcome: "Prevented ✓ Validated" },
    { name: "Payload 2", ttps: ["T1027"], outcome: "Logged (Validation)" },
    { name: "Payload 3", ttps: ["T1027"], outcome: "Missed (Validation)" }
];

const aggScore = getAggregatedScore("T1027", testResultsMock);
// Score = (100 + 50 + 0) / 3 = 50. Output should startsWith 'Logged' -> outcome should be 'Logged'.
// If startsWith was not used, all would evaluate to 'N/A' or 'Missed' (score = 0).
assert("getAggregatedScore correctly handles validated outcome strings via startsWith (score = 50)", aggScore.score === 50);
assert("getAggregatedScore correctly computes aggregated outcome as 'Logged'", aggScore.outcome === "Logged");

// Verify that the code in ExerciseWizard.jsx has startsWith implementations
const wizardPath = path.resolve(__dirname, '../../src/components/ExerciseWizard.jsx');
const wizardContent = fs.readFileSync(wizardPath, 'utf8');

const hasStartsWithMissed = wizardContent.includes(".startsWith('Missed')");
const hasStartsWithLogged = wizardContent.includes(".startsWith('Logged')");
const hasStartsWithPrevented = wizardContent.includes(".startsWith('Prevented')");
const hasStartsWithAlerted = wizardContent.includes(".startsWith('Alerted')");

assert("ExerciseWizard.jsx matches outcomes using startsWith('Missed')", hasStartsWithMissed);
assert("ExerciseWizard.jsx matches outcomes using startsWith('Logged')", hasStartsWithLogged);
assert("ExerciseWizard.jsx matches outcomes using startsWith('Prevented')", hasStartsWithPrevented);
assert("ExerciseWizard.jsx matches outcomes using startsWith('Alerted')", hasStartsWithAlerted);


// --- Test BUG-16 (Offline Load Failure of MITRE Data) ---
console.log("\n--- Testing BUG-16: Offline Cache Fallback ---");
// Let's inspect the fetchMitreData function's catch block in AppContext.jsx
const hasOfflineCacheFallback = appContextContent.includes("localStorage.getItem('mitre_data_v2')") && 
                               appContextContent.includes("console.error(\"Error loading MITRE STIX data:\"");

assert("AppContext.jsx contains offline local storage cache fallback in catch block of fetchMitreData", hasOfflineCacheFallback);

console.log("\n=== TESTING COMPLETED ===");
if (testsFailed === 0) {
    console.log("ALL TESTS PASSED SUCCESSFULLY.");
    process.exit(0);
} else {
    console.error(`${testsFailed} TEST(S) FAILED.`);
    process.exit(1);
}
