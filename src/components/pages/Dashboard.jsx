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
import { useAppContext } from '../../AppContext';
import { Activity, Target, ShieldAlert, Shield, ArrowRight, ArrowLeft, Info, Key, Terminal, Ghost, Network, Clock, ShieldCheck, Database, Globe, BrainCircuit } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import UnifiedPosturePill from '../ui/UnifiedPosturePill';
import TagDropdown from '../dropdowns/TagDropdown';

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

const PHASE_ICONS = {
  "Initial Access": Key,
  "Execution": Terminal,
  "Evasion": Ghost,
  "Movement": Network,
  "Action on Objective": Target
};

// Custom Cyber Metric Icons - Minimalist & Sleek
const CyberResolutionIcon = ({ size = 150, color = "currentColor", ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" {...props}>
        {/* Sleek outer shield path */}
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6-8 10-8 10z" strokeWidth="0.5" opacity="0.3" />
        {/* Minimalist offset shield */}
        <path d="M12 20s6-3 6-8V6l-6-2-6 2v6c0 5 6 8 6 8z" />
        {/* Clean, sharp checkmark */}
        <path d="M9 12l2 2 4-4" strokeWidth="1.5" />
    </svg>
);

const CyberRiskIcon = ({ size = 150, color = "currentColor", ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" {...props}>
        {/* Sleek minimalist warning triangle */}
        <path d="M12 3L3 19h18L12 3z" />
        {/* Abstract double border effect */}
        <path d="M12 5l-7 12h14L12 5z" strokeWidth="0.5" opacity="0.4" />
        {/* Minimalist core line */}
        <line x1="12" y1="9" x2="12" y2="14" strokeWidth="1.5" />
        <circle cx="12" cy="17" r="0.5" fill="currentColor" />
    </svg>
);

const CyberMTTRIcon = ({ size = 150, color = "currentColor", ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" {...props}>
        {/* Sleek minimalist clock ring */}
        <circle cx="12" cy="12" r="9" />
        {/* Subtle offset ring */}
        <circle cx="12" cy="12" r="11" strokeWidth="0.5" opacity="0.3" strokeDasharray="1 4" />
        {/* Minimalist hands */}
        <path d="M12 7v5l3 2" strokeWidth="1.5" />
        {/* Single clean accent dot */}
        <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
);

const Tooltip = ({ children, content }) => {
  const [show, setShow] = React.useState(false);
  return (
    <div 
      style={{ position: 'relative', display: 'flex', alignItems: 'center' }} 
      onMouseEnter={() => setShow(true)} 
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div className="animate-tooltip" style={{
          position: 'absolute',
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginTop: '10px',
          background: 'rgba(5, 5, 8, 0.95)',
          border: '1px solid var(--accent-primary)',
          boxShadow: '0 8px 32px rgba(156,39,176,0.3), inset 0 0 15px rgba(255,255,255,0.05)',
          backdropFilter: 'blur(12px)',
          padding: '12px 16px',
          borderRadius: '8px',
          color: '#fff',
          fontSize: '0.85rem',
          width: '260px',
          zIndex: 100,
          lineHeight: '1.4',
          pointerEvents: 'none',
          fontWeight: 'normal',
          textTransform: 'none',
          letterSpacing: 'normal'
        }}>
          {content}
          <div style={{
            position: 'absolute',
            top: '-6px',
            left: '50%',
            transform: 'translateX(-50%) rotate(45deg)',
            width: '10px',
            height: '10px',
            background: 'rgba(5, 5, 8, 0.95)',
            borderLeft: '1px solid var(--accent-primary)',
            borderTop: '1px solid var(--accent-primary)'
          }}></div>
        </div>
      )}
    </div>
  );
};

const getRiskPosition = (risk) => {
    return Math.max(0, Math.min(100, risk));
};

const getNormalizedPosture = (ex) => {
    let outcome = 'Unknown';
    let coverage = 'Unknown';

    if (ex.coverageRating && ex.coverageRating !== 'N/A' && ex.coverageRating !== 'na') {
        const cr = ex.coverageRating.toLowerCase();
        if (cr === 'optimal' || cr === 'optimal coverage') {
            outcome = 'Prevented';
            coverage = 'Optimal';
        } else if (cr === 'partial' || cr === 'partial coverage') {
            outcome = 'Logged';
            coverage = 'Partial';
        } else if (cr === 'minimal' || cr === 'minimal coverage') {
            outcome = 'Logged';
            coverage = 'Minimal';
        } else if (cr === 'none' || cr === 'no coverage') {
            outcome = 'Missed';
            coverage = 'None';
        }
    } else {
        let rawOutcome = ex.outcome || ex.finding || ex.status;
        if (typeof rawOutcome === 'string') {
            const r = rawOutcome.toLowerCase();
            if (r === 'high' || r.includes('prevented') || r.includes('alerted')) outcome = 'Prevented';
            else if (r === 'medium' || r === 'minimal' || r.includes('logged')) outcome = 'Logged';
            else if (r === 'low' || r.includes('missed')) outcome = 'Missed';
        }
        
        let rawCoverage = ex.coverageRating || ex.coverage;
        coverage = rawCoverage;
        if (!coverage || coverage === 'N/A' || coverage === 'na') {
            coverage = outcome === 'Prevented' ? 'Optimal' : outcome === 'Logged' ? 'Partial' : outcome === 'Missed' ? 'None' : 'Unknown';
        }
    }
    
    return { outcome, coverage };
};

export default function Dashboard() {
  const { events: contextExercises, allEventsData, gaps: contextGaps, mitreData, dbAdapter, dbConfig, isDbLoading, aiSettings, setActiveAiContext, activeTagFilter, isAiActive, setActiveSecurityControlFilter, simulationSummaries } = useAppContext();
  const navigate = useNavigate();
  
  const [metrics, setMetrics] = React.useState({
      grsScore: 0,
      totalValidated: 0,
      totalGaps: 0,
      closedGaps: 0,
      openGapsCount: 0,
      resolutionRate: 0,
      residualRisk: 0,
      mttrText: 'N/A',
      radarData: [],
      areaData: [],
      mitreCoveragePercentage: 0
  });
  const [topSecurityControls, setTopSecurityControls] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [activePhaseSubject, setActivePhaseSubject] = React.useState("Pre-Attack");
  const [expandedPhaseSubject, setExpandedPhaseSubject] = React.useState(null);
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setTimeout(() => setIsMounted(true), 150);
  }, []);

  React.useEffect(() => {
    setActiveAiContext({
        view: 'Global Dashboard',
        description: 'High-level overview of enterprise readiness, open gaps, and recent adversary simulations.',
        metrics: {
            grsScore: metrics.grsScore,
            totalGaps: metrics.totalGaps,
            openGapsCount: metrics.openGapsCount,
            resolutionRate: metrics.resolutionRate,
            mitreCoveragePercentage: metrics.mitreCoveragePercentage
        },
        recentActivity: topSecurityControls.map(c => c.name)
    });
    return () => setActiveAiContext(null);
  }, [setActiveAiContext, metrics, topSecurityControls]);

  const getTTPDetails = React.useCallback((id) => {
      if (!mitreData) return null;
      for (const tactic of Object.values(mitreData)) {
          const tech = tactic.techniques.find(t => t.id === id);
          if (tech) return tech;
      }
      return null;
  }, [mitreData]);

  // Load Dashboard metrics asynchronously
  const loadDashboardData = React.useCallback(async () => {
       setIsLoading(true);
       try {
           let fetchedMetrics = null;
           let fetchedRecent = null;
           
           if (dbAdapter && typeof dbAdapter.fetchWithTimeout === 'function') {
               try {
                   const metricsRes = await dbAdapter.fetchWithTimeout(`${dbAdapter.endpoint}/api/metrics`, { headers: dbAdapter.getHeaders() });
                   if (metricsRes.ok) {
                       fetchedMetrics = await metricsRes.json();
                   }
                   
                   const exercisesRes = await dbAdapter.fetchWithTimeout(`${dbAdapter.endpoint}/api/events?page=1&limit=4`, { headers: dbAdapter.getHeaders() });
                   if (exercisesRes.ok) {
                       const pageData = await exercisesRes.json();
                       fetchedRecent = pageData.data || [];
                   }
               } catch (err) {
                   console.error("Dashboard REST fetch error, falling back to local calculation:", err);
               }
           }
           
           if (fetchedMetrics) {
               setMetrics(fetchedMetrics);
               setRecentExercises(fetchedRecent || []);
           } else {
               let allExercises = Object.values(allEventsData || {});
               
               if (dbAdapter && typeof dbAdapter.fetchData === 'function' && dbAdapter.type === 'local') {
                   const fetchedAll = await dbAdapter.fetchData('events');
                   if (fetchedAll && fetchedAll.length > 0) allExercises = fetchedAll;
               }

               if (simulationSummaries) {
                   Object.values(simulationSummaries).forEach(sim => {
                       if (sim && sim.testResults && sim.testResults.length > 0) {
                           const simTags = sim.details?.tags || [];
                           const simControls = sim.details?.securityControls || [];
                           const simEnvironment = sim.details?.environment || sim.details?.environmentCategory || [];
                           
                           sim.testResults.forEach(tr => {
                                 const normalizeDate = (d) => {
                                     try { return d ? new Date(d).toISOString().split('T')[0] : ''; } catch (e) { return d; }
                                 };
                                 const getTtpString = (obj) => {
                                     if (obj.ttp) return obj.ttp;
                                     if (obj.ttps) return Array.isArray(obj.ttps) ? obj.ttps.join(', ') : obj.ttps;
                                     return '';
                                 };
                                 const trTtpStr = getTtpString(tr);
                                 
                                 if (allExercises.some(ex => {
                                     if (!ex || !tr) return false;
                                     if (tr.id && ex.id === tr.id) return true;
                                     const exTtpStr = getTtpString(ex);
                                     const trTtpsArr = Array.isArray(tr.ttps) ? tr.ttps : trTtpStr.split(',').map(s => s.trim());
                                     const isTtpMatch = trTtpsArr.some(t => t && exTtpStr.includes(t));
                                     const exEffectiveDate = ex.date || ex.created_at || '';
                                     const trEffectiveDate = tr.date || sim.timestamp || sim.date || sim.created_at || (sim.details && sim.details.date) || '';
                                     return isTtpMatch && normalizeDate(exEffectiveDate) === normalizeDate(trEffectiveDate) && (ex.simulation === sim.name || ex.simulation === sim.id || ex.simId === sim.id || !ex.simulation);
                                 })) {
                                     return;
                                 }
                                
                                allExercises.push({
                                    ...tr,
                                    ttp: trTtpStr,
                                   tags: Array.isArray(tr.tags) && tr.tags.length > 0 ? tr.tags : simTags,
                                   securityControls: Array.isArray(tr.securityControls) && tr.securityControls.length > 0 ? tr.securityControls : simControls,
                                   environment: Array.isArray(tr.environment) && tr.environment.length > 0 ? tr.environment : simEnvironment,
                                   isSimEvent: true,
                                   simId: sim.id || sim.name
                               });
                           });
                       }
                   });
               }

               if (activeTagFilter !== 'All') {
                   allExercises = allExercises.filter(ex => Array.isArray(ex.tags) ? ex.tags.includes(activeTagFilter) : ex.tags === activeTagFilter);
               }
               
               let allGaps = contextGaps || [];
               
               if (dbAdapter && typeof dbAdapter.fetchGaps === 'function' && dbAdapter.type === 'local') {
                   const fetchedGaps = await dbAdapter.fetchGaps();
                   if (fetchedGaps && fetchedGaps.length > 0) allGaps = fetchedGaps;
               }
               
               if (activeTagFilter !== 'All') {
                   allGaps = allGaps.filter(g => Array.isArray(g.tags) ? g.tags.includes(activeTagFilter) : g.tags === activeTagFilter);
               }

               // Filter out historical events that map entirely to globally de-scoped TTPs
               if (mitreData && Object.keys(mitreData).length > 0) {
                   const outOfScopeTTPs = new Set();
                   Object.values(mitreData).forEach(tactic => {
                       tactic.techniques.forEach(tech => {
                           if (tech.environments?.['All'] === 'na') outOfScopeTTPs.add(tech.id);
                           if (tech.subTechniques) {
                               tech.subTechniques.forEach(sub => {
                                   if (sub.environments?.['All'] === 'na') outOfScopeTTPs.add(sub.id);
                               });
                           }
                       });
                   });
                   
                   if (outOfScopeTTPs.size > 0) {
                       allExercises = allExercises.filter(ex => {
                           if (!ex.ttp) return true;
                           const ttpList = ex.ttp.split(',').map(t => t.trim());
                           // Keep if at least one TTP is not explicitly out of scope
                           return ttpList.some(t => !outOfScopeTTPs.has(t));
                       });
                   }
               }

               // Calculate GRS accurately from rolled-up MITRE data AND active gaps
               let totalValidated = 0;
               let points = 0;
               const processedTTPs = new Set();

                // 1. Active gaps preserve their underlying coverage score (do not reset to 0)
                allGaps.forEach(g => {
                    if (g.status === 'Open' || g.status === 'In Progress') {
                        if (g.ttp) {
                            g.ttp.split(',').forEach(t => {
                                const ttpId = t.trim();
                                if (!processedTTPs.has(ttpId)) {
                                    totalValidated++;
                                    processedTTPs.add(ttpId);
                                    
                                    const posture = getNormalizedPosture(g);
                                    if (posture.coverage === 'Optimal') points += 1.0;
                                    else if (posture.coverage === 'Partial') points += 0.5;
                                    else if (posture.coverage === 'Minimal') points += 0.25;
                                }
                            });
                        }
                    }
                });
               
               // 1.5. Closed gaps provide credit for their associated TTPs (overriding older MITRE data)
               allGaps.forEach(g => {
                   if (g.status === 'Resolved' || g.status === 'Risk Accepted') {
                       if (g.ttp) {
                           g.ttp.split(',').forEach(t => {
                               const ttpId = t.trim();
                               if (!processedTTPs.has(ttpId)) {
                                   totalValidated++;
                                   processedTTPs.add(ttpId);
                                   if (g.status === 'Risk Accepted') {
                                       points += 0; // No credit for accepted risk (prevents artificial score inflation)
                                   } else {
                                       points += 1.0; // Full credit for resolving the gap
                                   }
                               }
                           });
                       }
                   }
               });
               
               // 2. Add points from MITRE data for any validated TTPs that DO NOT have active gaps
               if (mitreData) {
                   for (const tactic in mitreData) {
                       if (tactic === 'Reconnaissance' || tactic === 'Resource Development') continue;
                       mitreData[tactic].techniques.forEach(tech => {
                           if (!processedTTPs.has(tech.id) && tech.status && tech.status !== 'unknown' && tech.status !== 'na' && tech.status !== 'pending') {
                                totalValidated++;
                                processedTTPs.add(tech.id);
                                if (tech.status === 'high') points += 1.0;
                                else if (tech.status === 'medium') points += 0.5;
                                else if (tech.status === 'minimal') points += 0.25;
                           }
                           
                           if (tech.subTechniques) {
                               tech.subTechniques.forEach(sub => {
                                   if (!processedTTPs.has(sub.id) && sub.status && sub.status !== 'unknown' && sub.status !== 'na' && sub.status !== 'pending') {
                                        totalValidated++;
                                        processedTTPs.add(sub.id);
                                        if (sub.status === 'high') points += 1.0;
                                        else if (sub.status === 'medium') points += 0.5;
                                        else if (sub.status === 'minimal') points += 0.25;
                                   }
                               });
                           }
                       });
                   }
               }
               
               const grsScore = totalValidated > 0 ? Math.round((points / totalValidated) * 100) : 0;
               
               const applicableGaps = allGaps.filter(g => g.status !== 'Risk Accepted');
               const totalGaps = applicableGaps.length;
               const open = allGaps.filter(g => g.status === 'Open' || g.status === 'In Progress');
               const openGapsCount = open.length;
               const closedGaps = totalGaps - openGapsCount;
               const resolutionRate = totalGaps === 0 ? 100 : Math.round((closedGaps / totalGaps) * 100);

               const severityWeights = { 'Critical': 10, 'High': 7, 'Medium': 3, 'Low': 1 };
               const residualRisk = open.reduce((acc, g) => acc + (severityWeights[g.severity] || 0), 0);
               
               const resolved = allGaps.filter(g => g.status === 'Resolved' && g.resolvedDate && g.createdDate);
               const validResolved = resolved.filter(g => !isNaN(new Date(g.resolvedDate)) && !isNaN(new Date(g.createdDate)) && new Date(g.resolvedDate) >= new Date(g.createdDate));
               let mttrText = 'N/A';
               if (validResolved.length > 0) {
                   const totalSeconds = validResolved.reduce((acc, g) => acc + (new Date(g.resolvedDate) - new Date(g.createdDate)) / 1000, 0);
                   const meanSeconds = totalSeconds / validResolved.length;
                   if (!isNaN(meanSeconds)) {
                        let roundedHours = Math.round(meanSeconds / 3600);
                        if (roundedHours > 0) {
                            const d = Math.floor(roundedHours / 24);
                            const h = roundedHours % 24;
                            if (d > 0 && h > 0) mttrText = `${d}d ${h}h`;
                            else if (d > 0) mttrText = `${d}d`;
                            else mttrText = `${h}h`;
                        } else {
                            mttrText = '< 1h';
                        }
                    }
               }
               
               const tacticExposure = {};
                const trackExposure = (items, isGap) => {
                    items.forEach(item => {
                        if (!mitreData || Object.keys(mitreData).length === 0 || !item.ttp) return;
                        const ttpList = item.ttp.split(',').map(t => t.trim());
                        ttpList.forEach(ttp => {
                            const tacticName = Object.keys(mitreData).find(t => mitreData[t].techniques.find(tech => tech.id === ttp || (tech.subTechniques && tech.subTechniques.find(sub => sub.id === ttp))));
                            if (tacticName) {
                               if (!tacticExposure[tacticName]) tacticExposure[tacticName] = { tested: new Set(), missed: new Set() };
                               
                               if (isGap) {
                                   if (item.status === 'Open' || item.status === 'In Progress' || item.status === 'Risk Accepted') {
                                       tacticExposure[tacticName].tested.add(ttp);
                                       tacticExposure[tacticName].missed.add(ttp);
                                   } else if (item.status === 'Resolved') {
                                       tacticExposure[tacticName].tested.add(ttp);
                                       tacticExposure[tacticName].missed.delete(ttp);
                                   }
                               } else {
                                   tacticExposure[tacticName].tested.add(ttp);
                                   const posture = getNormalizedPosture(item);
                                   if (posture.coverage === 'None' || posture.coverage === 'Minimal') {
                                       tacticExposure[tacticName].missed.add(ttp);
                                   } else if (posture.coverage === 'Optimal' || posture.coverage === 'Partial') {
                                       tacticExposure[tacticName].missed.delete(ttp);
                                   }
                               }
                            }
                        });
                    });
                };
                
                trackExposure(allExercises, false);
                trackExposure(allGaps.filter(g => g.status === 'Resolved'), true);
                trackExposure(allGaps.filter(g => g.status === 'Open' || g.status === 'In Progress' || g.status === 'Risk Accepted'), true);
                
                const killChainPhases = {
                    "Initial Access": ["Initial Access"],
                    "Execution": ["Execution", "Persistence", "Privilege Escalation"],
                    "Evasion": ["Defense Evasion", "Defense Impairment", "Stealth"],
                    "Movement": ["Discovery", "Lateral Movement", "Credential Access"],
                    "Action on Objective": ["Collection", "Command and Control", "Exfiltration", "Impact"]
                };

                const radarData = Object.entries(killChainPhases).map(([phase, tactics]) => {
                    const missedSet = new Set();
                    const testedSet = new Set();
                    tactics.forEach(t => {
                        if (tacticExposure[t]) {
                            tacticExposure[t].missed.forEach(ttp => missedSet.add(ttp));
                            tacticExposure[t].tested.forEach(ttp => testedSet.add(ttp));
                        }
                    });
                    const missed = missedSet.size;
                    const tested = testedSet.size;
                    return {
                        subject: phase,
                        risk: tested > 0 ? Math.round((missed / tested) * 100) : 0,
                        tested: tested,
                        fullMark: 100
                    };
                });

               const simulationsByName = {};
               allExercises.forEach(ex => {
                   if (ex.status?.toLowerCase() === 'na' || ex.coverageRating === 'N/A') return;
                   
                   let calcStatus = 'unknown';
                   if (ex.coverageRating && ex.coverageRating !== 'N/A') {
                       calcStatus = ex.coverageRating === 'Optimal' ? 'high' : ex.coverageRating === 'Partial' ? 'medium' : ex.coverageRating === 'Minimal' ? 'minimal' : ex.coverageRating === 'None' ? 'low' : 'unknown';
                   } else if (ex.status && ex.status.toLowerCase() !== 'completed') {
                       calcStatus = ex.status;
                   }

                   if (!simulationsByName[ex.simulation]) simulationsByName[ex.simulation] = { date: ex.date, high: 0, medium: 0, minimal: 0, total: 0 };
                   simulationsByName[ex.simulation].total += 1;
                   if (calcStatus === 'high') simulationsByName[ex.simulation].high += 1;
                   if (calcStatus === 'medium') simulationsByName[ex.simulation].medium += 1;
                   if (calcStatus === 'minimal') simulationsByName[ex.simulation].minimal += 1;
               });
               const safeDate = (dateStr) => {
                   const d = new Date(dateStr);
                   return isNaN(d.getTime()) ? new Date() : d;
               };

               const historicalScores = Object.values(simulationsByName).sort((a,b) => safeDate(a.date) - safeDate(b.date)).map(c => {
                   const score = Math.round(((c.high + (c.medium * 0.5) + (c.minimal * 0.25)) / c.total) * 100);
                   return {
                       name: safeDate(c.date).toLocaleDateString('default', { month: 'short', day: 'numeric' }),
                       score: score
                   };
               });
               
               const currentDate = new Date().toLocaleString('default', { month: 'short', day: 'numeric' });
               let areaData = historicalScores;
               if (areaData.length === 0) {
                   areaData = [
                       { name: 'Baseline', score: 0 },
                       { name: currentDate, score: grsScore },
                   ];
               } else if (areaData.length === 1) {
                   areaData = [
                       { name: 'Baseline', score: 0 },
                       ...areaData
                   ];
               }
               
               // Ensure the latest node on the trend graph explicitly matches the current true GRS
               if (areaData.length > 0) {
                   if (areaData[areaData.length - 1].name === currentDate) {
                       areaData[areaData.length - 1].score = grsScore;
                   } else {
                       areaData.push({ name: currentDate, score: grsScore });
                   }
               }

               let mitreCoveragePercentage = 0;
               if (mitreData && Object.keys(mitreData).length > 0) {
                   let totalInScope = 0;
                   const testedTTPs = new Set();
                   
                   allExercises.forEach(ex => {
                        if (ex.status !== 'na' && ex.status !== 'unknown' && ex.ttp) {
                            ex.ttp.split(',').forEach(t => testedTTPs.add(t.trim()));
                        }
                    });
                   
                   let testedInScopeCount = 0;
                   
                   Object.keys(mitreData).forEach(tacticName => {
                       if (tacticName === 'Reconnaissance' || tacticName === 'Resource Development') return;
                       
                       const tactic = mitreData[tacticName];
                       tactic.techniques.forEach(tech => {
                           if (tech.status !== 'na' && tech.environments?.['All'] !== 'na') {
                               totalInScope++;
                               
                               let isTested = testedTTPs.has(tech.id);
                               if (!isTested && tech.subTechniques) {
                                   isTested = tech.subTechniques.some(sub => testedTTPs.has(sub.id));
                               }
                               
                               if (isTested) testedInScopeCount++;
                           }
                       });
                   });
                   
                   if (totalInScope > 0) {
                       mitreCoveragePercentage = Math.round((testedInScopeCount / totalInScope) * 100);
                   }
               }

               setMetrics({
                   grsScore,
                   totalValidated,
                   totalGaps,
                   closedGaps,
                   openGapsCount,
                   resolutionRate,
                   residualRisk,
                   mttrText,
                   radarData,
                   areaData,
                   mitreCoveragePercentage
               });
                const resolvedTTPs = new Set();
                allGaps.forEach(g => {
                    if (g.status === 'Resolved' || g.status === 'Risk Accepted') {
                        if (g.ttp) g.ttp.split(',').forEach(t => resolvedTTPs.add(t.trim()));
                    }
                });

                const controlStats = {};
                const processedEventKeys = new Set();
                
                allExercises.forEach(ex => {
                    if (ex.status === 'unknown' || ex.status === 'na' || ex.status === 'Pending') return;
                    if (ex.remediation && typeof ex.remediation === 'string' && ex.remediation.includes('No specific execution or detection notes')) return;
                    
                    // Deduplicate events that originate from the same procedure execution (mapped to multiple TTPs)
                    const normalizeDate = (d) => { try { return d ? new Date(d).toISOString().split('T')[0] : ''; } catch(e) { return ''; } };
                    const exDateStr = normalizeDate(ex.date);
                    const simKey = ex.simulation || ex.simId || 'unknown';
                    const dedupeKey = ex.remediation ? `${simKey}-${exDateStr}-${ex.remediation}` : `${simKey}-${exDateStr}-${ex.name || ex.ttp || ex.id || 'unknown'}`;
                    if (processedEventKeys.has(dedupeKey)) return;
                    processedEventKeys.add(dedupeKey);

                    const { outcome } = getNormalizedPosture(ex);
                    let isPositive = outcome === 'Prevented' || outcome === 'Alerted';
                    
                    if (!isPositive && ex.ttp) {
                        const ttps = ex.ttp.split(',').map(t => t.trim());
                        if (ttps.some(t => resolvedTTPs.has(t))) {
                            isPositive = true;
                        }
                    }
                    
                    const rawControls = Array.isArray(ex.securityControls) ? ex.securityControls : [];
                    const controls = [...new Set(rawControls)];
                    controls.forEach(ctrl => {
                        if (!controlStats[ctrl]) {
                            controlStats[ctrl] = { name: ctrl, totalEvents: 0, positiveOutcomes: 0 };
                        }
                        controlStats[ctrl].totalEvents += 1;
                        if (isPositive) {
                            controlStats[ctrl].positiveOutcomes += 1;
                        }
                    });
                });
                const topControls = Object.values(controlStats)
                    .map(c => ({ name: c.name, totalTTPs: c.totalEvents, positiveOutcomes: c.positiveOutcomes }))
                    .sort((a, b) => b.positiveOutcomes - a.positiveOutcomes || b.totalTTPs - a.totalTTPs);
                
                setTopSecurityControls(topControls);
           }
       } catch (err) {
           console.error("Dashboard loadDashboardData critical error:", err);
           setMetrics(prev => ({ ...prev, dbError: err.message || err.toString() }));
       } finally {
           setIsLoading(false);
       }
  }, [dbAdapter, allEventsData, contextGaps, mitreData, activeTagFilter]);

  React.useEffect(() => {
      loadDashboardData();
  }, [loadDashboardData]);

  const {
      grsScore,
      totalValidated,
      totalGaps,
      closedGaps,
      openGapsCount,
      resolutionRate,
      residualRisk,
      mttrText,
      radarData,
      areaData,
      mitreCoveragePercentage
  } = metrics;

  const isRemoteConnected = !!dbAdapter && !isDbLoading && dbConfig?.provider !== 'local';

  return (
    <div className="animate-fade-in" style={{ flex: 1, height: '100%', minHeight: 0, paddingRight: '10px', display: 'flex', flexDirection: 'column', overflowY: 'auto', overflowX: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px', flexWrap: 'wrap', gap: '20px', flexShrink: 0 }}>
        <div>
          <h1 className="iridescent-text" style={{ fontSize: '2.5rem', marginBottom: '10px', marginTop: 0 }}>Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '1.1rem' }}>High-level overview of your global security posture.</p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
            <TagDropdown />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'rgba(10,11,16,0.6)', border: `1px solid ${isRemoteConnected ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '24px', boxShadow: isRemoteConnected ? '0 0 10px rgba(16,185,129,0.2)' : 'none' }}>
              <Database size={16} color={isRemoteConnected ? 'var(--success)' : 'var(--text-muted)'} />
              <span style={{ fontSize: '0.85rem', color: isRemoteConnected ? 'var(--success)' : 'var(--text-muted)', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                  {isRemoteConnected ? 'DB: CONNECTED' : 'DB: LOCAL STORAGE'}
              </span>
           </div>
           
           <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'rgba(10,11,16,0.6)', border: `1px solid ${isAiActive ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '24px', boxShadow: isAiActive ? '0 0 10px rgba(16,185,129,0.2)' : 'none' }}>
              <BrainCircuit size={16} color={isAiActive ? 'var(--success)' : 'var(--text-muted)'} />
              <span style={{ fontSize: '0.85rem', color: isAiActive ? 'var(--success)' : 'var(--text-muted)', fontWeight: 'bold' }}>{isAiActive ? 'AI: ONLINE' : 'AI: OFFLINE'}</span>
           </div>
        </div>
      </div>
      
      <div className="slide-in-staggered responsive-row" style={{ marginBottom: '40px', background: 'radial-gradient(ellipse at center, rgba(31,40,51,0.95) 0%, rgba(11,12,16,0.95) 100%)', borderRadius: '16px', border: '1px solid var(--glass-border)', padding: '40px', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 20px 50px rgba(0,0,0,0.5), inset 0 0 40px rgba(156,39,176,0.1)' }}>
          <div style={{ flex: 1 }}>
              <h2 style={{ margin: '0 0 10px 0', fontSize: '2.2rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <Shield size={32} color="var(--accent-primary)" /> Global Readiness Score
                  <Tooltip content={<div style={{ whiteSpace: 'normal', width: '250px', fontSize: '0.85rem', fontWeight: 'normal', letterSpacing: 'normal' }}>Your overall enterprise security posture score, calculated from adversary simulation outcomes and open coverage gaps.</div>}>
                     <span style={{ cursor: 'help', color: 'var(--text-muted)', display: 'flex', marginTop: '4px' }}><Info size={20} /></span>
                  </Tooltip>
              </h2>
              <p style={{ margin: '0 0 20px 0', color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '600px', lineHeight: 1.5 }}>
                  A unified metric tracking your organization's overall ability to defend against and detect cyber threats.
              </p>
              <div style={{ display: 'flex', gap: '20px', marginTop: '15px', flexWrap: 'wrap' }}>
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '15px 25px', textAlign: 'center', boxShadow: 'inset 0 0 20px rgba(255,255,255,0.02)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', letterSpacing: '1.5px', marginBottom: '8px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          TESTED TTPs
                      </div>
                      <div style={{ fontSize: '2.2rem', fontWeight: '900', color: 'var(--text-primary)', fontFamily: 'monospace', lineHeight: 1 }}>{totalValidated}</div>
                  </div>
                  <div style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '12px', padding: '15px 25px', textAlign: 'center', boxShadow: 'inset 0 0 20px rgba(59, 130, 246, 0.05)' }}>
                      <div style={{ fontSize: '0.75rem', color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '8px', opacity: 0.8, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          ATT&CK Coverage
                          <Tooltip content={<div style={{ whiteSpace: 'normal', width: '220px', fontSize: '0.85rem', color: '#fff', textTransform: 'none', letterSpacing: 'normal', fontWeight: 'normal' }}>The percentage of in-scope MITRE ATT&CK techniques that have been tested at least once.</div>}>
                             <span style={{ cursor: 'help', color: '#60a5fa', display: 'flex' }}><Info size={12} /></span>
                          </Tooltip>
                      </div>
                      <div style={{ fontSize: '2.2rem', fontWeight: '900', color: '#60a5fa', fontFamily: 'monospace', lineHeight: 1, textShadow: '0 0 15px rgba(59, 130, 246, 0.4)' }}>{mitreCoveragePercentage}%</div>
                  </div>
                  <div style={{ background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '12px', padding: '15px 25px', textAlign: 'center', boxShadow: 'inset 0 0 20px rgba(245, 158, 11, 0.05)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--warning)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '8px', opacity: 0.8, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          Active Gaps
                      </div>
                      <div style={{ fontSize: '2.2rem', fontWeight: '900', color: 'var(--warning)', fontFamily: 'monospace', lineHeight: 1, textShadow: '0 0 15px rgba(245, 158, 11, 0.4)' }}>{openGapsCount}</div>
                  </div>
              </div>
          </div>
          
          <div style={{ flex: '0 0 300px', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
              <svg width="240" height="240" viewBox="0 0 240 240" style={{ transform: 'rotate(-90deg)', filter: 'drop-shadow(0 0 20px rgba(156,39,176,0.4))' }}>
                  <circle cx="120" cy="120" r="100" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="15" />
                  <circle 
                      cx="120" cy="120" r="100" 
                      fill="none" 
                      stroke="url(#gradientScore)" 
                      strokeWidth="15" 
                      strokeLinecap="round"
                      strokeDasharray="628"
                      strokeDashoffset={628 - (628 * grsScore) / 100}
                      style={{ transition: 'stroke-dashoffset 1.5s ease-in-out' }}
                  />
                  <defs>
                      <linearGradient id="gradientScore" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor={grsScore >= 80 ? '#10b981' : grsScore >= 50 ? '#f59e0b' : '#ef4444'} />
                          <stop offset="100%" stopColor={grsScore >= 80 ? '#3b82f6' : grsScore >= 50 ? '#ef4444' : '#9f1239'} />
                      </linearGradient>
                  </defs>
              </svg>
              <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: totalValidated === 0 ? '1.5rem' : '4.5rem', fontWeight: 900, color: 'var(--text-primary)', textShadow: '0 0 20px rgba(255,255,255,0.2)', lineHeight: 1, textAlign: 'center' }}>
                      {totalValidated === 0 ? 'Ready for\nBaseline' : grsScore}
                  </span>
                  {totalValidated > 0 && <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 'bold', letterSpacing: '2px' }}>/ 100</span>}
              </div>
          </div>
      </div>
      
      <div className="slide-in-staggered dashboard-grid" style={{ marginBottom: '15px', flexShrink: 0 }}>
        {/* Remediation Resolution Rate Card */}
        <div className="glass-panel hover-lift" style={{ padding: '30px', position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 'inherit', pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.05 }}><CyberResolutionIcon size={150} /></div>
          </div>
          <h3 style={{ margin: '0 0 15px 0', color: 'var(--text-secondary)', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Remediation Resolution Rate
              <Tooltip content={<div style={{ whiteSpace: 'normal', width: '220px' }}>The percentage of identified coverage gaps that have successfully traversed the engineering pipeline and reached the Resolved state.</div>}>
                 <span style={{ cursor: 'help', color: 'var(--text-muted)', display: 'flex' }}><Info size={14} /></span>
              </Tooltip>
          </h3>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '15px', marginTop: '-5px' }}>
              <div style={{ fontSize: '4rem', fontWeight: '800', color: resolutionRate >= 80 ? 'var(--success)' : resolutionRate >= 40 ? 'var(--warning)' : 'var(--danger)', lineHeight: '1' }}>{resolutionRate}%</div>
          </div>
          
          <div style={{ marginTop: '20px', width: '100%', padding: '0 5px', boxSizing: 'border-box' }}>
              <div style={{ width: '100%', height: '8px', background: 'var(--glass-bg)', borderRadius: '4px', overflow: 'hidden' }}>
                 <div style={{ width: `${resolutionRate}%`, height: '100%', background: resolutionRate >= 80 ? 'var(--success)' : resolutionRate >= 40 ? 'var(--warning)' : 'var(--danger)', transition: 'width 0.5s ease' }}></div>
              </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px', textTransform: 'uppercase', fontWeight: 'bold', padding: '0 5px', visibility: 'hidden' }}>
              <span>0%</span>
              <span>100%</span>
          </div>

          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '20px' }}>
             <span>{totalGaps === 0 ? 'No Gaps Identified' : `Calculated from ${totalGaps} Identified Gaps`}</span>
          </div>
          <div style={{ marginTop: '10px' }}>
             <Link to="/gaps" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', marginTop: '12px', color: 'var(--accent-secondary)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 'bold' }}>
                 View {closedGaps} Resolved Gaps <ArrowRight size={14} />
             </Link>
          </div>
        </div>

        {/* Weighted Residual Risk Card */}
        <div className="glass-panel hover-lift" style={{ padding: '30px', position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 'inherit', pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.05 }}><CyberRiskIcon size={150} /></div>
          </div>
          <h3 style={{ margin: '0 0 15px 0', color: 'var(--text-secondary)', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Weighted Residual Risk
              <Tooltip content={<div style={{ whiteSpace: 'normal', width: '220px' }}>The cumulative risk score of all open gaps in the backlog, weighted heavily by severity:<br/><br/>Critical = 10 pts<br/>High = 7 pts<br/>Medium = 3 pts<br/>Low = 1 pt</div>}>
                 <span style={{ cursor: 'help', color: 'var(--text-muted)', display: 'flex' }}><Info size={14} /></span>
              </Tooltip>
          </h3>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '15px', marginTop: '-5px' }}>
              <div style={{ fontSize: '4rem', fontWeight: '800', color: residualRisk >= 80 ? '#ef4444' : residualRisk >= 60 ? '#f97316' : residualRisk >= 40 ? '#eab308' : residualRisk >= 20 ? '#84cc16' : '#10b981', lineHeight: '1' }}>{residualRisk}</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: residualRisk >= 80 ? '#ef4444' : residualRisk >= 60 ? '#f97316' : residualRisk >= 40 ? '#eab308' : residualRisk >= 20 ? '#84cc16' : '#10b981' }}>
                  {residualRisk >= 80 ? 'Critical Risk' : residualRisk >= 60 ? 'High Risk' : residualRisk >= 40 ? 'Moderate Risk' : residualRisk >= 20 ? 'Low Risk' : 'Minimal Risk'}
              </div>
          </div>
          
          <div style={{ marginTop: '20px', width: '100%', padding: '0 5px', boxSizing: 'border-box' }}>
              <div style={{ position: 'relative', width: '100%' }}>
                  <div style={{ width: '100%', height: '8px', background: 'linear-gradient(to right, #10b981 0%, #84cc16 20%, #eab308 40%, #f97316 60%, #ef4444 80%, #ef4444 100%)', borderRadius: '4px' }}></div>
                  <div style={{ position: 'absolute', top: '-6px', left: `${Math.max(1, Math.min(99, getRiskPosition(residualRisk)))}%`, width: '4px', height: '20px', background: 'white', borderRadius: '2px', boxShadow: '0 0 5px rgba(0,0,0,0.5)', transform: 'translateX(-50%)', transition: 'left 0.5s ease' }}></div>
              </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px', textTransform: 'uppercase', fontWeight: 'bold', padding: '0 5px' }}>
              <span>Minimal</span>
              <span>Critical</span>
          </div>

          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '20px' }}>
             <span>Calculated from {openGapsCount} Active Gaps</span>
          </div>
           <Link to="/gaps" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', marginTop: '12px', color: 'var(--accent-secondary)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 'bold' }}>
             View Active Gaps <ArrowRight size={14} />
           </Link>
        </div>

        {/* Mean Time To Remediate Card */}
        <div className="glass-panel hover-lift" style={{ padding: '30px', position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 'inherit', pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.05 }}><CyberMTTRIcon size={150} /></div>
          </div>
          <h3 style={{ margin: '0 0 15px 0', color: 'var(--text-secondary)', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Mean Time To Remediate (MTTR)
              <Tooltip content={<div style={{ whiteSpace: 'normal', width: '220px' }}>The average time taken to transition a logged coverage gap from 'Open' to fully 'Resolved' via an engineering deployment and re-test.</div>}>
                 <span style={{ cursor: 'help', color: 'var(--text-muted)', display: 'flex' }}><Info size={14} /></span>
              </Tooltip>
          </h3>
          <div style={{ fontSize: '2.5rem', fontWeight: '800', color: '#c084fc', textShadow: '0 0 15px rgba(192,132,252,0.3)' }}>{mttrText}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '5px' }}>
             <span>Averaged across {closedGaps} resolved gaps</span>
          </div>
        </div>
      </div>

      <div className="slide-in-staggered dashboard-grid" style={{ marginBottom: '15px', flex: 1, minHeight: '400px', gridAutoRows: '1fr' }}>
         {/* Kill Chain Exposure Card (Master-Detail) */}
         <div className="glass-panel hover-lift" style={{ padding: '20px 30px', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', height: '100%' }}>
            {!expandedPhaseSubject ? (
                <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: '15px', marginBottom: '15px', zIndex: 2 }}>
                        <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            Kill Chain Exposure
                            <Tooltip content={<div style={{ whiteSpace: 'normal', width: '220px', fontSize: '0.85rem', fontWeight: 'normal', color: '#fff' }}>A breakdown of your defensive posture across the Lockheed Martin Cyber Kill Chain. Highlights which stages of an attack are most vulnerable.</div>}>
                               <span style={{ cursor: 'help', color: 'var(--text-muted)', display: 'flex' }}><Info size={14} /></span>
                            </Tooltip>
                        </h3>
                    </div>
                    
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                        {/* Master View (The Chain) */}
                        <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', padding: '10px 10px 25px 10px', overflowX: 'auto' }}>
                            {/* The glowing track line */}
                            <div style={{ position: 'absolute', top: '50%', left: '40px', right: '40px', height: '4px', background: 'rgba(255,255,255,0.05)', transform: 'translateY(-50%)', borderRadius: '2px', zIndex: 0 }}>
                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(59, 130, 246, 0.4), rgba(156, 39, 176, 0.4))', borderRadius: 'inherit', boxShadow: '0 0 10px rgba(156, 39, 176, 0.5)' }} />
                            </div>
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', zIndex: 1, position: 'relative', minWidth: 'max-content', gap: '20px' }}>
                                {radarData && radarData.map((phase, i) => {
                                    const risk = phase.risk;
                                    const tested = phase.tested;
                                    const isActive = activePhaseSubject === phase.subject;
                                    const IconComponent = PHASE_ICONS[phase.subject] || Target;
                                    let color = 'var(--success)';
                                    let glow = 'rgba(16, 185, 129, 0.4)';
                                    
                                    if (tested === 0) { 
                                        color = 'var(--text-muted)'; 
                                        glow = 'rgba(255, 255, 255, 0.1)'; 
                                    }
                                    else if (risk >= 50) { 
                                        color = 'var(--danger)'; 
                                        glow = 'rgba(239, 68, 68, 0.4)'; 
                                    }
                                    else if (risk >= 20) { 
                                        color = 'var(--warning)'; 
                                        glow = 'rgba(245, 158, 11, 0.4)'; 
                                    }
                                    
                                    return (
                                        <div key={phase.subject} 
                                             style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', position: 'relative', width: '80px', cursor: 'pointer' }}
                                             onMouseEnter={() => setActivePhaseSubject(phase.subject)}
                                             onClick={() => setExpandedPhaseSubject(phase.subject)}
                                             onMouseOver={e => { e.currentTarget.children[1].style.transform = 'scale(1.2)'; }}
                                             onMouseOut={e => { e.currentTarget.children[1].style.transform = isActive ? 'scale(1.15)' : 'scale(1)'; }}>
                                            
                                            {/* Label above */}
                                            <div style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '0.65rem', fontWeight: isActive ? 800 : 600, fontFamily: 'monospace', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.5px', height: '40px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', textShadow: isActive ? '0 2px 4px rgba(0,0,0,0.8)' : 'none', transition: 'all 0.3s' }}>
                                                {phase.subject}
                                            </div>
                                            
                                            {/* The Node with Icon */}
                                            <div style={{ 
                                                width: '36px', height: '36px', borderRadius: '50%', 
                                                background: isActive ? 'rgba(31,40,51,0.9)' : 'var(--bg-secondary)', 
                                                border: `2px solid ${color}`,
                                                boxShadow: isActive ? `0 0 25px ${color}` : `0 0 15px ${glow}`,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                                                position: 'relative',
                                                color: color,
                                                transform: isActive ? 'scale(1.15)' : 'scale(1)'
                                            }}>
                                                <IconComponent size={16} />
                                            </div>
                                            
                                            {/* Selection indicator below */}
                                            <div style={{ height: '6px', width: '6px', borderRadius: '50%', background: isActive ? 'var(--text-primary)' : 'transparent', transition: 'background 0.3s', marginTop: '10px' }} />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Detail View (HUD Console) */}
                        <div style={{ flex: 1, background: 'rgba(10,11,16,0.6)', borderRadius: '12px', border: '1px solid var(--glass-border)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            {(() => {
                                const activeData = radarData && radarData.find(d => d.subject === activePhaseSubject) || (radarData && radarData[0]);
                                if (!activeData) return null;
                                const risk = activeData.risk;
                                const tested = activeData.tested;
                                let color = 'var(--success)';
                                let statusText = 'SECURED';
                                const ttpText = tested === 1 ? 'tested technique' : 'tested techniques';
                                let desc = `Defenses successfully prevented the ${ttpText} in this phase.`;
                                
                                if (tested === 0) { 
                                    color = 'var(--text-muted)'; 
                                    statusText = 'UNTESTED / NO DATA';
                                    desc = `No empirical test data exists for ${activeData.subject}. Run simulations targeting this phase to establish a baseline.`;
                                }
                                else if (risk >= 70) { 
                                    color = '#ef4444'; 
                                    statusText = 'Critical Risk';
                                    desc = `High exposure rate for the ${ttpText} in ${activeData.subject}. Significant defense gaps observed.`;
                                }
                                else if (risk >= 50) { 
                                    color = '#f97316'; 
                                    statusText = 'High Risk';
                                    desc = `Elevated exposure for the ${ttpText} in ${activeData.subject}. Frequent defense misses observed.`;
                                }
                                else if (risk >= 30) { 
                                    color = '#eab308'; 
                                    statusText = 'Moderate Risk';
                                    desc = `Moderate exposure for the ${ttpText} in this phase. Defenses were partially bypassed.`;
                                }
                                else if (risk >= 10) { 
                                    color = '#84cc16'; 
                                    statusText = 'Low Risk';
                                    desc = `Low exposure for the ${ttpText} in this phase. Defenses prevented most activity.`;
                                }
                                else if (risk > 0) {
                                    color = '#10b981'; 
                                    statusText = 'Minimal Risk';
                                    desc = `Minimal exposure for the ${ttpText} in this phase. Defenses were largely effective.`;
                                }

                                return (
                                    <div className="animate-fade-in" key={activeData.subject} style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                                                <div>
                                                    <h4 style={{ margin: '0 0 5px 0', fontSize: '1.2rem', color: 'var(--text-primary)', fontFamily: 'monospace' }}>[{activeData.subject.toUpperCase()}]</h4>
                                                    <div style={{ color: color, fontSize: '0.9rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>{statusText}</div>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontSize: '2rem', fontWeight: 900, color: color, lineHeight: '1' }}>{tested > 0 ? `${risk}%` : '--'}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>EXPOSURE</div>
                                                </div>
                                            </div>
                                            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                                {desc}
                                            </p>
                                        </div>
                                        
                                        <div style={{ marginTop: '15px', opacity: tested > 0 ? 1 : 0.2, pointerEvents: tested > 0 ? 'auto' : 'none' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '5px' }}>
                                                <span>Secure</span>
                                                <span>Exposed</span>
                                            </div>
                                            <div style={{ width: '100%', height: '8px', background: 'var(--glass-bg)', borderRadius: '4px', overflow: 'hidden' }}>
                                                <div style={{ width: `${risk}%`, height: '100%', background: color, transition: 'width 0.5s cubic-bezier(0.16, 1, 0.3, 1)' }} />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </>
            ) : (
                (() => {
                    const activeData = radarData && radarData.find(d => d.subject === expandedPhaseSubject);
                    if (!activeData) return null;
                    const risk = activeData.risk;
                    const tested = activeData.tested;
                    let color = 'var(--success)';
                    let statusText = 'SECURED';
                    
                    if (tested === 0) { 
                        color = 'var(--text-muted)'; 
                        statusText = 'UNTESTED';
                    } else if (risk >= 70) { 
                        color = '#ef4444'; 
                        statusText = 'Critical Risk';
                    } else if (risk >= 50) { 
                        color = '#f97316'; 
                        statusText = 'High Risk';
                    } else if (risk >= 30) { 
                        color = '#eab308'; 
                        statusText = 'Moderate Risk';
                    } else if (risk >= 10) { 
                        color = '#84cc16'; 
                        statusText = 'Low Risk';
                    } else if (risk > 0) {
                        color = '#10b981'; 
                        statusText = 'Minimal Risk';
                    }

                    // Compute relevant events
                    const getTTPName = (id) => {
                        if (!mitreData || !id) return '';
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
                    const killChainPhases = {
                        "Initial Access": ["Initial Access"],
                        "Execution": ["Execution", "Persistence", "Privilege Escalation"],
                        "Evasion": ["Defense Evasion", "Defense Impairment", "Stealth"],
                        "Movement": ["Discovery", "Lateral Movement", "Credential Access"],
                        "Action on Objective": ["Collection", "Command and Control", "Exfiltration", "Impact"]
                    };
                    const activeTactics = killChainPhases[expandedPhaseSubject] || [];
                    const relevantEvents = [];
                    if (simulationSummaries) {
                        Object.entries(simulationSummaries).forEach(([simName, sim]) => {
                            if (sim.testResults && Array.isArray(sim.testResults)) {
                                sim.testResults.forEach(evt => {
                                    if (!evt.ttps || evt.ttps.length === 0) return;
                                    const match = evt.ttps.some(ttp => {
                                        const tacticName = Object.keys(mitreData || {}).find(t => 
                                             mitreData[t].techniques.find(tech => tech.id === ttp || (tech.subTechniques && tech.subTechniques.find(sub => sub.id === ttp)))
                                        );
                                        return activeTactics.includes(tacticName);
                                    });
                                    if (match) {
                                        relevantEvents.push({ ...evt, simulationName: simName });
                                    }
                                });
                            }
                        });
                    }

                    return (
                        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--glass-border)', paddingBottom: '15px', marginBottom: '15px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <button 
                                        onClick={() => setExpandedPhaseSubject(null)}
                                        className="hover-lift"
                                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', cursor: 'pointer' }}
                                    >
                                        <ArrowLeft size={18} />
                                    </button>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {expandedPhaseSubject}
                                        </h3>
                                        <div style={{ color: color, fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>
                                            {statusText}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '2.2rem', fontWeight: 900, color: color, lineHeight: '1' }}>{tested > 0 ? `${risk}%` : '--'}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>EXPOSURE</div>
                                </div>
                            </div>

                            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '5px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {relevantEvents.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                                        No event data found for {expandedPhaseSubject}.
                                    </div>
                                ) : (
                                    relevantEvents.map((evt, i) => {
                                        const actualOutcome = evt.outcome || 'Unknown';
                                        const lowerOutcome = actualOutcome.toLowerCase();

                                        let outcomeStyle = { color: 'var(--text-primary)', bg: 'rgba(255,255,255,0.1)', border: 'rgba(255,255,255,0.2)' };
                                        
                                        if (lowerOutcome.includes('prevented & alerted') || (lowerOutcome.includes('prevented') && lowerOutcome.includes('alerted'))) {
                                            outcomeStyle = { color: 'var(--success)', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.3)' };
                                        } else if (lowerOutcome.includes('prevented')) {
                                            outcomeStyle = { color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)', border: 'rgba(6, 182, 212, 0.3)' };
                                        } else if (lowerOutcome.includes('alerted')) {
                                            outcomeStyle = { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.3)' };
                                        } else if (lowerOutcome.includes('logged')) {
                                            outcomeStyle = { color: '#eab308', bg: 'rgba(234, 179, 8, 0.15)', border: 'rgba(234, 179, 8, 0.3)' };
                                        } else if (lowerOutcome.includes('missed')) {
                                            outcomeStyle = { color: 'var(--danger)', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.3)' };
                                        } else if (lowerOutcome.includes('accepted')) {
                                            outcomeStyle = { color: 'var(--text-muted)', bg: 'rgba(255, 255, 255, 0.05)', border: 'rgba(255, 255, 255, 0.1)' };
                                        }

                                        const ttps = (evt.ttps || []).join(', ') || 'Unknown TTP';
                                        const eventName = evt.name || 'Simulated Event';

                                        return (
                                            <div key={i} className="hover-lift" onClick={() => navigate('/reports', { state: { simulation: evt.simulationName, fromDashboard: true } })} style={{ 
                                                background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', 
                                                border: '1px solid var(--glass-border)', 
                                                borderLeft: `4px solid ${outcomeStyle.color}`,
                                                borderRadius: '8px', 
                                                padding: '12px 16px', 
                                                display: 'flex', 
                                                justifyContent: 'space-between', 
                                                alignItems: 'center',
                                                transition: 'all 0.2s ease',
                                                cursor: 'pointer'
                                            }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <Shield size={14} color={outcomeStyle.color} />
                                                        <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.3px' }}>
                                                            {eventName}
                                                        </span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'monospace' }}>
                                                            <Target size={12} /> {ttps}
                                                        </span>
                                                    </div>
                                                </div>
                                                
                                                <div style={{ 
                                                    background: outcomeStyle.bg, 
                                                    border: `1px solid ${outcomeStyle.border}`, 
                                                    color: outcomeStyle.color, 
                                                    padding: '4px 10px', 
                                                    borderRadius: '20px', 
                                                    fontSize: '0.7rem', 
                                                    fontWeight: 800, 
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.5px',
                                                    boxShadow: `0 0 10px ${outcomeStyle.bg}`
                                                }}>
                                                    {actualOutcome}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                            
                            <div style={{ marginTop: '15px', opacity: tested > 0 ? 1 : 0.2, pointerEvents: tested > 0 ? 'auto' : 'none', flex: '0 0 auto' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '5px' }}>
                                    <span>Secure</span>
                                    <span>Exposed</span>
                                </div>
                                <div style={{ width: '100%', height: '8px', background: 'var(--glass-bg)', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{ width: `${risk}%`, height: '100%', background: color, transition: 'width 0.5s cubic-bezier(0.16, 1, 0.3, 1)' }} />
                                </div>
                            </div>
                        </div>
                    );
                })()
            )}
         </div>

         {/* Top Focus Gaps */}
         <div className="glass-panel hover-lift animate-fade-in" style={{ padding: '20px 30px', display: 'flex', flexDirection: 'column', height: '100%' }}>
            <h3 style={{ margin: '0 0 25px 0', borderBottom: '1px solid var(--glass-border)', paddingBottom: '15px', fontSize: '1.2rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Readiness Score Trend
                <Tooltip content={<div style={{ whiteSpace: 'normal', width: '220px', fontSize: '0.85rem', fontWeight: 'normal', color: '#fff' }}>Historical tracking of your Global Readiness Score over time, plotting the outcomes of past adversary simulations against your current baseline.</div>}>
                   <span style={{ cursor: 'help', color: 'var(--text-muted)', display: 'flex' }}><Info size={14} /></span>
                </Tooltip>
            </h3>
            <div style={{ flex: 1, minHeight: 0 }}>
                <div className="animate-reveal-right" style={{ width: '100%', height: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={areaData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
                            </linearGradient>
                            <filter id="glowArea" x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur stdDeviation="5" result="blur" />
                                <feComposite in="SourceGraphic" in2="blur" operator="over" />
                            </filter>
                        </defs>
                        <XAxis dataKey="name" stroke="rgba(255,255,255,0.2)" tick={{fill: 'var(--text-secondary)', fontSize: 12, fontWeight: 'bold'}} axisLine={false} tickLine={false} dy={10} />
                        <YAxis stroke="rgba(255,255,255,0.2)" tick={{fill: 'var(--text-secondary)', fontSize: 12, fontWeight: 'bold'}} axisLine={false} tickLine={false} />
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                        <RechartsTooltip 
                            contentStyle={{ backgroundColor: 'rgba(10,11,16,0.95)', border: '1px solid var(--warning)', borderRadius: '12px', boxShadow: '0 0 25px rgba(245,158,11,0.4)', backdropFilter: 'blur(16px)' }}
                            itemStyle={{ color: 'var(--warning)', fontWeight: 'bold' }}
                        />
                        <Area 
                            type="monotone" 
                            dataKey="score" 
                            stroke="var(--accent-primary)" 
                            strokeWidth={3} 
                            fillOpacity={1} 
                            fill="url(#colorRisk)" 
                            isAnimationActive={false} 
                            filter="url(#glowArea)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
                </div>
            </div>
         </div>

         {/* Top Security Controls */}
         <div className="glass-panel hover-lift animate-fade-in" style={{ padding: '20px 30px', display: 'flex', flexDirection: 'column', height: '100%', animationDelay: '0.1s' }}>
            <h3 style={{ margin: '0 0 25px 0', borderBottom: '1px solid var(--glass-border)', paddingBottom: '15px', fontSize: '1.2rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Top Security Controls
                <Tooltip content={<div style={{ whiteSpace: 'normal', width: '220px', fontSize: '0.85rem', fontWeight: 'normal', color: '#fff' }}>Performance metrics for your deployed security tools. Efficacy is calculated based on successful defenses against tested techniques.</div>}>
                   <span style={{ cursor: 'help', color: 'var(--text-muted)', display: 'flex' }}><Info size={14} /></span>
                </Tooltip>
            </h3>
            {topSecurityControls.length === 0 ? (
               <div style={{ padding: '20px', textAlign: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No security controls mapped yet.</p>
               </div>
            ) : (
               <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto', paddingRight: '5px' }}>
                 {topSecurityControls.map((ctrl, i) => {
                     const pct = ctrl.totalTTPs > 0 ? (ctrl.positiveOutcomes / ctrl.totalTTPs) : 0;
                     const heatColor = pct >= 0.75 ? 'var(--success)' : pct >= 0.4 ? 'var(--warning)' : 'var(--danger)';
                     const glowColor = pct >= 0.75 ? 'rgba(16, 185, 129, 0.2)' : pct >= 0.4 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)';
                     return (
                      <div 
                        key={i} 
                        className="hover-lift"
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', transition: 'all 0.2s' }}
                        onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                        onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                      >
                        <div style={{ flex: 1, marginRight: '15px' }}>
                          <strong style={{ color: 'var(--text-primary)', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Shield size={16} color={heatColor} />
                              {ctrl.name}
                          </strong>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                              {ctrl.positiveOutcomes} of {ctrl.totalTTPs} events triggered a defense
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                           <button 
                               onClick={() => { setActiveSecurityControlFilter(ctrl.name); navigate('/posture'); }}
                               style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '6px', padding: '6px 12px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.75rem', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px' }}
                               onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                               onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                           >
                               <Globe size={14} /> See in Heatmap
                           </button>
                           <div style={{ position: 'relative', width: '56px', height: '56px' }}>
                               <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)', filter: `drop-shadow(0 0 4px ${glowColor})` }}>
                                   <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                                   <circle cx="18" cy="18" r="16" fill="none" stroke={heatColor} strokeWidth="3" strokeDasharray="100.5" strokeDashoffset={isMounted ? (100.5 - (pct * 100.5)) : 100.5} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.16, 1, 0.3, 1), stroke 1s ease-out' }} />
                               </svg>
                               <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                                   {Math.round(pct * 100)}%
                               </div>
                           </div>
                         </div>
                      </div>
                  )})}
               </div>
            )}
         </div>
      </div>
    </div>
  );
}
