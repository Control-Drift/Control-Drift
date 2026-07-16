import assert from 'assert';

function getAggregatedScore(testResults) {
    let b = 0, a = 0, l = 0, m = 0;
    testResults.forEach(p => {
        let out = p.outcome;
        if (!out || out === 'N/A' || out === 'Error') return;
        if (out.includes(' ➔ ')) out = out.split(' ➔ ').pop();
        if (out === 'Prevented') b++;
        else if (out === 'Alerted') a++;
        else if (out === 'Logged') l++;
        else if (out === 'Missed') m++;
    });

    const total = b + a + l + m;
    if (total === 0) return { score: 0, outcome: 'N/A', coverageRating: 'N/A', count: 0 };
    
    const totalScore = (b * 100) + (a * 100) + (l * 50) + (m * 0);
    const avg = totalScore / total;

    let aggCoverage = 'None';
    let aggOutcome = 'Missed';
    let score = 0;
    
    if (avg === 100) {
        aggCoverage = 'Optimal';
        aggOutcome = b > 0 ? 'Prevented' : 'Alerted';
        score = 100;
    } else if (avg >= 50) {
        aggCoverage = 'Partial';
        aggOutcome = 'Logged';
        score = 50;
    } else if (avg > 0) {
        aggCoverage = 'Minimal';
        aggOutcome = 'Logged';
        score = 25;
    } else {
        aggCoverage = 'None';
        aggOutcome = 'Missed';
        score = 0;
    }
    return { score, outcome: aggOutcome, coverageRating: aggCoverage, count: total };
}

// Test 1: Prevented overrides Minimal (DA-1)
// 1 Prevented, 2 Missed -> Score = 100 / 3 = 33.3 -> Minimal Coverage
const res1 = getAggregatedScore([{outcome: 'Prevented'}, {outcome: 'Missed'}, {outcome: 'Missed'}]);
assert.strictEqual(res1.coverageRating, 'Minimal', 'Test 1 Failed');

// Test 2: Retest Parsing (DA-2)
// Missed ➔ Logged should parse as Logged. Score = 50.
const res2 = getAggregatedScore([{outcome: 'Missed ➔ Logged'}]);
assert.strictEqual(res2.coverageRating, 'Partial', 'Test 2 Failed');

// Test 3: Fractional logic
// 1 Prevented, 1 Missed -> Score = 100 / 2 = 50 -> Partial Coverage
const res3 = getAggregatedScore([{outcome: 'Prevented'}, {outcome: 'Missed'}]);
assert.strictEqual(res3.coverageRating, 'Partial', 'Test 3 Failed');

// Test 4: Dashboard calculation simulation (DA-3)
const contextGaps = [{status: 'Resolved'}, {status: 'Risk Accepted'}, {status: 'Open'}];
const applicableGaps = contextGaps.filter(g => g.status !== 'Risk Accepted');
const totalGaps = applicableGaps.length;
const closedGaps = applicableGaps.filter(g => g.status === 'Resolved').length;
const resolutionRate = totalGaps > 0 ? Math.round((closedGaps / totalGaps) * 100) : 100;
assert.strictEqual(resolutionRate, 50, 'Test 4 Failed'); // 1 / 2

console.log("All Mathematical Tests Passed Successfully!");
