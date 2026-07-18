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

import React, { useState, useEffect, useCallback } from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import { ReactFlow, Background, Controls, applyNodeChanges, applyEdgeChanges, addEdge, MarkerType } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useAppContext } from '../../AppContext';
import { useToast } from '../ui/Toast';
import { CheckSquare, Square, Sparkles, Search, ChevronDown, ChevronLeft, ChevronRight, Edit3, FileText, Upload, Eye, Wrench, Key, Terminal, Anchor, ChevronsUp, Ghost, Unlock, Network, Package, Zap, Trash2, X, Users, Target, Info, Flag, ArrowRight, Plus, Database, Loader2, Save, Shield, Crosshair, AlertTriangle, Activity, PlaneTakeoff, ExternalLink, Send, Tag, Swords } from 'lucide-react';
import { SatelliteStationIcon, StealthBomberIcon, HeavyTransportIcon } from '../ui/CustomIcons';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { useNavigate, useLocation } from 'react-router-dom';
import RichMarkdownEditor from '../ui/RichMarkdownEditor';
import BattleGlobe from '../features/BattleGlobe';
import ReportPDF from '../features/ReportPDF';
import MarkdownRenderer from '../ui/MarkdownRenderer';
import InlineEnvironmentDropdown from '../dropdowns/InlineEnvironmentDropdown';
import InlineTagDropdown from '../dropdowns/InlineTagDropdown';
import EventTypeDropdown from '../dropdowns/EventTypeDropdown';
import OutcomeDropdown from '../dropdowns/OutcomeDropdown';
import CoverageRatingDropdown from '../dropdowns/CoverageRatingDropdown';
import SeverityDropdown from '../dropdowns/SeverityDropdown';
import EventTTPDropdown from '../dropdowns/EventTTPDropdown';
import SecurityControlsDropdown from '../dropdowns/SecurityControlsDropdown';
import EventCard from '../ui/EventCard';

import Step1BasicDetails from './SimulationWizard/Step1BasicDetails';
import Step2Design from './SimulationWizard/Step2Design';
import Step3Execute from './SimulationWizard/Step3Execute';
import Step4Report from './SimulationWizard/Step4Report';

const KILL_CHAIN_ORDER = [
  "Reconnaissance", "Resource Development", "Initial Access", "Execution", 
  "Persistence", "Privilege Escalation", "Defense Evasion", "Credential Access", 
  "Discovery", "Lateral Movement", "Collection", "Command and Control", 
  "Exfiltration", "Impact", "Defense Impairment", "Stealth"
];

const BomberIcon = ({ size = 24, color = "currentColor", ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M12 3 L22 15 L17 15 L12 19 L7 15 L2 15 Z" fill={color} fillOpacity="0.2" />
    <path d="M12 3 L12 19" strokeOpacity="0.5" />
  </svg>
);

const DistortionIcon = ({ size = 24, color = "currentColor", ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M3 12h3l3 -7l4 14l5 -7h3" />
    <path d="M2 5h4" />
    <path d="M18 19h4" />
  </svg>
);

const TACTIC_ICONS = {
  "Reconnaissance": Eye,
  "Resource Development": Wrench,
  "Initial Access": Key,
  "Execution": Terminal,
  "Persistence": Anchor,
  "Privilege Escalation": ChevronsUp,
  "Defense Evasion": Ghost,
  "Credential Access": Unlock,
  "Discovery": Search,
  "Lateral Movement": Network,
  "Collection": Package,
  "Command and Control": SatelliteStationIcon,
  "Exfiltration": HeavyTransportIcon,
  "Impact": Zap,
  "Defense Impairment": DistortionIcon,
  "Stealth": StealthBomberIcon
};
import TTPSelector from '../features/TTPSelector';

const getOutcomeStyle = (outcome) => {
    if (outcome === 'Prevented & Alerted' || outcome === 'Prevented') return { color: 'var(--success)', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.3)' };
    if (outcome === 'Prevented') return { color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)', border: 'rgba(6, 182, 212, 0.3)' };
    if (outcome === 'Alerted') return { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.3)' };
    if (outcome === 'Logged') return { color: 'var(--warning)', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.3)' };
    if (outcome === 'Missed') return { color: 'var(--danger)', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.3)' };
    return { color: 'var(--text-secondary)', bg: 'rgba(255, 255, 255, 0.05)', border: 'rgba(255, 255, 255, 0.1)' };
};



const AttackChainVisualizer = ({ selectedTTPs, mitreData }) => {
    const chain = {};
    if (mitreData && selectedTTPs) {
       selectedTTPs.forEach(ttp => {
           let foundTactic = "Unknown";
           for (const [tacticName, tacticData] of Object.entries(mitreData)) {
               if (tacticData.techniques.some(t => t.id === ttp.id || ttp.id.startsWith(t.id + '.'))) {
                   foundTactic = tacticName;
                   break;
               }
           }
           if (!chain[foundTactic]) chain[foundTactic] = [];
           chain[foundTactic].push(ttp);
       });
    }
    
    const sortedTactics = Object.keys(chain).sort((a, b) => {
        const idxA = KILL_CHAIN_ORDER.indexOf(a);
        const idxB = KILL_CHAIN_ORDER.indexOf(b);
        if (idxA === -1 && idxB === -1) return a.localeCompare(b);
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
    });

    if (sortedTactics.length === 0) return null;

    return (
        <div className="animate-fade-in" style={{  position: 'relative', display: 'flex', alignItems: 'flex-start', padding: '20px 0', marginBottom: '20px', overflowX: 'auto', scrollbarWidth: 'none', background: 'linear-gradient(90deg, rgba(10,10,12,0) 0%, rgba(10,10,12,0.8) 5%, rgba(10,10,12,0.8) 95%, rgba(10,10,12,0) 100%)'  }}>
            {/* Horizontal Connection Line */}
            <div style={{  position: 'absolute', top: '40px', left: '50px', right: '50px', height: '2px', background: 'rgba(255,255,255,0.05)', zIndex: 0  }}>
                <div style={{  width: '100%', height: '100%', background: 'linear-gradient(90deg, transparent, #00E5FF, transparent)', animation: 'htmlLaserPulse 2s linear infinite', opacity: 0.5  }} />
            </div>

            <div style={{  display: 'flex', alignItems: 'flex-start', gap: '30px', padding: '0 20px', margin: '0 auto', position: 'relative', zIndex: 1  }}>

                {sortedTactics.map((tactic, i) => {
                    const Icon = TACTIC_ICONS[tactic] || Terminal;
                    return (
                        <div key={tactic} style={{  display: 'flex', alignItems: 'flex-start', flexShrink: 0, position: 'relative'  }}>
                            <div className="hover-lift" style={{  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', width: '120px', cursor: 'default'  }}>
                                
                                {/* Phase Icon Node */}
                                <div style={{  
                                    width: '44px', height: '44px', borderRadius: '10px', 
                                    background: 'linear-gradient(135deg, rgba(10,11,16,1), rgba(20,22,30,1))', 
                                    border: '1px solid var(--accent-primary)', 
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                    boxShadow: '0 0 15px rgba(0, 229, 255, 0.2), inset 0 0 10px rgba(0, 229, 255, 0.1)',
                                    zIndex: 2,
                                    position: 'relative'
                                 }}>
                                    <Icon size={22} color="#00E5FF" />
                                </div>

                                {/* Tactic Label */}
                                <span style={{  fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--text-primary)', textAlign: 'center', lineHeight: '1.2', letterSpacing: '0.5px', textTransform: 'uppercase'  }}>
                                    {tactic}
                                </span>

                                {/* Selected TTPs */}
                                <div style={{  display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center', width: '100%', marginTop: '5px'  }}>
                                    {chain[tactic].map(ttp => (
                                        <div 
                                            key={ttp.id} 
                                            style={{  
                                                fontSize: '0.65rem', 
                                                background: 'rgba(255,255,255,0.03)', 
                                                padding: '4px 8px', 
                                                borderRadius: '4px', 
                                                border: '1px solid rgba(255,255,255,0.1)', 
                                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', 
                                                width: '100%', boxSizing: 'border-box', textAlign: 'center',
                                                fontFamily: 'monospace',
                                                color: 'var(--text-muted)'
                                             }} 
                                            title={ttp.name}
                                        >
                                            {ttp.id}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            {/* Connector Arrow */}
                            {i < sortedTactics.length - 1 && (
                                <div style={{  position: 'absolute', right: '-20px', top: '15px', color: '#00E5FF', opacity: 0.5  }}>
                                    <ChevronRight size={14} />
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    );
};

/**
 * SimulationWizard Component
 * 
 * A massive multi-step form used to build and execute a "Simulation" (Campaign).
 * 
 * CORE WORKFLOW:
 * 1. User selects target TTPs from the MITRE matrix.
 * 2. User defines environments, scope, and metadata.
 * 3. User sequentially executes and records outcomes ("Events") for each TTP.
 * 4. The wizard aggregates all atomic Events into a single cohesive Simulation
 *    via the `completeExercise` and `saveSimulationSummary` context actions.
 * 
 * NOMENCLATURE MAP:
 * - "Event": The individual TTP test recorded in the wizard steps.
 * - "Simulation": The final aggregated campaign submitted at the end of the wizard.
 * 
 * @param {Object} props
 */
export default function SimulationWizard() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);

  const onNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [setNodes]
  );
  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges]
  );
  const onConnect = useCallback(
    (connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  );
  const navigate = useNavigate();
  const location = useLocation();
  const [expandedImage, setExpandedImage] = useState(null);
  const { completeExercise, mitreData, isMitreLoading, generateAIContent, generateAIContentStream, saveSimulationSummary, addSimulationEvidence, removeSimulationEvidence, simulationEvidence, compressImage, aiSettings, setActiveAiContext, gaps, setGaps, createGap, confirmAction, simulationSummaries, isAiActive, addSecurityControl } = useAppContext();
  const { addToast } = useToast();
  const [step, setStep] = useState(() => { const s = sessionStorage.getItem('wizard_step'); return s ? parseInt(s, 10) : 1; });
  
  const isMounted = React.useRef(true);
  React.useEffect(() => {
      isMounted.current = true;
      return () => {
          isMounted.current = false;
      };
  }, []);

  const [savedDrafts, setSavedDrafts] = useState(() => {
     const saved = localStorage.getItem('wizard_drafts');
     return saved ? JSON.parse(saved) : [];
  });
  const [isDraftModalOpen, setIsDraftModalOpen] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [currentDraftId, setCurrentDraftId] = useState(() => sessionStorage.getItem('wizard_draft_id') || null);

  const [simulationDetails, setSimulationDetails] = useState(() => {
     const saved = sessionStorage.getItem('wizard_details');
     return saved ? JSON.parse(saved) : { name: '', environmentCategory: [], environment: '', goals: '', participants: [{ id: 1, name: '', role: 'Purple Team' }] };
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTactics, setExpandedTactics] = useState({});
  const [activeMapTactic, setActiveMapTactic] = useState(null);
  const [activeMapTechnique, setActiveMapTechnique] = useState(null);
  const [isMapTtpExpanded, setIsMapTtpExpanded] = useState(false);
  const [nameConflict, setNameConflict] = useState(false);
  const [showNameErrors, setShowNameErrors] = useState(false);
  const [collapsedCards, setCollapsedCards] = useState({});
  const [isContextCollapsed, setIsContextCollapsed] = useState(false);
  const [selectedTTPs, setSelectedTTPs] = useState(() => {
     const saved = sessionStorage.getItem('wizard_ttps');
     return saved ? JSON.parse(saved) : [];
  });
  const [isMappingTTPs, setIsMappingTTPs] = useState(false);
  const [mappingProcedureId, setMappingProcedureId] = useState(null);
  
  const [simulationPayload, setSimulationPayload] = useState(() => sessionStorage.getItem('wizard_payload') || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditingSimulationPayload, setIsEditingSimulationPayload] = useState(false);
  
  const aiName = aiSettings?.provider === 'OpenAI' ? 'ChatGPT' : aiSettings?.provider === 'Anthropic' ? 'Claude' : aiSettings?.provider === 'Gemini' ? 'Gemini' : 'AI';
  
  const [coPilotInput, setCoPilotInput] = useState('');
  const [isCoPilotGenerating, setIsCoPilotGenerating] = useState(false);
  const [coPilotResponse, setCoPilotResponse] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const [testResults, setTestResults] = useState(() => {
     const saved = sessionStorage.getItem('wizard_results');
     return saved ? JSON.parse(saved) : [];
  });
  
  const hasUnsavedChanges = testResults.length > 0 || selectedTTPs.length > 0 || simulationDetails.name.trim() !== '';




  useEffect(() => {
     sessionStorage.setItem('wizard_step', step);
     sessionStorage.setItem('wizard_details', JSON.stringify(simulationDetails));
     sessionStorage.setItem('wizard_ttps', JSON.stringify(selectedTTPs));
     sessionStorage.setItem('wizard_results', JSON.stringify(testResults));
     sessionStorage.setItem('wizard_payload', simulationPayload);
     if (currentDraftId) sessionStorage.setItem('wizard_draft_id', currentDraftId);
     else sessionStorage.removeItem('wizard_draft_id');
  }, [step, simulationDetails, selectedTTPs, testResults, simulationPayload, currentDraftId]);

  useEffect(() => {
     setActiveAiContext({
         source: 'SimulationWizard',
         currentPhase: step === 1 ? 'Step 1: Scope' : step === 2 ? 'Step 2: Design' : step === 3 ? 'Step 3: Execute' : 'Step 4: Report',
         simulation: {
             name: simulationDetails?.name || '',
             environment: simulationDetails?.environment || '',
             objectives: simulationDetails?.goals || '',
             participants: (simulationDetails?.participants || []).map(p => p?.name)?.filter(Boolean)
         },
         selectedTTPs: (selectedTTPs || []).map(t => `${t?.id} - ${t?.name}`),
         executionLogs: testResults || [],
         existingCoverageGaps: (gaps || []).map(g => ({ ttp: g?.ttp, status: g?.status, severity: g?.severity })),
         historicalSimulations: Object.values(simulationSummaries || {}).map(s => ({ name: s.name, date: s.date, ttpCount: s.ttps?.length }))
     });
     
     return () => setActiveAiContext(null);
  }, [step, simulationDetails, selectedTTPs, testResults, gaps, simulationSummaries, setActiveAiContext]);
  const getAdversaryControlRatio = () => {
     let totalScore = 0;
     let maxScore = 0;
     testResults.forEach(p => {
        let out = p.outcome;
        if (!out || out === 'N/A' || out === 'Error') return;
        if (out.includes(' ➔ ')) out = out.split(' ➔ ').pop();
        out = out.replace('✓', '').trim();
        maxScore += 1.0;
        
        if (out === 'Missed') totalScore += 1.0;
        else if (out.startsWith('Logged') || out === 'Partial') totalScore += 0.75; // Blue team gets 25% (minor loss)
        else if (out === 'Alerted' || out === 'Prevented') totalScore += 0.25; // Blue team gets 75% (solid win/edge)
        else if (out === 'Prevented & Alerted') totalScore += 0.0; // Blue team gets 100% (max win)
     });
     if (maxScore === 0) return 0.5;
     return totalScore / maxScore;
  };


  const getAggregatedScore = (ttpId) => {
    const procs = (testResults || [])?.filter(p => (p.ttps || []).includes(ttpId));
    if (procs.length === 0) return { score: 0, outcome: 'N/A', coverageRating: 'N/A', count: 0 };
    
    let bestOutcome = 'N/A';
    let bestOutcomeRank = -1;
    const validRatings = [];
    
    procs.forEach(p => {
        if (!p.coverageRating || p.coverageRating === 'N/A') return;
        
        validRatings.push(p.coverageRating);

        let r = -1;
        if (p.outcome === 'Prevented & Alerted') r = 4;
        else if (p.outcome === 'Prevented' || p.outcome === 'Alerted' || p.outcome === 'Detected') r = 3;
        else if (p.outcome === 'Logged' || p.outcome === 'Partial') r = 2;
        else if (p.outcome === 'Missed') r = 1;
        
        if (r > bestOutcomeRank) {
            bestOutcomeRank = r;
            bestOutcome = p.outcome;
        }
    });

    if (validRatings.length === 0) return { score: 0, outcome: 'N/A', coverageRating: 'N/A', count: procs.length };
    
    let aggCoverage = 'None';
    let score = 0;
    
    if (validRatings.includes('None')) {
        aggCoverage = 'None';
        score = 0;
    } else if (validRatings.includes('Minimal')) {
        aggCoverage = 'Minimal';
        score = 25;
    } else if (validRatings.includes('Partial')) {
        aggCoverage = 'Partial';
        score = 50;
    } else if (validRatings.includes('Optimal')) {
        aggCoverage = 'Optimal';
        score = 100;
    }
    
    return { score, outcome: bestOutcome, coverageRating: aggCoverage, count: procs.length };
  };

  const addProcedure = (initialTtpId) => {
     setTestResults(prev => [
         ...prev,
         { id: Date.now() + Math.random(), name: '', ttps: initialTtpId ? [initialTtpId] : [], eventType: 'Payload', payloadCode: '', expectedOutcome: '', outcome: '', coverageRating: 'N/A', execNotes: '', detNotes: '', severity: 'Auto-Calculate' }
     ]);
  };

  const updateProcedure = (procId, field, value) => {
     if (field === 'name' && value.trim() !== '') {
         const isDuplicate = testResults.some(p => p.id !== procId && p.name.trim().toLowerCase() === value.trim().toLowerCase());
         if (isDuplicate) {
             addToast(`An event named "${value.trim()}" already exists.`, 'error');
             return;
         }
     }

     setTestResults(prev => prev.map(p => {
         if (p.id === procId) {
             let updates = { [field]: value };
             if (field === 'outcome') {
                 if (value === 'Missed' && p.severity !== 'Critical') {
                     updates.severity = 'High';
                 } else if (value === 'Logged' && p.severity !== 'Critical') {
                     updates.severity = 'Medium';
                 } else if (value === 'Prevented' && p.severity !== 'Critical') {
                     updates.severity = 'Low';
                 }
             }
             return { ...p, ...updates };
         }
         return p;
     }));
  };

  const removeProcedure = (procId) => {
     confirmAction('Are you sure you want to remove this event?', () => {
         setTestResults(prev => prev?.filter(p => p.id !== procId));
     });
  };
  
  const [reportData, setReportData] = useState({ executiveSummary: '', keyFindings: '', businessImpact: '', recommendations: '' });
  const [activeSections, setActiveSections] = useState({ executiveSummary: true, keyFindings: false, businessImpact: false, recommendations: true });
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isAssessing, setIsAssessing] = useState({});
  
  const toggleTTP = (techId, techName) => {
    setSelectedTTPs(prev => {
        if (prev.find(t => t.id === techId)) {
            return prev.filter(t => t.id !== techId);
        } else {
            return [...prev, { id: techId, name: techName }];
        }
    });
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

  const handleNext = () => {
    if (step === 1) {
      if (!simulationDetails.name.trim()) {
          addToast("Please provide a Simulation Name before proceeding.", 'warning');
          return;
      }
      if (simulationSummaries && simulationSummaries[simulationDetails.name.trim()]) {
          setNameConflict(true);
          addToast("A simulation with this name already exists. Please choose a unique name.", 'error');
          return;
      }
      if (!simulationDetails.environmentCategory || simulationDetails.environmentCategory.length === 0) {
          addToast("Please select a Target Environment before proceeding.", 'warning');
          return;
      }
      if (selectedTTPs.length === 0) {
          addToast("Please select at least one MITRE TTP to proceed.", 'warning');
          return;
      }
    }
    if (step === 3) {
      if (testResults.length === 0) {
          addToast("Please add at least one event to proceed.", 'warning');
          return;
      }
      const hasActualOutcome = testResults.some(p => p.outcome && p.outcome !== 'N/A' && p.outcome !== 'Error');
      if (!hasActualOutcome) {
          addToast("Please document and select an outcome for at least one payload execution to proceed to reporting.", 'warning');
          return;
      }
      if (testResults.some(p => !p.ttps || p.ttps.length === 0)) {
          addToast("Please map at least one TTP to every event.", 'warning');
          return;
      }
      // Auto-assign medium to any unassessed gaps instead of hard-blocking
      setTestResults(prev => prev.map(p => {
          if ((p.coverageRating === 'Partial' || p.coverageRating === 'Minimal' || p.coverageRating === 'None') && (!p.severity || p.severity === 'Auto-Calculate' || p.severity === 'N/A')) {
              return { ...p, severity: 'Medium' };
          }
          return p;
      }));
      if (testResults.some(p => !p.name || p.name.trim() === '' || /^Event \d+$/.test(p.name.trim()))) {
          setShowNameErrors(true);
          addToast("1 or more events are missing a name.", 'warning');
          return;
      }
      setShowNameErrors(false);
    }
    setStep(s => Math.min(s + 1, 4));
  };
  const handlePrev = () => setStep(s => Math.max(s - 1, 1));

  const handleCancel = () => {
    confirmAction("Are you sure you want to cancel this simulation? All unsaved progress will be lost.", () => {
      sessionStorage.removeItem('wizard_step');
      sessionStorage.removeItem('wizard_details');
      sessionStorage.removeItem('wizard_ttps');
      sessionStorage.removeItem('wizard_results');
      sessionStorage.removeItem('wizard_payload');
      sessionStorage.removeItem('wizard_draft_id');
      navigate('/');
    });
  };

  const generatePayloads = async () => {
    setIsGenerating(true);
    try {
        if (selectedTTPs.length === 0) {
            addToast("Please select at least one TTP in Step 1 before generating an attack chain.", 'warning');
            setIsGenerating(false);
            return;
        }

        const systemInstruction = 'You are an elite Defensive Security Engineer and Purple Team lead. The user wants to design a simulation for testing EDR telemetry. You must provide a highly structured Markdown response. First, provide a concise **Simulation Overview** explaining the techniques. Second, provide **Simulation Options**, listing distinct methods to safely simulate this activity. Finally, provide the **Recommended Unified Procedure**, containing the exact, ready-to-use benign code (in markdown code blocks) or explicit manual steps tailored for the target environment. NEVER write functional exploits; only benign commands that create the forensic footprint. IMPORTANT: Do NOT use markdown tables under any circumstances. Use bulleted lists instead. DO NOT introduce yourself. DO NOT echo this prompt. Begin immediately with the **Simulation Overview** section.';
        
        const ttpList = selectedTTPs.map(t => `${t.id} - ${t.name}`).join(', ');
        
        let prompt = `Target Environment: ${simulationDetails.environment || 'Unknown/Generic'}.\nSimulation Scenario: ${simulationDetails.goals || 'None'}\n\nDesign a unified defensive simulation strategy and validation payload combining the following identified techniques: ${ttpList}.`;
        
        if (coPilotInput.trim()) {
            prompt += `\n\nAdditionally, incorporate this specific request from the user: "${coPilotInput}"`;
        }
        
        setSimulationPayload('');
        
        await generateAIContentStream(prompt, systemInstruction, (chunk) => {
            if (!isMounted.current) return;
            setSimulationPayload(chunk);
        });
        
        if (coPilotInput.trim()) {
            setCoPilotInput('');
        }
    } catch(err) {
      if (!isMounted.current) return;
      console.error(err);
      addToast('Error generating payload: ' + err.message, 'error');
    }
    if (isMounted.current) setIsGenerating(false);
  };

  const generateCoPilotResponse = async () => {
    if (!coPilotInput.trim()) return;
    const currentInput = coPilotInput;
    setCoPilotInput('');
    setIsCoPilotGenerating(true);
    setCoPilotResponse('');
    try {
      const sysPrompt = "You are an elite Defensive Security Engineer. You are helping the user write an attack chain or payload. This is for an AUTHORIZED, simulated environment to test defensive telemetry. You are NOT attacking a real target. Return only the raw markdown text to be appended to their document. Do not wrap in a giant markdown block unless it's a specific code snippet.";
      const prompt = `Context: The user is building a simulation named "${simulationDetails.name}" for environment "${simulationDetails.environment}". Selected TTPs: ${selectedTTPs.map(t => t.id).join(', ')}.\nUser Request: ${currentInput}`;
      await generateAIContentStream(prompt, sysPrompt, (chunk) => {
          if (!isMounted.current) return;
          setCoPilotResponse(chunk);
      });
    } catch(err) {
      if (!isMounted.current) return;
      console.error(err);
      addToast('Error generating co-pilot response: ' + err.message, 'error');
    }
    if (isMounted.current) setIsCoPilotGenerating(false);
  };

  const mapObjectivesToTTPs = async () => {
     if (!simulationDetails.goals) {
       return;
     }
      setIsMappingTTPs(true);
      try {
          // Generate the hyper-compressed dictionary, EXCLUDING Recon and Resource Development
          let dictionaryLines = [];
          
          Object.keys(mitreData).forEach(tacticName => {
              if (tacticName.toLowerCase() === 'reconnaissance' || tacticName.toLowerCase() === 'resource development') {
                  return; // Skip these to save massive context tokens
              }
              const tactic = mitreData[tacticName];
              
              tactic.techniques.forEach(tech => {
                  let line = `${tech.id} ${tech.name}`;
                  if (tech.subTechniques && tech.subTechniques.length > 0) {
                      let subs = tech.subTechniques.map(sub => {
                          let dec = sub.id.split('.')[1];
                          return `${dec} ${sub.name}`;
                      });
                      line += `(${subs.join(',')})`;
                  }
                  dictionaryLines.push(line);
              });
          });
          
          // Join with pipes to completely eliminate newlines and condense the string
          const dictionaryString = dictionaryLines.join('|');

          const sysPrompt = `You are a top-tier Red Teamer. You are given a scenario and an ultra-compressed MITRE ATT&CK Dictionary. 
Your goal is to map the scenario to the exact T-codes.

CRITICAL INSTRUCTIONS:
1. FIRST, write a deep, step-by-step analysis of the attacker's actions to gain a full grasp of the scenario. Do NOT look at the Dictionary yet.
2. SECOND, ONLY after your analysis is complete, review the provided MITRE Dictionary and extract the exact Txxxx or Txxxx.xxx IDs that apply.
3. Finally, at the very end of your response, you MUST output a single line starting with "MAPPED_IDS:" followed by a comma-separated list of the exact IDs you selected.`;
          
          const prompt = `Target Environment: ${simulationDetails.environment || 'None provided'}\nSimulation Scenario: ${simulationDetails.goals || 'None provided'}\n\nUltra-Compressed MITRE Dictionary:\n${dictionaryString}\n\nTask: Analyze deeply first, then review the Dictionary and list the MAPPED_IDS at the end.`;

          let currentFoundIds = new Set();
          let totalFound = 0;

          await generateAIContentStream(prompt, sysPrompt, (chunk) => {
              if (!isMounted.current) return;
              
              let cleanChunk = chunk.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '');
              let matches = [];
              const mappedIdsMatch = cleanChunk.match(/MAPPED_IDS:\s*([T0-9.,\s]+)/i);
              
              if (mappedIdsMatch && mappedIdsMatch[1]) {
                  matches = mappedIdsMatch[1].match(/T\d{4}(?:\.\d{3})?/gi) || [];
              } else {
                  matches = cleanChunk.match(/T\d{4}(?:\.\d{3})?/gi) || [];
              }
              
              const uniqueIds = new Set(matches.map(m => m.toUpperCase()));
              let ids = Array.from(uniqueIds);
              let newDiscovered = [];
              
              ids.forEach(id => {
                  if (!currentFoundIds.has(id)) {
                      currentFoundIds.add(id);
                      newDiscovered.push(id);
                  }
              });
              
              if (newDiscovered.length > 0) {
                  let foundItems = [];
                  newDiscovered.forEach(id => {
                      Object.values(mitreData).forEach(tactic => {
                          tactic.techniques.forEach(tech => {
                              if (tech.id === id) foundItems.push({ id: tech.id, name: tech.name, aiMapped: true });
                              if (tech.subTechniques) {
                                  tech.subTechniques.forEach(sub => {
                                      if (sub.id === id) foundItems.push({ id: sub.id, name: sub.name, aiMapped: true });
                                  });
                              }
                          });
                      });
                  });
                  
                  const uniqueFoundItems = foundItems.filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i);

                  if (uniqueFoundItems.length > 0) {
                      setSelectedTTPs(prevSelections => {
                          let newSelections = [...prevSelections];
                          let changed = false;
                          uniqueFoundItems.forEach(item => {
                              if (!newSelections.find(s => s.id === item.id)) {
                                  newSelections.push(item);
                                  changed = true;
                              }
                          });
                          return changed ? newSelections : prevSelections;
                      });
                      totalFound += uniqueFoundItems.length;
                  }
              }
          });
          
          if (totalFound === 0) {
              addToast("AI completed mapping but no valid TTPs were extracted from its response.", "warning");
          } else {
              addToast(`AI successfully mapped ${totalFound} new TTPs!`, 'success');
          }
      } catch (err) {
          if (!isMounted.current) return;
      } finally {
          if (isMounted.current) setIsMappingTTPs(false);
      }
  };

  const generateAIReport = async () => {
    setIsGeneratingReport(true);
    try {
      const requestedKeys = Object.keys(activeSections).filter(k => activeSections[k]);
      if (requestedKeys.length === 0) {
          addToast("Please select at least one section to generate.", 'warning');
          setIsGeneratingReport(false);
          return;
      }
      
      const requestedKeysList = requestedKeys.map(k => `"${k}"`).join(", ");

      const systemInstruction = `You are an elite CISO and Purple Team Lead. Write an Executive Summary for a Purple Team gap analysis report. Emphasize the business value, the risk posture based on the outcomes (Prevented vs Missed), and high-level recommendations. Maintain a highly professional, constructive, and forward-looking tone. If the results are poor or unsatisfactory, frame them objectively as opportunities for maturity rather than harsh failures. You MUST return ONLY a raw JSON object with the following exact keys: ${requestedKeysList}. Do not include markdown wrappers. Each value should be a concise, well-written paragraph or bulleted list as appropriate.`;

      const blocked = (selectedTTPs || []).filter(t => getAggregatedScore(t.id).coverageRating === 'Optimal').length;
      const detected = (selectedTTPs || []).filter(t => getAggregatedScore(t.id).coverageRating === 'Optimal' && getAggregatedScore(t.id).outcome === 'Alerted').length;
      const partial = (selectedTTPs || []).filter(t => getAggregatedScore(t.id).coverageRating === 'Partial').length;
      const minimal = (selectedTTPs || []).filter(t => getAggregatedScore(t.id).coverageRating === 'Minimal').length;
      const missed = (selectedTTPs || []).filter(t => getAggregatedScore(t.id).coverageRating === 'None').length;

      const detailedLogs = testResults.map((proc, i) => {
          return `Event ${i + 1}: ${proc.name || 'Unnamed'}\n` +
                 (proc.payloadCode ? `Execution Details: ${proc.payloadCode}\n` : '') +
                 `Outcome: ${proc.outcome || 'Unknown'}\n` +
                 (proc.finding ? `Analyst Notes: ${proc.finding}\n` : '');
      }).join('\n');

      const prompt = `Simulation: ${simulationDetails.name || 'Unnamed Simulation'}\nEnvironment: ${simulationDetails.environmentCategory || 'Unknown'}\nResults Summary: ${blocked} Optimal (${detected} included Alerts), ${partial} Partial, ${minimal} Minimal, ${missed} No Coverage (Exposed).\n\nDetailed Execution Logs:\n${detailedLogs}\n\nPlease write the requested report sections analyzing these results.`;
      
      const rawResult = await generateAIContent(prompt, systemInstruction);
      const withoutThink = rawResult.replace(/<think>[\s\S]*?<\/think>/gi, '');
      const cleanJson = withoutThink.replace(/```json/gi, '').replace(/```/g, '').trim();
      let parsed;
      try {
          parsed = JSON.parse(cleanJson);
      } catch (e) {
          throw new Error("AI returned malformed JSON response.");
      }
      
      const extractKey = (obj, key) => {
          const lowerKey = key.toLowerCase();
          const foundKey = Object.keys(obj).find(k => k.toLowerCase().replace(/[^a-z]/g, '') === lowerKey.replace(/[^a-z]/g, ''));
          return foundKey ? obj[foundKey] : undefined;
      };
      
      const newData = {};
      let generatedAtLeastOne = false;
      for (const key of requestedKeys) {
          const val = extractKey(parsed, key);
          if (val) {
              newData[key] = val;
              generatedAtLeastOne = true;
          }
      }
      
      if (!generatedAtLeastOne) {
          throw new Error("AI failed to generate the required report fields.");
      }
      
      setReportData(prev => ({
         ...prev,
         ...newData
      }));
    } catch(err) {
      console.error(err);
      addToast("Error generating report: " + err.message, 'error');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const autoMapProcedureTTPs = async (proc) => {
      if (!isAiActive) {
          addToast("AI API key is required to auto-map TTPs.", 'warning');
          return;
      }
      if (!proc.name && !proc.payloadCode) {
          addToast("Please provide a Payload Name or Code first.", 'warning');
          return;
      }
      setMappingProcedureId(proc.id);
      try {
          const sysPrompt = "You are an expert Red Teamer. Based on your knowledge of the MITRE ATT&CK framework, what are the most accurate Technique IDs (e.g., T1055 or T1059.001) for this event? Be highly thorough and extract ALL relevant techniques implied by the procedure, including secondary actions like Ingress Tool Transfer (T1105), Command and Control, and Exfiltration. Return ONLY a comma-separated list of the IDs. DO NOT return any conversational text.";
          
          let procCode = proc.payloadCode || '';

          
          const prompt = `Procedure Details:\nName/Description: ${proc.name || 'None provided'}\nPayload Code: ${procCode || 'None provided'}\n\nTask: Return the comma-separated list of the most relevant MITRE ATT&CK technique IDs for this procedure.`;
          
          const result = await generateAIContent(prompt, sysPrompt);
          const cleanChunk = result.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '');
          const mappedIds = cleanChunk.match(/T\d{4}(?:\.\d{3})?/gi) || [];
          
          // Validate against our MITRE dataset to prevent hallucinated IDs from breaking the UI
          const allValidMitreIds = new Set();
          if (mitreData) {
              Object.values(mitreData).forEach(tactic => {
                  tactic.techniques?.forEach(tech => {
                      allValidMitreIds.add(tech.id);
                      tech.subTechniques?.forEach(sub => allValidMitreIds.add(sub.id));
                  });
              });
          }
          
          const validIds = [...new Set(mappedIds.map(m => m.toUpperCase()))].filter(id => allValidMitreIds.size === 0 || allValidMitreIds.has(id));
          
          if (validIds.length > 0) {
              updateProcedure(proc.id, 'ttps', validIds);
              addToast(`Successfully mapped ${validIds.length} TTP(s).`, 'success');
          } else {
              addToast("AI couldn't map any relevant TTPs.", 'info');
          }
      } catch (err) {
          console.error(err);
          addToast("Error auto-mapping TTPs: " + err.message, 'error');
      }
      setMappingProcedureId(null);
  };

  const autoAssessSeverity = async (proc) => {
      setIsAssessing(prev => ({...prev, [proc.id]: true}));
      try {
          const sysPrompt = "You are a Purple Team Risk Analyst. Determine the severity of a coverage gap for the provided MITRE ATT&CK techniques in a generic corporate environment. You must reply ONLY with exactly one of these words: Critical, High, Medium, or Low.";
          const prompt = `Techniques involved: ${proc.ttps.join(', ')}. Procedure: ${proc.name}`;
          
          const result = await generateAIContent(prompt, sysPrompt);
          let cleanResult = result.trim().replace(/[^a-zA-Z]/g, '');
          
          if (!['Critical', 'High', 'Medium', 'Low'].includes(cleanResult)) {
              cleanResult = 'High'; 
          }
          
          updateProcedure(proc.id, 'severity', cleanResult);
      } catch (err) {
          console.error(err);
          addToast("Error assessing severity: " + err.message, 'error');
      } finally {
          setIsAssessing(prev => ({...prev, [proc.id]: false}));
      }
  };

  const finishExercise = async () => {
     console.log('--- STARTING FINISH EXERCISE ---');
     if (isSaving) {
         console.log('--- finishExercise: isSaving is true, aborting ---');
         return;
     }
     
     console.log('--- finishExercise: setting isSaving to true ---');
     setIsSaving(true);
     try {
         const hasSummary = Object.values(reportData).some(val => val.trim() !== '');

         const finalSimulationName = simulationDetails.name || 'Ad-hoc Simulation';

         const allMappedTTPs = new Map();
     
     // 1. Always include TTPs strictly selected in step 1
     selectedTTPs.forEach(t => allMappedTTPs.set(t.id, t));
     
     // 2. Include any TTPs that were mapped during Step 3 (Execution)
     testResults.forEach(proc => {
         if (proc.ttps && Array.isArray(proc.ttps)) {
             proc.ttps.forEach(ttpId => {
                 if (!allMappedTTPs.has(ttpId)) {
                     // Try to fetch name from mitreData if available
                     let ttpName = 'Unknown Technique';
                     if (mitreData) {
                         for (const tactic of Object.values(mitreData)) {
                             const tech = tactic.techniques.find(t => t.id === ttpId);
                             if (tech) { 
                                 ttpName = tech.name; 
                                 break; 
                             } else {
                                 const parentId = ttpId.split('.')[0];
                                 const parentTech = tactic.techniques.find(t => t.id === parentId);
                                 if (parentTech && parentTech.subTechniques) {
                                     const sub = parentTech.subTechniques.find(s => s.id === ttpId);
                                     if (sub) {
                                         ttpName = sub.name;
                                         break;
                                     }
                                 }
                             }
                         }
                     }
                     allMappedTTPs.set(ttpId, { id: ttpId, name: ttpName });
                 }
             });
         }
     });

     const finalizedTestResults = testResults.map(p => {
           let calcSeverity = p.severity;
           let out = p.outcome || '';
           if (out.includes(' ➔ ')) out = out.split(' ➔ ')[1];

           if (!calcSeverity || calcSeverity === 'Auto-Calculate') {
               if (p.coverageRating === 'Optimal') {
                   calcSeverity = 'N/A';
               } else if (out.startsWith('Prevented') || out.startsWith('Alerted')) {
                   calcSeverity = 'Low';
               } else if (out === 'N/A' || out === 'Error') {
                   calcSeverity = 'N/A';
               } else {
                   calcSeverity = 'Medium';
               }
           } else {
               if (p.coverageRating === 'Optimal' || out === 'N/A' || out === 'Error') calcSeverity = 'N/A';
           }
           
            let finalCoverage = p.coverageRating;
            if (!finalCoverage || finalCoverage === 'Auto-Calculate' || finalCoverage === 'N/A') {
                if (out === 'Missed') finalCoverage = 'None';
                else if (out === 'Logged') finalCoverage = 'Partial';
                else if (out.startsWith('Prevented') || out.startsWith('Alerted')) finalCoverage = 'Optimal';
                else finalCoverage = 'None';
            } else {
                const covStr = String(finalCoverage).toLowerCase();
                if (covStr.includes('optimal')) finalCoverage = 'Optimal';
                else if (covStr.includes('partial') || covStr.includes('medium')) finalCoverage = 'Partial';
                else if (covStr.includes('minimal')) finalCoverage = 'Minimal';
                else if (covStr.includes('none') || covStr.includes('no coverage')) finalCoverage = 'None';
            }
            
            return { ...p, severity: calcSeverity, coverageRating: finalCoverage };
      });

     const getFinalAggScore = (ttpId) => {
         const procs = finalizedTestResults.filter(p => (p.ttps || []).includes(ttpId));
         if (procs.length === 0) return { outcome: 'Missed', coverageRating: 'None' };
         let explicitScoreTotal = 0; let explicitScoreCount = 0;
         let b = 0, a = 0, l = 0, m = 0;
         procs.forEach(p => {
              let out = p.outcome || '';
              if (out.includes('Prevented')) b++; else if (out.includes('Alerted')) a++; else if (out.includes('Logged')) l++; else if (out.includes('Missed')) m++;
             if (p.coverageRating && p.coverageRating !== 'Auto-Calculate' && p.coverageRating !== 'N/A') {
                 const cr = String(p.coverageRating).toLowerCase();
                 if (cr.includes('optimal')) explicitScoreTotal += 100;
                 else if (cr.includes('partial') || cr.includes('medium')) explicitScoreTotal += 50;
                 else if (cr.includes('minimal')) explicitScoreTotal += 25;
                 else if (cr.includes('none') || cr.includes('no coverage')) explicitScoreTotal += 0;
                 explicitScoreCount++;
             }
          });
         const total = b + a + l + m;
         if (total === 0) return { outcome: 'Missed', coverageRating: 'None' };
         const overallOutcome = b > 0 ? 'Prevented' : a > 0 ? 'Alerted' : l > 0 ? 'Logged' : 'Missed';
         if (explicitScoreCount > 0) {
             const avgExplicit = explicitScoreTotal / explicitScoreCount;
             let explicitCov = 'None';
             if (avgExplicit === 100) explicitCov = 'Optimal';
             else if (avgExplicit >= 50) explicitCov = 'Partial';
             else if (avgExplicit > 0) explicitCov = 'Minimal';
             return { outcome: overallOutcome, coverageRating: explicitCov };
         }
         const totalScore = (b * 100) + (a * 100) + (l * 50) + (m * 0);
         const avg = totalScore / total;
         if (avg === 100) return { outcome: b > 0 ? 'Prevented' : 'Alerted', coverageRating: 'Optimal' };
         if (avg >= 50) return { outcome: l > 0 ? 'Logged' : (b > 0 ? 'Prevented' : 'Alerted'), coverageRating: 'Partial' };
         if (avg > 0) return { outcome: m > 0 ? 'Missed' : 'Logged', coverageRating: 'Minimal' };
         return { outcome: 'Missed', coverageRating: 'None' };
     };

     const simulationTimestamp = new Date().toISOString();

     for (const [ttpId, ttp] of allMappedTTPs.entries()) {
         const procedures = finalizedTestResults?.filter(p => (p.ttps || []).includes(ttp.id));
         const agg = getFinalAggScore(ttp.id);
         let outcomeStatus = 'low'; 
         if (agg.coverageRating === 'Optimal') outcomeStatus = 'high';
         else if (agg.coverageRating === 'Partial') outcomeStatus = 'medium';
         else if (agg.coverageRating === 'Minimal') outcomeStatus = 'minimal';
         else if (agg.outcome === 'N/A') outcomeStatus = 'na';
         
         const worstSeverity = procedures.some(p => p.severity === 'Critical') ? 'Critical' : 
                               procedures.some(p => p.severity === 'High') ? 'High' : 
                               procedures.some(p => p.severity === 'Medium') ? 'Medium' : 
                               procedures.some(p => p.severity === 'Low') ? 'Low' : 'Medium';
                               
         const remediationNotes = procedures.map(p => {
             let note = `Event: ${p.name || 'Unnamed Event'} [${p.outcome || 'N/A'}]`;
             if (p.expectedOutcome) note += `\nExpected: ${p.expectedOutcome}`;
             if (p.execNotes) note += `\nExecution: ${p.execNotes}`;
             if (p.detNotes) note += `\nDetection: ${p.detNotes}`;
             return note;
         }).join('\n\n') || 'No specific execution or detection notes were recorded for this technique.';
         
         const richFinding = `${agg.outcome}`;

         const aggregatedControls = [];
         procedures.forEach(p => {
             if (Array.isArray(p.securityControls)) {
                 p.securityControls.forEach(sc => {
                     if (!aggregatedControls.includes(sc)) aggregatedControls.push(sc);
                 });
             }
         });

         await completeExercise(ttp.id, richFinding, remediationNotes, outcomeStatus, finalSimulationName, worstSeverity, simulationDetails.environmentCategory, agg.coverageRating, agg.outcome, simulationDetails.tags, aggregatedControls, true, simulationTimestamp);
      }
      
     let compiledSummary = '';
     if (activeSections.executiveSummary && reportData.executiveSummary) compiledSummary += `## Executive Summary\n${reportData.executiveSummary}\n\n`;
     if (activeSections.keyFindings && reportData.keyFindings) compiledSummary += `## Key Findings\n${reportData.keyFindings}\n\n`;
     if (activeSections.businessImpact && reportData.businessImpact) compiledSummary += `## Risk Analysis\n${reportData.businessImpact}\n\n`;
     if (activeSections.recommendations && reportData.recommendations) compiledSummary += `## Recommendations\n${reportData.recommendations}\n\n`;
     compiledSummary = compiledSummary.trim();

      const simulationPayloadData = {
          summary: compiledSummary,
          details: simulationDetails,
          attackChain: simulationPayload,
          testResults: finalizedTestResults,
          timestamp: new Date().toISOString()
      };

     for (const p of finalizedTestResults) {
         if (p.coverageRating === 'Partial' || p.coverageRating === 'Minimal' || p.coverageRating === 'None') {
             const severity = p.severity || 'Medium';
             const baseScore = severity === 'Critical' ? 100 : severity === 'High' ? 80 : severity === 'Medium' ? 50 : 20;
             const visibilityMultiplier = (p.coverageRating === 'None') ? 1.0 : (p.coverageRating === 'Minimal' ? 0.9 : (p.coverageRating === 'Partial' ? 0.75 : 0.0));
             const priorityScore = Math.round(baseScore * visibilityMultiplier);
             const newGap = {
                 id: Date.now() + Math.random().toString(),
                 displayId: 'GAP-' + Math.floor(1000 + Math.random() * 9000),
                 ttp: (p.ttps || []).join(', ') || 'Unmapped',
                 simulation: finalSimulationName,
                 finding: p.name || 'Unnamed Event',
                 outcome: p.outcome || 'Missed',
                 coverageRating: p.coverageRating || 'None',
                 details: `Execution: ${p.execNotes || 'N/A'}\nDetection: ${p.detNotes || 'N/A'}`,
                 severity: severity,
                 priorityScore: priorityScore,
                 status: 'Open',
                 actionItems: 'Review telemetry and develop detection logic.',
                 stakeholders: [],
                 remediationNotes: "",
                 environment: simulationDetails.environmentCategory,
                 tags: simulationDetails.tags || [],
                 createdDate: new Date().toISOString()
             };
             await createGap(newGap, true);
         }
     }

      await saveSimulationSummary(finalSimulationName, simulationPayloadData);
      
      if (currentDraftId) {
          const updatedDrafts = savedDrafts.filter(d => d.id !== currentDraftId);
          setSavedDrafts(updatedDrafts);
          localStorage.setItem('wizard_drafts', JSON.stringify(updatedDrafts));
      }
      
      sessionStorage.removeItem('wizard_step');
      sessionStorage.removeItem('wizard_details');
      sessionStorage.removeItem('wizard_ttps');
      sessionStorage.removeItem('wizard_results');
      sessionStorage.removeItem('wizard_payload');
      sessionStorage.removeItem('wizard_draft_id');

      // Do not manually reset state here to prevent flickering to step 1.
      // The spinner will keep spinning until the component unmounts on navigation.
      console.log('--- finishExercise: navigating to /reports ---');
      navigate('/reports', { state: { simulation: finalSimulationName } });
      
     } catch (err) {
         console.error("--- finishExercise FAILED:", err);
         addToast("Failed to save simulation. Please try again.", "error");
         setIsSaving(false);
     }
  };

   const saveDraft = () => {
      const draftData = { step, simulationDetails, selectedTTPs, simulationPayload, testResults, reportData };
      
      const executeSave = (id) => {
          const finalDraft = {
              id: id,
              name: simulationDetails.name || 'Unnamed Simulation',
              timestamp: new Date().toISOString(),
              data: draftData
          };
          
          let updatedDrafts;
          if (savedDrafts.find(d => d.id === id)) {
              updatedDrafts = savedDrafts.map(d => d.id === id ? finalDraft : d);
          } else {
              updatedDrafts = [finalDraft, ...savedDrafts];
          }
          
          setSavedDrafts(updatedDrafts);
          localStorage.setItem('wizard_drafts', JSON.stringify(updatedDrafts));
          setCurrentDraftId(id);
          addToast('Draft saved successfully!', 'success');
      };

      if (currentDraftId) {
          confirmAction(`Do you want to overwrite the existing draft "${simulationDetails.name || 'Unnamed Simulation'}"?`, () => {
              executeSave(currentDraftId);
          });
      } else {
          executeSave(Date.now().toString());
      }
   };

   const loadDraft = () => {
      setIsDraftModalOpen(true);
   };

   const restoreDraft = (draft) => {
       const parsed = draft.data;
       if (parsed.step) setStep(parsed.step);
       if (parsed.simulationDetails) setSimulationDetails(parsed.simulationDetails);
       if (parsed.selectedTTPs) setSelectedTTPs(parsed.selectedTTPs);
       if (parsed.simulationPayload) setSimulationPayload(parsed.simulationPayload);
       if (parsed.testResults) {
           if (Array.isArray(parsed.testResults)) {
               setTestResults(parsed.testResults);
           } else {
               const migrated = [];
               Object.entries(parsed.testResults).forEach(([ttpId, data]) => {
                   (data.procedures || []).forEach(p => {
                       const existing = migrated.find(m => m.id === p.id);
                       if (existing) {
                           if (!existing.ttps.includes(ttpId)) existing.ttps.push(ttpId);
                       } else {
                           migrated.push({ ...p, ttps: [ttpId] });
                       }
                   });
               });
               setTestResults(migrated);
           }
       }
       if (parsed.reportData) setReportData(parsed.reportData);
       setCurrentDraftId(draft.id);
       setIsDraftModalOpen(false);
       addToast(`Draft "${draft.name}" loaded successfully!`, 'success');
   };

   const deleteDraft = (id) => {
       confirmAction("Are you sure you want to delete this draft?", () => {
           const updated = savedDrafts?.filter(d => d.id !== id);
           setSavedDrafts(updated);
           localStorage.setItem('wizard_drafts', JSON.stringify(updated));
           if (currentDraftId === id) setCurrentDraftId(null);
           addToast("Draft deleted.", "success");
       });
   };

    const generateTestSimulation = async () => {
      const envs = ['Production', 'Staging', 'Development', 'Corporate', 'Cloud', 'On-Premise'];
      const names = ['Operation Crimson', 'Project Chimera', 'Apollo Strike', 'Neon Phantom', 'Shadow Gambit'];
      
      const randomEnv = envs[Math.floor(Math.random() * envs.length)];
      const randomName = names[Math.floor(Math.random() * names.length)] + ' Auto-Sim ' + Math.floor(Math.random() * 1000);
      
      const details = {
          name: randomName,
          environmentCategory: [randomEnv],
          environment: randomEnv + ' Network',
          goals: 'Automatically generated test simulation to evaluate detection engineering gaps.',
          participants: [
              { id: 1, name: 'Red Team Lead', role: 'Red Team' },
              { id: 2, name: 'SOC Analyst', role: 'Blue Team' }
          ]
      };
      
      const ttpCount = Math.floor(Math.random() * 4) + 3; // 3 to 6
      const randomTTPs = [];
      const usedIndices = new Set();
      
      const availableTTPs = mitreData && mitreData.length > 0 ? mitreData : [
          { id: 'T1059', name: 'Command and Scripting Interpreter' },
          { id: 'T1003', name: 'OS Credential Dumping' },
          { id: 'T1036', name: 'Masquerading' },
          { id: 'T1021', name: 'Remote Services' },
          { id: 'T1053', name: 'Scheduled Task/Job' },
          { id: 'T1543', name: 'Create or Modify System Process' },
          { id: 'T1105', name: 'Ingress Tool Transfer' }
      ];
      
      while(randomTTPs.length < ttpCount && usedIndices.size < availableTTPs.length) {
          const idx = Math.floor(Math.random() * availableTTPs.length);
          if (!usedIndices.has(idx)) {
              usedIndices.add(idx);
              randomTTPs.push({ id: availableTTPs[idx].id, name: availableTTPs[idx].name });
          }
      }
      
      const outcomes = ['Prevented', 'Alerted', 'Logged', 'Missed'];
      const eventCount = Math.floor(Math.random() * 6) + 5; // 5 to 10
      const generatedResults = [];
      
      for(let i=0; i<eventCount; i++) {
          const mappedTtpCount = Math.floor(Math.random() * 2) + 1; // 1 to 2
          const mappedTtps = [];
          for(let j=0; j<mappedTtpCount; j++) {
             mappedTtps.push(randomTTPs[Math.floor(Math.random() * randomTTPs.length)].id);
          }
          
          const actualOutcome = outcomes[Math.floor(Math.random() * outcomes.length)];
          let cov = 'Optimal';
          if (actualOutcome === 'Logged') cov = 'Partial';
          if (actualOutcome === 'Missed') cov = 'None';
          if (actualOutcome === 'N/A' || actualOutcome === 'Error') cov = 'N/A';
          
          generatedResults.push({
             id: Date.now() + Math.random() + i,
             name: `Auto-Gen Event ${i+1}`,
             ttps: [...new Set(mappedTtps)],
             eventType: 'Payload',
             payloadCode: 'powershell.exe -ExecutionPolicy Bypass -c "Write-Host \'Auto-gen script\'"',
             expectedOutcome: 'Alerted',
             outcome: actualOutcome,
             coverageRating: cov,
             execNotes: `Executed successfully at ${new Date().toLocaleTimeString()}`,
             detNotes: `Found event in Splunk query: index=windows EventCode=4688`,
             severity: (cov === 'None') ? 'High' : (cov === 'Partial' ? 'Medium' : 'N/A')
          });
      }

       const allMappedTTPs = new Map();
       randomTTPs.forEach(t => allMappedTTPs.set(t.id, t));
       
       generatedResults.forEach(proc => {
           if (proc.ttps && Array.isArray(proc.ttps)) {
               proc.ttps.forEach(ttpId => {
                   if (!allMappedTTPs.has(ttpId)) {
                       let ttpName = 'Unknown Technique';
                       if (mitreData) {
                           for (const tactic of Object.values(mitreData)) {
                               const tech = tactic.techniques.find(t => t.id === ttpId);
                               if (tech) { ttpName = tech.name; break; }
                           }
                       }
                       allMappedTTPs.set(ttpId, { id: ttpId, name: ttpName });
                   }
               });
           }
       });

       const finalizedTestResults = generatedResults.map(p => {
             let calcSeverity = p.severity;
             let out = p.outcome || '';
             if (out.includes(' ➔ ')) out = out.split(' ➔ ')[1];
             if (!calcSeverity || calcSeverity === 'Auto-Calculate') {
                 if (out === 'Missed') calcSeverity = 'High';
                 else if (out === 'Logged') calcSeverity = 'Medium';
                 else if (out.startsWith('Prevented') || out.startsWith('Alerted')) calcSeverity = 'Low';
                 else if (out === 'N/A' || out === 'Error') calcSeverity = 'N/A';
                 else calcSeverity = 'Medium';
             }
             return { ...p, severity: calcSeverity };
       });

       const getAggScoreLocal = (ttpId) => {
           const procs = finalizedTestResults.filter(p => (p.ttps || []).includes(ttpId));
           if (procs.length === 0) return { outcome: 'Missed', coverageRating: 'None' };
           
           // If the procedures have explicit coverage ratings, prefer those over outcome-based inference
           let explicitScoreTotal = 0;
           let explicitScoreCount = 0;
           let b = 0, a = 0, l = 0, m = 0;
           
           procs.forEach(p => {
                // Calculate outcome counts for both paths
                let out = p.outcome || '';
                if (out.includes('Prevented')) b++;
                else if (out.includes('Alerted')) a++;
                else if (out.includes('Logged')) l++;
                else if (out.includes('Missed')) m++;
                
                // Track explicit coverage rating
                if (p.coverageRating && p.coverageRating !== 'Auto-Calculate' && p.coverageRating !== 'N/A') {
                    if (p.coverageRating === 'Optimal') explicitScoreTotal += 100;
                    else if (p.coverageRating === 'Partial') explicitScoreTotal += 50;
                    else if (p.coverageRating === 'Minimal') explicitScoreTotal += 25;
                    else if (p.coverageRating === 'None') explicitScoreTotal += 0;
                    explicitScoreCount++;
                }
            });
            
           const total = b + a + l + m;
           if (total === 0) return { outcome: 'Missed', coverageRating: 'None' };
           
           const overallOutcome = b > 0 ? 'Prevented' : a > 0 ? 'Alerted' : l > 0 ? 'Logged' : 'Missed';
           
           if (explicitScoreCount > 0) {
               const avgExplicit = explicitScoreTotal / explicitScoreCount;
               let explicitCov = 'None';
               if (avgExplicit === 100) explicitCov = 'Optimal';
               else if (avgExplicit >= 50) explicitCov = 'Partial';
               else if (avgExplicit > 0) explicitCov = 'Minimal';
               
               return { outcome: overallOutcome, coverageRating: explicitCov };
           }
            
           const totalScore = (b * 100) + (a * 100) + (l * 50) + (m * 0);
           const avg = totalScore / total;
            
           if (avg === 100) return { outcome: b > 0 ? 'Prevented' : 'Alerted', coverageRating: 'Optimal' };
           if (avg >= 50) return { outcome: l > 0 ? 'Logged' : (b > 0 ? 'Prevented' : 'Alerted'), coverageRating: 'Partial' };
           if (avg > 0) return { outcome: m > 0 ? 'Missed' : 'Logged', coverageRating: 'Minimal' };
           return { outcome: 'Missed', coverageRating: 'None' };
        };

       for (const ttp of Array.from(allMappedTTPs.values())) {
           const agg = getAggScoreLocal(ttp.id);
           let outcomeStatus = 'low'; 
           if (agg.coverageRating === 'Optimal') outcomeStatus = 'high';
           else if (agg.coverageRating === 'Partial') outcomeStatus = 'medium';
           else if (agg.coverageRating === 'Minimal') outcomeStatus = 'minimal';
           else if (agg.outcome === 'N/A') outcomeStatus = 'na';

           const procedures = finalizedTestResults.filter(p => (p.ttps || []).includes(ttp.id));
           const worstSeverity = procedures.some(p => p.severity === 'Critical') ? 'Critical' : 
                                 procedures.some(p => p.severity === 'High') ? 'High' : 
                                 procedures.some(p => p.severity === 'Medium') ? 'Medium' : 
                                 procedures.some(p => p.severity === 'Low') ? 'Low' : 'Medium';
                                 
           const remediationNotes = procedures.map(p => `Event: ${p.name || 'Unnamed Event'} [${p.outcome || 'N/A'}]`).join('\n\n') || 'No specific notes.';
           
           const aggregatedControls = [];
           procedures.forEach(p => {
               if (Array.isArray(p.securityControls)) {
                   p.securityControls.forEach(sc => {
                       if (!aggregatedControls.includes(sc)) aggregatedControls.push(sc);
                   });
               }
           });

           await completeExercise(ttp.id, agg.outcome, remediationNotes, outcomeStatus, details.name, worstSeverity, details.environmentCategory, agg.coverageRating, agg.outcome, details.tags, aggregatedControls);
       }

       const simulationPayloadData = {
           summary: 'Automatically generated test simulation data.',
           details: details,
           attackChain: '',
           testResults: finalizedTestResults,
           timestamp: new Date().toISOString()
       };

       await saveSimulationSummary(details.name, simulationPayloadData);
       addToast(`Successfully ran automated simulation bot for: ${details.name}!`, 'success');
       navigate('/reports');
   };

  return (
    <div className="animate-fade-in" style={{  flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0  }}>
      <div style={{  display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0  }}>
          <div>
              <h1 className="iridescent-text" style={{  fontSize: '2.5rem', margin: '0 0 5px 0', display: 'flex', alignItems: 'center', gap: '15px'  }}>
                  Simulation Launcher
              </h1>
              <p style={{  color: 'var(--text-secondary)', margin: 0, marginBottom: '15px'  }}>Launch a comprehensive Purple Team simulation.</p>
          </div>
          <div style={{  display: 'flex', gap: '10px'  }}>
              <button type="button" className="btn hover-lift" onClick={loadDraft} style={{  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)'  }}>Load Draft</button>
              <button type="button" className="btn hover-lift" onClick={saveDraft} style={{  background: 'rgba(156, 39, 176, 0.2)', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)'  }}>Save Draft</button>
          </div>
      </div>
      
      <div style={{  display: 'flex', gap: '10px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '10px', flexShrink: 0  }}>
        {['Scope', 'Design', 'Execute', 'Report'].map((name, i) => {
          const isCompleted = step > i + 1;
          const isActive = step === i + 1;
          const className = isActive ? "progress-tab progress-tab-active" 
                          : isCompleted ? "progress-tab progress-tab-completed" 
                          : "progress-tab progress-tab-future";
          return (
            <div key={i} className={className}>{name}</div>
          );
        })}
      </div>

      <div className="glass-panel" style={{  flex: 1, minHeight: 0, padding: '25px', display: 'flex', flexDirection: 'column', overflow: 'hidden'  }}>
        
        {step === 1 && (
          <Step1BasicDetails
            simulationDetails={simulationDetails}
            setSimulationDetails={setSimulationDetails}
            nameConflict={nameConflict}
            setNameConflict={setNameConflict}
            simulationSummaries={simulationSummaries}
            addToast={addToast}
            openDropdownId={openDropdownId}
            setOpenDropdownId={setOpenDropdownId}
            isAiActive={isAiActive}
            mapObjectivesToTTPs={mapObjectivesToTTPs}
            isMappingTTPs={isMappingTTPs}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            isMitreLoading={isMitreLoading}
            activeMapTactic={activeMapTactic}
            setActiveMapTactic={setActiveMapTactic}
            mitreData={mitreData}
            KILL_CHAIN_ORDER={KILL_CHAIN_ORDER}
            selectedTTPs={selectedTTPs}
            setSelectedTTPs={setSelectedTTPs}
            activeMapTechnique={activeMapTechnique}
            setActiveMapTechnique={setActiveMapTechnique}
            TACTIC_ICONS={TACTIC_ICONS}
            setTestResults={setTestResults}
          />
        )}

        {step === 2 && (
          <Step2Design
            isGenerating={isGenerating}
            simulationPayload={simulationPayload}
            setSimulationPayload={setSimulationPayload}
            isAiActive={isAiActive}
            generatePayloads={generatePayloads}
            isContextCollapsed={isContextCollapsed}
            setIsContextCollapsed={setIsContextCollapsed}
            simulationDetails={simulationDetails}
            selectedTTPs={selectedTTPs}
            addToast={addToast}
          />
        )}

        {step === 3 && (
          <Step3Execute
            getAdversaryControlRatio={getAdversaryControlRatio}
            simulationPayload={simulationPayload}
            addProcedure={addProcedure}
            testResults={testResults}
            collapsedCards={collapsedCards}
            setCollapsedCards={setCollapsedCards}
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
            simulationDetails={simulationDetails}
            setExpandedImage={setExpandedImage}
          />
        )}

        {step === 4 && (
          <Step4Report
            testResults={testResults}
            selectedTTPs={selectedTTPs}
            getAggregatedScore={getAggregatedScore}
            activeSections={activeSections}
            setActiveSections={setActiveSections}
            reportData={reportData}
            setReportData={setReportData}
            simulationDetails={simulationDetails}
            compressImage={compressImage}
            addSimulationEvidence={addSimulationEvidence}
            simulationEvidence={simulationEvidence}
            isAiActive={isAiActive}
            generateAIReport={generateAIReport}
            isGeneratingReport={isGeneratingReport}
            setExpandedImage={setExpandedImage}
            removeSimulationEvidence={removeSimulationEvidence}
            updateProcedure={updateProcedure}
          />
        )}

        <div style={{  marginTop: '20px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--glass-border)', paddingTop: '20px', paddingRight: '80px'  }}>
          <div style={{  display: 'flex', gap: '10px'  }}>
            <button type="button" className="btn" style={{  background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)'  }} onClick={handleCancel}>Cancel</button>
            <button type="button" className="btn" style={{  background: 'rgba(255,255,255,0.1)'  }} onClick={handlePrev} disabled={step === 1}>Back</button>
          </div>
          {step < 4 ? (
            <button type="button" className="btn" onClick={handleNext}>Next Step</button>
          ) : (
            <button type="button" className="btn" onClick={finishExercise} style={{  background: 'var(--success)', display: 'flex', alignItems: 'center', gap: '8px'  }}>
              <CheckSquare size={16} /> Submit
            </button>
          )}
        </div>
        
        {expandedImage && (
            <div style={{  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out'  }} onClick={() => setExpandedImage(null)}>
                <img src={expandedImage} alt="Expanded Evidence" style={{  maxWidth: '90%', maxHeight: '90%', borderRadius: '8px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)'  }} />
            </div>
        )}

        {isDraftModalOpen && (
            <div className="animate-fade-in" style={{  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(5, 5, 10, 0.85)', backdropFilter: 'blur(12px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center'  }}>
                <div className="glass-panel responsive-modal" style={{ display: 'flex', flexDirection: 'column', background: 'rgba(11, 12, 16, 0.95)', border: '1px solid var(--accent-primary)', borderRadius: '12px', boxShadow: '0 0 30px rgba(126, 34, 206, 0.3)' }}>
                    <div style={{  padding: '20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'  }}>
                        <h3 style={{  margin: 0, color: 'var(--text-primary)', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px'  }}>
                            <Save size={20} color="var(--accent-primary)" /> Saved Drafts
                        </h3>
                        <button className="close-btn" onClick={() => setIsDraftModalOpen(false)}><X size={20} /></button>
                    </div>
                    <div style={{  padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px'  }}>
                        {savedDrafts.length === 0 ? (
                            <div style={{  textAlign: 'center', color: 'var(--text-muted)', padding: '30px 0'  }}>No saved drafts found.</div>
                        ) : (
                            savedDrafts.map(draft => (
                                <div key={draft.id} style={{  display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', padding: '15px', borderRadius: '8px'  }}>
                                    <div>
                                        <div style={{  fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '1.05rem', marginBottom: '4px'  }}>{draft.name}</div>
                                        <div style={{  color: 'var(--text-muted)', fontSize: '0.85rem'  }}>{new Date(draft.timestamp).toLocaleString()}</div>
                                    </div>
                                    <div style={{  display: 'flex', gap: '10px'  }}>
                                        <button className="btn hover-lift" onClick={() => restoreDraft(draft)} style={{  background: 'var(--accent-primary)', padding: '6px 12px', fontSize: '0.85rem'  }}>Load</button>
                                        <button className="btn hover-lift" onClick={() => deleteDraft(draft.id)} style={{  background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '6px 12px', fontSize: '0.85rem'  }}><Trash2 size={14} /></button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}
