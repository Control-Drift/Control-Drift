<div align="center">
  <br />
  <img src="public/drift_emblem.png" alt="Control Drift Logo" width="120" />
  <h1>Control Drift</h1>
  <p><strong>A modern, zero-infrastructure platform for empowering cybersecurity operators to challenge their security stack, measure defense capability, and increase readiness against future cyber attacks.</strong></p>

  <p>
    <a href="#the-problem-security-control-drift">The Problem</a> •
    <a href="#why-control-drift">Why Control Drift?</a> •
    <a href="#features">Features</a> •
    <a href="#quick-start">Quick Start</a>
  </p>
</div>

<hr />

## The Problem: Security Control Drift

In cybersecurity, "Control Drift" occurs when the *expectation* of a security control's effectiveness no longer meets the *reality* of its performance. This can happen when a previously validated control (like a firewall rule, EDR policy, or SIEM alert) silently degrades or breaks over time due to environment changes, misconfigurations, or software updates. 

Traditional Breach and Attack Simulation (BAS) tools and purple-teaming platforms are often weighed down by massive infrastructure requirements, clunky enterprise interfaces, and bloated feature sets that make tracking these specific, day-to-day regressions a chore.

**Control Drift is built differently.** It goes beyond simply logging regressions; it is designed to empower cybersecurity operators to actively challenge their security stack, measure defensive capabilities, and continuously increase their readiness for future cyber attacks—all while helping defenders learn more about pentesting and adversary simulation.

## Why Control Drift?

While other purple-teaming frameworks and posture management tools exist, Control Drift was engineered to solve the pain points inherent in legacy platforms:

### 1. Zero-Infrastructure Start
Unlike heavy, legacy platforms that require you to spin up multi-container Docker stacks, databases, and message brokers just to boot up, **Control Drift can run entirely in your browser.** By utilizing IndexedDB for a local-first experience, you can clone the repository, run `npm run dev`, and start logging gaps immediately. Ready for enterprise collaboration? Seamlessly attach a Supabase or REST API backend with zero code changes.

### 2. Unmatched UX/UI
We believe security analysts deserve tools that feel as good as they work. Control Drift escapes the era of exhausting enterprise data tables. It features a premium, dark-mode glassmorphic interface, dynamic micro-animations, and intuitive workflows that significantly lower the barrier to entry for both red and blue teams.

### 3. AI-Augmented Workflows
Stop wasting time writing boilerplate detection summaries or manually cross-referencing MITRE techniques. Control Drift includes built-in LLM configuration, allowing you to instantly generate payload execution summaries and map findings directly to the MITRE ATT&CK framework with AI assistance.

### 4. Holistic Degradation Tracking
Control Drift doesn't just record a simplistic "pass" or "fail." It unifies the tracking of *Expected* vs. *Actual* outcomes across multiple simulations, automatically graphing your data on a dynamic MITRE heatmap so you can visually pinpoint exactly when and where a defense degraded.

### 5. Event-Driven Posture Modeling
Many platforms treat technique execution as a rigid 1:1 relationship with a raw outcome. Control Drift utilizes a flexible **event system**. An activity occurring in a simulation is considered an event, which can be tied to one or multiple MITRE TTPs simultaneously. By tracking different procedural variations and how they affect the broader event outcome, Control Drift paints a significantly more accurate picture of your true defensive posture. Furthermore, it supports **per-event coverage ratings**—recognizing that a raw outcome like "Alerted" might be considered optimal coverage in one scenario but only partial coverage in another, depending on the specific environmental context and whether that outcome is the most realistically achievable result for that event type.

---

## Features

- **MITRE ATT&CK Heatmap**: A fully interactive 3D globe providing a visual representation of your security posture across the entire MITRE matrix, dynamically updated based on simulation outcomes.
- **Simulation Management**: Plan, execute, and log internal or external red team simulations in a highly streamlined manner using the intuitive 4-step simulation launcher, complete with step-by-step procedure tracking.
- **Gap Tracking & Triage**: Identify, categorize, and track the remediation of detection and prevention gaps across your environment.
- **Flexible Data Adapters**: Start with `localStorage`/`IndexedDB` for quick testing, then seamlessly migrate to `Supabase` or a custom `REST API` when you're ready to scale.
- **Command Palette & Hotkeys**: Navigate at the speed of thought with an integrated command palette (Ctrl+K / Cmd+K).

---

## Quick Start

Get up and running locally in less than 60 seconds.

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-org/control-drift.git
   cd control-drift
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:** Navigate to `http://localhost:5173`. You are now running Control Drift entirely in your browser using the local database adapter!

### Connecting a Remote Database (Optional)
To collaborate with your team, you can configure a remote backend (like Supabase) directly from the **Settings** menu inside the app. Control Drift will automatically handle authentication, session persistence, and data synchronization.

For instructions on deploying a self-hosted backend, AI proxy, and the frontend on a single server for your enterprise, please see our **[Enterprise Deployment Guide](docs/deployment.md)**.

---

## Contributing

We welcome contributions from the community! Whether it's adding new database adapters, refining the UI, or extending the MITRE mappings, please feel free to submit a Pull Request.

## License

This project is licensed under the Apache 2.0 License. See the [LICENSE](LICENSE) file for details.
