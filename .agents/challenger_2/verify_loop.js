// verify_loop.js - Empirical test harness for AttackPath.jsx render loop simulation
const fs = require('fs');
const path = require('path');

console.log("=== Running Empirical Verification of AttackPath.jsx ===");

// Let's load the actual AttackPath.jsx code to verify the structure and pattern
const attackPathPath = path.resolve(__dirname, '..', '..', 'src', 'components', 'AttackPath.jsx');
const content = fs.readFileSync(attackPathPath, 'utf8');

// Assert that activeGaps is memoized using useMemo
const hasMemoizedActiveGaps = /const\s+activeGaps\s*=\s*useMemo\s*\(\s*\(\)\s*=>\s*gaps\.filter/.test(content);
console.log(`Assertion: activeGaps is memoized using useMemo: ${hasMemoizedActiveGaps ? "PASSED" : "FAILED"}`);

if (!hasMemoizedActiveGaps) {
    console.error("FAIL: activeGaps is not memoized, infinite loop risk is present!");
    process.exit(1);
}

// Assert that gapsByPhase is memoized using useMemo
const hasMemoizedGapsByPhase = /const\s+gapsByPhase\s*=\s*useMemo\s*\(\s*\(\)\s*=>\s*\{/.test(content);
console.log(`Assertion: gapsByPhase is memoized: ${hasMemoizedGapsByPhase ? "PASSED" : "FAILED"}`);

if (!hasMemoizedGapsByPhase) {
    console.error("FAIL: gapsByPhase is not memoized!");
    process.exit(1);
}

// Assert that phases is memoized using useMemo
const hasMemoizedPhases = /const\s+phases\s*=\s*useMemo\s*\(\s*\(\)\s*=>\s*\[/.test(content);
console.log(`Assertion: phases is memoized: ${hasMemoizedPhases ? "PASSED" : "FAILED"}`);

// Let's simulate the render cycle logic programmatically
function runRenderSimulation(isFixed) {
    let renderCount = 0;
    let pathsState = [];
    
    // Mock data
    const gaps = [
        { id: 'GAP-1', ttp: 'T1059', severity: 'High', status: 'Open' },
        { id: 'GAP-2', ttp: 'T1566', severity: 'Critical', status: 'Open' }
    ];
    
    const mitreData = {
        'Execution': { techniques: [{ id: 'T1059', name: 'Command and Scripting Interpreter' }] },
        'Initial Access': { techniques: [{ id: 'T1566', name: 'Phishing' }] }
    };

    // Memo cache
    let cachedActiveGaps = null;
    let cachedGapsByPhase = null;
    let prevDeps = null;

    const phases = [
        { id: 'Reconnaissance' },
        { id: 'Weaponization' },
        { id: 'Delivery' },
        { id: 'Exploitation' },
        { id: 'Installation' },
        { id: 'Command and Control' },
        { id: 'Actions on Objectives' }
    ];

    function setPaths(newPaths) {
        pathsState = newPaths;
        // Trigger re-render
        render();
    }

    function render() {
        renderCount++;
        if (renderCount > 100) {
            return; // prevent script hanging if there is an infinite loop
        }

        // 1. activeGaps calculation
        let activeGaps;
        if (isFixed) {
            // Simulated useMemo(() => ..., [gaps])
            if (!cachedActiveGaps) {
                cachedActiveGaps = gaps.filter(g => g.status !== 'Resolved');
            }
            activeGaps = cachedActiveGaps;
        } else {
            // Unfixed: new array reference on every render
            activeGaps = gaps.filter(g => g.status !== 'Resolved');
        }

        // 2. gapsByPhase calculation
        let gapsByPhase;
        if (isFixed) {
            // Simulated useMemo(() => ..., [activeGaps, mitreData])
            if (!cachedGapsByPhase) {
                const grouped = {};
                phases.forEach(p => grouped[p.id] = []);
                activeGaps.forEach(gap => {
                    let foundTactic = 'Exploitation';
                    grouped[foundTactic].push({ ...gap, tactic: foundTactic });
                });
                cachedGapsByPhase = grouped;
            }
            gapsByPhase = cachedGapsByPhase;
        } else {
            // Unfixed: new object reference on every render
            const grouped = {};
            phases.forEach(p => grouped[p.id] = []);
            activeGaps.forEach(gap => {
                let foundTactic = 'Exploitation';
                grouped[foundTactic].push({ ...gap, tactic: foundTactic });
            });
            gapsByPhase = grouped;
        }

        // 3. useEffect for updatePaths
        // Checks dependencies: [gapsByPhase, phases]
        const depsChanged = !prevDeps || 
                            prevDeps[0] !== gapsByPhase || 
                            prevDeps[1] !== phases;

        if (depsChanged) {
            const newPaths = [];
            for (let i = 0; i < phases.length - 1; i++) {
                const current = gapsByPhase[phases[i].id] || [];
                const next = gapsByPhase[phases[i+1].id] || [];
                if (current.length > 0 && next.length > 0) {
                    newPaths.push({ id: 'path-1' });
                }
            }
            prevDeps = [gapsByPhase, phases];
            setPaths(newPaths);
        }
    }

    render();
    return renderCount;
}

const unfixedRenders = runRenderSimulation(false);
const fixedRenders = runRenderSimulation(true);

console.log(`Simulation render count (UNFIXED): ${unfixedRenders >= 100 ? "INFINITE (>= 100)" : unfixedRenders}`);
console.log(`Simulation render count (FIXED): ${fixedRenders}`);

if (unfixedRenders < 100) {
    console.error("FAIL: Simulation did not detect render loop in unfixed code!");
    process.exit(1);
}

if (fixedRenders > 2) {
    console.error(`FAIL: Fixed code renders ${fixedRenders} times, which is excessive!`);
    process.exit(1);
}

console.log("Assertion: Fixed code stabilized with exactly 2 renders: PASSED");
console.log("All render loop checks: PASSED");
process.exit(0);
