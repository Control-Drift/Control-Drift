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
import { ChevronDown, ChevronRight, Trash2, Crosshair, Shield, Upload, Info, CheckCircle2, AlertTriangle, Copy, Check, History, Clock, RotateCcw, X } from 'lucide-react';
import EventTypeDropdown from '../dropdowns/EventTypeDropdown';
import OutcomeDropdown from '../dropdowns/OutcomeDropdown';
import CoverageRatingDropdown from '../dropdowns/CoverageRatingDropdown';
import SeverityDropdown from '../dropdowns/SeverityDropdown';
import EventTTPDropdown from '../dropdowns/EventTTPDropdown';
import SecurityControlsDropdown from '../dropdowns/SecurityControlsDropdown';
import { getOutcomeCascadedFields } from '../../lib/simulationAutomation';

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
    const [copiedCode, setCopiedCode] = useState(false);
    const [isEditingTime, setIsEditingTime] = useState(false);

    const formatTimeDisplay = (ts) => {
        if (!ts) return '';
        const d = new Date(ts);
        if (!isNaN(d.getTime())) {
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
        }
        return String(ts);
    };
    const eventColor = proc.coverageRating === 'Optimal' ? 'var(--success)' : proc.coverageRating === 'Partial' ? 'var(--warning)' : proc.coverageRating === 'Minimal' ? 'var(--minimal)' : proc.coverageRating === 'None' ? 'var(--danger)' : 'var(--accent-primary)';

    const handleBaselineHeld = (e) => {
        e.stopPropagation();
        const targetOutcome = proc.expectedOutcome || 'Alerted';
        const cascaded = getOutcomeCascadedFields(targetOutcome, proc.severity);
        updateProcedure(proc.id, 'outcome', targetOutcome);
        updateProcedure(proc.id, 'coverageRating', cascaded.coverageRating);
        updateProcedure(proc.id, 'severity', cascaded.severity);
        if (!proc.detNotes || !proc.detNotes.trim()) {
            updateProcedure(
                proc.id,
                'detNotes',
                `Baseline held (${targetOutcome}) — verified on ${new Date().toLocaleDateString()}`
            );
        }
    };

    const handleDriftDetected = (e) => {
        e.stopPropagation();
        updateProcedure(proc.id, 'outcome', 'Missed');
        updateProcedure(proc.id, 'coverageRating', 'None');
        updateProcedure(proc.id, 'severity', 'High');
        if (!proc.detNotes || !proc.detNotes.trim()) {
            updateProcedure(
                proc.id,
                'detNotes',
                `Control drift detected: Expected ${proc.expectedOutcome || 'Alerted'}, but execution was Missed.`
            );
        }
    };

    const handleCopyPayload = (e) => {
        e.stopPropagation();
        if (!proc.payloadCode) return;
        navigator.clipboard?.writeText(proc.payloadCode);
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 1800);
    };

    const isBaselineMatched =
        !isManual &&
        proc.expectedOutcome &&
        proc.outcome &&
        proc.outcome === proc.expectedOutcome;

    return (
        <div className="glass-panel" style={{  padding: isCollapsed ? '12px 20px' : '16px 20px', background: 'var(--glass-bg)', flexShrink: 0, borderLeft: `4px solid ${eventColor}`, position: 'relative', zIndex: totalCards - index, borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px', transition: 'all 0.3s ease', boxShadow: `-12px 0 12px -12px ${eventColor}, 0 8px 32px rgba(0,0,0,0.2)`  }}>
            {/* Header Row */}
            <div style={{  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '15px', flexWrap: 'wrap'  }}>
                <div style={{  display: 'flex', gap: '15px', alignItems: 'center', flex: 1, minWidth: '240px'  }}>
                    <div style={{  width: '160px'  }}>
                        <EventTypeDropdown 
                            value={proc.eventType || 'Payload'} 
                            onChange={(val) => updateProcedure(proc.id, 'eventType', val)} 
                        />
                    </div>
                    <div style={{  flex: 1, position: 'relative', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap'  }}>
                        <input onKeyDown={e => e.stopPropagation()} maxLength={100} className="ai-input" style={{  flex: 1, minWidth: '160px', margin: 0, background: (showNameErrors && (!proc.name || proc.name.trim() === '' || /^Procedure \d+$/.test(proc.name.trim()))) ? 'rgba(239, 68, 68, 0.1)' : 'transparent', border: 'none', borderBottom: (showNameErrors && (!proc.name || proc.name.trim() === '' || /^Procedure \d+$/.test(proc.name.trim()))) ? '1px dashed var(--danger)' : '1px dashed var(--glass-border)', fontSize: '1.1rem', color: 'var(--text-primary)', padding: '6px 8px', outline: 'none', fontWeight: 'bold', borderRadius: '4px 4px 0 0', transition: 'all 0.3s ease'  }} 
                               value={proc.name || ''} 
                               onChange={(e) => {
                                   updateProcedure(proc.id, 'name', e.target.value);
                                   if (showNameErrors) setShowNameErrors(false);
                               }} 
                               placeholder={proc.eventType === 'Payload' || !proc.eventType ? "Payload Name" : "Procedure Name"} />

                        {proc.isBaselinePrefilled && (
                            <span
                                title={proc.baselineSource ? `Pre-filled from historical run: ${proc.baselineSource}` : 'Pre-filled from historical TTP baseline'}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    padding: '3px 8px',
                                    borderRadius: '10px',
                                    background: 'rgba(139, 92, 246, 0.14)',
                                    border: '1px solid rgba(139, 92, 246, 0.35)',
                                    color: '#c4b5fd',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                <History size={11} />
                                Baseline Memory
                            </span>
                        )}

                        {proc.isHarnessImported && proc.harnessConfidence && (
                            (() => {
                                const isConfirmed = proc.harnessConfidence === 'Host-Confirmed';
                                const isErr = proc.harnessConfidence === 'Prerequisite-Missing' || proc.harnessConfidence === 'Timed-Out';
                                const badgeBg = isConfirmed
                                    ? 'rgba(6, 182, 212, 0.14)'
                                    : isErr
                                    ? 'rgba(239, 68, 68, 0.14)'
                                    : 'rgba(245, 158, 11, 0.16)';
                                const badgeBorder = isConfirmed
                                    ? 'rgba(6, 182, 212, 0.4)'
                                    : isErr
                                    ? 'rgba(239, 68, 68, 0.4)'
                                    : 'rgba(245, 158, 11, 0.45)';
                                const badgeColor = isConfirmed
                                    ? '#22d3ee'
                                    : isErr
                                    ? '#f87171'
                                    : '#fbbf24';
                                const badgeLabel = isConfirmed
                                    ? 'Host Block Confirmed ✓'
                                    : isErr
                                    ? `Exec Error (${proc.harnessConfidence})`
                                    : 'Inferred • Verify SIEM ⚠';
                                const badgeTitle = isConfirmed
                                    ? 'The self-logging harness confirmed this payload was actively blocked on the endpoint (OS/EDR/AMSI).'
                                    : isErr
                                    ? 'This step failed due to a missing binary, syntax error, or timeout—not a security control block.'
                                    : 'This command ran unblocked on the endpoint (Exit Code 0). Because a local script cannot see cloud SIEM/EDR alerts, please verify whether your SOC console alerted or missed it.';
                                return (
                                    <span
                                        title={badgeTitle}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            fontSize: '0.68rem',
                                            fontWeight: 700,
                                            padding: '3px 8px',
                                            borderRadius: '10px',
                                            background: badgeBg,
                                            border: `1px solid ${badgeBorder}`,
                                            color: badgeColor,
                                            whiteSpace: 'nowrap',
                                            cursor: 'help'
                                        }}
                                    >
                                        {badgeLabel}
                                    </span>
                                );
                            })()
                        )}

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
                <div style={{  display: 'flex', gap: '8px', alignItems: 'center'  }}>
                    {!isManual && proc.isDecayRetest && proc.expectedOutcome && (
                        <>
                            <button
                                type="button"
                                onClick={handleBaselineHeld}
                                title={`1-Click Confirm: Actual Outcome matched Expected Outcome (${proc.expectedOutcome})`}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    padding: '5px 10px',
                                    borderRadius: '6px',
                                    fontSize: '0.74rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    background: isBaselineMatched ? 'rgba(16, 185, 129, 0.25)' : 'rgba(16, 185, 129, 0.12)',
                                    border: `1px solid ${isBaselineMatched ? '#10b981' : 'rgba(16, 185, 129, 0.4)'}`,
                                    color: '#34d399',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <CheckCircle2 size={13} />
                                <span>{isBaselineMatched ? `Held (${proc.expectedOutcome})` : `Baseline Held ✓`}</span>
                            </button>
                            {proc.expectedOutcome !== 'Missed' && (
                                <button
                                    type="button"
                                    onClick={handleDriftDetected}
                                    title="1-Click Flag: Control failed to block/alert (Drift Detected)"
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        padding: '5px 9px',
                                        borderRadius: '6px',
                                        fontSize: '0.72rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        background: proc.outcome === 'Missed' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(239, 68, 68, 0.1)',
                                        border: `1px solid ${proc.outcome === 'Missed' ? '#ef4444' : 'rgba(239, 68, 68, 0.35)'}`,
                                        color: '#f87171',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <AlertTriangle size={12} />
                                    <span>Drifted</span>
                                </button>
                            )}
                        </>
                    )}
                    {proc.timestamp ? (
                        <div 
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '2px 6px',
                                borderRadius: '6px',
                                background: 'rgba(56, 189, 248, 0.12)',
                                border: '1px solid rgba(56, 189, 248, 0.35)',
                                color: '#38bdf8',
                                fontSize: '0.72rem',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {isEditingTime ? (
                                <input
                                    type="time"
                                    step="1"
                                    autoFocus
                                    defaultValue={formatTimeDisplay(proc.timestamp)}
                                    onBlur={(e) => {
                                        setIsEditingTime(false);
                                        if (e.target.value) {
                                            const parts = e.target.value.split(':');
                                            const d = new Date(proc.timestamp || Date.now());
                                            if (parts[0] !== undefined) d.setHours(parseInt(parts[0], 10));
                                            if (parts[1] !== undefined) d.setMinutes(parseInt(parts[1], 10));
                                            if (parts[2] !== undefined) d.setSeconds(parseInt(parts[2], 10));
                                            updateProcedure(proc.id, 'timestamp', d.toISOString());
                                        }
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') e.target.blur();
                                        if (e.key === 'Escape') setIsEditingTime(false);
                                    }}
                                    style={{
                                        background: 'rgba(0, 0, 0, 0.6)',
                                        border: '1px solid #38bdf8',
                                        color: '#38bdf8',
                                        borderRadius: '4px',
                                        fontSize: '0.72rem',
                                        padding: '1px 4px',
                                        outline: 'none',
                                        fontFamily: 'monospace'
                                    }}
                                />
                            ) : (
                                <span
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsEditingTime(true);
                                    }}
                                    title={`Execution Timestamp: ${new Date(proc.timestamp).toLocaleString()}\nClick to edit time manually`}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        cursor: 'pointer',
                                        fontWeight: 700,
                                        fontFamily: 'monospace'
                                    }}
                                >
                                    <Clock size={11} color="#38bdf8" />
                                    {formatTimeDisplay(proc.timestamp)}
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    updateProcedure(proc.id, 'timestamp', new Date().toISOString());
                                }}
                                title="Re-stamp to current time (Now)"
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'rgba(56, 189, 248, 0.75)',
                                    cursor: 'pointer',
                                    padding: '2px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    borderRadius: '3px'
                                }}
                                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                                onMouseLeave={e => e.currentTarget.style.color = 'rgba(56, 189, 248, 0.75)'}
                            >
                                <RotateCcw size={10} />
                            </button>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsEditingTime(false);
                                    updateProcedure(proc.id, 'timestamp', '');
                                }}
                                title="Clear timestamp"
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'rgba(56, 189, 248, 0.75)',
                                    cursor: 'pointer',
                                    padding: '2px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    borderRadius: '3px'
                                }}
                                onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                                onMouseLeave={e => e.currentTarget.style.color = 'rgba(56, 189, 248, 0.75)'}
                            >
                                <X size={10} />
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                updateProcedure(proc.id, 'timestamp', new Date().toISOString());
                            }}
                            title="Stamp execution time (Now)"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                background: 'rgba(255, 255, 255, 0.04)',
                                border: '1px dashed var(--glass-border)',
                                color: 'var(--text-muted)',
                                transition: 'all 0.2s ease',
                                whiteSpace: 'nowrap'
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.color = '#38bdf8';
                                e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.4)';
                                e.currentTarget.style.background = 'rgba(56, 189, 248, 0.08)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.color = 'var(--text-muted)';
                                e.currentTarget.style.borderColor = 'var(--glass-border)';
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                            }}
                        >
                            <Clock size={11} />
                            <span>Stamp Time</span>
                        </button>
                    )}
                    <button onClick={onToggleCollapse} style={{  background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center', borderRadius: '6px', transition: 'all 0.2s'  }} onMouseEnter={e => {e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}} onMouseLeave={e => {e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'}} title={isCollapsed ? "Expand" : "Collapse"}>
                        {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                    </button>
                    <button onClick={() => removeProcedure(proc.id)} style={{  background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center', borderRadius: '6px', transition: 'all 0.2s'  }} onMouseEnter={e => {e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}} onMouseLeave={e => {e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'}} title="Remove Procedure">
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
                        <div style={{ position: 'relative' }}>
                            <textarea onKeyDown={e => e.stopPropagation()} className="ai-input" style={{  width: '100%', boxSizing: 'border-box', background: 'rgba(5, 5, 10, 0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--accent-secondary)', padding: '12px 85px 12px 12px', outline: 'none', minHeight: '60px', fontFamily: 'monospace', resize: 'vertical'  }} 
                                   value={proc.payloadCode || ''} 
                                   onChange={e => updateProcedure(proc.id, 'payloadCode', e.target.value)} 
                                   placeholder="Payload Code" />
                            {proc.payloadCode && proc.payloadCode.trim() && (
                                <button
                                    type="button"
                                    onClick={handleCopyPayload}
                                    title="Copy command to clipboard"
                                    style={{
                                        position: 'absolute',
                                        top: '8px',
                                        right: '10px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        padding: '4px 8px',
                                        borderRadius: '6px',
                                        fontSize: '0.7rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        background: copiedCode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.06)',
                                        border: `1px solid ${copiedCode ? 'rgba(16, 185, 129, 0.4)' : 'var(--glass-border)'}`,
                                        color: copiedCode ? '#34d399' : 'var(--text-secondary)'
                                    }}
                                >
                                    {copiedCode ? <Check size={12} /> : <Copy size={12} />}
                                    <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                                </button>
                            )}
                        </div>
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
