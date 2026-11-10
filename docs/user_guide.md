# Control Drift User Guide

Welcome to the Control Drift User Guide. This document provides a walkthrough of the core features of the platform.

## 1. The Dashboard

When you first load Control Drift, you are greeted by the Dashboard. This acts as your command center providing high-level posture and operational metrics.

- **Global Readiness Score:** A high-level metric quantifying your defensive posture based on historical simulation data, resolved gaps, and active vulnerabilities.
- **Security Control Efficacy:** Visualizations detailing which controls (e.g., EDR, Firewall, IAM) are performing best and which require immediate attention.
- **Remediation Burndown:** Remediation Resolution Rate, Weighted Residual Risk, and MTTR cards tracking gap & remediation metrics.
- **TTP Decay Watchlist & Decayed Metric:** Dedicated monitoring of techniques that have exceeded their dynamic decay lifespan and require re-testing to preserve posture confidence. Click any entry to immediately launch a re-test.

## 2. Launching Simulations

The core workflow of Control Drift revolves around threat simulation.

### The Simulation Launcher
To start a new test, navigate to the **Simulation Launcher**. The streamlined 4-step launcher will guide you through the process:

1. **Scope:** Define the simulation scenario, select MITRE TTPs, target environment, and simulation tags.
2. **Design (with Procedural Variation Memory):** Strategize how the simulation will be executed. 
   - **Historical Procedure Memory:** Step 2 automatically queries past campaigns and displays previous commands, flags, tools, and payloads tested for your selected TTPs.
   - **AI-Assisted Variation:** When auto-generating simulation strategies, the AI ingests historical procedures and generates novel procedural variations to challenge controls against evasion and different execution vectors rather than replaying identical signatures.
3. **Execute:** As you execute procedures in your environment, log simulation **Events** using the event cards (capturing outcome, coverage rating, executed commands, and defensive evidence).
4. **Report:** Review the summary of the simulation results. You can also utilize your AI integration to automatically generate a comprehensive executive summary of the simulation outcomes before finalizing the report.

### Continuous Re-Testing Pipeline
Clicking "Re-Test" on any **Decayed** or **Drifting** technique across the Heatmap or Dashboard bypasses manual configuration, launching directly into Step 2 (Design) with the technique and its historical procedure history pre-loaded.

## 3. The Heat Globe & MITRE ATT&CK Matrix

Once you've logged simulations, navigate to the **Heat Globe**.

- **Interactive 3D Globe & Flat Matrix Views:** Toggle between an interactive 3D globe and full 2D matrix view of the MITRE ATT&CK framework.
- **Dynamic Heatmap Colors:** Colors update dynamically based on aggregate simulation outcomes: Red (None), Orange (Minimal), Yellow (Partial), and Green (Optimal).
- **Strict Testing Depth Tiers:** Badges reflect empirical validation depth: **Low** (1 test), **Medium** (2–3 tests), and **High** (4+ tests). Sub-technique executions automatically roll up into the parent technique family.
- **TTP Decay vs. Control Drift:** 
  - **Decayed:** Techniques that have not been re-tested within their dynamic decay lifespan are marked with a **cracked shield icon**, dimmed visual weight, and flagged for re-validation.
  - **Control Drift:** Techniques where actual control outcomes deviated from expected defensive performance (`expectedOutcome !== outcome`).
- **TTP Overlay:** Clicking on any technique opens an overlay showing historical simulation executions, procedure notes, depth tiers, decay lifespan metrics, and a direct "Re-Test in Simulation Launcher" button.

## 4. Gap Tracking and Remediation

When a simulation event is classified as less than optimal coverage, a **Gap** is automatically logged.

- **The Gap Tracker:** Navigate to the Gap Tracker to see a Kanban-style board of all active gaps with drag-and-drop functionality and a simple, streamlined resolution workflow.
- **Prioritization:** Gaps can be filtered based on severity level and risk rating .
- **Remediation Workflow:** Click on an active gap to open a detailed overlay, featuring Remediation Strategy, Code Studio, and Tracking tabs.
- **Automated Score Updates:** When a gap is marked as "Resolved," the associated simulation, posture metrics, and Global Readiness Score instantly update to reflect the successful re-test and improved posture.

## 5. Threat Catalog

The **Threat Catalog** connects the official MITRE ATT&CK STIX 2.1 threat intelligence knowledge base directly to your empirical validation data.

- **APT Groups & Malware/Tools Browser:** Search and inspect documented adversary groups, malware families, and offensive tools along with their aliases, descriptions, and mapped TTPs.
- **Adversary Readiness & Priority Scoring:** Instantly see how many of a threat actor's techniques are validated versus exposed or decayed in your environment. Techniques are organized across the Cyber Kill Chain and ranked by priority (weighing active gaps, control decay, arsenal tool overlap, and documented CTI procedures).
- **Compound Operational Chains & Simulation Handoff:** Scope individual techniques, high-priority phase TTPs, or compound operational chains, then click **Send to Simulation Launcher** to pre-populate a tailored adversary emulation campaign with real-world procedure context.
- **ATT&CK Navigator Export:** Export any threat actor or software profile as a color-coded MITRE ATT&CK Navigator JSON layer reflecting your current readiness posture.

## 6. Code Studio & AI Assistant

To streamline workflows, Control Drift includes the following AI-powered engineering tools.

- **AI Assistant:** When configured, you can invoke the AI Assistant by clicking on the chat icon located in the lower-right corner of the console window. The chatbot is given contextual information on the current data within Control Drift to accurately assist with various workflows.
- **Code Studio:** Craft simulation payloads and detection rules within the console. The studio supports syntax highlighting for Sigma, YARA, Splunk SPL, and Azure KQL. 
- **AI-Augmented Simulation Launcher:** TTP auto-mapping, simulation design auto-generation, and executive report generation are all available after configuring an AI integration.

---

*Need help setting up the Enterprise version? See our [Deployment Guide](deployment.md).*
