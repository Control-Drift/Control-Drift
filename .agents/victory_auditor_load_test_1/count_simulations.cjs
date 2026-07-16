const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', '..', 'synthetic_stress_data.json');
const rawData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const exercises = rawData.exercises || [];
const simulationCounts = {};

exercises.forEach(ex => {
    const sim = ex.campaign || ex.simulation || 'unknown';
    simulationCounts[sim] = (simulationCounts[sim] || 0) + 1;
});

console.log('Simulation counts in exercises:');
console.log(JSON.stringify(simulationCounts, null, 2));

console.log('Gaps status counts:');
const gapStatuses = {};
(rawData.gaps || []).forEach(gap => {
    gapStatuses[gap.status] = (gapStatuses[gap.status] || 0) + 1;
});
console.log(JSON.stringify(gapStatuses, null, 2));

console.log('Campaign summaries:');
console.log(Object.keys(rawData.campaignSummaries || {}));
