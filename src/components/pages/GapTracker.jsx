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

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAppContext } from '../../AppContext';
import { AlertCircle, Target, User, Edit3, ArrowRight, Plus, X, Sparkles, Search, ShieldAlert, Crosshair, Filter, ChevronDown, CheckCircle2, ChevronRight, Play, Info, AlertTriangle, RefreshCw, Flame, Clock, Terminal, FileText, Package, Monitor, CheckCircle, Shield } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useToast } from '../ui/Toast';
import EnvironmentDropdown from '../dropdowns/EnvironmentDropdown';
import InlineEnvironmentDropdown from '../dropdowns/InlineEnvironmentDropdown';
import GapDetails from '../features/GapDetails';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area, ReferenceLine, ScatterChart, Scatter, ZAxis } from 'recharts';
import { Maximize2, Minimize2, CheckSquare, Settings2 } from 'lucide-react';
import CoverageRatingDropdown from '../dropdowns/CoverageRatingDropdown';
import SeverityDropdown from '../dropdowns/SeverityDropdown';
import TTPSelector from '../features/TTPSelector';
import ValidationOutcomeDropdown from '../dropdowns/ValidationOutcomeDropdown';
import UnifiedPosturePill from '../ui/UnifiedPosturePill';

const renderTechnicalDetails = (remediationStr) => {
    if (!remediationStr) return null;
    const events = remediationStr.split('\n\n').filter(e => e.trim());
    
    // Fallback if the string doesn't follow the Event: [...] format
    if (events.length > 0 && !events[0].startsWith('Event:')) {
        return (
             <div style={{  margin: 0, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)'  }}>
                 {remediationStr.split('\n').map((line, i) => {
                     if (line.startsWith('Execution:')) {
                         return <div key={i} style={{  marginBottom: '8px', wordBreak: 'break-all', overflowWrap: 'anywhere'  }}><strong style={{  color: 'var(--danger)'  }}>Red Team Notes:</strong> {line.substring(10).trim()}</div>;
                     } else if (line.startsWith('Detection:')) {
                         return <div key={i} style={{  marginBottom: '8px', wordBreak: 'break-all', overflowWrap: 'anywhere'  }}><strong style={{  color: '#3b82f6'  }}>Blue Team Notes:</strong> {line.substring(10).trim()}</div>;
                     }
                     return <div key={i}>{line}</div>;
                 })}
             </div>
        );
    }

    return (
        <div style={{  display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px'  }}>
            {events.map((evt, i) => {
                const lines = evt.split('\n');
                const eventLine = lines.find(l => l.startsWith('Event:'));
                const execLine = lines.find(l => l.startsWith('Execution:'));
                const detectLine = lines.find(l => l.startsWith('Detection:'));
                
                let name = 'Unknown Event';
                let outcome = 'Unknown';
                if (eventLine) {
                    const match = eventLine.match(/Event: (.*?) \[(.*?)\]/);
                    if (match) {
                        name = match[1];
                        outcome = match[2];
                    } else {
                        name = eventLine.replace('Event: ', '');
                    }
                }
                
                const execNotes = execLine ? execLine.replace('Execution: ', '') : 'No execution notes provided.';
                const detectNotes = detectLine ? detectLine.replace('Detection: ', '') : 'No detection notes provided.';

                return (
                    <div key={i} style={{  background: 'rgba(0,0,0,0.4)', border: '1px solid var(--glass-border)', borderRadius: '6px', padding: '12px'  }}>
                        <div style={{  display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px'  }}>
                            <strong style={{  color: 'var(--text-primary)', fontSize: '0.95rem'  }}>{name}</strong>
                            <UnifiedPosturePill outcome={outcome} coverage={outcome === 'Prevented' || outcome === 'Alerted' ? 'Optimal' : outcome === 'Logged' ? 'Partial' : outcome === 'Minimal' ? 'Minimal' : outcome === 'Missed' ? 'None' : 'Unknown'} />
                        </div>
                        <div style={{  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.8rem'  }}>
                            <div>
                                <span style={{  display: 'block', color: 'var(--danger)', fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: '4px', fontWeight: 'bold'  }}>Red Team Notes</span>
                                <span style={{ color: 'var(--text-secondary)', lineHeight: '1.4', display: 'block', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{execNotes}</span>
                            </div>
                            <div>
                                <span style={{  display: 'block', color: '#3b82f6', fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: '4px', fontWeight: 'bold'   }}>Blue Team Notes</span>
                                <span style={{ color: 'var(--text-secondary)', lineHeight: '1.4', display: 'block', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{detectNotes}</span>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const MemoizedGapCard = React.memo(({ gap, handleDragStart, handleDragEnd, setSelectedGapId, getTTPName, isReadOnly }) => {
    const daysOpen = Math.floor((new Date() - new Date(gap.createdDate || Date.now())) / (1000 * 60 * 60 * 24));
    
    return (
        <div 
            draggable={!isReadOnly ? "true" : "false"}
            onDragStart={(e) => !isReadOnly && handleDragStart(e, gap.id)}
            onDragEnd={!isReadOnly ? handleDragEnd : undefined}
            className={`glass-panel hover-lift`} 
            style={{  padding: '15px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', position: 'relative', cursor: isReadOnly ? 'pointer' : 'grab', display: 'flex', flexDirection: 'column', gap: '8px'   }}
            onClick={() => setSelectedGapId(gap.id)}
        >
            <div style={{  display: 'flex', justifyContent: 'space-between', marginBottom: '5px', alignItems: 'center'  }}>
                <span style={{  fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold'  }}>{new Date(gap.createdDate).toLocaleDateString()}</span>
                <div style={{  display: 'flex', gap: '8px', alignItems: 'center'  }}>
                {gap.status !== 'Resolved' && gap.priorityScore !== undefined && (
                    <span style={{  fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 'bold', background: gap.priorityScore >= 80 ? 'rgba(239,68,68,0.2)' : gap.priorityScore >= 30 ? 'rgba(245,158,11,0.2)' : 'rgba(10,185,129,0.2)', color: gap.priorityScore >= 80 ? 'var(--danger)' : gap.priorityScore >= 30 ? 'var(--warning)' : 'var(--success)', border: gap.priorityScore >= 80 ? '1px solid var(--danger)' : gap.priorityScore >= 30 ? '1px solid var(--warning)' : 'none', boxShadow: gap.priorityScore >= 80 ? '0 0 5px rgba(239,68,68,0.4)' : 'none'  }}>
                        Risk: {gap.priorityScore}
                    </span>
                )}
                {gap.status !== 'Resolved' && (
                    <span className={gap.severity === 'Critical' ? 'severity-critical' : gap.severity === 'High' ? 'severity-high' : gap.severity === 'Medium' ? 'severity-medium' : gap.severity === 'Low' ? 'severity-low' : 'status-unknown'} style={{  fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 'bold'  }}>{gap.severity}</span>
                )}
                </div>
            </div>
            
            <h4 style={{  margin: '0 0 10px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '1rem', wordBreak: 'break-all', overflowWrap: 'anywhere'  }}>
                <Target size={16} color="var(--accent-secondary)" style={{  flexShrink: 0  }} /> 
                {gap.displayId && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', borderRight: '1px solid var(--glass-border)', paddingRight: '8px' }}>{gap.displayId}</span>}
                {(gap.finding?.includes('Missed') || gap.finding?.includes('**Aggregated') || !gap.finding) ? (gap.ttp + (getTTPName(gap.ttp) ? ` - ${getTTPName(gap.ttp)}` : '')) : gap.finding}
            </h4>
            {(!gap.finding?.includes('Missed') && !gap.finding?.includes('**Aggregated') && gap.finding) && gap.ttp && (
                <div style={{  marginBottom: '10px'  }}>
                    <span style={{  background: 'rgba(156, 39, 176, 0.15)', border: '1px solid rgba(156, 39, 176, 0.3)', color: 'var(--text-primary)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.7rem', display: 'inline-block', maxWidth: '100%', boxSizing: 'border-box', overflowWrap: 'anywhere'  }}>
                        <strong style={{  color: 'var(--accent-primary)', marginRight: '6px'  }}>{gap.ttp}</strong>
                        <span style={{  color: 'var(--text-secondary)'  }}>{getTTPName(gap.ttp)}</span>
                    </span>
                </div>
            )}
            <div style={{  marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap'  }}>
                <span style={{  fontSize: '0.75rem', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-secondary)'  }}>
                    Env: {Array.isArray(gap.environment) ? gap.environment.join(', ') : (gap.environment || 'Unknown Environment')}
                </span>
                {gap.securityControls && gap.securityControls.length > 0 && (
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        {gap.securityControls.slice(0, 2).map((ctrl, idx) => (
                            <span key={idx} style={{ fontSize: '0.65rem', color: '#60a5fa', background: 'rgba(59, 130, 246, 0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                                {ctrl}
                            </span>
                        ))}
                        {gap.securityControls.length > 2 && (
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>+{gap.securityControls.length - 2}</span>
                        )}
                    </div>
                )}
            </div>
            
            <div style={{  display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '5px'  }}>
                <span style={{  fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px'  }}><Clock size={12} /> {daysOpen} {daysOpen === 1 ? 'day' : 'days'} open</span>
                <div style={{  display: 'flex', gap: '10px', alignItems: 'center'  }}>
                    {gap.status !== 'Risk Accepted' && gap.status !== 'Resolved' && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); document.dispatchEvent(new CustomEvent('open-risk-modal', { detail: gap })); }}
                            style={{  background: 'transparent', border: '1px solid rgba(139, 92, 246, 0.4)', color: '#a78bfa', fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer'  }}
                            title="Accept Risk"
                        >
                            Accept Risk
                        </button>
                    )}
                    <span style={{  fontSize: '0.75rem', color: 'var(--text-muted)'  }}>Details &rarr;</span>
                </div>
            </div>
        </div>
    );
});

import TagDropdown from '../dropdowns/TagDropdown';

/**
 * GapTracker Component
 * 
 * A Kanban-style ticketing board for tracking and remediating missing security controls.
 * 
 * CORE WORKFLOW:
 * 1. Automatically generates "Gaps" (tickets) when an Exercise results in a "Missed" outcome.
 * 2. Allows users to drag-and-drop tickets across status columns (Open -> In Progress -> Resolved).
 * 3. Provides a "Validation" modal workflow to re-test the Gap against the original TTP
 *    and seamlessly updates the historical Simulation metrics via `updateExerciseValidation`.
 * 
 * NOMENCLATURE MAP:
 * - "Gap": A remediation ticket.
 * - "Validation": Re-executing the original TTP to verify the new security control works.
 */
export default function GapTracker() {
  const { gaps, updateGap, createGap, deleteGap, isReadOnly, mitreData, updateExerciseValidation, revertExerciseValidation, aiSettings, setActiveAiContext, activeEnvironmentFilter, activeTagFilter, targetEnvironments, simulationSummaries, setSimulationSummaries, setExercises, allExercisesData, setAllExercisesData, dbAdapter, confirmAction } = useAppContext();
  const { addToast } = useToast();
  
  const location = useLocation();
  const navigate = useNavigate();
  
  const [activeValidationGap, setActiveValidationGap] = useState(null);
  const [selectedGapId, setSelectedGapId] = useState(null);
  const [isResolvedCollapsed, setIsResolvedCollapsed] = useState(false);

  useEffect(() => {
    // Only set the generic context if we are NOT viewing a specific gap
    if (!selectedGapId) {
        setActiveAiContext({
            view: 'Gap Tracker (Kanban Board)',
            description: 'A Kanban board tracking identified security gaps, vulnerabilities, and misconfigurations across all environments.',
            activeGaps: gaps.map(g => ({
                id: g.id,
                title: g.title,
                ttp: g.ttp,
                phase: g.phase,
                environment: g.environment,
                severity: g.severity,
                status: g.status,
                priorityScore: g.priorityScore
            }))
        });
    }
  }, [selectedGapId, setActiveAiContext, gaps]);

  useEffect(() => {
    if (location.state?.openGapId) {
      setSelectedGapId(location.state.openGapId);
      // Clear location state after reading
      window.history.replaceState({}, document.title)
    }
  }, [location]);

  useEffect(() => {
      if (activeValidationGap) {
          const now = new Date();
          now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
          setValidationDate(now.toISOString().slice(0, 16));
      }
  }, [activeValidationGap]);
  const [validationOutcome, setValidationOutcome] = useState(() => sessionStorage.getItem('gap_val_outcome') || '');
  const [validationNotes, setValidationNotes] = useState(() => sessionStorage.getItem('gap_val_notes') || '');
  const [validationDate, setValidationDate] = useState(() => { const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); return sessionStorage.getItem('gap_val_date') || now.toISOString().slice(0, 16); });
  const [validationFiles, setValidationFiles] = useState([]);

  const [searchQuery, setSearchQuery] = useState(() => sessionStorage.getItem('gap_search') || '');
  const [severityFilter, setSeverityFilter] = useState(() => sessionStorage.getItem('gap_sev_filter') || 'All');
  const [isSeverityDropdownOpen, setIsSeverityDropdownOpen] = useState(false);
  const severityDropdownRef = React.useRef(null);

  useEffect(() => {
      const handleClickOutside = (event) => {
          if (severityDropdownRef.current && !severityDropdownRef.current.contains(event.target)) {
              setIsSeverityDropdownOpen(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const [draggedGapId, setDraggedGapId] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  
  const [showRiskModal, setShowRiskModal] = useState(false);
  const [riskForm, setRiskForm] = useState(() => {
     const saved = sessionStorage.getItem('gap_risk_form');
     return saved ? JSON.parse(saved) : { gapId: null, justification: '', acceptedBy: '' };
  });
  
  useEffect(() => {
      const handleRiskEvent = (e) => {
          const gap = e.detail;
          setRiskForm({ gapId: gap.id, justification: gap.riskJustification || '', acceptedBy: gap.riskAcceptedBy || '' });
          setShowRiskModal(true);
      };
      document.addEventListener('open-risk-modal', handleRiskEvent);
      return () => document.removeEventListener('open-risk-modal', handleRiskEvent);
  }, []);

  const handleDragStart = React.useCallback((e, id) => {
      if (isReadOnly) return;
      setDraggedGapId(id);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
      setTimeout(() => e.target.style.opacity = '0.5', 0);
  }, [isReadOnly]);

  const handleDragEnd = React.useCallback((e) => {
      if (isReadOnly) return;
      e.target.style.opacity = '1';
      setDraggedGapId(null);
      setDragOverCol(null);
  }, [isReadOnly]);

  const handleDragOver = (e, col) => {
      if (isReadOnly) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dragOverCol !== col) setDragOverCol(col);
  };

  const handleDrop = (e, col) => {
      if (isReadOnly) return;
      e.preventDefault();
      setDragOverCol(null);
      if (!draggedGapId) return;
      
      const gap = gaps.find(g => String(g.id) === String(draggedGapId));
      if (!gap || gap.status === col) return;

      if (col === 'Resolved') {
          if (gap.status === 'Risk Accepted') {
              addToast('Risk Accepted gaps cannot be directly Resolved. Please revoke risk acceptance first (move to In Progress).', 'warning');
              return;
          }
          setActiveValidationGap(gap);
      } else if (col === 'Risk Accepted') {
          setRiskForm({ gapId: gap.id, justification: gap.riskJustification || '', acceptedBy: gap.riskAcceptedBy || '' });
          setShowRiskModal(true);
      } else {
          if (gap.status === 'Risk Accepted' && col !== 'Risk Accepted') {
              confirmAction("Moving this gap out of 'Risk Accepted' will clear its risk justification logs. Are you sure you want to proceed?", () => {
                  updateStatus(draggedGapId, col);
              });
          } else {
              if (gap.status === 'Resolved') {
                  const gapTTPs = (gap.ttp || '').split(',').map(t => t.trim());
                  
                  // Reset simulationSummaries outcome to Missed
                  if (simulationSummaries[gap.simulation] && simulationSummaries[gap.simulation].testResults) {
                      const nextSims = JSON.parse(JSON.stringify(simulationSummaries));
                      nextSims[gap.simulation].testResults.forEach(p => {
                          if ((p.ttps || []).some(t => gapTTPs.includes(t)) || p.name === gap.finding) {
                              p.outcome = 'Missed';
                              p.coverageRating = 'None';
                          }
                      });
                      setSimulationSummaries(nextSims);
                      if (dbAdapter && typeof dbAdapter.saveData === 'function') {
                          dbAdapter.saveData('simulationSummaries', nextSims);
                      }
                  }

                  // Reset exercises status to 'low'
                  (async () => {
                      let allEx = [];
                      if (dbAdapter && typeof dbAdapter.fetchData === 'function' && dbAdapter.type === 'local') {
                          allEx = await dbAdapter.fetchData('exercises') || [];
                      } else {
                          allEx = Object.values(allExercisesData);
                      }
                      
                      let modifiedExercises = [];
                      const updatedAllExercises = allEx.map(ex => {
                          if (gapTTPs.includes(ex.ttp) && ex.simulation === gap.simulation) {
                              const updated = { ...ex, status: 'low' };
                              modifiedExercises.push(updated);
                              return updated;
                          }
                          return ex;
                      });

                      if (dbAdapter && typeof dbAdapter.saveData === 'function') {
                          await dbAdapter.saveData('exercises', updatedAllExercises);
                      }

                      setAllExercisesData(prevMap => {
                          const nextMap = { ...prevMap };
                          updatedAllExercises.forEach(ex => {
                              nextMap[ex.id] = ex;
                          });
                          return nextMap;
                      });

                      setExercises(prev => prev.map(ex => {
                          const found = updatedAllExercises.find(e => e.id === ex.id);
                          return found ? found : ex;
                      }));

                      if (dbAdapter && typeof dbAdapter.updateExercise === 'function') {
                          for (const ex of modifiedExercises) {
                              if (ex.id) await dbAdapter.updateExercise(ex.id, ex);
                          }
                      }
                  })();
              }
              updateStatus(draggedGapId, col);
          }
      }
  };
  
  const ttpCache = React.useMemo(() => {
      if (!mitreData) return {};
      const cache = {};
      for (const tactic in mitreData) {
          mitreData[tactic].techniques.forEach(t => {
              cache[t.id] = t;
              if (t.subTechniques) {
                  t.subTechniques.forEach(s => cache[s.id] = s);
              }
          });
      }
      return cache;
  }, [mitreData]);

  const getTTPName = React.useCallback((idString) => {
      if (!idString) return '';
      const ids = idString.split(',').map(s => s.trim());
      const names = ids.map(id => ttpCache[id]?.name).filter(Boolean);
      return names.length > 0 ? names.join(', ') : '';
  }, [ttpCache]);
  
  const getTTPDetails = React.useCallback((idString) => {
      if (!idString) return null;
      const id = idString.split(',')[0].trim();
      return ttpCache[id] || null;
  }, [ttpCache]);

  useEffect(() => {
     sessionStorage.setItem('gap_val_outcome', validationOutcome);
     sessionStorage.setItem('gap_val_notes', validationNotes);
     sessionStorage.setItem('gap_val_date', validationDate);
     sessionStorage.setItem('gap_search', searchQuery);
     sessionStorage.setItem('gap_sev_filter', severityFilter);
     sessionStorage.setItem('gap_risk_form', JSON.stringify(riskForm));
  }, [validationOutcome, validationNotes, validationDate, searchQuery, severityFilter, riskForm]);

  const updateStatus = async (id, newStatus) => {
    if (isReadOnly) return;
    const updates = { status: newStatus };
    const gap = gaps.find(g => g.id === id);
    if (newStatus === 'Resolved') {
        updates.resolvedDate = new Date().toISOString();
    } else {
        updates.resolvedDate = null;
        if (gap && gap.status === 'Resolved' && revertExerciseValidation) {
            await revertExerciseValidation(gap);
        }
    }
    if (newStatus !== 'Risk Accepted') {
        updates.riskAcceptedBy = null;
        updates.riskJustification = null;
        updates.riskAcceptedDate = null;
    }
    updateGap(id, updates);
  };

  const updateField = (id, field, value) => {
    if (isReadOnly) return;
    updateGap(id, { [field]: value });
  };
  const columns = ['Open', 'In Progress', 'Resolved'];

  const groupedGaps = React.useMemo(() => {
    const grouped = {};
    columns.forEach(col => {
        grouped[col] = [];
    });
    grouped['Risk Accepted'] = [];

    gaps.forEach(g => {
      if (severityFilter !== 'All' && g.severity !== severityFilter && g.status !== 'Resolved') return;
      if (activeEnvironmentFilter !== 'All' && !(Array.isArray(g.environment) ? g.environment.includes(activeEnvironmentFilter) : g.environment === activeEnvironmentFilter)) return;
      if (activeTagFilter !== 'All' && !(Array.isArray(g.tags) ? g.tags.includes(activeTagFilter) : g.tags === activeTagFilter)) return;
      if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const matches = String(g.id || '').toLowerCase().includes(q) || 
                          String(g.ttp || '').toLowerCase().includes(q) || 
                          String(g.details || '').toLowerCase().includes(q) ||
                          String(g.finding || '').toLowerCase().includes(q);
          if (!matches) return;
      }
      const status = g.status || 'Open';
      if (!grouped[status]) {
          grouped[status] = [];
      }
      grouped[status].push(g);
    });

    Object.keys(grouped).forEach(col => {
       grouped[col].sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));
    });

    return grouped;
  }, [gaps, severityFilter, activeEnvironmentFilter, activeTagFilter, searchQuery]);

  const calculateMTTR = () => {
      const resolvedGaps = gaps.filter(g => g.status === 'Resolved' && g.resolvedDate && g.createdDate);
      if (resolvedGaps.length === 0) return 'N/A';
      
      const validResolved = resolvedGaps.filter(g => !isNaN(new Date(g.resolvedDate)) && !isNaN(new Date(g.createdDate)));
      if (validResolved.length === 0) return 'N/A';

      const totalSeconds = validResolved.reduce((acc, g) => {
          let diff = (new Date(g.resolvedDate) - new Date(g.createdDate)) / 1000;
          return acc + Math.max(0, diff);
      }, 0);
      
      const meanSeconds = totalSeconds / validResolved.length;
      if (isNaN(meanSeconds)) return 'N/A';

      const days = Math.floor(meanSeconds / (3600 * 24));
      const hours = Math.floor((meanSeconds % (3600 * 24)) / 3600);
      
      if (days > 0) return `${days}d ${hours}h`;
      if (hours > 0) return `${hours}h`;
      return '< 1h';
  };

  return (
    <div 
        className="animate-fade-in" 
        style={{  height: '100%', display: 'flex', flexDirection: 'column'  }}
        onDragOver={(e) => {
            const container = document.querySelector('.main-content');
            if (container) {
                const buffer = 100;
                const speed = 20;
                const { clientY } = e;
                const { top, bottom } = container.getBoundingClientRect();
                
                if (clientY - top < buffer) {
                    container.scrollBy(0, -speed);
                } else if (bottom - clientY < buffer) {
                    container.scrollBy(0, speed);
                }
            }
        }}
    >
      <div style={{  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', paddingRight: '20px', flexWrap: 'wrap', gap: '20px'  }}>
         <div style={{ flex: '1 1 300px' }}>
           <div style={{  display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '10px', flexWrap: 'wrap'  }}>
               <h1 className="iridescent-text" style={{  fontSize: '2.5rem', margin: 0  }}>Gap Tracker</h1>
               {gaps.length > 0 && (
                   <div style={{  background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.3)', padding: '4px 12px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap'  }}>
                       <Clock size={14} color="#c084fc" />
                       <span style={{  fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.5px'  }}>MTTR</span>
                       <span style={{  fontSize: '0.9rem', color: '#c084fc', fontWeight: 'bold'  }}>{calculateMTTR()}</span>
                   </div>
               )}
           </div>
           <p style={{  color: 'var(--text-secondary)', margin: 0  }}>Manage action items generated from your Purple Team simulations.</p>
         </div>
         <div style={{  display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap'  }}>
            <TagDropdown />
            <EnvironmentDropdown />
            <div style={{  position: 'relative'  }}>
                <Search size={16} style={{  position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)'  }} />
                <input 
                    className="ai-input" 
                    placeholder="Search gaps..." 
                    style={{  paddingLeft: '35px', width: '250px'  }}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />
            </div>
            <div ref={severityDropdownRef} style={{  position: 'relative'  }}>
                <button 
                    className="btn" 
                    onClick={() => setIsSeverityDropdownOpen(!isSeverityDropdownOpen)}
                    style={{ 
                        background: 'rgba(0,0,0,0.4)', 
                        border: isSeverityDropdownOpen ? '1px solid var(--accent-secondary)' : '1px solid var(--glass-border)', 
                        color: 'var(--text-primary)', 
                        display: 'flex', alignItems: 'center', gap: '8px',
                        boxShadow: isSeverityDropdownOpen ? '0 0 10px rgba(0, 188, 212, 0.2)' : 'none',
                        transition: 'all 0.2s ease',
                        minWidth: '150px', justifyContent: 'space-between'
                     }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {(() => {
                           const getIcon = (sev) => {
                               switch(sev) {
                                   case 'Critical': return { icon: Flame, color: 'var(--danger)' };
                                   case 'High': return { icon: AlertTriangle, color: '#f97316' };
                                   case 'Medium': return { icon: AlertCircle, color: 'var(--warning)' };
                                   case 'Low': return { icon: Info, color: 'var(--success)' };
                                   default: return { icon: Filter, color: 'var(--text-muted)' };
                               }
                           };
                           const { icon: ActiveIcon, color: activeColor } = getIcon(severityFilter);
                           return <ActiveIcon size={14} color={activeColor} />
                        })()}
                        <span style={{  fontSize: '0.85rem', textAlign: 'left'  }}>{severityFilter === 'All' ? 'All Severities' : severityFilter}</span>
                    </div>
                    <ChevronDown size={14} style={{  transform: isSeverityDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: 'var(--text-muted)'  }} />
                </button>
                
                {isSeverityDropdownOpen && (
                    <div className="animate-fade-in" style={{ 
                        position: 'absolute', top: 'calc(100% + 5px)', right: 0,
                        background: 'rgba(15, 17, 26, 0.98)', backdropFilter: 'blur(16px)',
                        border: '1px solid var(--accent-secondary)', borderRadius: '6px',
                        padding: '6px', zIndex: 1000, minWidth: '150px',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.5), inset 0 0 15px rgba(0, 188, 212, 0.1)',
                        display: 'flex', flexDirection: 'column', gap: '2px'
                     }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', padding: '4px 8px', fontWeight: 'bold' }}>
                            Filter by Severity
                        </div>
                        <div style={{ height: '1px', background: 'var(--glass-border)', margin: '2px 0' }} />
                        {['All', 'Critical', 'High', 'Medium', 'Low'].map(sev => {
                            const isActive = severityFilter === sev;
                            const getIcon = (s) => {
                                switch(s) {
                                    case 'Critical': return { icon: Flame, color: 'var(--severity-critical)' };
                                    case 'High': return { icon: AlertTriangle, color: 'var(--severity-high)' };
                                    case 'Medium': return { icon: AlertCircle, color: 'var(--severity-medium)' };
                                    case 'Low': return { icon: Info, color: 'var(--severity-low)' };
                                    default: return { icon: Filter, color: 'var(--text-muted)' };
                                }
                            };
                            const { icon: SevIcon, color: sevColor } = getIcon(sev);
                            return (
                                <button
                                    key={sev}
                                    onClick={() => { setSeverityFilter(sev); setIsSeverityDropdownOpen(false); }}
                                    style={{ 
                                        display: 'flex', alignItems: 'center', gap: '8px', width: '100%', textAlign: 'left',
                                        padding: '8px 10px', borderRadius: '4px', border: isActive ? '1px solid rgba(0, 188, 212, 0.3)' : '1px solid transparent',
                                        background: isActive ? 'rgba(0, 188, 212, 0.15)' : 'transparent',
                                        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                                        cursor: 'pointer', fontSize: '0.85rem', transition: 'all 0.15s ease'
                                     }}
                                    onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
                                    onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
                                >
                                    <SevIcon size={14} color={sevColor} />
                                    <span>{sev === 'All' ? 'All Severities' : sev}</span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
         </div>
      </div>
      
      {gaps.length > 0 && (
          <div style={{  display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap'  }}>
             <div className="glass-panel" style={{  flex: '1 1 120px', minWidth: '120px', padding: '15px', textAlign: 'center', border: '1px solid rgba(59, 130, 246, 0.3)', background: 'rgba(59, 130, 246, 0.05)'  }}>
                <div style={{  fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--text-primary)'  }}>{gaps.length}</div>
                <div style={{  fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginTop: '4px'  }}>Discovered Gaps</div>
             </div>
             <div className="glass-panel" style={{  flex: '1 1 120px', minWidth: '120px', padding: '15px', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.05)'  }}>
                <div style={{  fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--danger)'  }}>{gaps.filter(g => g.status === 'Open').length}</div>
                <div style={{  fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginTop: '4px'  }}>Open</div>
             </div>
             <div className="glass-panel" style={{  flex: '1 1 120px', minWidth: '120px', padding: '15px', textAlign: 'center', border: '1px solid rgba(245, 158, 11, 0.3)', background: 'rgba(245, 158, 11, 0.05)'  }}>
                <div style={{  fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--warning)'  }}>{gaps.filter(g => g.status === 'In Progress').length}</div>
                <div style={{  fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginTop: '4px'  }}>In-Progress</div>
             </div>
             <div className="glass-panel" style={{  flex: '1 1 120px', minWidth: '120px', padding: '15px', textAlign: 'center', border: '1px solid rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.05)'  }}>
                <div style={{  fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--success)'  }}>{gaps.filter(g => g.status === 'Resolved').length}</div>
                <div style={{  fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginTop: '4px'  }}>Resolved</div>
             </div>
          </div>
      )}

      {gaps.length === 0 ? (
         <div className="glass-panel" style={{  padding: '40px', textAlign: 'center', color: 'var(--text-muted)'  }}>
            <AlertCircle size={32} style={{  marginBottom: '10px', opacity: 0.5  }} />
            <p>No coverage gaps have been logged yet. Execute a simulation to add one.</p>
         </div>
      ) : (
         <div style={{  display: 'flex', flexDirection: 'column', gap: '20px', flex: 1  }}>
             <div style={{  display: 'flex', gap: '20px', overflowX: 'auto', paddingBottom: '10px'  }}>
           {columns.map(col => {
             const colGaps = groupedGaps[col] || [];

             return (
             <div 
                key={col} 
                className="glass-panel" 
                style={{  
                    display: 'flex', flexDirection: 'column', 
                    background: dragOverCol === col ? 'rgba(59, 130, 246, 0.1)' : 'rgba(10,11,16,0.6)', 
                    padding: '15px',
                    border: dragOverCol === col ? '1px dashed var(--accent-primary)' : '1px solid var(--glass-border)',
                    transition: 'all 0.2s',
                    flex: '1 1 0',
                    minWidth: (col === 'Resolved' && isResolvedCollapsed) ? '60px' : '320px',
                    alignSelf: (col === 'Resolved' && isResolvedCollapsed) ? 'start' : 'stretch'
                 }}
                onDragOver={(e) => handleDragOver(e, col)}
                onDrop={(e) => handleDrop(e, col)}
             >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: (col === 'Resolved' && isResolvedCollapsed) ? '0' : '15px', borderBottom: `2px solid ${col === 'Open' ? 'var(--danger)' : col === 'In Progress' ? 'var(--warning)' : col === 'Risk Accepted' ? '#a78bfa' : 'var(--success)'}`, paddingBottom: '10px' }}>
                    <h3 style={{ margin: 0 }}>
                        {col} <span style={{  fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'normal'  }}>({colGaps.length})</span>
                    </h3>
                    
                    {col === 'Resolved' && (
                        <button 
                            onClick={() => setIsResolvedCollapsed(!isResolvedCollapsed)} 
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '4px', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex', transition: 'all 0.2s' }}
                            title={isResolvedCollapsed ? "Expand Resolved" : "Collapse Resolved"}
                            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                        >
                            {isResolvedCollapsed ? <ChevronDown size={16} /> : <ChevronRight size={16} style={{ transform: 'rotate(-90deg)' }} />}
                        </button>
                    )}
                </div>
                
                {!(col === 'Resolved' && isResolvedCollapsed) && (
                    <div className="animate-fade-in" style={{  display: 'flex', flexDirection: 'column', gap: '15px'  }}>
                      {colGaps.map(gap => (
                      <MemoizedGapCard 
                          key={gap.id}
                          gap={gap}
                          handleDragStart={handleDragStart}
                          handleDragEnd={handleDragEnd}
                          setSelectedGapId={setSelectedGapId}
                          getTTPName={getTTPName}
                          isReadOnly={isReadOnly}
                      />
                  ))}
                    </div>
                )}

             </div>
             );
           })}
           </div>

            <div 
                style={{  marginTop: '30px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px'  }}
                onDragOver={(e) => handleDragOver(e, 'Risk Accepted')}
                onDrop={(e) => handleDrop(e, 'Risk Accepted')}
            >
                <details className="risk-details" style={{  background: dragOverCol === 'Risk Accepted' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(10, 11, 16, 0.6)', border: dragOverCol === 'Risk Accepted' ? '2px dashed rgba(139, 92, 246, 0.6)' : '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', transition: 'all 0.2s'  }}>
                    <summary className="risk-summary-hover" style={{  cursor: 'pointer', padding: '20px', display: 'flex', alignItems: 'center', gap: '15px', listStyle: 'none', background: 'rgba(139, 92, 246, 0.1)', borderBottom: '1px solid rgba(139, 92, 246, 0.2)', transition: 'background 0.2s ease'  }}>
                        <div style={{  background: 'rgba(139, 92, 246, 0.2)', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center'  }}>
                            <AlertCircle size={20} color="#a78bfa" />
                        </div>
                        <div style={{  flex: 1  }}>
                            <h3 style={{  margin: 0, color: '#a78bfa', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px'  }}>
                                Risk Accepted Gaps <span style={{  background: '#a78bfa', color: '#000', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold'  }}>{gaps.filter(g => g.status === 'Risk Accepted').length}</span>
                            </h3>
                            <p style={{  margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)'  }}>These gaps have been formally accepted and bypass active remediation queues.</p>
                        </div>
                        <div style={{  color: '#a78bfa', fontSize: '0.85rem', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '4px'  }}>
                            Click to expand
                        </div>
                    </summary>
                    <div style={{  padding: '20px', background: 'rgba(0,0,0,0.2)'  }}>
                        {gaps.filter(g => g.status === 'Risk Accepted').length === 0 ? (
                            <div style={{  padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', border: '1px dashed rgba(255,255,255,0.05)', borderRadius: '8px'  }}>
                                No gaps have been formally accepted yet. Drag and drop a gap card here to accept its risk.
                            </div>
                        ) : (
                            <div style={{  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px'  }}>
                                {gaps.filter(g => g.status === 'Risk Accepted').map(gap => {
                                    const daysOpen = Math.floor((new Date() - new Date(gap.createdDate || Date.now())) / (1000 * 60 * 60 * 24));
                                    return (
                                        <div 
                                            key={gap.id} 
                                            draggable={!isReadOnly ? "true" : "false"}
                                            onDragStart={(e) => !isReadOnly && handleDragStart(e, gap.id)}
                                            onDragEnd={!isReadOnly ? handleDragEnd : undefined}
                                            className="glass-panel hover-lift" 
                                            style={{  padding: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', cursor: isReadOnly ? 'pointer' : 'grab', display: 'flex', flexDirection: 'column', gap: '10px'  }} 
                                            onClick={() => setSelectedGapId(gap.id)}
                                        >
                                            <div style={{  display: 'flex', justifyContent: 'space-between', marginBottom: '5px', alignItems: 'center'  }}>
                                              <span style={{  fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold'  }}>{new Date(gap.createdDate).toLocaleDateString()}</span>
                                              <span className={gap.severity === 'Critical' ? 'severity-critical' : gap.severity === 'High' ? 'severity-high' : gap.severity === 'Medium' ? 'severity-medium' : gap.severity === 'Low' ? 'severity-low' : 'status-unknown'} style={{  fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 'bold'  }}>{gap.severity}</span>
                                            </div>
                                            <h4 style={{  margin: '0 0 5px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', wordBreak: 'break-all', overflowWrap: 'anywhere'  }}>
                                              <Target size={16} color="#a78bfa" style={{  flexShrink: 0  }} /> {(gap.finding?.includes('Missed') || gap.finding?.includes('**Aggregated') || !gap.finding) ? (gap.ttp + (getTTPName(gap.ttp) ? ` - ${getTTPName(gap.ttp)}` : '')) : gap.finding}
                                            </h4>
                                            {(!gap.finding?.includes('Missed') && !gap.finding?.includes('**Aggregated') && gap.finding) && gap.ttp && (
                                                <div style={{  marginBottom: '5px'  }}>
                                                    <span style={{  background: 'rgba(139, 92, 246, 0.15)', border: '1px solid rgba(139, 92, 246, 0.3)', color: 'var(--text-primary)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.7rem', display: 'inline-block', maxWidth: '100%', boxSizing: 'border-box', overflowWrap: 'anywhere'  }}>
                                                        <strong style={{  color: '#a78bfa', marginRight: '6px'  }}>{gap.ttp}</strong>
                                                        <span style={{  color: 'var(--text-secondary)'  }}>{getTTPName(gap.ttp)}</span>
                                                    </span>
                                                </div>
                                            )}
                                            <div style={{  background: 'rgba(139, 92, 246, 0.05)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(139, 92, 246, 0.1)'  }}>
                                                <div style={{  fontSize: '0.7rem', color: '#a78bfa', textTransform: 'uppercase', marginBottom: '4px', fontWeight: 'bold'  }}>Risk Justification</div>
                                                <div style={{  fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'  }}>
                                                    "{gap.riskJustification || 'None provided'}"
                                                </div>
                                            </div>
                                            <div style={{  display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '5px'  }}>
                                                <div style={{  fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px'  }}>
                                                    <User size={12} /> {gap.riskAcceptedBy || 'Unknown'}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </details>
                <style dangerouslySetInnerHTML={{__html: `
                    .risk-details summary::-webkit-details-marker { display: none; }
                `}} />
            </div>
         </div>
      )}
      {/* Validation Re-Test Modal */}
      {activeValidationGap && createPortal(
        <div className="animate-fade-in fixed-overlay" style={{  position: 'fixed', top: 0, left: 'var(--sidebar-width)', right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'  }} onClick={() => { setActiveValidationGap(null); setValidationFiles([]); }}>
          <div className="glass-panel" style={{  width: '500px', background: 'var(--bg-secondary)', border: '1px solid var(--accent-primary)', padding: '0'  }} onClick={e => e.stopPropagation()}>
            <div style={{  padding: '20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(16, 185, 129, 0.05)'  }}>
               <h2 style={{  margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)'  }}>Validate Remediation</h2>
               <button className="close-btn" onClick={() => { setActiveValidationGap(null); setValidationFiles([]); }}><X size={20} /></button>
            </div>
            <div style={{  padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px'  }}>
               <p style={{  color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0  }}>Record the results of the re-test. This will append the validation results to the original simulation report and automatically resolve this gap if considered optimal coverage.</p>
               
               <div>
                  <label style={{  display: 'block', marginBottom: '5px', fontSize: '0.9rem'  }}>TTP Tested</label>
                  <input className="ai-input" style={{  width: '100%', boxSizing: 'border-box', color: 'var(--text-secondary)', opacity: 0.8  }} value={activeValidationGap.ttp ? `${activeValidationGap.ttp} - ${getTTPName(activeValidationGap.ttp)}` : 'General/Unmapped Procedure'} disabled />
               </div>
               <div>
                  <label style={{  display: 'block', marginBottom: '5px', fontSize: '0.9rem'  }}>Original Simulation</label>
                  <input className="ai-input" style={{  width: '100%', boxSizing: 'border-box', color: 'var(--text-secondary)', opacity: 0.8  }} value={activeValidationGap.simulation} disabled />
               </div>
               <div>
                  <label style={{  display: 'block', marginBottom: '5px', fontSize: '0.9rem'  }}>Validation Outcome</label>
                  <ValidationOutcomeDropdown value={validationOutcome} onChange={setValidationOutcome} onlyOptimal={true} />
               </div>
               <div>
                  <label style={{  display: 'block', marginBottom: '5px', fontSize: '0.9rem'  }}>Date Remediated</label>
                  <input type="datetime-local" className="ai-input" style={{  width: '100%', boxSizing: 'border-box', color: 'var(--text-secondary)', colorScheme: 'dark'  }} value={validationDate} onChange={e => setValidationDate(e.target.value)} />
               </div>
               <div>
                  <label style={{  display: 'block', marginBottom: '5px', fontSize: '0.9rem'  }}>Validation Notes / Evidence</label>
                  <textarea className="ai-input" style={{  width: '100%', boxSizing: 'border-box', height: '80px', resize: 'vertical'  }} placeholder="e.g., Tested newly deployed Sigma rule, alert fired successfully in SIEM." value={validationNotes} onChange={e => setValidationNotes(e.target.value)} />
               </div>
               <div>
                  <div
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                              setValidationFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
                          }
                      }}
                      style={{  border: '1px dashed var(--glass-border)', padding: '20px', textAlign: 'center', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.85rem'  }}
                      onClick={() => document.getElementById('evidence-upload').click()}
                      className="hover-lift"
                  >
                      <input type="file" id="evidence-upload" multiple style={{  display: 'none'  }} onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                              setValidationFiles(prev => [...prev, ...Array.from(e.target.files)]);
                          }
                      }} />
                      Drag & drop screenshots/logs or click to browse
                  </div>
                  {validationFiles.length > 0 && (
                      <div style={{  display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px'  }}>
                          {validationFiles.map((file, idx) => (
                              <div key={idx} style={{  background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--success)', color: 'var(--success)', padding: '4px 10px', borderRadius: '16px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px'  }}>
                                  {file.name}
                                  <button className="close-btn" style={{  padding: '4px'  }} onClick={(e) => { e.stopPropagation(); setValidationFiles(prev => prev.filter((_, i) => i !== idx)); }}><X size={12} /></button>
                              </div>
                          ))}
                      </div>
                  )}
               </div>
            </div>
            <div style={{  padding: '20px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end', gap: '10px'  }}>
               <button className="btn" style={{  background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)'  }} onClick={() => { setActiveValidationGap(null); setValidationFiles([]); }}>Cancel</button>
               <button className="btn" disabled={!validationOutcome || !validationNotes.trim()} style={{  background: (!validationOutcome || !validationNotes.trim()) ? 'var(--bg-tertiary)' : 'var(--success)', color: (!validationOutcome || !validationNotes.trim()) ? 'var(--text-muted)' : '#fff', cursor: (!validationOutcome || !validationNotes.trim()) ? 'not-allowed' : 'pointer'  }} onClick={async () => {
                   console.log("Submit Validation clicked. Outcome:", validationOutcome, "Notes:", validationNotes);
                   try {
                       const finalNotes = validationNotes + (validationFiles.length > 0 ? `\n\n[Attached Evidence: ${validationFiles.map(f => f.name).join(', ')}]` : '');
                       let resolved = false;
                       if (updateExerciseValidation) {
                           console.log("Calling updateExerciseValidation...");
                           resolved = await updateExerciseValidation(activeValidationGap, validationOutcome, finalNotes, validationDate ? new Date(validationDate).toISOString() : null);
                           console.log("updateExerciseValidation returned resolved:", resolved);
                       } else {
                           console.log("updateExerciseValidation is undefined!");
                       }
                       
                       setActiveValidationGap(null);
                       setValidationNotes('');
                       setValidationFiles([]);
                       
                       if (resolved) {
                           console.log("Adding success toast");
                           addToast("Gap Resolved successfully.", "success");
                       } else {
                           console.log("Adding warning toast");
                           addToast("Gap remains In Progress. Optimal coverage (Prevented/Alerted) is required to resolve.", "warning");
                       }
                   } catch (err) {
                       console.error("Error during Submit Validation:", err);
                   }
               }}>Submit Validation</button>
            </div>
          </div>
        </div>,
        document.getElementById('root')
      )}

      {/* Risk Acceptance Modal */}
      {showRiskModal && createPortal(
        <div className="animate-fade-in fixed-overlay" style={{  position: 'fixed', top: 0, left: 'var(--sidebar-width)', right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'  }} onClick={() => setShowRiskModal(false)}>
          <div className="glass-panel" style={{  width: '500px', background: 'var(--bg-secondary)', border: '1px solid #8b5cf6', padding: '0'  }} onClick={e => e.stopPropagation()}>
            <div style={{  padding: '20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(139, 92, 246, 0.05)'  }}>
               <h2 style={{  margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)'  }}>Accept Risk</h2>
               <button className="close-btn" onClick={() => setShowRiskModal(false)}><X size={20} /></button>
            </div>
            <div style={{  padding: '25px', display: 'flex', flexDirection: 'column', gap: '20px'  }}>
                <p style={{  color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0  }}>Accepting this risk means technical remediation is not feasible. This gap will be removed from the open queue but will continue to be tracked in your Security Posture.</p>
                <div>
                   <label style={{  display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500  }}><User size={14} color="#8b5cf6" /> Approving Authority <span style={{  color: 'var(--danger)'  }}>*</span></label>
                   <input className="ai-input" style={{  width: '100%', boxSizing: 'border-box'  }} placeholder="e.g. CISO, Risk Committee" value={riskForm.acceptedBy} onChange={e => setRiskForm({...riskForm, acceptedBy: e.target.value})} />
                </div>
                <div>
                   <label style={{  display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500  }}><FileText size={14} color="#8b5cf6" /> Risk Justification <span style={{  color: 'var(--danger)'  }}>*</span></label>
                   <textarea className="ai-input" style={{  width: '100%', boxSizing: 'border-box', height: '100px', resize: 'vertical'  }} placeholder="Provide business or technical rationale for accepting this gap..." value={riskForm.justification} onChange={e => setRiskForm({...riskForm, justification: e.target.value})} />
                </div>
            </div>
            <div style={{  padding: '20px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: 'rgba(0,0,0,0.2)'  }}>
               <button className="btn hover-lift" style={{  background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', padding: '10px 20px'  }} onClick={() => setShowRiskModal(false)}>Cancel</button>
               <button className="btn hover-lift" style={{  background: '#8b5cf6', color: '#fff', padding: '10px 25px'  }} onClick={() => {
                   if (!riskForm.acceptedBy || !riskForm.justification) {
                       addToast('Both Approving Authority and Justification are required.', 'warning');
                       return;
                   }
                   const gapToUpdate = gaps.find(g => String(g.id) === String(riskForm.gapId));
                   if (gapToUpdate) {
                       const gapTTPs = (gapToUpdate.ttp || '').split(',').map(t => t.trim());
                       
                       if (simulationSummaries[gapToUpdate.simulation] && simulationSummaries[gapToUpdate.simulation].testResults) {
                           const nextSims = JSON.parse(JSON.stringify(simulationSummaries));
                           nextSims[gapToUpdate.simulation].testResults.forEach(p => {
                               if ((p.ttps || []).some(t => gapTTPs.includes(t)) || p.name === gapToUpdate.finding) {
                                   p.outcome = 'Missed';
                                   p.coverageRating = 'None';
                               }
                           });
                           setSimulationSummaries(nextSims);
                           if (dbAdapter && typeof dbAdapter.saveData === 'function') {
                               dbAdapter.saveData('simulationSummaries', nextSims);
                           }
                       }

                       (async () => {
                            let allEx = [];
                            if (dbAdapter && typeof dbAdapter.fetchData === 'function' && dbAdapter.type === 'local') {
                                allEx = await dbAdapter.fetchData('exercises') || [];
                            } else {
                                allEx = Object.values(allExercisesData);
                            }
                            
                            let modifiedExercises = [];
                            const updatedAllExercises = allEx.map(ex => {
                                if (gapTTPs.includes(ex.ttp) && ex.simulation === gapToUpdate.simulation) {
                                    const updated = { ...ex, status: 'exception' };
                                    modifiedExercises.push(updated);
                                    return updated;
                                }
                                return ex;
                            });

                            if (dbAdapter && typeof dbAdapter.saveData === 'function') {
                                await dbAdapter.saveData('exercises', updatedAllExercises);
                            }

                            setAllExercisesData(prevMap => {
                                const nextMap = { ...prevMap };
                                updatedAllExercises.forEach(ex => {
                                    nextMap[ex.id] = ex;
                                });
                                return nextMap;
                            });

                            setExercises(prev => prev.map(ex => {
                                const found = updatedAllExercises.find(e => e.id === ex.id);
                                return found ? found : ex;
                            }));

                            if (dbAdapter && typeof dbAdapter.updateExercise === 'function') {
                                for (const ex of modifiedExercises) {
                                    if (ex.id) await dbAdapter.updateExercise(ex.id, ex);
                                }
                            }
                        })();
                   }
                   updateGap(riskForm.gapId, { status: 'Risk Accepted', riskAcceptedBy: riskForm.acceptedBy, riskJustification: riskForm.justification, riskAcceptedDate: new Date().toISOString() });
                   setShowRiskModal(false);
               }}>Accept Risk</button>
            </div>
          </div>
        </div>,
        document.getElementById('root')
      )}

      {/* Gap Details Modal Overlay */}
      {selectedGapId && createPortal(
        <div className="animate-fade-in fixed-overlay" style={{  position: 'fixed', top: 0, left: 'var(--sidebar-width)', right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'  }} onClick={() => setSelectedGapId(null)}>
           <div className="glass-panel slide-in-staggered responsive-modal" style={{  background: 'rgba(10,11,16,0.6)', backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)', border: '1px solid var(--glass-border)', boxShadow: '0 0 50px rgba(0,0,0,0.8)', overflow: 'hidden', borderRadius: '12px', padding: '0', position: 'relative'  }} onClick={e => e.stopPropagation()}>
               <div style={{  padding: '20px'  }}>
                   <GapDetails gapIdProp={selectedGapId} onClose={() => setSelectedGapId(null)} onValidate={(gapObj) => { setSelectedGapId(null); setActiveValidationGap(gapObj); }} />
               </div>
           </div>
        </div>,
        document.getElementById('root')
      )}

    </div>
  );
}
