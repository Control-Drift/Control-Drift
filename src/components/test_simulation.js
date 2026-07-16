/*
 * Copyright 2024 Control Drift Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const fs = require('fs');

// 1. Extract getAggregatedScore logic
const getAggregatedScore = (procs) => {
    if (procs.length === 0) return { score: 0, outcome: 'N/A', coverageRating: 'N/A', count: 0 };
    
    let b = 0, a = 0, l = 0, m = 0;
    
    procs.forEach(p => {
       let out = p.outcome;
       if (!out || out === 'N/A' || out === 'Error') return;
       if (out.includes(' ➔ ')) out = out.split(' ➔ ')[1];
       
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
    
    return { score, outcome: aggOutcome, coverageRating: aggCoverage, count: total, avg };
};

console.log("--- Testing getAggregatedScore ---");

// Test 1: Fractional division (e.g., 2 Missed, 1 Logged)
// total = 3, l=1, m=2
// totalScore = 50. avg = 50/3 = 16.666
const res1 = getAggregatedScore([ { outcome: 'Missed' }, { outcome: 'Missed' }, { outcome: 'Logged' } ]);
console.log("Fractional:", res1); 
// bug? avg > 0 (16.66) -> Minimal, score 25. Correct? If Minimal is > 0 and < 50.

// Test 2: Retest outcomes
const res2 = getAggregatedScore([ { outcome: 'Missed ➔ Alerted' } ]);
console.log("Retest:", res2); 
// Should be totalScore 100, avg 100 -> Optimal, Alerted.

// Test 3: Dashboard Resolution Rate Logic
const dashboardRate = (gaps) => {
    const applicableGaps = gaps.filter(g => g.status !== 'Risk Accepted');
    const totalGaps = applicableGaps.length;
    const closedGaps = applicableGaps.filter(g => g.status === 'Resolved').length;
    return totalGaps > 0 ? Math.round((closedGaps / totalGaps) * 100) : 100;
};
const gaps = [
    { status: 'Risk Accepted' },
    { status: 'Resolved' },
    { status: 'Open' }
];
console.log("Dashboard Rate:", dashboardRate(gaps), "%. Should be 1/2 = 50%. Is Risk Accepted ignored?");

// Test 4: Priority Score Math
const getPriorityScore = (severity, coverageRating) => {
    const baseScore = severity === 'Critical' ? 100 : severity === 'High' ? 80 : severity === 'Medium' ? 50 : 20;
    const visibilityMultiplier = (coverageRating === 'None') ? 1.0 : (coverageRating === 'Minimal' ? 0.8 : 0.6);
    return Math.round(baseScore * visibilityMultiplier);
};
console.log("Priority Score (High, None):", getPriorityScore('High', 'None')); // 80 * 1 = 80
console.log("Priority Score (Medium, Minimal):", getPriorityScore('Medium', 'Minimal')); // 50 * 0.8 = 40

