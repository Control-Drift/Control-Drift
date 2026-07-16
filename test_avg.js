const calculateAverageStatus = (statuses) => {
    const valid = statuses.filter(s => s === 'high' || s === 'medium' || s === 'minimal' || s === 'low');
    if (valid.length === 0) return 'unknown';
    const allOptimal = valid.every(s => s === 'high');
    if (allOptimal) return 'high';

    let totalScore = 0;
    valid.forEach(s => {
        if (s === 'high') totalScore += 3;
        else if (s === 'medium') totalScore += 2;
        else if (s === 'minimal') totalScore += 1;
    });
    const avg = totalScore / valid.length;
    
    let finalStatus = 'low';
    if (avg >= 2.5) finalStatus = 'high';
    else if (avg >= 1.5) finalStatus = 'medium';
    else if (avg >= 0.5) finalStatus = 'minimal';
    
    if (finalStatus === 'high' && !allOptimal) {
        finalStatus = 'medium';
    }
    
    return finalStatus;
};

console.log('Test 1 (low, minimal):', calculateAverageStatus(['low', 'minimal']));
console.log('Test 2 (low, medium):', calculateAverageStatus(['low', 'medium']));
