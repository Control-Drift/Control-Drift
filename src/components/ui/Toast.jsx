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

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { X, CheckCircle, AlertTriangle, Info, AlertOctagon, Zap } from 'lucide-react';

const ToastContext = createContext(null);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

const Toast = ({ message, type, id, onClose }) => {
    const duration = 5000;
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose(id);
        }, duration);
        return () => clearTimeout(timer);
    }, [id, onClose]);

    let glowColor = 'rgba(59, 130, 246, 0.8)'; // blue for info
    let icon = <Info size={18} color="#60a5fa" />;
    let typeLabel = "SYSTEM INFO";

    if (type === 'success') {
        glowColor = 'rgba(16, 185, 129, 0.8)';
        icon = <CheckCircle size={18} color="#34d399" />;
        typeLabel = "OPERATION SUCCESS";
    } else if (type === 'error') {
        glowColor = 'rgba(239, 68, 68, 0.8)';
        icon = <AlertOctagon size={18} color="#f87171" />;
        typeLabel = "CRITICAL FAILURE";
    } else if (type === 'warning') {
        glowColor = 'rgba(245, 158, 11, 0.8)';
        icon = <AlertTriangle size={18} color="#fbbf24" />;
        typeLabel = "WARNING";
    }

    return (
        <div style={{
            position: 'relative',
            background: 'rgba(10, 11, 16, 0.85)',
            backdropFilter: 'blur(16px)',
            borderRadius: '10px',
            marginBottom: '15px',
            minWidth: '320px',
            maxWidth: '420px',
            animation: 'toastSlideIn 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)',
            boxShadow: `0 10px 40px rgba(0, 0, 0, 0.5), 0 0 15px ${glowColor.replace('0.8', '0.15')}`,
            overflow: 'hidden',
            border: `1px solid rgba(255, 255, 255, 0.08)`
        }}>
            {/* Top glowing accent line */}
            <div style={{ height: '2px', width: '100%', background: `linear-gradient(90deg, transparent, ${glowColor}, transparent)` }}></div>
            
            <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: '15px' }}>
                <div style={{ 
                    marginTop: '2px', 
                    background: glowColor.replace('0.8', '0.1'), 
                    padding: '8px', 
                    borderRadius: '8px',
                    boxShadow: `inset 0 0 10px ${glowColor.replace('0.8', '0.2')}`
                }}>
                    {icon}
                </div>
                
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '1.5px', color: glowColor.replace('0.8', '1'), fontFamily: "'Orbitron', sans-serif" }}>
                        {typeLabel}
                    </div>
                    <p style={{ margin: 0, fontSize: '0.95rem', color: 'rgba(255,255,255,0.9)', lineHeight: '1.5', textShadow: '0 2px 4px rgba(0,0,0,0.5)', overflowWrap: 'anywhere' }}>
                        {message}
                    </p>
                </div>

                <button onClick={() => onClose(id)} style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'rgba(255,255,255,0.4)',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '4px',
                    transition: 'all 0.2s',
                }} onMouseOver={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }} onMouseOut={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.background = 'transparent'; }}>
                    <X size={16} />
                </button>
            </div>

            {/* Auto-dismiss progress bar */}
            <div style={{
                position: 'absolute',
                bottom: 0, left: 0, height: '3px',
                background: glowColor,
                animation: `toastProgress ${duration}ms linear forwards`,
                opacity: 0.8
            }}></div>
        </div>
    );
};

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = 'info') => {
        const id = Math.random().toString(36).substr(2, 9);
        setToasts(prev => [...prev, { id, message, type }]);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const contextValue = React.useMemo(() => ({ addToast }), [addToast]);

    return (
        <ToastContext.Provider value={contextValue}>
            {children}
            <div style={{
                position: 'fixed',
                top: '30px',
                right: '30px',
                zIndex: 99999,
                display: 'flex',
                flexDirection: 'column',
                pointerEvents: 'none'
            }}>
                <style>{`
                    @keyframes toastSlideIn {
                        from { transform: translateX(120%) scale(0.9); opacity: 0; filter: blur(10px); }
                        to { transform: translateX(0) scale(1); opacity: 1; filter: blur(0); }
                    }
                    @keyframes toastProgress {
                        from { width: 100%; }
                        to { width: 0%; }
                    }
                `}</style>
                {toasts.map(t => (
                    <div key={t.id} style={{ pointerEvents: 'auto' }}>
                        <Toast {...t} onClose={removeToast} />
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};
