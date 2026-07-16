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
import { CheckSquare, Square, ChevronRight, X, Sparkles, Search, CornerDownRight } from 'lucide-react';

const TTPSelector = ({ techniques, selectedTTPs, toggleTTP, onExpand }) => {
    const [searchQuery, setSearchQuery] = useState('');

    const grouped = React.useMemo(() => {
        const query = searchQuery.toLowerCase();
        
        const g = {};
        techniques.forEach(tech => {
            const matchesParent = tech.id.toLowerCase().includes(query) || tech.name.toLowerCase().includes(query);
            const matchingSubs = (tech.subTechniques || []).filter(sub => 
                sub.id.toLowerCase().includes(query) || sub.name.toLowerCase().includes(query)
            );
            
            if (matchesParent || matchingSubs.length > 0 || !query) {
                g[tech.id] = {
                    parent: tech,
                    subs: query ? (matchesParent ? (tech.subTechniques || []) : matchingSubs) : (tech.subTechniques || [])
                };
            }
        });
        
        return Object.values(g).sort((a, b) => a.parent.id.localeCompare(b.parent.id));
    }, [techniques, searchQuery]);

    const [activeGroupParent, setActiveGroupParent] = useState(null);
    const activeGroup = activeGroupParent ? grouped.find(g => g.parent.id === activeGroupParent) : null;

    useEffect(() => {
        if (onExpand) {
            onExpand(!!activeGroup);
        }
    }, [!!activeGroup, onExpand]);



    return (
        <div className="animate-fade-in" style={{ 
            display: 'flex', 
            flex: 1,
            minHeight: 0,
            height: '100%', 
            width: activeGroup ? '860px' : '380px',
            maxWidth: '100%',
            overflow: 'hidden',
            transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
            {/* Slender Main Menu */}
            <div style={{
                flex: activeGroup ? '0 0 auto' : '1 1 auto',
                width: activeGroup ? '40%' : '100%',
                minWidth: '220px',
                maxWidth: '380px',
                minHeight: 0,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderRight: activeGroup ? '1px solid rgba(255,255,255,0.05)' : 'none',
                zIndex: 2,
                transition: 'all 0.3s ease'
            }}>
                <div style={{ padding: '15px 20px 5px 20px', flexShrink: 0 }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={16} color="var(--text-secondary)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                        <input
                            type="text"
                            placeholder="Search technique ID or name..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="ai-input"
                            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px 8px 36px', fontSize: '0.9rem', borderRadius: '6px' }}
                        />
                    </div>
                </div>
                
                <div style={{ padding: '10px 20px 20px 20px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
                    {grouped.length === 0 ? (
                        <div style={{ padding: '20px 0', color: 'var(--text-secondary)', textAlign: 'center' }}>No techniques match your search.</div>
                    ) : grouped.map((group) => {
                        const isParentSelected = selectedTTPs.find(st => st.id === group.parent.id);
                        const hasSelectedSubs = group.subs.some(sub => selectedTTPs.find(st => st.id === sub.id));
                        const hasSubs = group.subs.length > 0;
                        const isActive = activeGroupParent === group.parent.id;

                        return (
                            <div key={group.parent.id} style={{ 
                                display: 'flex',
                                alignItems: 'center',
                                padding: '12px 16px',
                                borderRadius: '8px',
                                marginBottom: '8px',
                                cursor: 'pointer',
                                background: isActive ? 'linear-gradient(90deg, rgba(156, 39, 176, 0.15) 0%, rgba(255,255,255,0.02) 100%)' : 'rgba(255,255,255,0.02)',
                                border: `1px solid ${isActive ? 'rgba(156, 39, 176, 0.3)' : 'rgba(255,255,255,0.05)'}`,
                                boxShadow: isActive ? 'inset 3px 0 0 var(--accent-primary)' : 'none',
                                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                                position: 'relative',
                                overflow: 'hidden'
                            }}
                            onMouseOver={e => { 
                                if(!isActive) {
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                                    e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)';
                                    e.currentTarget.style.transform = 'translateX(2px)';
                                }
                            }}
                            onMouseOut={e => { 
                                if(!isActive) {
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                                    e.currentTarget.style.border = '1px solid rgba(255,255,255,0.05)';
                                    e.currentTarget.style.transform = 'translateX(0)';
                                }
                            }}
                            onClick={() => {
                                if (hasSubs) {
                                    setActiveGroupParent(isActive ? null : group.parent.id);
                                } else {
                                    toggleTTP(group.parent.id, group.parent.name);
                                }
                            }}
                            >
                                <button 
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleTTP(group.parent.id, group.parent.name); }} 
                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: isParentSelected ? 'var(--accent-primary)' : 'rgba(255,255,255,0.2)', marginRight: '14px', padding: 0, transition: 'color 0.2s' }}
                                    title="Select Parent Technique"
                                    onMouseOver={e => !isParentSelected && (e.currentTarget.style.color = 'var(--text-secondary)')}
                                    onMouseOut={e => !isParentSelected && (e.currentTarget.style.color = 'rgba(255,255,255,0.2)')}
                                >
                                    {isParentSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                                </button>

                                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '4px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ 
                                            fontSize: '0.75rem', 
                                            fontFamily: 'monospace', 
                                            fontWeight: 'bold', 
                                            color: isActive || isParentSelected ? '#fff' : 'var(--text-secondary)',
                                            background: 'rgba(0,0,0,0.3)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            padding: '2px 6px',
                                            borderRadius: '4px'
                                        }}>
                                            {group.parent.id}
                                        </span>
                                        {hasSelectedSubs && !isParentSelected && (
                                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-secondary)', boxShadow: '0 0 5px var(--accent-secondary)', marginLeft: 'auto' }} title="Contains selected sub-techniques" />
                                        )}
                                    </div>
                                    <span style={{ fontSize: '0.9rem', fontWeight: '500', color: isActive || isParentSelected ? 'var(--text-primary)' : 'var(--text-secondary)', textDecoration: group.parent.status === 'na' ? 'line-through' : 'none', opacity: group.parent.status === 'na' ? 0.6 : 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '270px' }}>
                                        {group.parent.name}
                                    </span>
                                </div>

                                {hasSubs && (
                                    <ChevronRight size={16} color={isActive ? 'var(--accent-primary)' : 'rgba(255,255,255,0.2)'} style={{ marginLeft: '8px', transition: 'transform 0.2s', transform: isActive ? 'translateX(2px)' : 'translateX(0)' }} />
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Slide-out Sub-techniques Pane */}
            {activeGroup && (
                <div style={{
                    flex: 1,
                    minWidth: '250px',
                    minHeight: 0,
                    position: 'relative',
                    background: 'rgba(10, 14, 23, 0.4)',
                    borderLeft: '1px solid rgba(255,255,255,0.05)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    animation: 'slideInFromLeft 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
                }}>
                   <div style={{ 
                       position: 'absolute',
                       top: 0,
                       left: 0,
                       width: '100%', 
                       height: '100%', 
                       display: 'flex',
                       flexDirection: 'column'
                   }}>
                       <div style={{ padding: '20px 25px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 100%)', flexShrink: 0 }}>
                            <div style={{ flex: 1, minWidth: 0, paddingRight: '15px' }}>
                                <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.2rem', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '6px', fontSize: '1rem' }}>{activeGroup.parent.id}</span>
                                </h3>
                                <p style={{ margin: '8px 0 0 0', color: 'var(--text-secondary)', fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: '500' }}>{activeGroup.parent.name}</p>
                            </div>
                            <button 
                                onClick={() => setActiveGroupParent(null)}
                                style={{ flexShrink: 0, background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '6px', transition: 'all 0.2s' }}
                                onMouseOver={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)'; }} 
                                onMouseOut={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'; }}
                            >
                                <X size={16} />
                            </button>
                       </div>

                       <div style={{ flex: 1, overflowY: 'auto', padding: '20px 25px', minHeight: 0 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                                {activeGroup.subs.map(sub => {
                                    const isSubSelected = selectedTTPs.find(st => st.id === sub.id);
                                    return (
                                        <div 
                                            key={sub.id} 
                                            onClick={() => toggleTTP(sub.id, sub.name)} 
                                            style={{ 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                padding: '14px 16px', 
                                                cursor: 'pointer', 
                                                background: isSubSelected ? 'linear-gradient(90deg, rgba(156, 39, 176, 0.15) 0%, rgba(255,255,255,0.02) 100%)' : 'rgba(255,255,255,0.02)', 
                                                border: isSubSelected ? '1px solid rgba(156, 39, 176, 0.3)' : '1px solid rgba(255,255,255,0.05)',
                                                boxShadow: isSubSelected ? 'inset 3px 0 0 var(--accent-primary)' : 'none',
                                                borderRadius: '8px',
                                                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                                            }}
                                            onMouseOver={e => {
                                                if (!isSubSelected) {
                                                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                                                    e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)';
                                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                                                }
                                            }}
                                            onMouseOut={e => {
                                                if (!isSubSelected) {
                                                    e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                                                    e.currentTarget.style.border = '1px solid rgba(255,255,255,0.05)';
                                                    e.currentTarget.style.transform = 'translateY(0)';
                                                    e.currentTarget.style.boxShadow = 'none';
                                                }
                                            }}
                                        >
                                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleTTP(sub.id, sub.name); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: isSubSelected ? 'var(--accent-primary)' : 'rgba(255,255,255,0.2)', marginRight: '14px', padding: 0, transition: 'color 0.2s' }}>
                                                {isSubSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                                            </button>
                                            
                                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ 
                                                        fontSize: '0.75rem', 
                                                        fontFamily: 'monospace', 
                                                        fontWeight: 'bold', 
                                                        color: isSubSelected ? '#fff' : 'var(--text-secondary)',
                                                        background: 'rgba(0,0,0,0.3)',
                                                        border: '1px solid rgba(255,255,255,0.1)',
                                                        padding: '2px 6px',
                                                        borderRadius: '4px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}>
                                                        <CornerDownRight size={12} />
                                                        {sub.id}
                                                    </span>
                                                </div>
                                                <span style={{ fontSize: '0.9rem', color: isSubSelected ? 'var(--text-primary)' : 'var(--text-secondary)', textDecoration: sub.status === 'na' ? 'line-through' : 'none', opacity: sub.status === 'na' ? 0.6 : 1, fontWeight: '500' }}>
                                                    {sub.name}
                                                </span>
                                            </div>
                                            {isSubSelected?.aiMapped && <Sparkles size={14} color="var(--accent-primary)" style={{ marginLeft: '10px' }} />}
                                        </div>
                                    )
                                })}
                            </div>
                       </div>
                   </div>
                </div>
            )}

            <style>{`
                @keyframes slideInFromLeft {
                    from { transform: translateX(-20px); opacity: 0; min-width: 0; }
                    to { transform: translateX(0); opacity: 1; min-width: 400px; }
                }
            `}</style>
        </div>
    );
};

export default TTPSelector;
