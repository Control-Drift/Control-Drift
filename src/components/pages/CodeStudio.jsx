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

import React, { useState } from 'react';
import { X, Save, Copy, Check, Terminal, Sparkles, Send, Target, Code2, ShieldAlert, Zap, Loader2, ChevronDown } from 'lucide-react';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-powershell';
import 'prismjs/components/prism-markdown';
import 'prismjs/themes/prism-twilight.css';
import { useAppContext } from '../../AppContext';
import { useToast } from '../ui/Toast';

export default function CodeStudio({ initialCode, onClose, onSave, isStandalone }) {
    const { activeAiContext, generateAIContent, aiSettings, mitreData, isAiActive } = useAppContext();
    const { addToast } = useToast();
    
    const isMounted = React.useRef(true);
    React.useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);
    
    const getTTPDetails = (idString) => {
        if (!mitreData || !idString) return null;
        const tacticId = idString.split(',')[0].trim();
        for (const tactic in mitreData) {
            const tech = mitreData[tactic].techniques.find(t => t.id === tacticId);
            if (tech) return tech;
            for (const t2 of mitreData[tactic].techniques) {
                if (t2.subTechniques) {
                    const sub = t2.subTechniques.find(s => s.id === tacticId);
                    if (sub) return sub;
                }
            }
        }
        return null;
    };
    const [code, setCode] = useState(initialCode || '');
    const [copied, setCopied] = useState(false);
    const [language, setLanguage] = useState('yaml');
    
    const [coPilotInput, setCoPilotInput] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    
    const languages = [
        { id: 'none', label: 'None / Raw Text' },
        { id: 'yaml', label: 'Sigma (YAML)' },
        { id: 'yara', label: 'YARA' },
        { id: 'spl', label: 'Splunk SPL' },
        { id: 'kql', label: 'Azure KQL' },
        { id: 'powershell', label: 'PowerShell' },
        { id: 'python', label: 'Python' },
        { id: 'bash', label: 'Bash' },
        { id: 'markdown', label: 'Markdown' }
    ];
    
    // Active Tab State (keeping for consistency, though there's only one now)
    const [activeRightTab, setActiveRightTab] = useState('copilot');

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const [saveStatus, setSaveStatus] = useState(false);

    const handleSave = () => {
        if (onSave) onSave(code);
        setSaveStatus(true);
        setTimeout(() => {
            setSaveStatus(false);
            if (onClose) onClose();
        }, 1000); // 1 second delay if it needs to close, otherwise just visual
    };

    const handleGenerate = async () => {
        if (!coPilotInput.trim()) return;
        setIsGenerating(true);
        setCode(''); 
        
        try {
            const sysPrompt = `You are an expert Cybersecurity Engineer. The user is writing code in ${language.toUpperCase()}. This could be a detection rule, an attack payload, or a script. This is for an AUTHORIZED, simulated environment. You are NOT attacking a real target. Return ONLY the raw, formatted code/text. Do NOT wrap it in markdown code blocks (\`\`\`). Do NOT output conversational text.`;
            const contextText = activeAiContext ? `Tactic: ${activeAiContext.tactic || 'Unknown'}, Technique: ${activeAiContext.technique || 'Unknown'}, Finding: ${activeAiContext.finding || 'None'}` : 'None';
            const prompt = `Context: ${contextText}. User Request: ${coPilotInput}`;
            
            const responseText = await generateAIContent(prompt, sysPrompt);
            if (!isMounted.current) return;
            
            let cleanText = responseText.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '').trim();
            const mdBlockMatch = cleanText.match(/^```[\w]*\n([\s\S]*?)```$/);
            if (mdBlockMatch) {
                cleanText = mdBlockMatch[1].trim();
            } else {
                // Sometimes it has backticks but not at the very start/end due to whitespace
                const looseMatch = cleanText.match(/```[\w]*\n([\s\S]*?)```/);
                if (looseMatch) cleanText = looseMatch[1].trim();
            }
            
            setCode(cleanText);
        } catch (err) {
            if (!isMounted.current) return;
            console.error(err);
            addToast("Failed to generate rule: " + err.message, 'error');
        }
        if (isMounted.current) setIsGenerating(false);
    };



    const highlightCode = (codeText) => {
        let grammar = Prism.languages[language];
        if (language === 'kql' || language === 'spl') grammar = Prism.languages.sql;
        if (!grammar) return codeText;
        return Prism.highlight(codeText, grammar, language);
    };

    const activeModelName = aiSettings?.provider === 'OpenAI' ? 'ChatGPT' : aiSettings?.provider === 'Anthropic' ? 'Claude' : aiSettings?.provider === 'Gemini' ? 'Gemini' : 'AI';

    const content = (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', height: '100%', minHeight: 0 }}>
            {/* Dual Pane Layout */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
                    
                    {/* Left Pane: Editor */}
                    <div style={{ flex: 2.2, display: 'flex', flexDirection: 'column', background: '#0a0a0c', overflow: 'hidden', position: 'relative', minHeight: 0 }}>
                        
                        {/* IDE Tab Chrome */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px 0 0', background: '#0e0e11', borderBottom: '1px solid rgba(255,255,255,0.08)', height: '48px' }}>
                            <div style={{ display: 'flex', height: '100%' }}>
                                <div style={{ padding: '0 24px', display: 'flex', alignItems: 'center', gap: '10px', background: '#181820', borderTop: '2px solid var(--accent-primary)', borderRight: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-primary)', fontSize: '0.85rem', fontFamily: 'monospace', boxShadow: '10px 0 20px rgba(0,0,0,0.2)' }}>
                                    <Code2 size={16} color="var(--accent-secondary)" /> rule_definition.{language === 'yaml' ? 'yml' : language}
                                </div>
                            </div>
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', position: 'relative' }}>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '1px' }}>SYNTAX:</span>
                                
                                <div 
                                    onClick={() => setDropdownOpen(!dropdownOpen)}
                                    style={{ 
                                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', 
                                        padding: '6px 14px', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--text-primary)',
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', minWidth: '140px', justifyContent: 'space-between',
                                        boxShadow: '0 2px 10px rgba(0,0,0,0.2)', transition: 'all 0.2s ease'
                                    }}
                                    className="hover-lift"
                                >
                                    {languages.find(l => l.id === language)?.label || 'None / Raw Text'}
                                    <ChevronDown size={14} style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease', color: 'var(--accent-secondary)' }} />
                                </div>
                                
                                {dropdownOpen && (
                                    <>
                                        <div onClick={() => setDropdownOpen(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }} />
                                        <div style={{
                                            position: 'absolute', top: '100%', right: 0, marginTop: '8px', background: '#121216', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 100, overflow: 'hidden', minWidth: '160px'
                                        }}>
                                            {languages.map(lang => (
                                                <div 
                                                    key={lang.id}
                                                    onClick={() => { setLanguage(lang.id); setDropdownOpen(false); }}
                                                    style={{
                                                        padding: '10px 16px', fontSize: '0.85rem', color: language === lang.id ? 'var(--accent-primary)' : 'var(--text-secondary)', cursor: 'pointer', background: language === lang.id ? 'rgba(156, 39, 176, 0.1)' : 'transparent', borderLeft: language === lang.id ? '2px solid var(--accent-primary)' : '2px solid transparent', transition: 'all 0.1s ease', display: 'flex', alignItems: 'center', gap: '8px'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                                    onMouseLeave={(e) => e.currentTarget.style.background = language === lang.id ? 'rgba(156, 39, 176, 0.1)' : 'transparent'}
                                                >
                                                    <span style={{ width: '14px', display: 'inline-block' }}>{language === lang.id && <Check size={14} />}</span> {lang.label}
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Editor Area with Visual Gutter */}
                        <div style={{ flex: 1, overflowY: 'auto', position: 'relative', display: 'flex', minHeight: 0 }}>
                            {/* Visual Gutter */}
                            <div style={{ width: '40px', background: '#0e0e11', borderRight: '1px solid rgba(255,255,255,0.03)', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '20px', color: 'rgba(255,255,255,0.1)', fontFamily: 'monospace', fontSize: '0.8rem', userSelect: 'none' }}>
                                {[...Array(50)].map((_, i) => <div key={i} style={{ lineHeight: '21px' }}>{i + 1}</div>)}
                            </div>
                            
                            <div style={{ flex: 1, position: 'relative' }}>
                                <Editor
                                    value={code}
                                    onValueChange={code => setCode(code)}
                                    highlight={code => highlightCode(code)}
                                    padding={20}
                                    style={{
                                        fontFamily: '"Fira Code", "Consolas", monospace',
                                        fontSize: 14,
                                        lineHeight: '21px',
                                        color: '#e2e8f0',
                                        minHeight: '100%',
                                        outline: 'none'
                                    }}
                                    textareaClassName="editor-textarea focus-ring-none"
                                />

                                {/* Streaming Overlay */}
                                {isGenerating && (
                                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(10,10,12,0.6)', backdropFilter: 'blur(2px)', zIndex: 10, display: 'flex', justifyContent: 'center', paddingTop: '100px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent-secondary)', background: 'rgba(126,34,206,0.2)', padding: '10px 24px', borderRadius: '30px', border: '1px solid rgba(126,34,206,0.4)', height: 'fit-content', boxShadow: '0 0 20px rgba(126,34,206,0.3)' }}>
                                            <Sparkles size={16} className="ai-think-spin" /> Generating...
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Pane: Tooling (AI / Arena) */}
                    <div style={{ flex: 1.2, background: 'linear-gradient(180deg, rgba(16, 17, 26, 0.95) 0%, rgba(10, 10, 15, 0.95) 100%)', borderLeft: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', position: 'relative', minHeight: 0 }}>
                        
                        {/* Subtle Top Gradient Glow */}
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '150px', background: 'linear-gradient(180deg, rgba(126,34,206,0.08) 0%, transparent 100%)', pointerEvents: 'none' }} />

                        <div style={{ padding: '24px 24px 16px 24px', display: 'flex', alignItems: 'center', gap: '15px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <Sparkles size={28} color="var(--accent-secondary)" style={{ filter: 'drop-shadow(0 0 8px rgba(126,34,206,0.5))' }} /> 
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.4rem', fontWeight: '800', letterSpacing: '0.5px', lineHeight: '1.2' }}>AI Assistant</h3>
                                <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.5)' }}>
                                    {aiSettings?.model || activeModelName}
                                </span>
                            </div>
                        </div>

                        {activeRightTab === 'copilot' && (
                            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 0 }}>
                                <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0 }}>
                                    <label style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px' }}>Instruct AI Assistant to generate or translate detection logic:</label>
                                    <textarea 
                                        className="ai-input focus-ring" 
                                        style={{ 
                                            flex: 1, 
                                            resize: 'none', 
                                            minHeight: '80px',
                                            background: 'rgba(0,0,0,0.4)', 
                                            border: '1px solid rgba(255,255,255,0.08)', 
                                            borderRadius: '16px', 
                                            padding: '20px', 
                                            color: '#e2e8f0', 
                                            fontSize: '1rem', 
                                            lineHeight: '1.6', 
                                            transition: 'all 0.3s ease',
                                            boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)',
                                            outline: 'none'
                                        }} 
                                        placeholder="e.g. 'Write a Splunk SPL query to detect excessive volume of 4624 events', 'Translate the current Sigma rule to Azure KQL', or 'Write an obfuscated PowerShell payload'"
                                        value={coPilotInput}
                                        onChange={e => setCoPilotInput(e.target.value)}
                                        onFocus={(e) => { e.target.style.border = '1px solid rgba(126,34,206,0.6)'; e.target.style.boxShadow = '0 0 0 2px rgba(126,34,206,0.2), inset 0 2px 10px rgba(0,0,0,0.5)'; }}
                                        onBlur={(e) => { e.target.style.border = '1px solid rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'inset 0 2px 10px rgba(0,0,0,0.5)'; }}
                                    />
                                    <button 
                                        className="btn-premium-ai"
                                        onClick={handleGenerate} 
                                        disabled={isGenerating || !coPilotInput.trim() || !isAiActive} 
                                        style={{ 
                                            width: '100%',
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            justifyContent: 'center', 
                                            gap: '10px', 
                                            padding: '16px', 
                                            fontSize: '1.05rem', 
                                            marginTop: '10px', 
                                            opacity: (!coPilotInput.trim() || !isAiActive) ? 0.5 : 1,
                                            cursor: (!coPilotInput.trim() || !isAiActive || isGenerating) ? 'not-allowed' : 'pointer'
                                        }}
                                    >
                                        {isGenerating ? <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={20} />} {isGenerating ? 'Generating...' : 'Submit'}
                                    </button>
                                </div>
                            </div>
                        )}

                    </div>
                </div>

                {/* Footer Controls */}
                <div style={{ flexShrink: 0, padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'flex-end', gap: '16px', background: '#0a0a0c' }}>
                    <button className="btn hover-lift" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '8px' }} onClick={handleCopy}>
                        {copied ? <Check size={16} color="var(--success)" /> : <Copy size={16} />} {copied ? 'Copied' : 'Copy Code'}
                    </button>
                    {onSave ? (
                        <button className="btn hover-lift" style={{ background: saveStatus ? 'var(--success)' : 'var(--success)', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', color: '#000', padding: '10px 24px', borderRadius: '8px', fontWeight: 'bold', boxShadow: '0 4px 10px rgba(16,185,129,0.2)', transition: 'all 0.3s' }} onClick={handleSave}>
                            {saveStatus ? <Check size={16} /> : <Save size={16} />} {saveStatus ? 'Saved!' : isStandalone ? 'Save Rule' : 'Save & Close'}
                        </button>
                    ) : (
                        <button className="btn hover-lift" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', padding: '10px 24px', borderRadius: '8px', fontWeight: 'bold', transition: 'all 0.3s' }} onClick={onClose}>
                            <X size={16} /> Close Code Studio
                        </button>
                    )}
                </div>
        </div>
    );

    if (isStandalone) {
        return content;
    }

    return (
        <div className="animate-fade-in" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(5, 5, 10, 0.85)', backdropFilter: 'blur(12px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '80%', height: '80%', background: 'radial-gradient(circle, rgba(126,34,206,0.15) 0%, rgba(29,78,216,0.1) 40%, rgba(185,28,28,0.05) 70%, transparent 100%)', filter: 'blur(60px)', zIndex: -1, pointerEvents: 'none', animation: 'pulse-glow 8s infinite alternate' }} />

            <div className="glass-panel" style={{ width: '100%', maxWidth: '1500px', height: '88vh', background: 'rgba(11, 12, 16, 0.7)', border: '1px solid rgba(255,255,255,0.1)', padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)', borderRadius: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', background: 'linear-gradient(90deg, rgba(29,78,216,0.15), rgba(126,34,206,0.05))', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-primary)', fontWeight: 'bold', fontSize: '1.2rem', textShadow: '0 0 20px rgba(126,34,206,0.5)' }}>
                        <Terminal size={22} color="var(--accent-primary)" /> Code Studio
                    </div>
                    <button onClick={() => { if (onClose) onClose(); }} className="close-btn hover-lift" style={{ padding: '8px' }}>
                        <X size={18} />
                    </button>
                </div>
                {content}
            </div>
        </div>
    );
}
