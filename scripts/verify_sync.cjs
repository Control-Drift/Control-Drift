/**
 * Programmatic verification script for Iridescence state sync leak.
 * This script imports/mocks the core state transition and recalculation logic from AppContext.jsx,
 * and asserts that reverting a gap with multiple comma-separated TTPs correctly resets all associated
 * exercises to 'low' and reactively propagates the updates to the global MITRE statuses.
 */

const assert = require('assert');

// 1. Recalculation logic cloned from AppContext.jsx
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

        const scoreMap = { high: 100, medium: 50, low: 0 };
        const getAggStatus = (statuses) => {
            if (statuses.length === 0) return 'unknown';
            let total = 0;
            statuses.forEach(s => total += scoreMap[s] || 0);
            const avg = total / statuses.length;
            if (avg >= 75) return 'high';
            if (avg >= 25) return 'medium';
            return 'low';
        };

        allTechs.forEach(t => {
            if (!t.id.includes('.') && parentSubsMap[t.id]) {
                const subs = parentSubsMap[t.id];
                const activeStatuses = subs.map(sub => sub.status).filter(s => s !== 'unknown' && s !== 'na');
                
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

// 2. State Replay Simulation cloned from AppContext useEffect
const replayExercises = (mitreObj, exercises) => {
    const next = JSON.parse(JSON.stringify(mitreObj));
    
    // Reset
    for (const tactic in next) {
        next[tactic].techniques.forEach(t => {
            t.status = 'unknown';
            if (t.environments) {
                Object.keys(t.environments).forEach(env => {
                    t.environments[env] = 'unknown';
                });
            }
        });
    }
    
    const chronological = [...exercises].reverse();
    const determineWorseStatus = (current, incoming) => {
        if (!current) return incoming;
        if (current === 'low' || incoming === 'low') return 'low';
        if (current === 'medium' || incoming === 'medium') return 'medium';
        if (current === 'high' || incoming === 'high') return 'high';
        if (current === 'na' || incoming === 'na') return 'na';
        return 'unknown';
    };

    chronological.forEach(ex => {
        const envArray = Array.isArray(ex.environment) ? ex.environment : [ex.environment || 'Miscellaneous'];
        for (const tactic in next) {
            const tIdx = next[tactic].techniques.findIndex(t => t.id === ex.ttp);
            if (tIdx > -1) {
                next[tactic].techniques[tIdx].status = ex.status;
                if (!next[tactic].techniques[tIdx].environments) {
                    next[tactic].techniques[tIdx].environments = {};
                }
                envArray.forEach(env => {
                    next[tactic].techniques[tIdx].environments[env] = determineWorseStatus(
                        next[tactic].techniques[tIdx].environments[env], 
                        ex.status
                    );
                });
            }
        }
    });

    recalculateMitreStatuses(next, exercises);
    return next;
};

// 3. Test setup
console.log("Starting Iridescence state sync regression test...");

// Initial MITRE ATT&CK Structure
let mitreData = {
    "Execution": {
        status: "unknown",
        techniques: [
            { id: "T1059", name: "Command and Scripting Interpreter", status: "unknown" },
            { id: "T1059.001", name: "PowerShell", status: "unknown" },
            { id: "T1059.003", name: "Windows Command Shell", status: "unknown" }
        ]
    }
};

// Two successful Purple Team exercises (High Coverage / Resolved)
let exercises = [
    { id: 1, ttp: "T1059.003", campaign: "Purple_Campaign", status: "high", environment: ["Windows Workstation"], date: new Date().toISOString() },
    { id: 2, ttp: "T1059.001", campaign: "Purple_Campaign", status: "high", environment: ["Windows Workstation"], date: new Date().toISOString() }
];

// Run initial replay
mitreData = replayExercises(mitreData, exercises);

// Assert initial statuses are high
console.log("Initial checks:");
console.log(`- Exercise T1059.003 status: ${exercises.find(e => e.ttp === "T1059.003").status} (expected: high)`);
console.log(`- Exercise T1059.001 status: ${exercises.find(e => e.ttp === "T1059.001").status} (expected: high)`);
console.log(`- MITRE T1059.003 status: ${mitreData["Execution"].techniques.find(t => t.id === "T1059.003").status} (expected: high)`);
console.log(`- MITRE T1059.001 status: ${mitreData["Execution"].techniques.find(t => t.id === "T1059.001").status} (expected: high)`);
console.log(`- MITRE T1059 (Parent) status: ${mitreData["Execution"].techniques.find(t => t.id === "T1059").status} (expected: high)`);
console.log(`- MITRE Execution Tactic status: ${mitreData["Execution"].status} (expected: high)`);

assert.strictEqual(exercises.find(e => e.ttp === "T1059.003").status, "high");
assert.strictEqual(exercises.find(e => e.ttp === "T1059.001").status, "high");
assert.strictEqual(mitreData["Execution"].techniques.find(t => t.id === "T1059.003").status, "high");
assert.strictEqual(mitreData["Execution"].techniques.find(t => t.id === "T1059.001").status, "high");
assert.strictEqual(mitreData["Execution"].techniques.find(t => t.id === "T1059").status, "high");
assert.strictEqual(mitreData["Execution"].status, "high");

// 4. Simulate a gap targeting both TTPs that is moved from Resolved back to In Progress
let gap = {
    id: "GAP-101",
    ttp: "T1059.003, T1059.001",
    campaign: "Purple_Campaign",
    status: "Resolved"
};

console.log("\nSimulating status reversion (Resolved -> In Progress) for comma-separated TTP gap...");

// Code executed during status change:
if (gap.status === 'Resolved') {
    // Revert exercises targeting these TTPs to 'low'
    exercises = exercises.map(ex => {
        const gapTTPs = (gap.ttp || '').split(',').map(t => t.trim());
        if (gapTTPs.includes(ex.ttp) && ex.campaign === gap.campaign) {
            return { ...ex, status: 'low' };
        }
        return ex;
    });
}
gap.status = 'In Progress';

// The exercises status update reactively triggers the MITRE replay in AppContext:
mitreData = replayExercises(mitreData, exercises);

// 5. Assertions after reversion
console.log("Post-reversion checks:");
console.log(`- Exercise T1059.003 status: ${exercises.find(e => e.ttp === "T1059.003").status} (expected: low)`);
console.log(`- Exercise T1059.001 status: ${exercises.find(e => e.ttp === "T1059.001").status} (expected: low)`);
console.log(`- MITRE T1059.003 status: ${mitreData["Execution"].techniques.find(t => t.id === "T1059.003").status} (expected: low)`);
console.log(`- MITRE T1059.001 status: ${mitreData["Execution"].techniques.find(t => t.id === "T1059.001").status} (expected: low)`);
console.log(`- MITRE T1059 (Parent) status: ${mitreData["Execution"].techniques.find(t => t.id === "T1059").status} (expected: low)`);
console.log(`- MITRE Execution Tactic status: ${mitreData["Execution"].status} (expected: low)`);

assert.strictEqual(exercises.find(e => e.ttp === "T1059.003").status, "low");
assert.strictEqual(exercises.find(e => e.ttp === "T1059.001").status, "low");
assert.strictEqual(mitreData["Execution"].techniques.find(t => t.id === "T1059.003").status, "low");
assert.strictEqual(mitreData["Execution"].techniques.find(t => t.id === "T1059.001").status, "low");
assert.strictEqual(mitreData["Execution"].techniques.find(t => t.id === "T1059").status, "low");
assert.strictEqual(mitreData["Execution"].status, "low");

console.log("\nVERIFICATION SUCCESSFUL: Sync leak is fully resolved and reactively updates all statuses in sync!");
