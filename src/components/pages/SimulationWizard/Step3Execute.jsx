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
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, FileText, Wrench, Terminal } from 'lucide-react';
import BattleGlobe from '../../features/BattleGlobe';
import OperationalTopologyMap from '../../features/OperationalTopologyMap';
import EventCard from '../../ui/EventCard';
import MarkdownRenderer from '../../ui/MarkdownRenderer';
import CopyButton from '../../ui/CopyButton';

export default function Step3Execute({
    getAdversaryControlRatio,
    simulationPayload,
    addProcedure,
    testResults,
    collapsedCards,
    setCollapsedCards,
    updateProcedure,
    removeProcedure,
    showNameErrors,
    setShowNameErrors,
    selectedTTPs,
    autoMapProcedureTTPs,
    mappingProcedureId,
    aiSettings,
    isAssessing,
    autoAssessSeverity,
    compressImage,
    addSimulationEvidence,
    simulationDetails,
    setExpandedImage
}) {
    const blueprint = simulationDetails?.operationalBlueprint || {};
    const hasBlueprint =
        (Array.isArray(blueprint.tooling) && blueprint.tooling.length > 0) ||
        Boolean(blueprint.threatInfra?.trim()) ||
        Boolean(blueprint.targetAssets?.trim()) ||
        Boolean(blueprint.testAccounts?.trim()) ||
        Boolean(blueprint.stagingAndDeconfliction?.trim());
    const showTopologyCard = hasBlueprint || (selectedTTPs && selectedTTPs.length > 0) || (testResults && testResults.length > 0);

    const [isGlobeCollapsed, setIsGlobeCollapsed] = useState(false);
    const [isDesignCollapsed, setIsDesignCollapsed] = useState(() => !simulationPayload?.trim() && !hasBlueprint);
    const [isBlueprintCollapsed, setIsBlueprintCollapsed] = useState(false);

    const extractedScripts = useMemo(() => {
        if (!simulationPayload) return '';
        const codeBlockRegex = /```[^\n]*\n([\s\S]*?)```/gi;
        const scripts = [];
        let match;
        while ((match = codeBlockRegex.exec(simulationPayload)) !== null) {
            if (match[1]?.trim()) scripts.push(match[1].trim());
        }
        return scripts.join('\n\n# --- Next Phase ---\n\n');
    }, [simulationPayload]);

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'hidden', paddingRight: '10px', minHeight: 0 }}>

            {/* Horizontal Dashboard Widget */}
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', marginBottom: '15px', background: 'linear-gradient(180deg, rgba(5,7,10,0.8) 0%, rgba(10,12,18,0.9) 100%)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', borderTop: '1px solid rgba(255,255,255,0.1)', flexShrink: 0, transition: 'all 0.3s ease', minHeight: isGlobeCollapsed ? '46px' : '0' }}>
                
                {/* Floating pill toggle */}
                <button 
                    type="button" 
                    onClick={() => setIsGlobeCollapsed(prev => !prev)} 
                    className="btn hover-lift" 
                    style={{ position: 'absolute', top: '10px', left: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', padding: '4px 10px', borderRadius: '20px', zIndex: 10, cursor: 'pointer' }}
                >
                    {isGlobeCollapsed ? <><ChevronDown size={14} /> Show Battle Globe</> : <><ChevronUp size={14} /> Hide Battle Globe</>}
                </button>

                {/* Collapsible area */}
                <div style={{ 
                    display: 'grid', 
                    gridTemplateRows: isGlobeCollapsed ? '0fr' : '1fr', 
                    transition: 'grid-template-rows 0.6s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1), padding 0.6s cubic-bezier(0.4, 0, 0.2, 1)', 
                    opacity: isGlobeCollapsed ? 0 : 1, 
                    padding: isGlobeCollapsed ? '0px 20px' : '5px 20px 0px 20px' 
                }}>
                    <div style={{ overflow: 'hidden' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px 0 15px 0' }}>
                            <BattleGlobe ratio={getAdversaryControlRatio()} />
                        </div>
                    </div>
                </div>
            </div>
            
             <div className="responsive-row" style={{ flex: 1, minHeight: 0 }}>
               {/* Left Column: Collapsible Design Reference */}
               <div
                  className={isDesignCollapsed ? 'glass-panel' : ''}
                  style={{
                      flex: isDesignCollapsed ? '0 0 50px' : 1,
                      minWidth: isDesignCollapsed ? '50px' : 0,
                      minHeight: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      padding: 0,
                      background: isDesignCollapsed
                          ? 'linear-gradient(180deg, rgba(31,40,51,0.6) 0%, rgba(156,39,176,0.15) 100%)'
                          : 'transparent',
                      border: isDesignCollapsed
                          ? '1px solid rgba(156,39,176,0.3)'
                          : 'none',
                      overflow: 'hidden',
                      transition: 'all 0.3s ease'
                  }}
               >
                  {isDesignCollapsed ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', position: 'relative', padding: '15px 0' }}>
                          <button
                              type="button"
                              onClick={() => setIsDesignCollapsed(false)}
                              style={{
                                  background: 'rgba(156,39,176,0.2)',
                                  border: '1px solid var(--accent-primary)',
                                  color: 'var(--text-primary)',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '50%',
                                  boxShadow: '0 0 10px rgba(156,39,176,0.4)',
                                  zIndex: 2
                              }}
                              title="Expand Design Reference"
                          >
                              <ChevronRight size={16} style={{ transform: 'translateX(1px)' }} />
                          </button>
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', writingMode: 'vertical-rl', transform: 'rotate(180deg)', paddingBottom: '20px' }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: 'bold', letterSpacing: '4px', color: 'var(--accent-primary)', textTransform: 'uppercase', textShadow: '0 0 10px rgba(156,39,176,0.5)', whiteSpace: 'nowrap' }}>
                                  Design Reference
                              </span>
                          </div>
                      </div>
                  ) : (
                      <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', marginTop: '10px', minHeight: '32px', paddingRight: '10px' }}>
                              <h3 style={{ margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <FileText size={18} color="var(--accent-primary)" /> Design Reference
                              </h3>
                              <button
                                  type="button"
                                  onClick={() => setIsDesignCollapsed(true)}
                                  style={{
                                      background: 'rgba(255,255,255,0.04)',
                                      border: '1px solid var(--glass-border)',
                                      color: 'var(--text-muted)',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      padding: '4px 10px',
                                      borderRadius: '6px',
                                      fontSize: '0.75rem',
                                      fontWeight: 600,
                                      transition: 'all 0.2s'
                                  }}
                                  onMouseEnter={e => {
                                      e.currentTarget.style.color = 'var(--text-primary)';
                                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                  }}
                                  onMouseLeave={e => {
                                      e.currentTarget.style.color = 'var(--text-muted)';
                                      e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                                  }}
                                  title="Collapse Design Reference"
                              >
                                  <ChevronLeft size={15} /> Collapse
                              </button>
                          </div>
                          <div style={{ flex: 1, height: 0, overflowY: 'auto', paddingRight: '10px', fontSize: '0.9rem', paddingTop: '15px', marginTop: '-15px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                              {showTopologyCard && (
                                  <div style={{
                                      flexShrink: 0,
                                      borderRadius: '10px',
                                      background: 'linear-gradient(180deg, rgba(168, 85, 247, 0.08) 0%, rgba(15, 23, 42, 0.55) 100%)',
                                      border: '1px solid rgba(168, 85, 247, 0.28)',
                                      display: 'flex',
                                      flexDirection: 'column'
                                  }}>
                                      <div
                                          onClick={() => setIsBlueprintCollapsed(prev => !prev)}
                                          style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'space-between',
                                              padding: '11px 16px',
                                              borderTopLeftRadius: '10px',
                                              borderTopRightRadius: '10px',
                                              borderBottomLeftRadius: isBlueprintCollapsed ? '10px' : 0,
                                              borderBottomRightRadius: isBlueprintCollapsed ? '10px' : 0,
                                              borderBottom: isBlueprintCollapsed ? 'none' : '1px solid rgba(168, 85, 247, 0.2)',
                                              background: 'rgba(168, 85, 247, 0.1)',
                                              cursor: 'pointer',
                                              userSelect: 'none'
                                          }}
                                      >
                                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 700, color: '#e9d5ff', letterSpacing: '0.3px' }}>
                                              <Wrench size={14} color="#c084fc" /> Blueprint
                                          </span>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                              {isBlueprintCollapsed ? <ChevronDown size={16} color="var(--text-muted)" /> : <ChevronUp size={16} color="var(--text-muted)" />}
                                          </div>
                                      </div>

                                      {!isBlueprintCollapsed && (
                                          <div style={{ padding: '10px' }}>
                                              <OperationalTopologyMap
                                                  blueprint={blueprint}
                                                  environmentLabels={simulationDetails?.environmentCategory || []}
                                                  selectedTTPs={selectedTTPs}
                                                  selectedTTPsCount={(selectedTTPs || []).length}
                                                  simulationPayload={simulationPayload}
                                                  testResults={testResults}
                                                  compact={true}
                                              />
                                          </div>
                                      )}
                                  </div>
                              )}
                              {simulationPayload ? (
                                  <div className="glass-panel" style={{ flexShrink: 0, padding: '16px 20px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px', gap: '10px', flexWrap: 'wrap' }}>
                                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                              <Terminal size={13} color="#10b981" /> Simulation Payload &amp; Procedures
                                          </span>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                              {extractedScripts && (
                                                  <CopyButton
                                                      text={extractedScripts}
                                                      label="COPY ALL SCRIPTS"
                                                      copiedLabel="SCRIPTS COPIED"
                                                  />
                                              )}
                                              <CopyButton
                                                  text={simulationPayload}
                                                  label={extractedScripts ? 'COPY FULL PLAN' : 'COPY PAYLOAD'}
                                                  copiedLabel="COPIED"
                                                  style={extractedScripts ? {
                                                      border: '1px solid rgba(255,255,255,0.18)',
                                                      color: 'var(--text-secondary)'
                                                  } : {}}
                                              />
                                          </div>
                                      </div>
                                      <MarkdownRenderer content={simulationPayload} />
                                  </div>
                              ) : !hasBlueprint ? (
                                  <div style={{ padding: '20px', textAlign: 'center', background: 'rgba(0,0,0,0.2)', border: '1px dashed var(--glass-border)', color: 'var(--text-muted)', borderRadius: '8px', fontSize: '0.9rem' }}>
                                      No design was created in Step 2.
                                  </div>
                              ) : null}
                          </div>
                      </>
                  )}
               </div>

               <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', marginTop: '10px', minHeight: '32px', paddingRight: '16px' }}>
                    <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Simulation Events</h3>
                    <button type="button" className="btn hover-lift" onClick={() => addProcedure(null)} style={{ fontSize: '0.85rem', padding: '6px 12px', background: 'rgba(156, 39, 176, 0.2)', color: 'var(--accent-primary)', border: '1px solid var(--accent-primary)', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(156, 39, 176, 0.3)' }}>+ Add Event</button>
                 </div>
                 <div style={{ flex: 1, height: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', paddingRight: '10px', paddingTop: '15px', marginTop: '-15px' }}>
                 
                 {testResults.length === 0 ? (
                     <div style={{ padding: '20px', textAlign: 'center', background: 'rgba(0,0,0,0.2)', border: '1px dashed var(--glass-border)', color: 'var(--text-muted)', borderRadius: '8px', fontSize: '0.9rem' }}>
                         No events added yet, click + to add event.
                     </div>
                 ) : (
                     testResults.map((proc, index) => {
                       return (
                           <EventCard 
                               key={proc.id}
                               proc={proc}
                               index={index}
                               totalCards={testResults.length}
                               isCollapsed={collapsedCards[proc.id]}
                               onToggleCollapse={() => setCollapsedCards(prev => ({ ...prev, [proc.id]: !prev[proc.id] }))}
                               updateProcedure={updateProcedure}
                               removeProcedure={removeProcedure}
                               showNameErrors={showNameErrors}
                               setShowNameErrors={setShowNameErrors}
                               selectedTTPs={selectedTTPs}
                               autoMapProcedureTTPs={autoMapProcedureTTPs}
                               mappingProcedureId={mappingProcedureId}
                               aiSettings={aiSettings}
                               isAssessing={isAssessing}
                               autoAssessSeverity={autoAssessSeverity}
                               compressImage={compressImage}
                               addSimulationEvidence={addSimulationEvidence}
                               simulationName={simulationDetails?.name}
                               setExpandedImage={setExpandedImage}
                               isManual={false}
                           />
                       );
                   })
             )}
           </div>
         </div>
       </div>
    </div>
    );
}
