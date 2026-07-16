const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, 'synthetic_stress_data.json');
const rawData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

let totalRecords = 0;
let invalidRecords = 0;
const errors = [];

function checkDomainRules(outcome, coverage) {
    if (outcome === 'Missed' && coverage !== 'None') return false;
    if (outcome === 'Prevented' && coverage !== 'Optimal') return false;
    // Strict correlation assumption based on domain rules
    if (outcome === 'Logged' && coverage !== 'Minimal' && coverage !== 'Partial') return false;
    if (outcome === 'Alerted' && coverage !== 'Partial' && coverage !== 'Optimal') return false;
    return true;
}

if (rawData.exercises && Array.isArray(rawData.exercises)) {
    rawData.exercises.forEach(res => {
        totalRecords++;
        const outcome = res.outcome;
        const coverage = res.coverageRating;
        
        if (outcome && coverage) {
            const isValid = checkDomainRules(outcome, coverage);
            if (!isValid) {
                invalidRecords++;
                errors.push(`Invalid pair: Outcome=${outcome}, Coverage=${coverage}`);
                
                // Fix the synthetic data directly
                if (outcome === 'Missed') res.coverageRating = 'None';
                else if (outcome === 'Prevented') res.coverageRating = 'Optimal';
                else if (outcome === 'Logged') res.coverageRating = 'Minimal'; // default fix
                else if (outcome === 'Alerted') res.coverageRating = 'Partial'; // default fix
            }
        }
    });
}

// Check Global Readiness Score
// Wait, we need to find where it's calculated in the React code and run it here.
let globalScore = 0;
// Actually I need to know the formula first.
// I will output the stats first.
console.log(`Total Records: ${totalRecords}`);
console.log(`Invalid Records: ${invalidRecords}`);

const counts = {};
errors.forEach(e => counts[e] = (counts[e] || 0) + 1);
if (invalidRecords > 0) {
    console.log("Unique Errors:");
    Object.entries(counts).forEach(([e, count]) => {
        console.log(`${count}x ${e}`);
    });
    
    // Save the fixed data
    fs.writeFileSync(dataPath, JSON.stringify(rawData, null, 2));
    console.log("Fixed synthetic_stress_data.json!");
}

