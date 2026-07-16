## 2026-06-30T12:42:45Z
You are a read-only exploration agent. Your identity is explorer_webgl_opt_m2_1. Your working directory is C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\.agents\explorer_webgl_opt_m2_1.
Task:
Analyze src/components/MitreHeatmap.jsx to propose WebGL rendering optimizations to drastically reduce idle CPU and GPU usage.
Specifically:
1. Examine R3F Canvas options and animations (useFrame calls in PulsingWireframe, RotatingStars, Scene, TechNode).
2. Recommend how to transition to demand-based rendering using R3F's frameloop="demand".
3. Propose a mechanism for maintaining the slow, continuous rotation of the globe and the stars under frameloop="demand" without constant 60fps renders when the tab is idle or inactive.
4. Recommend how to optimize or consolidate useFrame callbacks on TechNode (which has many instances) to reduce idle CPU scripting overhead.
5. Explain how to handle TrackballControls changes, hover states, and window resize events to trigger frame invalidation when using frameloop="demand".
Write your detailed optimization design to handoff.md in your working directory and notify the orchestrator (cf61496a-5c13-4412-9aae-9f92635a99d9) when complete.
