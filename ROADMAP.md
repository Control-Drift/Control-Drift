# Control Drift - Product Roadmap & Brainstorming

This document outlines future features, ideas, and structural improvements planned for Control Drift.

## 1. Advanced Metrics & Confidence Scoring
- **Test Depth (Simulation Density):** Track how many unique simulation events have been conducted against a specific technique or tactic.
    - *Problem:* Testing a single procedure for a technique and getting an "Optimal" rating gives a false sense of security if the technique has 15 other known procedures.
    - *Solution:* Implement a "Testing Baseline Confidence" metric. 
        - The 3D Heatmap's color opacity could represent density (e.g., bright green = tested 10 times, dim green = tested once).
        - Clicking a technique will display something like: `Coverage: Optimal | Confidence: Low (Tested 2 times)`.
- **AI Payload Recommendations:** The AI Co-Pilot can dynamically recommend new payloads or procedures for techniques that have a low "Testing Baseline Confidence" to help analysts build a more robust testing baseline.

## 2. Integrations
- *(Brainstorming)* Potential direct integrations with SIEMs (Splunk, Elastic) or EDRs (CrowdStrike, SentinelOne) to automatically pull detection statuses rather than relying on manual validation in the Gap Tracker.

## 3. UI/UX Enhancements
- *(Brainstorming)* Custom reporting exports (PDF/HTML) for executive audiences that summarize the Global Readiness Score and active remediation efforts.

---
*Note: This is a living document. Ideas here are not guaranteed for release but represent the current direction and brainstorming of the project.*
