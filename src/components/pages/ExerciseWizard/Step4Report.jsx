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
import { Upload, FileText, Loader2, Sparkles, CheckSquare, Square, Shield } from 'lucide-react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import ReportPDF from '../../features/ReportPDF';
import RichMarkdownEditor from '../../ui/RichMarkdownEditor';
import MarkdownRenderer from '../../ui/MarkdownRenderer';

export default function Step4Report({
    testResults,
    selectedTTPs,
    getAggregatedScore,
    activeSections,
    setActiveSections,
    reportData,
    setReportData,
    simulationDetails,
    compressImage,
    addSimulationEvidence,
    simulationEvidence,
    isAiActive,
    generateAIReport,
    isGeneratingReport,
    setExpandedImage,
    removeSimulationEvidence,
    updateProcedure
}) {
    const testR = testResults || [];
    const blocked = testR.filter(t => t.coverageRating === 'Optimal').length;
    const detected = testR.filter(t => t.coverageRating === 'Optimal' && t.outcome === 'Alerted').length;
    const partial = testR.filter(t => t.coverageRating === 'Partial').length;
    const minimal = testR.filter(t => t.coverageRating === 'Minimal').length;
    const missed = testR.filter(t => t.coverageRating === 'None').length;
    
    const mappedExercises = selectedTTPs.map(ttp => {
        const agg = getAggregatedScore(ttp.id);
        let status = 'low';
        if (agg.coverageRating === 'Optimal') status = 'high';
        if (agg.coverageRating === 'Partial') status = 'medium';
        if (agg.coverageRating === 'Minimal') status = 'minimal';
        if (agg.coverageRating === 'None') status = 'low';
        if (agg.outcome === 'N/A') status = 'na';
        
        const procedures = (testResults || []).filter(p => (p.ttps || []).includes(ttp.id));
        
        return {
            ttp: ttp.id,
            name: ttp.name,
            status: status,
            aggOutcome: agg.outcome,
            procedures: procedures
        };
    })?.filter(ex => ex.aggOutcome !== 'N/A');

    let compiledSummary = '';
    if (activeSections.executiveSummary && reportData.executiveSummary) compiledSummary += `## Executive Summary\n${reportData.executiveSummary}\n\n`;
    if (activeSections.keyFindings && reportData.keyFindings) compiledSummary += `## Key Findings\n${reportData.keyFindings}\n\n`;
    if (activeSections.businessImpact && reportData.businessImpact) compiledSummary += `## Risk Analysis\n${reportData.businessImpact}\n\n`;
    if (activeSections.recommendations && reportData.recommendations) compiledSummary += `## Recommendations\n${reportData.recommendations}\n\n`;
    compiledSummary = compiledSummary.trim();

    return (
        <div className="animate-fade-in" style={{  display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', paddingRight: '10px', paddingTop: '10px'  }}>
          <div style={{  display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '20px'  }}>
             <div style={{  display: 'flex', gap: '10px'  }}>
               <label className="btn" style={{  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer'  }}>
                 <Upload size={16} /> Attach Evidence
                 <input type="file" accept="image/*" style={{  display: 'none'  }} onChange={(e) => {
                     const file = e.target.files[0];
                     if (file) {
                        const reader = new FileReader();
                        reader.onload = async (ev) => {
                           const b64 = await compressImage(ev.target.result);
                           addSimulationEvidence(simulationDetails.name || 'Ad-hoc Simulation', b64);
                        };
                        reader.readAsDataURL(file);
                     }
                 }} />
               </label>
               <PDFDownloadLink
                 document={
                   <ReportPDF 
                      simulationName={simulationDetails.name || 'Ad-hoc Simulation'}
                      date={new Date().toISOString()}
                      summary={compiledSummary}
                      exercises={mappedExercises}
                      blocked={blocked}
                      medium={partial}
                      minimal={minimal}
                      missed={missed}
                      total={mappedExercises.length}
                      evidence={simulationEvidence[simulationDetails.name || 'Ad-hoc Simulation'] || []}
                      testResults={testResults}
                      participants={(simulationDetails.participants || []).map(p => p.name).join(', ')}
                   />
                 }
                 fileName={`${simulationDetails.name || 'Simulation'}_Report.pdf`}
                 className="btn"
                 style={{  display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.1)', textDecoration: 'none', color: 'inherit'  }}
               >
                 {({ blob, url, loading, error }) => (
                   <>
                      <FileText size={16} /> {loading ? 'Preparing PDF...' : 'Export to PDF'}
                   </>
                 )}
               </PDFDownloadLink>
               {!!isAiActive && (
                 <button className="btn-premium-ai" onClick={generateAIReport} disabled={isGeneratingReport} style={{  display: 'flex', alignItems: 'center', gap: '8px'  }}>
                   {isGeneratingReport ? <Loader2 size={16} style={{  animation: 'spin 1s linear infinite'  }} /> : <Sparkles size={16} />} {isGeneratingReport ? 'Analyzing...' : 'Generate Report Sections'}
                 </button>
               )}
             </div>
          </div>
          
          <div style={{  display: 'flex', gap: '20px', height: '65vh'  }}>
            {/* Left Column: Narrative Builder */}
            <div className="glass-panel" style={{  flex: '0 0 35%', display: 'flex', flexDirection: 'column', padding: '20px', background: 'rgba(10, 11, 16, 0.6)', border: '1px solid var(--glass-border)', borderRadius: '12px', overflowY: 'auto'  }}>
                <h3 style={{  margin: '0 0 15px 0', color: 'var(--text-primary)', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px'  }}>Narrative Builder</h3>
                <p style={{  fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '15px'  }}>Toggle the sections you wish to include in the executive report.</p>
                
                <div style={{  display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '20px'  }}>
                    {[
                        { id: 'executiveSummary', label: 'Executive Summary' },
                        { id: 'keyFindings', label: 'Key Findings' },
                        { id: 'businessImpact', label: 'Risk Analysis' },
                        { id: 'recommendations', label: 'Recommendations' }
                    ].map(sec => (
                        <button 
                            key={sec.id} 
                            className="btn hover-lift" 
                            onClick={() => setActiveSections(prev => ({ ...prev, [sec.id]: !prev[sec.id] }))}
                            style={{  
                                padding: '6px 10px', 
                                fontSize: '0.75rem', 
                                borderRadius: '20px', 
                                border: `1px solid ${activeSections[sec.id] ? 'var(--accent-primary)' : 'var(--glass-border)'}`, 
                                background: activeSections[sec.id] ? 'rgba(156, 39, 176, 0.2)' : 'transparent',
                                color: activeSections[sec.id] ? 'var(--text-primary)' : 'var(--text-muted)',
                                display: 'flex', alignItems: 'center', gap: '5px'
                             }}>
                            {activeSections[sec.id] ? <CheckSquare size={14} /> : <Square size={14} />} {sec.label}
                        </button>
                    ))}
                </div>
                
                <div style={{  display: 'flex', flexDirection: 'column', gap: '20px'  }}>
                    {activeSections.executiveSummary && (
                       <div className="animate-fade-in" style={{ wordBreak: "break-all", overflowWrap: "anywhere", minWidth: 0, flexShrink: 1, maxHeight: "100%", overflowY: "auto" }}>
                          <label style={{  display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '12px'   }}>Executive Summary</label>
                          <RichMarkdownEditor minHeight="120px" value={reportData.executiveSummary} onChange={val => setReportData({...reportData, executiveSummary: val})} placeholder="Provide a high-level overview of the simulation's objectives and macroscopic outcomes..." />
                       </div>
                    )}
                    {activeSections.keyFindings && (
                       <div className="animate-fade-in" style={{ wordBreak: "break-all", overflowWrap: "anywhere", minWidth: 0, flexShrink: 1, maxHeight: "100%", overflowY: "auto" }}>
                         <label style={{  display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '12px'   }}>Key Findings (Strengths & Opportunities)</label>
                         <RichMarkdownEditor minHeight="120px" value={reportData.keyFindings} onChange={val => setReportData({...reportData, keyFindings: val})} placeholder="Detail specific strengths and areas for improvement..." />
                       </div>
                    )}
                    {activeSections.businessImpact && (
                       <div className="animate-fade-in" style={{ wordBreak: "break-all", overflowWrap: "anywhere", minWidth: 0, flexShrink: 1, maxHeight: "100%", overflowY: "auto" }}>
                         <label style={{  display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '12px'   }}>Risk Analysis</label>
                         <RichMarkdownEditor minHeight="120px" value={reportData.businessImpact} onChange={val => setReportData({...reportData, businessImpact: val})} placeholder="Describe the potential operational or financial risk..." />
                       </div>
                    )}
                    {activeSections.recommendations && (
                       <div className="animate-fade-in" style={{ wordBreak: "break-all", overflowWrap: "anywhere", minWidth: 0, flexShrink: 1, maxHeight: "100%", overflowY: "auto" }}>
                         <label style={{  display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '12px'   }}>Recommendations</label>
                         <RichMarkdownEditor minHeight="120px" value={reportData.recommendations} onChange={val => setReportData({...reportData, recommendations: val})} placeholder="Provide actionable recommendations to remediate risk" />
                       </div>
                    )}
                </div>
            </div>

            {/* Right Column: Live Report Preview */}
            <div id="executive-report" className="glass-panel" style={{  flex: '1', background: 'var(--bg-primary)', padding: '30px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '30px', overflowY: 'auto', border: '1px solid rgba(156, 39, 176, 0.2)', position: 'relative', boxShadow: 'inset 0 0 40px rgba(0,0,0,0.5)'  }}>
                <div style={{  display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid rgba(156, 39, 176, 0.3)', paddingBottom: '15px'  }}>
                    <div>
                       <div style={{  display: 'inline-block', background: 'var(--accent-primary)', color: '#fff', padding: '4px 10px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '1px'  }}>Adversary Simulation</div>
                       <h1 style={{  margin: 0, color: 'var(--text-primary)', fontSize: '1.8rem', letterSpacing: '-0.5px'  }}>{simulationDetails.name || 'Unnamed Simulation'}</h1>
                       <p style={{  margin: '5px 0 0 0', color: 'var(--text-secondary)'  }}>Environment: {simulationDetails.environmentCategory?.join(', ') || 'N/A'}</p>
                       {simulationDetails.participants && simulationDetails.participants.filter(p => p.name).length > 0 && (
                           <p style={{  margin: '5px 0 0 0', color: 'var(--text-secondary)'  }}>Participants: {simulationDetails.participants.filter(p => p.name).map(p => `${p.name} (${p.role})`).join(', ')}</p>
                       )}
                    </div>
                    <div style={{  textAlign: 'right'  }}>
                       <h3 style={{  margin: 0, fontSize: '1.3rem', color: '#ffffff'  }}>Executive Report</h3>
                       <p style={{  margin: '5px 0 0 0', color: 'var(--text-secondary)'  }}>{new Date().toLocaleDateString()}</p>
                    </div>
                </div>

                <div>
                    <h3 style={{  margin: '0 0 15px 0', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px', color: 'var(--text-primary)'  }}>TTP Coverage</h3>
                    <div style={{  display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '15px'  }}>
                    <div style={{  padding: '15px', background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%)', border: '1px solid rgba(16, 185, 129, 0.2)', borderTop: '3px solid var(--success)', borderRadius: '8px', textAlign: 'center'  }}>
                      <div style={{  fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)'  }}>{blocked}</div>
                      <div style={{  fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px'  }}>Optimal</div>
                    </div>
                    <div style={{  padding: '15px', background: 'linear-gradient(180deg, rgba(245, 158, 11, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%)', border: '1px solid rgba(245, 158, 11, 0.2)', borderTop: '3px solid var(--warning)', borderRadius: '8px', textAlign: 'center'  }}>
                      <div style={{  fontSize: '2rem', fontWeight: 'bold', color: 'var(--warning)'  }}>{partial}</div>
                      <div style={{  fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px'  }}>Partial</div>
                    </div>
                    <div style={{  padding: '15px', background: 'linear-gradient(180deg, rgba(249, 115, 22, 0.1) 0%, rgba(249, 115, 22, 0.05) 100%)', border: '1px solid rgba(249, 115, 22, 0.2)', borderTop: '3px solid var(--minimal)', borderRadius: '8px', textAlign: 'center'  }}>
                      <div style={{  fontSize: '2rem', fontWeight: 'bold', color: 'var(--minimal)'  }}>{minimal}</div>
                      <div style={{  fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px'  }}>Minimal</div>
                    </div>
                    <div style={{  padding: '15px', background: 'linear-gradient(180deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.05) 100%)', border: '1px solid rgba(239, 68, 68, 0.2)', borderTop: '3px solid var(--danger)', borderRadius: '8px', textAlign: 'center'  }}>
                      <div style={{  fontSize: '2rem', fontWeight: 'bold', color: 'var(--danger)'  }}>{missed}</div>
                      <div style={{  fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px'  }}>No Coverage</div>
                    </div>
                    <div style={{  padding: '15px', background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)', border: '1px solid var(--glass-border)', borderTop: '3px solid var(--text-secondary)', borderRadius: '8px', textAlign: 'center'  }}>
                      <div style={{  fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-primary)'  }}>{testResults?.length || 0}</div>
                      <div style={{  fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px'  }}>Total Events</div>
                    </div>
                    </div>
                </div>

                {( (activeSections.executiveSummary && reportData.executiveSummary) || 
                   (activeSections.keyFindings && reportData.keyFindings) || 
                   (activeSections.businessImpact && reportData.businessImpact) || 
                   (activeSections.recommendations && reportData.recommendations) ) && (
                   <div className="markdown-body" style={{  background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)'  }}>
                      <MarkdownRenderer content={compiledSummary} />
                   </div>
                )}

                <div>
                   <h3 style={{  margin: '0 0 15px 0', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px', color: 'var(--accent-secondary)'  }}>Technical Findings</h3>
                 <div style={{  display: 'flex', flexDirection: 'column', gap: '20px'  }}>
                    {testResults.map((proc, idx) => {
                        let currentOut = proc.outcome || '';
                        if (currentOut.includes(' ➔ ')) currentOut = currentOut.split(' ➔ ')[1];
                        const isPBlocked = currentOut.startsWith('Prevented') || currentOut.startsWith('Alerted');
                        const isPPartial = (proc.outcome || '').startsWith('Logged');
                        const procBadge = isPBlocked ? {bg: 'rgba(16, 185, 129, 0.15)', text: 'var(--success)', border: 'rgba(16,185,129,0.3)'} : 
                                          isPPartial ? {bg: 'rgba(245, 158, 11, 0.15)', text: 'var(--warning)', border: 'rgba(245, 158, 11, 0.3)'} :
                                          {bg: 'rgba(239, 68, 68, 0.15)', text: 'var(--danger)', border: 'rgba(239,68,68,0.3)'};

                        return (
                           <div key={proc.id} style={{  padding: '20px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', transition: 'all 0.2s ease'  }}>
                              <div style={{  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px'  }}>
                                  <div style={{  display: 'flex', flexDirection: 'column', gap: '8px'  }}>
                                      <div style={{  display: 'flex', alignItems: 'center', gap: '10px'  }}>
                                          <span style={{  color: 'var(--accent-secondary)', fontWeight: '900', fontSize: '1rem', opacity: 0.8  }}>#{idx + 1}</span>
                                          <strong style={{  color: 'var(--text-primary)', fontSize: '1.15rem', fontWeight: 600, letterSpacing: '0.3px'  }}>
                                              {proc.name || 'Unnamed Event'}
                                              {proc.outcome?.includes(' ➔ ') && (
                                                  <span style={{  marginLeft: '10px', fontSize: '0.75rem', color: '#059669', background: 'rgba(5, 150, 105, 0.1)', padding: '2px 6px', borderRadius: '4px', verticalAlign: 'middle', border: '1px solid rgba(5, 150, 105, 0.2)'  }}>Re-Tested ✓</span>
                                              )}
                                          </strong>
                                      </div>
                                      <div style={{  display: 'flex', flexWrap: 'wrap', gap: '6px', paddingLeft: '24px'  }}>
                                          {(proc.ttps || []).map(tId => {
                                              const techName = selectedTTPs.find(t => t.id === tId)?.name || '';
                                              return (
                                                  <span key={tId} style={{  color: 'var(--text-muted)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: '4px', background: 'rgba(0,0,0,0.2)'  }}>
                                                      <strong style={{ opacity: 0.8 }}>{tId}</strong>
                                                      {techName && <span>{techName}</span>}
                                                  </span>
                                              );
                                          })}
                                          {proc.securityControls && proc.securityControls.length > 0 && (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                {proc.securityControls.map((ctrl, idx) => (
                                                    <span key={idx} style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#60a5fa', padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                        <Shield size={10} />
                                                        {ctrl}
                                                    </span>
                                                ))}
                                            </div>
                                          )}
                                      </div>
                                  </div>
                                  <div style={{  display: 'flex', gap: '15px', alignItems: 'center', fontSize: '0.85rem', flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 0  }}>
                                      <div style={{  color: 'var(--text-muted)', whiteSpace: 'nowrap'  }}>Expected: <span style={{  color: 'var(--text-primary)'  }}>{proc.expectedOutcome || 'N/A'}</span></div>
                                      <div style={{  color: 'var(--text-muted)', whiteSpace: 'nowrap'  }}>Actual: <strong style={{  color: procBadge.text  }}>{proc.outcome || 'Missed'}</strong></div>
                                      {proc.coverageRating && proc.coverageRating !== 'N/A' && (
                                      <div style={{  color: 'var(--text-muted)', whiteSpace: 'nowrap'  }}>Coverage: <span style={{  color: proc.coverageRating === 'Optimal' ? 'var(--success)' : proc.coverageRating === 'Partial' ? 'var(--warning)' : proc.coverageRating === 'Minimal' ? 'var(--minimal)' : proc.coverageRating === 'None' ? 'var(--danger)' : 'var(--text-secondary)'  }}>{proc.coverageRating}</span></div>
                                      )}
                                      {proc.severity && proc.severity !== 'N/A' && proc.severity !== 'Auto-Calculate' && (
                                      <div style={{  color: 'var(--text-muted)', whiteSpace: 'nowrap'  }}>Severity: <span style={{  color: String(proc.severity).toLowerCase() === 'critical' ? 'var(--severity-critical)' : String(proc.severity).toLowerCase() === 'high' ? 'var(--severity-high)' : String(proc.severity).toLowerCase() === 'medium' ? 'var(--severity-medium)' : String(proc.severity).toLowerCase() === 'low' ? 'var(--severity-low)' : 'var(--text-muted)'  }}>{proc.severity}</span></div>
                                      )}
                                  </div>
                              </div>
                              <div style={{  display: 'flex', gap: '30px', paddingLeft: '24px', borderTop: '1px dashed rgba(255,255,255,0.05)', paddingTop: '15px'  }}>
                                  <div style={{  flex: 1  }}>
                                      <div style={{  color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 'bold', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px'  }}>
                                          <span style={{  width: '8px', height: '8px', borderRadius: '50%', background: 'var(--danger)', boxShadow: '0 0 8px var(--danger)'  }}></span>
                                          Red Team Notes
                                      </div>
                                      <div style={{ color: 'var(--text-primary)', background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '8px', border: '1px solid var(--glass-border)', borderLeft: '4px solid var(--danger)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', overflowWrap: 'anywhere', maxHeight: '200px', overflowY: 'auto', lineHeight: '1.5', minHeight: '60px' }}>{proc.execNotes || 'N/A'}</div>
                                  </div>
                                  <div style={{  flex: 1   }}>
                                      <div style={{  color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 'bold', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px'  }}>
                                          <span style={{  width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6', boxShadow: '0 0 8px #3b82f6'  }}></span>
                                          Blue Team Notes
                                      </div>
                                      <div style={{ color: 'var(--text-primary)', background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '8px', border: '1px solid var(--glass-border)', borderLeft: '4px solid #3b82f6', whiteSpace: 'pre-wrap', wordBreak: 'break-all', overflowWrap: 'anywhere', maxHeight: '200px', overflowY: 'auto', lineHeight: '1.5', minHeight: '60px' }}>{proc.detNotes || 'N/A'}</div>
                                  </div>
                              </div>
                              {(proc.evidence || []).length > 0 && (
                                 <div style={{ paddingLeft: '24px', paddingTop: '15px' }}>
                                     <strong style={{  display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px'   }}>Evidence</strong>
                                     <div style={{  display: 'flex', gap: '10px', flexWrap: 'wrap'  }}>
                                         {proc.evidence.map((img, i) => (
                                             <div key={i} className="report-thumbnail-wrapper" style={{ position: 'relative', display: 'inline-block' }}>
                                                 <img src={img} alt={`Evidence ${i+1}`} style={{  maxWidth: '200px', borderRadius: '4px', border: '1px solid var(--glass-border)', cursor: 'pointer', transition: 'transform 0.2s'  }} onMouseEnter={e => e.target.style.transform = 'scale(1.05)'} onMouseLeave={e => e.target.style.transform = 'scale(1)'} onClick={() => setExpandedImage(img)} title="Click to enlarge" />
                                             </div>
                                         ))}
                                     </div>
                                 </div>
                              )}
                           </div>
                        );
                    })}
                 </div>
                </div>

                {(simulationEvidence[simulationDetails.name || 'Ad-hoc Simulation'] || []).length > 0 && (
                   <div style={{  marginTop: '10px'  }}>
                      <h3 style={{  margin: '0 0 15px 0', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px', color: 'var(--accent-secondary)'  }}>Attached Evidence</h3>
                      <div style={{  display: 'flex', flexWrap: 'wrap', gap: '15px'  }}>
                        {(simulationEvidence[simulationDetails.name || 'Ad-hoc Simulation'] || []).map((b64, idx) => (
                           <div key={idx} className="report-thumbnail-wrapper" style={{ position: 'relative', display: 'inline-block', padding: '5px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid var(--glass-border)'  }}>
                              <img src={b64} alt={`Evidence ${idx + 1}`} style={{  maxWidth: '250px', maxHeight: '150px', objectFit: 'contain', borderRadius: '4px', cursor: 'pointer', transition: 'transform 0.2s'  }} onMouseEnter={e => e.target.style.transform = 'scale(1.02)'} onMouseLeave={e => e.target.style.transform = 'scale(1)'} onClick={() => setExpandedImage(b64)} title="Click to enlarge" />
                              <button className="thumbnail-delete-btn" type="button" onClick={(e) => { e.stopPropagation(); removeSimulationEvidence(simulationDetails.name || 'Ad-hoc Simulation', idx); }} style={{ position: 'absolute', top: '-8px', right: '-8px', background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, fontSize: '16px', zIndex: 10 }}>&times;</button>
                           </div>
                        ))}
                      </div>
                   </div>
                )}
            </div>
          </div>
        </div>
    );
}
