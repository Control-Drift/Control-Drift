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

import React, { useMemo } from 'react';
import { Sparkles, Terminal, Loader2, ChevronLeft, ChevronRight, Info, Target, Layers, PlusCircle } from 'lucide-react';
import BlackHoleIcon from '../../ui/BlackHoleIcon';
import RichMarkdownEditor from '../../ui/RichMarkdownEditor';
import { getHistoricalProceduresForTTPs } from '../../../lib/simulationAutomation';

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
    setSelectedTTPs,
    testResults = [],
    simulationSummaries = {},
    events = {},
    mitreData = {},
    addToast
}) {
    const historicalByTtp = useMemo(
        () => getHistoricalProceduresForTTPs(selectedTTPs, simulationSummaries, events, mitreData),
        [selectedTTPs, simulationSummaries, events, mitreData]
    );

    const hasHistoricalVariations = useMemo(
        () => historicalByTtp.some(item => item.procedures.length > 0),
        [historicalByTtp]
    );

    const handleAddSiblingSubTechnique = (sibling) => {
        if (!setSelectedTTPs) return;
        const alreadySelected = (selectedTTPs || []).some(t => t.id === sibling.id);
        if (alreadySelected) {
            addToast?.(`${sibling.id} is already in your Targeted TTPs.`, 'info');
            return;
        }
        setSelectedTTPs(prev => [...(prev || []), { id: sibling.id, name: sibling.name }]);
        addToast?.(`Added untested sibling sub-technique ${sibling.id} (${sibling.name}) to evolve family depth!`, 'success');
    };

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
                  <div style={{  display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', marginTop: '15px', gap: '10px'  }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <button className="btn hover-lift" onClick={downloadScript} disabled={isGenerating || !simulationPayload} style={{  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', padding: '10px 18px', fontSize: '0.85rem', fontWeight: 'bold', border: '1px solid var(--glass-border)', zIndex: 1  }}>
                             <Terminal size={16} /> Raw Script (.txt)
                          </button>
                          {!!isAiActive && (
                              <button
                                 className="btn-premium-ai hover-lift"
                                 onClick={generatePayloads}
                                 disabled={isGenerating || !isAiActive}
                                 title={hasHistoricalVariations ? "Generates a new procedural variation that avoids repeating previously validated commands" : "Generate validation design and scripts"}
                                 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 20px', fontSize: '0.9rem' }}
                              >
                                 {isGenerating ? <Loader2 size={16} style={{  animation: 'spin 1s linear infinite'  }} /> : <BlackHoleIcon size={16} className={isGenerating ? 'animate-pulse' : ''} />} {isGenerating ? 'Crafting Design...' : hasHistoricalVariations ? 'Generate Evolved Design' : 'Generate Design'}
                              </button>
                          )}
                      </div>
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
                          
                          <div style={{ marginBottom: '20px' }}>
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

                          {/* Procedural Evolution Memory: Previously Validated Variations & Untested Siblings */}
                          {historicalByTtp.some(item => item.procedures.length > 0 || item.untestedSiblings.length > 0) && (
                             <div style={{
                                 marginTop: '4px',
                                 padding: '14px',
                                 borderRadius: '10px',
                                 background: 'rgba(56, 189, 248, 0.06)',
                                 border: '1px solid rgba(56, 189, 248, 0.25)',
                                 display: 'flex',
                                 flexDirection: 'column',
                                 gap: '12px'
                             }}>
                                 <div>
                                     <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: '#38bdf8', fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                         <Layers size={15} /> Evolve Depth — Prior Variations
                                     </div>
                                     <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                         Avoid repeating the exact same one-liners. Design or generate a <strong>new procedural variation</strong> (different interpreter flags, LOLBin, or sibling sub-technique) to deepen validation coverage and extend this TTP&apos;s freshness lifespan.
                                     </p>
                                 </div>

                                 <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                     {historicalByTtp.filter(item => item.procedures.length > 0 || item.untestedSiblings.length > 0).map(item => (
                                         <div key={item.ttpId} style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                 <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8rem', color: '#fff' }}>
                                                     {item.ttpId} <span style={{ fontFamily: 'sans-serif', fontWeight: 500, color: 'var(--text-secondary)' }}>• {item.ttpName}</span>
                                                 </span>
                                                 <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: '10px', background: 'rgba(56, 189, 248, 0.14)', color: '#7dd3fc', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                                                     Depth: {item.procedures.length} {item.procedures.length === 1 ? 'Variation' : 'Variations'}
                                                 </span>
                                             </div>

                                             {item.procedures.slice(0, 3).map((proc, pIdx) => {
                                                 const snippet = (proc.payloadCode || proc.procedureSteps || '').trim();
                                                 const isPositive = proc.outcome === 'Prevented & Alerted' || proc.outcome === 'Prevented' || proc.outcome === 'Alerted';
                                                 return (
                                                     <div key={pIdx} style={{ padding: '7px 9px', borderRadius: '6px', background: 'rgba(255,255,255,0.03)', borderLeft: `2px solid ${isPositive ? '#10b981' : '#f59e0b'}`, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', fontSize: '0.74rem' }}>
                                                             <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                                                                 #{pIdx + 1} {proc.name}
                                                             </span>
                                                             <span style={{ fontSize: '0.66rem', fontWeight: 700, color: isPositive ? '#34d399' : '#fbbf24' }}>
                                                                 {proc.outcome}
                                                             </span>
                                                         </div>
                                                         {snippet && (
                                                             <div style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.4)', padding: '4px 6px', borderRadius: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={snippet}>
                                                                 {snippet}
                                                             </div>
                                                         )}
                                                     </div>
                                                 );
                                             })}

                                             {item.untestedSiblings.length > 0 && (
                                                 <div style={{ marginTop: '2px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                                     <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                                         Untested {item.parentId} Sibling Sub-Techniques:
                                                     </span>
                                                     <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                                                         {item.untestedSiblings.map(sib => (
                                                             <button
                                                                 key={sib.id}
                                                                 type="button"
                                                                 onClick={() => handleAddSiblingSubTechnique(sib)}
                                                                 title={`Add ${sib.id} (${sib.name}) to Targeted TTPs`}
                                                                 style={{
                                                                     display: 'inline-flex',
                                                                     alignItems: 'center',
                                                                     gap: '4px',
                                                                     fontSize: '0.68rem',
                                                                     padding: '3px 8px',
                                                                     borderRadius: '10px',
                                                                     background: 'rgba(168, 85, 247, 0.14)',
                                                                     border: '1px solid rgba(168, 85, 247, 0.35)',
                                                                     color: '#e9d5ff',
                                                                     cursor: 'pointer'
                                                                 }}
                                                             >
                                                                 <PlusCircle size={10} /> {sib.id}: {sib.name}
                                                             </button>
                                                         ))}
                                                     </div>
                                                 </div>
                                             )}
                                         </div>
                                     ))}
                                 </div>
                             </div>
                          )}
                      </>
                  )}
               </div>
            </div>
        </div>
    );
}
