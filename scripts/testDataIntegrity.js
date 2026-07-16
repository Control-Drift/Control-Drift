const fs = require('fs');

function testRiskMath() {
    console.log("Testing Risk Math...");
    const severities = ['Critical', 'High', 'Medium', 'Low'];
    const coverages = ['Zero', 'Minimal', 'Partial', 'Optimal'];
    let errors = 0;

    severities.forEach(sev => {
        coverages.forEach(cov => {
            const baseScore = sev === 'Critical' ? 100 : sev === 'High' ? 80 : sev === 'Medium' ? 50 : 20;
            const multiplier = cov === 'Zero' || cov === 'None' ? 1.0 : cov === 'Minimal' ? 0.7 : cov === 'Partial' ? 0.4 : 0;
            const priorityScore = Math.floor(baseScore * multiplier);
            
            console.log(`Severity: ${sev}, Coverage: ${cov} -> Priority Score: ${priorityScore}`);
            
            if (isNaN(priorityScore) || priorityScore < 0 || priorityScore > 100) {
                console.error(`ERROR: Invalid priority score ${priorityScore} for ${sev}/${cov}`);
                errors++;
            }
        });
    });

    if (errors === 0) console.log("Risk math logic passed.");
}

function testMTTR() {
    console.log("\nTesting MTTR Logic...");
    const gaps = [];
    // Generate 500 random gaps
    for(let i = 0; i < 500; i++) {
        const createdDate = new Date(Date.now() - Math.random() * 10000000000).toISOString();
        // 50% resolved
        const isResolved = Math.random() > 0.5;
        const resolvedDate = isResolved ? new Date(new Date(createdDate).getTime() + Math.random() * 5000000000).toISOString() : null;
        
        gaps.push({
            id: `GAP-${i}`,
            status: isResolved ? 'Resolved' : 'Open',
            createdDate,
            resolvedDate
        });
    }

    const resolvedGaps = gaps.filter(g => g.status === 'Resolved' && g.resolvedDate && g.createdDate);
    if (resolvedGaps.length === 0) {
        console.log('MTTR: N/A');
        return;
    }
    
    const totalSeconds = resolvedGaps.reduce((acc, g) => {
        const diff = (new Date(g.resolvedDate) - new Date(g.createdDate)) / 1000;
        if (isNaN(diff)) console.error(`NaN detected for gap ${g.id}`);
        return acc + diff;
    }, 0);
    
    const meanSeconds = totalSeconds / resolvedGaps.length;
    const days = Math.floor(meanSeconds / (3600 * 24));
    const hours = Math.floor((meanSeconds % (3600 * 24)) / 3600);
    
    let mttrStr = '';
    if (days > 0) mttrStr = `${days}d ${hours}h`;
    else if (hours > 0) mttrStr = `${hours}h`;
    else mttrStr = '< 1h';

    console.log(`Calculated MTTR for ${resolvedGaps.length} resolved gaps: ${mttrStr}`);
    if (mttrStr.includes('NaN')) console.error("ERROR: MTTR calculation resulted in NaN");
    else console.log("MTTR logic passed.");
}

testRiskMath();
testMTTR();
