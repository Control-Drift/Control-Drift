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

import React from 'react';
import { Sparkles, Terminal, Loader2, ChevronLeft, ChevronRight, Info, Target } from 'lucide-react';
import BlackHoleIcon from '../../ui/BlackHoleIcon';
import RichMarkdownEditor from '../../ui/RichMarkdownEditor';

export default function Step2Design({
    isGenerating,
    simulationPayload,
    setSimulationPayload,
    isAiActive,
    generatePayloads,
    isContextCollapsed,
    setIsContextCollapsed,
    simulationDetails,
    selectedTTPs,
    addToast
}) {
    const downloadScript = () => {
        if (!simulationPayload) {
            addToast("No payload generated yet.", 'warning');
            return;
        }
        const codeBlockRegex = /```[^\n]*\n([\s\S]*?)```/gi;
        let scripts = [];
        let match;
        while ((match = codeBlockRegex.exec(simulationPayload)) !== null) {
            scripts.push(match[1].trim());
        }
        if (scripts.length === 0) {
            addToast("No executable script blocks (bash, powershell) were found in the generated attack chain.", 'warning');
            return;
        }
        
        const content = scripts.join('\n\n# --- Next Phase ---\n\n');
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${simulationDetails.name ? simulationDetails.name.replace(/\s+/g, '_') : 'simulation'}_script.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="animate-fade-in" style={{  display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden'  }}>
            <div style={{ display: 'flex', gap: '20px', flex: 1, overflow: 'hidden' }}>
               <div className="glass-panel" style={{  flex: 2, padding: '20px', display: 'flex', flexDirection: 'column', background: 'rgba(10,11,16,0.5)', overflow: 'hidden'  }}>
                  <div style={{  flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', minHeight: 0  }}>
                         {isGenerating ? (
                            <div style={{  width: '100%', height: '100%', boxSizing: 'border-box', padding: '20px', background: 'rgba(0,0,0,0.4)', borderRadius: '8px', border: '1px solid var(--accent-primary)', overflowY: 'auto', fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: 'var(--text-primary)', fontSize: '0.9rem', lineHeight: '1.5', position: 'relative'  }}>
                               <div style={{  position: 'absolute', top: '10px', right: '10px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-primary)', fontSize: '0.8rem', background: 'rgba(156,39,176,0.1)', padding: '4px 10px', borderRadius: '4px', border: '1px solid rgba(156,39,176,0.3)'  }}>
                                   <BlackHoleIcon size={14} className="ai-think-spin" /> Generating...
                               </div>
                               {simulationPayload}
                               <span className="animate-pulse" style={{  display: 'inline-block', width: '8px', height: '15px', background: 'var(--accent-primary)', marginLeft: '4px', verticalAlign: 'middle'  }}></span>
                            </div>
                         ) : (
                            <RichMarkdownEditor 
                               minHeight="100%"
                               value={simulationPayload}
                               onChange={val => setSimulationPayload(val)}
                               placeholder="Draft your design here..."
                            />
                         )}
                  </div>
                  <div style={{  display: 'flex', justifyContent: 'flex-end', marginTop: '15px', gap: '15px'  }}>
                      <button className="btn hover-lift" onClick={downloadScript} disabled={isGenerating || !simulationPayload} style={{  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', padding: '10px 20px', fontSize: '0.9rem', fontWeight: 'bold', border: '1px solid var(--glass-border)', zIndex: 1  }}>
                         <Terminal size={16} /> Download Current Script
                      </button>
                      {!!isAiActive && (
                          <button className="btn-premium-ai hover-lift" onClick={generatePayloads} disabled={isGenerating || !isAiActive} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 20px', fontSize: '0.9rem' }}>
                             {isGenerating ? <Loader2 size={16} style={{  animation: 'spin 1s linear infinite'  }} /> : <BlackHoleIcon size={16} className={isGenerating ? 'animate-pulse' : ''} />} {isGenerating ? 'Crafting Design...' : 'Generate Design'}
                          </button>
                      )}
                  </div>
               </div>

               {/* Right Column: Reference Context */}
               <div className="glass-panel" style={{  flex: isContextCollapsed ? '0 0 50px' : 1, padding: isContextCollapsed ? '0' : '25px', display: 'flex', flexDirection: 'column', background: isContextCollapsed ? 'linear-gradient(180deg, rgba(31,40,51,0.6) 0%, rgba(156,39,176,0.15) 100%)' : 'rgba(10,11,16,0.3)', overflowY: isContextCollapsed ? 'hidden' : 'auto', transition: 'all 0.3s ease', minWidth: isContextCollapsed ? '50px' : '350px', alignItems: isContextCollapsed ? 'center' : 'stretch', borderLeft: isContextCollapsed ? '1px solid rgba(156,39,176,0.3)' : '1px solid var(--glass-border)'  }}>
                  {isContextCollapsed ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', position: 'relative', padding: '15px 0' }}>
                          <button onClick={() => setIsContextCollapsed(false)} style={{ background: 'rgba(156,39,176,0.2)', border: '1px solid var(--accent-primary)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', boxShadow: '0 0 10px rgba(156,39,176,0.4)', zIndex: 2 }} title="Expand Context">
                              <ChevronLeft size={16} style={{ transform: 'translateX(-1px)' }} />
                          </button>
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', writingMode: 'vertical-rl', transform: 'rotate(180deg)', paddingBottom: '20px' }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: 'bold', letterSpacing: '4px', color: 'var(--accent-primary)', textTransform: 'uppercase', textShadow: '0 0 10px rgba(156,39,176,0.5)', whiteSpace: 'nowrap' }}>
                                  Simulation Context
                              </span>
                          </div>
                      </div>
                  ) : (
                      <>
                          <div style={{  display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px'  }}>
                              <h3 style={{  margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem'  }}>
                                  <Info size={18} color="var(--accent-primary)" /> Simulation Context
                              </h3>
                              <button onClick={() => setIsContextCollapsed(true)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px', borderRadius: '4px' }} onMouseEnter={e => {e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}} onMouseLeave={e => {e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'}} title="Collapse Context">
                                  <ChevronRight size={18} />
                              </button>
                          </div>
                          
                          <div style={{  marginBottom: '20px'  }}>
                             <label style={{  display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '5px'  }}>Environment</label>
                             <div style={{  color: 'var(--text-primary)', fontWeight: 'bold'  }}>{simulationDetails.environmentCategory?.join(', ') || 'Not Specified'}</div>
                          </div>
                          
                          <div style={{  marginBottom: '20px'  }}>
                             <label style={{  display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '5px'  }}>Scenario</label>
                             <div style={{  color: 'var(--text-primary)', fontSize: '0.9rem', lineHeight: '1.4'  }}>{simulationDetails.goals || 'Not Specified'}</div>
                          </div>
                          
                          <div>
                             <label style={{  display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '10px'  }}>Targeted TTPs ({selectedTTPs.length})</label>
                             <div style={{  display: 'flex', flexWrap: 'wrap', gap: '8px'  }}>
                                {selectedTTPs.map(ttp => (
                                   <span key={ttp.id} title={ttp.name} style={{  background: 'rgba(156, 39, 176, 0.15)', border: '1px solid rgba(156, 39, 176, 0.3)', color: 'var(--text-primary)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px'  }}>
                                      <Target size={12} color="var(--accent-primary)" /> {ttp.id} - {ttp.name}
                                   </span>
                                ))}
                                {selectedTTPs.length === 0 && (
                                   <span style={{  color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic'  }}>No TTPs Selected</span>
                                )}
                             </div>
                          </div>
                      </>
                  )}
               </div>
            </div>
        </div>
    );
}
