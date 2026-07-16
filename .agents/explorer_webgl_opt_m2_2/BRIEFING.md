# BRIEFING — 2026-06-30T08:45:00-04:00

## Mission
Analyze src/components/MitreHeatmap.jsx to propose WebGL rendering optimizations to drastically reduce idle CPU and GPU usage.

## 🔒 My Identity
- Archetype: Teamwork explorer
- Roles: Read-only investigator
- Working directory: C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\.agents\explorer_webgl_opt_m2_2
- Original parent: 4263abe5-8a6d-4ab6-a6fd-3bf04dc970a3
- Milestone: WebGL rendering optimizations for MitreHeatmap

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Analyze src/components/MitreHeatmap.jsx specifically
- Address 5 specific optimization points requested in the task description

## Current Parent
- Conversation ID: 4263abe5-8a6d-4ab6-a6fd-3bf04dc970a3
- Updated: not yet

## Investigation State
- **Explored paths**:
  - `src/components/MitreHeatmap.jsx` (complete file analysis)
- **Key findings**:
  - R3F Canvas runs on `always` frameloop, rendering at 60fps continuously.
  - Four components use `useFrame` callbacks: `PulsingWireframe`, `RotatingStars`, `Scene`, and `TechNode`.
  - `TechNode` has multiple instances (30-80 depending on the active tactic), each running its own `useFrame` hook every frame. This creates massive scripting overhead.
  - Slow rotations of the globe/stars can be managed via a visibility and activity-aware invalidation scheduler running at a throttled FPS (e.g., 20-30 FPS) and sleeping when inactive.
  - Controls, resize, and hover transitions can be handled cleanly via on-demand invalidation loop hooks and self-terminating animation conditions.
- **Unexplored areas**: None, the codebase analysis is complete for this task.

## Key Decisions Made
- Consolidate all individual `TechNode` `useFrame` loops into a single registry and run updates inside a single parent `useFrame` call.
- Design a throttled, activity-aware, and visibility-aware invalidation scheduler for slow continuous animations.
- Propose self-terminating animations for hover transitions and camera movements using target-delta checks in `useFrame` to call `invalidate()` only when animating.

## Artifact Index
- None
