const performance = require('perf_hooks').performance;

// Mock data generator
const generateMockExercises = (count) => {
    const exercises = [];
    const tactics = [];
    for(let i=0; i<600; i++) tactics.push('T' + i);
    for (let i = 0; i < count; i++) {
        exercises.push({
            id: `ex-${i}`,
            ttp: tactics[i % tactics.length],
            status: ['high', 'medium', 'minimal', 'low'][i % 4],
            environment: ['Windows Workstation'],
            date: new Date().toISOString()
        });
    }
    return exercises;
};

// Mock MITRE Obj with 600 techniques
const mockMitreObj = {
    "Execution": {
        techniques: []
    }
};

for(let i=0; i<600; i++) {
    mockMitreObj["Execution"].techniques.push({ id: 'T' + i, name: "Tech " + i, status: "unknown", subTechniques: [] });
}

const recalculateMitreStatusesRefactored = (mitreObj, exercises = []) => {
    if (!mitreObj) return;

    // PRE-CALCULATE O(M)
    const exerciseMap = {};
    exercises.forEach(ex => {
        if (!exerciseMap[ex.ttp]) {
            exerciseMap[ex.ttp] = [];
        }
        if (['high', 'medium', 'minimal', 'low'].includes(ex.status)) {
            exerciseMap[ex.ttp].push(ex.status);
        }
    });

    for (const tactic in mitreObj) {
        const allTechs = mitreObj[tactic]?.techniques;
        if (!allTechs) continue;
        
        const parentSubsMap = {};
        allTechs.forEach(t => {
            if (t.id.includes('.')) {
                const parentId = t.id.split('.')[0];
                if (!parentSubsMap[parentId]) parentSubsMap[parentId] = [];
                parentSubsMap[parentId].push(t);
            }
        });

        const getAggStatus = (statuses) => {
            if (statuses.length === 0) return 'unknown';
            let total = 0;
            statuses.forEach(s => {
                if (s === 'high') total += 100;
                else if (s === 'medium') total += 50;
                else if (s === 'minimal') total += 25;
                else if (s === 'low') total += 0;
            });
            const avg = total / statuses.length;
            if (avg >= 75) return 'high';
            if (avg >= 25 && avg < 75) return 'medium';
            if (avg > 0 && avg < 25) return 'minimal';
            return 'low';
        };

        allTechs.forEach(t => {
            const hasSubs = !t.id.includes('.') && parentSubsMap[t.id];
            if (!hasSubs) {
                const statuses = exerciseMap[t.id] || [];
                if (statuses.length > 0) {
                    t.status = getAggStatus(statuses);
                } else {
                    t.status = 'unknown'; // Simplified for profile
                }
            }
        });
    }
    return mitreObj;
};

// Test
const exercises = generateMockExercises(100000);
const start = performance.now();
recalculateMitreStatusesRefactored(mockMitreObj, exercises);
const end = performance.now();

console.log(`Time taken to recalculate mitre statuses (REFACTORED) for 100,000 exercises and 600 techniques: ${(end - start).toFixed(2)} ms`);
