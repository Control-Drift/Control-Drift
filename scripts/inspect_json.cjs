const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, 'synthetic_stress_data.json');
const rawData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

if (Object.keys(rawData.campaignSummaries || {}).length > 0) {
    const firstKey = Object.keys(rawData.campaignSummaries)[0];
    console.log(typeof rawData.campaignSummaries[firstKey]);
    console.log(JSON.stringify(rawData.campaignSummaries[firstKey]).substring(0, 500));
}

console.log('exercises count:', rawData.exercises ? rawData.exercises.length : 0);
if (rawData.exercises && rawData.exercises.length > 0) {
    console.log(rawData.exercises[0]);
}
