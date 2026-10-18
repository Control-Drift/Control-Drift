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
import { Search, ChevronDown, ChevronRight } from 'lucide-react';

export default function TacticsSidebar({
  activeTactic,
  setActiveTactic,
  isNavigatorCollapsed,
  setIsNavigatorCollapsed,
  searchTerm,
  setSearchTerm,
  quickFilter,
  setQuickFilter,
  resolvedMitreData,
  statusColors,
  driftingCount = 0
}) {
  return (
    <div className={`glass-panel animate-fade-in heatmap-sidebar ${activeTactic ? 'hidden-on-mobile-tactic' : ''}`} style={{ pointerEvents: 'auto', marginLeft: '20px', marginBottom: '20px', flex: '0 1 auto', minHeight: 0, width: '15rem', background: 'rgba(5, 5, 8, 0.75)', backdropFilter: 'blur(10px)', display: 'flex', flexDirection: 'column', border: '1px solid var(--glass-border)'  }}>
       <div 
         style={{  padding: '10px 12px', borderBottom: isNavigatorCollapsed ? 'none' : '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.02)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between'  }}
         onClick={() => setIsNavigatorCollapsed(!isNavigatorCollapsed)}
       >
          <h3 style={{  margin: '0', color: 'var(--text-primary)', fontSize: '0.8rem', letterSpacing: '0.5px', textTransform: 'uppercase'  }}>Tactics Navigator</h3>
          {isNavigatorCollapsed ? <ChevronRight size={16} style={{ color: 'var(--text-secondary)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-secondary)' }} />}
       </div>
       <div style={{ display: 'grid', gridTemplateRows: isNavigatorCollapsed ? '0fr' : '1fr', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', flex: isNavigatorCollapsed ? 'none' : '1 1 auto', minHeight: 0, opacity: isNavigatorCollapsed ? 0 : 1 }}>
         <div style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
           <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.02)' }}>
              <div style={{  position: 'relative'  }}>
             <Search size={12} style={{  position: 'absolute', left: '10px', top: '7px', color: 'var(--text-secondary)'  }} />
             <input 
               className="ai-input" 
               style={{  width: '100%', boxSizing: 'border-box', padding: '4px 10px 4px 28px', fontSize: '0.8rem'  }} 
               placeholder="Search Tactics..." 
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
             />
          </div>
          <div style={{  marginTop: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px'  }}>
              <button className="btn" style={{  padding: '4px 6px', fontSize: '0.65rem', background: quickFilter === 'all' ? 'var(--accent-secondary)' : 'rgba(255,255,255,0.05)', color: quickFilter === 'all' ? '#000' : 'var(--text-secondary)'  }} onClick={() => setQuickFilter('all')}>All</button>
              <button className="btn" style={{  padding: '4px 6px', fontSize: '0.65rem', background: quickFilter === 'critical' ? 'var(--danger)' : 'rgba(255,255,255,0.05)', color: quickFilter === 'critical' ? '#fff' : 'var(--text-secondary)'  }} onClick={() => setQuickFilter('critical')}>Critical Gaps</button>
              <button className="btn" style={{  padding: '4px 6px', fontSize: '0.65rem', background: quickFilter === 'tested' ? 'var(--success)' : 'rgba(255,255,255,0.05)', color: quickFilter === 'tested' ? '#fff' : 'var(--text-secondary)'  }} onClick={() => setQuickFilter('tested')}>Tested</button>
              <button className="btn" style={{  padding: '4px 6px', fontSize: '0.65rem', background: quickFilter === 'untested' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)', color: quickFilter === 'untested' ? '#fff' : 'var(--text-secondary)'  }} onClick={() => setQuickFilter('untested')}>Untested</button>
              <button
                className="btn"
                style={{
                  gridColumn: 'span 2',
                  padding: '4px 6px',
                  fontSize: '0.65rem',
                  background: quickFilter === 'drifting' ? '#f59e0b' : 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  color: quickFilter === 'drifting' ? '#000' : '#fbbf24',
                  fontWeight: quickFilter === 'drifting' ? 700 : 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px'
                }}
                onClick={() => setQuickFilter(quickFilter === 'drifting' ? 'all' : 'drifting')}
                title="Show decayed techniques that need re-testing"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="M12 2.5 L10 8.5 L14 12 L10.5 16.5 L12 21.5" />
                  <path d="M14 12 L17 13.5" />
                </svg>
                <span>Decayed {driftingCount > 0 ? `(${driftingCount})` : ''}</span>
              </button>
           </div>
       </div>
        <div style={{  flex: 1, overflowY: 'auto', padding: '8px'  }}>
           {(() => {
              const filtered = Object.keys(resolvedMitreData).filter(tactic => {
                 if (quickFilter === 'critical' && !resolvedMitreData[tactic].techniques.some(t => t.status === 'low' || t.status === 'minimal')) return false;
                 if (quickFilter === 'tested' && !resolvedMitreData[tactic].techniques.some(t => t.status !== 'unknown' && t.status !== 'na')) return false;
                 if (quickFilter === 'drifting' && !resolvedMitreData[tactic].techniques.some(t => t.status !== 'unknown' && t.status !== 'na' && t.needsRetest)) return false;
                 if (quickFilter === 'untested' && !resolvedMitreData[tactic].techniques.some(t => t.status === 'unknown')) return false;

                 if (!searchTerm) return true;
                 const term = searchTerm.toLowerCase();
                 if (tactic.toLowerCase().includes(term)) return true;
                 return resolvedMitreData[tactic].techniques.some(tech => tech.id.toLowerCase().includes(term) || tech.name.toLowerCase().includes(term));
              });

              if (filtered.length === 0) {
                 return (
                    <div style={{  padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem'  }}>
                       No tactics match search filters
                    </div>
                 );
              }

              return filtered.map(tactic => {
                 const info = resolvedMitreData[tactic];
                 const isActive = activeTactic === tactic;
                 return (
                   <div 
                      key={tactic}
                      onClick={() => setActiveTactic(isActive ? null : tactic)}
                      style={{ 
                         padding: '10px 12px',
                         cursor: 'pointer',
                         borderRadius: '6px',
                         marginBottom: '6px',
                         background: isActive ? 'rgba(156, 39, 176, 0.15)' : 'transparent',
                         border: `1px solid ${isActive ? 'var(--accent-secondary)' : 'transparent'}`,
                         transition: 'all 0.2s',
                         display: 'flex',
                         alignItems: 'center',
                         justifyContent: 'space-between'
                       }}
                      onMouseOver={e => { if(!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                      onMouseOut={e => { if(!isActive) e.currentTarget.style.background = 'transparent' }}
                   >
                      <span style={{  fontSize: '0.85rem', color: isActive ? '#fff' : 'var(--text-secondary)', fontWeight: isActive ? 'bold' : 'normal'  }}>{tactic}</span>
                      <div style={{  width: '8px', height: '8px', borderRadius: '50%', background: statusColors[info.status] || statusColors.unknown, boxShadow: `0 0 8px ${statusColors[info.status] || statusColors.unknown}`  }} />
                   </div>
                 );
              });
           })()}
        </div>
         </div>
       </div>
    </div>
  );
}
