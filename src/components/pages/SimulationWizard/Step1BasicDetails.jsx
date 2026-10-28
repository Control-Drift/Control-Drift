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
import { RedBlueSwordsIcon } from '../../ui/CustomIcons';
import { Target, Globe, Tag, Users, Flag, Crosshair, Shield, Zap, ChevronDown, ChevronRight, CheckSquare, Square, X, AlertTriangle, Sparkles, Loader2, Info, Swords, Search, CornerDownRight, Play, Lock, ShieldAlert, CloudLightning, FileWarning, Upload, Layers } from 'lucide-react';
import BlackHoleIcon from '../../ui/BlackHoleIcon';
import InlineEnvironmentDropdown from '../../dropdowns/InlineEnvironmentDropdown';
import InlineTagDropdown from '../../dropdowns/InlineTagDropdown';
import RichMarkdownEditor from '../../ui/RichMarkdownEditor';
import { useAppContext } from '../../../AppContext';
import { parseAttackNavigatorLayer } from '../../../lib/attackNavigator';
import {
    classifyTtpOperationalRole,
    clusterTTPsIntoCompoundEvents,
    getMissingRoleSuggestionsForEvent,
    getRecommendedChainForCustomTtp
} from '../../../lib/mitreStixCti';

export default function Step1BasicDetails({
    simulationDetails,
    setSimulationDetails,
    nameConflict,
    setNameConflict,
    simulationSummaries,
    addToast,
    openDropdownId,
    setOpenDropdownId,
    isAiActive,
    mapObjectivesToTTPs,
    isMappingTTPs,
    searchTerm,
    setSearchTerm,
    isMitreLoading,
    activeMapTactic,
    setActiveMapTactic,
    mitreData,
    KILL_CHAIN_ORDER,
    selectedTTPs,
    setSelectedTTPs,
    activeMapTechnique,
    setActiveMapTechnique,
    TACTIC_ICONS,
    setTestResults
}) {
    const { gaps, events } = useAppContext();
    const layerFileInputRef = useRef(null);
    const [importedLayer, setImportedLayer] = useState(null);
    const [layerScopeMode, setLayerScopeMode] = useState('delta');

    const toggleTTP = (techId, techName) => {
        setSelectedTTPs(prev => {
            if (prev.some(t => t.id === techId)) {
                return prev.filter(t => t.id !== techId);
            } else {
                return [...prev, { id: techId, name: techName }];
            }
        });
    };

    const addCompanionTtp = (cand) => {
        if (!cand?.id) return;
        setSelectedTTPs(prev => {
            if (prev.some(t => t.id === cand.id)) return prev;
            return [...prev, { id: cand.id, name: cand.name }];
        });
        const roleInfo = cand.operationalRole || classifyTtpOperationalRole(cand);
        addToast(`Added ${roleInfo.shortLabel}: ${cand.id} (${cand.name})`, 'success');
    };

    const selectWithCompanionChain = (seedTech) => {
        if (!seedTech?.id) return;
        const chain = getRecommendedChainForCustomTtp(seedTech, mitreData, selectedTTPs);
        let addedCount = 0;
        setSelectedTTPs(prev => {
            const next = [...prev];
            chain.forEach(item => {
                if (!next.some(t => t.id === item.id)) {
                    next.push({ id: item.id, name: item.name });
                    addedCount++;
                }
            });
            return next;
        });
        if (addedCount > 0) {
            addToast(`Scoped ${seedTech.id} with its companion process chain (+${addedCount} TTP${addedCount === 1 ? '' : 's'}).`, 'success');
        }
    };

    const completeEventChain = (ev) => {
        const suggestions = getMissingRoleSuggestionsForEvent(ev, mitreData, selectedTTPs);
        const toAdd = Object.values(suggestions).filter(Boolean);
        if (toAdd.length === 0) return;
        setSelectedTTPs(prev => {
            const next = [...prev];
            toAdd.forEach(item => {
                if (!next.some(t => t.id === item.id)) {
                    next.push({ id: item.id, name: item.name });
                }
            });
            return next;
        });
        addToast(`Added ${toAdd.length} companion component${toAdd.length === 1 ? '' : 's'} to Phase ${ev.eventNumber}.`, 'success');
    };

    const clusteredScope = clusterTTPsIntoCompoundEvents(
        selectedTTPs,
        simulationDetails?.name?.trim() || 'Custom'
    );

    const applyLayerSelection = (analysis, mode) => {
        setLayerScopeMode(mode);
        const list =
            mode === 'delta' && analysis.deltaTTPs.length > 0
                ? analysis.deltaTTPs
                : analysis.allTTPs;
        setSelectedTTPs(list.map(t => ({ id: t.id, name: t.name })));
    };

    const handleLayerUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const analysis = parseAttackNavigatorLayer(
                    ev.target.result,
                    mitreData,
                    gaps,
                    simulationSummaries,
                    events
                );
                setImportedLayer(analysis);
                const defaultMode = analysis.deltaTTPs.length > 0 ? 'delta' : 'all';
                applyLayerSelection(analysis, defaultMode);

                setSimulationDetails(prev => ({
                    ...prev,
                    name: prev.name?.trim() ? prev.name : `${analysis.layerName} Validation`,
                    goals: prev.goals?.trim()
                        ? prev.goals
                        : analysis.description ||
                          `Empirical validation scoped from MITRE ATT&CK Navigator Layer "${analysis.layerName}" (Readiness Score: ${analysis.readinessScore}%; ${analysis.deltaTTPs.length} delta TTPs across ${analysis.total} total techniques).`
                }));

                addToast(
                    `Imported "${analysis.layerName}" — Scoped ${
                        defaultMode === 'delta' ? analysis.deltaTTPs.length : analysis.total
                    } TTPs (Readiness: ${analysis.readinessScore}%).`,
                    'success'
                );
            } catch (err) {
                addToast(err.message || 'Failed to parse ATT&CK Navigator JSON layer.', 'error');
            } finally {
                if (layerFileInputRef.current) layerFileInputRef.current.value = '';
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="animate-fade-in" style={{  overflowY: 'auto', flex: 1, paddingRight: '10px'  }}>


            <div className="responsive-row" style={{ marginBottom: '25px', position: 'relative', zIndex: 10 }}>
               {/* Left Column: Context & Logistics */}
               <div className="glass-panel" style={{  flex: '0 0 45%', display: 'flex', flexDirection: 'column', gap: '20px', padding: '25px'  }}>
                 <div>
                   <label style={{  display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 'bold', marginBottom: '10px'  }}>
                       <Flag size={16} color="var(--accent-primary)" /> Simulation Name
                   </label>
                   <input onKeyDown={e => e.stopPropagation()} className="ai-input" style={{  width: '100%', boxSizing: 'border-box', fontSize: '1rem', padding: '10px', borderColor: nameConflict ? 'var(--danger)' : undefined  }} placeholder="e.g., APT29 Emulation" value={simulationDetails.name} onChange={e => {
                       setSimulationDetails({...simulationDetails, name: e.target.value});
                       if (nameConflict) setNameConflict(false);
                   }} onBlur={() => {
                       if (simulationDetails.name.trim() && simulationSummaries && simulationSummaries[simulationDetails.name.trim()]) {
                           setNameConflict(true);
                           addToast("A simulation with this name already exists. Please choose a unique name.", 'error');
                       }
                   }} />
                 </div>

                 <div style={{  height: '1px', background: 'var(--glass-border)', margin: '5px 0'  }} />
                 
                 <div>
                   <label style={{  display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 'bold', marginBottom: '10px'  }}>
                       <Globe size={16} color="var(--accent-secondary)" /> Target Environment
                       <span title="Differentiates where this TTP was executed so coverage can be tracked per-environment on the Global Dashboard.">
                           <Info size={14} color="var(--text-muted)" style={{  cursor: 'help'  }} />
                       </span>
                   </label>
                   <InlineEnvironmentDropdown value={simulationDetails.environmentCategory} onChange={val => setSimulationDetails({...simulationDetails, environmentCategory: val})} />
                 </div>

                 <div style={{  height: '1px', background: 'var(--glass-border)', margin: '5px 0'  }} />

                 <div>
                   <label style={{  display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 'bold', marginBottom: '10px'  }}>
                       <Tag size={16} color="var(--accent-secondary)" /> Tags
                       <span title="Tag this event to group it into a larger campaign for tracking over time.">
                           <Info size={14} color="var(--text-muted)" style={{  cursor: 'help'  }} />
                       </span>
                   </label>
                   <InlineTagDropdown value={simulationDetails.tags} onChange={val => setSimulationDetails({...simulationDetails, tags: val})} />
                 </div>

                 <div style={{  height: '1px', background: 'var(--glass-border)', margin: '5px 0'  }} />
                 
                 <div>
                   <div style={{  display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'  }}>
                     <label style={{  display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 'bold', margin: 0  }}>
                         <Users size={16} color="var(--accent-primary)" /> Participants
                     </label>
                     <button type="button" className="btn hover-lift" onClick={() => setSimulationDetails(prev => ({...prev, participants: [...prev.participants, { id: Date.now(), name: '', role: 'Purple Team' }]}))} style={{  background: 'transparent', border: '1px dashed var(--glass-border)', color: 'var(--text-primary)', padding: '4px 10px', fontSize: '0.75rem', borderRadius: '20px'  }}>+ Add Participant</button>
                   </div>
                   <div style={{  display: 'flex', flexDirection: 'column', gap: '10px'  }}>
                     {openDropdownId && (
                        <div 
                          style={{  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 90  }} 
                          onClick={() => setOpenDropdownId(null)} 
                        />
                     )}
                     {simulationDetails.participants.map(p => (
                       <div key={p.id} className="glass-panel" style={{  display: 'flex', gap: '10px', alignItems: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', padding: '10px', borderRadius: '8px', zIndex: openDropdownId === p.id ? 95 : 1  }}>
                         <input onKeyDown={e => e.stopPropagation()} className="ai-input" style={{  flex: 1, padding: '8px 12px', fontSize: '0.85rem', background: 'transparent', border: 'none'  }} placeholder="Name" value={p.name} onChange={e => {
                            const newP = simulationDetails.participants.map(pt => pt.id === p.id ? {...pt, name: e.target.value} : pt);
                            setSimulationDetails({...simulationDetails, participants: newP});
                         }} />
                         <div style={{  position: 'relative'  }}>
                            <button 
                              onClick={() => setOpenDropdownId(openDropdownId === p.id ? null : p.id)}
                              style={{  
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '8px', 
                                width: '150px', 
                                padding: '8px 12px', 
                                fontSize: '0.85rem', 
                                cursor: 'pointer', 
                                fontWeight: 'bold', 
                                background: 'rgba(255,255,255,0.05)', 
                                border: '1px solid var(--glass-border)', 
                                borderRadius: '6px',
                                color: p.role === 'Red Team' ? '#ef4444' : p.role === 'Blue Team' ? '#3b82f6' : '#c084fc',
                                justifyContent: 'space-between'
                               }}>
                              <span style={{  display: 'flex', alignItems: 'center', gap: '6px'  }}>
                                {p.role === 'Red Team' && <Crosshair size={14} />}
                                {p.role === 'Blue Team' && <Shield size={14} />}
                                {p.role === 'Purple Team' && <Zap size={14} />}
                                {p.role}
                              </span>
                              <ChevronDown size={14} color="var(--text-muted)" />
                            </button>
                            
                            {openDropdownId === p.id && (
                              <div style={{ 
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                width: '100%',
                                marginTop: '4px',
                                background: 'rgba(11, 12, 16, 0.95)',
                                backdropFilter: 'blur(10px)',
                                border: '1px solid var(--accent-primary)',
                                borderRadius: '6px',
                                boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
                                zIndex: 100,
                                overflow: 'hidden'
                               }}>
                                {['Purple Team', 'Red Team', 'Blue Team'].map(roleOption => (
                                  <div 
                                    key={roleOption}
                                    className="hover-lift"
                                    onClick={() => {
                                      const newP = simulationDetails.participants.map(pt => pt.id === p.id ? {...pt, role: roleOption} : pt);
                                      setSimulationDetails({...simulationDetails, participants: newP});
                                      setOpenDropdownId(null);
                                    }}
                                    style={{ 
                                      padding: '10px 12px',
                                      fontSize: '0.85rem',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      color: roleOption === 'Red Team' ? '#ef4444' : roleOption === 'Blue Team' ? '#3b82f6' : '#c084fc',
                                      background: p.role === roleOption ? 'rgba(255,255,255,0.1)' : 'transparent',
                                      borderBottom: roleOption !== 'Blue Team' ? '1px solid rgba(255,255,255,0.05)' : 'none'
                                     }}
                                  >
                                    {roleOption === 'Red Team' && <Crosshair size={14} />}
                                    {roleOption === 'Blue Team' && <Shield size={14} />}
                                    {roleOption === 'Purple Team' && <Zap size={14} />}
                                    {roleOption}
                                  </div>
                                ))}
                              </div>
                            )}
                         </div>
                         <button className="hover-lift" onClick={() => {
                            const newP = simulationDetails.participants?.filter(pt => pt.id !== p.id);
                            setSimulationDetails({...simulationDetails, participants: newP});
                         }} style={{  background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center'  }} title="Remove Participant"><X size={14}/></button>
                       </div>
                     ))}
                     {simulationDetails.participants.length === 0 && (
                        <div style={{  fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '10px', textAlign: 'center', background: 'rgba(0,0,0,0.1)', borderRadius: '8px', border: '1px dashed var(--glass-border)'  }}>No participants added.</div>
                     )}
                   </div>
                 </div>
               </div>

               {/* Right Column: Narrative Scope */}
               <div className="glass-panel" style={{  flex: '1', display: 'flex', flexDirection: 'column', gap: '20px', padding: '25px'  }}>
                 <div style={{  flex: 1, display: 'flex', flexDirection: 'column'  }}>
                   <label style={{  display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 'bold', marginBottom: '10px'  }}>
                       <RedBlueSwordsIcon size={16} style={{ marginRight: '8px' }} /> Simulation Scenario
                       <span title="Describe the attack scenario and its primary objectives. This guides the AI and frames your executive reports.">
                           <Info size={14} color="var(--text-muted)" style={{  cursor: 'help'  }} />
                       </span>
                   </label>
                   <div style={{  flex: 1, display: 'flex', flexDirection: 'column'  }}>
                     <RichMarkdownEditor minHeight="150px" placeholder="e.g., Emulate an adversary dumping LSASS memory to validate if our EDR telemetry can successfully detect and block credential harvesting." value={simulationDetails.goals} onChange={val => setSimulationDetails({...simulationDetails, goals: val})} />
                   </div>
                 </div>
               </div>
            </div>

            {/* Imported ATT&CK Navigator Readiness Delta Banner */}
            {importedLayer && (
                <div
                    className="glass-panel animate-fade-in"
                    style={{
                        marginBottom: '16px',
                        padding: '14px 18px',
                        borderRadius: '10px',
                        background: 'rgba(6, 182, 212, 0.08)',
                        border: '1px solid rgba(34, 211, 238, 0.35)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '12px'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <Layers size={18} color="#22d3ee" />
                        <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                ATT&CK Layer: {importedLayer.layerName}{' '}
                                <span style={{ color: '#22d3ee', marginLeft: '6px' }}>
                                    (Readiness: {importedLayer.readinessScore}%)
                                </span>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                <span style={{ color: '#34d399' }}>✓ Covered & Fresh: {importedLayer.coveredFresh.length}</span>
                                <span style={{ color: '#facc15' }}>⟳ Decayed/Aging: {importedLayer.decayed.length}</span>
                                <span style={{ color: '#f87171' }}>⚠ Open Gaps: {importedLayer.exposedGap.length}</span>
                                <span style={{ color: '#a78bfa' }}>● Blind Spots: {importedLayer.untested.length}</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {importedLayer.deltaTTPs.length > 0 && (
                            <button
                                type="button"
                                onClick={() => applyLayerSelection(importedLayer, 'delta')}
                                className="btn"
                                style={{
                                    padding: '5px 12px',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    borderRadius: '16px',
                                    background:
                                        layerScopeMode === 'delta'
                                            ? 'rgba(34, 211, 238, 0.22)'
                                            : 'rgba(255, 255, 255, 0.05)',
                                    border: `1px solid ${
                                        layerScopeMode === 'delta' ? '#22d3ee' : 'var(--glass-border)'
                                    }`,
                                    color: layerScopeMode === 'delta' ? '#22d3ee' : 'var(--text-secondary)',
                                    cursor: 'pointer'
                                }}
                            >
                                Delta Only ({importedLayer.deltaTTPs.length} TTPs)
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => applyLayerSelection(importedLayer, 'all')}
                            className="btn"
                            style={{
                                padding: '5px 12px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                borderRadius: '16px',
                                background:
                                    layerScopeMode === 'all'
                                        ? 'rgba(59, 130, 246, 0.22)'
                                        : 'rgba(255, 255, 255, 0.05)',
                                    border: `1px solid ${
                                        layerScopeMode === 'all' ? '#60a5fa' : 'var(--glass-border)'
                                    }`,
                                    color: layerScopeMode === 'all' ? '#60a5fa' : 'var(--text-secondary)',
                                    cursor: 'pointer'
                            }}
                        >
                            All Layer TTPs ({importedLayer.total})
                        </button>
                        <button
                            type="button"
                            onClick={() => setImportedLayer(null)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: '4px'
                            }}
                            title="Dismiss layer summary"
                        >
                            <X size={15} />
                        </button>
                    </div>
                </div>
            )}

            <div style={{  display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px'  }}>
              <div style={{  display: 'flex', flexDirection: 'column'  }}>
                 <p style={{  margin: 0  }}>Select MITRE ATT&CK techniques</p>
                 {!!isAiActive && (
                    <span style={{  fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px'  }}>
                        <AlertTriangle size={12} style={{  display: 'inline', marginRight: '4px', verticalAlign: 'text-top'  }} />
                        AI-mapped TTPs may be inaccurate. Please verify selections.
                    </span>
                 )}
              </div>
              <div style={{  display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center'  }}>
                {selectedTTPs.length > 0 && (
                  <button className="btn hover-lift" onClick={() => setSelectedTTPs([])} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.3)' }} title="Clear all selected TTPs">
                    <X size={16} /> Clear All ({selectedTTPs.length})
                  </button>
                )}

                <button
                    type="button"
                    className="btn hover-lift"
                    onClick={() => layerFileInputRef.current?.click()}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '7px',
                        background: 'rgba(6, 182, 212, 0.12)',
                        color: '#22d3ee',
                        border: '1px solid rgba(6, 182, 212, 0.35)',
                        fontWeight: 700,
                        fontSize: '0.82rem'
                    }}
                    title="Upload a MITRE ATT&CK Navigator Layer (.json) to automatically scope techniques and compare against your current posture"
                >
                    <Upload size={15} /> Import ATT&CK Layer (.json)
                </button>
                <input
                    ref={layerFileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleLayerUpload}
                    style={{ display: 'none' }}
                />

                {!!isAiActive && (
                  <button className="btn-premium-ai" onClick={mapObjectivesToTTPs} disabled={isMappingTTPs} style={{  display: 'flex', alignItems: 'center', gap: '8px'  }}>
                     {isMappingTTPs ? <Loader2 size={16} style={{  animation: 'spin 1s linear infinite'  }} /> : <BlackHoleIcon size={16} />} {isMappingTTPs ? 'Mapping...' : 'Auto-Map TTPs'}
                  </button>
                )}
                <div style={{  position: 'relative', width: '250px'  }}>
                  <Search size={16} style={{  position: 'absolute', left: '10px', top: '10px', color: 'var(--text-secondary)'  }} />
                  <input 
                    onKeyDown={e => e.stopPropagation()}
                    className="ai-input" 
                    style={{  width: '100%', boxSizing: 'border-box', paddingLeft: '35px'  }} 
                    placeholder="Search TTPs..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </div>

             {isMitreLoading ? (
               <div style={{  display: 'flex', justifyContent: 'center', padding: '40px', color: 'var(--text-secondary)'  }}>
                 <span style={{  animation: 'pulse 2s infinite'  }}>Downloading official STIX framework from MITRE...</span>
               </div>
             ) : (
                 <>
                  {selectedTTPs.length > 0 && (() => {
                      const isAtomicMode = simulationDetails?.executionMethodology === 'atomic';
                      return (
                      <div
                          className="glass-panel animate-fade-in"
                          style={{
                              marginBottom: '14px',
                              padding: '12px 16px',
                              borderRadius: '10px',
                              background: 'rgba(15, 23, 42, 0.55)',
                              border: isAtomicMode
                                  ? '1px solid rgba(251, 191, 36, 0.28)'
                                  : '1px solid rgba(255, 255, 255, 0.08)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '10px'
                          }}
                      >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.3px' }}>
                                      {isAtomicMode
                                          ? `Scoped Atomic 1:1 Validation (${selectedTTPs.length} TTP${selectedTTPs.length === 1 ? '' : 's'} · ${selectedTTPs.length} Isolated Test${selectedTTPs.length === 1 ? '' : 's'})`
                                          : `Scoped Operational Chain (${selectedTTPs.length} TTP${selectedTTPs.length === 1 ? '' : 's'} · {clusteredScope.compoundEvents.length} Phase${clusteredScope.compoundEvents.length === 1 ? '' : 's'})`.replace('{clusteredScope.compoundEvents.length}', clusteredScope.compoundEvents.length)}
                                  </span>
                                  <span
                                      style={{
                                          fontSize: '0.68rem',
                                          color: 'var(--text-muted)',
                                          padding: '2px 8px',
                                          borderRadius: '10px',
                                          background: 'rgba(255, 255, 255, 0.04)',
                                          border: '1px solid rgba(255, 255, 255, 0.07)'
                                      }}
                                  >
                                      {isAtomicMode
                                          ? '1 TTP = 1 standalone script & 1 dedicated Event Card for isolated rule testing'
                                          : 'All 4 roles are optional — combine 1 to 4 components per phase'}
                                  </span>
                              </div>

                              {/* Execution Methodology Segmented Toggle */}
                              <div
                                  style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      padding: '2px',
                                      borderRadius: '8px',
                                      background: 'rgba(6, 9, 16, 0.75)',
                                      border: '1px solid rgba(255, 255, 255, 0.1)'
                                  }}
                              >
                                  <button
                                      type="button"
                                      onClick={() =>
                                          setSimulationDetails(prev => ({
                                              ...prev,
                                              executionMethodology: 'compound'
                                          }))
                                      }
                                      title="Compound Adversary Emulation: Bundles Conduits, Precursors, and Modifiers into correlated Anchor Objective phases"
                                      style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '5px',
                                          padding: '4px 10px',
                                          borderRadius: '6px',
                                          fontSize: '0.68rem',
                                          fontWeight: 700,
                                          cursor: 'pointer',
                                          border: !isAtomicMode ? '1px solid rgba(34, 211, 238, 0.45)' : '1px solid transparent',
                                          background: !isAtomicMode ? 'rgba(6, 182, 212, 0.18)' : 'transparent',
                                          color: !isAtomicMode ? '#22d3ee' : 'var(--text-muted)',
                                          transition: 'all 0.18s ease'
                                      }}
                                  >
                                      <Layers size={12} /> Compound Chain
                                  </button>
                                  <button
                                      type="button"
                                      onClick={() =>
                                          setSimulationDetails(prev => ({
                                              ...prev,
                                              executionMethodology: 'atomic'
                                          }))
                                      }
                                      title="Atomic 1:1 Control Validation: Keeps every selected TTP strictly isolated (1 TTP = 1 standalone script & 1 Event Card)"
                                      style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '5px',
                                          padding: '4px 10px',
                                          borderRadius: '6px',
                                          fontSize: '0.68rem',
                                          fontWeight: 700,
                                          cursor: 'pointer',
                                          border: isAtomicMode ? '1px solid rgba(251, 191, 36, 0.5)' : '1px solid transparent',
                                          background: isAtomicMode ? 'rgba(245, 158, 11, 0.18)' : 'transparent',
                                          color: isAtomicMode ? '#fbbf24' : 'var(--text-muted)',
                                          transition: 'all 0.18s ease'
                                      }}
                                  >
                                      <Zap size={12} /> Atomic 1:1
                                  </button>
                              </div>
                          </div>

                          {isAtomicMode ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                  {selectedTTPs.map((item, idx) => (
                                      <div
                                          key={item.id}
                                          style={{
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '6px',
                                              padding: '5px 10px',
                                              borderRadius: '7px',
                                              background: 'rgba(245, 158, 11, 0.08)',
                                              border: '1px solid rgba(251, 191, 36, 0.3)',
                                              fontSize: '0.72rem'
                                          }}
                                      >
                                          <span style={{ fontSize: '0.63rem', fontWeight: 800, color: '#fbbf24', padding: '1px 5px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.16)' }}>
                                              Test {idx + 1}
                                          </span>
                                          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#fde68a' }}>
                                              {item.id}
                                          </span>
                                          <span style={{ color: 'var(--text-primary)', fontWeight: 600, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                              {item.name}
                                          </span>
                                          <button
                                              type="button"
                                              onClick={() => toggleTTP(item.id, item.name)}
                                              style={{
                                                  background: 'transparent',
                                                  border: 'none',
                                                  color: 'var(--text-muted)',
                                                  cursor: 'pointer',
                                                  padding: 0,
                                                  display: 'inline-flex',
                                                  alignItems: 'center'
                                              }}
                                              title={`Remove ${item.id}`}
                                          >
                                              <X size={12} />
                                          </button>
                                      </div>
                                  ))}
                              </div>
                          ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {clusteredScope.compoundEvents.map((ev) => {
                                  const suggestions = getMissingRoleSuggestionsForEvent(ev, mitreData, selectedTTPs);
                                  const missingSuggestionCount = Object.values(suggestions).filter(Boolean).length;
                                  const roleSlots = [
                                      { key: 'CONDUIT', label: 'Conduit', color: '#a78bfa', items: ev.conduits || [] },
                                      { key: 'PRECURSOR', label: 'Precursor', color: '#94a3b8', items: ev.precursors || [] },
                                      { key: 'MODIFIER', label: 'Modifier', color: '#f472b6', items: ev.modifiers || [] },
                                      { key: 'ANCHOR', label: 'Anchor', color: '#22d3ee', items: ev.anchors || [] }
                                  ];

                                  return (
                                      <div
                                          key={ev.eventNumber}
                                          style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'space-between',
                                              gap: '10px',
                                              flexWrap: 'wrap',
                                              padding: '8px 10px',
                                              borderRadius: '8px',
                                              background: 'rgba(255, 255, 255, 0.02)',
                                              border: '1px solid rgba(255, 255, 255, 0.05)'
                                          }}
                                      >
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
                                              <span
                                                  style={{
                                                      fontSize: '0.68rem',
                                                      fontWeight: 800,
                                                      color: '#22d3ee',
                                                      padding: '2px 7px',
                                                      borderRadius: '5px',
                                                      background: 'rgba(6, 182, 212, 0.12)',
                                                      border: '1px solid rgba(6, 182, 212, 0.28)',
                                                      whiteSpace: 'nowrap'
                                                  }}
                                              >
                                                  Phase {ev.eventNumber}
                                              </span>

                                              {roleSlots.map((slot, sIdx) => {
                                                  const sug = suggestions[slot.key];
                                                  return (
                                                      <React.Fragment key={slot.key}>
                                                          {sIdx > 0 && (
                                                              <span style={{ color: 'rgba(148, 163, 184, 0.45)', fontSize: '0.72rem' }}>➔</span>
                                                          )}
                                                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                                                              <span style={{ fontSize: '0.64rem', fontWeight: 700, color: slot.color, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                                                                  {slot.label}:
                                                              </span>
                                                              {slot.items.length > 0 ? (
                                                                  slot.items.map((item) => (
                                                                      <span
                                                                          key={item.id}
                                                                          style={{
                                                                              display: 'inline-flex',
                                                                              alignItems: 'center',
                                                                              gap: '4px',
                                                                              padding: '2px 7px',
                                                                              borderRadius: '5px',
                                                                              fontSize: '0.68rem',
                                                                              fontWeight: 700,
                                                                              color: 'var(--text-primary)',
                                                                              background: `${slot.color}18`,
                                                                              border: `1px solid ${slot.color}45`
                                                                          }}
                                                                          title={`${item.id} — ${item.name}`}
                                                                      >
                                                                          <span style={{ color: slot.color, fontFamily: 'monospace' }}>{item.id}</span>
                                                                          <span style={{ maxWidth: '125px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                              {item.name}
                                                                          </span>
                                                                          <button
                                                                              type="button"
                                                                              onClick={() => toggleTTP(item.id, item.name)}
                                                                              style={{
                                                                                  background: 'transparent',
                                                                                  border: 'none',
                                                                                  color: 'var(--text-muted)',
                                                                                  cursor: 'pointer',
                                                                                  padding: '0 0 0 2px',
                                                                                  display: 'inline-flex',
                                                                                  alignItems: 'center'
                                                                              }}
                                                                              title={`Remove ${item.id}`}
                                                                          >
                                                                              <X size={11} />
                                                                          </button>
                                                                      </span>
                                                                  ))
                                                              ) : sug ? (
                                                                  <button
                                                                      type="button"
                                                                      onClick={() => addCompanionTtp(sug)}
                                                                      style={{
                                                                          display: 'inline-flex',
                                                                          alignItems: 'center',
                                                                          gap: '4px',
                                                                          padding: '2px 7px',
                                                                          borderRadius: '5px',
                                                                          fontSize: '0.66rem',
                                                                          fontWeight: 600,
                                                                          color: 'var(--text-secondary)',
                                                                          background: 'rgba(255, 255, 255, 0.02)',
                                                                          border: `1px dashed ${slot.color}55`,
                                                                          cursor: 'pointer'
                                                                      }}
                                                                      title={`Optional companion ${slot.label}: Click to add ${sug.id} (${sug.name})`}
                                                                  >
                                                                      <span style={{ color: slot.color, fontWeight: 800 }}>+ {sug.id}</span>
                                                                      <span style={{ maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                          {sug.name}
                                                                      </span>
                                                                  </button>
                                                              ) : (
                                                                  <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>
                                                              )}
                                                          </div>
                                                      </React.Fragment>
                                                  );
                                              })}
                                          </div>

                                          {missingSuggestionCount > 0 && (
                                              <button
                                                  type="button"
                                                  onClick={() => completeEventChain(ev)}
                                                  className="hover-lift"
                                                  style={{
                                                      padding: '3px 9px',
                                                      borderRadius: '6px',
                                                      fontSize: '0.67rem',
                                                      fontWeight: 700,
                                                      color: '#22d3ee',
                                                      background: 'rgba(6, 182, 212, 0.1)',
                                                      border: '1px solid rgba(6, 182, 212, 0.3)',
                                                      cursor: 'pointer',
                                                      whiteSpace: 'nowrap'
                                                  }}
                                                  title="Optionally auto-fill the remaining companion components for this phase"
                                              >
                                                  + Fill Optional ({missingSuggestionCount})
                                              </button>
                                          )}
                                      </div>
                                  );
                              })}
                          </div>
                          )}
                      </div>
                      );
                  })()}
                  <div className="glass-panel animate-fade-in custom-scrollbar" style={{  padding: activeMapTactic ? '30px' : '60px 0', position: 'relative', display: 'flex', flexDirection: activeMapTactic ? 'column' : 'row', alignItems: activeMapTactic ? 'stretch' : 'center', justifyContent: 'flex-start', minHeight: '220px', boxSizing: 'border-box', overflowX: 'auto', gap: 0  }}>
                     
                     {!activeMapTactic ? (
                        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '30px', padding: '0 40px', minWidth: '100%', boxSizing: 'border-box', justifyContent: 'space-between', zIndex: 1 }}>
                           <div className="pipeline-line" style={{ left: '65px', right: '65px' }}>
                              <div className="pipeline-glow"></div>
                           </div>

                           {(() => {
                              const tacticKeys = Object.keys(mitreData)
                                  ?.filter(t => t !== 'Reconnaissance' && t !== 'Resource Development')
                                  .sort((a, b) => {
                                  const idxA = KILL_CHAIN_ORDER.indexOf(a);
                                  const idxB = KILL_CHAIN_ORDER.indexOf(b);
                                  if (idxA === -1 && idxB === -1) return a.localeCompare(b);
                                  if (idxA === -1) return 1;
                                  if (idxB === -1) return -1;
                                  return idxA - idxB;
                              });

                              return tacticKeys.map((tactic, index) => {
                                  const info = mitreData[tactic];
                                  const selectedCount = (info.techniques || []).filter(t => selectedTTPs.find(st => st.id === t.id || st.id.startsWith(t.id + '.'))).length;
                                  
                                  if (searchTerm && !info.techniques.some(t => t.id.toLowerCase().includes(searchTerm.toLowerCase()) || t.name.toLowerCase().includes(searchTerm.toLowerCase()) || (t.subTechniques || []).some(sub => sub.id.toLowerCase().includes(searchTerm.toLowerCase()) || sub.name.toLowerCase().includes(searchTerm.toLowerCase())))) {
                                      return null;
                                  }

                                  return (
                                     <div key={tactic} 
                                          onClick={() => setActiveMapTactic(tactic)}
                                          style={{  display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, cursor: 'pointer', position: 'relative', flexShrink: 0  }}>
                                        
                                        <div className={`ttp-node ${selectedCount > 0 ? 'selected' : ''}`}>
                                            {(() => {
                                                const Icon = TACTIC_ICONS[tactic];
                                                return Icon ? <Icon size={22} color={selectedCount > 0 ? 'var(--accent-primary)' : 'var(--text-secondary)'} /> : <div style={{  width: '12px', height: '12px', borderRadius: '50%', background: 'var(--text-secondary)'  }}></div>;
                                            })()}
                                            
                                            {selectedCount > 0 && (
                                                <div style={{  position: 'absolute', top: '-6px', right: '-6px', background: 'var(--accent-primary)', color: '#fff', fontSize: '0.75rem', fontWeight: 'bold', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg-primary)'  }}>
                                                    {selectedCount}
                                                </div>
                                            )}
                                        </div>
                                        
                                        <span style={{  position: 'absolute', top: index % 2 === 0 ? '-35px' : '65px', color: 'var(--text-primary)', fontSize: '0.75rem', fontWeight: 'bold', whiteSpace: 'nowrap', textShadow: '0 2px 4px rgba(0,0,0,0.8)'  }}>
                                           {tactic}
                                        </span>
                                     </div>
                                  );
                              });
                           })()}
                        </div>
                     ) : (
                        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '20px', minWidth: 0 }}>
                           {/* Level 1: Tactic Header */}
                           <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                              <button className="btn hover-lift" onClick={() => { setActiveMapTactic(null); setActiveMapTechnique(null); }} style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '6px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                 <ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} /> Back
                              </button>
                              <div className="ttp-node" style={{ width: '40px', height: '40px', minWidth: '40px', minHeight: '40px' }}>
                                 {(() => {
                                     const Icon = TACTIC_ICONS[activeMapTactic];
                                     return Icon ? <Icon size={20} color="var(--text-primary)" /> : null;
                                 })()}
                              </div>
                              <h3 style={{ margin: 0, fontSize: '1.5rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>{activeMapTactic}</h3>
                              <span style={{ marginLeft: 'auto', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500, padding: '4px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}>
                                 {(() => {
                                     const count = (mitreData[activeMapTactic]?.techniques || []).filter(t => t.id.toLowerCase().includes(searchTerm.toLowerCase()) || t.name.toLowerCase().includes(searchTerm.toLowerCase()) || (t.subTechniques || []).some(sub => sub.id.toLowerCase().includes(searchTerm.toLowerCase()) || sub.name.toLowerCase().includes(searchTerm.toLowerCase()))).length;
                                     return searchTerm.trim() ? `${count} techniques match search` : `${count} techniques available`;
                                 })()}
                              </span>
                           </div>

                           {/* Level 2 & 3 Exclusive Rendering */}
                           {!activeMapTechnique ? (
                              <div 
                                  className="animate-fade-in custom-scrollbar" 
                                  style={{ display: 'flex', overflowX: 'auto', gap: '15px', padding: '10px 0', minHeight: '140px' }}
                                  ref={(el) => {
                                      if (el && !el._hasWheelListener) {
                                          el.addEventListener('wheel', (e) => {
                                              if (e.deltaY !== 0) {
                                                  e.preventDefault();
                                                  el.scrollLeft += e.deltaY;
                                              }
                                          }, { passive: false });
                                          el._hasWheelListener = true;
                                      }
                                  }}
                               >
                                 {(() => {
                                    const info = mitreData[activeMapTactic];
                                    const filteredTechs = (info?.techniques || []).filter(t => t.id.toLowerCase().includes(searchTerm.toLowerCase()) || t.name.toLowerCase().includes(searchTerm.toLowerCase()) || (t.subTechniques || []).some(sub => sub.id.toLowerCase().includes(searchTerm.toLowerCase()) || sub.name.toLowerCase().includes(searchTerm.toLowerCase())));
                                    
                                    return filteredTechs.map(tech => {
                                       const isSelected = selectedTTPs.some(st => st.id === tech.id);
                                       const selectedSubCount = selectedTTPs.filter(st => st.id !== tech.id && st.id.startsWith(tech.id + '.')).length;
                                       const isSubSelected = selectedSubCount > 0;
                                       const roleInfo = classifyTtpOperationalRole({ id: tech.id, name: tech.name, tactics: [activeMapTactic] });
                                       const hasSub = tech.subTechniques && tech.subTechniques.length > 0;
                                       
                                       return (
                                          <div key={tech.id} onClick={() => { if (hasSub) { setActiveMapTechnique(tech.id); } else { toggleTTP(tech.id, tech.name); } }} className={`hover-lift ttp-card`} style={{ flexShrink: 0, width: '235px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '15px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '10px', transition: 'all 0.3s' }}>
                                             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px', gap: '6px' }}>
                                                <div 
                                                    onClick={(e) => { e.stopPropagation(); toggleTTP(tech.id, tech.name); }} 
                                                    className="hover-lift"
                                                    style={{ cursor: 'pointer', padding: '4px 8px', background: isSelected ? 'rgba(var(--accent-primary-rgb), 0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }}>
                                                   {isSelected ? <CheckSquare size={15} color="var(--accent-primary)" /> : isSubSelected ? <CheckSquare size={15} color="var(--text-secondary)" style={{ opacity: 0.5 }} /> : <Square size={15} color="var(--text-secondary)" />}
                                                   <span style={{ fontSize: '0.73rem', color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)', fontWeight: 'bold' }}>
                                                      {isSelected ? 'Selected' : 'Select'}
                                                   </span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <span
                                                        style={{
                                                            fontSize: '0.62rem',
                                                            fontWeight: 800,
                                                            padding: '2px 5px',
                                                            borderRadius: '4px',
                                                            color: roleInfo.color,
                                                            background: roleInfo.bg,
                                                            border: `1px solid ${roleInfo.border}`
                                                        }}
                                                        title={roleInfo.description}
                                                    >
                                                        {roleInfo.shortLabel}
                                                    </span>
                                                    <span style={{ fontSize: '0.72rem', background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{tech.id}</span>
                                                </div>
                                             </div>
                                             <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-primary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{tech.name}</h4>
                                             <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                                                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                                                   {(tech.subTechniques || []).length} sub-techs
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                    {isSubSelected && (
                                                       <div style={{ fontSize: '0.62rem', color: '#fff', background: 'var(--accent-primary)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                                           {selectedSubCount} Sub
                                                       </div>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            selectWithCompanionChain(tech);
                                                        }}
                                                        style={{
                                                            padding: '2px 7px',
                                                            borderRadius: '4px',
                                                            fontSize: '0.64rem',
                                                            fontWeight: 700,
                                                            color: '#22d3ee',
                                                            background: 'rgba(6, 182, 212, 0.1)',
                                                            border: '1px solid rgba(6, 182, 212, 0.3)',
                                                            cursor: 'pointer'
                                                        }}
                                                        title="Select this technique along with its recommended Conduit, Precursor, Modifier, and Anchor companions"
                                                    >
                                                        + Chain
                                                    </button>
                                                </div>
                                             </div>
                                          </div>
                                       );
                                    });
                                 })()}
                              </div>
                           ) : (
                              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, minHeight: 0 }}>
                                 <div style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <button className="btn hover-lift" onClick={() => setActiveMapTechnique(null)} style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '6px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                       <ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} /> Back to {activeMapTactic}
                                    </button>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                       <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>
                                          {mitreData[activeMapTactic]?.techniques.find(t => t.id === activeMapTechnique)?.name}
                                       </h3>
                                       <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{activeMapTechnique} Sub-techniques</span>
                                    </div>
                                 </div>
                                 
                                 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px', overflowY: 'auto', paddingRight: '10px', paddingBottom: '20px' }} className="custom-scrollbar">
                                    {(() => {
                                       const tech = mitreData[activeMapTactic]?.techniques.find(t => t.id === activeMapTechnique);
                                       if (!tech || !tech.subTechniques || tech.subTechniques.length === 0) {
                                          return <div style={{ color: 'var(--text-muted)' }}>No sub-techniques available.</div>;
                                       }
                                       return tech.subTechniques.map(sub => {
                                          const isSelected = selectedTTPs.some(st => st.id === sub.id);
                                          const subRole = classifyTtpOperationalRole({ id: sub.id, name: sub.name, tactics: [activeMapTactic] });
                                          return (
                                             <div key={sub.id} onClick={() => toggleTTP(sub.id, sub.name)} className="hover-lift ttp-card" style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.02)', padding: '12px 15px', borderRadius: '8px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.03)' }}>
                                                <div style={{ flexShrink: 0 }}>
                                                    {isSelected ? <CheckSquare size={18} color="var(--accent-primary)" /> : <Square size={18} color="var(--text-secondary)" />}
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0, flex: 1 }}>
                                                   <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                                                       <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'monospace' }}>
                                                          <CornerDownRight size={12} />
                                                          {sub.id}
                                                       </span>
                                                       <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                           <span
                                                               style={{
                                                                   fontSize: '0.6rem',
                                                                   fontWeight: 800,
                                                                   padding: '1px 5px',
                                                                   borderRadius: '4px',
                                                                   color: subRole.color,
                                                                   background: subRole.bg,
                                                                   border: `1px solid ${subRole.border}`
                                                               }}
                                                               title={subRole.description}
                                                           >
                                                               {subRole.shortLabel}
                                                           </span>
                                                           <button
                                                               type="button"
                                                               onClick={(e) => {
                                                                   e.stopPropagation();
                                                                   selectWithCompanionChain(sub);
                                                               }}
                                                               style={{
                                                                   padding: '1px 6px',
                                                                   borderRadius: '4px',
                                                                   fontSize: '0.62rem',
                                                                   fontWeight: 700,
                                                                   color: '#22d3ee',
                                                                   background: 'rgba(6, 182, 212, 0.1)',
                                                                   border: '1px solid rgba(6, 182, 212, 0.3)',
                                                                   cursor: 'pointer'
                                                               }}
                                                               title="Select this sub-technique along with its recommended Conduit, Precursor, Modifier, and Anchor companions"
                                                           >
                                                               + Chain
                                                           </button>
                                                       </div>
                                                   </div>
                                                   <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub.name}</span>
                                                </div>
                                             </div>
                                          );
                                       });
                                    })()}
                                 </div>
                              </div>
                           )}
                        </div>
                     )}
                  </div>
                </>
             )}
        </div>
    );
}
