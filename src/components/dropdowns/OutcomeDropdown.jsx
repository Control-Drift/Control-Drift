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

import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ShieldCheck, ShieldAlert, FileText, EyeOff, AlertTriangle, XCircle, ChevronDown, HelpCircle, Shield, Siren } from 'lucide-react';

const outcomeTypes = [
    { id: 'Prevented & Alerted', name: 'Prevented & Alerted', icon: ShieldCheck, color: 'var(--success)' },
    { id: 'Prevented', name: 'Prevented', icon: Shield, color: '#06b6d4' },
    { id: 'Prevented', name: 'Prevented', icon: ShieldCheck, color: 'var(--success)', hidden: true },
    { id: 'Alerted', name: 'Alerted', icon: Siren, color: '#3b82f6' },
    { id: 'Logged', name: 'Logged', icon: FileText, color: 'var(--warning)' },
    { id: 'Missed', name: 'Missed', icon: EyeOff, color: 'var(--danger)' },
    { id: 'N/A', name: 'N/A (Not Applicable)', icon: HelpCircle, color: 'var(--text-muted)' }
];

export default function OutcomeDropdown({ value, onChange, isExpected, allowNA = false }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isHelpOpen, setIsHelpOpen] = useState(false);
    const [rect, setRect] = useState(null);
    const dropdownRef = useRef(null);

    const placeholderItem = { id: '', name: 'Select Outcome...', icon: HelpCircle, color: 'var(--text-muted)' };
    const activeItem = outcomeTypes.find(e => e.id === value) || placeholderItem;
    const ActiveIcon = activeItem.icon;

    const visibleOutcomeTypes = outcomeTypes.filter(outcome => !outcome.hidden && (outcome.id !== 'N/A' || allowNA));

    useLayoutEffect(() => {
        const updatePosition = () => {
            if (isOpen && dropdownRef.current) {
                const bounds = dropdownRef.current.getBoundingClientRect();
                const scale = window.appScale || 1;
                setRect({
                    top: (bounds.bottom + window.scrollY + 5) / scale,
                    left: (bounds.left + window.scrollX) / scale,
                    width: bounds.width / scale
                });
            }
        };

        updatePosition();

        if (isOpen) {
            window.addEventListener('scroll', updatePosition, true);
            window.addEventListener('resize', updatePosition);
        }

        return () => {
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition);
        };
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (isOpen && dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                if (!event.target.closest('.portal-dropdown-menu')) {
                    setIsOpen(false);
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    return (
        <div ref={dropdownRef} style={{ position: 'relative', width: '100%', zIndex: isOpen ? 50 : 1 }}>
            <button 
                onClick={(e) => { e.preventDefault(); setIsOpen(!isOpen); }}
                style={{ 
                    display: 'flex', alignItems: 'center', gap: '8px', 
                    background: 'rgba(0, 0, 0, 0.4)', 
                    border: isOpen ? '1px solid var(--accent-secondary)' : '1px solid var(--glass-border)', 
                    borderRadius: '6px', padding: '8px 12px', 
                    color: 'var(--text-primary)', cursor: 'pointer',
                    boxShadow: isOpen ? '0 0 10px rgba(0, 188, 212, 0.2)' : 'none',
                    transition: 'all 0.2s ease',
                    width: '100%', justifyContent: 'space-between',
                    fontFamily: 'Inter, sans-serif'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ActiveIcon size={16} color={activeItem.color} />
                    <span style={{ fontSize: '0.85rem' }}>{activeItem.name}</span>
                </div>
                <ChevronDown size={14} color="var(--text-muted)" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
            </button>

            {isOpen && rect && createPortal(
                <div className="animate-fade-in portal-dropdown-menu" style={{ 
                    position: 'absolute', top: rect.top, left: rect.left, width: rect.width,
                    background: 'rgba(15, 17, 26, 0.98)', backdropFilter: 'blur(16px)',
                    border: '1px solid var(--accent-secondary)', borderRadius: '6px',
                    padding: '6px', zIndex: 99999,
                    boxShadow: '0 10px 40px rgba(0,0,0,0.5), inset 0 0 15px rgba(0, 188, 212, 0.1)',
                    boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '2px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>
                            Select Outcome
                        </div>
                        <div 
                            onMouseEnter={() => setIsHelpOpen(true)}
                            onMouseLeave={() => setIsHelpOpen(false)}
                            style={{ position: 'relative', cursor: 'help' }}
                        >
                            <HelpCircle size={14} color="var(--text-muted)" />
                            {isHelpOpen && (
                                <div style={{ 
                                    position: 'absolute', top: '-10px', right: '20px', width: '280px',
                                    background: 'rgba(15, 17, 26, 0.98)', border: '1px solid var(--accent-primary)',
                                    borderRadius: '6px', padding: '12px', zIndex: 999999,
                                    boxShadow: '0 4px 20px rgba(0, 229, 255, 0.15)',
                                    color: 'var(--text-primary)', fontSize: '0.75rem', lineHeight: '1.4',
                                    pointerEvents: 'none', textTransform: 'none', letterSpacing: 'normal', fontWeight: 'normal'
                                }}>
                                    <div style={{ marginBottom: '8px', fontWeight: 'bold', color: 'var(--accent-primary)' }}>Outcome Definitions</div>
                                    <div style={{ marginBottom: '6px' }}><strong style={{ color: 'var(--success)' }}>Prevented & Alerted:</strong> Blocked and security teams were notified.</div>
                                    <div style={{ marginBottom: '6px' }}><strong style={{ color: '#06b6d4' }}>Prevented:</strong> Blocked silently (no alert).</div>
                                    <div style={{ marginBottom: '6px' }}><strong style={{ color: '#3b82f6' }}>Alerted:</strong> Succeeded, but security teams were notified.</div>
                                    <div style={{ marginBottom: '6px' }}><strong style={{ color: 'var(--warning)' }}>Logged:</strong> Succeeded, telemetry exists, but no alert.</div>
                                    <div><strong style={{ color: 'var(--danger)' }}>Missed:</strong> Complete blind spot. No logs, no alerts.</div>
                                </div>
                            )}
                        </div>
                    </div>
                    {visibleOutcomeTypes.map(outcome => {
                        const Icon = outcome.icon;
                        const isActive = value === outcome.id;
                        return (
                            <button
                                key={outcome.id}
                                onClick={(e) => { e.preventDefault(); onChange(outcome.id); setIsOpen(false); }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    background: isActive ? 'rgba(0, 188, 212, 0.15)' : 'transparent',
                                    border: isActive ? '1px solid rgba(0, 188, 212, 0.3)' : '1px solid transparent',
                                    padding: '8px 10px', borderRadius: '4px',
                                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                                    cursor: 'pointer', textAlign: 'left',
                                    transition: 'all 0.15s ease',
                                    width: '100%',
                                    fontFamily: 'Inter, sans-serif'
                                }}
                                onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
                                onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
                            >
                                <Icon size={14} color={outcome.color} />
                                <span style={{ fontSize: '0.85rem' }}>{outcome.name}</span>
                            </button>
                        );
                    })}
                </div>, document.getElementById('root'))}
        </div>
    );
}
