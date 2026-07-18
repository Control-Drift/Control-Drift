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

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../AppContext';
import { Search, Command, LayoutDashboard, Target, Shield, ListTodo, FileText, Settings, Hash, AlertCircle, ChevronRight } from 'lucide-react';

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const { gaps, mitreData } = useAppContext();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Build searchable items
  const items = [];
  
  // Navigation
  const navs = [
    { name: 'Dashboard', icon: <LayoutDashboard size={16} />, path: '/' },
    { name: 'Simulation Launcher', icon: <Target size={16} />, path: '/simulation' },
    { name: 'Security Posture', icon: <Shield size={16} />, path: '/posture' },
    { name: 'Gap Tracker', icon: <ListTodo size={16} />, path: '/gaps' },
    { name: 'Attack Path', icon: <Command size={16} />, path: '/attack-path' },
    { name: 'Reports', icon: <FileText size={16} />, path: '/reports' },
    { name: 'Settings', icon: <Settings size={16} />, path: '/settings' },
  ];
  items.push(...navs.map(n => ({ ...n, type: 'Navigation' })));

  // Gaps
  if (gaps && gaps.length) {
    items.push(...gaps.map(g => ({
        name: `View Gap: ${g.id}`,
        desc: g.details,
        icon: <AlertCircle size={16} color="var(--warning)" />,
        path: '/gaps',
        state: { openGapId: g.id },
        type: 'Tracked Gaps'
    })));
  }

  // MITRE (flattened)
  if (mitreData) {
      for (const [tacticName, tactic] of Object.entries(mitreData)) {
          if (tactic && tactic.techniques && Array.isArray(tactic.techniques)) {
              tactic.techniques.forEach(tech => {
                  items.push({
                      name: `${tech.id}: ${tech.name}`,
                      desc: tacticName,
                      icon: <Hash size={16} color="var(--accent-secondary)" />,
                      path: '/posture',
                      type: 'MITRE ATT&CK'
                  });
              });
          }
      }
  }

  // Filter
  const filtered = query.trim() === '' 
    ? items.filter(i => i.type === 'Navigation')
    : items.filter(i => 
        i.name.toLowerCase().includes(query.toLowerCase()) || 
        (i.desc && i.desc.toLowerCase().includes(query.toLowerCase()))
      ).slice(0, 15); // limit to 15 results

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const executeAction = (item) => {
      navigate(item.path, { state: item.state });
      setIsOpen(false);
  };

  const handleInputKeyDown = (e) => {
      if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex(prev => (prev < filtered.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === 'Enter' && filtered.length > 0) {
          e.preventDefault();
          executeAction(filtered[selectedIndex]);
      }
  };

  if (!isOpen) return null;

  return (
    <div className="animate-fade-in" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '10vh 20px' }} onClick={() => setIsOpen(false)}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '650px', background: 'var(--bg-secondary)', border: '1px solid var(--accent-primary)', padding: 0, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(156, 39, 176, 0.2)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
         
         <div style={{ display: 'flex', alignItems: 'center', padding: '15px 20px', borderBottom: '1px solid var(--glass-border)' }}>
             <Search size={20} color="var(--text-secondary)" style={{ marginRight: '15px' }} />
             <input 
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Search commands, techniques, or gaps... (Ctrl+K)"
                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '1.2rem', width: '100%', outline: 'none', fontFamily: 'inherit' }}
             />
             <div style={{ display: 'flex', gap: '5px', opacity: 0.5 }}>
                 <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: 'var(--glass-bg)', borderRadius: '4px', border: '1px solid var(--glass-border)' }}>ESC</span>
             </div>
         </div>

         <div style={{ maxHeight: '400px', overflowY: 'auto', padding: '10px 0' }}>
             {filtered.length === 0 ? (
                 <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                     No results found for "{query}"
                 </div>
             ) : (
                 <div style={{ display: 'flex', flexDirection: 'column' }}>
                     {['Navigation', 'Tracked Gaps', 'MITRE ATT&CK'].map(groupName => {
                         const groupItems = filtered.filter(i => i.type === groupName);
                         if (groupItems.length === 0) return null;
                         return (
                             <div key={groupName} style={{ marginBottom: '10px' }}>
                                 <div style={{ padding: '5px 20px', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>{groupName}</div>
                                 {groupItems.map(item => {
                                     const index = filtered.indexOf(item);
                                     const isSelected = index === selectedIndex;
                                     return (
                                         <div 
                                            key={item.name + index}
                                            style={{ 
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                                                padding: '12px 20px', cursor: 'pointer',
                                                background: isSelected ? 'rgba(156, 39, 176, 0.15)' : 'transparent',
                                                borderLeft: isSelected ? '3px solid var(--accent-primary)' : '3px solid transparent'
                                            }}
                                            onMouseEnter={() => setSelectedIndex(index)}
                                            onClick={() => executeAction(item)}
                                         >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                                <div style={{ color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>{item.icon}</div>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: isSelected ? 600 : 400 }}>{item.name}</span>
                                                    {item.desc && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '400px' }}>{item.desc}</span>}
                                                </div>
                                            </div>
                                            {isSelected && <ChevronRight size={16} color="var(--accent-secondary)" />}
                                         </div>
                                     );
                                 })}
                             </div>
                         );
                     })}
                 </div>
             )}
         </div>

         <div style={{ padding: '10px 20px', borderTop: '1px solid var(--glass-border)', background: 'var(--bg-primary)', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '15px' }}>
             <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><strong>&uarr;&darr;</strong> to navigate</span>
             <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><strong>&crarr;</strong> to select</span>
         </div>
      </div>
    </div>
  );
}
