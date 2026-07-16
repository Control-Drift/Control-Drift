const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, 'synthetic_stress_data.json');
const rawData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

let totalRecords = 0;
let invalidRecords = 0;
const errors = [];

function validateDomainRules(outcome, coverage) {
    if (outcome.startsWith('Missed') && coverage !== 'None') return false;
    if (outcome.startsWith('Prevented') && coverage !== 'Optimal') return false;
    if (outcome.startsWith('Alerted') && coverage !== 'Optimal' && coverage !== 'Partial') return false; // Not sure, but strict rules: "Missed -> None. Prevented -> Optimal."
    return true;
}

// Inspect the structure of rawData
console.log(Object.keys(rawData));
if (rawData.exercises) {
    console.log("exercises:", rawData.exercises.length);
}
if (rawData.simulationSummaries) {
    console.log("simulationSummaries count:", Object.keys(rawData.simulationSummaries).length);
    Object.values(rawData.simulationSummaries).forEach(sim => {
        if (sim.testResults) {
            sim.testResults.forEach(res => {
                totalRecords++;
                let outcome = res.outcome || '';
                if (outcome.includes(' ➔ ')) outcome = outcome.split(' ➔ ')[1];
                const coverage = res.coverageRating;
                
                let isValid = true;
                if (outcome === 'Missed' && coverage !== 'None') isValid = false;
                if (outcome === 'Prevented' && coverage !== 'Optimal') isValid = false;
                if (outcome === 'Logged' && coverage === 'Optimal') isValid = false; // Is this a rule?
                if (outcome === 'Alerted' && coverage === 'None') isValid = false;
                
                if (!isValid) {
                    invalidRecords++;
                    errors.push(`Invalid pair: Outcome=${outcome}, Coverage=${coverage}`);
                }
            });
        }
    });
}

console.log(`Total Records: ${totalRecords}`);
console.log(`Invalid Records: ${invalidRecords}`);
if (errors.length > 0) {
    const uniqueErrors = [...new Set(errors)];
    console.log("Unique Errors:");
    console.log(uniqueErrors.join('\n'));
}

// Calculate Global Readiness Score
// We need to see how Global Readiness Score is calculated.
