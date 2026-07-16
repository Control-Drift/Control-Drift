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

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Shield } from 'lucide-react';
import { useAppContext } from '../../AppContext';

export default function SecurityControlFilterDropdown() {
    const { activeSecurityControlFilter, setActiveSecurityControlFilter, targetSecurityControls } = useAppContext();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    const controlsList = Array.isArray(targetSecurityControls) ? targetSecurityControls : [];
    const availableControls = ['All', ...controlsList];
    const activeItemName = activeSecurityControlFilter === 'All' ? 'All Security Controls' : activeSecurityControlFilter;

    useEffect(() => {
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
                    display: 'flex', alignItems: 'center', gap: '10px', 
                    background: 'rgba(10, 11, 16, 0.8)', backdropFilter: 'blur(10px)',
                    border: isOpen ? '1px solid var(--accent-secondary)' : '1px solid rgba(255,255,255,0.1)', 
                    borderRadius: '24px', padding: '8px 16px', 
                    color: 'var(--text-primary)', cursor: 'pointer',
                    boxShadow: isOpen ? '0 0 15px rgba(0, 188, 212, 0.3)' : '0 4px 6px rgba(0,0,0,0.3)',
                    transition: 'all 0.2s ease',
                    minWidth: '220px', justifyContent: 'space-between'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Shield size={16} color="var(--accent-secondary)" />
                    <span style={{ fontSize: '0.9rem', fontWeight: 'bold', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {activeItemName}
                    </span>
                </div>
                <ChevronDown size={16} color="var(--text-muted)" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease', flexShrink: 0 }} />
            </button>

            {isOpen && (
                <div className="animate-fade-in" style={{ 
                    position: 'absolute', top: 'calc(100% + 8px)', right: 0, 
                    background: 'rgba(15, 17, 26, 0.95)', backdropFilter: 'blur(16px)',
                    border: '1px solid var(--glass-border)', borderRadius: '12px',
                    padding: '8px', zIndex: 1000,
                    boxShadow: '0 10px 40px rgba(0,0,0,0.5), inset 0 0 20px rgba(0, 188, 212, 0.1)',
                    width: '100%', minWidth: '240px',
                    display: 'flex', flexDirection: 'column', gap: '4px',
                    maxHeight: '300px', overflowY: 'auto'
                }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', padding: '8px 12px 4px', fontWeight: 'bold' }}>
                        Security Control Filter
                    </div>
                    {availableControls.map(controlName => {
                        const isActive = activeSecurityControlFilter === controlName;
                        const displayName = controlName === 'All' ? 'All Security Controls' : controlName;
                        return (
                            <button
                                key={controlName}
                                onClick={() => { setActiveSecurityControlFilter(controlName); setIsOpen(false); }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    background: isActive ? 'rgba(0, 188, 212, 0.15)' : 'transparent',
                                    border: isActive ? '1px solid rgba(0, 188, 212, 0.3)' : '1px solid transparent',
                                    padding: '8px 12px', borderRadius: '8px',
                                    color: isActive ? 'var(--accent-secondary)' : 'var(--text-secondary)',
                                    cursor: 'pointer', textAlign: 'left',
                                    transition: 'all 0.15s ease'
                                }}
                                onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
                                onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
                            >
                                <Shield size={14} color={isActive ? "var(--accent-secondary)" : "currentColor"} />
                                <span style={{ fontSize: '0.85rem' }}>{displayName}</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
