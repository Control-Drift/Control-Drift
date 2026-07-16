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
import { ChevronDown, Plus, Check, Trash2 } from 'lucide-react';
import { useAppContext } from '../../AppContext';

export default function SecurityControlsDropdown({ 
    proc, 
    updateProcedure 
}) {
    const { targetSecurityControls, addSecurityControl, deleteSecurityControl } = useAppContext();
    const [isOpen, setIsOpen] = useState(false);
    const [rect, setRect] = useState(null);
    const [newControlText, setNewControlText] = useState('');
    const dropdownRef = useRef(null);

    const mappedControls = proc.securityControls || [];

    useLayoutEffect(() => {
        const updatePosition = () => {
            if (isOpen && dropdownRef.current) {
                const bounds = dropdownRef.current.getBoundingClientRect();
                setRect({
                    top: bounds.bottom + window.scrollY + 8,
                    left: bounds.left + window.scrollX,
                    width: bounds.width
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

    const toggleControl = (controlName) => {
        const isSelected = mappedControls.includes(controlName);
        const newControls = isSelected 
            ? mappedControls.filter(c => c !== controlName) 
            : [...mappedControls, controlName];
        updateProcedure(proc.id, 'securityControls', newControls);
    };

    const handleAddControl = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!newControlText.trim()) return;
        const cleanName = newControlText.trim();
        addSecurityControl(cleanName);
        if (!mappedControls.includes(cleanName)) {
            updateProcedure(proc.id, 'securityControls', [...mappedControls, cleanName]);
        }
        setNewControlText('');
    };

    return (
        <div className="dropdown-container" ref={dropdownRef} style={{ position: 'relative' }}>
            <button 
                type="button"
                className="dropdown-button"
                onClick={(e) => {
                    e.preventDefault();
                    setIsOpen(!isOpen);
                }}
                style={{
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--glass-border)',
                    color: mappedControls.length > 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    minWidth: '160px',
                    minHeight: '38px',
                    boxSizing: 'border-box',
                    justifyContent: 'space-between',
                    fontWeight: 'bold',
                    transition: 'all 0.2s',
                    width: '100%'
                }}
            >
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left', paddingRight: '8px' }} title={mappedControls.length > 0 ? mappedControls.join(', ') : ''}>
                    {mappedControls.length > 0 
                        ? mappedControls.join(', ') 
                        : 'No Controls Mapped'}
                </span>
                <ChevronDown size={14} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: '0.3s' }} />
            </button>

            {isOpen && rect && createPortal(
                <div 
                    className="dropdown-menu glass-panel portal-dropdown-menu animate-fade-in"
                    style={{
                        position: 'absolute',
                        top: rect.top,
                        left: rect.left,
                        width: rect.width,
                        boxSizing: 'border-box',
                        maxHeight: '400px',
                        overflowY: 'auto',
                        zIndex: 99999,
                        background: 'rgba(15, 17, 26, 0.98)',
                        backdropFilter: 'blur(16px)',
                        border: '1px solid var(--accent-secondary)',
                        borderRadius: '6px',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.5), inset 0 0 15px rgba(0, 188, 212, 0.1)',
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '10px'
                    }}
                >
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                        <input 
                            type="text" 
                            className="ai-input"
                            style={{ flex: 1, padding: '6px 10px', fontSize: '0.8rem', borderRadius: '4px' }}
                            placeholder="New control..."
                            value={newControlText}
                            onChange={e => setNewControlText(e.target.value)}
                            onClick={e => e.stopPropagation()}
                            onKeyDown={e => {
                                e.stopPropagation();
                                if (e.key === 'Enter') handleAddControl(e);
                            }}
                        />
                        <button 
                            className="btn" 
                            style={{ padding: '6px 12px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={handleAddControl}
                        >
                            <Plus size={16} strokeWidth={2.5} />
                        </button>
                    </div>

                    {(!targetSecurityControls || targetSecurityControls.length === 0) ? (
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '10px' }}>
                            No Security Controls configured. Add one above.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {targetSecurityControls.map(control => {
                                const isSelected = mappedControls.includes(control);
                                return (
                                    <div 
                                        key={control}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            toggleControl(control);
                                        }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            padding: '8px',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            background: isSelected ? 'rgba(255,255,255,0.05)' : 'transparent',
                                            transition: 'background 0.2s',
                                            border: '1px solid transparent',
                                            borderColor: isSelected ? 'rgba(255,255,255,0.1)' : 'transparent'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = isSelected ? 'rgba(255,255,255,0.05)' : 'transparent'}
                                    >
                                        <div style={{ 
                                            width: '16px', 
                                            height: '16px', 
                                            borderRadius: '4px', 
                                            border: `1px solid ${isSelected ? 'var(--accent-secondary)' : 'var(--text-muted)'}`,
                                            background: isSelected ? 'var(--accent-secondary)' : 'transparent',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0
                                        }}>
                                            {isSelected && <Check size={12} color="#000" strokeWidth={3} />}
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                                            <span style={{ fontSize: '0.75rem', color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 'bold' }}>{control}</span>
                                        </div>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                e.preventDefault();
                                                deleteSecurityControl(control);
                                                if (isSelected) {
                                                    updateProcedure(proc.id, 'securityControls', mappedControls.filter(c => c !== control));
                                                }
                                            }}
                                            style={{
                                                background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px'
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                                            title="Delete Control"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>, document.getElementById('root'))}
        </div>
    );
}
