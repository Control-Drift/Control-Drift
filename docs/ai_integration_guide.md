# Configuring AI Integration

Integrating AI is what truly "turns the power on" for Control Drift. By enabling the AI capabilities, you upgrade the platform into a streamlined, intelligent posture analysis and operations center.

This guide outlines what the AI integration unlocks and how to configure it depending on your deployment model.

## What AI Unlocks

When AI is configured, the following features become available across the platform:

1. **Global AI Assistant:** A context-aware assistant available throughout the console to help you interpret data, suggest simulation ideas, refine remediation strategies, or explain complex MITRE techniques.
2. **Automated Detection Engineering:** Within the Code Studio, the AI can automatically draft Splunk SPL, YARA, Sigma, or Azure KQL queries tailored to the specific gaps you've discovered.
3. **Simulation Strategy Generation:** In the Simulation Launcher, the AI can automatically generate step-by-step procedures and payload recommendations based on the threat scenario or TTPs you've selected.
4. **Automated Attack Path Mapping:** The AI can analyze your currently open gaps and generate viable attack paths, demonstrating how an adversary might chain those gaps together.

## Setup Option 1: Local In-Browser Configuration

If you are running Control Drift locally (using the default `IndexedDB` adapter) and just want to test things out, you can provide your API key directly in the browser.

> [!WARNING]
> Only use this method for local testing. Storing API keys directly in-browser is not recommended for production or collaborative enterprise environments.

### Steps:
1. Navigate to the **Settings** gear icon in the bottom left of the navigation menu.
2. Select the **AI Configuration** tab.
3. Enter the absolute URL to your OpenAI-compatible Chat Completions endpoint (e.g., `https://api.openai.com/v1/chat/completions` or a local proxy URL for LM Studio/Ollama).
4. Enter your API Key (if required by your endpoint).
5. Specify the exact model string you wish to use (e.g., `gpt-4o`, `llama-3`, etc.).
6. Click "Test Connection". A successfully connection is required before saving.
6. Click **Save Settings**. 

The AI features will instantly activate across the platform.

## Setup Option 2: Enterprise AI Proxy

When deploying Control Drift for a team using the Enterprise setup (Supabase + Docker), you do not want every analyst to supply their own API key, nor do you want to hardcode a shared key into the frontend. 

Instead, the provided `setup-enterprise` scripts automatically configure a **LiteLLM Proxy**. This proxy acts as a secure middleman: the frontend sends the prompt to your LiteLLM backend, and the proxy securely appends the API key before forwarding the request to the AI provider.

### Steps:

1. **Run the Setup Script:** 
   Navigate to the `deploy` folder and run either `setup-enterprise.sh` (Linux/macOS) or `setup-enterprise.ps1` (Windows).

2. **Follow the Interactive Prompts:**
   During the installation, the script will automatically pause and ask you to configure your AI integration:
   - **Provider:** Select your preferred provider (OpenAI, Anthropic, Gemini, etc.).
   - **Model Name:** Specify the model you wish to use.
   - **Endpoint URL:** Enter your target AI endpoint URL (or leave blank for the default).
   - **API Key:** Enter your secure API key.

3. **Automatic Configuration:**
   The script will automatically generate the `litellm-config.yaml` file, spin up the LiteLLM proxy container on port `4000`, and generate a `config.json` that instructs the Control Drift frontend to route all AI requests securely through `http://<your-server-ip>:4000/v1/chat/completions`.

4. **Frontend Lock-Down:**
   Once the enterprise configuration is loaded via `config.json`, the Control Drift **Settings** menu will automatically lock the AI configuration fields. It will notify users that external infrastructure is managing the AI integration, preventing individual users from overriding the settings with their personal API keys.

---

*With AI successfully configured, you are ready to utilize the AI-powered features of Control Drift. Check out the [User Guide](user_guide.md) to see these features in action.*
