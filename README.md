<div align="center">
  <br />
  <img src="public/drift_emblem.png" alt="Control Drift Logo" width="400" />
  <h1>Control Drift</h1>
  <p><strong>A modern, practitioner-first platform to pressure-test security controls, expose silent failures, and measure true defensive readiness against real-world threats.</strong>
    <img src="https://img.shields.io/badge/license-Apache%202.0-blue.svg" alt="License" />
  </p>

  <p>
    <a href="#the-problem-security-control-drift">The Problem</a> •
    <a href="#why-control-drift">Why Control Drift?</a> •
    <a href="#features">Features</a> •
    <a href="#quick-start">Quick Start</a> •
    <a href="#documentation">Documentation</a>
  </p>
</div>

<hr />

## The Problem: Security Control Drift

"Control Drift" occurs when the *expectation* of a security control's effectiveness does not meet the *reality* of its performance. This can happen when an established control (such as an EDR/AV policy, firewall rule, or endpoint configuration) silently degrades or breaks over time due to environment changes, misconfigurations, or software updates. Beyond just detecting this degradation, proactively identifying control drift allows security teams to expose inherent architectural shortcomings and highlight exactly where current controls fail to meet their defensive expectations.

Traditional Breach and Attack Simulation (BAS) tools and purple-teaming platforms are often weighed down by massive infrastructure requirements, clunky user interfaces, and bloated feature sets that make discovering and tracking these gaps a chore, rather than an engaging experience.

Control Drift is built as a lightweight, open-source alternative. It strips away the friction of heavy infrastructure, giving security teams an accessible and visually intuitive environment to get hands-on with threat emulation and track their defensive gaps.

## Why Control Drift?

While other purple-teaming frameworks and posture management tools exist, Control Drift was engineered to solve the pain points inherent in legacy and SaaS platforms:

### 1. Zero-Infrastructure Start
Unlike heavy, legacy platforms that require multi-container Docker stacks, databases, and message brokers just to boot up, **Control Drift can run entirely in your browser.** By utilizing IndexedDB for a local-first experience, you can clone the repository, run `npm run dev`, and start logging gaps immediately. An enterprise setup can be deployed by attaching a Supabase or REST API backend with zero code changes.

### 2. Next-Gen UX/UI
Security analysts deserve tools that feel as good as they work. Control Drift escapes the era of exhausting enterprise data tables. It features a premium, dark-mode glassmorphic interface, dynamic micro-animations, and intuitive workflows designed to eliminate friction and provide a radically enhanced, immersive experience for gap analysis.

### 3. AI-Augmented Workflows
Control Drift includes plug-and-play AI-powered features such as a context-aware chatbot, TTP auto-mapping, simulation strategy generation, executive report generation, and payload / detection rule generation. Simply configure an AI integration within the application settings or via an external proxy.

### 4. Event-Driven Posture Modeling
Many platforms treat technique execution as a rigid 1:1 relationship with a raw outcome. Control Drift utilizes a flexible **event system**. An activity occurring in a simulation is considered an event, which can be tied to one or multiple MITRE TTPs simultaneously. By tracking different procedural variations and how they affect the broader event outcome, Control Drift paints a significantly more accurate picture of your true defensive posture. 

### 5. Analyst Empowerment over Automation
While many commercial solutions attempt to completely automate the testing lifecycle in a "black box" manner, Control Drift is designed to empower human analysts. It equips defenders with the granular control to manually test procedures within their unique environments, fostering a deep understanding of real-world attack mechanics rather than relying on opaque, fully automated simulation results.

---

## Features

- **Security Operations Dashboard**: Track real-time, meaningful metrics including your Global Readiness Score, Top Security Controls, and Remediation Burndown.
  <br/>
  <img src="docs/assets/Dashboard.png" alt="Dashboard Demo" width="800" style="border-radius: 8px; margin: 10px 0;" />

- **MITRE ATT&CK Heatmap**: Fully interactive 3D globe providing a visual representation of your security posture across the MITRE ATT&CK framework, dynamically updated based on simulation outcomes.
  <br/>
  <img src="docs/assets/heatmap.gif" alt="Heatmap Demo" width="800" style="border-radius: 8px; margin: 10px 0;" />

- **Simulation Management**: Plan, execute, and log threat simulations in a highly streamlined manner using the intuitive 4-step Simulation Launcher.
  <br/>
  <img src="docs/assets/Sim_Launcher.gif" alt="Simulation Launcher Demo" width="800" style="border-radius: 8px; margin: 10px 0;" />

- **End-to-end Gap Tracking & Remediation**: Track and prioritize gap remediation across your environment using the built-in Gap Tracker. Resolved gaps instantly update your global readiness metrics.
  <br/>
  <img src="docs/assets/Gap_Tracker.png" alt="Gap Tracker Demo" width="800" style="border-radius: 8px; margin: 10px 0;" />

- **Attack Path Mapping**: Visualize attack paths aross your environment. Leverage your AI integration to automatically map viable attack paths based on your active gaps.
  <br/>
  <img src="docs/assets/attack_path.png" alt="Attack Path Demo" width="800" style="border-radius: 8px; margin: 10px 0;" />
- **Integrated AI**: Plug-and-play AI integration to enhance workflows and introduce AI-powered features.
- **Code Studio**: An integrated, AI-assisted IDE for writing, editing, and managing detection rules (Sigma, YARA, Splunk SPL, Azure KQL) and emulation payloads directly in the browser.
- **Flexible Data Adapters**: Start with `localStorage`/`IndexedDB` for quick testing, then migrate to a backend database (`Supabase`, `Firebase`) or a custom `REST API` when you're ready to scale.

---

## Quick Start

Get up and running locally in less than 60 seconds.

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Control-Drift/Control-Drift.git
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

### Docker Quick Start (Enterprise Mode)

If you prefer to run the full stack via Docker, you can spin up the application in seconds:

```bash
git clone https://github.com/Control-Drift/Control-Drift.git
cd control-drift/deploy
docker compose up -d --build control-drift
```

### Connecting a Remote Database (Optional)

For detailed instructions on deploying a self-hosted backend, AI proxy, and the frontend on a single server for your enterprise, please see the **[Enterprise Deployment Guide](docs/deployment.md)**.

---

## Documentation

For a deeper dive into the platform, check out our comprehensive guides:

- **[User Guide](docs/user_guide.md)**: A complete walkthrough of day-to-day operations and workflows.
- **[Architecture & Concepts](docs/architecture_and_concepts.md)**: Learn about Event-Driven Posture Modeling and the flexible Data Adapter approach.
- **[AI Integration Guide](docs/ai_integration_guide.md)**: Setup instructions to unlock AI capabilities, both locally and via the secure Enterprise proxy.
- **[Enterprise Deployment Guide](docs/deployment.md)**: Detailed instructions for deploying a self-hosted backend.

---

## Contributing

Contributions are welcome. Whether you want to add new data adapters, fix bugs, or suggest new features, feel free to open a Pull Request. If you spot a bug or have a feature request, please open an issue.

---

## License

This project is licensed under the Apache 2.0 License. See the [LICENSE](LICENSE) file for details.
