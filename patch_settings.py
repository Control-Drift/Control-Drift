import re

filepath = r"C:\Users\thoma\.gemini\antigravity\scratch\control-drift\src\components\pages\Settings.jsx"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update initial state
content = re.sub(
    r"const \[localSettings, setLocalSettings\] = useState\(aiSettings \|\| \{.*?\n\s*\}\);",
    "const [localSettings, setLocalSettings] = useState(aiSettings || { endpointUrl: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o', apiKey: '', customHeaders: '' });",
    content,
    flags=re.DOTALL
)

# 2. Update derived state variables
content = re.sub(
    r"const defaultAi = \{ provider: 'Gemini', model: 'gemini-3\.5-flash', backendModel: '', apiKey: '' \};",
    "const defaultAi = { endpointUrl: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o', apiKey: '', customHeaders: '' };",
    content
)

content = re.sub(
    r"const isAiConfigured = !!localSettings\.apiKey \|\| localSettings\.provider === 'Custom \(OpenAI Compatible\)';",
    "const isAiConfigured = !!localSettings.endpointUrl || !!localSettings.apiKey;",
    content
)

content = re.sub(
    r"const isBackendConfigured = !!localSettings\.backendModel;\n\s*const needsBackendTest = aiSettingsModified && isBackendConfigured && backendTestStatus !== 'success';",
    "",
    content
)

# 3. Replace testAiConnection, testBackendAiConnection, and handleSave
new_functions = """  const testAiConnection = async () => {
      setAiTestStatus('testing');
      setAiTestMsg('');
      try {
          const { endpointUrl, apiKey } = localSettings;
          if (!apiKey && (!endpointUrl || endpointUrl.includes('api.openai.com'))) throw new Error('API Key is required for default OpenAI endpoint');
          
          const { aiManager } = await import('../../lib/ai/core.js');
          const adapter = await aiManager.initialize(localSettings);
          
          const timeoutSeconds = 60000;
          const testPromise = adapter.ping();
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error(`Connection test timed out after ${timeoutSeconds/1000} seconds. The API or local model is likely unresponsive.`)), timeoutSeconds));
          
          await Promise.race([testPromise, timeoutPromise]);
          
          setAiTestStatus('success');
          setAiTestMsg('Connection successful!');
          return true;
      } catch (err) {
          setAiTestStatus('error');
          setAiTestMsg(err.message);
          return false;
      }
  };

  const handleSave = async () => {
      const isConfiguringPrimary = !!localSettings.endpointUrl || !!localSettings.apiKey;
      const defaultAi = { endpointUrl: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o', apiKey: '', customHeaders: '' };
      const aiSettingsModified = JSON.stringify(localSettings) !== JSON.stringify(aiSettings || defaultAi);
  
      if (isConfiguringPrimary && aiSettingsModified) {
          if (aiTestStatus !== 'success') {
              setSaveStatus('Save aborted. Please test the AI connection first.');
              setTimeout(() => setSaveStatus(''), 4000);
              return;
          }
          localSettings.isValidated = true;
      } else if (!isConfiguringPrimary) {
          localSettings.isValidated = false;
      }
  
      setAiSettings(localSettings);
      if (setDbConfig) setDbConfig(localDbConfig);
      setSaveStatus('Settings saved successfully!');
      setTimeout(() => setSaveStatus(''), 3000);
  };
"""

content = re.sub(
    r"const testAiConnection = async \(\) => \{.*?(?=const testDbConnection = async \(\) => \{)",
    new_functions,
    content,
    flags=re.DOTALL
)


# 4. Replace the UI block
new_ui = """        {expandedPanels.ai && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontWeight: 'bold' }}>
              <Globe size={18} /> API Base URL
            </label>
            <input 
              className="ai-input" 
              style={{ width: '100%', padding: '12px', fontSize: '1rem', background: 'rgba(0,0,0,0.4)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}
              value={localSettings.endpointUrl || ''}
              onChange={e => {
                  setLocalSettings({...localSettings, endpointUrl: e.target.value});
                  setAiTestStatus('idle');
              }}
              placeholder="e.g. https://api.openai.com/v1/chat/completions"
            />
            <p style={{ margin: '5px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                The absolute URL to your OpenAI-compatible Chat Completions endpoint. Works with OpenAI, Ollama, LM Studio, vLLM, Groq, etc.
            </p>
          </div>

          <div>
             <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontWeight: 'bold' }}>
               <Cpu size={18} /> Model Name
             </label>
             <input 
               className="ai-input" 
               style={{ width: '100%', padding: '12px', fontSize: '1rem', background: 'rgba(0,0,0,0.4)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}
               value={localSettings.model || ''}
               onChange={e => {
                   setLocalSettings({...localSettings, model: e.target.value});
                   setAiTestStatus('idle');
               }}
               placeholder="e.g. gpt-4o or llama-3-8b-instruct"
             />
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontWeight: 'bold' }}>
              <Key size={18} /> API Key (Optional for Local LLMs)
            </label>
            <div style={{ position: 'relative', width: '100%', boxSizing: 'border-box' }}>
              <input 
                type={showAiKey ? "text" : "password"}
                className="ai-input" 
                style={{ width: '100%', boxSizing: 'border-box', padding: '12px', paddingRight: '40px', fontSize: '1rem', background: 'rgba(0,0,0,0.4)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}
                value={localSettings.apiKey || ''}
                onChange={e => {
                    setLocalSettings({...localSettings, apiKey: e.target.value});
                    setAiTestStatus('idle');
                }}
                placeholder="Enter your API key..."
              />
              <button 
                  onClick={() => setShowAiKey(!showAiKey)}
                  style={{ position: 'absolute', right: '12px', top: '12px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                  {showAiKey ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(255, 165, 0, 0.1)', border: '1px solid rgba(255, 165, 0, 0.3)', borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'orange', marginBottom: '8px', fontWeight: 'bold' }}>
                    <Shield size={16} /> Security Notice (BYOK)
                </div>
                Your API key is obfuscated and stored locally in your browser. Do not use this application on a shared or public computer.
            </div>
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontWeight: 'bold' }}>
              <Server size={18} /> Custom HTTP Headers (Optional)
            </label>
            <textarea 
              className="ai-input" 
              style={{ width: '100%', padding: '12px', fontSize: '1rem', background: 'rgba(0,0,0,0.4)', borderRadius: '8px', minHeight: '80px', fontFamily: 'monospace', border: '1px solid rgba(255,255,255,0.1)' }}
              value={localSettings.customHeaders || ''}
              onChange={e => {
                  setLocalSettings({...localSettings, customHeaders: e.target.value});
                  setAiTestStatus('idle');
              }}
              placeholder='{"x-custom-auth": "secret-token", "X-My-Proxy": "value"}'
            />
            <p style={{ margin: '5px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Enter custom headers as a valid JSON object.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginTop: '10px' }}>
              <button 
                 className={`btn hover-lift ${needsAiTest ? 'animate-glow-pulse' : ''}`} 
                 onClick={testAiConnection}
                 disabled={aiTestStatus === 'testing'}
                 style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 18px', background: needsAiTest ? 'rgba(156, 39, 176, 0.2)' : 'rgba(255,255,255,0.05)', border: needsAiTest ? '1px solid var(--accent-primary)' : '1px solid var(--glass-border)', boxShadow: needsAiTest ? '0 0 15px rgba(156, 39, 176, 0.4)' : 'none' }}
              >
                 {aiTestStatus === 'testing' ? (
                     <div className="ai-think-spin" style={{ width: '22px', height: '22px', background: 'linear-gradient(135deg, rgba(29,78,216,0.4), rgba(126,34,206,0.4))', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(126,34,206,0.6)', boxShadow: '0 0 10px rgba(156, 39, 176, 0.6)' }}>
                         <BrainCircuit size={12} color="var(--accent-secondary)" />
                     </div>
                 ) : <Activity size={18} />} 
                 {aiTestStatus === 'testing' ? <span className="animate-pulse">Connecting...</span> : <span>Test AI Connection</span>}
              </button>
              {aiTestStatus === 'success' && <div style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem' }}><CheckCircle size={16} /> {aiTestMsg}</div>}
              {aiTestStatus === 'error' && <div style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem' }}><XCircle size={16} /> {aiTestMsg}</div>}
          </div>
        </div>
        )}"""

content = re.sub(
    r"\{expandedPanels\.ai && \(\n\s*<div style=\{\{ display: 'flex', flexDirection: 'column', gap: '30px' \}\}>.*?\{aiTestStatus === 'error'.*?</div>\n\s*</div>\n\s*\)\}",
    new_ui,
    content,
    flags=re.DOTALL
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Patched Settings.jsx")
