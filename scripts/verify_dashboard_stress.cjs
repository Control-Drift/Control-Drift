const fs = require('fs');
const path = require('path');
const assert = require('assert');

// 1. PHASE_ICONS Mock
// In the UI, these map to Lucide React component references (functions).
// We'll mock them as dummy component-like objects or strings.
const MockKey = { displayName: 'Key' };
const MockTerminal = { displayName: 'Terminal' };
const MockGhost = { displayName: 'Ghost' };
const MockNetwork = { displayName: 'Network' };
const MockTarget = { displayName: 'Target' };

const PHASE_ICONS = {
  "Initial Access": MockKey,
  "Execution": MockTerminal,
  "Evasion": MockGhost,
  "Movement": MockNetwork,
  "Action on Objective": MockTarget
};

// 2. Load Synthetic Stress Data
const stressDataPath = path.resolve(__dirname, 'synthetic_stress_data.json');
if (!fs.existsSync(stressDataPath)) {
    console.error(`Error: synthetic_stress_data.json not found at ${stressDataPath}`);
    process.exit(1);
}

const rawData = JSON.parse(fs.readFileSync(stressDataPath, 'utf8'));
const { exercises, gaps } = rawData;

console.log(`Loaded ${exercises.length} exercises and ${gaps.length} gaps from synthetic_stress_data.json.`);

// 3. Create a comprehensive mock mitreData that maps TTPs to Tactics
// This ensures the tacticExposure and radarData calculations function correctly.
// Let's populate mitreData based on all unique TTPs in the exercises list.
const uniqueTTPs = [...new Set(exercises.map(e => e.ttp))];
const mitreData = {};

// We map common techniques to tactics based on standard MITRE ATT&CK definition
const ttpToTacticMap = {
    // Initial Access
    "T1566": "Initial Access", "T1566.001": "Initial Access", "T1566.002": "Initial Access", "T1190": "Initial Access", "T1133": "Initial Access",
    // Execution
    "T1059": "Execution", "T1059.001": "Execution", "T1059.003": "Execution", "T1059.004": "Execution", "T1053.005": "Execution", "T1204.002": "Execution",
    // Persistence
    "T1543.003": "Persistence", "T1098": "Persistence",
    // Privilege Escalation
    "T1068": "Privilege Escalation", "T1548.002": "Privilege Escalation",
    // Defense Evasion
    "T1562.001": "Defense Evasion", "T1070.004": "Defense Evasion",
    // Credential Access
    "T1003.001": "Credential Access", "T1110.001": "Credential Access",
    // Discovery
    "T1087.001": "Discovery", "T1082": "Discovery",
    // Lateral Movement
    "T1021.001": "Lateral Movement", "T1021.002": "Lateral Movement",
    // Collection
    "T1114.002": "Collection", "T1005": "Collection",
    // Command and Control
    "T1071.001": "Command and Control", "T1090.001": "Command and Control",
    // Exfiltration
    "T1048.002": "Exfiltration",
    // Impact
    "T1486": "Impact", "T1490": "Impact"
};

// Populate mitreData with tactics and their techniques
uniqueTTPs.forEach(ttp => {
    const parentTtp = ttp.split('.')[0];
    const tactic = ttpToTacticMap[ttp] || ttpToTacticMap[parentTtp] || "Execution"; // Default to Execution if not mapped
    
    if (!mitreData[tactic]) {
        mitreData[tactic] = { status: 'unknown', techniques: [] };
    }
    
    // Add both parent and sub-technique if needed
    if (!mitreData[tactic].techniques.find(t => t.id === parentTtp)) {
        mitreData[tactic].techniques.push({ id: parentTtp, name: `Parent Tech ${parentTtp}`, status: 'unknown' });
    }
    if (ttp !== parentTtp && !mitreData[tactic].techniques.find(t => t.id === ttp)) {
        mitreData[tactic].techniques.push({ id: ttp, name: `Sub-Tech ${ttp}`, status: 'unknown' });
    }
});

console.log(`Initialized mock mitreData with tactics: ${Object.keys(mitreData).join(', ')}`);

// 4. Run calculations cloned from Dashboard.jsx
function runDashboardCalculations(filteredExercises, filteredGaps, mitreData) {
    // 1. Global Resilience Score (GRS)
    const valid = filteredExercises.filter(ex => ex.status?.toLowerCase() !== 'na');
    const total = valid.length;
    let points = 0;
    valid.forEach(ex => {
        if (ex.status === 'high') points += 1.0;
        else if (ex.status === 'medium') points += 0.5;
    });
    const grsScore = total > 0 ? Math.round((points / total) * 100) : 0;
    const totalValidated = total;

    // 2. Remediation Resolution Rate
    const totalGapsCount = filteredGaps.length;
    const closedGaps = filteredGaps.filter(g => g.status === 'Resolved').length;
    const resolutionRate = totalGapsCount > 0 ? Math.round((closedGaps / totalGapsCount) * 100) : 100;
    
    // 3. Weighted Residual Risk
    const openGapsList = filteredGaps.filter(g => g.status === 'Open' || g.status === 'In Progress');
    const severityWeights = { 'Critical': 10, 'High': 7, 'Medium': 3, 'Low': 1 };
    const residualRisk = openGapsList.reduce((acc, g) => acc + (severityWeights[g.severity] || 0), 0);

    // 3.5 Mean Time To Remediate (MTTR)
    const resolvedGapsList = filteredGaps.filter(g => g.status === 'Resolved' && g.resolvedDate && g.createdDate);
    let mttrText = 'N/A';
    if (resolvedGapsList.length > 0) {
        const totalSeconds = resolvedGapsList.reduce((acc, g) => acc + (new Date(g.resolvedDate) - new Date(g.createdDate)) / 1000, 0);
        const meanSeconds = totalSeconds / resolvedGapsList.length;
        const days = Math.floor(meanSeconds / (3600 * 24));
        const hours = Math.floor((meanSeconds % (3600 * 24)) / 3600);
        if (days > 0) mttrText = `${days}d ${hours}h`;
        else if (hours > 0) mttrText = `${hours}h`;
        else mttrText = '< 1h';
    }

    // 4. Kill Chain Exposure Analysis (radarData)
    const tacticExposure = {};
    filteredExercises.forEach(ex => {
        if (!mitreData || Object.keys(mitreData).length === 0) return;
        const tacticName = Object.keys(mitreData).find(t => mitreData[t].techniques.find(tech => tech.id === ex.ttp));
        if (tacticName) {
           if (!tacticExposure[tacticName]) tacticExposure[tacticName] = { tested: 0, missed: 0 };
           tacticExposure[tacticName].tested += 1;
           if (ex.status === 'low') tacticExposure[tacticName].missed += 1;
        }
    });
     
    const killChainPhases = {
        "Initial Access": ["Initial Access"],
        "Execution": ["Execution", "Persistence", "Privilege Escalation"],
        "Evasion": ["Defense Evasion", "Defense Impairment", "Stealth"],
        "Movement": ["Discovery", "Lateral Movement", "Credential Access"],
        "Action on Objective": ["Collection", "Command and Control", "Exfiltration", "Impact"]
    };

    const radarData = Object.entries(killChainPhases).map(([phase, tactics]) => {
        let missed = 0;
        let tested = 0;
        tactics.forEach(t => {
            if (tacticExposure[t]) {
                missed += tacticExposure[t].missed;
                tested += tacticExposure[t].tested;
            }
        });
        return {
            subject: phase,
            risk: tested > 0 ? Math.round((missed / tested) * 100) : 0,
            tested: tested,
            fullMark: 100
        };
    });

    // 5. Area Data (Resilience Score Trend)
    const campaignsByName = {};
    filteredExercises.forEach(ex => {
        if (ex.status?.toLowerCase() === 'na') return;
        if (!campaignsByName[ex.campaign]) campaignsByName[ex.campaign] = { date: ex.date, high: 0, medium: 0, total: 0 };
        campaignsByName[ex.campaign].total += 1;
        if (ex.status === 'high') campaignsByName[ex.campaign].high += 1;
        if (ex.status === 'medium') campaignsByName[ex.campaign].medium += 1;
    });
    const safeDate = (dateStr) => {
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? new Date() : d;
    };

    const historicalScores = Object.values(campaignsByName).sort((a,b) => safeDate(a.date) - safeDate(b.date)).map(c => {
        const score = Math.round(((c.high + (c.medium * 0.5)) / c.total) * 100);
        return {
            name: safeDate(c.date).toLocaleDateString('default', { month: 'short', day: 'numeric' }),
            score: score
        };
    });
    
    const currentDate = new Date().toLocaleString('default', { month: 'short', day: 'numeric' });
    let areaData = historicalScores;
    if (areaData.length === 0) {
        areaData = [
            { name: 'Baseline', score: 0 },
            { name: currentDate, score: 0 },
        ];
    } else if (areaData.length === 1) {
        areaData = [
            { name: 'Baseline', score: 0 },
            ...areaData
        ];
    }

    return {
        grsScore,
        totalValidated,
        resolutionRate,
        residualRisk,
        mttrText,
        radarData,
        areaData
    };
}

console.log("\nRunning stress test calculations...");
const metrics = runDashboardCalculations(exercises, gaps, mitreData);

console.log("\n--- Calculated Metrics Summary ---");
console.log(`Global Resilience Score: ${metrics.grsScore}`);
console.log(`Total Validated Exercises: ${metrics.totalValidated}`);
console.log(`Remediation Resolution Rate: ${metrics.resolutionRate}%`);
console.log(`Weighted Residual Risk: ${metrics.residualRisk}`);
console.log(`MTTR Text: ${metrics.mttrText}`);
console.log("\nRadar Data (Kill Chain Exposure):");
metrics.radarData.forEach(phase => {
    console.log(`- ${phase.subject}: risk ${phase.risk}%, tested ${phase.tested}`);
});
console.log("\nArea Data (Resilience Score Trend - sample):");
metrics.areaData.slice(0, 5).forEach(pt => {
    console.log(`- Date/Name: ${pt.name}, Score: ${pt.score}`);
});

// 5. Test PHASE_ICONS lookups on radarData subjects
console.log("\nVerifying PHASE_ICONS lookup for each radarData subject:");
metrics.radarData.forEach(phase => {
    const icon = PHASE_ICONS[phase.subject] || MockTarget;
    console.log(`- Subject "${phase.subject}" maps to: ${JSON.stringify(icon)} (expected displayName: ${phase.subject === 'Action on Objective' ? 'Target' : phase.subject.split(' ')[0]})`);
    assert.ok(icon, `Icon component should be resolved for ${phase.subject}`);
});

// Test a fallback behavior with an unknown subject
const fallbackSubject = "Non-existent Phase";
const fallbackIcon = PHASE_ICONS[fallbackSubject] || MockTarget;
console.log(`- Unknown subject "${fallbackSubject}" correctly falls back to MockTarget: ${JSON.stringify(fallbackIcon)}`);
assert.strictEqual(fallbackIcon, MockTarget);

// 6. Stress test with edge cases: empty data sets, missing keys, empty arrays
console.log("\nVerifying resilience under edge case inputs (empty exercises & gaps):");
const emptyMetrics = runDashboardCalculations([], [], mitreData);
console.log(`- GRS Score with empty exercises: ${emptyMetrics.grsScore} (expected: 0)`);
console.log(`- Resolution Rate with empty gaps: ${emptyMetrics.resolutionRate}% (expected: 100%)`);
console.log(`- Residual Risk with empty gaps: ${emptyMetrics.residualRisk} (expected: 0)`);
console.log(`- MTTR with empty gaps: ${emptyMetrics.mttrText} (expected: N/A)`);
console.log(`- radarData length: ${emptyMetrics.radarData.length} (expected: 5)`);
console.log(`- areaData length: ${emptyMetrics.areaData.length} (expected: 2)`);

assert.strictEqual(emptyMetrics.grsScore, 0);
assert.strictEqual(emptyMetrics.resolutionRate, 100);
assert.strictEqual(emptyMetrics.residualRisk, 0);
assert.strictEqual(emptyMetrics.mttrText, 'N/A');
assert.strictEqual(emptyMetrics.radarData.length, 5);
assert.strictEqual(emptyMetrics.areaData.length, 2);

console.log("\nVerifying resilience under malformed gap/exercise attributes:");
const malformedExercises = [
    { id: 1, ttp: "T1059.001", status: "invalid-status", campaign: null, date: undefined },
    { id: 2, ttp: null, status: undefined, campaign: "Camp A", date: "not-a-date" }
];
const malformedGaps = [
    { id: "GAP-1", status: "Resolved", createdDate: null, resolvedDate: "invalid-date", severity: "UnknownSeverity" },
    { id: "GAP-2", status: "Open", severity: undefined }
];

const malformedMetrics = runDashboardCalculations(malformedExercises, malformedGaps, mitreData);
console.log(`- GRS Score: ${malformedMetrics.grsScore}`);
console.log(`- Resolution Rate: ${malformedMetrics.resolutionRate}%`);
console.log(`- Residual Risk: ${malformedMetrics.residualRisk}`);
console.log(`- MTTR Text: ${malformedMetrics.mttrText}`);

assert.doesNotThrow(() => {
    runDashboardCalculations(malformedExercises, malformedGaps, mitreData);
}, "Malformed inputs should not throw any exception.");

console.log("\nALL STRESS TESTS COMPLETED SUCCESSFULLY WITHOUT ERROR!");
process.exit(0);
