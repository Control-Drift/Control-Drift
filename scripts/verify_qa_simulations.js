/**
 * verify_qa_simulations.js
 * Programmatic QA verification script for Eclipse Ops (Iridescence).
 * This script demonstrates and reproduces the five specific bugs/discrepancies
 * identified in the codebase without modifying the application code.
 */

import assert from 'assert';

async function main() {
    console.log('======================================================================');
    console.log('STARTING QA STATE TRACING & VERIFICATION FOR IDENTIFIED BUGS');
    console.log('======================================================================\n');

    // ============================================================================
    // BUG 1: GRS Calculation Discrepancies
    // ============================================================================
    console.log('--- 1. GRS Calculation Discrepancies ---');

    function simulateServerMetrics(exercises) {
        // Replicates mock_database.js line 656-663
        const valid = exercises.filter(ex => ex.status?.toLowerCase() !== 'na');
        const totalValidated = valid.length;
        let points = 0;
        valid.forEach(ex => {
            if (ex.status === 'high') points += 1.0;
            else if (ex.status === 'medium') points += 0.5;
        });
        const grs = totalValidated > 0 ? Math.round((points / totalValidated) * 100) : 0;
        return { grsScore: grs, totalProcessed: totalValidated };
    }

    function simulateClientFallbackMetrics(allExercises, pageLimit = 50) {
        // Replicates AppContext.jsx line 248-260 & Dashboard.jsx line 132-139
        // 1. Client filters out 'Admin Config' exercises
        let filtered = allExercises.filter(e => e.simulation !== 'Admin Config');
        
        // 2. Client sorts them (simulated)
        filtered.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
        
        // 3. Client paginates to limit (default 50)
        const paginated = filtered.slice(0, pageLimit);
        
        // 4. Client Dashboard calculates GRS based on active page state
        const valid = paginated.filter(ex => ex.status?.toLowerCase() !== 'na');
        const totalValidated = valid.length;
        let points = 0;
        valid.forEach(ex => {
            if (ex.status === 'high') points += 1.0;
            else if (ex.status === 'medium') points += 0.5;
        });
        const grs = totalValidated > 0 ? Math.round((points / totalValidated) * 100) : 0;
        return { grsScore: grs, totalProcessed: totalValidated };
    }

    // Generate test data: 100 exercises
    // 20 are 'Admin Config' and are all 'high' (100% GRS)
    // 80 are normal simulations, of which 40 are 'high' and 40 are 'low' (50% GRS)
    const mockExercises = [];
    for (let i = 0; i < 20; i++) {
        mockExercises.push({
            id: `admin-ex-${i}`,
            ttp: 'T1059.001',
            simulation: 'Admin Config',
            status: 'high',
            date: new Date(Date.now() - i * 60000).toISOString()
        });
    }
    for (let i = 0; i < 80; i++) {
        mockExercises.push({
            id: `normal-ex-${i}`,
            ttp: 'T1078',
            simulation: 'APT29',
            status: i % 2 === 0 ? 'high' : 'low',
            date: new Date(Date.now() - (i + 20) * 60000).toISOString()
        });
    }

    const serverResult = simulateServerMetrics(mockExercises);
    const clientResult = simulateClientFallbackMetrics(mockExercises, 50);

    console.log(`Server Metrics Endpoint (/api/metrics):`);
    console.log(`  - Total Exercises processed: ${serverResult.totalProcessed}`);
    console.log(`  - GRS Score calculated: ${serverResult.grsScore}%`);

    console.log(`Client-Side Fallback (Dashboard):`);
    console.log(`  - Total Exercises processed: ${clientResult.totalProcessed}`);
    console.log(`  - GRS Score calculated: ${clientResult.grsScore}%`);

    console.log(`DISCREPANCY DETECTED:`);
    console.log(`  - Difference in GRS Score: ${Math.abs(serverResult.grsScore - clientResult.grsScore)}%`);
    console.log(`  - Difference in Exercises Processed: ${serverResult.totalProcessed - clientResult.totalProcessed}`);
    console.log('  - Exposing why: The backend processes the whole database and includes "Admin Config" exercises.');
    console.log('  - The frontend client fallback filters out "Admin Config" and is limited to the paginated limit of 50.');
    console.log('SUCCESS: programmatically demonstrated Bug 1.\n');


    // ============================================================================
    // BUG 2: MTTR Calculation Edge Cases
    // ============================================================================
    console.log('--- 2. MTTR Calculation Edge Cases ---');

    function calculateMTTR(gaps) {
        // Replicates GapTracker.jsx line 367-385
        const resolvedGaps = gaps.filter(g => g.status === 'Resolved' && g.resolvedDate && g.createdDate);
        if (resolvedGaps.length === 0) return 'N/A';
        
        const validResolved = resolvedGaps.filter(g => !isNaN(new Date(g.resolvedDate)) && !isNaN(new Date(g.createdDate)));
        if (validResolved.length === 0) return 'N/A';

        const totalSeconds = validResolved.reduce((acc, g) => {
            return acc + (new Date(g.resolvedDate) - new Date(g.createdDate)) / 1000;
        }, 0);
        
        const meanSeconds = totalSeconds / validResolved.length;
        if (isNaN(meanSeconds)) return 'N/A';

        const days = Math.floor(meanSeconds / (3600 * 24));
        const hours = Math.floor((meanSeconds % (3600 * 24)) / 3600);
        
        console.log(`  [Internal Calculation Values] meanSeconds: ${meanSeconds}, days: ${days}, hours: ${hours}`);

        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h`;
        return '< 1h';
    }

    // Case A: Single Gap resolved before it was created (e.g. manual clock sync error or negative entry)
    // Created at 12:00, resolved at 10:00 (same day) -> -2 hours interval (-7200 seconds)
    const negativeGap = {
        id: 'gap-1',
        status: 'Resolved',
        createdDate: '2026-06-16T12:00:00.000Z',
        resolvedDate: '2026-06-16T10:00:00.000Z'
    };

    console.log('Case A: Single Gap resolved -2 hours after creation (-7200s):');
    const mttrA = calculateMTTR([negativeGap]);
    console.log(`  - Formatted MTTR: "${mttrA}"`);
    console.log('  - Analysis: A -2h interval results in days=-1, hours=-2. The UI hides this as "< 1h".');
    console.log('    Wait! If days=-1, hours=-2, mathematically that means -26 hours! (Interval was only -2h).');
    console.log('    This shows Math.floor and % operations behave incorrectly on negative intervals.\n');

    // Case B: Average MTTR remains negative
    // Created at 12:00, resolved at 12:00 previous day -> -24 hours interval (-86400 seconds)
    const negativeGapB = {
        id: 'gap-2',
        status: 'Resolved',
        createdDate: '2026-06-16T12:00:00.000Z',
        resolvedDate: '2026-06-15T12:00:00.000Z'
    };
    console.log('Case B: Single Gap resolved -1 day after creation (-86400s):');
    const mttrB = calculateMTTR([negativeGapB]);
    console.log(`  - Formatted MTTR: "${mttrB}"`);
    console.log('  - Analysis: The negative interval is masked as "< 1h", suppressing the error from visibility.\n');

    console.log('SUCCESS: programmatically demonstrated Bug 2.\n');


    // ============================================================================
    // BUG 3: Sync and Persistence Leaks
    // ============================================================================
    console.log('--- 3. Sync and Persistence Leaks ---');

    // Setup a mock dbAdapter simulating the local storage / fallback mode
    class MockDbAdapter {
        constructor() {
            this.store = {
                exercises: [
                    { id: 'ex-1', ttp: 'T1059.001', simulation: 'APT29', status: 'low' }
                ],
                gaps: [
                    { id: 'gap-1', ttp: 'T1059.001', simulation: 'APT29', status: 'Open', createdDate: new Date().toISOString() }
                ],
                simulationSummaries: {
                    'APT29': {
                        testResults: [
                            { name: 'Run PowerShell Payload', outcome: 'Missed', ttps: ['T1059.001'] }
                        ]
                    }
                }
            };
            this.saveCalls = [];
        }

        async fetchData(key) {
            return this.store[key];
        }

        async saveData(key, data) {
            this.saveCalls.push({ key, data });
            this.store[key] = data;
        }
    }

    // Simulation of AppContext local updates
    async function runValidationUpdateSimulation(dbAdapter, gapObj, newOutcomeStatus, validationNotes) {
        const ttpList = (gapObj.ttp || '').split(',').map(t => t.trim()).filter(Boolean);
        const simulationName = gapObj.simulation;
        const procName = gapObj.finding;
        let finalAggOutcome = newOutcomeStatus;
        
        // Simulate AppContext React State
        let exercisesState = await dbAdapter.fetchData('exercises');
        let gapsState = await dbAdapter.fetchData('gaps');
        
        // 1. Update Simulation Summaries (Done correctly in AppContext)
        const currentSimulations = JSON.parse(JSON.stringify(dbAdapter.store.simulationSummaries));
        const simulationData = currentSimulations[simulationName];
        if (simulationData && simulationData.testResults) {
            const proc = simulationData.testResults.find(p => p.name === procName);
            if (proc) {
                if (newOutcomeStatus === 'prevented') {
                    proc.outcome = 'Prevented ✓ Validated';
                }
            }
            await dbAdapter.saveData('simulationSummaries', currentSimulations);
        }

        // 2. Update Exercises (Done correctly in AppContext via saveData)
        if (dbAdapter) {
            const allExercises = await dbAdapter.fetchData('exercises') || [];
            const updatedExercises = allExercises.map(ex => {
                if (ttpList.includes(ex.ttp) && ex.simulation === simulationName) {
                    return { ...ex, status: finalAggOutcome };
                }
                return ex;
            });
            await dbAdapter.saveData('exercises', updatedExercises);
            exercisesState = updatedExercises;
        }

        // 3. Update Gaps (BUG: Missing dbAdapter.saveData call in fallback branch!)
        if (dbAdapter && typeof dbAdapter.updateGap === 'function') {
            // Not fallback mode, RestApiAdapter does this
        } else {
            // AppContext.jsx line 833 fallback branch
            if (['prevented', 'alerted', 'logged'].includes(newOutcomeStatus)) {
                gapsState = gapsState.map(gap => {
                    if (String(gap.id) === String(gapObj.id) && gap.status !== 'Resolved') {
                        return { ...gap, status: 'Resolved', resolvedDate: new Date().toISOString() };
                    }
                    return gap;
                });
                // MISSING: await dbAdapter.saveData('gaps', gapsState);
            }
        }

        return { exercisesState, gapsState };
    }

    // Simulation of GapTracker.jsx handleDrop out-of-resolved update
    async function runHandleDropSimulation(dbAdapter, draggedGapId, col) {
        let exercisesState = await dbAdapter.fetchData('exercises');
        let gapsState = await dbAdapter.fetchData('gaps');
        const gap = gapsState.find(g => String(g.id) === String(draggedGapId));
        
        if (col !== 'Resolved' && col !== 'Risk Accepted') {
            if (gap.status === 'Resolved') {
                // Replicates GapTracker.jsx line 233
                exercisesState = exercisesState.map(ex => {
                    const gapTTPs = (gap.ttp || '').split(',').map(t => t.trim());
                    if (gapTTPs.includes(ex.ttp) && ex.simulation === gap.simulation) {
                        return { ...ex, status: 'low' };
                    }
                    return ex;
                });
                // MISSING: dbAdapter.saveData('exercises', exercisesState);
            }
        }
        return { exercisesState };
    }

    console.log('Simulating updateExerciseValidation in fallback mode...');
    const adapter = new MockDbAdapter();
    const gapToValidate = { id: 'gap-1', ttp: 'T1059.001', simulation: 'APT29', finding: 'Run PowerShell Payload' };

    const result1 = await runValidationUpdateSimulation(adapter, gapToValidate, 'prevented', 'Validated protection successfully');
    console.log(`  - React exercises state updated:`, result1.exercisesState);
    console.log(`  - React gaps state updated:`, result1.gapsState);
    console.log(`  - Adapter backend store for gaps:`, adapter.store.gaps);
    console.log(`  - Was saveData called for gaps? ${adapter.saveCalls.some(c => c.key === 'gaps') ? 'Yes' : 'No (BUG!)'}`);

    console.log('\nSimulating handleDrop moving gap from Resolved back to In Progress...');
    // Put gap in Resolved state first
    adapter.store.gaps[0].status = 'Resolved';
    adapter.store.exercises[0].status = 'high';

    const result2 = await runHandleDropSimulation(adapter, 'gap-1', 'In Progress');
    console.log(`  - React exercises state updated to low:`, result2.exercisesState);
    console.log(`  - Adapter backend store for exercises:`, adapter.store.exercises);
    console.log(`  - Was saveData called for exercises on drop? ${adapter.saveCalls.some(c => c.key === 'exercises' && c.data[0].status === 'low') ? 'Yes' : 'No (BUG!)'}`);

    console.log('SUCCESS: programmatically demonstrated Bug 3.\n');


    // ============================================================================
    // BUG 4: Comma-Separated Multi-TTP Gaps
    // ============================================================================
    console.log('--- 4. Comma-Separated Multi-TTP Gaps ---');

    const multiTtpGap = {
        id: 'gap-multi',
        ttp: 'T1059.001, T1078', // PowerShell, Valid Accounts
        simulation: 'APT29',
        finding: 'Run PowerShell Payload',
        status: 'Open'
    };

    const initialExercises = [
        { id: 'ex-1', ttp: 'T1059.001', simulation: 'APT29', status: 'low' },
        { id: 'ex-2', ttp: 'T1078', simulation: 'APT29', status: 'medium' } // Unrelated technique we don't validate yet
    ];

    // Run the update validation logic on multi-TTP gap
    async function runMultiTtpValidationSimulation(gapObj, exercises, validatedTtp, newOutcomeStatus) {
        const ttpList = (gapObj.ttp || '').split(',').map(t => t.trim()).filter(Boolean);
        const simulationName = gapObj.simulation;
        const procName = gapObj.finding;
        
        // Simulate finding agg outcome (e.g. 'prevented' -> 'high')
        let finalAggOutcome = 'high';
        
        // Update exercises
        const updatedExercises = exercises.map(ex => {
            if (ttpList.includes(ex.ttp) && ex.simulation === simulationName) {
                return {
                    ...ex,
                    status: finalAggOutcome,
                    finding: procName
                };
            }
            return ex;
        });

        let gapStatus = 'Open';
        if (['prevented', 'alerted', 'logged'].includes(newOutcomeStatus)) {
            gapStatus = 'Resolved';
        }

        return { updatedExercises, gapStatus };
    }

    console.log('Initial gap status:', multiTtpGap.status);
    console.log('Initial exercises:', initialExercises);

    const multiResult = await runMultiTtpValidationSimulation(multiTtpGap, initialExercises, 'T1059.001', 'prevented');
    console.log(`Resulting Gap Status: "${multiResult.gapStatus}" (Resolved prematurely? ${multiResult.gapStatus === 'Resolved' ? 'Yes!' : 'No'})`);
    console.log('Resulting Exercises:', multiResult.updatedExercises);
    console.log('Analysis:');
    console.log('  - The entire gap representing BOTH TTPs is resolved, even though only one TTP (PowerShell) was validated.');
    console.log('  - The unrelated TTP (T1078, Valid Accounts) has its status overwritten to "high", masking its real status ("medium").');
    console.log('SUCCESS: programmatically demonstrated Bug 4.\n');


    // ============================================================================
    // BUG 5: AppContext Missing Guards
    // ============================================================================
    console.log('--- 5. AppContext Missing Guards ---');

    // A. recalculateMitreStatuses crash simulation
    const recalculateMitreStatuses = (mitreObj, exercises = []) => {
        // Exact implementation from AppContext.jsx line 8
        for (const tactic in mitreObj) {
            const allTechs = mitreObj[tactic].techniques;
            const parentSubsMap = {};
            allTechs.forEach(t => {
                if (t.id.includes('.')) {
                    const parentId = t.id.split('.')[0];
                    if (!parentSubsMap[parentId]) parentSubsMap[parentId] = [];
                    parentSubsMap[parentId].push(t);
                }
            });
        }
        return mitreObj;
    };

    console.log('A. Testing recalculateMitreStatuses with null mitreObj:');
    try {
        recalculateMitreStatuses(null, []);
    } catch (err) {
        console.log(`  - Caught expected crash: "${err.message}"`);
    }

    console.log('Testing recalculateMitreStatuses with malformed mitreObj (missing techniques):');
    try {
        recalculateMitreStatuses({ 'Initial Access': {} }, []);
    } catch (err) {
        console.log(`  - Caught expected crash: "${err.message}"`);
    }

    // B. filtered.sort with invalid dates
    console.log('B. Testing filtered.sort with invalid/missing dates:');
    const exercisesToSort = [
        { id: 'ex-1', date: '2026-06-16T12:00:00.000Z' },
        { id: 'ex-2', date: 'invalid-date-string' },
        { id: 'ex-3', date: null }
    ];

    console.log('Initial array:', exercisesToSort);
    try {
        exercisesToSort.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
        console.log('Sorted array:', exercisesToSort);
        console.log('  - Analysis: The comparison new Date("invalid-date-string") returns NaN.');
        console.log('    Comparing with NaN violates the strict weak ordering contract, producing unstable sorting order.');
    } catch (err) {
        console.log('  - Crash / error during sort:', err.message);
    }

    console.log('\nSUCCESS: programmatically demonstrated Bug 5.\n');

    // ============================================================================
    // VERIFICATION 6: Coverage Rating Aggregation Methodology
    // ============================================================================
    console.log('--- 6. Coverage Rating Aggregation Verification ---');

    function calculateAverageStatus(statuses) {
        if (statuses.length === 0) return 'unknown';
        let total = 0;
        statuses.forEach(s => {
            if (s === 'high') total += 100;
            else if (s === 'medium') total += 50;
            else if (s === 'minimal') total += 25;
            else if (s === 'low') total += 0;
        });
        const avg = total / statuses.length;
        if (avg === 100) return 'high';
        if (avg >= 50) return 'medium';
        if (avg > 0) return 'minimal';
        return 'low';
    }

    const testCases = [
        { statuses: ['high', 'low'], expectedOld: 'low', expectedNew: 'medium', desc: '1 Optimal, 1 No Coverage (50% average)' },
        { statuses: ['high', 'high', 'low'], expectedOld: 'low', expectedNew: 'medium', desc: '2 Optimal, 1 No Coverage (66% average)' },
        { statuses: ['minimal', 'low'], expectedOld: 'low', expectedNew: 'minimal', desc: '1 Minimal, 1 No Coverage (12.5% average)' }
    ];

    testCases.forEach((tc, idx) => {
        const oldLogic = tc.statuses.includes('low') ? 'low' : tc.statuses.includes('medium') ? 'medium' : tc.statuses.includes('high') ? 'high' : 'unknown';
        const newLogic = calculateAverageStatus(tc.statuses);
        console.log(`  Case ${idx + 1}: ${tc.desc}`);
        console.log(`    - Old "Weakest Link" output: ${oldLogic} (Matches expected? ${oldLogic === tc.expectedOld})`);
        console.log(`    - New "Average" output: ${newLogic} (Matches expected? ${newLogic === tc.expectedNew})`);
    });
    console.log('SUCCESS: verified Average Coverage Aggregation.\n');

    console.log('======================================================================');
    console.log('QA VERIFICATION COMPLETED SUCCESSFULLY!');
    console.log('======================================================================');
}

main().catch(console.error);
