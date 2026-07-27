# Control Drift User Guide

Welcome to the Control Drift User Guide. This document provides a walkthrough of the core features of the platform.

## 1. The Dashboard

When you first load Control Drift, you are greeted by the Dashboard. This acts as your command center providing high-level posture and operational metrics.

- **Global Readiness Score:** A high-level metric quantifying your defensive posture based on historical simulation data, resolved gaps, and active vulnerabilities.
- **Top Security Controls:** Visualizations detailing which controls (e.g., EDR, Firewall, IAM) are performing best and which require immediate attention.
- **Remediation Burndown:** Remediation Resolution Rate, Weighted Residual Risk, and MTTR cards tracking gap & remediation metrics.


## 2. Launching Simulations

The core workflow of Control Drift revolves around threat simulation.

### The Simulation Launcher
To start a new test, navigate to the **Simulation Launcher**. The streamlined 4-step launcher will guide you through the process:

1. **Scope:** Define the simulation scenario, TTPs, target environment, simulation tags (for tracking).
2. **Design:** Strategize how the simulation will be executed. Use the text editor to manually outline the simulation strategy, or utilize your AI integration to auto-generate the design. Tip: Use the AI assistant to refine further if necessary.
3. **Execute:** As you manually execute the procedures in your environment, log the simulation **Events** by filling out the event cards.
4. **Report:** Review the summary of the simulation results. You can also utilize your AI integration to automatically generate a comprehensive executive summary of the simulation outcomes before finalizing the report.

## 3. The Heat Globe

Once you've logged simulations, navigate to the **Heat Globe**.

- **Interactive 3D Globe:** Unlike standard 2D tables, Control Drift visualizes the MITRE ATT&CK matrix on an interactive 3D globe.
- **Dynamic Updates:** The colors of the techniques on the globe shift dynamically based on your simulation outcomes. Red indicates no coverage (gap), yellow indicates partial coverage, and green indicates optimal coverage.
- **TTP Overlay:** Clicking on any technique on the globe opens an overlay showing historical simulations involving that technique, providing instant context on aggregate scoring and metrics.

## 4. Gap Tracking and Remediation

When a simulation event is classified as less than optimal coverage, a **Gap** is automatically logged.

- **The Gap Tracker:** Navigate to the Gap Tracker to see a Kanban-style board of all active gaps with drag-and-drop functionality and a simple, streamlined resolution workflow.
- **Prioritization:** Gaps can be filtered based on severity level and risk rating .
- **Remediation Workflow:** Click on an active gap to open a detailed overlay, featuring Remediation Strategy, Code Studio, and Tracking tabs.
- **Automated Score Updates:** When a gap is marked as "Resolved," the associated simulation, posture metrics, and Global Readiness Score instantly update to reflect the successful re-test and improved posture.

## 5. Attack Path Mapping

Understanding isolated gaps is useful, but understanding how they chain together is crucial.

- **Visualizing Paths:** The Attack Path Mapping feature allows you to visualize how an adversary could string together multiple active gaps to move laterally across your environment.
- **AI-Assisted Mapping:** With an active AI integration, you can automatically generate viable attack paths based on the gaps currently open in your Gap Tracker.

## 6. Code Studio & AI Assistant

To streamline workflows, Control Drift includes the following AI-powered engineering tools.

- **AI Assistant:** When configured, you can invoke the AI Assistant by clicking on the chat icon located in the lower-right corner of the console window. The chatbot is given contextual infromation on the current data within Control Drift to accurately assist with various workflows.
- **Code Studio:** Craft simulation payloads and detection rules within the console. The studio supports syntax highlighting for Sigma, YARA, Splunk SPL, and Azure KQL. 
- **AI-Augmented Simulation Launcher:** TTP auto-mapping, simulation design auto-generation, and executive report generation are all available after configuring an AI integration.

---

*Need help setting up the Enterprise version? See our [Deployment Guide](deployment.md).*
