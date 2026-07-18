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

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, Globe, Plus, Search } from 'lucide-react';
import { useAppContext } from '../../AppContext';

export default function InlineEnvironmentDropdown({ value, onChange }) {
    const { targetEnvironments, addEnvironment } = useAppContext();
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = useRef(null);
    const inputRef = useRef(null);

    // Ensure targetEnvironments is an array
    const environmentsList = Array.isArray(targetEnvironments) ? targetEnvironments : [];
    
    // Normalize value to array
    const selectedArray = Array.isArray(value) ? value : (value ? [value] : []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
                setSearchQuery('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleSelection = (envName) => {
        if (selectedArray.includes(envName)) {
            onChange(selectedArray.filter(v => v !== envName));
        } else {
            onChange([...selectedArray, envName]);
        }
    };

    const handleCreate = (e) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;
        const newEnv = searchQuery.trim();
        addEnvironment(newEnv);
        toggleSelection(newEnv);
        setSearchQuery('');
        setIsOpen(false);
    };

    let displayText = "Select or Create Environment...";
    if (selectedArray.length === 1) {
        displayText = selectedArray[0];
    } else if (selectedArray.length > 1) {
        displayText = selectedArray.join(', ');
    }

    const filteredEnvironments = useMemo(() => {
        return environmentsList.filter(env => env.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [environmentsList, searchQuery]);

    const exactMatchExists = environmentsList.some(env => env.toLowerCase() === searchQuery.trim().toLowerCase());

    return (
        <div ref={dropdownRef} style={{ position: 'relative', display: 'block', width: '100%' }}>
            <div 
                onClick={(e) => { 
                    e.preventDefault(); 
                    if (!isOpen) {
                        setIsOpen(true);
                        setTimeout(() => inputRef.current?.focus(), 50);
                    } else {
                        setIsOpen(false);
                    }
                }}
                style={{ 
                    display: 'flex', alignItems: 'center', gap: '10px', 
                    background: 'rgba(0, 0, 0, 0.5)', 
                    border: isOpen ? '1px solid var(--accent-secondary)' : '1px solid rgba(255,255,255,0.1)', 
                    borderRadius: '8px', padding: '12px 16px', 
                    color: 'var(--text-primary)', cursor: 'text',
                    boxShadow: isOpen ? '0 0 10px rgba(56, 189, 248, 0.2)' : 'none',
                    transition: 'all 0.2s ease',
                    width: '100%', boxSizing: 'border-box', justifyContent: 'space-between',
                    overflow: 'hidden'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden', flex: 1 }}>
                    <Globe size={18} color="var(--accent-secondary)" style={{ flexShrink: 0 }} />
                    {isOpen ? (
                        <input
                            ref={inputRef}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="Type to search or create..."
                            style={{ 
                                background: 'transparent', border: 'none', color: 'var(--text-primary)', 
                                outline: 'none', flex: 1, fontSize: '0.9rem', width: '100%'
                            }}
                        />
                    ) : (
                        <span style={{ 
                            fontSize: '0.9rem', 
                            fontWeight: selectedArray.length > 0 ? '500' : 'normal', 
                            color: selectedArray.length > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                            whiteSpace: 'nowrap', 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis' 
                        }}>
                            {displayText}
                        </span>
                    )}
                </div>
                <div style={{ flexShrink: 0, display: 'flex', cursor: 'pointer' }}>
                    <ChevronDown size={18} color="var(--text-muted)" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
                </div>
            </div>

            {isOpen && (
                <div className="animate-fade-in" style={{ 
                    position: 'absolute', top: 'calc(100% + 5px)', left: 0, 
                    background: 'rgba(15, 17, 26, 0.98)', backdropFilter: 'blur(16px)',
                    border: '1px solid var(--accent-secondary)', borderRadius: '8px',
                    padding: '8px', zIndex: 1000,
                    boxShadow: '0 10px 40px rgba(0,0,0,0.5), inset 0 0 15px rgba(56, 189, 248, 0.1)',
                    width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '4px',
                    maxHeight: '300px', overflowY: 'auto'
                }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', padding: '8px 12px 4px', fontWeight: 'bold' }}>
                        Target Environments
                    </div>
                    
                    {filteredEnvironments.map(envName => {
                        const isActive = selectedArray.includes(envName);
                        return (
                            <button
                                key={envName}
                                onClick={(e) => { 
                                    e.preventDefault(); 
                                    toggleSelection(envName); 
                                    const isDeselecting = selectedArray.includes(envName);
                                    if (!(isDeselecting && selectedArray.length > 1)) {
                                        setIsOpen(false); 
                                        setSearchQuery(''); 
                                    }
                                }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'space-between',
                                    background: isActive ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                                    border: isActive ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid transparent',
                                    padding: '10px 12px', borderRadius: '6px',
                                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                                    cursor: 'pointer', textAlign: 'left',
                                    transition: 'all 0.15s ease',
                                    width: '100%'
                                }}
                                onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
                                onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <Globe size={16} color={isActive ? "var(--accent-secondary)" : "currentColor"} />
                                    <span style={{ fontSize: '0.95rem' }}>{envName}</span>
                                </div>
                                {isActive && <Check size={16} color="var(--accent-secondary)" />}
                            </button>
                        );
                    })}

                    {searchQuery.trim().length > 0 && !exactMatchExists && (
                        <button
                            onClick={handleCreate}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '12px',
                                background: 'rgba(16, 185, 129, 0.1)',
                                border: '1px dashed rgba(16, 185, 129, 0.4)',
                                padding: '10px 12px', borderRadius: '6px',
                                color: '#10b981',
                                cursor: 'pointer', textAlign: 'left',
                                transition: 'all 0.15s ease',
                                width: '100%', marginTop: '5px'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(16, 185, 129, 0.2)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)'; }}
                        >
                            <Plus size={16} />
                            <span style={{ fontSize: '0.95rem', fontWeight: 'bold' }}>Create "{searchQuery.trim()}"</span>
                        </button>
                    )}

                    {filteredEnvironments.length === 0 && !searchQuery && (
                        <div style={{ padding: '15px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            <Search size={24} style={{ opacity: 0.5, marginBottom: '10px' }} />
                            <br/>
                            No environments exist yet.<br/>Type above to create one!
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
