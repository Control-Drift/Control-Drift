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

## 2. Coverage Rating System

Control Drift dynamically calculates several critical metrics in the `Dashboard` to provide an accurate, real-time assessment of defensive readiness.

### Global Readiness Score (GRS)
The GRS is not a simple ratio of passes to fails. It is a precise mathematical roll-up of all validated TTPs, calculated on a scale of 0 to 100:
1. **Base TTP Scoring:** Each tested TTP is granted points based on its highest confirmed coverage level:
   - `Optimal` (High): 1.0 points
   - `Partial` (Medium): 0.5 points
   - `Minimal`: 0.25 points
   - `None`: 0 points
2. **Gap Overrides:**
   - **Active Gaps (Open/In Progress):** Preserve their underlying coverage score (they do not automatically reset to 0, granting partial credit if the control partially logged the attack).
   - **Resolved Gaps:** Provide full credit (1.0 points) for their associated TTPs, instantly boosting the score.
   - **Risk Accepted Gaps:** Provide **0 points**. Control Drift strictly prevents artificial score inflation; accepting a risk removes the gap from the queue but does not grant defensive credit.

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

## 3. The Data Adapter Layer

Control Drift is designed to run in multiple environments seamlessly. It achieves this by aggregating state globally via React Context (`AppContext`) and passing it to a swappable `dbAdapter`.

- **Local IndexedDB (`local`):** For zero-infrastructure deployments. All data is serialized and stored persistently within the browser's IndexedDB.
- **Enterprise Postgres (`rest`):** For team environments. The exact same JSON schemas are validated (using Zod) and synced to a centralized PostgreSQL database (like Supabase) via REST API, ensuring that frontend calculation logic remains identical regardless of the storage backend.
