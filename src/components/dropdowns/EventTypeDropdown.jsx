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
import { TerminalSquare, Zap, ListOrdered, ChevronDown } from 'lucide-react';

const eventTypes = [
    { id: 'Payload', name: 'Payload', icon: TerminalSquare },
    { id: 'Procedure', name: 'Procedure', icon: Zap }
];

export default function EventTypeDropdown({ value, onChange }) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    const activeItem = eventTypes.find(e => e.id === (value || 'Payload')) || eventTypes[0];
    const ActiveIcon = activeItem.icon;

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
        <div ref={dropdownRef} style={{ position: 'relative', width: '150px', zIndex: isOpen ? 50 : 1 }}>
            <button 
                onClick={(e) => { e.preventDefault(); setIsOpen(!isOpen); }}
                style={{ 
                    display: 'flex', alignItems: 'center', gap: '8px', 
                    background: 'rgba(0, 0, 0, 0.4)', 
                    border: isOpen ? '1px solid var(--accent-primary)' : '1px solid var(--glass-border)', 
                    borderRadius: '6px', padding: '6px 10px', 
                    color: 'var(--text-primary)', cursor: 'pointer',
                    boxShadow: isOpen ? '0 0 10px rgba(156, 39, 176, 0.2)' : 'none',
                    transition: 'all 0.2s ease',
                    width: '100%', justifyContent: 'space-between',
                    fontFamily: 'Inter, sans-serif'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ActiveIcon size={14} color="var(--accent-primary)" />
                    <span style={{ fontSize: '0.85rem' }}>{activeItem.name}</span>
                </div>
                <ChevronDown size={14} color="var(--text-muted)" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
            </button>

            {isOpen && (
                <div className="animate-fade-in" style={{ 
                    position: 'absolute', top: 'calc(100% + 5px)', left: 0, 
                    background: 'rgba(15, 17, 26, 0.98)', backdropFilter: 'blur(16px)',
                    border: '1px solid var(--accent-primary)', borderRadius: '6px',
                    padding: '6px', zIndex: 1000,
                    boxShadow: '0 10px 40px rgba(0,0,0,0.5), inset 0 0 15px rgba(156, 39, 176, 0.1)',
                    width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '2px'
                }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', padding: '4px 8px', fontWeight: 'bold' }}>
                        Event Type
                    </div>
                    {eventTypes.map(env => {
                        const Icon = env.icon;
                        const isActive = value === env.id || (!value && env.id === 'Payload');
                        return (
                            <button
                                key={env.id}
                                onClick={(e) => { e.preventDefault(); onChange(env.id); setIsOpen(false); }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    background: isActive ? 'rgba(156, 39, 176, 0.15)' : 'transparent',
                                    border: isActive ? '1px solid rgba(156, 39, 176, 0.3)' : '1px solid transparent',
                                    padding: '6px 8px', borderRadius: '4px',
                                    color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                    cursor: 'pointer', textAlign: 'left',
                                    transition: 'all 0.15s ease',
                                    width: '100%',
                                    fontFamily: 'Inter, sans-serif'
                                }}
                                onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
                                onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
                            >
                                <Icon size={14} />
                                <span style={{ fontSize: '0.85rem' }}>{env.name}</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
