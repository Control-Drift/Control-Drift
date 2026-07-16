## 2026-06-30T12:45:04Z
You are a worker agent. Your identity is worker_webgl_opt_m2_1. Your working directory is C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\.agents\worker_webgl_opt_m2_1.
Task:
1. Optimize the WebGL rendering pipeline in src/components/MitreHeatmap.jsx to drastically reduce idle CPU and GPU usage while maintaining high-fidelity visual quality.
Key steps:
a. Transition R3F <Canvas> to frameloop="demand".
b. Consolidate TechNode's useFrame callbacks: implement a centralized registry ref in the parent Scene component. Have each TechNode register its elements (group, solid/wire/field material, color, isHovered, isTested, etc.) via useEffect on mount and unregister on unmount. Execute a single useFrame loop in Scene that iterates over the registered nodes and updates their lerping scales, opacities, and field rotations. Only call state.invalidate() in the loop when nodes are actually transitioning.
c. Remove continuous rotation on unhovered TechNode instances.
d. Add a visibility-aware and user-activity-aware continuous invalidation scheduler (e.g. FrameloopScheduler component or built into the Scene loop) for the slow cosmetic drift of the stars and globe. The scheduler should throttle rendering to 20 FPS (every 50ms), suspend rendering when the document is hidden (document.visibilityState !== 'visible'), and suspend rendering after a period of user inactivity (e.g. 30-second idle timeout).
e. Connect TrackballControls's onChange listener to R3F's invalidate method: onChange={invalidate}.
f. Ensure the wireframe sphere geometry remains at 48x48 segments, continuous slow rotation is active when tab is visible and active, and neon Bloom post-processing remains enabled.

2. Modify tests/webgl-perf.spec.js to add assertions verifying that the 3D WebGL Canvas is successfully loaded and not falling back to the WebGL fallback boundary:
a. Expect page.locator('text="3D Hardware Acceleration Required"') to not be visible.
b. Expect page.locator('canvas') to be visible.

3. Verify that the build (npm run build or similar) completes successfully.
4. Run the Playwright performance test suite (npx playwright test tests/webgl-perf.spec.js) to ensure it executes successfully and passes.
5. Write your changes and verification logs to handoff.md in your working directory and notify the orchestrator (cf61496a-5c13-4412-9aae-9f92635a99d9).

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
