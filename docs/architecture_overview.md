# Architecture Overview

This document outlines how Control Drift structures, tracks, and calculates metrics across the platform. It is based directly on the application's underlying logic and React Context architecture.

## 1. The Core Data Hierarchy

Control Drift utilizes three main data structures to track security posture effectively:

### A. `Simulations`
A **Simulation** is an aggregate collection or "campaign" of multiple events (e.g., "Q3 Ransomware Campaign").
- **Purpose:** Groups related executions together.
- **Data Tracked:** A JSONB summary block containing the execution strategy, attached base64 image evidence, tags, target environments, and the nested array of execution results.

### B. `Events`
An **Event** represents a single executed instance of one or multiple TTPs.
- **Purpose:** Captures the ground-truth outcome of a red-team action. 
- **Data Tracked:** The MITRE TTP(s) tested, the finding/outcome (e.g., `Prevented`, `Alerted`, `Logged`, `Missed`), and the specific Coverage Rating (`Optimal`, `Partial`, `Minimal`, `None`).

### C. `Gaps`
A **Gap** is a ticketing construct that represents a missing control or coverage blind spot identified during an Event.
- **Purpose:** Tracks the lifecycle of remediation efforts.
- **Data Tracked:** Status (`Open`, `In Progress`, `Resolved`, `Risk Accepted`), Severity (`Critical`, `High`, `Medium`, `Low`), assigned stakeholders, and creation/resolution timestamps for metrics tracking.

## 2. Metrics

Control Drift dynamically calculates several critical metrics in the `Dashboard` to provide an accurate, real-time assessment of defensive readiness.

### Global Readiness Score (GRS)
The GRS is not a simple ratio of passes to fails. It is a single, unified mathematical roll-up of all validated TTPs—combining **Coverage Outcome**, **Gap Severity Weighting**, **Simulation Density**, and **Temporal Control Drift Decay** on a scale of 0 to 100:
$$\text{GRS} = \text{round}\!\left(100 \times \frac{\sum_{i} C_i \cdot W_i \cdot F_{\text{decay}}(\Delta t_i, N_i)}{\sum_{i} W_i}\right)$$
1. **Base TTP Scoring ($C_i$):** Each tested TTP is granted base points according to its confirmed coverage level:
   - `Optimal` (High): 1.0 points
   - `Partial` (Medium): 0.5 points
   - `Minimal`: 0.25 points
   - `None`: 0 points
2. **Gap Severity Weighting ($W_i$):**
   - Instead of treating every TTP equally, the GRS calculation applies a strict severity weight to the denominator for any TTP with an active gap. This ensures that a single high-impact failure plummets the overall score much faster than a low-impact failure. 
   - Weights: **Critical=10**, **High=5**, **Medium=2**, **Low=1**.
   - If a TTP has multiple active gaps, the maximum severity weight is applied.
3. **Density-Modulated Temporal Control Drift Retention ($F_{\text{decay}}(\Delta t_i, N_i)$):**
   - **Fresh Grace Window ($\Delta t_i \le 30\text{ days}$):** Retains $100\%$ of earned points ($F_{\text{decay}} = 1.00$), ensuring newly validated `Optimal` controls achieve a full 100/100 score.
   - **Density-Extended Half-Life ($\Delta t_i > 30\text{ days}$):** Beyond 30 days without re-validation, earned points decay exponentially with an effective half-life modulated by unique procedure count $N_i$:
     $$T_{\text{eff}}(N_i) = 90 \times \bigl(1 + 0.15 \times \min(N_i - 1, 4)\bigr)\text{ days}$$
     Techniques tested across 5+ procedures enjoy a 144-day half-life (vs. 90 days for a single procedure test), uniting **Simulation Density** and **Temporal Control Drift** into one retention curve clamped at a floor of $0.25$.
4. **Gap Overrides:**
   - **Active Gaps (Open/In Progress):** Preserve their underlying coverage score, multiplied by their severity weight and temporal retention factor.
   - **Resolved Gaps:** Revert the TTP to a standard weight of 1 and provide full credit ($1.0 \times F_{\text{decay}}$), bouncing the score back up upon re-test.
   - **Risk Accepted Gaps:** Provide **0 points** (with a standard weight of 1). Control Drift strictly prevents artificial score inflation; accepting a risk removes the gap from the queue but does not grant defensive credit.

### Advanced Metrics
- **Mean Time to Remediate (MTTR):** Calculates the exact time delta (in seconds) between a Gap's `createdDate` and `resolvedDate`, averaged across all valid Resolved gaps, and formats the output into days and hours.
- **Weighted Residual Risk:** Prioritizes the current threat landscape by summing the severity of all `Open` and `In Progress` gaps using a strict weighting system:
  - **Critical:** 10 points
  - **High:** 7 points
  - **Medium:** 3 points
  - **Low:** 1 point
- **Resolution Rate:** The percentage of applicable gaps that have been closed (`closedGaps / totalGaps * 100`). Note that `Risk Accepted` gaps are filtered out of this applicable total.

### Kill Chain Radar
Control Drift maps active gaps across 5 major phases of the attack lifecycle: `Initial Access`, `Execution`, `Evasion`, `Movement`, and `Action on Objective`. The risk for each phase is calculated as the ratio of missed TTPs to total tested TTPs within that phase.

### MITRE Heatmap Aggregate Coverage Scoring
When events are projected onto the interactive 3D MITRE ATT&CK Heatmap, techniques and tactics often inherit multiple procedural tests (Events) with varying outcomes. Control Drift resolves these into a single **Aggregate Coverage Rating** for the TTP using a strict weighting system:
1. **Pessimistic Overrides:** A TTP can only achieve an `Optimal` (High) aggregate rating if **every single event** executed against it resulted in an `Optimal` rating. A single sub-optimal procedure test automatically caps the maximum possible aggregate rating for that technique at `Partial`.
2. **Weighted Averages:** For TTPs with multiple tests, scores are weighted (Optimal=3, Partial=2, Minimal=1, None=0) and averaged.
   - Average `≥ 2.5` -> `Optimal` (capped at `Partial` if any test failed, per the rule above)
   - Average `≥ 1.5` -> `Partial`
   - Average `≥ 0.5` -> `Minimal`
   - Average `< 0.5` -> `None`
3. **Tactic Roll-Ups:** Parent Techniques inherit the aggregate scores of their Sub-Techniques using this exact same math, and entire Tactics are colored based on the roll-up of all their underlying Techniques.

### Testing Depth Tiers & TTP Sub-Technique Rollups
Rather than relying on continuous score formulas, Control Drift establishes strict, transparent **Testing Depth** tiers computed directly from empirical execution counts per technique (via `calculateMitreCoverage` in `src/lib/mitreUtils.js`):
- **Low Depth:** Exactly 1 procedure execution. Represents an initial sanity check.
- **Medium Depth:** 2 to 3 procedure executions. Demonstrates validation across baseline variations.
- **High Depth:** 4 or more procedure executions. Indicates comprehensive multi-procedure testing across varying parameters, payloads, or environmental conditions.

**Sub-Technique Execution Rollups:**
When sub-techniques (`Txxxx.yyy`) are tested, their execution counts dynamically roll up to their parent technique (`Txxxx`). This ensures high-level tactic and dashboard views reflect true empirical depth across the entire technique family.

### Adaptive Mastery-Based TTP Decay Lifespans
Control Drift strictly distinguishes between **Control Drift** and **TTP Decay**:
- **Control Drift:** An unexpected deviation between expected control performance and actual simulation outcome (i.e. `expectedOutcome !== outcome`, such as a previously blocked technique suddenly executing undetected).
- **TTP Decay:** The temporal staleness of a security posture metric when a technique has not been validated within its dynamic decay lifespan.

Instead of enforcing an arbitrary static 90-day timer across all techniques, Control Drift calculates an adaptive **Dynamic Decay Lifespan** ($L_{\text{dynamic}}$) based on empirical validation depth and consecutive mastery streaks (`calculateDynamicDecayLifespan` in `src/lib/mitreUtils.js`):
$$L_{\text{dynamic}} = \text{round}(L_{\text{base}} \times M_{\text{exec}} \times M_{\text{streak}})$$

1. **Base Lifespan ($L_{\text{base}}$):** 90 days.
2. **Execution Depth Multiplier ($M_{\text{exec}}$):**
   - 1 test: $1.0\times$ (90 days)
   - 2 tests: $1.25\times$ (112 days)
   - 3 tests: $1.5\times$ (135 days)
   - 4+ tests: $2.0\times$ (180 days)
3. **Streak Mastery Multiplier ($M_{\text{streak}}$):**
   - Consecutive successful validations (`Optimal` or `Prevented`) grant a compounding $+10\%$ extension per streak step, capped at $1.5\times$.
   - A highly tested, consistently prevented control can maintain validity up to 270 days without artificial decay penalties.
4. **TTP Decay States:**
   - **Fresh ($\Delta t \le \text{round}(L_{\text{dynamic}} \times 0.5)$):** High confidence; no decay penalty ($F_{\text{decay}} = 1.0$).
   - **Aging ($\text{round}(L_{\text{dynamic}} \times 0.5) < \Delta t \le L_{\text{dynamic}}$):** Gradual decay onset; reminder to schedule re-validation.
   - **Decayed ($\Delta t > L_{\text{dynamic}}$):** Lifespan exceeded; flagged with a **cracked shield icon** and added to the **TTP Decay Watchlist** for immediate procedural re-testing to preserve confidence.
5. **Visual Weight & Heat Globe Integration:**
   - Visual weight (`visualWeight = clamp(0.35 * depthWeight + 0.65 * decayFactor, 0.25, 1.00)`) dictates 3D node scaling, opacity, and wireframe pulse on the MITRE Heat Globe.
   - Decayed techniques render with dimmed cores and broken outer hulls.

### Procedural Variation Memory & Continuous Re-Testing
To prevent "test gaming" (where operators repeatedly run the exact same known-signature command to artificially maintain high scores):
- **Variation Memory (`getHistoricalProceduresForTTPs`):** When designing or re-testing a campaign in the Simulation Launcher, Step 2 (Design) automatically queries past simulation runs and extracts previous commands, flags, tools, and payloads tested for that technique.
- **AI-Guided Procedural Evolution:** Historical procedures are injected into the AI strategy prompt, instructing the model and analyst to formulate novel procedural variations (e.g. pivoting from PowerShell to WMI/COM, alternative LOLBins, obfuscated execution flags).
- **Direct Re-Test Pipeline:** Clicking "Re-Test in Simulation Launcher" on any Decayed or Drifting card immediately launches into the Design phase with target TTPs and historical memory pre-loaded.


## 3. The Data Adapter Layer

Control Drift is designed to run in multiple environments seamlessly. It achieves this by aggregating state globally via React Context (`AppContext`) and passing it to a swappable `dbAdapter`.

- **Local IndexedDB (`local`):** For zero-infrastructure deployments. All data is serialized and stored persistently within the browser's IndexedDB (`control_drift_db` -> `kv_store`), with `BroadcastChannel('control_drift_sync')` multi-tab synchronization and full JSON backup export/import (including simulations, events, gaps, evidence, environments, security controls, and MITRE scope overrides).
- **Enterprise Postgres (`rest`):** For team environments. The exact same JSON schemas are validated (using Zod) and synced to a centralized PostgreSQL database (like Supabase) via REST API, ensuring that frontend calculation logic remains identical regardless of the storage backend.
