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
import { Target, RotateCcw, Ban, X, Shield, ShieldAlert, ShieldCheck, Info, EyeOff, ArrowRight } from 'lucide-react';

export default function TacticDrilldown({
  activeInfo,
  activeTactic,
  setActiveTactic,
  TACTIC_ICONS,
  statusColors,
  toggleTacticScope,
  exercisesByTtp,
  simulationSummaries,
  searchTerm,
  handleTechClick,
  toggleDescope
}) {
  if (!activeInfo) return null;

  const outcomes = { 
      preventedNoAlert: 0, 
      alerted: 0, 
      preventedAlerted: 0, 
      logged: 0, 
      missed: 0 
  };
  
  if (activeInfo.hasTests) {
      activeInfo.techniques.forEach(tech => {
          if (tech.status === 'na') return;
          const history = tech.history || exercisesByTtp[tech.id] || [];
          history.forEach(e => {
              const simName = e.simulation;
              const simSummary = simulationSummaries[simName];
              let countedFromRaw = false;
              
              if (simSummary && Array.isArray(simSummary.testResults) && simSummary.testResults.length > 0) {
                  const ttpProcs = simSummary.testResults.filter(p => p && Array.isArray(p.ttps) && p.ttps.includes(tech.id));
                  if (ttpProcs.length > 0) {
                      ttpProcs.forEach(p => {
                          let out = typeof p?.outcome === 'string' ? p.outcome : String(p?.outcome || '');
                          if (out && out.includes(' ➔ ')) out = out.split(' ➔ ')[1] || '';
                          if (out) out = out.replace(' ✓', '').trim();
                          
                          if (!out) return;
                          if (out === 'Prevented & Alerted') outcomes.preventedAlerted++;
                          else if (out === 'Prevented') outcomes.preventedNoAlert++;
                          else if (out === 'Alerted' || out === 'Detected') outcomes.alerted++;
                          else if (out === 'Logged') outcomes.logged++;
                          else if (out === 'Missed') outcomes.missed++;
                      });
                      countedFromRaw = true;
                  }
              }
              
              if (!countedFromRaw && e) {
                 let out = typeof e.outcome === 'string' ? e.outcome : typeof e.finding === 'string' ? e.finding : String(e.outcome || e.finding || '');
                 if (out && out.includes(' ➔ ')) out = out.split(' ➔ ')[1] || '';
                 if (out) out = out.replace(' ✓', '').trim();
                 
                 if (!out && e.status) {
                     if (e.status === 'high') outcomes.preventedNoAlert++;
                     else if (e.status === 'medium' || e.status === 'minimal') outcomes.logged++;
                     else if (e.status === 'low') outcomes.missed++;
                     return;
                 }
                 
                 if (!out) return;
                 if (out === 'Prevented & Alerted') outcomes.preventedAlerted++;
                 else if (out === 'Prevented') outcomes.preventedNoAlert++;
                 else if (out === 'Alerted' || out === 'Detected') outcomes.alerted++;
                 else if (out === 'Logged') outcomes.logged++;
                 else if (out === 'Missed') outcomes.missed++;
              }
          });
      });
  }

  const Pill = ({ icon: Icon, count, label, color, bg, border }) => {
      const active = count > 0;
      return (
          <span style={{ 
              display: 'inline-flex', alignItems: 'center', gap: '5px', 
              fontSize: '0.7rem', fontWeight: 'bold', 
              background: active ? bg : 'rgba(255,255,255,0.02)', 
              color: active ? color : 'var(--text-muted)', 
              padding: '4px 10px', borderRadius: '20px', 
              border: active ? border : '1px solid rgba(255,255,255,0.05)', 
              boxShadow: active ? `0 2px 10px ${bg}` : 'none', 
              textShadow: active ? `0 0 10px ${bg}` : 'none',
              opacity: active ? 1 : 0.4,
              width: 'max-content'
          }}>
              <Icon size={12} strokeWidth={2.5} /> {count} {label}
          </span>
      );
  };

  const filteredTechs = activeInfo.techniques.filter(tech => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return tech.id.toLowerCase().includes(term) || tech.name.toLowerCase().includes(term);
  });

  return (
    <div className="glass-panel animate-fade-in tactic-details-panel">
       <div className="tactic-details-panel-header">
         <div>
            <div style={{  display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px'  }}>
                <div style={{  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center'  }}>
                   {React.createElement(TACTIC_ICONS[activeTactic] || Target, { size: 18, color: statusColors[activeInfo?.status] || "var(--accent-primary)" })}
                </div>
                <h3 style={{  margin: 0, color: 'var(--text-primary)', fontSize: '1.2rem', letterSpacing: '0.5px'  }}>{activeTactic}</h3>
             </div>
          </div>
          <div style={{  display: 'flex', alignItems: 'center', gap: '8px'  }}>
             <button 
               onClick={() => toggleTacticScope(activeTactic)} 
               title={activeInfo.status === 'na' ? "Re-scope entire category" : "De-scope entire category"}
               style={{  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: activeInfo.status === 'na' ? 'var(--accent-secondary)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '6px', transition: 'all 0.2s'  }}
               onMouseOver={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
               onMouseOut={e => { e.currentTarget.style.color = activeInfo.status === 'na' ? 'var(--accent-secondary)' : 'var(--text-muted)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
             >
               {activeInfo.status === 'na' ? <RotateCcw size={16} /> : <Ban size={16} />}
             </button>
             <button onClick={() => setActiveTactic(null)} style={{  background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '6px', transition: 'all 0.2s'  }} onMouseOver={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'} onMouseOut={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}>
               <X size={16} />
             </button>
          </div>
        </div>

        <div className="tactic-details-panel-status">
          <div style={{  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: '600', letterSpacing: '0.5px', textTransform: 'uppercase', background: 'rgba(255,255,255,0.03)', padding: '6px 12px', borderRadius: '6px', border: `1px solid ${statusColors[activeInfo.status] || '#fff'}40`, color: statusColors[activeInfo.status] || '#fff', height: '32px'  }}>
            {activeInfo.status === 'unknown' ? 'Untested' : activeInfo.status === 'high' ? 'Optimal Coverage' : activeInfo.status === 'medium' ? 'Partial Coverage' : activeInfo.status === 'minimal' ? 'Minimal Coverage' : activeInfo.status === 'low' ? 'No Coverage' : activeInfo.status}
          </div>

          {activeInfo.hasTests && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '15px', padding: '15px 20px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <Pill icon={Shield} count={outcomes.preventedNoAlert} label="Prevented" color="var(--accent-secondary)" bg="rgba(0, 188, 212, 0.12)" border="1px solid rgba(0, 188, 212, 0.25)" />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Pill icon={ShieldAlert} count={outcomes.alerted} label="Alerted" color="#3b82f6" bg="rgba(59, 130, 246, 0.12)" border="1px solid rgba(59, 130, 246, 0.25)" />
                </div>
                
                <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center' }}>
                    <Pill icon={ShieldCheck} count={outcomes.preventedAlerted} label="Prevented & Alerted" color="var(--success)" bg="rgba(16, 185, 129, 0.12)" border="1px solid rgba(16, 185, 129, 0.25)" />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <Pill icon={Info} count={outcomes.logged} label="Logged" color="var(--warning)" bg="rgba(245, 158, 11, 0.12)" border="1px solid rgba(245, 158, 11, 0.25)" />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Pill icon={EyeOff} count={outcomes.missed} label="Missed" color="var(--danger)" bg="rgba(239, 68, 68, 0.12)" border="1px solid rgba(239, 68, 68, 0.25)" />
                </div>
            </div>
          )}
        </div>
        <div className="tactic-details-panel-body">
          {filteredTechs.length === 0 ? (
             <div style={{  padding: '20px', textAlign: 'center', color: 'var(--text-muted)'  }}>No techniques match your search.</div>
          ) : (
             <div style={{  display: 'flex', flexDirection: 'column', gap: '10px'  }}>
                 {filteredTechs.map(tech => (
                   <div 
                     key={tech.id}
                     style={{  
                         background: 'rgba(0,0,0,0.4)', 
                         border: '1px solid rgba(255,255,255,0.03)', 
                         borderRadius: '8px',
                         cursor: 'pointer', 
                         display: 'flex', 
                         justifyContent: 'space-between',
                         alignItems: 'center', 
                         padding: '15px',
                         transition: 'all 0.2s',
                         boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                      }}
                     onClick={() => handleTechClick(tech)}
                     onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                     onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.4)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                   >
                      <div style={{  display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden'  }}>
                          <span style={{  fontSize: '0.75rem', color: statusColors[tech.status] || statusColors.unknown, fontWeight: 'bold', letterSpacing: '0.5px'  }}>{tech.id}</span>
                          <span style={{  fontSize: '0.9rem', color: tech.status === 'na' ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: tech.status === 'na' ? 'line-through' : 'none', transition: 'all 0.3s ease', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'  }}>{tech.name}</span>
                      </div>
                      <div style={{  display: 'flex', alignItems: 'center', gap: '12px'  }}>
                          <button 
                             onClick={(e) => { e.stopPropagation(); toggleDescope(e, tech); }}
                             title={tech.status === 'na' ? "Re-scope technique" : "De-scope technique (N/A)"}
                             style={{  background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '4px', color: tech.status === 'na' ? 'var(--accent-secondary)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '6px', transition: 'all 0.2s'  }}
                             onMouseOver={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                             onMouseOut={e => { e.currentTarget.style.color = tech.status === 'na' ? 'var(--accent-secondary)' : 'var(--text-muted)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                          >
                             {tech.status === 'na' ? <RotateCcw size={14} /> : <Ban size={14} />}
                          </button>
                          <ArrowRight size={16} color="var(--text-muted)" style={{  opacity: 0.5  }} />
                      </div>
                   </div>
                 ))}
             </div>
          )}
        </div>
    </div>
  );
}
