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
import { ChevronUp, ChevronDown, Terminal, Download, Upload, X } from 'lucide-react';
import BattleGlobe from '../../features/BattleGlobe';
import EventCard from '../../ui/EventCard';
import RichMarkdownEditor from '../../ui/RichMarkdownEditor';
import { generateSelfLoggingHarness } from '../../../lib/simulationAutomation';

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
    setExpandedImage,
    onImportHarnessOutput,
    mitreData = {},
    addToast
}) {
    const [isGlobeCollapsed, setIsGlobeCollapsed] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [harnessInputText, setHarnessInputText] = useState('');

    const handleDownloadStep3Harness = (format = 'ps1') => {
        const scriptContent = generateSelfLoggingHarness({
            simulationName: simulationDetails?.name || 'Control Drift Simulation',
            simulationPayload,
            selectedTTPs,
            testResults,
            format,
            mitreData,
        });
        const blob = new Blob([scriptContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeBase = (simulationDetails?.name || 'control_drift_harness').replace(/[^a-zA-Z0-9_-]+/g, '_');
        a.download = `${safeBase}_harness.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        if (addToast) {
            addToast(`Downloaded self-logging ${format.toUpperCase()} harness! Run it and click "Import Output" to populate results.`, 'success');
        }
    };

    const handleHarnessFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = String(ev.target?.result || '');
            setHarnessInputText(text);
        };
        reader.readAsText(file);
    };

    const handleConfirmImport = () => {
        if (!onImportHarnessOutput) return;
        const ok = onImportHarnessOutput(harnessInputText);
        if (ok) {
            setHarnessInputText('');
            setIsImportModalOpen(false);
        }
    };

    return (
        <div className="animate-fade-in" style={{  display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'hidden', paddingRight: '10px', minHeight: 0  }}>

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
               <div style={{  flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0  }}>
                  <div style={{  display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', marginTop: '10px', minHeight: '32px', gap: '8px', flexWrap: 'wrap'  }}>
                     <h3 style={{  margin: 0, color: 'var(--text-primary)'  }}>Design Reference</h3>
                     <div style={{ display: 'flex', gap: '6px' }}>
                         <button
                             type="button"
                             onClick={() => handleDownloadStep3Harness('ps1')}
                             title="Download an agentless PowerShell (.ps1) validation script that executes all events and prints a JSON block for import"
                             style={{
                                 display: 'inline-flex',
                                 alignItems: 'center',
                                 gap: '5px',
                                 padding: '5px 10px',
                                 borderRadius: '6px',
                                 fontSize: '0.75rem',
                                 fontWeight: 700,
                                 cursor: 'pointer',
                                 background: 'rgba(6, 182, 212, 0.12)',
                                 border: '1px solid rgba(6, 182, 212, 0.35)',
                                 color: '#22d3ee'
                             }}
                         >
                             <Download size={13} />
                             <span>Export Harness (.ps1)</span>
                         </button>
                         <button
                             type="button"
                             onClick={() => handleDownloadStep3Harness('sh')}
                             title="Download an agentless Bash (.sh) validation script"
                             style={{
                                 display: 'inline-flex',
                                 alignItems: 'center',
                                 gap: '5px',
                                 padding: '5px 9px',
                                 borderRadius: '6px',
                                 fontSize: '0.75rem',
                                 fontWeight: 600,
                                 cursor: 'pointer',
                                 background: 'rgba(255,255,255,0.05)',
                                 border: '1px solid var(--glass-border)',
                                 color: 'var(--text-secondary)'
                             }}
                         >
                             <span>.sh</span>
                         </button>
                     </div>
                  </div>
                  <div style={{  flex: 1, height: 0, overflowY: 'auto', paddingRight: '10px', fontSize: '0.9rem', paddingTop: '15px', marginTop: '-15px'  }}>
                     {simulationPayload ? (
                         <div className="glass-panel" style={{  padding: '20px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px'  }}>
                             <RichMarkdownEditor value={simulationPayload} readOnly={true} />
                         </div>
                     ) : (
                         <div style={{  padding: '20px', textAlign: 'center', background: 'rgba(0,0,0,0.2)', border: '1px dashed var(--glass-border)', color: 'var(--text-muted)', borderRadius: '8px', fontSize: '0.9rem'  }}>
                             No design was created in Step 2. You can still export a validation harness above or document your execution events on the right.
                         </div>
                     )}
                  </div>
               </div>

               <div style={{  flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0  }}>
                 <div style={{  display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', marginTop: '10px', minHeight: '32px', paddingRight: '16px', gap: '8px', flexWrap: 'wrap'  }}>
                    <h3 style={{  margin: 0, color: 'var(--text-primary)'  }}>Simulation Events ({testResults.length})</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                            type="button"
                            className="btn hover-lift"
                            onClick={() => setIsImportModalOpen(true)}
                            title="Paste terminal output or upload control_drift_results.json from the Self-Logging Harness"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                fontSize: '0.78rem',
                                padding: '6px 10px',
                                background: 'rgba(6, 182, 212, 0.14)',
                                color: '#22d3ee',
                                border: '1px solid rgba(6, 182, 212, 0.4)',
                                fontWeight: 700
                            }}
                        >
                            <Terminal size={13} />
                            <span>Import Output</span>
                        </button>
                        <button type="button" className="btn" onClick={() => addProcedure(null)} style={{  fontSize: '0.82rem', padding: '6px 12px', background: 'rgba(156, 39, 176, 0.2)', color: 'var(--accent-primary)', border: '1px solid var(--accent-primary)', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(156, 39, 176, 0.3)'  }}>+ Add Event</button>
                    </div>
                 </div>
                 <div style={{  flex: 1, height: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', paddingRight: '10px', paddingTop: '15px', marginTop: '-15px'  }}>
                 
                 {testResults.length === 0 ? (
                     <div style={{  padding: '28px 20px', textAlign: 'center', background: 'rgba(0,0,0,0.2)', border: '1px dashed var(--glass-border)', color: 'var(--text-muted)', borderRadius: '10px', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px'  }}>
                         <div>No events added yet. Click <strong>+ Add Event</strong> above to document your execution steps, or import output from the Self-Logging Harness:</div>
                         <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                             <button
                                 type="button"
                                 className="btn hover-lift"
                                 onClick={() => setIsImportModalOpen(true)}
                                 style={{
                                     display: 'inline-flex',
                                     alignItems: 'center',
                                     gap: '6px',
                                     padding: '8px 14px',
                                     background: 'rgba(6, 182, 212, 0.15)',
                                     border: '1px solid rgba(6, 182, 212, 0.45)',
                                     color: '#22d3ee',
                                     fontWeight: 700,
                                     fontSize: '0.82rem'
                                 }}
                             >
                                 <Terminal size={14} />
                                 <span>Import Harness Output</span>
                             </button>
                         </div>
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
                               simulationName={simulationDetails.name}
                               setExpandedImage={setExpandedImage}
                               isManual={false}
                           />
                       );
                   })
             )}
           </div>
         </div>
       </div>

       {/* Import Self-Logging Harness Output Modal */}
       {isImportModalOpen && (
           <div
               className="animate-fade-in"
               onClick={() => setIsImportModalOpen(false)}
               style={{
                   position: 'fixed',
                   top: 0,
                   left: 0,
                   right: 0,
                   bottom: 0,
                   background: 'rgba(5, 5, 10, 0.85)',
                   backdropFilter: 'blur(12px)',
                   zIndex: 99999,
                   display: 'flex',
                   alignItems: 'center',
                   justifyContent: 'center',
                   padding: '20px'
               }}
           >
               <div
                   className="glass-panel"
                   onClick={(e) => e.stopPropagation()}
                   style={{
                       width: '100%',
                       maxWidth: '640px',
                       background: 'rgba(11, 12, 16, 0.96)',
                       border: '1px solid rgba(6, 182, 212, 0.45)',
                       borderRadius: '14px',
                       padding: '22px',
                       display: 'flex',
                       flexDirection: 'column',
                       gap: '14px',
                       boxShadow: '0 20px 60px rgba(0, 0, 0, 0.7)'
                   }}
               >
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                           <Terminal size={20} color="#22d3ee" />
                           <div>
                               <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                                   Import Self-Logging Harness / Terminal Output
                               </h3>
                               <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                   Paste the <code style={{ color: '#22d3ee' }}>=== CONTROL_DRIFT_RESULTS_START ===</code> block, upload <code style={{ color: '#22d3ee' }}>control_drift_results.json</code>, or paste raw terminal logs.
                               </div>
                           </div>
                       </div>
                       <button
                           type="button"
                           onClick={() => setIsImportModalOpen(false)}
                           style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                       >
                           <X size={20} />
                       </button>
                   </div>

                   {/* Accuracy & SIEM Verification Notice */}
                   <div
                       style={{
                           background: 'rgba(245, 158, 11, 0.08)',
                           border: '1px solid rgba(245, 158, 11, 0.35)',
                           borderLeft: '3px solid #f59e0b',
                           borderRadius: '8px',
                           padding: '10px 12px',
                           fontSize: '0.77rem',
                           lineHeight: 1.5,
                           color: 'var(--text-secondary)'
                       }}
                   >
                       <div style={{ fontWeight: 700, color: '#fbbf24', marginBottom: '3px' }}>
                           ⚠ Host Script Accuracy &amp; SIEM Verification Notice
                       </div>
                       <div>
                           Self-logging harnesses execute locally on the target endpoint. While they reliably detect <strong>host-level blocks</strong> (AMSI, Defender, AppLocker, SELinux, EDR process kills) and <strong>missing prerequisites</strong>, an endpoint script <strong>cannot see cloud SIEM/EDR alerts</strong>. Any command that runs unblocked (<code style={{ color: '#fde047' }}>Exit Code 0</code>) is conservatively imported as <strong>Logged</strong> and flagged with <strong style={{ color: '#fbbf24' }}>Verify SIEM ⚠</strong> so you can confirm whether an alert fired or if the activity was missed.
                       </div>
                   </div>

                   <textarea
                       value={harnessInputText}
                       onChange={(e) => setHarnessInputText(e.target.value)}
                       placeholder={'=== CONTROL_DRIFT_RESULTS_START ===\n{"version":2,"host":"WKSTN-01","results":[...]}\n=== CONTROL_DRIFT_RESULTS_END ==='}
                       style={{
                           width: '100%',
                           minHeight: '185px',
                           boxSizing: 'border-box',
                           background: 'rgba(0, 0, 0, 0.45)',
                           border: '1px solid var(--glass-border)',
                           borderRadius: '8px',
                           padding: '12px',
                           color: 'var(--text-primary)',
                           fontFamily: 'monospace',
                           fontSize: '0.82rem',
                           outline: 'none',
                           resize: 'vertical'
                       }}
                   />

                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                       <label
                           className="btn hover-lift"
                           style={{
                               display: 'inline-flex',
                               alignItems: 'center',
                               gap: '6px',
                               padding: '8px 14px',
                               fontSize: '0.8rem',
                               background: 'rgba(255,255,255,0.06)',
                               border: '1px solid var(--glass-border)',
                               color: 'var(--text-secondary)',
                               cursor: 'pointer'
                           }}
                       >
                           <Upload size={14} />
                           <span>Upload JSON / Log File</span>
                           <input
                               type="file"
                               accept=".json,.txt,.log"
                               onChange={handleHarnessFileUpload}
                               style={{ display: 'none' }}
                           />
                       </label>

                       <div style={{ display: 'flex', gap: '10px' }}>
                           <button
                               type="button"
                               className="btn"
                               onClick={() => setIsImportModalOpen(false)}
                               style={{ background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', padding: '8px 14px', fontSize: '0.82rem' }}
                           >
                               Cancel
                           </button>
                           <button
                               type="button"
                               className="btn hover-lift"
                               onClick={handleConfirmImport}
                               disabled={!harnessInputText.trim()}
                               style={{
                                   background: 'rgba(6, 182, 212, 0.2)',
                                   border: '1px solid #06b6d4',
                                   color: '#22d3ee',
                                   fontWeight: 700,
                                   padding: '8px 18px',
                                   fontSize: '0.82rem'
                               }}
                           >
                               Parse &amp; Populate Events
                           </button>
                       </div>
                   </div>
               </div>
           </div>
       )}
          </div>
    );
}
