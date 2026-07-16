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
import { ShieldCheck, ShieldAlert, Activity, AlertCircle, XCircle, HelpCircle, ChevronDown } from 'lucide-react';

const outcomeTypes = [
    { id: 'Prevented & Alerted', name: 'Prevented & Alerted', icon: ShieldCheck, color: 'var(--success)' },
    { id: 'Prevented', name: 'Prevented', icon: ShieldCheck, color: '#06b6d4' },
    { id: 'Prevented', name: 'Prevented', icon: ShieldCheck, color: 'var(--success)', hidden: true },
    { id: 'Alerted', name: 'Alerted', icon: ShieldAlert, color: '#3b82f6' },
    { id: 'Logged', name: 'Logged', icon: Activity, color: 'var(--warning)' },
    { id: 'Missed', name: 'Missed', icon: XCircle, color: 'var(--danger)' }
];

export default function ValidationOutcomeDropdown({ value, onChange, onlyOptimal = false }) {
    const [isOpen, setIsOpen] = useState(false);
    const [rect, setRect] = useState(null);
    const dropdownRef = useRef(null);

    const placeholderItem = { id: '', name: 'Select Validation Outcome...', icon: HelpCircle, color: 'var(--text-muted)' };
    const optimalIds = ['Prevented & Alerted', 'Prevented', 'Prevented', 'Alerted'];

    const activeItem = outcomeTypes.find(e => {
        if (e.id !== value) return false;
        if (onlyOptimal && !optimalIds.includes(e.id)) return false;
        return true;
    }) || placeholderItem;
    
    const ActiveIcon = activeItem.icon;

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
                    borderRadius: '6px', padding: '10px 12px', 
                    color: 'var(--text-primary)', cursor: 'pointer',
                    boxShadow: isOpen ? '0 0 10px rgba(0, 188, 212, 0.2)' : 'none',
                    transition: 'all 0.2s ease',
                    width: '100%', justifyContent: 'space-between',
                    fontFamily: 'Inter, sans-serif'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ActiveIcon size={16} color={activeItem.color} />
                    <span style={{ fontSize: '0.9rem' }}>{activeItem.name}</span>
                </div>
                <ChevronDown size={16} color="var(--text-muted)" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
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
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', padding: '4px 8px', fontWeight: 'bold' }}>
                        {onlyOptimal ? 'Optimal Outcomes' : 'Outcome'}
                    </div>
                    {outcomeTypes.map(outcome => {
                        if (outcome.hidden) return null;
                        if (onlyOptimal && !optimalIds.includes(outcome.id)) return null;
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
                                    padding: '10px 10px', borderRadius: '4px',
                                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                                    cursor: 'pointer', textAlign: 'left',
                                    transition: 'all 0.15s ease',
                                    width: '100%',
                                    fontFamily: 'Inter, sans-serif'
                                }}
                                onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
                                onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
                            >
                                <Icon size={16} color={outcome.color} />
                                <span style={{ fontSize: '0.9rem' }}>{outcome.name}</span>
                            </button>
                        );
                    })}
                </div>, document.getElementById('root'))}
        </div>
    );
}
