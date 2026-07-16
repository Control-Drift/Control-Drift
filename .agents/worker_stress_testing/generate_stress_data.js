import fs from 'fs';
import path from 'path';

// 1. Define TTPs
const ttps = [
  "T1059.001", "T1059.003", "T1059.004", "T1566.001", "T1566.002", "T1003.001", "T1053.005", "T1021.001", "T1071.001", "T1082", "T1083", "T1047",
  "T1548.002", "T1134", "T1036", "T1070", "T1112", "T1007", "T1012", "T1016", "T1018", "T1033", "T1049", "T1057", "T1069", "T1078", "T1105", "T1041",
  "T1567", "T1485", "T1486", "T1489", "T1490", "T1531", "T1210", "T1570", "T1021.002", "T1072", "T1133", "T1562.001", "T1056.001", "T1113", "T1114",
  "T1115", "T1119", "T1020", "T1005", "T1039", "T1025", "T1074", "T1059", "T1566", "T1003", "T1053", "T1021", "T1071", "T1562", "T1056"
];

// Generate 60 exercises
const exercises = [];
// Generate legacy exercises with empty/invalid dates
const legacyDates = ["", null, "invalid-date", "2026-99-99", "not-a-date-at-all"];

for (let i = 0; i < 60; i++) {
  const ttp = ttps[i % ttps.length];
  
  // Status distribution: 35 high, 12 medium, 8 low, 5 na
  let status = 'low';
  if (i < 35) {
    status = 'high';
  } else if (i < 47) {
    status = 'medium';
  } else if (i < 55) {
    status = 'low';
  } else {
    status = 'na';
  }

  // Date assignment: first 5 have legacy/invalid dates
  let dateVal;
  if (i < 5) {
    dateVal = legacyDates[i];
  } else {
    dateVal = new Date(Date.now() - i * 24 * 3600 * 1000).toISOString();
  }

  exercises.push({
    id: 1700000000000 + i,
    ttp: ttp,
    campaign: `Stress Campaign ${(i % 5) + 1}`,
    finding: status === 'high' ? 'Prevented ✓ Validated' : status === 'medium' ? 'Logged (Validation)' : status === 'na' ? 'N/A' : 'Missed',
    remediation: `Remediation action plan for ${ttp}`,
    status: status,
    environment: i % 2 === 0 ? ["Linux"] : ["Windows Server", "Active Directory"],
    date: dateVal
  });
}

// Generate 120 gaps
const gaps = [];
const severities = ['Critical', 'High', 'Medium', 'Low'];
const statuses = ['Open', 'In Progress', 'Resolved', 'Risk Accepted'];

// Resolution times for 40 resolved gaps (in hours)
// We want to test different dates to verify MTTR formatting
const resolutionTimes = [
  2, 4, 6, 8, 12, 18, 24, 36, 48, 72, 96, 120, 144, 168, // various hours and days
  3, 5, 7, 9, 15, 21, 28, 42, 56, 84, 110, 130, 150, 180,
  1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5, 11.5, 12.5
];

for (let i = 0; i < 120; i++) {
  const ttp = ttps[(i + 5) % ttps.length];
  
  // Distribute severities: 25 Critical, 45 High, 30 Medium, 20 Low
  let severity = 'Low';
  if (i < 25) severity = 'Critical';
  else if (i < 70) severity = 'High';
  else if (i < 100) severity = 'Medium';

  // Distribute statuses: 30 Open, 30 In Progress, 40 Resolved, 20 Risk Accepted
  let status = 'Risk Accepted';
  if (i < 30) status = 'Open';
  else if (i < 60) status = 'In Progress';
  else if (i < 100) status = 'Resolved';

  const createdDate = new Date(Date.now() - (i * 3 + 10) * 24 * 3600 * 1000);
  let resolvedDate = null;

  if (status === 'Resolved') {
    const resHours = resolutionTimes[i % resolutionTimes.length];
    resolvedDate = new Date(createdDate.getTime() + resHours * 3600 * 1000).toISOString();
  }

  // Inject one resolved gap with invalid date to test codebase failure
  if (i === 99) {
    resolvedDate = "invalid-date";
  }

  gaps.push({
    id: 1800000000000 + i,
    ttp: ttp,
    campaign: `Stress Campaign ${(i % 5) + 1}`,
    finding: `Procedure ${i + 1}`,
    details: `Execution: Checked behavior for ${ttp}\nDetection: Log analysis`,
    severity: severity,
    priorityScore: severity === 'Critical' ? 100 : severity === 'High' ? 80 : severity === 'Medium' ? 50 : 20,
    status: status,
    actionItems: 'Implement detection rules.',
    stakeholders: ['Detection Engineering'],
    environment: i % 2 === 0 ? ["Linux"] : ["Windows Server"],
    createdDate: createdDate.toISOString(),
    resolvedDate: resolvedDate
  });
}

// Generate campaign summaries with validated outcomes
const campaignSummaries = {};
for (let c = 1; c <= 5; c++) {
  const campaignName = `Stress Campaign ${c}`;
  const testResults = [];
  
  // Each campaign has 5 procedures with various outcomes
  for (let p = 1; p <= 5; p++) {
    let outcome = 'Missed';
    if (p === 1) outcome = 'Prevented ✓ Validated';
    else if (p === 2) outcome = 'Logged (Validation)';
    else if (p === 3) outcome = 'Missed (Validation)';
    else if (p === 4) outcome = 'Alerted';
    else outcome = 'Prevented';

    testResults.push({
      id: 2000000000000 + c * 10 + p,
      name: `Procedure C${c} P${p}`,
      ttps: [ttps[(c * p) % ttps.length]],
      eventType: 'Payload',
      payloadCode: `echo "Testing procedure ${p} for campaign ${c}"`,
      expectedOutcome: 'Prevented',
      outcome: outcome,
      execNotes: `Executed procedure ${p}`,
      detNotes: `Detection log for procedure ${p}`,
      severity: outcome.includes('Prevented') || outcome.includes('Alerted') ? 'N/A' : 'High'
    });
  }

  campaignSummaries[campaignName] = {
    summary: `## Executive Summary for Campaign ${c}\nThis is a stress test summary for Campaign ${c}.`,
    details: {
      name: campaignName,
      environmentCategory: ["Linux", "Windows Server"],
      environment: "Mixed",
      goals: "Test system metrics resilience under high volume",
      participants: [{ id: 1, name: "Stress Agent", role: "Purple Team" }]
    },
    attackChain: "Simulated Attack Chain text",
    testResults: testResults,
    timestamp: new Date().toISOString()
  };
}

const campaignEvidence = {}; // Empty or minimal map

const outputData = {
  exercises: exercises,
  gaps: gaps,
  campaignSummaries: campaignSummaries,
  campaignEvidence: campaignEvidence
};

// Write output
const outputPath = path.join('C:', 'Users', 'thoma', '.gemini', 'antigravity', 'scratch', 'eclipse-ops', 'synthetic_stress_data.json');
fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
console.log(`Successfully wrote synthetic stress data to: ${outputPath}`);

// -------------------------------------------------------------
// METRICS COMPARISON CALCULATIONS
// -------------------------------------------------------------

// Helper: Calculate GRS Codebase
function calculateGrsCodebase(exercisesList) {
  const totalValidated = exercisesList.length;
  let grsPoints = 0;
  exercisesList.forEach(ex => {
    if (ex.status === 'high') grsPoints += 1.0;
    else if (ex.status === 'medium') grsPoints += 0.5;
  });
  return totalValidated > 0 ? Math.round((grsPoints / totalValidated) * 100) : 0;
}

// Helper: Calculate GRS Correct
function calculateGrsCorrect(exercisesList) {
  const validExercises = exercisesList.filter(ex => ex.status !== 'na');
  const totalValidated = validExercises.length;
  let grsPoints = 0;
  validExercises.forEach(ex => {
    if (ex.status === 'high') grsPoints += 1.0;
    else if (ex.status === 'medium') grsPoints += 0.5;
  });
  return totalValidated > 0 ? Math.round((grsPoints / totalValidated) * 100) : 0;
}

// Helper: Calculate MTTR Codebase (safe/unsafe)
function calculateMttrCodebase(gapsList) {
  const resolvedGaps = gapsList.filter(g => g.status === 'Resolved' && g.resolvedDate && g.createdDate);
  if (resolvedGaps.length === 0) return 'N/A';
  
  // Evaluates how the codebase code handles dates
  let totalSeconds = 0;
  let hasNaN = false;
  for (const g of resolvedGaps) {
    const diff = (new Date(g.resolvedDate) - new Date(g.createdDate)) / 1000;
    if (isNaN(diff)) {
      hasNaN = true;
    }
    totalSeconds += diff;
  }
  
  if (hasNaN || isNaN(totalSeconds)) {
    return 'NaN (Bug! Invalid date breaks the calculation)';
  }
  
  const meanSeconds = totalSeconds / resolvedGaps.length;
  const days = Math.floor(meanSeconds / (3600 * 24));
  const hours = Math.floor((meanSeconds % (3600 * 24)) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h`;
  return '< 1h';
}

// Helper: Calculate MTTR Correct (ignoring invalid dates)
function calculateMttrCorrect(gapsList) {
  const resolvedGaps = gapsList.filter(g => {
    if (g.status !== 'Resolved' || !g.resolvedDate || !g.createdDate) return false;
    const diff = new Date(g.resolvedDate) - new Date(g.createdDate);
    return !isNaN(diff) && diff >= 0;
  });
  if (resolvedGaps.length === 0) return 'N/A';
  
  const totalSeconds = resolvedGaps.reduce((acc, g) => acc + (new Date(g.resolvedDate) - new Date(g.createdDate)) / 1000, 0);
  const meanSeconds = totalSeconds / resolvedGaps.length;
  const days = Math.floor(meanSeconds / (3600 * 24));
  const hours = Math.floor((meanSeconds % (3600 * 24)) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h`;
  return '< 1h';
}

// Helper: Calculate Weighted Residual Risk
function calculateWeightedResidualRisk(gapsList) {
  const openGaps = gapsList.filter(g => g.status === 'Open' || g.status === 'In Progress');
  const severityWeights = { 'Critical': 10, 'High': 7, 'Medium': 3, 'Low': 1 };
  return openGaps.reduce((acc, g) => acc + (severityWeights[g.severity] || 0), 0);
}

// -------------------------------------------------------------
// RUN CALCULATIONS
// -------------------------------------------------------------

console.log("\n=================================================");
console.log("METRICS EVALUATION AND FORMULA COMPARISON REPORT");
console.log("=================================================");

// 1. Global Resilience Score (GRS)
const grsCodebaseVal = calculateGrsCodebase(exercises);
const grsCorrectVal = calculateGrsCorrect(exercises);
console.log(`Global Resilience Score (GRS):`);
console.log(`  - Codebase GRS Formula: ${grsCodebaseVal}%`);
console.log(`  - Correct GRS Formula:  ${grsCorrectVal}%`);
console.log(`  - Metric Drift/Gap:      ${grsCodebaseVal - grsCorrectVal}% difference.`);
console.log(`  - Explanation: The codebase includes 'na' status exercises in the denominator, penalizing the score.`);

// 2. MTTR
const mttrCodebaseVal = calculateMttrCodebase(gaps);
const mttrCorrectVal = calculateMttrCorrect(gaps);
console.log(`\nMean Time to Remediate (MTTR):`);
console.log(`  - Codebase MTTR Formula: ${mttrCodebaseVal}`);
console.log(`  - Correct MTTR Formula:  ${mttrCorrectVal}`);
console.log(`  - Explanation: A single resolved gap with an invalid resolvedDate ("invalid-date") causes the codebase's MTTR calculation to return NaN, breaking the entire UI display.`);

// 3. Weighted Residual Risk
const weightedRiskVal = calculateWeightedResidualRisk(gaps);
const openGapsCount = gaps.filter(g => g.status === 'Open' || g.status === 'In Progress').length;
console.log(`\nWeighted Residual Risk:`);
console.log(`  - Score: ${weightedRiskVal}`);
console.log(`  - Active Gaps Count: ${openGapsCount} (30 Open, 30 In Progress)`);
console.log(`  - Weights details: Critical (10 pts), High (7 pts), Medium (3 pts), Low (1 pt)`);

const activeGaps = gaps.filter(g => g.status === 'Open' || g.status === 'In Progress');
const countBySev = { Critical: 0, High: 0, Medium: 0, Low: 0 };
activeGaps.forEach(g => { countBySev[g.severity] = (countBySev[g.severity] || 0) + 1; });
console.log(`  - Actual Active Gaps by Severity:`, countBySev);
const computedRisk = (countBySev.Critical * 10) + (countBySev.High * 7) + (countBySev.Medium * 3) + (countBySev.Low * 1);
console.log(`  - Computed Risk: ${computedRisk}`);

// 4. TTP rollup outcome comparison
console.log(`\nTTP Roll-up Outcomes Mismatches:`);
console.log(`  Scenario A: A technique has procedures with an average score of 70%`);
console.log(`    - Campaign Launcher (ExerciseWizard) Rollup: score=70% (>=60), outcome is "Alerted", status maps to "high" (Prevented/Alerted, green)`);
console.log(`    - Inline Validation (AppContext) Rollup: score=70% (<75), status maps to "medium" (Logged, yellow)`);
console.log(`    - Outcome Drift: 15% threshold discrepancy maps same score to different statuses!`);

console.log(`\n  Scenario B: Procedure has validated outcome 'Prevented ✓ Validated'`);
console.log(`    - Campaign Launcher (ExerciseWizard) Rollup: uses exact matching (outcome === 'Prevented'). Value 'Prevented ✓ Validated' gives 0 points (Missed!).`);
console.log(`    - Inline Validation (AppContext) Rollup: uses out.startsWith('Prevented'). Value gives 100 points (Prevented!).`);
console.log(`    - Outcome Drift: Validated exercises are penalized in the Campaign Launcher!`);
