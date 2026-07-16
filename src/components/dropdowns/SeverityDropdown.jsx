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
import { Flame, AlertTriangle, AlertCircle, Info, ChevronDown, Sparkles, Loader2 } from 'lucide-react';

const severityTypes = [
    { id: 'Critical', name: 'Critical', icon: Flame, color: 'var(--severity-critical)' },
    { id: 'High', name: 'High', icon: AlertTriangle, color: 'var(--severity-high)' },
    { id: 'Medium', name: 'Medium', icon: AlertCircle, color: 'var(--severity-medium)' },
    { id: 'Low', name: 'Low', icon: Info, color: 'var(--severity-low)' },
    { id: 'N/A', name: 'Not Applicable', icon: Info, color: 'var(--text-muted)' }
];

export default function SeverityDropdown({ value, onChange, disabled, onAutoAssess, isAssessing }) {
    const [isOpen, setIsOpen] = useState(false);
    const [rect, setRect] = useState(null);
    const dropdownRef = useRef(null);

    const baseActiveItem = severityTypes.find(e => e.id === value) || { id: '', name: 'Select Severity', icon: AlertCircle, color: 'var(--text-muted)' };
    const displayItem = isAssessing ? { id: 'assessing', name: 'Assessing...', icon: Loader2, color: 'var(--accent-secondary)' } : baseActiveItem;
    const ActiveIcon = displayItem.icon;

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
        <div ref={dropdownRef} style={{ position: 'relative', width: '100%', opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto', zIndex: isOpen ? 50 : 1 }}>
            <button 
                onClick={(e) => { e.preventDefault(); if (!disabled) setIsOpen(!isOpen); }}
                style={{ 
                    display: 'flex', alignItems: 'center', gap: '8px', 
                    background: 'rgba(0, 0, 0, 0.4)', 
                    border: isOpen ? '1px solid var(--accent-secondary)' : '1px solid var(--glass-border)', 
                    borderRadius: '6px', padding: '8px 12px', 
                    color: 'var(--text-primary)', cursor: disabled ? 'not-allowed' : 'pointer',
                    boxShadow: isOpen ? '0 0 10px rgba(0, 188, 212, 0.2)' : 'none',
                    transition: 'all 0.2s ease',
                    width: '100%', justifyContent: 'space-between',
                    fontFamily: 'Inter, sans-serif'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ActiveIcon size={16} color={disabled ? 'var(--text-muted)' : displayItem.color} className={isAssessing ? "animate-spin" : ""} />
                    <span style={{ fontSize: '0.85rem' }}>{displayItem.name}</span>
                </div>
                <ChevronDown size={14} color="var(--text-muted)" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
            </button>

            {isOpen && !disabled && rect && createPortal(
                <div className="animate-fade-in portal-dropdown-menu" style={{ 
                    position: 'absolute', top: rect.top, left: rect.left, width: rect.width, 
                    background: 'rgba(15, 17, 26, 0.98)', backdropFilter: 'blur(16px)',
                    border: '1px solid var(--accent-secondary)', borderRadius: '6px',
                    padding: '6px', zIndex: 99999,
                    boxShadow: '0 10px 40px rgba(0,0,0,0.5), inset 0 0 15px rgba(0, 188, 212, 0.1)',
                    boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '2px'
                }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', padding: '4px 8px', fontWeight: 'bold' }}>
                        Select Severity
                    </div>
                    {onAutoAssess && (
                        <button
                            onClick={(e) => { e.preventDefault(); setIsOpen(false); onAutoAssess(); }}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                background: 'transparent',
                                border: '1px solid transparent',
                                padding: '8px 10px', borderRadius: '4px',
                                color: 'var(--accent-secondary)',
                                cursor: 'pointer', textAlign: 'left',
                                transition: 'all 0.15s ease',
                                width: '100%',
                                fontFamily: 'Inter, sans-serif'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0, 188, 212, 0.1)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                            <Sparkles size={14} color="var(--accent-secondary)" />
                            <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>AI Auto-Assess</span>
                        </button>
                    )}
                    <div style={{ height: '1px', background: 'var(--glass-border)', margin: '2px 0' }} />
                    {severityTypes.map(sev => {
                        const Icon = sev.icon;
                        const isActive = value === sev.id;
                        return (
                            <button
                                key={sev.id}
                                onClick={(e) => { e.preventDefault(); onChange(sev.id); setIsOpen(false); }}
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
                                <Icon size={14} color={sev.color} />
                                <span style={{ fontSize: '0.85rem' }}>{sev.name}</span>
                            </button>
                        );
                    })}
                </div>, document.getElementById('root'))}
        </div>
    );
}
