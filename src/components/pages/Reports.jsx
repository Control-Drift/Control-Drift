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
import { useAppContext } from '../../AppContext';
import { useToast } from '../ui/Toast';
import { Search, ChevronDown, ChevronUp, Clock, AlertCircle, TrendingUp, Filter, Calendar, Info, FileText, Target, Play, Database, BookOpen, Layers, Zap, X, Map, ShieldAlert, Shield, Sparkles, Plus, Edit3, User, Server, ArrowLeft, Edit, Save, CheckSquare, Square, Unlock, Trash2, Code } from 'lucide-react';
import CoverageRatingDropdown from '../dropdowns/CoverageRatingDropdown';
import SeverityDropdown from '../dropdowns/SeverityDropdown';
import ValidationOutcomeDropdown from '../dropdowns/ValidationOutcomeDropdown';
import TTPSelector from '../features/TTPSelector';
import { useLocation, useNavigate } from 'react-router-dom';
import { PDFDownloadLink } from '@react-pdf/renderer';
import ReportPDF from '../features/ReportPDF';
import UnifiedPosturePill from '../ui/UnifiedPosturePill';
import EventCard from '../ui/EventCard';
import TagDropdown from '../dropdowns/TagDropdown';
import EnvironmentDropdown from '../dropdowns/EnvironmentDropdown';
import InlineTagDropdown from '../dropdowns/InlineTagDropdown';
import InlineEnvironmentDropdown from '../dropdowns/InlineEnvironmentDropdown';
import RichMarkdownEditor from '../ui/RichMarkdownEditor';

/**
 * Reports Component
 * 
 * Handles the display, filtering, and editing of finalized "Simulations".
 * 
 * CORE WORKFLOW:
 * 1. Displays all simulations (campaigns) pulled from the `simulations` database table.
 * 2. Allows drilling down into the specific `events` (TTP tests) that made up the simulation.
 * 3. Provides an "Unlock Report" workflow (`handleConfirmUnlock`) that requires
 *    a textual justification to edit finalized markdown summaries for audit logging.
 * 
 * @returns {JSX.Element} The Reports dashboard view.
 */
export default function Reports() {
  const { dbAdapter, events, completeExercise, simulationSummaries, saveSimulationSummary, simulationEvidence, addSimulationEvidence, compressImage, mitreData, aiSettings, generateAIContent, gaps, setActiveAiContext, isAuthenticated, isAiActive, activeTagFilter, activeEnvironmentFilter, deleteSimulation, confirmAction, createGap } = useAppContext();
  const { addToast } = useToast();
  
  const isMounted = React.useRef(true);
  React.useEffect(() => {
      isMounted.current = true;
      return () => {
          isMounted.current = false;
      };
  }, []);
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedSimulation, setSelectedSimulation] = useState(null);
  const [returnToGapId, setReturnToGapId] = useState(null);
  const [activeSimulationDrilldown, setActiveSimulationDrilldown] = useState(null);
  const [editReportForm, setEditReportForm] = useState(null);
  const [unlockPromptVisible, setUnlockPromptVisible] = useState(false);
  const [unlockJustification, setUnlockJustification] = useState('');
  const [viewingCodeData, setViewingCodeData] = useState(null);

  
  const [showLogModal, setShowLogModal] = useState(false);
  const [manualSimulation, setManualSimulation] = useState('');
  const [manualSummary, setManualSummary] = useState('');
  const [manualEnvironment, setManualEnvironment] = useState([]);
  const [manualTags, setManualTags] = useState([]);
  const [manualProcedures, setManualProcedures] = useState([{ id: 1, name: 'Event 1', ttps: [], coverageRating: 'None', severity: 'High', outcome: 'Missed' }]);
  const [isDrafting, setIsDrafting] = useState(false);
  const [activeManualProcedureId, setActiveManualProcedureId] = useState(1);
  const [collapsedCards, setCollapsedCards] = useState({});

  // Paginated events list for the selected simulation
  const [simulationExercises, setSimulationExercises] = useState([]);
  const [simulationPage, setSimulationPage] = useState(1);
  const [simulationLimit] = useState(10);
  const [simulationTotal, setSimulationTotal] = useState(0);

  // Simulation counts
  const [simulationCounts, setSimulationCounts] = useState({ blocked: 0, medium: 0, minimal: 0, missed: 0, total: 0 });

  // List of simulations for the dashboard/grid
  
  const getOutcomeColor = (str) => {
      if (!str) return 'var(--text-primary)';
      const cleanStr = str.replace('✓', '').trim();
      if (cleanStr === 'Prevented & Alerted') return 'var(--success)';
      if (cleanStr === 'Prevented') return '#06b6d4'; // Cyan
      if (cleanStr === 'Alerted') return '#3b82f6'; // Blue
      if (cleanStr.startsWith('Logged') || cleanStr === 'Partial') return 'var(--warning)';
      if (cleanStr === 'Missed') return 'var(--danger)';
      return 'var(--text-primary)';
  };
  
  const getOutcomeBg = (str) => {
      if (!str) return 'rgba(255,255,255,0.1)';
      const cleanStr = str.replace('✓', '').trim();
      if (cleanStr === 'Prevented & Alerted') return 'rgba(16, 185, 129, 0.15)';
      if (cleanStr === 'Prevented') return 'rgba(6, 182, 212, 0.15)';
      if (cleanStr === 'Alerted') return 'rgba(59, 130, 246, 0.15)';
      if (cleanStr.startsWith('Logged') || cleanStr === 'Partial') return 'rgba(245, 158, 11, 0.15)';
      if (cleanStr === 'Missed') return 'rgba(239, 68, 68, 0.15)';
      return 'rgba(255,255,255,0.1)';
  };
  
  const getOutcomeBorder = (str) => {
      if (!str) return 'rgba(255,255,255,0.2)';
      const cleanStr = str.replace('✓', '').trim();
      if (cleanStr === 'Prevented & Alerted') return 'rgba(16, 185, 129, 0.3)';
      if (cleanStr === 'Prevented') return 'rgba(6, 182, 212, 0.3)';
      if (cleanStr === 'Alerted') return 'rgba(59, 130, 246, 0.3)';
      if (cleanStr.startsWith('Logged') || cleanStr === 'Partial') return 'rgba(245, 158, 11, 0.3)';
      if (cleanStr === 'Missed') return 'rgba(239, 68, 68, 0.3)';
      return 'rgba(255,255,255,0.2)';
  };
  const [simulationList, setSimulationList] = useState({});
  const [isSimulationsLoading, setIsSimulationsLoading] = useState(true);
  const [simulationSearchTerm, setSimulationSearchTerm] = useState('');

  useEffect(() => {
    setActiveAiContext({
      view: 'Reports',
      description: 'Historical archive of past adversary simulations, with executive summaries and specific procedures executed.'
    });
    return () => setActiveAiContext(null);
  }, [setActiveAiContext]);

  const loadSimulations = useCallback(async () => {
      setIsSimulationsLoading(true);
      try {
          if (dbAdapter && typeof dbAdapter.fetchSimulations === 'function') {
              const names = await dbAdapter.fetchSimulations();
              const listObj = {};
              for (const name of names) {
                  const res = await dbAdapter.fetchEvents(1, 1000, name);
                  listObj[name] = {
                      date: res.data[0]?.date || new Date().toISOString(),
                      events: res.data || []
                  };
              }
              setSimulationList(listObj);
          } else {
              // Legacy fallback
              const accSimulations = events.reduce((acc, ex) => {
                  if (ex.simulation === 'Admin Config') return acc;
                  if (!acc[ex.simulation]) acc[ex.simulation] = { date: ex.date, events: [] };
                  acc[ex.simulation].events.push(ex);
                  return acc;
              }, {});
              
              gaps.forEach(g => {
                  if (!g.simulation || g.simulation === 'Manual Entry' || (!accSimulations[g.simulation] && g.id && g.id.startsWith('GAP-'))) {
                      const cName = g.simulation && g.simulation !== 'Manual Entry' ? g.simulation : 'Manual Entry';
                      if (!accSimulations[cName]) accSimulations[cName] = { date: g.createdDate || new Date().toISOString(), events: [] };
                      if (!accSimulations[cName].events.find(ex => ex.id === g.id)) {
                          accSimulations[cName].events.push({
                              id: g.id,
                              simulation: cName,
                              ttp: g.ttp || 'Unknown',
                              finding: g.finding || g.details || 'Manual Gap',
                              status: (g.severity === 'Critical' || g.severity === 'High') ? 'low' : (g.severity === 'Medium' ? 'medium' : 'high'),
                              severity: g.severity || 'High',
                              remediation: g.remediation || g.actionItems || '',
                              date: g.createdDate || new Date().toISOString()
                          });
                      }
                  }
              });

              Object.keys(accSimulations).forEach(k => {
                  accSimulations[k].events.sort((a, b) => new Date(b.date) - new Date(a.date));
              });
              setSimulationList(accSimulations);
          }
      } catch (err) {
          console.error("loadSimulations error:", err);
      } finally {
          setIsSimulationsLoading(false);
      }
  }, [dbAdapter, events, gaps]);

  useEffect(() => {
      if (isAuthenticated) {
          loadSimulations();
      }
  }, [isAuthenticated, loadSimulations]);

  const loadSimulationExercises = useCallback(async (simulationName, page) => {
      try {
          if (dbAdapter && typeof dbAdapter.fetchEvents === 'function') {
              const res = await dbAdapter.fetchEvents(page, simulationLimit, simulationName);
              setSimulationExercises(res.data || []);
              setSimulationTotal(res.total || 0);
              setSimulationPage(res.page || page);
          } else {
              // Legacy fallback
              const filtered = events.filter(ex => ex.simulation === simulationName);
              filtered.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
              
              const startIndex = (page - 1) * simulationLimit;
              const paginated = filtered.slice(startIndex, startIndex + simulationLimit);
              setSimulationExercises(paginated);
              setSimulationTotal(filtered.length);
              setSimulationPage(page);
          }
      } catch (err) {
          console.error("loadSimulationExercises error:", err);
      }
  }, [dbAdapter, simulationLimit, events]);

  useEffect(() => {
      if (selectedSimulation) {
          loadSimulationExercises(selectedSimulation, 1);
      }
  }, [selectedSimulation, loadSimulationExercises]);

  const handleSimulationPageChange = (newPage) => {
      loadSimulationExercises(selectedSimulation, newPage);
  };

  useEffect(() => {
      if (!selectedSimulation) return;
      async function computeCounts() {
          const simData = simulationList[selectedSimulation];
          if (!simData || !simData.events) return;

          let blocked = 0;
          let medium = 0;
          let minimal = 0;
          let missed = 0;
          let total = 0;
          
          const testResults = simulationSummaries[selectedSimulation]?.testResults;
          
          if (testResults && Array.isArray(testResults) && testResults.length > 0) {
              testResults.forEach(e => {
                   const r = e.coverageRating;
                   if (r === 'Optimal') blocked++;
                   else if (r === 'Partial') medium++;
                   else if (r === 'Minimal') minimal++;
                   else if (r === 'None') missed++;
              });
              total = testResults.length;
          } else {
              const ttpSet = new Set();
              simData.events.forEach(e => {
                  if (e.status === 'na') return;
                  if (!ttpSet.has(e.ttp)) {
                      ttpSet.add(e.ttp);
                      if (e.status === 'high') blocked++;
                      else if (e.status === 'medium') medium++;
                      else if (e.status === 'minimal') minimal++;
                      else missed++;
                  }
              });
              total = ttpSet.size;
          }
          
          setSimulationCounts({
              blocked,
              medium,
              minimal,
              missed,
              total
          });
      }
      computeCounts();
  }, [selectedSimulation, simulationList, simulationSummaries]);

  const toggleManualSimulationTTP = (techId, techName) => {
      setManualProcedures(prev => prev.map(p => {
          if (p.id === activeManualProcedureId) {
              if (p.ttps.includes(techId)) {
                  return { ...p, ttps: p.ttps.filter(t => t !== techId) };
              }
              return { ...p, ttps: [...p.ttps, techId] };
          }
          return p;
      }));
  };

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

  const renderBold = (str) => {
     const parts = str.split(/(\*\*.*?\*\*)/g);
     return parts.map((bp, i) => {
       if (bp.startsWith('**') && bp.endsWith('**')) {
          return <strong key={i} style={{  color: 'var(--text-primary)'  }}>{bp.slice(2, -2)}</strong>;
       }
       return bp;
     });
  };

  const formatMarkdown = (text) => {
    if (!text) return null;
    const blocks = text.split(/(```[\s\S]*?```)/g);
    return blocks.map((block, index) => {
      if (block.startsWith('```') && block.endsWith('```')) {
        const code = block.replace(/```\w*\n?/, '').replace(/```$/, '');
        return (
          <div key={index} style={{  background: '#000', padding: '16px', borderRadius: '8px', margin: '16px 0', fontFamily: 'monospace', fontSize: '0.9rem', color: '#10b981', overflowX: 'auto', border: '1px solid rgba(16, 185, 129, 0.3)', boxShadow: 'inset 0 4px 10px rgba(0,0,0,0.8)'  }}>
            <pre style={{  margin: 0  }}>{code}</pre>
          </div>
        );
      }
      
      return (
        <div key={index} style={{  color: 'var(--text-primary)'  }}>
          {block.split('\n').map((line, j) => {
            if (!line.trim()) return <br key={j} />;
            if (line.startsWith('#### ')) return <h4 key={j} style={{ color: 'var(--text-primary)', marginTop: '10px', marginBottom: '5px', fontSize: '0.95rem', letterSpacing: '0.1px' }}>{line.substring(5)}</h4>;
            if (line.startsWith('### ')) return <h3 key={j} style={{ color: 'var(--text-primary)', marginTop: '15px', marginBottom: '5px', fontSize: '1.05rem', letterSpacing: '0.2px' }}>{line.substring(4)}</h3>;
            if (line.startsWith('## ')) return <h2 key={j} style={{ color: 'var(--text-primary)', marginTop: '20px', marginBottom: '8px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '5px', fontSize: '1.2rem' }}>{line.substring(3)}</h2>;
            if (line.startsWith('# ')) return <h1 key={j} style={{ color: 'var(--text-primary)', marginTop: '20px', marginBottom: '10px', fontSize: '1.4rem' }}>{line.substring(2)}</h1>;
            if (line.startsWith('- ') || line.startsWith('* ')) return <li key={j} style={{ marginLeft: '20px', marginBottom: '4px', lineHeight: '1.4', color: 'var(--text-primary)' }}>{renderBold(line.substring(2))}</li>;
            if (/^\d+\.\s/.test(line)) return <li key={j} style={{  marginLeft: '20px', marginBottom: '4px', lineHeight: '1.4', listStyleType: 'decimal', color: 'var(--text-primary)', paddingLeft: '5px'  }}>{renderBold(line.replace(/^\d+\.\s/, ''))}</li>;
            if (line.startsWith('> ')) {
              return (
                <div key={j} style={{  borderLeft: '3px solid var(--accent-secondary)', margin: '10px 0', background: 'rgba(192, 132, 252, 0.05)', padding: '10px 15px', borderRadius: '0 4px 4px 0', fontStyle: 'italic', color: 'var(--text-secondary)', lineHeight: '1.4'  }}>
                  {renderBold(line.substring(2))}
                </div>
              );
            }
            
            return <p key={j} style={{  margin: '8px 0', lineHeight: '1.5', color: 'var(--text-primary)', fontSize: '0.9rem'  }}>{renderBold(line)}</p>;
          })}
        </div>
      );
    });
  };

  useEffect(() => {
    if (location.state) {
      if (location.state.simulation) setSelectedSimulation(location.state.simulation);
      if (location.state.returnToGapId) setReturnToGapId(location.state.returnToGapId);
    }
  }, [location]);

  const handleLogExercise = async () => {
     if (!manualSimulation) {
        addToast("Simulation name is required.", 'warning');
        return;
     }
     
     const validProcedures = manualProcedures.filter(p => p.ttps.length > 0);
     if (validProcedures.length === 0) {
        addToast("At least one TTP must be mapped in the procedures.", 'warning');
        return;
     }
     


     const uniqueTTPs = [];
     validProcedures.forEach(p => {
         p.ttps.forEach(t => {
             if (!uniqueTTPs.includes(t)) {
                 uniqueTTPs.push(t);
             }
         });
     });

     for (const ttp of uniqueTTPs) {
         const proceduresForTtp = validProcedures.filter(p => p.ttps.includes(ttp));
         let totalScore = 0;
         let validCount = 0;
         proceduresForTtp.forEach(p => {
             if (p.coverageRating === 'Optimal') totalScore += 100;
             else if (p.coverageRating === 'Partial') totalScore += 50;
             else if (p.coverageRating === 'Minimal') totalScore += 25;
             else if (p.coverageRating === 'None') totalScore += 0;
             validCount++;
         });
         
         let aggOutcomeStatus = 'low';
         let aggOutcome = 'Missed';
         let aggCoverageRating = 'None';
         if (validCount > 0) {
             const avg = totalScore / validCount;
             if (avg === 100) { aggOutcomeStatus = 'high'; aggOutcome = 'Prevented'; aggCoverageRating = 'Optimal'; }
             else if (avg >= 50) { aggOutcomeStatus = 'medium'; aggOutcome = 'Logged'; aggCoverageRating = 'Partial'; }
             else if (avg > 0) { aggOutcomeStatus = 'minimal'; aggOutcome = 'Minimal'; aggCoverageRating = 'Minimal'; }
             else { aggOutcomeStatus = 'low'; aggOutcome = 'Missed'; aggCoverageRating = 'None'; }
         }
         
         const worstSeverity = proceduresForTtp.some(p => p.severity === 'Critical') ? 'Critical' : 
                               proceduresForTtp.some(p => p.severity === 'High') ? 'High' : 
                               proceduresForTtp.some(p => p.severity === 'Medium') ? 'Medium' : 
                               proceduresForTtp.some(p => p.severity === 'Low') ? 'Low' : 'Medium';

         const remediationNotes = proceduresForTtp.map(p => {
             return `Event: ${p.name || 'Unnamed Event'} [Outcome: ${p.outcome || 'Missed'}, Coverage: ${p.coverageRating || 'None'}]`;
         }).join('\n\n') || 'External simulation testing results logged.';

         try {
             await completeExercise(
                 ttp, 
                 aggOutcome, 
                 remediationNotes, 
                 aggOutcomeStatus, 
                 manualSimulation,
                 worstSeverity,
                 manualEnvironment.length > 0 ? manualEnvironment : 'Unknown Environment',
                 aggCoverageRating,
                 aggOutcome,
                 manualTags || []
             );
         } catch (e) {
             addToast(`Error saving event: ${e.message}`, 'error');
             return;
         }
     }
     
     try {
         const summaryPayload = {
             summary: manualSummary,
             details: { goals: manualSummary, environmentCategory: manualEnvironment.length > 0 ? manualEnvironment : 'Unknown Environment', participants: 'Manual Entry', tags: manualTags || [] },
             testResults: manualProcedures.map(p => ({
                 ...p,
                 ttps: p.ttps || [],
                 outcome: p.outcome || 'Missed'
             })),
             timestamp: new Date().toISOString()
         };
         
         for (const p of manualProcedures) {
             const covStr = String(p.coverageRating || 'None');
             if (covStr === 'Partial' || covStr === 'Minimal' || covStr === 'None') {
                 const severity = p.severity || 'Medium';
                 const baseScore = severity === 'Critical' ? 100 : severity === 'High' ? 80 : severity === 'Medium' ? 50 : 20;
                 const visibilityMultiplier = (covStr === 'None') ? 1.0 : (covStr === 'Minimal' ? 0.9 : (covStr === 'Partial' ? 0.75 : 0.0));
                 const priorityScore = Math.round(baseScore * visibilityMultiplier);
                 
                 const newGap = {
                     id: Date.now() + Math.random().toString(),
                     displayId: 'GAP-' + Math.floor(1000 + Math.random() * 9000),
                     ttp: (p.ttps || []).join(', ') || 'Unmapped',
                     simulation: manualSimulation,
                     finding: p.name || 'Unnamed Event',
                     outcome: p.outcome || 'Missed',
                     coverageRating: covStr,
                     details: `Execution: ${p.execNotes || 'N/A'}\nDetection: ${p.detNotes || 'N/A'}`,
                     severity: severity,
                     priorityScore: priorityScore,
                     status: 'Open',
                     actionItems: 'Review telemetry and develop detection logic.',
                     stakeholders: [],
                     remediationNotes: "",
                     environment: manualEnvironment.length > 0 ? manualEnvironment : ['Unknown Environment'],
                     tags: manualTags || [],
                     createdDate: new Date().toISOString()
                 };
                 if (createGap) await createGap(newGap, true);
             }
         }
         
         await saveSimulationSummary(manualSimulation, summaryPayload);
         await loadSimulations();
     } catch (e) {
         addToast(`Error saving summary: ${e.message}`, 'error');
         return;
     }
     
     setShowLogModal(false);
     setManualSimulation('');
     setManualSummary('');
     setManualEnvironment([]);
     setManualTags([]);
     setManualProcedures([{ id: 1, name: 'Event 1', ttps: [], coverageRating: 'None', severity: 'High', outcome: 'Missed' }]);
  };

  const handleDraftSummary = async () => {
      if (!isAiActive) return;
      if (!manualSimulation) {
          addToast("Please provide a Simulation Name first so the AI has context.", 'warning');
          return;
      }
      
      const validProcedures = manualProcedures.filter(p => p.ttps.length > 0);
      if (validProcedures.length === 0) {
          addToast("Please map at least one TTP to an event so the AI has data to analyze.", 'warning');
          return;
      }
      
      setIsDrafting(true);
      try {
          const prompt = `Draft an Executive Summary for a Purple Team simulation named "${manualSimulation}".
          
Here are the procedural logs from the simulation:
${JSON.stringify(validProcedures, null, 2)}

Provide a highly professional, concise executive summary in markdown. Focus on high-level risk, business impact, and strategic recommendations based on the outcomes. Do not include filler text. Include a dedicated section titled "## Risk Analysis" that ties technical gaps to potential business consequences.`;

          const response = await generateAIContent(prompt, "You are an elite cybersecurity AI. Write professional executive summaries based on technical simulation data.");
          if (!isMounted.current) return;
          setManualSummary(response);
      } catch (err) {
          if (!isMounted.current) return;
          addToast("Failed to generate summary: " + err.message, 'error');
      } finally {
          if (isMounted.current) setIsDrafting(false);
      }
  };

  const updateManualProcedure = (id, field, value) => {
     setManualProcedures(prevProcedures => prevProcedures.map(p => {
         if (p.id !== id) return p;
         const updated = { ...p, [field]: value };
         return updated;
     }));
   };

  const handleOpenUnlockPrompt = () => {
      setUnlockJustification('');
      setUnlockPromptVisible(true);
  };

  const handleConfirmUnlock = () => {
      if (!unlockJustification.trim()) {
          addToast('Please provide a justification to unlock the report.', 'warning');
          return;
      }
      setUnlockPromptVisible(false);
      
      const summaryData = simulationSummaries[selectedSimulation];
      if (!summaryData) return;
      
      const participantsData = summaryData.details?.participants;
      let participantsString = '';
      if (typeof participantsData === 'string') {
          participantsString = participantsData;
      } else if (Array.isArray(participantsData)) {
          participantsString = participantsData.map(p => `${p.name} (${p.role})`).join(', ');
      }

      const rawSummary = typeof summaryData === 'string' ? summaryData : (summaryData.summary || '');
      
      const sections = {
          executiveSummary: '',
          keyFindings: '',
          businessImpact: '',
          recommendations: ''
      };
      
      const active = {
          executiveSummary: true,
          keyFindings: false,
          businessImpact: false,
          recommendations: false
      };

      if (rawSummary.includes('## Key Findings') || rawSummary.includes('## Risk Analysis') || rawSummary.includes('## Recommendations') || rawSummary.includes('## Executive Summary')) {
          const parts = rawSummary.split(/(?=## (?:Executive Summary|Key Findings|Risk Analysis|Recommendations))/i);
          parts.forEach(part => {
              if (part.trim().toLowerCase().startsWith('## executive summary')) {
                  sections.executiveSummary = part.replace(/## Executive Summary/i, '').trim();
                  active.executiveSummary = true;
              } else if (part.trim().toLowerCase().startsWith('## key findings')) {
                  sections.keyFindings = part.replace(/## Key Findings/i, '').trim();
                  active.keyFindings = true;
              } else if (part.trim().toLowerCase().startsWith('## risk analysis')) {
                  sections.businessImpact = part.replace(/## Risk Analysis/i, '').trim();
                  active.businessImpact = true;
              } else if (part.trim().toLowerCase().startsWith('## recommendations')) {
                  sections.recommendations = part.replace(/## Recommendations/i, '').trim();
                  active.recommendations = true;
              } else {
                  sections.executiveSummary = (sections.executiveSummary + '\n\n' + part).trim();
              }
          });
      } else {
          sections.executiveSummary = rawSummary;
      }

      setEditReportForm({
          executiveSummary: sections.executiveSummary,
          keyFindings: sections.keyFindings,
          businessImpact: sections.businessImpact,
          recommendations: sections.recommendations,
          active: active,
          goals: summaryData.details?.goals || '',
          participants: participantsString
      });
  };

  const handleSaveEditReport = async () => {
      if (!editReportForm) return;
      
      let compiledSummary = '';
      if (editReportForm.active.executiveSummary && editReportForm.executiveSummary) compiledSummary += `## Executive Summary\n${editReportForm.executiveSummary}\n\n`;
      if (editReportForm.active.keyFindings && editReportForm.keyFindings) compiledSummary += `## Key Findings\n${editReportForm.keyFindings}\n\n`;
      if (editReportForm.active.businessImpact && editReportForm.businessImpact) compiledSummary += `## Risk Analysis\n${editReportForm.businessImpact}\n\n`;
      if (editReportForm.active.recommendations && editReportForm.recommendations) compiledSummary += `## Recommendations\n${editReportForm.recommendations}\n\n`;
      compiledSummary = compiledSummary.trim();
      
      const currentData = typeof simulationSummaries[selectedSimulation] === 'object' ? simulationSummaries[selectedSimulation] : { summary: simulationSummaries[selectedSimulation] };
      
      const updatedSummary = {
          ...currentData,
          summary: compiledSummary,
          lastEditedAt: new Date().toISOString(),
          editJustification: unlockJustification,
          details: {
              ...(currentData.details || {}),
              goals: editReportForm.goals,
              participants: editReportForm.participants
          }
      };
      
      await saveSimulationSummary(selectedSimulation, updatedSummary);
      addToast('Report updated successfully', 'success');
      setEditReportForm(null);
  };

  const renderUnlockPromptModal = () => {
      if (!unlockPromptVisible) return null;
      return (
          <div className="animate-fade-in fixed-overlay" style={{  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'  }}>
               <div className="glass-panel" style={{  width: '100%', maxWidth: '500px', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', padding: '0', borderRadius: '12px', overflow: 'hidden'  }}>
                   <div style={{  padding: '15px 25px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)'  }}>
                       <h2 style={{  margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-primary)'  }}>
                           <Unlock size={20} color="var(--warning)" /> Unlock Report
                       </h2>
                       <button className="close-btn" onClick={() => setUnlockPromptVisible(false)}><X size={20} /></button>
                   </div>
                   <div style={{ padding: '25px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                       <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5' }}>
                           This report is finalized. To unlock it for editing, please provide a brief justification for the audit log.
                       </p>
                       <textarea 
                           value={unlockJustification} 
                           onChange={(e) => setUnlockJustification(e.target.value)} 
                           placeholder="e.g. Correcting typo in the executive summary..." 
                           autoFocus
                           style={{ width: '100%', boxSizing: 'border-box', minHeight: '100px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '12px', color: 'var(--text-primary)', fontFamily: 'inherit', resize: 'vertical' }}
                       />
                       <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                           <button className="btn hover-lift" onClick={() => setUnlockPromptVisible(false)} style={{ background: 'transparent', border: '1px solid var(--glass-border)' }}>Cancel</button>
                           <button className="btn btn-primary hover-lift" onClick={handleConfirmUnlock} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>Proceed</button>
                       </div>
                   </div>
               </div>
          </div>
      );
  };

  const renderEditReportModal = () => {
      if (!editReportForm) return null;
      
      let previewSummary = '';
      if (editReportForm.active.executiveSummary && editReportForm.executiveSummary) previewSummary += `## Executive Summary\n${editReportForm.executiveSummary}\n\n`;
      if (editReportForm.active.keyFindings && editReportForm.keyFindings) previewSummary += `## Key Findings\n${editReportForm.keyFindings}\n\n`;
      if (editReportForm.active.businessImpact && editReportForm.businessImpact) previewSummary += `## Risk Analysis\n${editReportForm.businessImpact}\n\n`;
      if (editReportForm.active.recommendations && editReportForm.recommendations) previewSummary += `## Recommendations\n${editReportForm.recommendations}\n\n`;
      
      return (
           <div className="animate-fade-in fixed-overlay" style={{  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'  }}>
               <div className="glass-panel" style={{  width: '100%', maxWidth: '1400px', height: '90vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', padding: '0', borderRadius: '12px', overflow: 'hidden'  }}>
                   
                   <div style={{  padding: '15px 25px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)'  }}>
                       <h2 style={{  margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-primary)'  }}>
                           <Edit size={20} color="var(--accent-primary)" /> Edit Report: {selectedSimulation}
                       </h2>
                       <div style={{ display: 'flex', gap: '10px' }}>
                           <button className="btn hover-lift" onClick={() => setEditReportForm(null)} style={{ background: 'transparent', border: '1px solid var(--glass-border)' }}>Cancel</button>
                           <button className="btn btn-primary hover-lift" onClick={handleSaveEditReport} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Save size={16} /> Save Changes</button>
                       </div>
                   </div>

                   <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                       {/* Left Column: Narrative Builder */}
                       <div style={{ flex: '1', display: 'flex', flexDirection: 'column', padding: '25px', borderRight: '1px solid var(--glass-border)', overflowY: 'auto', background: 'rgba(10, 11, 16, 0.4)' }}>
                           <h3 style={{  margin: '0 0 15px 0', color: 'var(--text-primary)', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px'  }}>Narrative Builder</h3>
                           
                           <div style={{  display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '25px'  }}>
                               {[
                                   { id: 'executiveSummary', label: 'Executive Summary' },
                                   { id: 'keyFindings', label: 'Key Findings' },
                                   { id: 'businessImpact', label: 'Risk Analysis' },
                                   { id: 'recommendations', label: 'Recommendations' }
                               ].map(sec => (
                                   <button 
                                       key={sec.id} 
                                       className="btn hover-lift" 
                                       onClick={() => setEditReportForm(prev => ({ ...prev, active: { ...prev.active, [sec.id]: !prev.active[sec.id] } }))}
                                       style={{  
                                           padding: '6px 12px', 
                                           fontSize: '0.8rem', 
                                           borderRadius: '20px', 
                                           border: `1px solid ${editReportForm.active[sec.id] ? 'var(--accent-primary)' : 'var(--glass-border)'}`, 
                                           background: editReportForm.active[sec.id] ? 'rgba(156, 39, 176, 0.2)' : 'transparent',
                                           color: editReportForm.active[sec.id] ? 'var(--text-primary)' : 'var(--text-muted)',
                                           display: 'flex', alignItems: 'center', gap: '5px'
                                        }}>
                                       {editReportForm.active[sec.id] ? <CheckSquare size={14} /> : <Square size={14} />} {sec.label}
                                   </button>
                               ))}
                           </div>
                           
                           <div style={{  display: 'flex', flexDirection: 'column', gap: '20px'  }}>
                               {editReportForm.active.executiveSummary && (
                                  <div className="animate-fade-in" style={{ wordBreak: "break-all", overflowWrap: "anywhere", minWidth: 0, flexShrink: 1, maxHeight: "100%", overflowY: "auto" }}>
                                     <label style={{  display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '8px'   }}>Executive Summary</label>
                                     <RichMarkdownEditor minHeight="120px" value={editReportForm.executiveSummary} onChange={val => setEditReportForm({...editReportForm, executiveSummary: val})} placeholder="Provide a high-level overview..." />
                                  </div>
                               )}
                               {editReportForm.active.keyFindings && (
                                  <div className="animate-fade-in" style={{ wordBreak: "break-all", overflowWrap: "anywhere", minWidth: 0, flexShrink: 1, maxHeight: "100%", overflowY: "auto" }}>
                                    <label style={{  display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '8px'   }}>Key Findings</label>
                                    <RichMarkdownEditor minHeight="120px" value={editReportForm.keyFindings} onChange={val => setEditReportForm({...editReportForm, keyFindings: val})} placeholder="Detail specific strengths and areas for improvement..." />
                                  </div>
                               )}
                               {editReportForm.active.businessImpact && (
                                  <div className="animate-fade-in" style={{ wordBreak: "break-all", overflowWrap: "anywhere", minWidth: 0, flexShrink: 1, maxHeight: "100%", overflowY: "auto" }}>
                                    <label style={{  display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '8px'   }}>Risk Analysis</label>
                                    <RichMarkdownEditor minHeight="120px" value={editReportForm.businessImpact} onChange={val => setEditReportForm({...editReportForm, businessImpact: val})} placeholder="Describe the potential operational risk..." />
                                  </div>
                               )}
                               {editReportForm.active.recommendations && (
                                  <div className="animate-fade-in" style={{ wordBreak: "break-all", overflowWrap: "anywhere", minWidth: 0, flexShrink: 1, maxHeight: "100%", overflowY: "auto" }}>
                                    <label style={{  display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '8px'   }}>Recommendations</label>
                                    <RichMarkdownEditor minHeight="120px" value={editReportForm.recommendations} onChange={val => setEditReportForm({...editReportForm, recommendations: val})} placeholder="Provide actionable recommendations..." />
                                  </div>
                               )}
                               
                               {simulationSummaries[selectedSimulation]?.details?.participants !== 'Manual Entry' && (
                                   <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                                       <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Simulation Scenario</label>
                                       <textarea value={editReportForm.goals} onChange={(e) => setEditReportForm({...editReportForm, goals: e.target.value})} style={{ width: '100%', boxSizing: 'border-box', minHeight: '80px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '12px', color: 'var(--text-primary)', fontFamily: 'inherit', resize: 'vertical' }} placeholder="Describe the overarching goals..." />
                                   </div>
                               )}

                               <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                   <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Participants</label>
                                   <input type="text" value={editReportForm.participants} onChange={(e) => setEditReportForm({...editReportForm, participants: e.target.value})} style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text-primary)', fontFamily: 'inherit' }} placeholder="e.g. John Doe (Red Team)" />
                               </div>
                           </div>
                       </div>

                       {/* Right Column: Live Preview */}
                       <div style={{ flex: '1.2', background: 'var(--bg-primary)', padding: '30px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                           <div style={{  display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid rgba(156, 39, 176, 0.3)', paddingBottom: '15px', marginBottom: '20px'  }}>
                               <div>
                                  <h1 style={{  margin: 0, color: 'var(--text-primary)', fontSize: '1.8rem', letterSpacing: '-0.5px'  }}>{selectedSimulation}</h1>
                                  <p style={{  margin: '5px 0 0 0', color: 'var(--text-secondary)'  }}>Live Preview</p>
                               </div>
                           </div>
                           
                           <div style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '0.95rem' }}>
                               {previewSummary ? formatMarkdown(previewSummary) : <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '20px' }}>Select sections on the left to begin building your report narrative.</div>}
                           </div>
                       </div>
                   </div>
               </div>
           </div>
      );
  };

  const renderDrilldownModal = () => {
    if (!activeSimulationDrilldown) return null;
    return (
         <div className="animate-fade-in fixed-overlay" style={{  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px'  }}>
             <div className="glass-panel" style={{  width: '100%', maxWidth: '1000px', maxHeight: '85vh', overflowY: 'auto', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', padding: '0', borderRadius: '12px', display: 'flex', flexDirection: 'column'  }}>
                 <div style={{  padding: '20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 10  }}>
                     <h2 style={{  margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-primary)'  }}>
                         <Search size={24} /> Simulation Details Drilldown
                     </h2>
                     <button className="close-btn" onClick={() => setActiveSimulationDrilldown(null)}><X size={24} /></button>
                 </div>
                 
                 <div style={{  padding: '30px', display: 'flex', flexDirection: 'column', gap: '30px'  }}>
                     <div>
                         <h3 style={{  color: 'var(--text-primary)', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px', marginBottom: '15px'  }}>Scoping</h3>
                          <div style={{  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px'  }}>
                              <div style={{  background: 'var(--bg-primary)', padding: '15px', borderRadius: '8px', border: '1px solid var(--glass-border)'  }}>
                                  <h4 style={{  margin: '0 0 5px 0', color: 'var(--text-secondary)', fontSize: '0.85rem'  }}>Simulation Scenario</h4>
                                  <div style={{  fontSize: '0.9rem', color: 'var(--text-primary)'  }}>{activeSimulationDrilldown.details?.goals ? formatMarkdown(activeSimulationDrilldown.details.goals) : 'N/A'}</div>
                              </div>
                              <div style={{  background: 'var(--bg-primary)', padding: '15px', borderRadius: '8px', border: '1px solid var(--glass-border)'  }}>
                                  <h4 style={{  margin: '0 0 5px 0', color: 'var(--text-secondary)', fontSize: '0.85rem'  }}>Environment Category</h4>
                                  <div style={{  fontSize: '0.9rem', color: 'var(--text-primary)'  }}>{Array.isArray(activeSimulationDrilldown.details?.environmentCategory) ? activeSimulationDrilldown.details.environmentCategory.join(', ') : (activeSimulationDrilldown.details?.environmentCategory || 'Unknown Environment')}</div>
                              </div>
                              <div style={{  background: 'var(--bg-primary)', padding: '15px', borderRadius: '8px', border: '1px solid var(--glass-border)'  }}>
                                  <h4 style={{  margin: '0 0 5px 0', color: 'var(--text-secondary)', fontSize: '0.85rem'  }}>Tags</h4>
                                  <div style={{  fontSize: '0.9rem', color: 'var(--text-primary)'  }}>
                                     {(activeSimulationDrilldown.details?.tags && activeSimulationDrilldown.details.tags.length > 0) 
                                        ? activeSimulationDrilldown.details.tags.map(t => <span key={t} style={{ display: 'inline-block', padding: '2px 8px', background: 'var(--accent-secondary)', color: 'white', borderRadius: '12px', fontSize: '0.75rem', marginRight: '5px', marginBottom: '5px' }}>{t}</span>) 
                                        : 'N/A'}
                                  </div>
                              </div>
                              <div style={{  background: 'var(--bg-primary)', padding: '15px', borderRadius: '8px', border: '1px solid var(--glass-border)', gridColumn: 'span 3'  }}>
                                  <h4 style={{  margin: '0 0 5px 0', color: 'var(--text-secondary)', fontSize: '0.85rem'  }}>Participants</h4>
                                  <div style={{  fontSize: '0.9rem', color: 'var(--text-primary)'  }}>
                                     {Array.isArray(activeSimulationDrilldown.details?.participants) 
                                        ? activeSimulationDrilldown.details.participants.map(p => `${p.name} (${p.role})`).join(', ') 
                                        : activeSimulationDrilldown.details?.participants || 'N/A'}
                                  </div>
                              </div>
                          </div>
                     </div>

                     {activeSimulationDrilldown.attackChain && (
                          <div>
                              <h3 style={{  color: 'var(--text-primary)', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px', marginBottom: '15px'  }}>Attack Chain</h3>
                              <div style={{  background: 'var(--bg-primary)', padding: '20px', borderRadius: '8px', border: '1px solid var(--glass-border)', fontSize: '0.9rem'  }}>
                                  {formatMarkdown(activeSimulationDrilldown.attackChain)}
                              </div>
                          </div>
                     )}

                     {(() => {
                          const manualGaps = simulationList[selectedSimulation]?.events || [];
                          const baseResults = (activeSimulationDrilldown.testResults && Array.isArray(activeSimulationDrilldown.testResults)) ? activeSimulationDrilldown.testResults : [];
                          const ttpSet = new Set(baseResults.flatMap(r => r.ttps || []));
                          
                          const displayResults = [...baseResults];
                          manualGaps.filter(e => !ttpSet.has(e.ttp) && e.status !== 'na').forEach(mg => {
                              displayResults.push({
                                  id: mg.id || Math.random(),
                                  name: mg.finding || 'Manual Gap',
                                  eventType: 'Manual Log',
                                  ttps: [mg.ttp],
                                  expectedOutcome: 'N/A',
                                  outcome: mg.status === 'high' ? 'Prevented' : mg.status === 'medium' ? 'Logged' : 'Missed',
                                  severity: 'N/A',
                                  execNotes: mg.remediation || 'Manual entry review required.',
                                  detNotes: ''
                              });
                          });
                          
                          if (displayResults.length === 0) return null;
                          
                          return (
                          <div>
                              <h3 style={{  color: 'var(--text-primary)', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px', marginBottom: '15px'  }}>Event Log</h3>
                              <div style={{  display: 'flex', flexDirection: 'column', gap: '15px'  }}>
                                  {displayResults.map((p, index) => (
                                      <div key={p.id || index} style={{  background: 'var(--bg-primary)', border: '1px solid var(--glass-border)', borderRadius: '8px', overflow: 'hidden'  }}>
                                          <div style={{  padding: '15px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'  }}>
                                              <h4 style={{  margin: 0, color: 'var(--text-primary)'  }}>{p.name || `Event ${index + 1}`}</h4>
                                              <span style={{  fontSize: '0.8rem', color: 'var(--text-secondary)'  }}>{p.eventType || 'Payload'}</span>
                                          </div>
                                          <div style={{  padding: '15px'  }}>
                                              <div style={{  display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '15px'  }}>
                                                  <div style={{  flex: 1, minWidth: '200px'  }}>
                                                      <div style={{  fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px'  }}>Mapped TTPs</div>
                                                      <div style={{  display: 'flex', flexWrap: 'wrap', gap: '6px'  }}>
                                                          {(p.ttps || []).map(t => {
                                                              const ttpId = typeof t === 'object' ? t.id : t;
                                                              return <span key={ttpId} style={{  background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', color: 'var(--text-primary)', border: '1px solid var(--glass-border)'  }}>{ttpId}</span>;
                                                          })}
                                                      </div>
                                                  </div>
                                                  <div style={{  flex: 1, minWidth: '150px'  }}>
                                                      <div style={{  fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px'  }}>Expected Outcome</div>
                                                      <span style={{  color: getOutcomeColor(p.expectedOutcome || 'N/A'), fontWeight: 'bold', display: 'inline-block', padding: '4px 8px', background: getOutcomeBg(p.expectedOutcome || 'N/A'), borderRadius: '4px', border: `1px solid ${getOutcomeBorder(p.expectedOutcome || 'N/A')}`  }}>{p.expectedOutcome || 'N/A'}</span>
                                                  </div>
                                                  <div style={{  flex: 1, minWidth: '150px'  }}>
                                                      <div style={{  fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px'  }}>Actual Outcome</div>
                                                      {p.outcome?.includes(' ➔ ') ? (
                                                          <div style={{  display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap'  }}>
                                                              <span style={{  display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', background: getOutcomeBg(p.outcome.split(' ➔ ')[0]), color: getOutcomeColor(p.outcome.split(' ➔ ')[0]), border: `1px solid ${getOutcomeBorder(p.outcome.split(' ➔ ')[0])}`, textDecoration: 'line-through', opacity: 0.7  }}>
                                                                  {p.outcome.split(' ➔ ')[0]}
                                                              </span>
                                                              <span style={{  color: 'var(--text-muted)'  }}>&rarr;</span>
                                                              <span style={{  display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', background: getOutcomeBg(p.outcome.split(' ➔ ')[1]), color: getOutcomeColor(p.outcome.split(' ➔ ')[1]), border: `1px solid ${getOutcomeBorder(p.outcome.split(' ➔ ')[1])}`  }}>
                                                                  {p.outcome.split(' ➔ ')[1]}
                                                              </span>
                                                          </div>
                                                      ) : (
                                                          <span style={{  color: getOutcomeColor(p.outcome), fontWeight: 'bold', display: 'inline-block', padding: '4px 8px', background: getOutcomeBg(p.outcome), borderRadius: '4px', border: `1px solid ${getOutcomeBorder(p.outcome)}`  }}>{p.outcome}</span>
                                                      )}
                                                      {(() => {
                                                          const expected = p.expectedOutcome || 'N/A';
                                                          const actual = p.outcome?.includes(' ➔ ') ? p.outcome.split(' ➔ ')[1] : p.outcome;
                                                          return expected !== actual && actual !== 'Untested' && actual !== 'N/A' && actual;
                                                      })() && <span style={{  marginLeft: '8px', fontSize: '0.7rem', color: 'var(--danger)', fontStyle: 'italic'  }}>Control Drift</span>}
                                                  </div>
                                                  <div style={{  flex: 1, minWidth: '150px'  }}>
                                                      <div style={{  fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px'  }}>Risk Severity</div>
                                                      <span style={{  color: p.severity === 'Critical' ? 'var(--severity-critical)' : p.severity === 'High' ? 'var(--severity-high)' : p.severity === 'Medium' ? 'var(--severity-medium)' : p.severity === 'Low' ? 'var(--severity-low)' : 'var(--text-secondary)', fontWeight: 'bold'  }}>{p.severity || 'N/A'}</span>
                                                  </div>
                                              </div>
                                              
                                              <div style={{  display: 'flex', gap: '20px', fontSize: '0.85rem'  }}>
                                                  <div style={{  flex: 1  }}>
                                                      <div style={{  color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 'bold', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px'  }}>
                                                          <span style={{  width: '8px', height: '8px', borderRadius: '50%', background: 'var(--danger)', boxShadow: '0 0 8px var(--danger)'  }}></span>
                                                          Red Team Notes
                                                      </div>
                                                      <div style={{ color: 'var(--text-primary)', background: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', border: '1px solid var(--glass-border)', borderLeft: '4px solid var(--danger)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', overflowWrap: 'anywhere', maxHeight: '200px', overflowY: 'auto', lineHeight: '1.5', minHeight: '60px' }}>{p.execNotes || 'N/A'}</div>
                                                  </div>
                                                  <div style={{  flex: 1   }}>
                                                      <div style={{  color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 'bold', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px'  }}>
                                                          <span style={{  width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6', boxShadow: '0 0 8px #3b82f6'  }}></span>
                                                          Blue Team Notes
                                                      </div>
                                                      <div style={{ color: 'var(--text-primary)', background: 'var(--bg-secondary)', padding: '15px', borderRadius: '8px', border: '1px solid var(--glass-border)', borderLeft: '4px solid #3b82f6', whiteSpace: 'pre-wrap', wordBreak: 'break-all', overflowWrap: 'anywhere', maxHeight: '200px', overflowY: 'auto', lineHeight: '1.5', minHeight: '60px' }}>{p.detNotes || 'N/A'}</div>
                                                  </div>
                                              </div>
                                              
                                              {(p.payloadCode || p.procedureSteps) && (
                                                  <button onClick={() => setViewingCodeData({ type: p.payloadCode ? 'Payload' : 'Procedure', content: p.payloadCode || p.procedureSteps })} className="btn" style={{  marginTop: '15px', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px'   }}>
                                                      {p.payloadCode ? 'View Payload' : 'View Procedure Steps'}
                                                  </button>
                                              )}
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          </div>
                          );
                      })()}
                 </div>
             </div>
         </div>
    );
  };

  const renderPayloadModal = () => {
      if (!viewingCodeData) return null;
      return (
          <div className="animate-fade-in fixed-overlay" style={{  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px'  }}>
              <div className="glass-panel responsive-modal" style={{  display: 'flex', flexDirection: 'column', background: 'rgba(10,11,16,0.95)', border: '1px solid var(--accent-primary)', borderRadius: '12px', overflow: 'hidden'  }}>
                  <div style={{  display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', borderBottom: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.4)'  }}>
                      <h3 style={{  margin: 0, color: 'var(--text-primary)'  }}>{viewingCodeData.type === 'Payload' ? 'Raw Payload' : 'Procedure Steps'}</h3>
                      <button className="close-btn" onClick={() => setViewingCodeData(null)}><X size={20} /></button>
                  </div>
                  <div style={{  flex: 1, overflowY: 'auto', padding: '20px'  }}>
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '0.9rem', color: '#10b981' }}>
                          {viewingCodeData.content}
                      </pre>
                  </div>
              </div>
          </div>
      );
  };

  if (selectedSimulation && simulationList[selectedSimulation]) {
      const simulationData = simulationList[selectedSimulation] || { events: [], date: new Date().toISOString() };
      const hasTestResults = typeof simulationSummaries[selectedSimulation] === 'object' && Array.isArray(simulationSummaries[selectedSimulation].testResults) && simulationSummaries[selectedSimulation].testResults.length > 0;
      
      const { blocked, medium, minimal, missed, total } = simulationCounts;

     return (
       <div className="animate-fade-in" style={{  height: '100%', overflowY: 'auto', paddingRight: '10px'   }}>
          <div style={{  display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'  }}>
             <button className="btn" style={{  background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '5px'  }} onClick={() => {
                  if (returnToGapId) {
                      navigate('/gaps', { state: { openGapId: returnToGapId } });
                  } else if (location.state?.fromGapTracker) {
                      navigate('/gaps');
                  } else if (location.state?.fromPosture) {
                      navigate('/posture', { state: { returnToTTP: location.state.returnToTTP, returnToTactic: location.state.returnToTactic } });
                  } else if (location.state?.fromDashboard) {
                      navigate('/');
                  } else {
                      setSelectedSimulation(null);
                  }
              }}>
               <ArrowLeft size={16} /> {returnToGapId ? 'Back to Gap Details' : (location.state?.fromGapTracker ? 'Back to Gap Tracker' : (location.state?.fromPosture ? 'Back to Map' : (location.state?.fromDashboard ? 'Back to Dashboard' : 'Reports')))}
             </button>
             <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                 <button 
                    className="btn hover-lift" 
                    onClick={() => {
                        confirmAction(`Are you sure you want to permanently delete the simulation "${selectedSimulation}"? This action cannot be undone.`, async () => {
                            await deleteSimulation(selectedSimulation);
                            setSelectedSimulation(null);
                            setSimulationList(prev => {
                                const next = { ...prev };
                                delete next[selectedSimulation];
                                return next;
                            });
                            addToast('Simulation successfully deleted.', 'success');
                        });
                    }}
                    style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold' }}
                 >
                    <Trash2 size={16} /> Delete
                 </button>
                 <PDFDownloadLink
                   document={
                     <ReportPDF 
                        simulationName={selectedSimulation}
                        date={simulationData.date}
                        summary={typeof simulationSummaries[selectedSimulation] === 'string' ? simulationSummaries[selectedSimulation] : simulationSummaries[selectedSimulation]?.summary || ''}
                        events={simulationData.events}
                        testResults={simulationSummaries[selectedSimulation]?.testResults || []}
                        participants={
                           Array.isArray(simulationSummaries[selectedSimulation]?.details?.participants) 
                              ? simulationSummaries[selectedSimulation].details.participants.map(p => `${p.name} (${p.role})`).join(', ') 
                              : simulationSummaries[selectedSimulation]?.details?.participants
                        }
                        tags={simulationSummaries[selectedSimulation]?.details?.tags || []}
                        blocked={blocked}
                        medium={medium}
                        minimal={minimal}
                        missed={missed}
                        total={total}
                        evidence={simulationEvidence[selectedSimulation] || []}
                      />
                   }
                   fileName={`${selectedSimulation}_Report.pdf`}
                   className="btn"
                   style={{  display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--accent-primary)', textDecoration: 'none', color: 'inherit', padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold'  }}
                 >
                   {({ blob, url, loading, error }) => (
                     <>
                        <FileText size={16} /> {loading ? 'Preparing PDF...' : 'Export to PDF'}
                     </>
                   )}
                 </PDFDownloadLink>
             </div>
          </div>
          
          {renderDrilldownModal()}
          {renderPayloadModal()}
          {renderUnlockPromptModal()}
          {renderEditReportModal()}
          
          <div id="historical-executive-report" style={{  background: 'var(--bg-primary)', padding: '20px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '20px'  }}>
             <div style={{  display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid var(--glass-border)', paddingBottom: '10px'  }}>
                <div>
                   <h1 style={{  margin: 0, color: 'var(--text-primary)'  }}>{selectedSimulation}</h1>
                   <p style={{  margin: '5px 0 0 0', color: 'var(--text-secondary)'  }}>Status: <span style={{  color: 'var(--success)', fontWeight: 'bold'  }}>Complete</span></p>
                   {simulationSummaries[selectedSimulation]?.details?.participants && (
                       <p style={{  margin: '5px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem'  }}>
                           Participants: {Array.isArray(simulationSummaries[selectedSimulation].details.participants) 
                               ? simulationSummaries[selectedSimulation].details.participants.map(p => `${p.name} (${p.role})`).join(', ') 
                               : simulationSummaries[selectedSimulation].details.participants}
                       </p>
                   )}
                   {simulationSummaries[selectedSimulation]?.details?.tags && simulationSummaries[selectedSimulation].details.tags.length > 0 && (
                       <p style={{  margin: '5px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem'  }}>
                           Tags: {simulationSummaries[selectedSimulation].details.tags.map(t => <span key={t} style={{ display: 'inline-block', padding: '2px 8px', background: 'var(--accent-secondary)', color: 'white', borderRadius: '12px', fontSize: '0.75rem', marginRight: '5px' }}>{t}</span>)}
                       </p>
                   )}
                </div>
                <div style={{  textAlign: 'right'  }}>
                   <h3 style={{  margin: 0, color: 'var(--text-primary)'  }}>Executive Report</h3>
                   <p style={{  margin: '5px 0 0 0', color: 'var(--text-secondary)'  }}>{(() => { const d = new Date(simulationData.date); return isNaN(d.getTime()) ? new Date().toLocaleDateString() : d.toLocaleDateString(); })()}</p>
                </div>
             </div>

             <div className="glass-panel" style={{  padding: '20px', background: 'rgba(156, 39, 176, 0.05)', borderLeft: '4px solid var(--accent-primary)'  }}>
                {(() => {
                    const summaryText = simulationSummaries[selectedSimulation] ? (typeof simulationSummaries[selectedSimulation] === 'string' ? simulationSummaries[selectedSimulation] : (simulationSummaries[selectedSimulation].summary || '')) : '';
                    const hasHeaders = summaryText.toLowerCase().includes('executive summary') || /(?:^|\n)##\s+/.test(summaryText);
                    return !hasHeaders && <h3 style={{  margin: '0 0 10px 0', color: 'var(--text-primary)'  }}>Executive Summary</h3>;
                })()}
                <div style={{  color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '0.95rem'  }}>
                   {simulationSummaries[selectedSimulation] ? (
                       typeof simulationSummaries[selectedSimulation] === 'string' 
                           ? formatMarkdown(simulationSummaries[selectedSimulation]) 
                           : formatMarkdown(simulationSummaries[selectedSimulation].summary)
                   ) : <span style={{  color: 'var(--text-muted)'  }}>No executive summary was recorded for this legacy simulation.</span>}
                </div>
                {typeof simulationSummaries[selectedSimulation] === 'object' && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px', marginTop: '15px' }}>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button className="btn" onClick={() => setActiveSimulationDrilldown(simulationSummaries[selectedSimulation])} style={{  background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '8px'  }}>
                                <Search size={16} /> Open Drilldown
                            </button>
                            <button className="btn" onClick={handleOpenUnlockPrompt} style={{  background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: '8px'  }}>
                                <Unlock size={16} color="var(--warning)" /> Unlock Report for Editing
                            </button>
                        </div>

                        {simulationSummaries[selectedSimulation].lastEditedAt && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Edit3 size={12} /> Last edited: {new Date(simulationSummaries[selectedSimulation].lastEditedAt).toLocaleString()} - "{simulationSummaries[selectedSimulation].editJustification || 'No justification provided'}"
                            </div>
                        )}
                    </div>
                )}
             </div>

             <h3 style={{  margin: '25px 0 15px 0', color: 'var(--text-primary)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px'  }}>TTP Coverage</h3>
             <div style={{  display: 'flex', gap: '15px'  }}>
                {blocked > 0 && (
                <div style={{  flex: 1, padding: '15px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '6px', textAlign: 'center'  }} title="TTPs that were Prevented or Alerted by security controls">
                   <div style={{  fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)'  }}>{blocked}</div>
                   <div style={{  fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase'  }}>Optimal Coverage</div>
                </div>
                )}
                {medium > 0 && (
                <div style={{  flex: 1, padding: '15px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '6px', textAlign: 'center'  }} title="TTPs that were Logged, but did not generate a direct Alert">
                   <div style={{  fontSize: '2rem', fontWeight: 'bold', color: 'var(--warning)'  }}>{medium}</div>
                   <div style={{  fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase'  }}>Partial Coverage</div>
                </div>
                )}
                {minimal > 0 && (
                <div style={{  flex: 1, padding: '15px', background: 'rgba(249, 115, 22, 0.1)', border: '1px solid rgba(249, 115, 22, 0.3)', borderRadius: '6px', textAlign: 'center'  }} title="TTPs with very limited visibility or telemetry">
                   <div style={{  fontSize: '2rem', fontWeight: 'bold', color: 'var(--minimal)'  }}>{minimal}</div>
                   <div style={{  fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase'  }}>Minimal Coverage</div>
                </div>
                )}
                {missed > 0 && (
                <div style={{  flex: 1, padding: '15px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', textAlign: 'center'  }} title="TTPs that were entirely Missed without sufficient logging">
                   <div style={{  fontSize: '2rem', fontWeight: 'bold', color: 'var(--danger)'  }}>{missed}</div>
                   <div style={{  fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase'  }}>No Coverage</div>
                </div>
                )}
                <div style={{  flex: 1, padding: '15px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--glass-border)', borderRadius: '6px', textAlign: 'center'  }}>
                   <div style={{  fontSize: '2rem', fontWeight: 'bold', color: 'var(--text-primary)'  }}>{total}</div>
                   <div style={{  fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase'  }}>Total Validated</div>
                </div>
             </div>

             <div>
                <h3 style={{  margin: '0 0 15px 0', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px'  }}>Technical Findings</h3>
                 <div style={{ overflowX: 'auto', width: '100%' }}>
                  <table style={{  width: '100%', minWidth: '700px', borderCollapse: 'collapse', fontSize: '0.85rem'  }}>
                  <thead>
                     <tr style={{  background: 'rgba(255,255,255,0.05)', textAlign: 'left'  }}>
                        <th style={{  padding: '10px', borderBottom: '1px solid var(--glass-border)', width: '25%'  }}>Event</th>
                        <th style={{  padding: '10px', borderBottom: '1px solid var(--glass-border)', width: '15%', textAlign: 'center'  }}>Outcome</th>
                        <th style={{  padding: '10px', borderBottom: '1px solid var(--glass-border)', width: '15%', textAlign: 'center'  }}>Coverage Rating</th>
                        <th style={{  padding: '10px', borderBottom: '1px solid var(--glass-border)', width: '10%', textAlign: 'center'  }}>Gap Severity</th>
                        <th style={{  padding: '10px', borderBottom: '1px solid var(--glass-border)', width: '35%'  }}>Notes</th>
                     </tr>
                  </thead>
                  <tbody>
                     {(() => {
                         if (hasTestResults) {
                             return simulationSummaries[selectedSimulation].testResults.map((proc, i) => {
                                 let outStr = proc.outcome || '';
                                 if (outStr.includes(' ➔ ')) outStr = outStr.split(' ➔ ')[1];
                                 
                                 const cleanStr = (str) => str.replace('✓', '').trim();
                                 
                                 const getOutcomeColor = (str) => {
                                     const cleaned = cleanStr(str);
                                     if (cleaned === 'Prevented & Alerted') return 'var(--success)';
                                     if (cleaned === 'Prevented') return '#06b6d4'; // Cyan
                                     if (cleaned === 'Alerted') return '#3b82f6'; // Blue
                                     if (cleaned.startsWith('Logged') || cleaned === 'Partial') return 'var(--warning)';
                                     if (cleaned === 'Missed') return 'var(--danger)';
                                     return 'var(--text-primary)';
                                 };
                                 
                                 const getOutcomeBg = (str) => {
                                     const cleaned = cleanStr(str);
                                     if (cleaned === 'Prevented & Alerted') return 'rgba(16, 185, 129, 0.15)';
                                     if (cleaned === 'Prevented') return 'rgba(6, 182, 212, 0.15)';
                                     if (cleaned === 'Alerted') return 'rgba(59, 130, 246, 0.15)';
                                     if (cleaned.startsWith('Logged') || cleaned === 'Partial') return 'rgba(245, 158, 11, 0.15)';
                                     if (cleaned === 'Missed') return 'rgba(239, 68, 68, 0.15)';
                                     return 'rgba(255,255,255,0.1)';
                                 };
                                 
                                 const getOutcomeBorder = (str) => {
                                     const cleaned = cleanStr(str);
                                     if (cleaned === 'Prevented & Alerted') return 'rgba(16, 185, 129, 0.3)';
                                     if (cleaned === 'Prevented') return 'rgba(6, 182, 212, 0.3)';
                                     if (cleaned === 'Alerted') return 'rgba(59, 130, 246, 0.3)';
                                     if (cleaned.startsWith('Logged') || cleaned === 'Partial') return 'rgba(245, 158, 11, 0.3)';
                                     if (cleaned === 'Missed') return 'rgba(239, 68, 68, 0.3)';
                                     return 'rgba(255,255,255,0.2)';
                                 };
                                 
                                 const renderNotes = (notes) => {
                                     if (!notes) return 'N/A';
                                     if (notes.includes('**[Validation Re-Test')) {
                                         const parts = notes.split(/\*\*\[Validation Re-Test.*?\]\*\*/);
                                         
                                         return (
                                             <>
                                                 {parts[0].trim()}
                                                 <div style={{ marginTop: '8px', padding: '8px', background: 'rgba(5, 150, 105, 0.1)', borderLeft: '2px solid #059669', borderRadius: '4px' }}>
                                                     <strong style={{ color: '#059669', display: 'block', marginBottom: '4px' }}>Re-Test Notes</strong>
                                                     {parts[1] ? parts[1].trim() : ''}
                                                 </div>
                                             </>
                                         );
                                     }
                                     return notes;
                                 };
                                 
                                 return (
                                   <tr key={i} style={{  borderBottom: '1px solid rgba(255,255,255,0.05)'  }}>
                                      <td style={{  padding: '15px 10px', verticalAlign: 'top', width: '25%'  }}>
                                         <strong style={{  fontSize: '1.05rem', color: 'var(--text-primary)', display: 'block', marginBottom: '8px'  }}>
                                            {proc.name || 'Unnamed Event'}
                                            {proc.outcome?.includes(' ➔ ') && (
                                                <span style={{  marginLeft: '10px', fontSize: '0.7rem', color: '#059669', background: 'rgba(5, 150, 105, 0.15)', padding: '2px 8px', borderRadius: '12px', verticalAlign: 'middle', border: '1px solid rgba(5, 150, 105, 0.3)'  }}>
                                                    Re-Tested ✓ {proc.validationDate ? `(${new Date(proc.validationDate).toLocaleDateString()})` : ''}
                                                </span>
                                            )}
                                         </strong>
                                         <div style={{  display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px'  }}>
                                            {(proc.ttps || []).map(ttp => {
                                                const ttpId = typeof ttp === 'object' ? ttp.id : ttp;
                                                return (
                                                    <span key={ttpId} style={{  background: 'rgba(156, 39, 176, 0.15)', border: '1px solid rgba(156, 39, 176, 0.3)', color: 'var(--text-primary)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '4px'  }}>
                                                        <strong>{ttpId}</strong>
                                                        <span style={{  color: 'var(--text-secondary)'  }}>{getTTPName(ttpId)}</span>
                                                    </span>
                                                );
                                            })}
                                         </div>
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
                                      </td>
                                      <td style={{  padding: '15px 10px', verticalAlign: 'top', width: '15%', textAlign: 'center'  }}>
                                         <div style={{  display: 'flex', gap: '15px', alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'center'  }}>
                                             <div style={{ textAlign: 'center' }}>
                                                <div style={{  fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '2px'  }}>Expected</div>
                                                <span style={{  display: 'inline-block', minWidth: '80px', textAlign: 'center', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', background: 'rgba(255,255,255,0.05)', color: getOutcomeColor(proc.expectedOutcome || 'N/A'), border: '1px solid rgba(255,255,255,0.1)'  }}>{proc.expectedOutcome || 'N/A'}</span>
                                             </div>
                                             <div style={{ textAlign: 'center' }}>
                                                <div style={{  fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '2px'  }}>Actual</div>
                                                {proc.outcome?.includes(' ➔ ') ? (
                                                    <div style={{  display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap'  }}>
                                                        <span style={{  display: 'inline-block', minWidth: '80px', textAlign: 'center', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', background: getOutcomeBg(proc.outcome.split(' ➔ ')[0]), color: getOutcomeColor(proc.outcome.split(' ➔ ')[0]), border: `1px solid ${getOutcomeBorder(proc.outcome.split(' ➔ ')[0])}`, textDecoration: 'line-through', opacity: 0.7  }}>{proc.outcome.split(' ➔ ')[0]}</span>
                                                        <span style={{  color: 'var(--text-muted)'  }}>&rarr;</span>
                                                        <span style={{  display: 'inline-block', minWidth: '80px', textAlign: 'center', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', background: getOutcomeBg(outStr), color: getOutcomeColor(outStr), border: `1px solid ${getOutcomeBorder(outStr)}`  }}>{proc.outcome.split(' ➔ ')[1]}</span>
                                                    </div>
                                                ) : (
                                                    <span style={{  display: 'inline-block', minWidth: '80px', textAlign: 'center', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', background: getOutcomeBg(outStr), color: getOutcomeColor(outStr), border: `1px solid ${getOutcomeBorder(outStr)}`  }}>{outStr}</span>
                                                )}
                                             </div>
                                         </div>
                                         {(proc.expectedOutcome || 'N/A') !== outStr && outStr !== 'Untested' && outStr !== 'N/A' && outStr && <div style={{  marginTop: '8px', fontSize: '0.7rem', color: 'var(--danger)', fontStyle: 'italic', textAlign: 'center', width: '100%'  }}>Control Drift</div>}
                                      </td>
                                      <td style={{  padding: '15px 10px', verticalAlign: 'top', width: '15%', textAlign: 'center'  }}>
                                         <div style={{  fontSize: '0.65rem', color: 'transparent', textTransform: 'uppercase', marginBottom: '2px', userSelect: 'none'  }}>Spacer</div>
                                         <span style={{  display: 'inline-block', minWidth: '80px', textAlign: 'center', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', background: proc.coverageRating === 'Optimal' ? 'rgba(16, 185, 129, 0.15)' : proc.coverageRating === 'Partial' ? 'rgba(245, 158, 11, 0.15)' : proc.coverageRating === 'Minimal' ? 'rgba(249, 115, 22, 0.15)' : proc.coverageRating === 'None' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.1)', color: proc.coverageRating === 'Optimal' ? 'var(--success)' : proc.coverageRating === 'Partial' ? 'var(--warning)' : proc.coverageRating === 'Minimal' ? 'var(--minimal)' : proc.coverageRating === 'None' ? 'var(--danger)' : 'var(--text-secondary)', border: `1px solid ${proc.coverageRating === 'Optimal' ? 'rgba(16, 185, 129, 0.3)' : proc.coverageRating === 'Partial' ? 'rgba(245, 158, 11, 0.3)' : proc.coverageRating === 'Minimal' ? 'rgba(249, 115, 22, 0.3)' : proc.coverageRating === 'None' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255,255,255,0.2)'}`  }}>{proc.coverageRating || 'N/A'}</span>
                                      </td>
                                      <td style={{  padding: '15px 10px', verticalAlign: 'top', width: '10%', textAlign: 'center'  }}>
                                         <div style={{  fontSize: '0.65rem', color: 'transparent', textTransform: 'uppercase', marginBottom: '2px', userSelect: 'none'  }}>Spacer</div>
                                         {proc.severity && proc.severity !== 'N/A' && proc.severity !== 'Auto-Calculate' ? (
                                             <span style={{  display: 'inline-block', minWidth: '80px', textAlign: 'center', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', background: 'rgba(255,255,255,0.05)', color: String(proc.severity).toLowerCase() === 'critical' ? 'var(--severity-critical)' : String(proc.severity).toLowerCase() === 'high' ? 'var(--severity-high)' : String(proc.severity).toLowerCase() === 'medium' ? 'var(--severity-medium)' : String(proc.severity).toLowerCase() === 'low' ? 'var(--severity-low)' : 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.1)'  }}>{proc.severity}</span>
                                         ) : (
                                             <span style={{  display: 'inline-block', minWidth: '80px', textAlign: 'center', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.1)'  }}>N/A</span>
                                         )}
                                      </td>
                                      <td style={{  padding: '15px 10px', verticalAlign: 'top', width: '35%'  }}>
                                         <div style={{  marginBottom: '8px'  }}><strong style={{  color: 'var(--danger)'  }}>Red Team Notes:</strong> <div style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', overflowWrap: 'anywhere', fontSize: '0.8rem', marginTop: '4px' }}>{renderNotes(proc.execNotes)}</div></div>
                                         <div><strong style={{  color: '#3b82f6'   }}>Blue Team Notes:</strong> <div style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', overflowWrap: 'anywhere', fontSize: '0.8rem', marginTop: '4px' }}>{renderNotes(proc.detNotes)}</div></div>
                                      </td>
                                   </tr>
                                 );
                             });
                         } else {
                             return simulationExercises.map((ex, i) => {
                                const isHigh = ex.status === 'high';
                                const isMed = ex.status === 'medium';
                                const isMin = ex.status === 'minimal';
                                return (
                                   <tr key={i} style={{  borderBottom: '1px solid rgba(255,255,255,0.05)'   }}>
                                      <td style={{  padding: '15px 10px', verticalAlign: 'top', width: '30%'  }}>
                                         <strong style={{  color: 'var(--text-primary)'  }}>{ex.ttp}</strong>
                                         <div style={{  fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px'  }}>{getTTPName(ex.ttp)}</div>
                                         <div style={{  fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px'  }}>Legacy Record</div>
                                      </td>
                                      <td style={{  padding: '15px 10px', verticalAlign: 'top', width: '15%'  }}>
                                          <span style={{  display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', background: ex.status === 'high' ? 'rgba(16, 185, 129, 0.15)' : ex.status === 'medium' ? 'rgba(245, 158, 11, 0.15)' : ex.status === 'minimal' ? 'rgba(249, 115, 22, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: ex.status === 'high' ? 'var(--success)' : ex.status === 'medium' ? 'var(--warning)' : ex.status === 'minimal' ? 'var(--minimal)' : 'var(--danger)', border: `1px solid ${ex.status === 'high' ? 'rgba(16, 185, 129, 0.3)' : ex.status === 'medium' ? 'rgba(245, 158, 11, 0.3)' : ex.status === 'minimal' ? 'rgba(249, 115, 22, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`  }}>
                                             {(ex.finding?.includes(':') ? ex.finding.split(':')[1]?.trim() : ex.finding) || ex.status || 'N/A'}
                                          </span>
                                      </td>
                                      <td style={{  padding: '15px 10px', verticalAlign: 'top', width: '15%'  }}>
                                          <span style={{  display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', background: ex.status === 'high' ? 'rgba(16, 185, 129, 0.15)' : ex.status === 'medium' ? 'rgba(245, 158, 11, 0.15)' : ex.status === 'minimal' ? 'rgba(249, 115, 22, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: ex.status === 'high' ? 'var(--success)' : ex.status === 'medium' ? 'var(--warning)' : ex.status === 'minimal' ? 'var(--minimal)' : 'var(--danger)', border: `1px solid ${ex.status === 'high' ? 'rgba(16, 185, 129, 0.3)' : ex.status === 'medium' ? 'rgba(245, 158, 11, 0.3)' : ex.status === 'minimal' ? 'rgba(249, 115, 22, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`  }}>
                                             {ex.status === 'high' ? 'Optimal' : ex.status === 'medium' ? 'Partial' : ex.status === 'minimal' ? 'Minimal' : 'None'}
                                          </span>
                                      </td>
                                      <td style={{  padding: '15px 10px', verticalAlign: 'top', width: '10%'  }}>
                                         {ex.severity && ex.severity !== 'N/A' ? (
                                             <span style={{  display: 'inline-block', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', background: 'rgba(255,255,255,0.05)', color: ex.severity === 'Critical' ? 'var(--severity-critical)' : ex.severity === 'High' ? 'var(--severity-high)' : ex.severity === 'Medium' ? 'var(--severity-medium)' : ex.severity === 'Low' ? 'var(--severity-low)' : 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.1)'  }}>
                                                 {ex.severity}
                                             </span>
                                         ) : (
                                             <span style={{  color: 'var(--text-muted)', fontSize: '0.8rem'  }}>N/A</span>
                                         )}
                                      </td>
                                      <td style={{  padding: '15px 10px', verticalAlign: 'top', width: '30%'  }}>
                                         <div><span style={{  color: 'var(--text-secondary)'  }}>{ex.remediation || 'N/A'}</span></div>
                                         {(() => {
                                             let rawPayload = '';
                                             let isPayloadCode = false;
                                             const gapTTPs = (ex.ttp || '').split(',').map(t => t.trim()).filter(Boolean);
                                             const procMatcher = (r) => (ex.finding && r.name && r.name.toLowerCase() === ex.finding.toLowerCase()) || (r.ttps && gapTTPs.length > 0 && r.ttps.some(t => gapTTPs.includes(t)));
                                             const simSummary = simulationSummaries[selectedSimulation];
                                             if (simSummary && simSummary.testResults) {
                                                 const foundProcs = simSummary.testResults.filter(procMatcher);
                                                 if (foundProcs.length > 0) {
                                                     const payloadCodes = foundProcs.map(r => r.payloadCode).filter(Boolean);
                                                     const procSteps = foundProcs.map(r => r.procedureSteps).filter(Boolean);
                                                     if (payloadCodes.length > 0) {
                                                         rawPayload = payloadCodes.join('\n\n');
                                                         isPayloadCode = true;
                                                     } else if (procSteps.length > 0) {
                                                         rawPayload = procSteps.join('\n\n');
                                                         isPayloadCode = false;
                                                     }
                                                 }
                                             }
                                             if (!rawPayload) return null;
                                             return (
                                                 <button 
                                                     onClick={() => setViewingCodeData({ type: isPayloadCode ? 'Payload' : 'Procedure', content: rawPayload })} 
                                                     className="btn hover-lift" 
                                                     style={{  marginTop: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 12px', fontSize: '0.8rem', borderRadius: '4px', fontWeight: 'bold'   }}
                                                 >
                                                     <Code size={14} /> {isPayloadCode ? 'View Payload' : 'View Procedure Steps'}
                                                 </button>
                                             );
                                         })()}
                                      </td>
                                   </tr>
                                );
                             });
                         }
                     })()}
                  </tbody>
                 </table>
                 </div>
                 
                 {/* Page Navigation Buttons */}
                 {simulationTotal > simulationLimit && (
                     <div style={{  display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', padding: '10px 0'  }}>
                         <button 
                             className="btn" 
                             style={{  background: 'transparent', border: '1px solid var(--glass-border)', color: simulationPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)'  }}
                             disabled={simulationPage === 1}
                             onClick={() => handleSimulationPageChange(simulationPage - 1)}
                         >
                             Previous
                         </button>
                         <span style={{  color: 'var(--text-secondary)', fontSize: '0.9rem'  }}>
                             Page {simulationPage} of {Math.ceil(simulationTotal / simulationLimit) || 1}
                         </span>
                         <button 
                             className="btn" 
                             style={{  background: 'transparent', border: '1px solid var(--glass-border)', color: simulationPage >= Math.ceil(simulationTotal / simulationLimit) ? 'var(--text-muted)' : 'var(--text-primary)'  }}
                             disabled={simulationPage >= Math.ceil(simulationTotal / simulationLimit)}
                             onClick={() => handleSimulationPageChange(simulationPage + 1)}
                         >
                             Next
                         </button>
                     </div>
                 )}
              </div>

              {(simulationEvidence[selectedSimulation] || []).length > 0 && (
                 <div style={{  marginTop: '20px'  }}>
                    <h3 style={{  margin: '0 0 15px 0', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px'  }}>Attached Evidence</h3>
                    <div style={{  display: 'flex', flexWrap: 'wrap', gap: '15px'  }}>
                      {(simulationEvidence[selectedSimulation] || []).map((b64, idx) => (
                         <div key={idx} style={{  position: 'relative', display: 'inline-block', padding: '5px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px solid var(--glass-border)'  }}>
                            <img src={b64} alt={`Evidence ${idx + 1}`} style={{  maxWidth: '250px', maxHeight: '150px', objectFit: 'contain', borderRadius: '4px'  }} />
                         </div>
                      ))}
                    </div>
                 </div>
              )}
           </div>
           {renderDrilldownModal()}
           {renderPayloadModal()}
       </div>
     );
  }

  return (
    <div className="animate-fade-in" style={{  height: '100%', overflowY: 'auto', paddingRight: '10px'  }}>
      <div style={{  display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px'  }}>
        <div>
          <h1 className="iridescent-text" style={{  fontSize: '2.5rem', marginBottom: '10px', marginTop: 0  }}>Reports</h1>
          <p style={{  color: 'var(--text-secondary)', margin: 0, fontSize: '1.1rem'  }}>Historical archive of past simulations.</p>
        </div>
        
        <div style={{  display: 'flex', alignItems: 'center', gap: '15px'  }}>
           <EnvironmentDropdown />
           <TagDropdown />
           <div style={{  position: 'relative', width: '300px'  }}>
             <Search size={16} style={{  position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)'  }} />
             <input 
               type="text"
               className="ai-input" 
               placeholder="Search by name or date..." 
               value={simulationSearchTerm}
               onChange={(e) => setSimulationSearchTerm(e.target.value)}
               style={{  width: '100%', padding: '10px 15px 10px 35px', boxSizing: 'border-box', borderRadius: '6px'  }} 
             />
           </div>
           <button className="btn" style={{  display: 'flex', alignItems: 'center', gap: '8px'  }} onClick={() => setShowLogModal(true)}>
             <Plus size={16} /> Log External Simulation
           </button>
        </div>
      </div>
      
      {isSimulationsLoading ? (
         <div style={{  display: 'flex', justifyContent: 'center', padding: '60px', color: 'var(--text-secondary)'  }}>
            Loading simulations archive...
         </div>
      ) : Object.keys(simulationList).length === 0 ? (
         <div className="glass-panel" style={{  padding: '60px', textAlign: 'center', color: 'var(--text-secondary)'  }}>
            <FileText size={48} style={{  margin: '0 auto 20px auto', opacity: 0.3  }} />
            <h2>No Simulations Logged</h2>
            <p>Launch a simulation via the Simulation Launcher or log external results to generate reports.</p>
         </div>
      ) : (
        <div className="reports-grid">
          {Object.entries(simulationList)
             .filter(([name, data]) => {
                const search = simulationSearchTerm.toLowerCase();
                const d = new Date(data.date);
                const dateStr = isNaN(d.getTime()) ? new Date().toLocaleDateString() : d.toLocaleDateString();
                const matchesSearch = name.toLowerCase().includes(search) || dateStr.includes(search);
                const matchesTag = !activeTagFilter || activeTagFilter === 'All' || data.events.some(e => Array.isArray(e.tags) ? e.tags.includes(activeTagFilter) : e.tags === activeTagFilter);
                const matchesEnv = !activeEnvironmentFilter || activeEnvironmentFilter === 'All' || data.events.some(e => Array.isArray(e.environment) ? e.environment.includes(activeEnvironmentFilter) : e.environment === activeEnvironmentFilter);
                return matchesSearch && matchesTag && matchesEnv;
             })
             .map(([name, data]) => (
            <div key={name} className="glass-panel hover-lift" onClick={() => setSelectedSimulation(name)} style={{  padding: '25px', display: 'flex', flexDirection: 'column', cursor: 'pointer'  }}>
              <div style={{  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px'  }}>
                <h3 style={{  margin: 0, color: 'var(--text-primary)', fontSize: '1.2rem', paddingRight: '10px'  }}>{name}</h3>
                <FileText size={24} color="var(--accent-primary)" />
              </div>
              
              <p style={{  color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem', margin: '0 0 20px 0'  }}>
                <Calendar size={14} /> {(() => { const d = new Date(data.date); return isNaN(d.getTime()) ? new Date().toLocaleDateString() : d.toLocaleDateString(); })()}
              </p>
              
              <div style={{  display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto'  }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Event Outcomes</div>
                {(() => {
                  const outcomesMap = {
                     PreventedAlerted: { count: 0 },
                     Prevented: { count: 0 },
                     Alerted: { count: 0 },
                     Logged: { count: 0 },
                     Missed: { count: 0 }
                  };
                  
                  const processOutcome = (rawOut) => {
                      let out = rawOut;
                      if (!out || out === 'N/A' || out === 'none' || out === '') return 'Missed';
                      if (out.includes(' ➔ ')) out = out.split(' ➔ ')[1];
                      else if (out.includes('->')) out = out.split('->')[1];
                      else if (out.includes('➔')) out = out.split('➔')[1];
                      
                      out = out.replace('✓', '').trim().toLowerCase();
                      if (out.includes('prevented & alerted') || out === 'optimal') return 'PreventedAlerted';
                      if (out.includes('prevented')) return 'Prevented';
                      if (out.includes('alerted')) return 'Alerted';
                      if (out.includes('logged') || out.includes('partial')) return 'Logged';
                      return 'Missed';
                  };

                  const testResults = simulationSummaries[name]?.testResults;
                  
                  if (testResults && Array.isArray(testResults) && testResults.length > 0) {
                      testResults.forEach(e => {
                         const cat = processOutcome(e.outcome);
                         outcomesMap[cat].count++;
                      });
                  } else {
                      data.events.forEach(e => {
                         const fallback = (e.status === 'high' ? 'Prevented' : e.status === 'medium' ? 'Logged' : e.status === 'minimal' ? 'Logged' : 'Missed');
                         const cat = processOutcome(e.outcome || e.finding || fallback);
                         outcomesMap[cat].count++;
                      });
                  }
                  
                  const activeOutcomesCount = Object.values(outcomesMap).filter(m => m.count > 0).length;

                  const renderUnifiedBadge = (label, bg, color, mapData) => {
                        if (mapData.count === 0) return null;
                        const displayLabel = label === 'Prevented & Alerted' ? (activeOutcomesCount === 1 ? label : 'Prev & Alert') : label;
                        return (
                            <div key={label} style={{ flex: 1, padding: '10px 5px', background: bg, border: `1px solid ${bg.replace('0.1', '0.3').replace('0.2', '0.4').replace('0.05', '0.2')}`, borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', gap: '4px' }}>
                                <span style={{ fontSize: '1.25rem', fontWeight: '900', color: color, lineHeight: '1' }}>{mapData.count}</span>
                                <span style={{ fontSize: '0.6rem', textTransform: 'uppercase', fontWeight: 'bold', color: color, letterSpacing: '0.5px', opacity: 0.9, textAlign: 'center', whiteSpace: 'nowrap' }}>{displayLabel}</span>
                            </div>
                        );
                  };

                  return (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', width: '100%', marginTop: 'auto' }}>
                        {renderUnifiedBadge('Prevented & Alerted', 'rgba(16, 185, 129, 0.2)', 'var(--success)', outcomesMap.PreventedAlerted)}
                        {renderUnifiedBadge('Prevented', 'rgba(6, 182, 212, 0.1)', '#06b6d4', outcomesMap.Prevented)}
                        {renderUnifiedBadge('Alerted', 'rgba(59, 130, 246, 0.1)', '#3b82f6', outcomesMap.Alerted)}
                        {renderUnifiedBadge('Logged', 'rgba(245, 158, 11, 0.1)', 'var(--warning)', outcomesMap.Logged)}
                        {renderUnifiedBadge('Missed', 'rgba(239, 68, 68, 0.1)', 'var(--danger)', outcomesMap.Missed)}
                    </div>
                  );
                })()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Manual Event Log Modal */}
      {showLogModal && (
        <div className="animate-fade-in fixed-overlay" style={{  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px'  }}>
           <div className="glass-panel" style={{  width: '90vw', maxWidth: '1400px', height: '85vh', background: 'var(--bg-secondary)', border: '1px solid var(--accent-primary)', padding: '0', display: 'flex', flexDirection: 'column', overflow: 'hidden'  }}>
            <div style={{  padding: '20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(156, 39, 176, 0.05)'  }}>
               <h2 style={{  margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)'  }}>Log External Simulation Data</h2>
               <button className="close-btn" onClick={() => setShowLogModal(false)}><X size={20} /></button>
            </div>
            
            <div style={{  display: 'flex', flex: 1, overflow: 'hidden'  }}>
                <div style={{  borderRight: '1px solid var(--glass-border)', flexShrink: 0  }}>
                    <TTPSelector 
                        techniques={mitreData ? Object.values(mitreData).flatMap(t => t.techniques) : []} 
                        selectedTTPs={(manualProcedures.find(p => p.id === activeManualProcedureId)?.ttps || []).map(id => ({ id, name: getTTPName(id) }))} 
                        toggleTTP={(techId, techName) => toggleManualSimulationTTP(techId, techName)} 
                    />
                </div>
                
                <div style={{  padding: '25px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px'  }}>
                    <div style={{  background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)'  }}>
                       <label style={{  display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 500  }}><Target size={16} color="var(--accent-primary)" /> Simulation Name <span style={{  color: 'var(--danger)'  }}>*</span></label>
                       <input className="ai-input" style={{  width: '100%', boxSizing: 'border-box', fontSize: '1.05rem', padding: '12px 16px'  }} placeholder="e.g. Ad-Hoc External Penetration Test" value={manualSimulation} onChange={e => setManualSimulation(e.target.value)} />
                    </div>
                    
                    <div style={{ display: 'flex', gap: '20px' }}>
                        <div style={{ flex: 1, background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                             <label style={{  display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 500  }}><Server size={16} color="var(--accent-secondary)" /> Environment</label>
                             <InlineEnvironmentDropdown value={manualEnvironment} onChange={setManualEnvironment} />
                        </div>
                        <div style={{ flex: 1, background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                             <label style={{  display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 500  }}><Sparkles size={16} color="var(--accent-secondary)" /> Tags</label>
                             <InlineTagDropdown value={manualTags} onChange={setManualTags} />
                        </div>
                    </div>
                    
                    <div style={{  background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)'  }}>
                       <label style={{  display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 500  }}>
                           <div style={{  display: 'flex', alignItems: 'center', gap: '8px'  }}><FileText size={16} color="var(--accent-secondary)" /> Executive Summary</div>

                       </label>
                       <textarea className="ai-input" style={{  width: '100%', boxSizing: 'border-box', height: '120px', resize: 'vertical', lineHeight: '1.5'  }} placeholder="Provide a brief summary of the simulation context, goals, and high-level outcomes..." value={manualSummary} onChange={e => setManualSummary(e.target.value)} />
                    </div>
                    
                    <div style={{  borderBottom: '1px solid var(--glass-border)', margin: '5px 0'  }} />
                    
                    <div style={{  display: 'flex', flexDirection: 'column', gap: '20px'  }}>
                       {manualProcedures.map((proc, index) => {
                          const isActive = activeManualProcedureId === proc.id;
                          return (
                          <div key={proc.id} onClick={() => setActiveManualProcedureId(proc.id)} style={{  padding: '2px', borderRadius: '14px', border: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent', transition: 'all 0.2s', cursor: 'pointer'  }}>
                             <EventCard
                                 proc={proc}
                                 index={index}
                                 totalCards={manualProcedures.length}
                                 isCollapsed={collapsedCards[proc.id]}
                                 onToggleCollapse={(e) => { e.stopPropagation(); setCollapsedCards(prev => ({ ...prev, [proc.id]: !prev[proc.id] })); }}
                                 updateProcedure={updateManualProcedure}
                                 removeProcedure={(id) => {
                                     const remaining = manualProcedures.filter(p => p.id !== id);
                                     setManualProcedures(remaining);
                                     if (isActive && remaining.length > 0) setActiveManualProcedureId(remaining[0].id);
                                 }}
                                 showNameErrors={false}
                                 selectedTTPs={manualProcedures.flatMap(p => p.ttps).filter((id, i, arr) => arr.indexOf(id) === i).map(id => ({ id, name: getTTPName(id) }))}
                                 isManual={true}
                                 compressImage={compressImage}
                                 addSimulationEvidence={addSimulationEvidence}
                                 simulationName={manualSimulation}
                             />
                          </div>
                          );
                       })}
                    </div>
                    
                    <button className="btn hover-lift" onClick={() => {
                        const newId = Date.now();
                        setManualProcedures([...manualProcedures, { id: newId, name: 'New Event', ttps: [], coverageRating: 'None', severity: 'High', outcome: 'Missed' }]);
                        setActiveManualProcedureId(newId);
                    }} style={{  background: 'transparent', border: '1px dashed var(--accent-secondary)', color: 'var(--accent-secondary)', width: '100%', padding: '15px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'  }}>
                       <Plus size={16} /> Add Another Event
                    </button>
                </div>
            </div>
            
            <div style={{  padding: '20px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: 'rgba(0,0,0,0.2)'  }}>
               <button className="btn hover-lift" style={{  background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', padding: '10px 20px'  }} onClick={() => setShowLogModal(false)}>Cancel</button>
               <button className="btn hover-lift" onClick={handleLogExercise} style={{  background: 'var(--accent-secondary)', color: '#000', padding: '10px 25px'  }}>Submit External Simulation</button>
            </div>
          </div>
        </div>
      )}
      

    </div>
  );
}
