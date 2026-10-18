# Control Drift - Platform Roadmap & Brainstorming

This document outlines future features, ideas, and structural improvements planned for Control Drift.

## 1. Advanced Metrics & Confidence Scoring
- **Completed — Test Depth (Simulation Density) & Temporal Control Drift Decay:**
    - Implemented the **Testing Baseline Confidence** & **Temporal Control Drift** engine (`calculateConfidenceAndDecay` in `src/lib/mitreUtils.js`).
    - Tracks cumulative simulation density (`Low` / `Medium` / `High` confidence) alongside time-based validation decay (`Fresh` 0–30d, `Aging` 31–90d, `Drifting` >90d).
    - Visualized directly on the 3D MITRE ATT&CK Heat Globe (via dynamic node scale, emissive intensity, opacity, and decaying wireframe shells), tactic drilldown badges, and header/sidebar filters.
    - **One-Click Re-Test Workflow:** Decayed TTPs include a direct **"Re-Test in Simulation Launcher"** action inside the TTP details overlay that jumps to `/simulation` and auto-populates the campaign scope.
- **Completed — AI Co-Pilot Drift & Confidence Telemetry:** The AI Co-Pilot context automatically receives `driftingTechniques`, `lowConfidenceTechniques`, and active `selectedTechnique` telemetry on the MITRE Heatmap to recommend targeted procedures and payloads.

## 2. Integrations
- *(Brainstorming)* Potential direct integrations with SIEMs (Splunk, Elastic) or EDRs (CrowdStrike, SentinelOne) to automatically pull detection statuses rather than relying on manual validation in the Gap Tracker.

## 3. UI/UX Enhancements
- **Completed — Executive Posture PDF Report (`ExecutiveReportPDF.jsx`):** One-click **Export Executive PDF** on the Global Dashboard generating a CISO-ready summary of the unified Global Readiness Score, Cyber Kill Chain exposure, Control Drift Watchlist, Priority Open Gaps, and Security Control Efficacy.
- **Completed — Symmetrical Control Drift Watchlist (`Dashboard.jsx`):** Added a `Drifting TTPs` stat box to the Global Readiness Score hero banner, paired with a tabbed `Security Controls` ⇄ `Control Drift Watchlist` panel in the 3-column dashboard grid with one-click **Re-Test** and **Heat Globe** actions.

## 4. Metric Enhancements
- **Completed** Unified Global Readiness Score (GRS) combining coverage outcome, active gap severity weighting, simulation density (density-modulated half-life), and temporal control drift decay into a single metric.

---
*Note: This is a living document. Ideas here are not guaranteed for release but represent the current direction and brainstorming of the project.*
