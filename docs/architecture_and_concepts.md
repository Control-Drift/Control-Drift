# Architecture & Concepts

Welcome to the core philosophy and architecture document for Control Drift. This guide details the structural decisions behind the platform and explains the primary concepts you need to understand to use Control Drift effectively.

## The Core Concept: "Control Drift"

In the context of cybersecurity, **Control Drift** is the phenomenon where the expected efficacy of a security control deviates from its actual performance over time.

Controls—like Endpoint Detection and Response (EDR) policies, firewall rules, or Identity and Access Management (IAM) configurations—are often tested once during implementation and assumed to be functional thereafter. However, environments change: updates alter software behaviors, configurations are accidentally modified, and adversaries evolve their Tradecraft (TTPs). Control Drift exposes these silent failures, providing a real-time, ground-truth measurement of defensive readiness.

## Event-Driven Posture Modeling

Traditional Breach and Attack Simulation (BAS) tools often rely on a rigid, 1:1 mapping between a specific script executed and a specific MITRE ATT&CK technique. If the script gets blocked, the technique is marked as "covered." 

**Control Drift uses Event-Driven Posture Modeling.** 
Instead of rigid tests, Control Drift tracks discrete **Events**. An activity (e.g., executing a specific payload, modifying a registry key, or a detection alert firing) is logged as an Event. A single Event can be mapped to one or multiple MITRE TTPs simultaneously. 

By tracking procedural variations as flexible events, you gain a significantly more nuanced and accurate representation of your true defensive posture, rather than a binary pass/fail based on a brittle script.

## Analyst Empowerment over Automation

A key philosophy behind Control Drift is **Analyst Empowerment**. 
Many commercial solutions treat simulation as a "black box" where you click a button, the system does something opaque in the background, and gives you a score. 

Control Drift brings the human back into the loop. It equips security teams with the granular control to manually step through procedures within their unique environments. This hands-on approach ensures analysts build a deep, intuitive understanding of real-world attack mechanics and how their controls respond, which is far more valuable than an automated PDF report.

## The Data Adapter Architecture

Control Drift was designed to scale with your needs, from a solo consultant doing a quick assessment to a large enterprise managing continuous testing. It achieves this through a flexible **Data Adapter** architecture.

### Local-First (Zero-Infrastructure)
By default, Control Drift operates entirely in your browser using `IndexedDB`. 
- **Benefits:** No databases to spin up, no Docker containers, zero friction. You can literally `git clone`, `npm run dev`, and start logging simulations locally. 
- **Use Case:** Individual consultants, quick local testing, or air-gapped environments.

### Enterprise Mode (Remote Backend)
When you're ready to scale, collaborate with a team, or store data centrally, Control Drift seamlessly connects to a remote backend without requiring changes to the core application logic.
- **Benefits:** Collaborative workspaces, centralized reporting, and persistent data across sessions.
- **Supported Backends:** Supabase, Firebase, or custom REST APIs.
- **Use Case:** Internal red/blue teams, continuous posture management, and MSSPs.

## AI Integration & Code Studio

Control Drift doesn't just track data; it accelerates the remediation lifecycle.

1. **Integrated AI:** Connect your preferred AI provider to enable context-aware chatbots, automatic TTP mapping, and simulation strategy generation. The AI acts as a co-pilot, helping you interpret complex environments.
2. **Code Studio:** An integrated, browser-based IDE allows you to write, edit, and test detection rules (Sigma, YARA, SPL, KQL) and emulation payloads. By keeping the engineering workflow inside the platform, the time between discovering a gap and deploying a detection is drastically reduced.

---

*By understanding these core concepts, you are ready to start utilizing Control Drift to its full potential. See the [User Guide](user_guide.md) to learn how to operate the platform day-to-day.*
