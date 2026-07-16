/*
 * Copyright 2024 Control Drift Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { useState, useRef } from 'react';
import DOMPurify from 'dompurify';
import { encryptData, decryptData } from '../../lib/cryptoUtils';
import { useAppContext } from '../../AppContext';
import { Settings as SettingsIcon, Save, Key, Cpu, Globe, Trash2, ChevronDown, Upload, Eye, EyeOff, CheckCircle, XCircle, Loader, Activity, Tag, BrainCircuit, Shield, Sparkles, Server, Layers } from 'lucide-react';
import { validateBulkData, GapSchema, ExerciseSchema, SimulationSummarySchema } from '../../lib/schemas';
import { useToast } from '../ui/Toast';

import { Database as DatabaseIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Settings() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { aiSettings, setAiSettings, targetEnvironments, deleteEnvironment, targetTags, deleteTag, targetSecurityControls, deleteSecurityControl, addSecurityControl, confirmAction, dbConfig, setDbConfig, dbAdapter, testDbConnection: pingDb } = useAppContext();
  const [localSettings, setLocalSettings] = useState(aiSettings || { endpointUrl: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o', apiKey: '', customHeaders: '' });
  const [localDbConfig, setLocalDbConfig] = useState(dbConfig || { provider: 'local', endpoint: '', apiKey: '' });
  const [saveStatus, setSaveStatus] = useState('');
  const [targetEnvDropdownOpen, setTargetEnvDropdownOpen] = useState(false);
  const [newSecurityControl, setNewSecurityControl] = useState('');
  
  const [showAiKey, setShowAiKey] = useState(false);
  const [showDbKey, setShowDbKey] = useState(false);
  const [aiTestStatus, setAiTestStatus] = useState('idle'); // idle, testing, success, error
  const [dbTestStatus, setDbTestStatus] = useState('idle');
  const [aiTestMsg, setAiTestMsg] = useState('');
  const [dbTestMsg, setDbTestMsg] = useState('');
  
  const [backendTestStatus, setBackendTestStatus] = useState('idle');
  const [backendTestMsg, setBackendTestMsg] = useState('');
  const [showBackendProviderDropdown, setShowBackendProviderDropdown] = useState(false);

  const [expandedPanels, setExpandedPanels] = useState({
    ai: true,
    db: false,
    taxonomy: false,
    data: false
  });

  const togglePanel = (panel) => {
    setExpandedPanels(prev => ({ ...prev, [panel]: !prev[panel] }));
  };

  // Backup state
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordAction, setPasswordAction] = useState(null);
  const [backupPassword, setBackupPassword] = useState('');
  const [pendingImportFile, setPendingImportFile] = useState(null);
  const [backupLoading, setBackupLoading] = useState(false);

  const { gaps, exercises, simulationSummaries, simulationEvidence, setGaps, setExercises, setSimulationSummaries, setSimulationEvidence, setActiveAiContext, injectTestData } = useAppContext();

  const defaultAi = { endpointUrl: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o', apiKey: '', customHeaders: '' };
  const aiSettingsModified = JSON.stringify(localSettings) !== JSON.stringify(aiSettings || defaultAi);
  const dbSettingsModified = JSON.stringify(localDbConfig) !== JSON.stringify(dbConfig || { provider: 'local', endpoint: '', apiKey: '' });
  const hasUnsavedChanges = aiSettingsModified || dbSettingsModified;
  
  const isAiConfigured = !!localSettings.endpointUrl || !!localSettings.apiKey;
  const needsAiTest = aiSettingsModified && isAiConfigured && aiTestStatus !== 'success';
  

  React.useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (e) => {
        e.preventDefault();
        e.returnValue = '';
    };

    const handleAnchorClick = (e) => {
        const target = e.target.closest('a');
        // Prevent navigating away via internal links if there are unsaved changes
        if (target && target.href && !target.href.includes('#') && !target.hasAttribute('download')) {
            e.preventDefault();
            e.stopPropagation();
            
            const targetPath = new URL(target.href).pathname;
            confirmAction("You have unsaved settings. Are you sure you want to leave this page without saving?", () => {
                navigate(targetPath);
            });
        }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleAnchorClick, { capture: true });

    return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        document.removeEventListener('click', handleAnchorClick, { capture: true });
    };
  }, [hasUnsavedChanges]);

  React.useEffect(() => {
    setActiveAiContext({
        view: 'Global Settings',
        description: 'Application configuration, including AI integration, backend database settings, and global environment targeting parameters.'
    });
    return () => setActiveAiContext(null);
  }, [setActiveAiContext]);

  React.useEffect(() => {
      if (passwordModalOpen) {
          document.body.style.overflow = 'hidden';
      } else {
          document.body.style.overflow = 'unset';
      }
      return () => { document.body.style.overflow = 'unset'; };
  }, [passwordModalOpen]);
  const handleDeleteMetadata = (type, name) => {
      let exerciseCount = 0;
      let gapCount = 0;
      
      exercises.forEach(ex => {
          if (type === 'environment') {
              if (Array.isArray(ex.environment) ? ex.environment.includes(name) : ex.environment === name) exerciseCount++;
          } else if (type === 'tag') {
              if (Array.isArray(ex.tags) ? ex.tags.includes(name) : ex.tags === name) exerciseCount++;
          } else if (type === 'control') {
              if (Array.isArray(ex.securityControls) ? ex.securityControls.includes(name) : ex.securityControls === name) exerciseCount++;
          }
      });

      gaps.forEach(gap => {
          if (type === 'environment') {
              if (Array.isArray(gap.environment) ? gap.environment.includes(name) : (typeof gap.environment === 'string' && gap.environment.split(',').map(s=>s.trim()).includes(name))) gapCount++;
          } else if (type === 'tag') {
              if (Array.isArray(gap.tags) ? gap.tags.includes(name) : (typeof gap.tags === 'string' && gap.tags.split(',').map(s=>s.trim()).includes(name))) gapCount++;
          } else if (type === 'control') {
              if (Array.isArray(gap.securityControls) ? gap.securityControls.includes(name) : (typeof gap.securityControls === 'string' && gap.securityControls.split(',').map(s=>s.trim()).includes(name))) gapCount++;
          }
      });
      
      let simCount = 0;
      Object.values(simulationSummaries || {}).forEach(sim => {
          if (sim.details) {
              if (type === 'environment') {
                  if (Array.isArray(sim.details.environmentCategory) ? sim.details.environmentCategory.includes(name) : sim.details.environmentCategory === name) simCount++;
                  if (Array.isArray(sim.details.environment) ? sim.details.environment.includes(name) : sim.details.environment === name) simCount++;
              } else if (type === 'tag') {
                  if (Array.isArray(sim.details.tags) ? sim.details.tags.includes(name) : sim.details.tags === name) simCount++;
              }
          }
      });
      
      if (exerciseCount > 0 || gapCount > 0 || simCount > 0) {
          addToast(`Cannot delete ${name}: It is currently referenced by ${exerciseCount} exercise(s), ${simCount} simulation(s), and ${gapCount} gap(s). Please remove these references first.`, 'error');
          return;
      }
      
      if (type === 'environment') confirmAction(`Delete the environment "${name}"?`, () => deleteEnvironment(name));
      if (type === 'tag') confirmAction(`Delete the tag "${name}"?`, () => deleteTag(name));
      if (type === 'control') confirmAction(`Delete the security control "${name}"?`, () => deleteSecurityControl(name));
  };


  const validateSchema = (data) => {
     if (!data || typeof data !== 'object') throw new Error("Invalid format: Must be a JSON object");
     if (data.gaps && !Array.isArray(data.gaps)) throw new Error("Schema error: gaps must be an array");
     if (data.exercises && !Array.isArray(data.exercises)) throw new Error("Schema error: exercises must be an array");
     return true;
  };

  const sanitizeData = (data) => {
     if (typeof data === 'string') return DOMPurify.sanitize(data);
     if (Array.isArray(data)) return data.map(sanitizeData);
     if (typeof data === 'object' && data !== null) {
         const clean = {};
         for (let key in data) {
             clean[key] = sanitizeData(data[key]);
         }
         return clean;
     }
     return data;
  };

  const executeBackup = async () => {
      if (!backupPassword) return alert("Password is required to encrypt the backup.");
      setBackupLoading(true);
      try {
          const data = { gaps, exercises, simulationSummaries, simulationEvidence };
          const jsonString = JSON.stringify(data);
          const encrypted = await encryptData(jsonString, backupPassword);
          
          const blob = new Blob([encrypted], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `control-drift-backup-${new Date().toISOString().split('T')[0]}.enc`;
          a.click();
          URL.revokeObjectURL(url);
          setSaveStatus('Backup encrypted and downloaded successfully.');
      } catch (e) {
          setSaveStatus('Error encrypting backup.');
      }
      setBackupLoading(false);
      setPasswordModalOpen(false);
      setBackupPassword('');
      setTimeout(() => setSaveStatus(''), 4000);
  };

  const finalizeImportData = (data, isEncrypted = true) => {
      validateSchema(data);
      const sanitizedData = sanitizeData(data);

      if (sanitizedData.exercises) {
          sanitizedData.exercises = validateBulkData(ExerciseSchema, sanitizedData.exercises, "Imported Exercise");
      }
      if (sanitizedData.gaps) {
          sanitizedData.gaps = validateBulkData(GapSchema, sanitizedData.gaps, "Imported Gap");
      }
      if (sanitizedData.simulationSummaries) {
          const simsArray = Object.keys(sanitizedData.simulationSummaries).map(key => ({
              id: key,
              summary: sanitizedData.simulationSummaries[key]
          }));
          const validSimsArray = validateBulkData(SimulationSummarySchema, simsArray, "Imported Simulation");
          const newSimsMap = {};
          validSimsArray.forEach(sim => {
              newSimsMap[sim.id] = sim.summary;
          });
          sanitizedData.simulationSummaries = newSimsMap;
      }
      
      setBackupLoading(false);
      setPasswordModalOpen(false);
      setBackupPassword('');
      setPendingImportFile(null);
      
      confirmAction("Are you sure? This will overwrite your current workspace.", async () => {
          try {
              if (dbAdapter && typeof dbAdapter.bulkImport === 'function') {
                  await dbAdapter.bulkImport(sanitizedData);
              }
              if (sanitizedData.gaps) setGaps(sanitizedData.gaps);
              if (sanitizedData.exercises) setExercises(sanitizedData.exercises);
              if (sanitizedData.simulationSummaries) setSimulationSummaries(sanitizedData.simulationSummaries);
              if (sanitizedData.simulationEvidence) setSimulationEvidence(sanitizedData.simulationEvidence);
              setSaveStatus(isEncrypted ? 'Encrypted backup restored securely.' : 'JSON data imported successfully.');
              setTimeout(() => setSaveStatus(''), 4000);
          } catch (err) {
              setSaveStatus(`Backend import failed: ${err.message}`);
              setTimeout(() => setSaveStatus(''), 4000);
          }
      });
  };

  const handleImportSelect = (event) => {
      const file = event.target.files[0];
      if (!file) return;
      
      if (file.name.endsWith('.json')) {
          const reader = new FileReader();
          reader.onload = (e) => {
              try {
                  const data = JSON.parse(e.target.result);
                  finalizeImportData(data, false);
              } catch (err) {
                  let msg = err.message;
                  if (err instanceof SyntaxError) {
                      msg = `JSON parsing failed: ${err.message}`;
                  } else {
                      msg = `Import validation failed: ${err.message}`;
                  }
                  setSaveStatus(msg);
                  setTimeout(() => setSaveStatus(''), 7000); // give them more time to read long schema errors
              }
          };
          reader.readAsText(file);
      } else {
          setPendingImportFile(file);
          setPasswordAction('import');
          setPasswordModalOpen(true);
      }
      event.target.value = null;
  };

  const executeImport = async () => {
      if (!backupPassword) return alert("Password is required to decrypt the backup.");
      setBackupLoading(true);
      
      const reader = new FileReader();
      reader.onload = async (e) => {
          try {
              const decryptedStr = await decryptData(e.target.result, backupPassword);
              const data = JSON.parse(decryptedStr);
              finalizeImportData(data, true);
          } catch (err) {
              setBackupLoading(false);
              let msg = err.message;
              if (err instanceof SyntaxError) {
                  msg = `Decryption/Parsing failed: ${err.message}`;
              } else {
                  msg = `Import validation failed: ${err.message}`;
              }
              setSaveStatus(msg);
              setTimeout(() => setSaveStatus(''), 7000);
          }
      };
      reader.readAsText(pendingImportFile);
  };

    const testAiConnection = async () => {
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
const testDbConnection = async () => {
      setDbTestStatus('testing');
      setDbTestMsg('');
      try {
          if (!localDbConfig.endpoint) throw new Error('Endpoint URL is required');
          
          let res;
          const cleanEndpoint = localDbConfig.endpoint.trim().replace(/\/$/, '');
          const cleanApiKey = (localDbConfig.apiKey || '').trim();
          
          if (localDbConfig.provider === 'supabase') {
              // Ping a specific table to avoid root introspection 401s
              res = await fetch(`${cleanEndpoint}/rest/v1/gaps?limit=1`, {
                  method: 'GET',
                  headers: { 'apikey': cleanApiKey, 'Authorization': `Bearer ${cleanApiKey}` }
              });
          } else {
              // Generic ping
              res = await fetch(cleanEndpoint, { method: 'GET' });
          }
          
          if (!res || !res.ok) throw new Error(`HTTP Error: ${res?.status}`);
          setDbTestStatus('success');
          setDbTestMsg('Connection successful!');
      } catch (err) {
          setDbTestStatus('error');
          setDbTestMsg(err.message);
      }
  };

  return (
    <div className="animate-fade-in" style={{ height: '100%', overflowY: 'auto', paddingRight: '10px' }}>
      <h1 className="iridescent-text" style={{ fontSize: '2.5rem', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <SettingsIcon size={36} /> System Configuration
      </h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '40px', fontSize: '1.1rem' }}>Manage your global application settings, including AI provider integrations.</p>
      
      <div className="glass-panel" style={{ padding: '30px', maxWidth: '800px' }}>
        <h2 
           onClick={() => togglePanel('ai')} 
           style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '15px', marginBottom: expandedPanels.ai ? '25px' : '0', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', justifyContent: 'space-between' }}
        >
           <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
               <BrainCircuit size={24} color="var(--accent-secondary)" /> Generative AI Integration
           </div>
           <ChevronDown size={20} style={{ transform: expandedPanels.ai ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }} />
        </h2>
        
        {expandedPanels.ai && (
          <div className="panel-content glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {aiSettings.isProxy ? (
              <div style={{ padding: '20px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 10px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Shield size={18} color="rgba(59, 130, 246, 1)" /> AI Proxy Enabled
                </h4>
                <p style={{ margin: '0', color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                  AI integration is currently being managed by external infrastructure.
                </p>
                <div style={{ marginTop: '15px', padding: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  <strong>Endpoint:</strong> {aiSettings.endpointUrl} <br/>
                  <strong>Model:</strong> {aiSettings.model}
                </div>
              </div>
            ) : (
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
             <details style={{ background: 'rgba(255,255,255,0.02)', padding: '15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                 <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 'bold', outline: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Server size={18} /> Custom HTTP Headers (Optional)
                 </summary>
                 <div style={{ marginTop: '15px' }}>
                    <textarea 
                      className="ai-input" 
                      style={{ width: '100%', padding: '12px', fontSize: '1rem', background: 'rgba(0,0,0,0.4)', borderRadius: '8px', minHeight: '80px', fontFamily: 'monospace', border: '1px solid rgba(255,255,255,0.1)', boxSizing: 'border-box' }}
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
             </details>
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
            )}
          </div>
        )}
      </div>

      <div className="glass-panel" style={{ padding: '30px', maxWidth: '800px', marginTop: '30px' }}>
        <h2 
           onClick={() => togglePanel('db')} 
           style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '15px', marginBottom: expandedPanels.db ? '15px' : '0', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', justifyContent: 'space-between' }}
        >
           <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
               <DatabaseIcon size={24} color="var(--accent-primary)" /> Database & Sync
           </div>
           <ChevronDown size={20} style={{ transform: expandedPanels.db ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }} />
        </h2>
        
        {expandedPanels.db && (
        <>
        <div className="panel-content glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '20px' }}>
            {dbAdapter && dbAdapter.type === 'supabase' ? (
              <div style={{ padding: '20px', background: 'rgba(29, 78, 216, 0.1)', border: '1px solid rgba(29, 78, 216, 0.3)', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 10px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Globe size={18} color="var(--accent-primary)" /> Database Connected
                </h4>
                <p style={{ margin: '0', color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                  Control Drift is currently connected to a remote database. Data is synchronized continuously.
                </p>
                <div style={{ marginTop: '15px', padding: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  <strong>Provider:</strong> {dbConfig?.provider || 'Supabase'} <br/>
                  <strong>Endpoint:</strong> {dbConfig?.endpoint || 'Unknown'}
                </div>
              </div>
            ) : (
              <div style={{ padding: '20px', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid var(--glass-border)', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 10px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <DatabaseIcon size={18} color="var(--text-muted)" /> Local Storage Mode
                </h4>
                <p style={{ margin: '0', color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                  No remote database configuration found. The application is running securely offline using your browser's local storage.
                </p>
              </div>
            )}
        </div>
          <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--glass-border)' }}>
             <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>Data Export & Migration</label>
             <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '15px' }}>Download a complete JSON snapshot of all your simulations, gaps, and evidence. You can upload this snapshot to a newly connected database to instantly migrate your entire workspace!</p>
             <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                 <button className="btn hover-lift" onClick={() => { setPasswordAction('export'); setPasswordModalOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)' }}>
                     <Save size={16} /> Export Backup
                 </button>
                 <button className="btn hover-lift" onClick={() => document.getElementById('db-import-input').click()} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)' }}>
                     <Upload size={16} /> Import / Migrate Backup
                 </button>
                 <input type="file" id="db-import-input" accept=".enc,.json" style={{ display: 'none' }} onChange={handleImportSelect} />
             </div>
             {saveStatus && saveStatus.includes('Database imported') && <p style={{ color: 'var(--success)', marginTop: '10px', fontSize: '0.9rem' }}>{saveStatus}</p>}
             {saveStatus && saveStatus.includes('Error parsing') && <p style={{ color: 'var(--danger)', marginTop: '10px', fontSize: '0.9rem' }}>{saveStatus}</p>}
          </div>
        </>
        )}
      </div>

      {/* Global Metadata Section */}
      <div className="glass-panel" style={{ padding: '30px', maxWidth: '800px', marginTop: '30px', position: 'relative', zIndex: 5 }}>
        <h2 
           onClick={() => togglePanel('taxonomy')} 
           style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '15px', marginBottom: expandedPanels.taxonomy ? '25px' : '0', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', justifyContent: 'space-between' }}
        >
           <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
               <Layers size={24} color="var(--accent-secondary)" /> Global Metadata
           </div>
           <ChevronDown size={20} style={{ transform: expandedPanels.taxonomy ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }} />
        </h2>
        
        {expandedPanels.taxonomy && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
            
            {/* Target Environments */}
            <div>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent-primary)', marginBottom: '10px' }}>
                    <Globe size={20} /> Environments
                </h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
                   Custom environments are automatically saved when introduced in the Simulation Scope Details. You can manage and delete them here.
                </p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                     {(!targetEnvironments || targetEnvironments.length === 0) && (
                         <div style={{ padding: '15px', color: 'var(--text-muted)', fontStyle: 'italic', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px dashed var(--glass-border)' }}>
                             No environments have been created yet. Launch a new simulation to create one!
                         </div>
                     )}
                     {targetEnvironments?.map(env => (
                         <div key={env} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '8px' }}>
                             <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                 <Globe size={18} color="var(--accent-primary)" />
                                 <span style={{ fontWeight: 'bold' }}>{env}</span>
                             </div>
                             <button 
                                 onClick={() => handleDeleteMetadata('environment', env)}
                                 style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '6px' }}
                                 title="Delete Environment"
                             >
                                 <Trash2 size={16} />
                             </button>
                         </div>
                     ))}
                </div>
            </div>

            <div style={{ height: '1px', background: 'var(--glass-border)' }} />

            {/* Tag Management */}
            <div>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent-secondary)', marginBottom: '10px' }}>
                    <Tag size={20} /> Tags
                </h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
                   Custom tags are automatically saved when introduced in the Simulation Scope Details. You can manage and delete them here.
                </p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                     {(!targetTags || targetTags.length === 0) && (
                         <div style={{ padding: '15px', color: 'var(--text-muted)', fontStyle: 'italic', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px dashed var(--glass-border)' }}>
                             No tags have been created yet. Launch a new simulation to create one!
                         </div>
                     )}
                     {targetTags?.map(tag => (
                         <div key={tag} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '8px' }}>
                             <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                 <Tag size={18} color="var(--accent-secondary)" />
                                 <span style={{ fontWeight: 'bold' }}>{tag}</span>
                             </div>
                             <button 
                                 onClick={() => handleDeleteMetadata('tag', tag)}
                                 style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '6px' }}
                                 title="Delete Tag"
                             >
                                 <Trash2 size={16} />
                             </button>
                         </div>
                     ))}
                </div>
            </div>

            <div style={{ height: '1px', background: 'var(--glass-border)' }} />

            {/* Security Controls Settings */}
            <div>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent-secondary)', marginBottom: '10px' }}>
                    <Shield size={20} /> Security Controls
                </h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
                   Custom security controls are automatically saved when introduced in an event's outcome card. You can also manually add, manage, and delete them here.
                </p>

                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                     <input 
                         type="text" 
                         value={newSecurityControl} 
                         onChange={(e) => setNewSecurityControl(e.target.value)}
                         onKeyDown={(e) => {
                             if (e.key === 'Enter' && newSecurityControl.trim()) {
                                 addSecurityControl(newSecurityControl);
                                 setNewSecurityControl('');
                             }
                         }}
                         placeholder="Enter new security control (e.g. Splunk, CrowdStrike)..."
                         className="form-input" 
                         style={{ flex: 1, padding: '10px 15px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: '#fff', borderRadius: '8px' }}
                     />
                     <button 
                         onClick={() => {
                             if (newSecurityControl.trim()) {
                                 addSecurityControl(newSecurityControl);
                                 setNewSecurityControl('');
                             }
                         }}
                         className="btn hover-lift" 
                         style={{ background: 'var(--accent-secondary)', color: '#000', padding: '0 20px', borderRadius: '8px', fontWeight: 'bold' }}
                     >
                         Add Control
                     </button>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                     {(!targetSecurityControls || targetSecurityControls.length === 0) && (
                         <div style={{ padding: '15px', color: 'var(--text-muted)', fontStyle: 'italic', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px dashed var(--glass-border)' }}>
                             No security controls have been created yet.
                         </div>
                     )}
                     {targetSecurityControls?.map(control => (
                         <div key={control} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '8px' }}>
                             <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                 <Shield size={18} color="var(--accent-secondary)" />
                                 <span style={{ fontWeight: 'bold' }}>{control}</span>
                             </div>
                             <button 
                                 onClick={() => handleDeleteMetadata('control', control)}
                                 style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '6px' }}
                                 title="Delete Control"
                             >
                                 <Trash2 size={16} />
                             </button>
                         </div>
                     ))}
                </div>
            </div>

        </div>
        )}
      </div>
      
      <div className="glass-panel" style={{ padding: '30px', maxWidth: '800px', marginTop: '30px', border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.05)' }}>
        <h2 
           onClick={() => togglePanel('data')} 
           style={{ borderBottom: '1px solid rgba(239, 68, 68, 0.2)', paddingBottom: '15px', marginBottom: expandedPanels.data ? '25px' : '0', display: 'flex', alignItems: 'center', gap: '10px', color: '#ef4444', cursor: 'pointer', justifyContent: 'space-between' }}
        >
           <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
               <Trash2 size={24} /> Danger Zone
           </div>
           <ChevronDown size={20} style={{ transform: expandedPanels.data ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }} />
        </h2>
        
        {expandedPanels.data && (
        <>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>This will permanently erase all data across the entire application, including saved reports, metrics, draft simulations, and attached evidence. (Your AI configurations and MITRE ATT&CK database cache will be preserved). This action cannot be undone.</p>
        
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
            <button 
               className="btn hover-lift" 
               onClick={() => confirmAction("Are you ABSOLUTELY sure you want to erase all application data? This cannot be undone.", () => {
                       const aiSettings = localStorage.getItem('ai_settings');
                       const mitreCache = localStorage.getItem('mitre_data_v2');
                       
                       localStorage.clear();
                       
                       if (aiSettings) localStorage.setItem('ai_settings', aiSettings);
                       if (mitreCache) localStorage.setItem('mitre_data_v2', mitreCache);
                       
                       window.location.href = '/';
               })} 
               style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid var(--danger)', color: '#ef4444', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}
            >
               <Trash2 size={18} /> Erase All Application Data
            </button>
            <button 
               className="btn hover-lift" 
               onClick={() => confirmAction("This will wipe your database and inject 10 automated simulations for data integrity testing. Proceed?", injectTestData)} 
               style={{ background: 'rgba(156, 39, 176, 0.2)', border: '1px solid var(--accent-primary)', color: '#c084fc', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}
            >
               <DatabaseIcon size={18} /> Run Data Integrity Assessment
            </button>
        </div>
        </>
        )}
      </div>
      
      <div style={{ maxWidth: '800px', marginTop: '30px', display: 'flex', alignItems: 'center', gap: '15px', paddingBottom: '30px' }}>
         <button 
            className={`btn hover-lift ${needsAiTest ? 'disabled' : ''}`} 
            disabled={needsAiTest}
            onClick={handleSave} 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', opacity: needsAiTest ? 0.5 : 1, cursor: needsAiTest ? 'not-allowed' : 'pointer' }}
         >
            <Save size={18} /> Save Settings
         </button>
         {needsAiTest && <span style={{ color: 'var(--warning)', fontSize: '0.9rem' }}>Please test your new AI connection before saving.</span>}
         {saveStatus && !needsAiTest && <span className="animate-fade-in" style={{ color: saveStatus.includes('failed') || saveStatus.includes('Error') ? 'var(--danger)' : 'var(--success)', fontWeight: 'bold' }}>{saveStatus}</span>}
      </div>

      {passwordModalOpen && (
          <div className="animate-fade-in" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(10,10,15,0.4)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div className="glass-panel responsive-modal" style={{ padding: '30px', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
                  <h3 style={{ marginTop: 0, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Key size={20} color="var(--accent-primary)" />
                      {passwordAction === 'export' ? 'Encrypt Backup' : 'Decrypt Backup'}
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
                      {passwordAction === 'export' ? 
                          "Enter a secure password to encrypt your workspace data. Do not lose this password!" : 
                          "Enter the password used to encrypt this backup file."}
                  </p>
                  <input 
                      type="password"
                      autoFocus
                      className="ai-input"
                      placeholder="Password"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '12px', background: 'rgba(0,0,0,0.4)', borderRadius: '8px', marginBottom: '20px' }}
                      value={backupPassword}
                      onChange={e => setBackupPassword(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') passwordAction === 'export' ? executeBackup() : executeImport(); }}
                  />
                  <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end' }}>
                      <button className="btn hover-lift" onClick={() => { setPasswordModalOpen(false); setBackupPassword(''); setPendingImportFile(null); }} style={{ background: 'transparent', border: '1px solid var(--text-muted)', color: 'var(--text-muted)' }}>
                          Cancel
                      </button>
                      <button className="btn hover-lift" onClick={passwordAction === 'export' ? executeBackup : executeImport} disabled={backupLoading || !backupPassword}>
                          {backupLoading ? 'Processing...' : (passwordAction === 'export' ? 'Encrypt & Download' : 'Decrypt & Verify')}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
