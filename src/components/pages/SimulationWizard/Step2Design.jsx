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

import React, { useState, useMemo } from 'react';
import {
    Sparkles,
    Terminal,
    Loader2,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    ChevronUp,
    Info,
    Target,
    Layers,
    Zap,
    Wrench,
    Server,
    FileCode
} from 'lucide-react';
import BlackHoleIcon from '../../ui/BlackHoleIcon';
import RichMarkdownEditor from '../../ui/RichMarkdownEditor';
import MarkdownRenderer from '../../ui/MarkdownRenderer';
import OperationalTopologyMap from '../../features/OperationalTopologyMap';
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
    setSimulationDetails,
    selectedTTPs,
    setSelectedTTPs,
    testResults = [],
    simulationSummaries = {},
    events = {},
    mitreData = {},
    addToast
}) {
    const [expandedTtps, setExpandedTtps] = useState({});
    const [isBlueprintOpen, setIsBlueprintOpen] = useState(true);

    const blueprint = useMemo(() => {
        const raw = simulationDetails?.operationalBlueprint || {};
        return {
            tooling: Array.isArray(raw.tooling) ? raw.tooling : [],
            threatInfra: raw.threatInfra || '',
            targetAssets: raw.targetAssets || '',
            testAccounts: raw.testAccounts || '',
            stagingAndDeconfliction: raw.stagingAndDeconfliction || '',
            hostTtpAssignments: raw.hostTtpAssignments && typeof raw.hostTtpAssignments === 'object' ? raw.hostTtpAssignments : {}
        };
    }, [simulationDetails?.operationalBlueprint]);

    const updateBlueprint = (field, value) => {
        if (!setSimulationDetails) return;
        setSimulationDetails(prev => ({
            ...prev,
            operationalBlueprint: {
                ...(prev?.operationalBlueprint || {
                    tooling: [],
                    threatInfra: '',
                    targetAssets: '',
                    testAccounts: '',
                    stagingAndDeconfliction: '',
                    hostTtpAssignments: {}
                }),
                [field]: value
            }
        }));
    };

    const filledBlueprintCount = useMemo(() => {
        let count = 0;
        if (blueprint.tooling.length > 0) count++;
        if (blueprint.threatInfra.trim()) count++;
        if (blueprint.targetAssets.trim()) count++;
        if (blueprint.testAccounts.trim()) count++;
        if (blueprint.stagingAndDeconfliction.trim()) count++;
        return count;
    }, [blueprint]);

    const stampBlueprintIntoMarkdown = () => {
        if (filledBlueprintCount === 0) {
            addToast?.('Fill in at least one Operational Blueprint field before stamping into the design.', 'warning');
            return;
        }
        const lines = ['## Operational Infrastructure & Tooling'];
        if (blueprint.tooling.length > 0) {
            lines.push(`- **Offensive Tooling & Frameworks:** ${blueprint.tooling.join(', ')}`);
        }
        if (blueprint.threatInfra.trim()) {
            lines.push(`- **Simulated Threat Infrastructure (C2 / Source):** \`${blueprint.threatInfra.trim()}\``);
        }
        if (blueprint.targetAssets.trim()) {
            lines.push(`- **Target Host(s) & Endpoints:** \`${blueprint.targetAssets.trim()}\``);
        }
        if (blueprint.testAccounts.trim()) {
            lines.push(`- **Test Identity / Privilege Context:** \`${blueprint.testAccounts.trim()}\``);
        }
        if (blueprint.stagingAndDeconfliction.trim()) {
            lines.push(`- **Staging Paths & Deconfliction Guardrails:** \`${blueprint.stagingAndDeconfliction.trim()}\``);
        }
        const block = lines.join('\n');

        const existingRegex = /## Operational Infrastructure & Tooling[\s\S]*?(?=\n## |\n### |$)/i;
        if (existingRegex.test(simulationPayload || '')) {
            setSimulationPayload((simulationPayload || '').replace(existingRegex, block));
            addToast?.('Updated Operational Infrastructure & Tooling section in your design.', 'success');
        } else {
            const nextPayload = simulationPayload?.trim()
                ? `${block}\n\n${simulationPayload}`
                : `${block}\n\n## Simulation Overview\n`;
            setSimulationPayload(nextPayload);
            addToast?.('Stamped Operational Blueprint into the design editor.', 'success');
        }
    };

    const historicalByTtp = useMemo(
        () => getHistoricalProceduresForTTPs(selectedTTPs, simulationSummaries, events, mitreData),
        [selectedTTPs, simulationSummaries, events, mitreData]
    );

    const hasHistoricalVariations = useMemo(
        () => historicalByTtp.some(item => item.procedures.length > 0),
        [historicalByTtp]
    );

    const isTtpExpanded = (ttpId, idx) => {
        if (expandedTtps[ttpId] !== undefined) return expandedTtps[ttpId];
        return idx === 0;
    };

    const toggleTtp = (ttpId, idx) => {
        setExpandedTtps(prev => ({
            ...prev,
            [ttpId]: !isTtpExpanded(ttpId, idx)
        }));
    };

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <div style={{ display: 'flex', gap: '20px', flex: 1, overflow: 'hidden' }}>
               <div className="glass-panel" style={{ flex: 1.25, minWidth: 0, padding: '20px', display: 'flex', flexDirection: 'column', background: 'rgba(10,11,16,0.5)', overflow: 'hidden' }}>
                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                         {isGenerating ? (
                            <div style={{ width: '100%', height: '100%', boxSizing: 'border-box', padding: '20px', background: 'rgba(0,0,0,0.4)', borderRadius: '8px', border: '1px solid var(--accent-primary)', overflowY: 'auto', color: 'var(--text-primary)', position: 'relative' }}>
                               <div style={{ position: 'sticky', top: 0, float: 'right', zIndex: 5, display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--accent-primary)', fontSize: '0.8rem', background: 'rgba(10, 11, 16, 0.92)', padding: '4px 10px', borderRadius: '4px', border: '1px solid rgba(156,39,176,0.4)', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                                   <BlackHoleIcon size={14} className="ai-think-spin" /> Generating...
                               </div>
                               <MarkdownRenderer content={simulationPayload} />
                               <span className="animate-pulse" style={{ display: 'inline-block', width: '8px', height: '15px', background: 'var(--accent-primary)', marginLeft: '4px', verticalAlign: 'middle' }}></span>
                            </div>
                         ) : (
                            <RichMarkdownEditor 
                               minHeight="100%"
                               value={simulationPayload}
                               onChange={val => setSimulationPayload(val)}
                               placeholder="Draft your simulation design and validation procedures here, or configure the Operational Blueprint on the right and click Generate Design..."
                            />
                         )}
                  </div>
                  {!!isAiActive && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '15px' }}>
                          <button
                             className="btn-premium-ai hover-lift"
                             onClick={generatePayloads}
                             disabled={isGenerating || !isAiActive}
                             title={hasHistoricalVariations ? "Generates a new procedural variation incorporating your Operational Blueprint and avoiding prior signatures" : "Generate validation design and scripts using your Operational Blueprint"}
                             style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 20px', fontSize: '0.9rem' }}
                          >
                             {isGenerating ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <BlackHoleIcon size={16} className={isGenerating ? 'animate-pulse' : ''} />} {isGenerating ? 'Crafting Design...' : hasHistoricalVariations ? 'Generate Evolved Design' : 'Generate Design'}
                          </button>
                      </div>
                  )}
               </div>

               {/* Right Column: Operational Blueprint & Context */}
               <div className="glass-panel" style={{ flex: isContextCollapsed ? '0 0 50px' : 1, padding: isContextCollapsed ? '0' : '24px', display: 'flex', flexDirection: 'column', background: isContextCollapsed ? 'linear-gradient(180deg, rgba(31,40,51,0.6) 0%, rgba(156,39,176,0.15) 100%)' : 'rgba(10,11,16,0.3)', overflowY: isContextCollapsed ? 'hidden' : 'auto', transition: 'all 0.3s ease', minWidth: isContextCollapsed ? '50px' : '460px', alignItems: isContextCollapsed ? 'center' : 'stretch', borderLeft: isContextCollapsed ? '1px solid rgba(156,39,176,0.3)' : '1px solid var(--glass-border)' }}>
                  {isContextCollapsed ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', position: 'relative', padding: '15px 0' }}>
                          <button onClick={() => setIsContextCollapsed(false)} style={{ background: 'rgba(156,39,176,0.2)', border: '1px solid var(--accent-primary)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', boxShadow: '0 0 10px rgba(156,39,176,0.4)', zIndex: 2 }} title="Expand Operational Blueprint & Context">
                              <ChevronLeft size={16} style={{ transform: 'translateX(-1px)' }} />
                          </button>
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', writingMode: 'vertical-rl', transform: 'rotate(180deg)', paddingBottom: '20px' }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: 'bold', letterSpacing: '4px', color: 'var(--accent-primary)', textTransform: 'uppercase', textShadow: '0 0 10px rgba(156,39,176,0.5)', whiteSpace: 'nowrap' }}>
                                  Blueprint & Context
                              </span>
                          </div>
                      </div>
                  ) : (
                      <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
                              <h3 style={{ margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
                                  <Wrench size={18} color="var(--accent-primary)" /> Blueprint & Context
                              </h3>
                              <button onClick={() => setIsContextCollapsed(true)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px', borderRadius: '4px' }} onMouseEnter={e => {e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}} onMouseLeave={e => {e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'}} title="Collapse Panel">
                                  <ChevronRight size={18} />
                              </button>
                          </div>

                          {/* Operational Blueprint Section */}
                          <div style={{
                              marginBottom: '20px',
                              borderRadius: '12px',
                              background: 'linear-gradient(180deg, rgba(168, 85, 247, 0.08) 0%, rgba(15, 23, 42, 0.65) 100%)',
                              border: '1px solid rgba(168, 85, 247, 0.28)',
                              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
                              overflow: 'hidden'
                          }}>
                              {/* Blueprint Header */}
                              <div
                                  onClick={() => setIsBlueprintOpen(prev => !prev)}
                                  style={{
                                      padding: '12px 16px',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      cursor: 'pointer',
                                      borderBottom: isBlueprintOpen ? '1px solid rgba(168, 85, 247, 0.2)' : 'none',
                                      background: 'rgba(168, 85, 247, 0.1)',
                                      userSelect: 'none'
                                  }}
                              >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <Server size={15} color="#c084fc" />
                                      <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f3e8ff', letterSpacing: '0.2px' }}>
                                          Operational Blueprint
                                      </span>
                                      <span
                                          onClick={e => e.stopPropagation()}
                                          title="Specify offensive tooling, C2 infrastructure, target hosts, and deconfliction paths. AI Design weaves these directly into generated commands, and Step 3 & 4 surface them for Blue Team hunting and reporting."
                                          style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)', cursor: 'help' }}
                                      >
                                          <Info size={13} />
                                      </span>
                                      {filledBlueprintCount > 0 && (
                                          <span style={{
                                              fontSize: '0.68rem',
                                              fontWeight: 700,
                                              padding: '2px 8px',
                                              borderRadius: '999px',
                                              background: 'rgba(16, 185, 129, 0.18)',
                                              border: '1px solid rgba(16, 185, 129, 0.4)',
                                              color: '#6ee7b7'
                                          }}>
                                              {filledBlueprintCount} set
                                          </span>
                                      )}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                      <button
                                          type="button"
                                          onClick={(e) => {
                                              e.stopPropagation();
                                              stampBlueprintIntoMarkdown();
                                          }}
                                          title="Insert or update an Operational Infrastructure & Tooling markdown block at the top of the Design editor"
                                          style={{
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '5px',
                                              padding: '4px 10px',
                                              borderRadius: '6px',
                                              fontSize: '0.72rem',
                                              fontWeight: 700,
                                              background: 'rgba(168, 85, 247, 0.2)',
                                              border: '1px solid rgba(168, 85, 247, 0.45)',
                                              color: '#e9d5ff',
                                              cursor: 'pointer'
                                          }}
                                      >
                                          <FileCode size={12} /> Stamp to Editor
                                      </button>
                                      {isBlueprintOpen ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
                                  </div>
                              </div>

                              {isBlueprintOpen && (
                                  <div style={{ padding: '8px' }}>
                                      {/* Fully Interactive C2, Tooling & Target Topology Map */}
                                      <OperationalTopologyMap
                                          blueprint={blueprint}
                                          updateBlueprint={updateBlueprint}
                                          environmentLabels={simulationDetails.environmentCategory || []}
                                          selectedTTPs={selectedTTPs}
                                          selectedTTPsCount={(selectedTTPs || []).length}
                                      />
                                  </div>
                              )}
                          </div>
                          
                          <div style={{ marginBottom: '16px' }}>
                             <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Environment</label>
                             <div style={{ color: 'var(--text-primary)', fontWeight: 'bold', fontSize: '0.9rem' }}>{simulationDetails.environmentCategory?.join(', ') || 'Not Specified'}</div>
                          </div>
                          
                          <div style={{ marginBottom: '16px' }}>
                             <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Scenario</label>
                             <div style={{ color: 'var(--text-primary)', fontSize: '0.85rem', lineHeight: '1.45' }}>{simulationDetails.goals || 'Not Specified'}</div>
                          </div>
                          
                          <div style={{ marginBottom: '20px' }}>
                             <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Targeted TTPs ({selectedTTPs.length})</label>
                             <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {selectedTTPs.map(ttp => (
                                   <span key={ttp.id} title={ttp.name} style={{ background: 'rgba(156, 39, 176, 0.15)', border: '1px solid rgba(156, 39, 176, 0.3)', color: 'var(--text-primary)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <Target size={12} color="var(--accent-primary)" /> {ttp.id} - {ttp.name}
                                   </span>
                                ))}
                                {selectedTTPs.length === 0 && (
                                   <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>No TTPs Selected</span>
                                )}
                             </div>
                          </div>

                          {/* Prior Procedure History: Only shown when historical variations exist */}
                           {hasHistoricalVariations && (
                              <div style={{
                                  marginTop: '4px',
                                  padding: '12px',
                                  borderRadius: '10px',
                                  background: 'rgba(56, 189, 248, 0.04)',
                                  border: '1px solid rgba(56, 189, 248, 0.2)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '10px'
                              }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.3px' }}>
                                          <Layers size={14} /> Prior Procedure History
                                      </div>
                                      <span 
                                          title="Review previously tested commands, flags, and outcomes for these TTPs to design a new procedural variation and avoid repeating identical signatures."
                                          style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', cursor: 'help' }}
                                      >
                                          <Info size={13} />
                                      </span>
                                  </div>

                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                      {historicalByTtp.filter(item => item.procedures.length > 0).map((item, idx) => {
                                          const isExpanded = isTtpExpanded(item.ttpId, idx);

                                          return (
                                              <div 
                                                  key={item.ttpId} 
                                                  style={{ 
                                                      background: 'rgba(0,0,0,0.3)', 
                                                      border: '1px solid rgba(255,255,255,0.07)', 
                                                      borderRadius: '8px', 
                                                      padding: '8px 10px', 
                                                      display: 'flex', 
                                                      flexDirection: 'column', 
                                                      gap: '8px',
                                                      transition: 'all 0.2s ease'
                                                  }}
                                              >
                                                  {/* Interactive Accordion Header */}
                                                  <div 
                                                      onClick={() => toggleTtp(item.ttpId, idx)}
                                                      style={{ 
                                                          display: 'flex', 
                                                          justifyContent: 'space-between', 
                                                          alignItems: 'center', 
                                                          cursor: 'pointer',
                                                          userSelect: 'none',
                                                          gap: '6px'
                                                      }}
                                                  >
                                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                                                          {isExpanded ? (
                                                              <ChevronDown size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                                                          ) : (
                                                              <ChevronRight size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                                                          )}
                                                          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.78rem', color: '#fff', flexShrink: 0 }}>
                                                              {item.ttpId}
                                                          </span>
                                                          <span 
                                                              style={{ 
                                                                  fontSize: '0.76rem', 
                                                                  color: 'var(--text-secondary)', 
                                                                  overflow: 'hidden', 
                                                                  textOverflow: 'ellipsis', 
                                                                  whiteSpace: 'nowrap' 
                                                              }} 
                                                              title={item.ttpName}
                                                          >
                                                              • {item.ttpName}
                                                          </span>
                                                      </div>

                                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                                          <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: '10px', background: 'rgba(56, 189, 248, 0.14)', color: '#7dd3fc', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                                                              {item.procedures.length} {item.procedures.length === 1 ? 'Variation' : 'Variations'}
                                                          </span>
                                                      </div>
                                                  </div>

                                                  {/* Expandable Content: Past Executed Procedures */}
                                                  {isExpanded && (
                                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '4px' }}>
                                                          {item.procedures.slice(0, 3).map((proc, pIdx) => {
                                                              const snippet = (proc.payloadCode || proc.procedureSteps || '').trim();
                                                              const isPositive = proc.outcome === 'Prevented & Alerted' || proc.outcome === 'Prevented' || proc.outcome === 'Alerted';
                                                              return (
                                                                  <div key={pIdx} style={{ padding: '6px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.03)', borderLeft: `2px solid ${isPositive ? '#10b981' : '#f59e0b'}`, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', fontSize: '0.72rem' }}>
                                                                          <span style={{ color: 'var(--text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                              #{pIdx + 1} {proc.name}
                                                                          </span>
                                                                          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: isPositive ? '#34d399' : '#fbbf24', flexShrink: 0 }}>
                                                                              {proc.outcome}
                                                                          </span>
                                                                      </div>
                                                                      {snippet && (
                                                                          <div style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.4)', padding: '3px 6px', borderRadius: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={snippet}>
                                                                              {snippet}
                                                                          </div>
                                                                      )}
                                                                  </div>
                                                              );
                                                          })}
                                                      </div>
                                                  )}
                                              </div>
                                          );
                                      })}
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
