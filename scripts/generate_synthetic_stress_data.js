const fs = require('fs');
const path = require('path');

const ttps = [
    "T1566", "T1566.001", "T1566.002", "T1190", "T1133",
    "T1059", "T1059.001", "T1059.003", "T1059.004", "T1053.005", "T1204.002",
    "T1543.003", "T1098", "T1068", "T1548.002", "T1562.001", "T1070.004",
    "T1003.001", "T1110.001", "T1087.001", "T1082", "T1021.001", "T1021.002",
    "T1114.002", "T1005", "T1071.001", "T1090.001", "T1048.002", "T1486", "T1490"
];

const statuses = ['high', 'medium', 'minimal', 'low', 'na', 'error', 'pending'];
const environments = ["Linux", "Windows Server", "Windows Workstation", "macOS", "Azure / Entra ID"];
const severities = ['Critical', 'High', 'Medium', 'Low'];
const gapStatuses = ['Open', 'In Progress', 'Resolved', 'Risk Accepted'];

const exercises = [];
const gaps = [];

// Helper to get random item
function randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// Helper to generate a random environment array
function randomEnvs() {
    const num = Math.floor(Math.random() * 2) + 1; // 1 or 2 environments
    const res = [];
    while (res.length < num) {
        const env = randomChoice(environments);
        if (!res.includes(env)) {
            res.push(env);
        }
    }
    return res;
}

// Generate at least 10,000 exercises
const numExercises = 10500;
for (let i = 0; i < numExercises; i++) {
    const ttp = randomChoice(ttps);
    const status = randomChoice(statuses);
    const dateChoice = Math.random();
    let dateStr;
    if (dateChoice < 0.02) {
        dateStr = "";
    } else if (dateChoice < 0.04) {
        dateStr = null;
    } else if (dateChoice < 0.06) {
        dateStr = "invalid-date";
    } else {
        const d = new Date(Date.now() - Math.floor(Math.random() * 100 * 24 * 3600 * 1000));
        dateStr = d.toISOString();
    }

    exercises.push({
        id: String(1700000000000 + i),
        ttp: ttp,
        campaign: `Stress Campaign ${i % 20 + 1}`,
        finding: `Prevented ✓ Validated - Procedure ${i}`,
        remediation: `Remediation action plan for ${ttp}`,
        status: status,
        environment: randomEnvs(),
        date: dateStr
    });
}

// Generate at least 1,000 gaps
const numGaps = 1050;
for (let i = 0; i < numGaps; i++) {
    const ttp = randomChoice(ttps);
    const status = randomChoice(gapStatuses);
    const severity = randomChoice(severities);
    
    let priorityScore = 20;
    if (severity === 'Critical') priorityScore = 100;
    else if (severity === 'High') priorityScore = 80;
    else if (severity === 'Medium') priorityScore = 50;

    // Generate dates
    const createdDateRaw = new Date(Date.now() - Math.floor(Math.random() * 60 * 24 * 3600 * 1000) - 30 * 24 * 3600 * 1000);
    const createdDateStr = createdDateRaw.toISOString();

    let resolvedDateStr = null;
    if (status === 'Resolved') {
        const dateChoice = Math.random();
        if (dateChoice < 0.1) {
            // Out of sync dates (resolved before created)
            const resolvedDateRaw = new Date(createdDateRaw.getTime() - Math.floor(Math.random() * 5 * 24 * 3600 * 1000) - 1000);
            resolvedDateStr = resolvedDateRaw.toISOString();
        } else if (dateChoice < 0.15) {
            // Invalid date
            resolvedDateStr = "invalid-resolved-date";
        } else if (dateChoice < 0.2) {
            // Out of sync / invalid date mix
            resolvedDateStr = "2026-99-99";
        } else {
            // Normal staggered resolved date after createdDate
            const resolvedDateRaw = new Date(createdDateRaw.getTime() + Math.floor(Math.random() * 20 * 24 * 3600 * 1000) + 1000);
            resolvedDateStr = resolvedDateRaw.toISOString();
        }
    }

    gaps.push({
        id: String(1800000000000 + i),
        ttp: ttp,
        campaign: `Stress Campaign ${i % 20 + 1}`,
        finding: `Procedure ${i}`,
        details: `Execution: Checked behavior for ${ttp}\nDetection: Log analysis`,
        severity: severity,
        priorityScore: priorityScore,
        status: status,
        actionItems: "Implement detection rules.",
        stakeholders: ["Detection Engineering"],
        environment: randomEnvs(),
        createdDate: createdDateStr,
        resolvedDate: resolvedDateStr
    });
}

// Generate campaign summaries dynamically
const campaignSummaries = {};
for (let i = 1; i <= 20; i++) {
    const campName = `Stress Campaign ${i}`;
    campaignSummaries[campName] = {
        summary: `## Executive Summary for ${campName}\nThis is a stress test summary for ${campName}.`,
        details: {
            name: campName,
            environmentCategory: ["Linux", "Windows Server"],
            environment: "Mixed",
            goals: "Test system metrics resilience under high volume",
            participants: [
                { id: 1, name: "Stress Agent", role: "Purple Team" }
            ]
        },
        attackChain: "Simulated Attack Chain text",
        testResults: [], // Can populate or leave empty depending on need
        timestamp: new Date().toISOString()
    };
}

const output = {
    exercises,
    gaps,
    campaignSummaries,
    campaignEvidence: {}
};

const outputPath = path.resolve(__dirname, 'synthetic_stress_data.json');
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log(`Successfully generated massive synthetic stress dataset at ${outputPath}`);
console.log(`Generated ${exercises.length} exercises and ${gaps.length} gaps.`);
