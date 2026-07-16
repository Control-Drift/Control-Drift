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
import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext } from '../../AppContext';
import { ArrowLeft, ArrowRight, Clock, Target, Crosshair, AlertCircle, Edit3, Link as LinkIcon, Sparkles, Terminal, X, User, FileText, Shield, ShieldAlert, ChevronDown, Info, CheckSquare, Check, Plus, CornerDownLeft, Activity, Code, Eye, EyeOff, Server } from 'lucide-react';
import ValidationOutcomeDropdown from '../dropdowns/ValidationOutcomeDropdown';
import { useToast } from '../ui/Toast';
import CodeStudio from '../pages/CodeStudio';
import RichMarkdownEditor from '../ui/RichMarkdownEditor';

const FormattedOutcome = ({ outcome, strikeThrough = false }) => {
    if (!outcome) return <span className="status-unknown" style={{ padding: '4px 10px', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 'bold' }}>Unknown</span>;
    
    const isRetest = outcome.includes('->') || outcome.includes('➔');
    if (isRetest) {
        const parts = outcome.split(/->|➔/);
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <FormattedOutcome outcome={parts[0].trim()} strikeThrough={true} />
                <ArrowRight size={14} color="var(--text-muted)" />
                <FormattedOutcome outcome={parts[1].trim()} />
            </div>
        );
    }

    let stat = 'na';
    const lower = outcome.toLowerCase().trim();
    if (lower === 'prevented & alerted' || lower === 'optimal') stat = 'high';
    else if (lower.includes('prevented')) stat = 'prevented';
    else if (lower.includes('alerted')) stat = 'alerted';
    else if (lower.includes('logged') || lower.includes('partial')) stat = 'medium';
    else if (lower.includes('missed') || lower.includes('none')) stat = 'low';
    
    return <span className={`status-${stat}`} style={{ padding: '4px 10px', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: '1', textDecoration: strikeThrough ? 'line-through' : 'none', opacity: strikeThrough ? 0.7 : 1 }}>{outcome.replace('✓', '').trim()}</span>;
};

    const renderTechnicalDetails = (remediationStr, gap, proc) => {
        let effectiveCoverage = gap?.coverageRating;
        
        let currentOutcome = gap?.outcome ? gap.outcome.replace(/ z" .* o"/g, '').trim() : '';
        if (currentOutcome.includes('->')) currentOutcome = currentOutcome.split('->').pop().trim();
        else if (currentOutcome.includes('➔')) currentOutcome = currentOutcome.split('➔').pop().trim();

        if (gap?.status === 'Resolved') {
            effectiveCoverage = 'Optimal';
        } else if (!effectiveCoverage || effectiveCoverage.toLowerCase() === 'none' || effectiveCoverage === 'Auto-Calculate') {
            if (currentOutcome === 'Missed') effectiveCoverage = 'No';
            else if (currentOutcome === 'Logged') effectiveCoverage = 'Partial';
            else if (currentOutcome === 'Prevented' || currentOutcome === 'Alerted' || currentOutcome === 'Prevented & Alerted') effectiveCoverage = 'Optimal';
            else effectiveCoverage = 'No';
        }

        if (effectiveCoverage === 'None' || effectiveCoverage?.toLowerCase() === 'none') {
            effectiveCoverage = 'No';
        }

    if (!remediationStr) return null;
    const events = remediationStr.split(/(?=(?:^|\n)Event:\s+)/).map(e => e.trim()).filter(Boolean);
    
    if (events.length > 0 && !events[0].startsWith('Event:')) {
        return (
             <div style={{  background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '12px', border: '1px solid var(--glass-border)', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.2)', color: 'var(--text-secondary)'  }}>
                 <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.5fr)', gap: '20px', alignItems: 'flex-start', width: '100%', marginBottom: '20px' }}>
                     <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                         <span style={{  display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold'  }}><Activity size={14} color="var(--accent-primary)" /> Outcome</span>
                         <div style={{ display: 'flex', alignItems: 'center', minHeight: '26px', wordBreak: 'break-word' }}>
                             <FormattedOutcome outcome={proc?.outcome || gap?.outcome} />
                         </div>
                     </div>
                     {gap?.coverageRating && (
                         <div style={{ textAlign: 'left', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                             <div style={{  fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '6px', letterSpacing: '1px', fontWeight: 'bold'  }}>
                                 <CheckSquare size={14} color="var(--accent-primary)" /> Coverage Rating
                                 <span title="A standardized measure of detection quality based on the outcome." style={{ display: 'inline-flex', cursor: 'help' }}>
                                     <Info size={14} style={{ opacity: 0.7 }} />
                                 </span>
                             </div>
                             <div style={{ display: 'flex', alignItems: 'center', minHeight: '26px' }}>
                                 <div style={{  
                                     color: effectiveCoverage === 'Optimal' ? 'var(--success)' : 
                                            effectiveCoverage === 'Partial' ? 'var(--warning)' : 
                                            effectiveCoverage === 'Minimal' ? 'var(--minimal)' : 'var(--danger)', 
                                     fontWeight: 'bold',
                                     background: 'rgba(255,255,255,0.05)',
                                     padding: '4px 10px',
                                     borderRadius: '4px',
                                     fontSize: '0.85rem',
                                     lineHeight: '1',
                                     display: 'inline-flex',
                                     alignItems: 'center',
                                     justifyContent: 'center'
                                 }}>
                                     {effectiveCoverage} Coverage
                                 </div>
                             </div>
                         </div>
                     )}
                     <div style={{ textAlign: 'left', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                         <div style={{  fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '6px', letterSpacing: '1px', fontWeight: 'bold'  }}>
                             <Shield size={14} color="var(--accent-primary)" /> Security Controls
                         </div>
                         <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', minHeight: '26px' }}>
                             {gap?.securityControls && gap.securityControls.length > 0 ? (
                                 gap.securityControls.map(sc => (
                                     <span key={sc} style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '4px 10px', borderRadius: '4px', fontSize: '0.85rem', color: '#60a5fa', fontWeight: 'bold', wordBreak: 'break-word', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: '1' }}>
                                         {sc}
                                     </span>
                                 ))
                             ) : (
                                 <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', lineHeight: '1' }}>None Specified</span>
                             )}
                         </div>
                     </div>
                 </div>
                 {remediationStr.split('\n').map((line, i) => {
                     if (line.startsWith('Execution:')) {
                         return <div key={i} style={{  marginBottom: '10px', display: 'flex', gap: '12px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px'  }}><strong style={{  color: 'var(--danger)', width: '170px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px'  }}><Crosshair size={14} /> Red Team Notes:</strong> <span style={{ flex: 1, color: 'var(--text-primary)', lineHeight: '1.5' }}>{line.substring(10).trim()}</span></div>;
                     } else if (line.startsWith('Detection:')) {
                         return <div key={i} style={{  marginBottom: '10px', display: 'flex', gap: '12px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px'  }}><strong style={{  color: '#3b82f6', width: '170px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px'  }}><Shield size={14} /> Blue Team Notes:</strong> <span style={{ flex: 1, color: 'var(--text-primary)', lineHeight: '1.5' }}>{line.substring(10).trim()}</span></div>;
                     } else if (line.startsWith('Expected:')) {
                         return <div key={i} style={{  marginBottom: '10px', display: 'flex', gap: '12px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px'  }}><strong style={{  color: 'var(--accent-secondary)', width: '130px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px'  }}><Check size={14} /> Expected:</strong> <span style={{ flex: 1, color: 'var(--text-primary)', lineHeight: '1.5' }}>{line.substring(9).trim()}</span></div>;
                     }
                     return <div key={i} style={{ marginBottom: '8px' }}>{line}</div>;
                 })}
             </div>
        );
    }

    return (
        <div style={{  display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px'  }}>
            {events.map((evt, i) => {
                let name = 'Unknown Event';
                let outcome = 'Unknown';
                let execNotes = 'No execution notes provided.';
                let detectNotes = 'No detection notes provided.';
                let expectedNotes = 'N/A';

                const eventMatch = evt.match(/Event:\s*(.*?)(?:\s+\[(.*?)\])?(?=\n|$)/);
                if (eventMatch) {
                    name = eventMatch[1].trim();
                    if (eventMatch[2]) outcome = eventMatch[2].trim();
                }
                
                const execMatch = evt.match(/Execution:\s*([\s\S]*?)(?=\n(?:Detection:|Expected:|Event:)|$)/);
                if (execMatch) execNotes = execMatch[1].trim();
                
                const detectMatch = evt.match(/Detection:\s*([\s\S]*?)(?=\n(?:Execution:|Expected:|Event:)|$)/);
                if (detectMatch) detectNotes = detectMatch[1].trim();
                
                const expectedMatch = evt.match(/Expected:\s*([\s\S]*?)(?=\n(?:Execution:|Detection:|Event:)|$)/);
                if (expectedMatch) expectedNotes = expectedMatch[1].trim();

                return (
                    <div key={i} style={{  background: 'rgba(0,0,0,0.4)', border: '1px solid var(--glass-border)', borderRadius: '6px', padding: '12px'  }}>
                        <div style={{  display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px'  }}>
                            <strong style={{  color: 'var(--text-primary)', fontSize: '0.95rem'  }}>
                                {name}
                                {outcome && (outcome.includes('->') || outcome.includes('➔')) && (
                                    <span style={{  marginLeft: '10px', fontSize: '0.7rem', color: '#059669', background: 'rgba(5, 150, 105, 0.15)', padding: '2px 8px', borderRadius: '12px', verticalAlign: 'middle', border: '1px solid rgba(5, 150, 105, 0.3)'  }}>Re-Tested ✓</span>
                                )}
                            </strong>
                            <FormattedOutcome outcome={outcome} />
                        </div>
                        <div style={{  display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', fontSize: '0.8rem'  }}>
                            <div>
                                <span style={{  display: 'block', color: 'var(--text-primary)', fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: '4px', fontWeight: 'bold'  }}>Expected Outcome</span>
                                <span style={{ color: 'var(--text-secondary)', lineHeight: '1.5', display: 'block', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{expectedNotes}</span>
                            </div>
                            <div>
                                <span style={{  display: 'block', color: 'var(--danger)', fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: '4px', fontWeight: 'bold'   }}>Red Team Notes</span>
                                <span style={{ color: 'var(--text-secondary)', lineHeight: '1.5', display: 'block', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{execNotes}</span>
                            </div>
                            <div>
                                <span style={{  display: 'block', color: '#3b82f6', fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: '4px', fontWeight: 'bold'   }}>Blue Team Notes</span>
                                {detectNotes.includes('**[Validation Re-Test]**') ? (
                                    <>
                                        <span style={{ color: 'var(--text-secondary)', lineHeight: '1.5', display: 'block', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{detectNotes.split('**[Validation Re-Test]**')[0].trim()}</span>
                                        <div style={{ marginTop: '12px', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '10px', borderRadius: '6px' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success)', fontWeight: 'bold', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '6px' }}><ShieldCheck size={14} /> Validation Re-Test</span>
                                            <span style={{ display: 'block', whiteSpace: 'pre-wrap', color: 'var(--text-primary)', lineHeight: '1.5' }}>{detectNotes.split('**[Validation Re-Test]**')[1].trim()}</span>
                                        </div>
                                    </>
                                ) : (
                                    <span style={{ color: 'var(--text-secondary)', lineHeight: '1.5', display: 'block', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{detectNotes}</span>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

/**
 * GapDetails Component
 * 
 * A modal slide-out panel that displays the deep, granular details of a specific Gap ticket.
 * 
 * CORE FEATURES:
 * 1. Provides editable fields for Resolution Notes, Tags, and Status.
 * 2. Allows the user to trigger an inline Validation (re-test) workflow.
 * 3. Integrates with the `updateExerciseValidation` context method to push
 *    successful re-tests back into the historical Exercise metrics.
 * 
 * @param {Object} props
 * @param {string} props.gapIdProp - Optional ID passed in for standalone mode.
 * @param {Function} props.onClose - Callback to close the side panel.
 * @param {Function} props.onValidate - Callback after validation finishes.
 */
export default function GapDetails({ gapIdProp, onClose, onValidate }) {
    const { id } = useParams();
    const navigate = useNavigate();
    const { gaps, setExercises, mitreData, simulationSummaries, generateAIContentStream, aiSettings, updateExerciseValidation, setActiveAiContext, requestSuccessToast, isReadOnly, updateGap, deleteGap, confirmAction } = useAppContext();
    const { addToast } = useToast();

    const getTTPName = (id) => {
        if (!mitreData) return '';
        for (const tactic in mitreData) {
            const tech = mitreData[tactic].techniques.find(t => t.id === id);
            if (tech) return tech.name;
            for (const t2 of mitreData[tactic].techniques) {
                if (t2.subTechniques) {
                    const sub = t2.subTechniques.find(s => s.id === id);
                    if (sub) return sub.name;
                }
            }
        }
        return '';
    };

    const currentId = gapIdProp || id;
    const gap = gaps.find(g => String(g.id) === String(currentId));

    const [activeTab, setActiveTab] = useState('Overview');
    const [actionItems, setActionItems] = useState('');
    const [stakeholders, setStakeholders] = useState([]);
    const [ticketLink, setTicketLink] = useState('');
    const [aiRemediation, setAiRemediation] = useState('');
    const [showCodeStudio, setShowCodeStudio] = useState(false);

    const [showRiskModal, setShowRiskModal] = useState(false);
    const [riskForm, setRiskForm] = useState({ justification: '', acceptedBy: '' });
    
    const [todoList, setTodoList] = useState([]);
    const [newTodo, setNewTodo] = useState('');
    
    const [saveStatusTracking, setSaveStatusTracking] = useState(false);
    const [saveStatusStrategy, setSaveStatusStrategy] = useState(false);
    const [saveStatusRisk, setSaveStatusRisk] = useState(false);
    
    const [riskJustificationLocal, setRiskJustificationLocal] = useState('');
    const [riskAcceptedByLocal, setRiskAcceptedByLocal] = useState('');
    const [isEditingRisk, setIsEditingRisk] = useState(false);

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [showPayload, setShowPayload] = useState(false);
    
    // Standalone Validation Modal State
    const [showValidationModal, setShowValidationModal] = useState(false);
    const [validationOutcome, setValidationOutcome] = useState('');
    const [validationNotes, setValidationNotes] = useState('');
    const [validationDate, setValidationDate] = useState(() => { const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); return now.toISOString().slice(0, 16); });
    const [validationFiles, setValidationFiles] = useState([]);

    useEffect(() => {
        if (showValidationModal) {
            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            setValidationDate(now.toISOString().slice(0, 16));
        }
    }, [showValidationModal]);

    useEffect(() => {
        if (gap) {
            setActionItems(gap.actionItems || '');
            const s = gap.stakeholders || [];
            setStakeholders(Array.isArray(s) ? s : s.split(',').map(x => x.trim()).filter(Boolean));
            setTicketLink(gap.ticketLink || '');
            setAiRemediation(gap.aiRemediation || '');
            setTodoList(gap.todoList || []);
            setRiskJustificationLocal(gap.riskJustification || '');
            setRiskAcceptedByLocal(gap.riskAcceptedBy || '');
        }
    }, [gap]);

    useEffect(() => {
        if (activeTab === 'Code Studio' && gap) {
            setActiveAiContext({ ttp: gap.ttp, finding: gap.finding });
        }
    }, [activeTab, gap, setActiveAiContext]);

    if (!gap) {
        return (
            <div style={{  padding: '40px', textAlign: 'center', color: 'var(--text-muted)'   }}>
                <AlertCircle size={48} style={{  marginBottom: '20px', opacity: 0.5  }} />
                <h2>Gap Not Found</h2>
                <p>The gap you are looking for does not exist or has been deleted.</p>
                <button className="btn" onClick={() => onClose ? onClose() : navigate('/gaps')} style={{  marginTop: '20px'  }}>Return to Gap Tracker</button>
            </div>
        );
    }

    const updateGapField = (field, value) => {
        if (isReadOnly) return;
        updateGap(gap.id, { [field]: value });
    };

    const handleSaveTracking = async () => {
        if (isReadOnly) return;
        setSaveStatusTracking(true);
        try {
            await updateGap(gap.id, { stakeholders, ticketLink, aiRemediation, todoList });
            requestSuccessToast("Tracking details saved successfully.");
        } catch (e) {
            // Error handled by hook
        } finally {
            setTimeout(() => setSaveStatusTracking(false), 2000);
        }
    };
    
    const handleSaveStrategy = async () => {
        if (isReadOnly) return;
        setSaveStatusStrategy(true);
        try {
            await updateGap(gap.id, { aiRemediation });
            requestSuccessToast("Remediation strategy saved successfully.");
        } catch (e) {
            // Error handled by hook
        } finally {
            setTimeout(() => setSaveStatusStrategy(false), 2000);
        }
    };

    const handleSaveRiskTab = async () => {
        if (isReadOnly) return;
        setSaveStatusRisk(true);
        try {
            await updateGap(gap.id, { riskJustification: riskJustificationLocal, riskAcceptedBy: riskAcceptedByLocal });
            requestSuccessToast("Risk acceptance details updated.");
            setIsEditingRisk(false);
        } catch (e) {
            // Error handled by hook
        } finally {
            setTimeout(() => setSaveStatusRisk(false), 2000);
        }
    };

    const handleStatusChange = (e) => {
        if (isReadOnly) return;
        const newStatus = e.target.value;
        
        const proceedWithStatusChange = (statusToSet) => {
            if (gap.status === 'Resolved') {
                setExercises(prev => prev.map(ex => {
                    const gapTTPs = (gap.ttp || '').split(',').map(t => t.trim());
                    if (gapTTPs.includes(ex.ttp) && ex.simulation === gap.simulation) {
                        return { ...ex, status: 'low' };
                    }
                    return ex;
                }));
            }
            const updates = { status: statusToSet };
            if (statusToSet !== 'Resolved') updates.resolvedDate = null;
            if (statusToSet === 'Risk Accepted' && gap.status !== 'Risk Accepted') {
                updates.riskAcceptedDate = new Date().toISOString();
            }
            if (statusToSet !== 'Risk Accepted') {
                updates.riskJustification = null;
                updates.riskAcceptedBy = null;
                updates.riskAcceptedDate = null;
            }
            updateGap(gap.id, updates);
        };

        if (newStatus === 'Risk Accepted' && gap.status !== 'Risk Accepted') {
            proceedWithStatusChange(newStatus);
        } else if (newStatus === 'Resolved') {
            if (gap.status === 'Risk Accepted') {
                addToast('Risk Accepted gaps cannot be directly Resolved. Please revoke risk acceptance first (move to In Progress).', 'warning');
                return;
            }
            if (onValidate) {
                onValidate(gap);
            } else {
                setShowValidationModal(true);
            }
        } else {
            if (gap.status === 'Risk Accepted' && newStatus !== 'Risk Accepted') {
                confirmAction("Moving this gap out of 'Risk Accepted' will clear its risk justification logs. Are you sure you want to proceed?", () => {
                    proceedWithStatusChange(newStatus);
                });
            } else {
                proceedWithStatusChange(newStatus);
            }
        }
    };

    const getTTPNames = (idString) => {
        if (!mitreData || !idString) return '';
        const tacticIds = idString.split(',').map(t => t.trim());
        const names = [];
        for (const tacticId of tacticIds) {
            let found = false;
            for (const tactic in mitreData) {
                const tech = mitreData[tactic].techniques.find(t => t.id === tacticId);
                if (tech) {
                    names.push(tech.name);
                    found = true;
                    break;
                }
                for (const t2 of mitreData[tactic].techniques) {
                    if (t2.subTechniques) {
                        const sub = t2.subTechniques.find(s => s.id === tacticId);
                        if (sub) {
                            names.push(sub.name);
                            found = true;
                            break;
                        }
                    }
                }
                if (found) break;
            }
        }
        return [...new Set(names)].join(', ');
    };

    const ttpNamesStr = getTTPNames(gap.ttp);
    const campSumm = simulationSummaries[gap.simulation];
    const proc = campSumm?.testResults?.find(p => p.name === gap.finding);
    const daysOpen = Math.floor((new Date() - new Date(gap.createdDate || Date.now())) / (1000 * 60 * 60 * 24));



    let tabs = ['Overview', 'Remediation Strategy', 'Code Studio', 'Tracking'];

    return (
        <div className="animate-fade-in" style={{  padding: gapIdProp ? '0 20px 40px 20px' : '0 0 40px 0', width: activeTab === 'Code Studio' ? '98vw' : '1000px', maxWidth: '100%', margin: '0 auto', transition: 'width 0.3s ease'  }}>
            {/* Header */}
            <div style={{  display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px'  }}>
                <button className="btn" onClick={() => onClose ? onClose() : navigate('/gaps')} style={{  background: 'transparent', border: '1px solid var(--glass-border)', padding: '8px', color: 'var(--text-secondary)'  }}>
                    <ArrowLeft size={20} />
                </button>
                <div style={{  flex: 1  }}>
                    <div style={{  display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px'  }}>
                        <span style={{  fontSize: '0.8rem', color: 'var(--text-muted)'  }}>{new Date(gap.createdDate).toLocaleDateString()}</span>
                        <span style={{  fontSize: '0.8rem', color: 'var(--text-muted)'  }}>•</span>
                        <span style={{  fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px'  }}><Clock size={12} /> {daysOpen} days open</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {gap.displayId && <div style={{ color: 'var(--accent-secondary)', fontSize: '0.9rem', fontWeight: 'bold', letterSpacing: '1.5px' }}>{gap.displayId}</div>}
                        <h1 style={{  margin: 0, fontSize: '1.8rem', color: 'var(--text-primary)', wordBreak: 'break-word', overflowWrap: 'anywhere', lineHeight: '1.3'  }}>
                            {gap.finding}
                        </h1>
                    </div>
                </div>
                <div style={{  display: 'flex', gap: '10px', alignItems: 'center'  }}>

                    {gap.priorityScore !== undefined && (
                        <div style={{  background: 'rgba(0,0,0,0.3)', padding: '10px 15px', borderRadius: '8px', border: '1px solid var(--glass-border)', textAlign: 'center'  }}>
                            <div style={{  fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px'  }}>Risk Score</div>
                            <strong style={{  color: gap.status === 'Resolved' ? 'var(--text-muted)' : (gap.priorityScore >= 80 ? 'var(--danger)' : gap.priorityScore >= 50 ? 'var(--warning)' : 'var(--success)')  }}>{gap.status === 'Resolved' ? 'N/A' : gap.priorityScore}</strong>
                        </div>
                    )}
                    {gap.severity && (
                        <div style={{  background: 'rgba(0,0,0,0.3)', padding: '10px 15px', borderRadius: '8px', border: '1px solid var(--glass-border)', textAlign: 'center'  }}>
                            <div style={{  fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px'  }}>Severity</div>
                            <strong style={{  color: gap.severity === 'Critical' ? 'var(--severity-critical)' : gap.severity === 'High' ? 'var(--severity-high)' : gap.severity === 'Medium' ? 'var(--severity-medium)' : gap.severity === 'Low' ? 'var(--severity-low)' : 'var(--text-primary)'  }}>{gap.severity}</strong>
                        </div>
                    )}
                    <div style={{  background: 'rgba(0,0,0,0.3)', padding: '10px 15px', borderRadius: '8px', border: '1px solid var(--glass-border)', position: 'relative'  }}>
                        <div style={{  fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px'  }}>Status</div>
                        
                        <div style={{ position: 'relative', display: 'flex', gap: '8px' }}>
                            <button 
                                onClick={() => gap.status !== 'Resolved' && setIsDropdownOpen(!isDropdownOpen)}
                                disabled={gap.status === 'Resolved'}
                                style={{  
                                    padding: '6px 12px', fontSize: '0.9rem', width: 'auto', background: 'rgba(0,0,0,0.5)', 
                                    border: '1px solid var(--glass-border)', borderRadius: '6px',
                                    color: gap.status === 'Open' ? 'var(--danger)' : gap.status === 'In Progress' ? 'var(--warning)' : gap.status === 'Risk Accepted' ? '#a78bfa' : 'var(--success)', 
                                    fontWeight: 'bold', cursor: gap.status === 'Resolved' ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                                    opacity: gap.status === 'Resolved' ? 0.8 : 1
                                 }}
                            >
                                {gap.status.toUpperCase()}
                                {gap.status !== 'Resolved' && <ChevronDown size={14} style={{  transition: 'transform 0.2s', transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)'  }} />}
                            </button>
                            {isDropdownOpen && (
                                <div style={{  
                                    position: 'absolute', top: '100%', right: 0, marginTop: '8px',
                                    background: 'rgba(10,11,16,0.95)', border: '1px solid var(--glass-border)',
                                    borderRadius: '8px', padding: '5px', minWidth: '180px',
                                    boxShadow: '0 10px 30px rgba(0,0,0,0.8)', zIndex: 100,
                                    display: 'flex', flexDirection: 'column', gap: '2px', backdropFilter: 'blur(10px)'
                                 }}>
                                    {['Open', 'In Progress', 'Risk Accepted', 'Resolved'].map(opt => (
                                        <div 
                                            key={opt}
                                            onClick={() => {
                                                setIsDropdownOpen(false);
                                                handleStatusChange({ target: { value: opt } });
                                            }}
                                            style={{  
                                                padding: '8px 12px', borderRadius: '4px', cursor: 'pointer',
                                                fontSize: '0.85rem', fontWeight: 'bold',
                                                color: opt === 'Open' ? 'var(--danger)' : opt === 'In Progress' ? 'var(--warning)' : opt === 'Risk Accepted' ? '#a78bfa' : 'var(--success)',
                                                background: gap.status === opt ? 'rgba(255,255,255,0.05)' : 'transparent',
                                                transition: 'background 0.2s'
                                             }}
                                            onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                            onMouseOut={e => e.currentTarget.style.background = gap.status === opt ? 'rgba(255,255,255,0.05)' : 'transparent'}
                                        >
                                            {opt.toUpperCase()}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {gap.ttp && (
                <div style={{  marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '10px'  }}>
                    <span style={{  background: 'rgba(156, 39, 176, 0.15)', border: '1px solid rgba(156, 39, 176, 0.3)', color: 'var(--text-primary)', padding: '6px 12px', borderRadius: '16px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '8px', maxWidth: '100%'  }}>
                        <strong style={{  color: 'var(--accent-primary)', whiteSpace: 'nowrap'  }}>{gap.ttp}</strong>
                        <span style={{  color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'  }} title={ttpNamesStr}>{ttpNamesStr || gap.ttp}</span>
                    </span>
                </div>
            )}

            {/* Tab Navigation */}
            <div style={{  display: 'flex', borderBottom: '1px solid var(--glass-border)', marginBottom: '25px', gap: '25px'  }}>
                {tabs.map(tab => (
                    <div 
                        key={tab} 
                        onClick={() => setActiveTab(tab)}
                        style={{  padding: '10px 5px', color: activeTab === tab ? (tab === 'Risk Acceptance' ? '#a78bfa' : 'var(--accent-secondary)') : 'var(--text-muted)', borderBottom: `2px solid ${activeTab === tab ? (tab === 'Risk Acceptance' ? '#a78bfa' : 'var(--accent-secondary)') : 'transparent'}`, cursor: 'pointer', fontWeight: activeTab === tab ? 'bold' : 'normal', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px'  }}
                    >
                        {tab === 'Overview' && <Target size={16} />}
                        {tab === 'Remediation Strategy' && <FileText size={16} />}
                        {tab === 'Code Studio' && <Terminal size={16} />}
                        {tab === 'Tracking' && <Edit3 size={16} />}
                        {tab === 'Risk Acceptance' && <ShieldAlert size={16} />}
                        {tab}
                    </div>
                ))}
            </div>

            {/* Tab Content Areas */}
            <div className="glass-panel" style={{  padding: '30px', minHeight: '400px'  }}>
                
                {/* OVERVIEW TAB */}
                {activeTab === 'Overview' && (
                    <div className="animate-fade-in" style={{  display: 'flex', flexDirection: 'column', gap: '20px'  }}>
                        {(gap.status === 'Risk Accepted' || gap.riskJustification) && (
                            <div style={{  background: 'rgba(168, 85, 247, 0.05)', border: '1px solid #8b5cf6', borderRadius: '8px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px'  }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <h3 style={{  margin: '0 0 10px 0', color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '8px'  }}>
                                            <ShieldAlert size={20} /> Formally Accepted Risk
                                        </h3>
                                        <p style={{  margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5'  }}>
                                            This gap has been marked as an accepted risk. Technical remediation is not currently planned.
                                        </p>
                                    </div>
                                    {!isReadOnly && !isEditingRisk && (
                                        <button 
                                            className="btn hover-lift" 
                                            onClick={() => setIsEditingRisk(true)}
                                            style={{ background: 'transparent', border: '1px solid rgba(168, 85, 247, 0.5)', color: '#a78bfa', fontSize: '0.85rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                                        >
                                            <Edit3 size={14} /> Edit Details
                                        </button>
                                    )}
                                </div>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '6px' }}>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Approving Authority {isEditingRisk && <span style={{ color: 'var(--danger)' }}>*</span>}</div>
                                        {isEditingRisk ? (
                                            <input 
                                                className="ai-input focus-ring" 
                                                style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(139, 92, 246, 0.5)', transition: 'all 0.2s', padding: '10px 12px' }}
                                                value={riskAcceptedByLocal}
                                                placeholder="e.g. CISO, Risk Committee"
                                                onChange={(e) => setRiskAcceptedByLocal(e.target.value)}
                                            />
                                        ) : (
                                            <div style={{ color: 'var(--text-primary)', fontWeight: 'bold', fontSize: '1.05rem', padding: '5px 0' }}>{gap.riskAcceptedBy || 'Not Specified'}</div>
                                        )}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Justification {isEditingRisk && <span style={{ color: 'var(--danger)' }}>*</span>}</div>
                                        {isEditingRisk ? (
                                            <textarea 
                                                className="ai-input focus-ring" 
                                                style={{ width: '100%', boxSizing: 'border-box', height: '80px', resize: 'vertical', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(139, 92, 246, 0.5)', transition: 'all 0.2s', padding: '10px 12px' }}
                                                value={riskJustificationLocal}
                                                placeholder="Provide business or technical rationale for accepting this gap..."
                                                onChange={(e) => setRiskJustificationLocal(e.target.value)}
                                            />
                                        ) : (
                                            <div style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: '1.5', padding: '5px 0' }}>{gap.riskJustification || 'No justification provided.'}</div>
                                        )}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        {gap.riskAcceptedDate ? `Accepted on: ${new Date(gap.riskAcceptedDate).toLocaleDateString()}` : ''}
                                    </div>
                                    {isEditingRisk && (
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <button className="btn hover-lift" onClick={() => {
                                                setIsEditingRisk(false);
                                                setRiskAcceptedByLocal(gap.riskAcceptedBy || '');
                                                setRiskJustificationLocal(gap.riskJustification || '');
                                            }} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', padding: '8px 16px' }}>
                                                Cancel
                                            </button>
                                            <button className="btn hover-lift" onClick={handleSaveRiskTab} disabled={saveStatusRisk} style={{ background: saveStatusRisk ? 'var(--success)' : '#8b5cf6', color: '#fff', padding: '8px 16px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.3s' }}>
                                                {saveStatusRisk ? <><Check size={16} /> Saved</> : 'Save Risk Details'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        <div style={{  display: 'block', marginBottom: '0'  }}>
                            <div style={{  background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '12px', border: '1px solid var(--glass-border)', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', justifyContent: 'center'  }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: '20px', alignItems: 'flex-start', width: '100%' }}>
                                    <div style={{ minWidth: 0 }}>
                                        <span style={{  display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold'  }}><Target size={14} color="var(--accent-primary)" /> Source Simulation</span>
                                        {gap.simulation && gap.simulation !== 'Manual Entry' ? (
                                            <span 
                                                onClick={() => navigate('/reports', { state: { simulation: gap.simulation, returnToGapId: currentId } })}
                                                className="hover-lift"
                                                style={{  color: 'var(--accent-secondary)', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'none', background: 'rgba(126,34,206,0.15)', padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(126,34,206,0.3)', display: 'inline-flex', alignItems: 'center', gap: '8px', alignSelf: 'flex-start', maxWidth: '100%', wordBreak: 'break-word'  }}
                                            >
                                                {gap.simulation} <ArrowRight size={16} style={{ flexShrink: 0 }} />
                                            </span>
                                        ) : (
                                            <strong style={{  color: 'var(--accent-secondary)', fontSize: '1.1rem', padding: '8px 0', display: 'block', wordBreak: 'break-word'  }}>{gap.simulation || 'Manual Entry'}</strong>
                                        )}
                                    </div>
                                    <div style={{ textAlign: 'left', minWidth: 0 }}>
                                        <div style={{  fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '6px', letterSpacing: '1px', fontWeight: 'bold'  }}>
                                            <Server size={14} color="var(--accent-primary)" /> Environment
                                        </div>
                                        <strong style={{  color: 'var(--text-primary)', fontSize: '1.1rem', display: 'block', wordBreak: 'break-word'  }}>{Array.isArray(gap.environment) ? gap.environment.join(', ') : (gap.environment || 'Unknown Environment')}</strong>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div style={{ marginTop: '0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px' }}>
                                <h4 style={{  margin: '0', color: 'var(--text-primary)', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px'  }}>
                                    <FileText size={18} color="var(--accent-primary)" />
                                    Technical Event Details
                                </h4>
                                {(proc?.payloadCode || gap.payloadCode || proc?.procedureSteps || gap.procedureSteps) && (
                                    <button 
                                        onClick={() => setShowPayload(!showPayload)} 
                                        className="btn hover-lift" 
                                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', padding: '6px 12px', fontSize: '0.85rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}
                                    >
                                        <Code size={16} /> {showPayload ? 'Hide' : 'View'} {(proc?.eventType === 'Payload' || gap.eventType === 'Payload' || (!proc?.eventType && !gap.eventType)) ? 'Payload' : 'Procedure'}
                                    </button>
                                )}
                            </div>
                            
                            {showPayload && (
                                <div className="animate-fade-in" style={{ background: '#0a0a0a', padding: '20px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '0.9rem', color: '#10b981', overflowX: 'auto', overflowY: 'auto', maxHeight: '300px', border: '1px solid rgba(16,185,129,0.3)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', marginBottom: '20px', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)' }}>
                                    <pre style={{  margin: 0, whiteSpace: 'pre-wrap'   }}>{proc?.payloadCode || gap.payloadCode || proc?.procedureSteps || gap.procedureSteps}</pre>
                                </div>
                            )}

                            {renderTechnicalDetails(gap.details, gap, proc)}
                        </div>
                    </div>
                )}

                {/* REMEDIATION TAB */}
                {activeTab === 'Remediation Strategy' && (
                    <div className="animate-fade-in" style={{  display: 'flex', flexDirection: 'column', gap: '25px'  }}>
                        <div style={{  display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: '15px'  }}>
                            <div>
                                <h3 style={{  margin: '0 0 5px 0', display: 'flex', alignItems: 'center', gap: '8px'  }}>
                                    <FileText size={20} color="var(--accent-secondary)" /> Remediation Strategy
                                </h3>
                                <p style={{  margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem'  }}>Draft and document the remediation strategy for this coverage gap.</p>
                            </div>
                            <button className="btn hover-lift" onClick={handleSaveStrategy} style={{  background: saveStatusStrategy ? 'var(--success)' : 'var(--accent-secondary)', color: '#000', padding: '8px 16px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.3s'  }}>
                                {saveStatusStrategy ? <><Check size={16} /> Saved!</> : 'Save Strategy'}
                            </button>
                        </div>
                        
                        <RichMarkdownEditor
                            value={aiRemediation}
                            onChange={(val) => setAiRemediation(val)}
                            placeholder="Draft your remediation strategy here..."
                            minHeight="300px"
                            readOnly={isReadOnly}
                            style={{ width: '100%' }}
                        />
                    </div>
                )}

                {/* STUDIO TAB */}
                {activeTab === 'Code Studio' && (
                    <div className="animate-fade-in" style={{ height: '65vh', minHeight: '600px', display: 'flex', flexDirection: 'column' }}>
                        <CodeStudio 
                            isStandalone={true} 
                            initialCode={gap.remediationCode || ''}
                            onSave={(ruleCode) => {
                                requestSuccessToast("Rule saved successfully.");
                                updateGap('remediationCode', ruleCode);
                            }}
                        />
                    </div>
                )}

                {/* TRACKING TAB */}
                {activeTab === 'Tracking' && (
                    <div className="animate-fade-in" style={{  display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '800px'  }}>
                        <h3 style={{  margin: '0 0 5px 0', display: 'flex', alignItems: 'center', gap: '8px'  }}>
                            <Edit3 size={20} color="var(--accent-primary)" /> Tracking Details
                        </h3>
                        <p style={{  margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '10px'  }}>Manage external tickets, action items, and assign stakeholders.</p>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', alignItems: 'start' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div style={{  display: 'flex', flexDirection: 'column', gap: '8px'  }}>
                                    <label style={{  fontSize: '0.9rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500  }}><LinkIcon size={16} color="var(--accent-secondary)" /> External Ticket Link</label>
                                    <input 
                                        className="ai-input" 
                                        placeholder="https://jira.company.com/browse/SEC-123" 
                                        value={ticketLink} 
                                        onChange={(e) => setTicketLink(e.target.value)} 
                                        style={{  padding: '12px'  }}
                                    />
                                    {ticketLink && ticketLink.startsWith('http') && (
                                        <a href={ticketLink} target="_blank" rel="noreferrer" style={{  fontSize: '0.85rem', color: 'var(--accent-secondary)', textDecoration: 'none', display: 'inline-block', marginTop: '5px'  }}>Open Ticket ↗</a>
                                    )}
                                </div>
                                
                                <div style={{  display: 'flex', flexDirection: 'column', gap: '8px'  }}>
                                    <label style={{  fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px'  }}><User size={16} color="var(--success)" /> Assigned Stakeholders</label>
                                    <div style={{  display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '5px'  }}>
                                        {stakeholders.map((st, idx) => (
                                            <div key={idx} style={{  display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', padding: '6px 12px', borderRadius: '20px', fontSize: '0.9rem', color: 'var(--text-primary)'  }}>
                                                {st}
                                                {!isReadOnly && (
                                                    <button onClick={() => {
                                                        const ns = stakeholders.filter((_, i) => i !== idx);
                                                        setStakeholders(ns);
                                                    }} style={{  background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center'  }}>
                                                        <X size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                        <input 
                                            id="stakeholder-input"
                                            className="ai-input" 
                                            placeholder={isReadOnly ? "No stakeholders assigned" : "Add stakeholder (press Enter to add)..."}
                                            style={{  padding: '12px', paddingRight: '40px', width: '100%', boxSizing: 'border-box'  }}
                                            disabled={isReadOnly}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && e.target.value.trim()) {
                                                    setStakeholders([...stakeholders, e.target.value.trim()]);
                                                    e.target.value = '';
                                                }
                                            }}
                                        />
                                        {!isReadOnly && (
                                            <div 
                                                onClick={() => {
                                                    const input = document.getElementById('stakeholder-input');
                                                    if (input && input.value.trim()) {
                                                        setStakeholders([...stakeholders, input.value.trim()]);
                                                        input.value = '';
                                                    }
                                                }}
                                                style={{ 
                                                    position: 'absolute', 
                                                    right: '8px', 
                                                    background: 'rgba(255,255,255,0.05)',
                                                    color: 'var(--text-muted)',
                                                    borderRadius: '4px',
                                                    padding: '4px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                }}
                                                onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-primary)'; e.currentTarget.style.color = '#000'; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                                            >
                                                <CornerDownLeft size={14} strokeWidth={2.5} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            <div style={{  display: 'flex', flexDirection: 'column', gap: '8px'  }}>
                                <label style={{  fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px'  }}>
                                    <CheckSquare size={16} color="var(--accent-primary)" /> Action Items Checklist
                                </label>
                                
                                {todoList.length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '4px' }}>
                                        {todoList.map((todo) => (
                                            <div 
                                                key={todo.id} 
                                                style={{ 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    gap: '12px', 
                                                    background: 'transparent', 
                                                    padding: '6px 8px', 
                                                    marginLeft: '-8px',
                                                    marginRight: '-8px',
                                                    borderRadius: '6px', 
                                                    transition: 'all 0.2s ease',
                                                    cursor: isReadOnly ? 'default' : 'pointer'
                                                }}
                                                onMouseEnter={e => {
                                                    e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                                                    const removeBtn = e.currentTarget.querySelector('.remove-btn');
                                                    if (removeBtn) removeBtn.style.opacity = '1';
                                                }}
                                                onMouseLeave={e => {
                                                    e.currentTarget.style.background = 'transparent';
                                                    const removeBtn = e.currentTarget.querySelector('.remove-btn');
                                                    if (removeBtn) removeBtn.style.opacity = '0';
                                                }}
                                                onClick={() => !isReadOnly && setTodoList(todoList.map(t => t.id === todo.id ? { ...t, completed: !todo.completed } : t))}
                                            >
                                                <div style={{ 
                                                    width: '16px', 
                                                    height: '16px', 
                                                    borderRadius: '4px', 
                                                    border: `1.5px solid ${todo.completed ? 'var(--success)' : 'var(--text-muted)'}`,
                                                    background: todo.completed ? 'var(--success)' : 'transparent',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    transition: 'all 0.2s ease',
                                                    flexShrink: 0
                                                }}>
                                                    {todo.completed && <Check size={12} color="#000" strokeWidth={3} />}
                                                </div>
                                                <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                                                    <span style={{ 
                                                        fontSize: '0.9rem', 
                                                        color: todo.completed ? 'var(--text-muted)' : 'var(--text-primary)', 
                                                        wordBreak: 'break-word', 
                                                        transition: 'all 0.2s ease', 
                                                        textDecoration: todo.completed ? 'line-through' : 'none'
                                                    }}>
                                                        {todo.text}
                                                    </span>
                                                </div>
                                                {!isReadOnly && (
                                                    <div
                                                        className="remove-btn"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setTodoList(todoList.filter(t => t.id !== todo.id));
                                                        }}
                                                        style={{ 
                                                            color: 'var(--text-muted)', 
                                                            padding: '4px', 
                                                            borderRadius: '4px', 
                                                            cursor: 'pointer',
                                                            opacity: 0,
                                                            transition: 'all 0.2s'
                                                        }}
                                                        onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                                                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                                                    >
                                                        <X size={14} />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                
                                {!isReadOnly && (
                                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                        <input 
                                            className="ai-input" 
                                            placeholder="Add action item (press Enter to add)..." 
                                            value={newTodo}
                                            onChange={(e) => setNewTodo(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && newTodo.trim()) {
                                                    setTodoList([...todoList, { id: Date.now().toString(), text: newTodo.trim(), completed: false }]);
                                                    setNewTodo('');
                                                }
                                            }}
                                            style={{ width: '100%', boxSizing: 'border-box', padding: '12px', paddingRight: '40px' }}
                                        />
                                        <div 
                                            onClick={() => {
                                                if (newTodo.trim()) {
                                                    setTodoList([...todoList, { id: Date.now().toString(), text: newTodo.trim(), completed: false }]);
                                                    setNewTodo('');
                                                }
                                            }}
                                            style={{ 
                                                position: 'absolute', 
                                                right: '8px', 
                                                background: newTodo.trim() ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)',
                                                color: newTodo.trim() ? '#000' : 'var(--text-muted)',
                                                borderRadius: '4px',
                                                padding: '4px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: newTodo.trim() ? 'pointer' : 'default',
                                                transition: 'all 0.2s',
                                                opacity: newTodo.trim() ? 1 : 0.5
                                            }}
                                            onMouseEnter={e => {
                                                if (newTodo.trim()) {
                                                    e.currentTarget.style.transform = 'scale(1.05)';
                                                }
                                            }}
                                            onMouseLeave={e => {
                                                e.currentTarget.style.transform = 'scale(1)';
                                            }}
                                        >
                                            <CornerDownLeft size={14} strokeWidth={2.5} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div style={{  marginTop: '15px'  }}>
                            <button className="btn hover-lift" onClick={handleSaveTracking} style={{  background: saveStatusTracking ? 'var(--success)' : 'var(--accent-secondary)', color: '#000', padding: '10px 20px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.3s'  }}>
                                {saveStatusTracking ? <><Check size={18} /> Updates Saved</> : 'Save Tracking Updates'}
                            </button>
                        </div>
                    </div>
                )}



            </div>
            
            {/* Standalone Validation Re-Test Modal */}
            {showValidationModal && (
                <div className="animate-fade-in fixed-overlay" style={{  position: 'fixed', top: 0, left: 'var(--sidebar-width)', right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center'  }}>
                  <div className="glass-panel responsive-modal" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--success)', padding: '0'  }}>
                    <div style={{  padding: '20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(16, 185, 129, 0.05)'  }}>
                       <h2 style={{  margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)'  }}>Validate Remediation</h2>
                       <button className="close-btn" onClick={() => { setShowValidationModal(false); setValidationFiles([]); }}><X size={20} /></button>
                    </div>
                    <div style={{  padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px'  }}>
                       <p style={{  color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0  }}>Record the results of the re-test. This will append the validation results to the original simulation report and automatically resolve this gap if considered optimal coverage.</p>
                       
                       <div>
                          <label style={{  display: 'block', marginBottom: '5px', fontSize: '0.9rem'  }}>TTP Tested</label>
                          <input className="ai-input" style={{  width: '100%', boxSizing: 'border-box', color: 'var(--text-secondary)', opacity: 0.8  }} value={gap.ttp ? `${gap.ttp} - ${getTTPName(gap.ttp)}` : 'General/Unmapped Procedure'} disabled />
                       </div>
                       <div>
                          <label style={{  display: 'block', marginBottom: '5px', fontSize: '0.9rem'  }}>Original Simulation</label>
                          <input className="ai-input" style={{  width: '100%', boxSizing: 'border-box', color: 'var(--text-secondary)', opacity: 0.8  }} value={gap.simulation} disabled />
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
                                  if (isReadOnly) return;
                                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                                      setValidationFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
                                  }
                              }}
                              style={{  border: '1px dashed var(--glass-border)', padding: '20px', textAlign: 'center', borderRadius: '8px', cursor: isReadOnly ? 'not-allowed' : 'pointer', color: 'var(--text-muted)', fontSize: '0.85rem'  }}
                              onClick={() => !isReadOnly && document.getElementById('evidence-upload').click()}
                              className={isReadOnly ? "" : "hover-lift"}
                          >
                              <input type="file" id="evidence-upload" multiple style={{  display: 'none'  }} onChange={(e) => {
                                  if (e.target.files && e.target.files.length > 0) {
                                      setValidationFiles(prev => [...prev, ...Array.from(e.target.files)]);
                                  }
                              }} />
                              {isReadOnly ? "Screenshot uploading disabled" : "Drag & drop screenshots/logs or click to browse"}
                          </div>
                          {validationFiles.length > 0 && (
                              <div style={{  display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '10px'  }}>
                                  {validationFiles.map((file, idx) => (
                                      <div key={idx} style={{  background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--success)', color: 'var(--success)', padding: '4px 10px', borderRadius: '16px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px'  }}>
                                          {file.name}
                                           {!isReadOnly && (
                                               <button className="close-btn" style={{  padding: '4px'  }} onClick={(e) => { e.stopPropagation(); setValidationFiles(prev => prev.filter((_, i) => i !== idx)); }}><X size={12} /></button>
                                           )}
                                      </div>
                                  ))}
                              </div>
                          )}
                       </div>
                    </div>
                    <div style={{  padding: '20px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end', gap: '10px'  }}>
                       <button className="btn" style={{  background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)'  }} onClick={() => { setShowValidationModal(false); setValidationFiles([]); }}>Cancel</button>
                       <button className="btn" disabled={!validationOutcome || !validationNotes.trim()} style={{  background: (!validationOutcome || !validationNotes.trim()) ? 'var(--bg-tertiary)' : 'var(--success)', color: (!validationOutcome || !validationNotes.trim()) ? 'var(--text-muted)' : '#fff', cursor: (!validationOutcome || !validationNotes.trim()) ? 'not-allowed' : 'pointer'  }} onClick={async () => {
                          const finalNotes = validationNotes + (validationFiles.length > 0 ? `\n\n[Attached Evidence: ${validationFiles.map(f => f.name).join(', ')}]` : '');
                          let resolved = false;
                          if (updateExerciseValidation) {
                              resolved = await updateExerciseValidation(gap, validationOutcome, finalNotes, validationDate ? new Date(validationDate).toISOString() : null);
                          }
                          
                          setShowValidationModal(false);
                          setValidationNotes('');
                          setValidationFiles([]);
                          
                          if (resolved) {
                              addToast("Gap Resolved successfully.", "success");
                          } else {
                              addToast("Gap remains In Progress. Optimal coverage (Prevented/Alerted) is required to resolve.", "warning");
                          }
                       }}>Submit Validation</button>
                    </div>
                  </div>
                </div>
            )}

            <style>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
