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
import { Activity, Target, ShieldAlert, Shield, ArrowRight, ArrowLeft, Info, Key, Terminal, Ghost, Network, Clock, ShieldCheck, Database, Globe, BrainCircuit, ChevronDown, FileDown, PlaneTakeoff } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { PDFDownloadLink } from '@react-pdf/renderer';
import UnifiedPosturePill from '../ui/UnifiedPosturePill';
import TagDropdown from '../dropdowns/TagDropdown';
import ExecutiveReportPDF from '../features/ExecutiveReportPDF';
import { calculateConfidenceAndDecay } from '../../lib/mitreUtils';

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

const PHASE_ICONS = {
  "Initial Access": Key,
  "Execution": Terminal,
  "Evasion": Ghost,
  "Movement": Network,
  "Action on Objective": Target
};

const KILL_CHAIN_PHASES = {
  "Initial Access": ["Initial Access"],
  "Execution": ["Execution", "Persistence", "Privilege Escalation"],
  "Evasion": ["Defense Evasion", "Defense Impairment", "Stealth"],
  "Movement": ["Discovery", "Lateral Movement", "Credential Access"],
  "Action on Objective": ["Collection", "Command and Control", "Exfiltration", "Impact"]
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

    const rawOutcomeField = typeof (ex?.outcome || ex?.finding || ex?.status) === 'string'
        ? (ex.outcome || ex.finding || ex.status)
        : '';
    const hasRetestArrow = rawOutcomeField.includes(' ➔ ') || rawOutcomeField.includes('->');
    const effectiveRawOutcome = hasRetestArrow
        ? rawOutcomeField.split(/ ➔ |->/).pop().trim()
        : rawOutcomeField.trim();

    if (hasRetestArrow && effectiveRawOutcome) {
        const r = effectiveRawOutcome.toLowerCase();
        if (r === 'high' || r.includes('prevented') || r.includes('alerted') || r.includes('resolved')) {
            outcome = 'Prevented';
            coverage = 'Optimal';
        } else if (r === 'minimal') {
            outcome = 'Logged';
            coverage = 'Minimal';
        } else if (r === 'medium' || r.includes('logged')) {
            outcome = 'Logged';
            coverage = 'Partial';
        } else if (r === 'low' || r.includes('missed') || r.includes('accepted')) {
            outcome = 'Missed';
            coverage = 'None';
        }
    } else if (ex?.coverageRating && ex.coverageRating !== 'N/A' && ex.coverageRating !== 'na') {
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
        if (effectiveRawOutcome) {
            const r = effectiveRawOutcome.toLowerCase();
            if (r === 'high' || r.includes('prevented') || r.includes('alerted') || r.includes('resolved')) outcome = 'Prevented';
            else if (r === 'minimal') {
                outcome = 'Logged';
                coverage = 'Minimal';
            } else if (r === 'medium' || r.includes('logged')) outcome = 'Logged';
            else if (r === 'low' || r.includes('missed') || r.includes('accepted')) outcome = 'Missed';
        }

        let rawCoverage = ex?.coverageRating || ex?.coverage;
        if (!coverage || coverage === 'Unknown') {
            coverage = rawCoverage;
        }
        if (!coverage || coverage === 'N/A' || coverage === 'na' || coverage === 'Unknown') {
            coverage = outcome === 'Prevented' ? 'Optimal' : outcome === 'Logged' ? 'Partial' : outcome === 'Missed' ? 'None' : 'Unknown';
        }
    }

    let exposure = null;
    if (coverage === 'Optimal') exposure = 0.0;
    else if (coverage === 'Partial') exposure = 0.5;
    else if (coverage === 'Minimal') exposure = 0.75;
    else if (coverage === 'None') exposure = 1.0;

    return { outcome, coverage, exposure };
};

const getPhaseRiskMeta = (risk, tested, subject) => {
    const eventLabel = tested === 1 ? 'tested event' : 'tested events';
    if (!tested || tested === 0) {
        return {
            color: 'var(--text-muted)',
            glow: 'rgba(255, 255, 255, 0.1)',
            statusText: 'UNTESTED / NO DATA',
            shortStatusText: 'UNTESTED',
            desc: `No empirical test data exists for ${subject}. Run simulations targeting this phase to establish a baseline.`
        };
    }
    if (risk >= 75) {
        return {
            color: '#ef4444',
            glow: 'rgba(239, 68, 68, 0.4)',
            statusText: 'Critical Risk',
            shortStatusText: 'Critical Risk',
            desc: `High exposure rate across the ${tested} ${eventLabel} in ${subject}. Significant defense gaps observed.`
        };
    }
    if (risk > 50) {
        return {
            color: '#f97316',
            glow: 'rgba(249, 115, 22, 0.4)',
            statusText: 'High Risk',
            shortStatusText: 'High Risk',
            desc: `Elevated exposure across the ${tested} ${eventLabel} in ${subject}. Frequent defense or alerting misses observed.`
        };
    }
    if (risk >= 30) {
        return {
            color: '#eab308',
            glow: 'rgba(234, 179, 8, 0.4)',
            statusText: 'Moderate Risk',
            shortStatusText: 'Moderate Risk',
            desc: `Moderate exposure across the ${tested} ${eventLabel} in ${subject}. Activity was partially logged without full alerting or prevention.`
        };
    }
    if (risk >= 10) {
        return {
            color: '#84cc16',
            glow: 'rgba(132, 204, 22, 0.35)',
            statusText: 'Low Risk',
            shortStatusText: 'Low Risk',
            desc: `Low exposure across the ${tested} ${eventLabel} in ${subject}. Defenses prevented or alerted on most activity.`
        };
    }
    if (risk > 0) {
        return {
            color: '#10b981',
            glow: 'rgba(16, 185, 129, 0.35)',
            statusText: 'Minimal Risk',
            shortStatusText: 'Minimal Risk',
            desc: `Minimal exposure across the ${tested} ${eventLabel} in ${subject}. Defenses were largely effective.`
        };
    }
    return {
        color: 'var(--success)',
        glow: 'rgba(16, 185, 129, 0.4)',
        statusText: 'SECURED',
        shortStatusText: 'SECURED',
        desc: `Defenses successfully prevented or alerted on all ${tested === 1 ? 'tested event' : `${tested} tested events`} in ${subject}.`
    };
};

const CustomTimeframeDropdown = ({ value, onChange }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const dropdownRef = React.useRef(null);
    const options = ['30 Days', '90 Days', '6 Months', '1 Year', 'Max'];

    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                style={{ 
                    display: 'flex', alignItems: 'center', gap: '8px', 
                    background: 'rgba(10, 11, 16, 0.6)', backdropFilter: 'blur(10px)',
                    border: isOpen ? '1px solid var(--accent-secondary)' : '1px solid rgba(255,255,255,0.1)', 
                    borderRadius: '8px', padding: '6px 12px', 
                    color: 'var(--text-primary)', cursor: 'pointer',
                    boxShadow: isOpen ? '0 0 10px rgba(236, 72, 153, 0.2)' : 'none',
                    transition: 'all 0.2s ease',
                    minWidth: '110px', justifyContent: 'space-between'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={14} color="var(--accent-secondary)" />
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{value}</span>
                </div>
                <ChevronDown size={14} color="var(--text-muted)" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
            </button>

            {isOpen && (
                <div className="animate-fade-in" style={{ 
                    position: 'absolute', top: 'calc(100% + 6px)', right: 0, 
                    background: 'rgba(15, 17, 26, 0.95)', backdropFilter: 'blur(16px)',
                    border: '1px solid var(--glass-border)', borderRadius: '8px',
                    padding: '6px', zIndex: 1000,
                    boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                    width: '100%', minWidth: '140px',
                    display: 'flex', flexDirection: 'column', gap: '2px'
                }}>
                    {options.map((opt) => {
                        const isActive = value === opt;
                        return (
                            <button
                                key={opt}
                                onClick={() => { onChange(opt); setIsOpen(false); }}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '8px',
                                    width: '100%', padding: '8px 10px',
                                    background: isActive ? 'rgba(236, 72, 153, 0.15)' : 'transparent',
                                    border: 'none', borderRadius: '6px',
                                    color: isActive ? 'var(--accent-secondary)' : 'var(--text-primary)',
                                    cursor: 'pointer', textAlign: 'left',
                                    fontSize: '0.85rem', fontWeight: isActive ? 'bold' : 'normal',
                                    transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                            >
                                <Clock size={14} color={isActive ? "var(--accent-secondary)" : "var(--text-muted)"} style={{ opacity: isActive ? 1 : 0.5 }} />
                                {opt}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default function Dashboard() {
  const { events: contextExercises, allEventsData, gaps: contextGaps, mitreData, dbAdapter, dbConfig, isDbLoading, aiSettings, setActiveAiContext, activeTagFilter, isAiActive, setActiveSecurityControlFilter, simulationSummaries } = useAppContext();
  const navigate = useNavigate();
  
  const [metrics, setMetrics] = React.useState({
      grsScore: 0,
      driftingCount: 0,
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
  const [driftingTTPs, setDriftingTTPs] = React.useState([]);
  const [openGapsList, setOpenGapsList] = React.useState([]);
  const [rightCardTab, setRightCardTab] = React.useState('controls');
  const [topTTPs, setTopTTPs] = React.useState([]);
  const [trendTimeframe, setTrendTimeframe] = React.useState('30 Days');
  const [isLoading, setIsLoading] = React.useState(true);
  const [activePhaseSubject, setActivePhaseSubject] = React.useState("Initial Access");
  const [expandedPhaseSubject, setExpandedPhaseSubject] = React.useState(null);
  const [isMounted, setIsMounted] = React.useState(false);
  const rightCardRef = React.useRef(null);

  React.useEffect(() => {
    setTimeout(() => setIsMounted(true), 150);
  }, []);

  React.useEffect(() => {
    setActiveAiContext({
        view: 'Global Dashboard',
        description: 'High-level overview of enterprise readiness, temporal control drift, open gaps, and recent adversary simulations.',
        metrics: {
            grsScore: metrics.grsScore,
            driftingCount: metrics.driftingCount,
            totalGaps: metrics.totalGaps,
            openGapsCount: metrics.openGapsCount,
            resolutionRate: metrics.resolutionRate,
            mitreCoveragePercentage: metrics.mitreCoveragePercentage
        },
        driftingWatchlist: driftingTTPs.slice(0, 10).map(t => ({ id: t.id, name: t.name, tactic: t.tactic, daysSinceLastTest: t.daysSinceLastTest, driftStatus: t.driftStatus })),
        recentActivity: topSecurityControls.map(c => c.name)
    });
    return () => setActiveAiContext(null);
  }, [setActiveAiContext, metrics, topSecurityControls, driftingTTPs]);

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
                   Object.entries(simulationSummaries).forEach(([simKey, sim]) => {
                       if (sim && sim.testResults && sim.testResults.length > 0) {
                           const simName = sim.details?.name || sim.name || simKey;
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
                                 const trTtpsArr = Array.isArray(tr.ttps) ? tr.ttps : trTtpStr.split(',').map(s => s.trim()).filter(Boolean);
                                 const isRetestedTr = Boolean(tr.validationDate || (typeof tr.outcome === 'string' && tr.outcome.includes(' ➔ ')));
                                 const trEffectiveDate = tr.date || sim.timestamp || sim.date || sim.created_at || (sim.details && sim.details.date) || '';

                                 // Check if static per-TTP exercise records already exist for this simulation
                                 const matchingStaticIndices = [];
                                 allExercises.forEach((ex, idx) => {
                                     if (!ex || !tr || ex.isSimEvent) return;
                                     const exTtpStr = getTtpString(ex);
                                     const isTtpMatch = trTtpsArr.some(t => t && exTtpStr.split(',').map(s => s.trim()).includes(t));
                                     const exEffectiveDate = ex.date || ex.created_at || '';
                                     const isSameSim = ex.simulation === simName || ex.simulation === sim.name || ex.simulation === sim.id || ex.simId === sim.id || !ex.simulation;
                                     if (isTtpMatch && normalizeDate(exEffectiveDate) === normalizeDate(trEffectiveDate) && isSameSim) {
                                         matchingStaticIndices.push(idx);
                                     }
                                 });

                                 if (matchingStaticIndices.length > 0) {
                                     // Only overwrite static per-TTP records when a validation re-test occurred
                                     if (isRetestedTr) {
                                         matchingStaticIndices.forEach(idx => {
                                             allExercises[idx] = {
                                                 ...allExercises[idx],
                                                 outcome: tr.outcome || allExercises[idx].outcome,
                                                 coverageRating: tr.coverageRating || allExercises[idx].coverageRating,
                                                 validationDate: tr.validationDate || allExercises[idx].validationDate,
                                             };
                                         });
                                     }
                                     return;
                                 }

                                 const existingSimEventIndex = allExercises.findIndex(ex => {
                                     if (!ex || !tr || !ex.isSimEvent) return false;
                                     if (tr.id && ex.id === tr.id) return true;
                                     return Boolean(ex.name && tr.name && ex.name === tr.name && (ex.simId === (sim.id || simName) || ex.simulation === simName));
                                 });

                                 if (existingSimEventIndex !== -1) {
                                     allExercises[existingSimEventIndex] = {
                                         ...allExercises[existingSimEventIndex],
                                         outcome: tr.outcome || allExercises[existingSimEventIndex].outcome,
                                         coverageRating: tr.coverageRating || allExercises[existingSimEventIndex].coverageRating,
                                         validationDate: tr.validationDate || allExercises[existingSimEventIndex].validationDate,
                                     };
                                     return;
                                 }
                                
                                 allExercises.push({
                                     ...tr,
                                     ttp: trTtpStr,
                                     simulation: simName,
                                     tags: Array.isArray(tr.tags) && tr.tags.length > 0 ? tr.tags : simTags,
                                     securityControls: Array.isArray(tr.securityControls) && tr.securityControls.length > 0 ? tr.securityControls : simControls,
                                     environment: Array.isArray(tr.environment) && tr.environment.length > 0 ? tr.environment : simEnvironment,
                                     isSimEvent: true,
                                     simId: sim.id || simName
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
               const outOfScopeTTPs = new Set();
               if (mitreData && Object.keys(mitreData).length > 0) {
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

               // Build per-TTP test count & latest execution timestamp (including sub-technique -> parent family rollup)
               const ttpStatsMap = new Map();
               const recordTtpStat = (id, exTime, exDate) => {
                   const prev = ttpStatsMap.get(id) || { count: 0, latestTime: 0, latestDate: null };
                   prev.count += 1;
                   if (exTime && !Number.isNaN(exTime) && exTime >= prev.latestTime) {
                       prev.latestTime = exTime;
                       prev.latestDate = exDate;
                   }
                   ttpStatsMap.set(id, prev);
               };

               allExercises.forEach(ex => {
                   if (!ex || ex.status === 'unknown' || ex.status === 'na' || !ex.ttp) return;
                   const exDate = ex.validationDate || ex.date || ex.created_at || null;
                   const exTime = exDate ? new Date(exDate).getTime() : 0;
                   const seenParentsInEx = new Set();
                   ex.ttp.split(',').forEach(rawId => {
                       const id = rawId.trim();
                       if (!id) return;
                       recordTtpStat(id, exTime, exDate);
                       if (id.includes('.')) {
                           const parentId = id.split('.')[0];
                           if (parentId && !seenParentsInEx.has(parentId)) {
                               seenParentsInEx.add(parentId);
                               recordTtpStat(parentId, exTime, exDate);
                           }
                       }
                   });
               });

               const getDecayForTtp = (ttpId, techObj = null) => {
                   const stat = ttpStatsMap.get(ttpId);
                   const count = stat?.count || techObj?.totalCount || 1;
                   const lastDate = stat?.latestDate || techObj?.lastTestedDate || null;
                   return calculateConfidenceAndDecay(count, lastDate, { status: techObj?.status });
               };

               // Calculate GRS accurately from rolled-up MITRE data AND active gaps
               let totalValidated = 0;
               let points = 0;
               let driftAdjustedPoints = 0;
               const processedTTPs = new Set();
               const watchlistMap = new Map();

                // Helper to get severity weight
                const getSeverityWeight = (severity) => {
                    if (severity === 'Critical') return 10;
                    if (severity === 'High') return 5;
                    if (severity === 'Medium') return 2;
                    if (severity === 'Low') return 1;
                    return 1;
                };

                // Group gaps by TTP to find the worst active severity per TTP
                const ttpActiveGaps = new Map();
                const ttpClosedGaps = new Map();
                
                allGaps.forEach(g => {
                    if (g.ttp) {
                        g.ttp.split(',').forEach(t => {
                            const ttpId = t.trim();
                            if (g.status === 'Open' || g.status === 'In Progress') {
                                if (!ttpActiveGaps.has(ttpId)) {
                                    ttpActiveGaps.set(ttpId, []);
                                }
                                ttpActiveGaps.get(ttpId).push(g);
                            } else if (g.status === 'Resolved' || g.status === 'Risk Accepted') {
                                if (!ttpClosedGaps.has(ttpId)) {
                                    ttpClosedGaps.set(ttpId, []);
                                }
                                ttpClosedGaps.get(ttpId).push(g);
                            }
                        });
                    }
                });
                
                // 1. Process TTPs with active gaps (weighted by severity)
                ttpActiveGaps.forEach((gaps, ttpId) => {
                    if (!processedTTPs.has(ttpId)) {
                        processedTTPs.add(ttpId);
                        
                        // Find the gap with the highest severity weight
                        let worstGap = gaps[0];
                        let maxWeight = getSeverityWeight(worstGap.severity);
                        
                        for (let i = 1; i < gaps.length; i++) {
                            const weight = getSeverityWeight(gaps[i].severity);
                            if (weight > maxWeight) {
                                maxWeight = weight;
                                worstGap = gaps[i];
                            }
                        }
                        
                        totalValidated += maxWeight;
                        
                        let basePoints = 0;
                        const posture = getNormalizedPosture(worstGap);
                        if (posture.coverage === 'Optimal') basePoints = 1.0;
                        else if (posture.coverage === 'Partial') basePoints = 0.5;
                        else if (posture.coverage === 'Minimal') basePoints = 0.25;
                        
                        const decayInfo = getDecayForTtp(ttpId);
                        points += (basePoints * maxWeight);
                        driftAdjustedPoints += (basePoints * maxWeight * (decayInfo.decayFactor || 1.0));
                    }
                });

                // 1.5. Process TTPs with closed gaps (standard weight of 1)
                ttpClosedGaps.forEach((gaps, ttpId) => {
                    if (!processedTTPs.has(ttpId)) {
                        processedTTPs.add(ttpId);
                        
                        // If any of the closed gaps is "Resolved", we give full credit
                        // If all are "Risk Accepted", we give 0 credit (prevents artificial inflation)
                        const isResolved = gaps.some(g => g.status === 'Resolved');
                        const latestResolvedDate = gaps.reduce((latest, g) => {
                            const d = g.resolvedDate || g.validationDate || g.createdDate;
                            return d && (!latest || new Date(d) > new Date(latest)) ? d : latest;
                        }, null);
                        const decayInfo = calculateConfidenceAndDecay(gaps.length, latestResolvedDate);
                        
                        totalValidated += 1; // Standard weight for resolved/accepted
                        if (isResolved) {
                            points += 1.0;
                            driftAdjustedPoints += (1.0 * (decayInfo.decayFactor || 1.0));
                        } else {
                            points += 0.0;
                        }
                    }
                });
                
               // 2. Add points from MITRE data for any validated TTPs that DO NOT have active gaps
               if (mitreData) {
                   for (const tactic in mitreData) {
                       if (tactic === 'Reconnaissance' || tactic === 'Resource Development') continue;
                       mitreData[tactic].techniques.forEach(tech => {
                           if (tech.status && tech.status !== 'unknown' && tech.status !== 'na' && tech.status !== 'pending') {
                               const decayInfo = tech.driftStatus ? tech : getDecayForTtp(tech.id, tech);
                               if (decayInfo.needsRetest || decayInfo.driftStatus === 'Decayed' || decayInfo.driftStatus === 'Aging') {
                                   watchlistMap.set(tech.id, {
                                       id: tech.id,
                                       name: tech.name,
                                       tactic,
                                       status: tech.status,
                                       daysSinceLastTest: decayInfo.daysSinceLastTest,
                                       driftStatus: decayInfo.driftStatus,
                                       confidenceLabel: decayInfo.confidenceLabel || 'Low',
                                       testCount: decayInfo.testCount || tech.totalCount || 1,
                                       effectiveStaleDays: decayInfo.effectiveStaleDays || 90,
                                       decayFactor: decayInfo.decayFactor ?? 1.0,
                                       needsRetest: Boolean(decayInfo.needsRetest)
                                   });
                               }
                               if (!processedTTPs.has(tech.id)) {
                                   totalValidated++;
                                   processedTTPs.add(tech.id);
                                   let base = 0;
                                   if (tech.status === 'high') base = 1.0;
                                   else if (tech.status === 'medium') base = 0.5;
                                   else if (tech.status === 'minimal') base = 0.25;
                                   points += base;
                                   driftAdjustedPoints += base * (decayInfo.decayFactor ?? 1.0);
                               }
                           }
                           
                           if (tech.subTechniques) {
                               tech.subTechniques.forEach(sub => {
                                   if (sub.status && sub.status !== 'unknown' && sub.status !== 'na' && sub.status !== 'pending') {
                                       const subDecay = sub.driftStatus ? sub : getDecayForTtp(sub.id, sub);
                                       if (subDecay.needsRetest || subDecay.driftStatus === 'Decayed' || subDecay.driftStatus === 'Aging') {
                                           watchlistMap.set(sub.id, {
                                               id: sub.id,
                                               name: sub.name,
                                               tactic,
                                               status: sub.status,
                                               daysSinceLastTest: subDecay.daysSinceLastTest,
                                               driftStatus: subDecay.driftStatus,
                                               confidenceLabel: subDecay.confidenceLabel || 'Low',
                                               testCount: subDecay.testCount || sub.totalCount || 1,
                                               effectiveStaleDays: subDecay.effectiveStaleDays || 90,
                                               decayFactor: subDecay.decayFactor ?? 1.0,
                                               needsRetest: Boolean(subDecay.needsRetest)
                                           });
                                       }
                                       if (!processedTTPs.has(sub.id)) {
                                           totalValidated++;
                                           processedTTPs.add(sub.id);
                                           let base = 0;
                                           if (sub.status === 'high') base = 1.0;
                                           else if (sub.status === 'medium') base = 0.5;
                                           else if (sub.status === 'minimal') base = 0.25;
                                           points += base;
                                           driftAdjustedPoints += base * (subDecay.decayFactor ?? 1.0);
                                       }
                                   }
                               });
                           }
                       });
                   }
               }
               
               const grsScore = totalValidated > 0 ? Math.round((driftAdjustedPoints / totalValidated) * 100) : 0;
               const sortedWatchlist = Array.from(watchlistMap.values()).sort((a, b) => {
                   if (a.needsRetest !== b.needsRetest) return a.needsRetest ? -1 : 1;
                   return (b.daysSinceLastTest || 0) - (a.daysSinceLastTest || 0);
               });
               const driftingCount = sortedWatchlist.filter(item => item.needsRetest).length;
               
               const applicableGaps = allGaps.filter(g => g.status !== 'Risk Accepted');
               const totalGaps = applicableGaps.length;
               const open = allGaps.filter(g => g.status === 'Open' || g.status === 'In Progress');
               const openGapsCount = open.length;
               const closedGaps = totalGaps - openGapsCount;
               const resolutionRate = totalGaps === 0 ? 100 : Math.round((closedGaps / totalGaps) * 100);

               const severityWeights = { 'Critical': 10, 'High': 7, 'Medium': 3, 'Low': 1 };
               const residualRisk = open.reduce((acc, g) => acc + (severityWeights[g.severity] || 0), 0);
               const sortedOpenGaps = [...open].sort((a, b) => (severityWeights[b.severity] || 0) - (severityWeights[a.severity] || 0));
               
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
               
               // Build unified Kill Chain Exposure & Drilldown Event model
               const doesTtpMatchTactics = (ttp, tacticsList) => {
                   if (!mitreData || !ttp) return false;
                   const cleanTtp = ttp.trim();
                   const parentTtp = cleanTtp.includes('.') ? cleanTtp.split('.')[0] : null;
                   return tacticsList.some(tacticName => {
                       const tacticObj = mitreData[tacticName];
                       if (!tacticObj || !Array.isArray(tacticObj.techniques)) return false;
                       return tacticObj.techniques.some(tech =>
                           tech.id === cleanTtp ||
                           (parentTtp && tech.id === parentTtp) ||
                           (Array.isArray(tech.subTechniques) && tech.subTechniques.some(sub => sub.id === cleanTtp))
                       );
                   });
               };

               const killChainEvents = [];
               const coveredSimulations = new Set();

               if (simulationSummaries) {
                   Object.entries(simulationSummaries).forEach(([simKey, sim]) => {
                       if (!sim || !Array.isArray(sim.testResults) || sim.testResults.length === 0) return;
                       const simName = sim.details?.name || sim.name || simKey;
                       const simTags = sim.details?.tags || [];

                       if (activeTagFilter !== 'All') {
                           const simTagMatch = Array.isArray(simTags) ? simTags.includes(activeTagFilter) : simTags === activeTagFilter;
                           if (!simTagMatch) {
                               const anyEvtTagMatch = sim.testResults.some(evt =>
                                   Array.isArray(evt?.tags) ? evt.tags.includes(activeTagFilter) : evt?.tags === activeTagFilter
                               );
                               if (!anyEvtTagMatch) return;
                           }
                       }

                       coveredSimulations.add(simName);
                       coveredSimulations.add(simKey);
                       if (sim.id) coveredSimulations.add(sim.id);

                       sim.testResults.forEach(evt => {
                           if (!evt) return;
                           const evtTags = Array.isArray(evt.tags) && evt.tags.length > 0 ? evt.tags : simTags;
                           if (activeTagFilter !== 'All') {
                               const tagMatches = Array.isArray(evtTags) ? evtTags.includes(activeTagFilter) : evtTags === activeTagFilter;
                               if (!tagMatches) return;
                           }

                           const rawTtps = Array.isArray(evt.ttps)
                               ? evt.ttps
                               : (typeof evt.ttp === 'string' ? evt.ttp.split(',').map(t => t.trim()) : []);
                           const validTtps = rawTtps.map(t => t.trim()).filter(t => t && !outOfScopeTTPs.has(t));
                           if (validTtps.length === 0) return;

                           const rawOutcome = (evt.outcome || '').trim();
                           const lowerOutcome = rawOutcome.toLowerCase();
                           if (lowerOutcome === 'n/a' || lowerOutcome === 'na' || lowerOutcome === 'error' || lowerOutcome === 'pending' || evt.coverageRating === 'N/A') {
                               return;
                           }

                           // Synchronize with any matching gap status updates (e.g., Resolved or Risk Accepted or Re-Tested)
                           const ttpStr = validTtps.join(', ');
                           const matchingGap = allGaps.find(g =>
                               (g.simulation === simName || g.simulation === simKey) &&
                               ((evt.name && g.finding === evt.name) || g.ttp === ttpStr)
                           );

                           let effectiveOutcome = rawOutcome || 'Unknown';
                           let effectiveCoverage = evt.coverageRating;

                           if (matchingGap) {
                               if (typeof matchingGap.outcome === 'string' && (matchingGap.outcome.includes(' ➔ ') || matchingGap.outcome.includes('->'))) {
                                   effectiveOutcome = matchingGap.outcome;
                                   effectiveCoverage = matchingGap.coverageRating || effectiveCoverage;
                               } else if (matchingGap.status === 'Resolved') {
                                   const currentPosture = getNormalizedPosture({ outcome: effectiveOutcome, coverageRating: effectiveCoverage });
                                   if (currentPosture.coverage !== 'Optimal') {
                                       effectiveOutcome = effectiveOutcome && !effectiveOutcome.includes('➔')
                                           ? `${effectiveOutcome} ➔ Resolved`
                                           : (matchingGap.outcome || 'Resolved');
                                   }
                                   effectiveCoverage = 'Optimal';
                               } else if (matchingGap.status === 'Risk Accepted') {
                                   effectiveOutcome = 'Risk Accepted';
                                   effectiveCoverage = 'None';
                               }
                           }

                           const posture = getNormalizedPosture({
                               ...evt,
                               outcome: effectiveOutcome,
                               coverageRating: effectiveCoverage
                           });
                           if (posture.exposure === null) return;

                           killChainEvents.push({
                               ...evt,
                               name: evt.name || 'Simulated Event',
                               ttps: validTtps,
                               outcome: effectiveOutcome,
                               coverageRating: posture.coverage,
                               exposure: posture.exposure,
                               simulationName: simName
                           });
                       });
                   });
               }

               // Include standalone/historical exercises whose simulation is not already represented in simulationSummaries
               allExercises.forEach(ex => {
                   if (!ex || ex.isSimEvent || ex.status === 'unknown' || ex.status === 'na' || ex.coverageRating === 'N/A' || !ex.ttp) return;
                   const simKey = ex.simulation || ex.simId || '';
                   if (simKey && coveredSimulations.has(simKey)) return;

                   const validTtps = ex.ttp.split(',').map(t => t.trim()).filter(t => t && !outOfScopeTTPs.has(t));
                   if (validTtps.length === 0) return;

                   const posture = getNormalizedPosture(ex);
                   if (posture.exposure === null) return;

                   killChainEvents.push({
                       id: ex.id,
                       name: ex.name || ex.finding || `${validTtps[0]} Validation`,
                       ttps: validTtps,
                       outcome: ex.outcome || posture.outcome,
                       coverageRating: posture.coverage,
                       exposure: posture.exposure,
                       simulationName: simKey || 'Historical Validation'
                   });
               });

               const radarData = Object.entries(KILL_CHAIN_PHASES).map(([phase, tactics]) => {
                   const phaseEvents = killChainEvents.filter(evt =>
                       evt.ttps.some(ttp => doesTtpMatchTactics(ttp, tactics))
                   );
                   const testedTechniquesSet = new Set();
                   phaseEvents.forEach(evt => {
                       evt.ttps.forEach(ttp => {
                           if (doesTtpMatchTactics(ttp, tactics)) {
                               testedTechniquesSet.add(ttp);
                           }
                       });
                   });
                   const testedCount = phaseEvents.length;
                   const totalExposure = phaseEvents.reduce((sum, evt) => sum + (evt.exposure ?? 0), 0);
                   const riskScore = testedCount > 0 ? Math.round((totalExposure / testedCount) * 100) : 0;

                   return {
                       subject: phase,
                       risk: riskScore,
                       tested: testedCount,
                       testedTechniques: testedTechniquesSet.size,
                       events: phaseEvents,
                       fullMark: 100
                   };
               });

               const trendEvents = [];
               allExercises.forEach(ex => {
                   if (ex.status?.toLowerCase() === 'na' || ex.coverageRating === 'N/A') return;
                   
                   if (ex.outcome && ex.outcome.includes(' ➔ ')) {
                       const [originalOutcome, newOutcome] = ex.outcome.split(' ➔ ');
                       let origCoverage = 'None';
                       const lowerOrig = originalOutcome.toLowerCase().trim();
                       if (lowerOrig === 'logged') origCoverage = 'Partial';
                       else if (lowerOrig.includes('prevented') || lowerOrig.includes('alerted')) origCoverage = 'Optimal';
                       else if (lowerOrig === 'missed') origCoverage = 'None';
                       
                       trendEvents.push({
                           ...ex,
                           coverageRating: origCoverage,
                           outcome: originalOutcome.trim()
                       });
                       
                       trendEvents.push({
                           ...ex,
                           date: ex.validationDate || ex.date,
                           simulation: `${ex.simulation} (Re-Test)`,
                           outcome: newOutcome.trim(),
                           isRetest: true
                       });
                   } else {
                       trendEvents.push(ex);
                   }
               });

               const safeDate = (dateStr) => {
                   const d = new Date(dateStr);
                   return isNaN(d.getTime()) ? new Date() : d;
               };

               const eventsByDate = {};
               trendEvents.forEach(ex => {
                   let calcStatus = 'unknown';
                   if (ex.coverageRating && ex.coverageRating !== 'N/A') {
                       calcStatus = ex.coverageRating === 'Optimal' ? 'high' : ex.coverageRating === 'Partial' ? 'medium' : ex.coverageRating === 'Minimal' ? 'minimal' : ex.coverageRating === 'None' ? 'low' : 'unknown';
                   } else if (ex.status && ex.status.toLowerCase() !== 'completed') {
                       calcStatus = ex.status;
                   }

                   const d = safeDate(ex.date || new Date().toISOString());
                   const dateKey = d.toLocaleDateString('default', { month: 'short', day: 'numeric' });

                   if (!eventsByDate[dateKey]) eventsByDate[dateKey] = { date: d, high: 0, medium: 0, minimal: 0, total: 0 };
                   eventsByDate[dateKey].total += 1;
                   if (calcStatus === 'high') eventsByDate[dateKey].high += 1;
                   if (calcStatus === 'medium') eventsByDate[dateKey].medium += 1;
                   if (calcStatus === 'minimal') eventsByDate[dateKey].minimal += 1;
               });

               const cutoffDate = new Date();
               if (trendTimeframe === '30 Days') cutoffDate.setDate(cutoffDate.getDate() - 30);
               else if (trendTimeframe === '90 Days') cutoffDate.setDate(cutoffDate.getDate() - 90);
               else if (trendTimeframe === '6 Months') cutoffDate.setMonth(cutoffDate.getMonth() - 6);
               else if (trendTimeframe === '1 Year') cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
               else if (trendTimeframe === 'Max') cutoffDate.setFullYear(2000);
               
               const historicalScores = Object.values(eventsByDate)
                   .filter(c => c.date >= cutoffDate)
                   .sort((a,b) => a.date - b.date)
                   .map(c => {
                       const score = Math.round(((c.high + (c.medium * 0.5) + (c.minimal * 0.25)) / c.total) * 100);
                       return {
                           name: c.date.toLocaleDateString('default', { month: 'short', day: 'numeric' }),
                           score: score
                       };
                   });
               
               const currentDate = new Date().toLocaleString('default', { month: 'short', day: 'numeric' });
               const startDateName = trendTimeframe === 'Max' ? 'Baseline' : cutoffDate.toLocaleDateString('default', { month: 'short', day: 'numeric' });

               let areaData = historicalScores;
               if (areaData.length === 0) {
                   areaData = [
                       { name: startDateName, score: grsScore },
                       { name: currentDate, score: grsScore },
                   ];
               } else if (areaData.length === 1) {
                   areaData = [
                       { name: startDateName, score: areaData[0].score },
                       ...areaData
                   ];
               } else {
                   if (areaData[0].name !== startDateName) {
                       areaData = [
                           { name: startDateName, score: areaData[0].score },
                           ...areaData
                       ];
                   }
               }
               
               // Ensure the latest node on the trend graph explicitly matches the current true GRS
               if (areaData.length > 0) {
                   if (areaData[areaData.length - 1].name !== currentDate) {
                       areaData.push({ name: currentDate, score: grsScore });
                   } else {
                       areaData[areaData.length - 1].score = grsScore;
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

               setDriftingTTPs(sortedWatchlist);
               setOpenGapsList(sortedOpenGaps);

               setMetrics({
                   grsScore,
                   driftingCount,
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
   }, [dbAdapter, allEventsData, contextGaps, mitreData, activeTagFilter, trendTimeframe, simulationSummaries]);

  React.useEffect(() => {
      loadDashboardData();
  }, [loadDashboardData]);

  const {
      grsScore,
      driftingCount,
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
            <PDFDownloadLink
              document={
                <ExecutiveReportPDF
                  metrics={metrics}
                  driftingTTPs={driftingTTPs}
                  openGaps={openGapsList}
                  topSecurityControls={topSecurityControls}
                  activeTagFilter={activeTagFilter}
                />
              }
              fileName={`Control_Drift_Executive_Posture_${new Date().toISOString().split('T')[0]}.pdf`}
              style={{ textDecoration: 'none' }}
            >
              {({ loading }) => (
                <button
                  className="btn hover-lift"
                  title="Download a CISO-ready Executive Security Posture PDF report"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    background: 'rgba(139, 92, 246, 0.15)',
                    border: '1px solid rgba(139, 92, 246, 0.45)',
                    borderRadius: '24px',
                    color: '#c4b5fd',
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    boxShadow: '0 0 12px rgba(139, 92, 246, 0.2)'
                  }}
                >
                  <FileDown size={16} />
                  <span>{loading ? 'Preparing PDF...' : 'Export Executive PDF'}</span>
                </button>
              )}
            </PDFDownloadLink>
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
                  <Tooltip content={<div style={{ whiteSpace: 'normal', width: '270px', fontSize: '0.85rem', fontWeight: 'normal', letterSpacing: 'normal' }}>Unified enterprise readiness metric combining simulation coverage outcomes, active gap severity weighting, procedural test depth, and TTP validation decay.</div>}>
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
                  <div
                      onClick={() => {
                          setRightCardTab('drift');
                          rightCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                      }}
                      className="hover-lift"
                      title="Click to inspect the TTP Decay Watchlist"
                      style={{
                          background: driftingCount > 0 ? 'rgba(245, 158, 11, 0.08)' : 'rgba(16, 185, 129, 0.05)',
                          border: driftingCount > 0 ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(16, 185, 129, 0.25)',
                          borderRadius: '12px',
                          padding: '15px 25px',
                          textAlign: 'center',
                          cursor: 'pointer',
                          boxShadow: driftingCount > 0 ? 'inset 0 0 20px rgba(245, 158, 11, 0.08)' : 'inset 0 0 20px rgba(16, 185, 129, 0.05)'
                      }}
                  >
                      <div style={{ fontSize: '0.75rem', color: driftingCount > 0 ? '#fbbf24' : '#10b981', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '8px', opacity: 0.9, fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <Clock size={12} /> Decayed TTPs
                          <Tooltip content={<div style={{ whiteSpace: 'normal', width: '230px', fontSize: '0.85rem', color: '#fff', textTransform: 'none', letterSpacing: 'normal', fontWeight: 'normal' }}>Validated techniques whose freshness lifespan has decayed and need re-testing. Click to open the Watchlist.</div>}>
                             <span style={{ cursor: 'help', color: driftingCount > 0 ? '#fbbf24' : '#10b981', display: 'flex' }}><Info size={12} /></span>
                          </Tooltip>
                      </div>
                      <div style={{ fontSize: '2.2rem', fontWeight: '900', color: driftingCount > 0 ? '#fbbf24' : '#10b981', fontFamily: 'monospace', lineHeight: 1, textShadow: driftingCount > 0 ? '0 0 15px rgba(245, 158, 11, 0.4)' : 'none' }}>{driftingCount}</div>
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
                                {radarData && radarData.map((phase) => {
                                    const isActive = activePhaseSubject === phase.subject;
                                    const IconComponent = PHASE_ICONS[phase.subject] || Target;
                                    const { color, glow } = getPhaseRiskMeta(phase.risk, phase.tested, phase.subject);
                                    
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
                                const { color, statusText, desc } = getPhaseRiskMeta(risk, tested, activeData.subject);

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
                    const { color, shortStatusText: statusText } = getPhaseRiskMeta(risk, tested, expandedPhaseSubject);
                    const relevantEvents = Array.isArray(activeData.events) ? activeData.events : [];

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
                                        const effectiveOutcome = (actualOutcome.includes(' ➔ ') || actualOutcome.includes('->'))
                                            ? actualOutcome.split(/ ➔ |->/).pop().trim()
                                            : actualOutcome;
                                        const lowerOutcome = effectiveOutcome.toLowerCase();

                                        let outcomeStyle = { color: 'var(--text-primary)', bg: 'rgba(255,255,255,0.1)', border: 'rgba(255,255,255,0.2)' };
                                        
                                        if (lowerOutcome.includes('prevented & alerted') || (lowerOutcome.includes('prevented') && lowerOutcome.includes('alerted')) || lowerOutcome.includes('resolved')) {
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
                                                gap: '12px',
                                                transition: 'all 0.2s ease',
                                                cursor: 'pointer'
                                            }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <Shield size={14} color={outcomeStyle.color} style={{ flexShrink: 0 }} />
                                                        <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.3px' }}>
                                                            {eventName}
                                                        </span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'monospace' }}>
                                                            <Target size={12} style={{ flexShrink: 0 }} /> {ttps}
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
                                                    whiteSpace: 'nowrap',
                                                    textAlign: 'center',
                                                    flexShrink: 0,
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
            <h3 style={{ margin: '0 0 25px 0', borderBottom: '1px solid var(--glass-border)', paddingBottom: '15px', fontSize: '1.2rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Readiness Score Trend
                    <Tooltip content={<div style={{ whiteSpace: 'normal', width: '220px', fontSize: '0.85rem', fontWeight: 'normal', color: '#fff' }}>Historical tracking of your Global Readiness Score over time, plotting the outcomes of past adversary simulations against your current baseline.</div>}>
                       <span style={{ cursor: 'help', color: 'var(--text-muted)', display: 'flex' }}><Info size={14} /></span>
                    </Tooltip>
                </div>
                <CustomTimeframeDropdown value={trendTimeframe} onChange={setTrendTimeframe} />
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

         {/* Top Security Controls / TTP Decay Watchlist (Tabbed to preserve 3-column symmetry) */}
         <div ref={rightCardRef} className="glass-panel hover-lift animate-fade-in" style={{ padding: '20px 30px', display: 'flex', flexDirection: 'column', height: '100%', animationDelay: '0.1s' }}>
            <div style={{ margin: '0 0 20px 0', borderBottom: '1px solid var(--glass-border)', paddingBottom: '15px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {rightCardTab === 'controls' ? 'Top Security Controls' : 'TTP Decay Watchlist'}
                    </h3>
                    <Tooltip content={<div style={{ whiteSpace: 'normal', width: '220px', fontSize: '0.85rem', fontWeight: 'normal', color: '#fff' }}>
                        {rightCardTab === 'controls'
                            ? 'Performance metrics for your deployed security tools. Efficacy is calculated based on successful defenses against tested techniques.'
                            : 'Techniques whose validation freshness is Aging or Decayed based on their Depth lifespan cycle. Click Re-Test to launch an evolved validation campaign.'}
                    </div>}>
                       <span style={{ cursor: 'help', color: 'var(--text-muted)', display: 'flex' }}><Info size={14} /></span>
                    </Tooltip>
                </div>

                {/* Segmented Tab Switcher + Batch Re-Test */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {rightCardTab === 'drift' && driftingTTPs.length > 0 && (
                        <button
                            onClick={() => navigate('/simulation', {
                                state: {
                                    batchRetestTTPs: driftingTTPs.map(item => ({
                                        id: item.id,
                                        name: item.name,
                                        tactic: item.tactic,
                                        daysSinceLastTest: item.daysSinceLastTest,
                                        driftStatus: item.driftStatus
                                    }))
                                }
                            })}
                            title="Launch a Chained Evolution Re-Test campaign for all decayed/aging TTPs"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '5px 10px',
                                borderRadius: '7px',
                                fontSize: '0.73rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                background: 'rgba(245, 158, 11, 0.18)',
                                border: '1px solid rgba(245, 158, 11, 0.45)',
                                color: '#fbbf24',
                                transition: 'all 0.2s'
                            }}
                        >
                            <PlaneTakeoff size={12} />
                            <span>Re-Test All ({driftingTTPs.length})</span>
                        </button>
                    )}

                    <div style={{ display: 'flex', background: 'rgba(0,0,0,0.35)', padding: '3px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                        <button
                            onClick={() => setRightCardTab('controls')}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, transition: 'all 0.2s',
                                background: rightCardTab === 'controls' ? 'rgba(139, 92, 246, 0.22)' : 'transparent',
                                color: rightCardTab === 'controls' ? '#c4b5fd' : 'var(--text-muted)'
                            }}
                        >
                            <Shield size={12} />
                            <span>Controls</span>
                        </button>
                        <button
                            onClick={() => setRightCardTab('drift')}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, transition: 'all 0.2s',
                                background: rightCardTab === 'drift' ? 'rgba(245, 158, 11, 0.22)' : 'transparent',
                                color: rightCardTab === 'drift' ? '#fbbf24' : 'var(--text-muted)'
                            }}
                        >
                            <Clock size={12} />
                            <span>Decayed ({driftingTTPs.length})</span>
                        </button>
                    </div>
                </div>
            </div>

            {rightCardTab === 'controls' ? (
                topSecurityControls.length === 0 ? (
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
                )
            ) : (
                driftingTTPs.length === 0 ? (
                   <div style={{ padding: '30px 20px', textAlign: 'center', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '12px' }}>
                      <ShieldCheck size={28} color="#10b981" style={{ marginBottom: '8px' }} />
                      <p style={{ color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: 600, margin: '0 0 4px 0' }}>No Decayed TTPs</p>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>All validated techniques are within their active freshness window.</p>
                   </div>
                ) : (
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto', paddingRight: '5px' }}>
                     {driftingTTPs.map((item) => {
                         const isDrifting = item.needsRetest || item.driftStatus === 'Decayed';
                         const accent = isDrifting ? '#f59e0b' : '#eab308';
                         return (
                             <div
                               key={item.id}
                               className="hover-lift"
                               style={{
                                   display: 'flex',
                                   justifyContent: 'space-between',
                                   alignItems: 'center',
                                   gap: '12px',
                                   padding: '12px 15px',
                                   background: 'rgba(255,255,255,0.03)',
                                   borderRadius: '8px',
                                   border: '1px solid rgba(255,255,255,0.05)',
                                   borderLeft: `3px solid ${accent}`
                               }}
                             >
                               <div style={{ flex: 1, minWidth: 0 }}>
                                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                   <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#fff', fontSize: '0.9rem' }}>{item.id}</span>
                                   <span style={{
                                       fontSize: '0.68rem',
                                       fontWeight: 700,
                                       padding: '2px 7px',
                                       borderRadius: '4px',
                                       background: isDrifting ? 'rgba(245, 158, 11, 0.16)' : 'rgba(234, 179, 8, 0.12)',
                                       border: `1px solid ${accent}55`,
                                       color: isDrifting ? '#fbbf24' : '#fde047',
                                       display: 'inline-flex',
                                       alignItems: 'center',
                                       gap: '4px'
                                   }}>
                                     <Clock size={10} />
                                     {item.driftStatus} • {item.daysSinceLastTest}d ago
                                   </span>
                                 </div>
                                 <div style={{ color: 'var(--text-primary)', fontSize: '0.88rem', fontWeight: 500, marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                   {item.name}
                                 </div>
                                 <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem', marginTop: '2px' }}>
                                   {item.tactic} • Depth: {item.confidenceLabel || 'Low'} ({item.testCount || 1}) • Retention: {Math.round((item.decayFactor || 1) * 100)}%
                                 </div>
                               </div>

                               <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                 <button
                                   onClick={() => navigate('/posture', { state: { returnToTTP: item.id, returnToTactic: item.tactic } })}
                                   title="Inspect technique on the 3D MITRE Heat Globe"
                                   style={{
                                       background: 'rgba(255,255,255,0.05)',
                                       border: '1px solid var(--glass-border)',
                                       borderRadius: '6px',
                                       padding: '6px 9px',
                                       color: 'var(--text-secondary)',
                                       cursor: 'pointer',
                                       display: 'flex',
                                       alignItems: 'center'
                                   }}
                                 >
                                   <Globe size={13} />
                                 </button>
                                 <button
                                   onClick={() => navigate('/simulation', {
                                       state: {
                                           retestTTP: {
                                               id: item.id,
                                               name: item.name,
                                               tactic: item.tactic,
                                               daysSinceLastTest: item.daysSinceLastTest,
                                               driftStatus: item.driftStatus
                                           }
                                       }
                                   })}
                                   title="Re-test this decayed TTP in the Simulation Launcher"
                                   style={{
                                       display: 'flex',
                                       alignItems: 'center',
                                       gap: '5px',
                                       padding: '6px 10px',
                                       borderRadius: '6px',
                                       fontSize: '0.74rem',
                                       fontWeight: 700,
                                       cursor: 'pointer',
                                       background: 'rgba(245, 158, 11, 0.16)',
                                       border: '1px solid rgba(245, 158, 11, 0.45)',
                                       color: '#fbbf24'
                                   }}
                                 >
                                   <PlaneTakeoff size={12} />
                                   <span>Re-Test</span>
                                 </button>
                               </div>
                             </div>
                         );
                     })}
                   </div>
                )
            )}
         </div>
      </div>
    </div>
  );
}
