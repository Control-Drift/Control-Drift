# Plan: WebGL Optimization

## Step-by-Step Execution Plan

### Milestone 1: Performance Baselining
- [ ] Step 1.1: Spawn explorer to research where to place the Playwright CDP script and how to write it to capture CPU scripting/rendering time.
- [ ] Step 1.2: Spawn worker to write the Playwright CDP performance testing script (`tests/webgl-perf.spec.js`) and run it to collect the baseline metric.
- [ ] Step 1.3: Spawn reviewer to verify the baseline script runs successfully, produces screenshots, and captures valid performance measurements.

### Milestone 2: WebGL Optimization
- [ ] Step 2.1: Spawn explorer to analyze `MitreHeatmap.jsx` animation loops and structure a detailed optimization plan (e.g. frameloop="demand", throttled invalidate loop, offscreen canvas behavior).
- [ ] Step 2.2: Spawn worker to implement the R3F optimizations.
- [ ] Step 2.3: Spawn reviewer to verify visual quality and check that code build and lint passes.
- [ ] Step 2.4: Spawn challenger to verify stability and correctness under different interactions.

### Milestone 3: Verification & Auditing
- [ ] Step 3.1: Spawn worker to run the Playwright CDP performance script on the optimized code, generate the final screenshots, and compute the performance improvement percentage.
- [ ] Step 3.2: Spawn reviewer/challenger (Agent-as-Judge) to compare the screenshots before and after optimization to confirm visual fidelity is preserved.
- [ ] Step 3.3: Spawn forensic auditor to verify integrity (genuine WebGL optimizations, no hardcoding of performance numbers).
