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
import { ChevronDown, ChevronRight, Trash2, Crosshair, Shield, Upload, Info } from 'lucide-react';
import EventTypeDropdown from '../dropdowns/EventTypeDropdown';
import OutcomeDropdown from '../dropdowns/OutcomeDropdown';
import CoverageRatingDropdown from '../dropdowns/CoverageRatingDropdown';
import SeverityDropdown from '../dropdowns/SeverityDropdown';
import EventTTPDropdown from '../dropdowns/EventTTPDropdown';
import SecurityControlsDropdown from '../dropdowns/SecurityControlsDropdown';

const getOutcomeStyle = (outcome) => {
    if (outcome === 'Prevented & Alerted') return { color: 'var(--success)', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.3)' };
    if (outcome === 'Prevented') return { color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)', border: 'rgba(6, 182, 212, 0.3)' };
    if (outcome === 'Alerted') return { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.3)' };
    if (outcome === 'Logged') return { color: 'var(--warning)', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.3)' };
    if (outcome === 'Missed') return { color: 'var(--danger)', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.3)' };
    return { color: 'var(--text-primary)', bg: 'rgba(255,255,255,0.1)', border: 'rgba(255,255,255,0.2)' };
};

export default function EventCard({
    proc,
    index,
    totalCards,
    isCollapsed,
    onToggleCollapse,
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
    simulationName,
    setExpandedImage,
    isManual = false
}) {
    const eventColor = proc.coverageRating === 'Optimal' ? 'var(--success)' : proc.coverageRating === 'Partial' ? 'var(--warning)' : proc.coverageRating === 'Minimal' ? 'var(--minimal)' : proc.coverageRating === 'None' ? 'var(--danger)' : 'var(--accent-primary)';
    
    return (
        <div className="glass-panel" style={{  padding: isCollapsed ? '12px 20px' : '16px 20px', background: 'var(--glass-bg)', flexShrink: 0, borderLeft: `4px solid ${eventColor}`, position: 'relative', zIndex: totalCards - index, borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px', transition: 'all 0.3s ease', boxShadow: `-12px 0 12px -12px ${eventColor}, 0 8px 32px rgba(0,0,0,0.2)`  }}>
            {/* Header Row */}
            <div style={{  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '15px'  }}>
                <div style={{  display: 'flex', gap: '15px', alignItems: 'center', flex: 1  }}>
                    <div style={{  width: '160px'  }}>
                        <EventTypeDropdown 
                            value={proc.eventType || 'Payload'} 
                            onChange={(val) => updateProcedure(proc.id, 'eventType', val)} 
                        />
                    </div>
                    <div style={{  flex: 1, position: 'relative', display: 'flex', alignItems: 'center', gap: '15px'  }}>
                        <input onKeyDown={e => e.stopPropagation()} maxLength={100} className="ai-input" style={{  flex: 1, margin: 0, background: (showNameErrors && (!proc.name || proc.name.trim() === '' || /^Event \d+$/.test(proc.name.trim()))) ? 'rgba(239, 68, 68, 0.1)' : 'transparent', border: 'none', borderBottom: (showNameErrors && (!proc.name || proc.name.trim() === '' || /^Event \d+$/.test(proc.name.trim()))) ? '1px dashed var(--danger)' : '1px dashed var(--glass-border)', fontSize: '1.1rem', color: 'var(--text-primary)', padding: '6px 8px', outline: 'none', fontWeight: 'bold', borderRadius: '4px 4px 0 0', transition: 'all 0.3s ease'  }} 
                               value={proc.name || ''} 
                               onChange={e => {
                                   updateProcedure(proc.id, 'name', e.target.value);
                                   if (showNameErrors && setShowNameErrors) setShowNameErrors(false);
                               }} 
                               placeholder={proc.eventType === 'Payload' || !proc.eventType ? "Payload Name" : "Procedure Name"} />
                        
                        {isCollapsed && (
                            <div style={{  display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center'  }}>
                                {proc.outcome && proc.outcome !== 'N/A' && proc.outcome !== '' && (
                                    <span style={{  background: getOutcomeStyle(proc.outcome).bg, border: `1px solid ${getOutcomeStyle(proc.outcome).border}`, color: getOutcomeStyle(proc.outcome).color, padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold'  }}>
                                        {proc.outcome}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                <div style={{  display: 'flex', gap: '8px'  }}>
                    <button onClick={onToggleCollapse} style={{  background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center', borderRadius: '6px', transition: 'all 0.2s'  }} onMouseEnter={e => {e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}} onMouseLeave={e => {e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'}} title={isCollapsed ? "Expand" : "Collapse"}>
                        {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                    </button>
                    <button onClick={() => removeProcedure(proc.id)} style={{  background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center', borderRadius: '6px', transition: 'all 0.2s'  }} onMouseEnter={e => {e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}} onMouseLeave={e => {e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'}} title="Remove Event">
                        <Trash2 size={18} />
                    </button>
                </div>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateRows: isCollapsed ? '0fr' : '1fr',
                transition: 'grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease',
                opacity: isCollapsed ? 0 : 1
            }}>
                <div style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '12px', marginTop: isCollapsed ? '0' : '8px' }}>
                    {/* Payload / Procedure Body */}
                    {(proc.eventType === 'Payload' || !proc.eventType) && (
                        <textarea onKeyDown={e => e.stopPropagation()} className="ai-input" style={{  width: '100%', boxSizing: 'border-box', background: 'rgba(5, 5, 10, 0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--accent-secondary)', padding: '12px', outline: 'none', minHeight: '60px', fontFamily: 'monospace', resize: 'vertical'  }} 
                               value={proc.payloadCode || ''} 
                               onChange={e => updateProcedure(proc.id, 'payloadCode', e.target.value)} 
                               placeholder="Payload Code" />
                    )}
                    {proc.eventType === 'Procedure' && (
                        <textarea onKeyDown={e => e.stopPropagation()} className="ai-input" style={{  width: '100%', boxSizing: 'border-box', background: 'rgba(5, 5, 10, 0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--text-primary)', padding: '12px', outline: 'none', minHeight: '60px', fontFamily: 'sans-serif', resize: 'vertical'  }} 
                               value={proc.procedureSteps || ''} 
                               onChange={e => updateProcedure(proc.id, 'procedureSteps', e.target.value)} 
                               placeholder="Procedure Steps" />
                    )}

                    {/* Metadata Row */}
                    <div style={{  display: 'grid', gridTemplateColumns: isManual ? 'repeat(6, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: '16px', alignItems: 'flex-start', background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px', border: '1px solid var(--glass-border)', boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.2)'  }}>
                        <div style={{  gridColumn: isManual ? 'span 3' : 'span 2', display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0  }}>
                            <label style={{  fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 'bold'  }}>Mapped TTPs</label>
                            <EventTTPDropdown 
                                proc={proc} 
                                selectedTTPs={selectedTTPs} 
                                updateProcedure={updateProcedure} 
                                autoMapProcedureTTPs={autoMapProcedureTTPs}
                                mappingProcedureId={mappingProcedureId}
                                aiSettings={aiSettings}
                            />
                        </div>
                        <div style={{  gridColumn: isManual ? 'span 3' : 'span 2', display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0  }}>
                            <label style={{  fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 'bold'  }}>Security Controls</label>
                            <SecurityControlsDropdown 
                                proc={proc} 
                                updateProcedure={updateProcedure} 
                            />
                        </div>
                        
                        {!isManual && (
                            <div style={{  display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0  }}>
                                <label style={{  fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px'  }}>
                                    Expected Outcome
                                    <span title="The anticipated operational result before the test is executed." style={{ cursor: 'help', display: 'flex', alignItems: 'center' }}>
                                        <Info size={14} color="#3b82f6" />
                                    </span>
                                </label>
                                <OutcomeDropdown 
                                    isExpected={true}
                                    value={proc.expectedOutcome} 
                                    allowNA={isManual}
                                    onChange={val => {
                                        updateProcedure(proc.id, 'expectedOutcome', val);
                                    }} 
                                />
                            </div>
                        )}
                        
                        
                        <div style={{  gridColumn: isManual ? 'span 2' : 'span 1', display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0  }}>
                            <label style={{  fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px'  }}>
                                {isManual ? 'Outcome' : 'Actual Outcome'}
                                <span title="The operational result of the execution (e.g., Prevented, Missed, Logged)." style={{ cursor: 'help', display: 'flex', alignItems: 'center' }}>
                                    <Info size={14} color="#3b82f6" />
                                </span>
                            </label>
                            <OutcomeDropdown 
                                value={proc.outcome} 
                                allowNA={isManual}
                                onChange={val => {
                                    updateProcedure(proc.id, 'outcome', val);
                                    if (val === 'Prevented & Alerted' || val === 'Prevented' || val === 'Alerted') {
                                        updateProcedure(proc.id, 'coverageRating', 'Optimal');
                                        updateProcedure(proc.id, 'severity', 'N/A');
                                    } else if (val === 'Prevented') {
                                        updateProcedure(proc.id, 'coverageRating', 'Partial');
                                        if (proc.severity === 'N/A' || proc.severity === 'Auto-Calculate') updateProcedure(proc.id, 'severity', 'Low');
                                    } else if (val === 'Logged') {
                                        updateProcedure(proc.id, 'coverageRating', 'Partial');
                                        if (proc.severity === 'N/A' || proc.severity === 'Auto-Calculate' || proc.severity === 'Low') updateProcedure(proc.id, 'severity', 'Medium');
                                    } else if (val === 'Missed') {
                                        updateProcedure(proc.id, 'coverageRating', 'None');
                                        if (proc.severity === 'N/A' || proc.severity === 'Auto-Calculate' || proc.severity === 'Low') updateProcedure(proc.id, 'severity', 'Medium');
                                    } else if (val === 'N/A' || val === 'Error') {
                                        updateProcedure(proc.id, 'coverageRating', 'N/A');
                                        updateProcedure(proc.id, 'severity', 'N/A');
                                    }
                                }} 
                            />
                        </div>
                        <div style={{  gridColumn: isManual ? 'span 2' : 'span 1', display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0  }}>
                            <label style={{  fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px'  }}>
                                Coverage Rating
                                <span title="A standardized measure of detection quality based on the outcome." style={{ cursor: 'help', display: 'flex', alignItems: 'center' }}>
                                    <Info size={14} color="#3b82f6" />
                                </span>
                            </label>
                            <CoverageRatingDropdown 
                                value={proc.coverageRating} 
                                outcome={proc.outcome}
                                disabled={proc.outcome === 'Prevented & Alerted'}
                                onChange={val => {
                                    updateProcedure(proc.id, 'coverageRating', val);
                                    if (val === 'Optimal') {
                                        if (proc.severity !== 'N/A') {
                                            updateProcedure(proc.id, 'severity', 'N/A');
                                        }
                                    } else {
                                        if (proc.severity === 'N/A' || proc.severity === 'Auto-Calculate') {
                                            if (proc.outcome && (proc.outcome.startsWith('Prevented') || proc.outcome.startsWith('Alerted'))) {
                                                updateProcedure(proc.id, 'severity', 'Low');
                                            } else {
                                                updateProcedure(proc.id, 'severity', 'Medium');
                                            }
                                        }
                                    }
                                }} 
                            />
                        </div>
                        <div style={{  gridColumn: isManual ? 'span 2' : 'span 1', display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0  }}>
                            <label style={{  fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 'bold'  }}>Gap Severity</label>
                            <SeverityDropdown 
                                value={proc.severity} 
                                onChange={val => updateProcedure(proc.id, 'severity', val)} 
                                disabled={proc.coverageRating === 'Optimal' || proc.outcome === 'N/A' || proc.outcome === 'Error'}
                                isAssessing={isAssessing?.[proc.id]}
                                onAutoAssess={() => autoAssessSeverity && autoAssessSeverity(proc)}
                            />
                        </div>
                    </div>

                    {/* Notes Row */}
                    <div style={{  display: 'flex', gap: '10px', alignItems: 'stretch'  }}>
                        <div style={{  display: 'flex', flexDirection: 'column', gap: '8px', flex: 1  }}>
                            <div style={{  position: 'relative'  }}>
                                <Crosshair size={16} style={{  position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#ef4444'  }} />
                                <input onKeyDown={e => e.stopPropagation()} className="ai-input" style={{  fontSize: '0.85rem', padding: '10px 12px 10px 36px', width: '100%', boxSizing: 'border-box', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', transition: 'all 0.3s ease'  }} placeholder="Red Team Notes (e.g. executed under SYSTEM)" 
                                       value={proc.execNotes || ''} 
                                       onChange={e => updateProcedure(proc.id, 'execNotes', e.target.value)} />
                            </div>
                            
                            <div style={{  position: 'relative'  }}>
                                <Shield size={16} style={{  position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#3b82f6'  }} />
                                <input onKeyDown={e => e.stopPropagation()} className="ai-input" style={{  fontSize: '0.85rem', padding: '10px 12px 10px 36px', width: '100%', boxSizing: 'border-box', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', transition: 'all 0.3s ease'  }} placeholder="Blue Team Notes (e.g. Found Event ID 4688)" 
                                       value={proc.detNotes || ''} 
                                       onChange={e => updateProcedure(proc.id, 'detNotes', e.target.value)} />
                            </div>
                        </div>
                        <label className="btn" style={{  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '0 24px', fontSize: '0.85rem', borderRadius: '6px', transition: 'all 0.2s', minWidth: '100px'  }} onMouseEnter={e => {e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'var(--text-primary)'}} onMouseLeave={e => {e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-secondary)'}} title="Attach screenshot of log/alert">
                            <Upload size={18} /> Attach Evidence
                            <input type="file" accept="image/*" style={{  display: 'none'  }} onChange={(e) => {
                                const file = e.target.files[0];
                                if (file) {
                                    const reader = new FileReader();
                                    reader.onload = async (ev) => {
                                        if (compressImage) {
                                            const b64 = await compressImage(ev.target.result);
                                            updateProcedure(proc.id, 'evidence', [...(proc.evidence || []), b64]);
                                            if (addSimulationEvidence) addSimulationEvidence(simulationName || 'Ad-hoc Simulation', ev.target.result);
                                        }
                                    };
                                    reader.readAsDataURL(file);
                                }
                            }} />
                        </label>
                    </div>
                    {(proc.evidence || []).length > 0 && (
                        <div style={{  display: 'flex', gap: '5px', marginTop: '5px', flexWrap: 'wrap'  }}>
                            {proc.evidence.map((img, i) => (
                                <div key={i} className="thumbnail-wrapper" style={{  position: 'relative', marginRight: '5px', marginBottom: '5px'  }}>
                                    <img src={img} alt="Evidence" style={{  width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--glass-border)', cursor: 'pointer'  }} title="Attached Evidence" onClick={() => setExpandedImage && setExpandedImage(img)} />
                                    <button className="thumbnail-delete-btn" onClick={(e) => {
                                        e.stopPropagation();
                                        const filteredEvidence = proc.evidence?.filter((_, idx) => idx !== i);
                                        updateProcedure(proc.id, 'evidence', filteredEvidence);
                                    }} style={{  position: 'absolute', top: '-5px', right: '-5px', background: 'var(--danger)', color: 'white', borderRadius: '50%', border: 'none', width: '16px', height: '16px', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'  }}>×</button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
