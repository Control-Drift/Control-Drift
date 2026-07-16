const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', '..', 'synthetic_stress_data.json.bak');
if (!fs.existsSync(dataPath)) {
    console.log('No backup file found.');
    process.exit(0);
}
const rawData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const exercises = rawData.exercises || [];
const simulationCounts = {};

exercises.forEach(ex => {
    const sim = ex.campaign || ex.simulation || 'unknown';
    simulationCounts[sim] = (simulationCounts[sim] || 0) + 1;
});

console.log('Simulation counts in backup exercises:');
console.log(JSON.stringify(simulationCounts, null, 2));
