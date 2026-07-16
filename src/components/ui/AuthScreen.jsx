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

import React, { useState } from 'react';
import { Lock, Mail, Loader } from 'lucide-react';
import CustomLogo from './/CustomLogo';

export default function AuthScreen({ onLogin, dbAdapter }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');
        
        if (!email || !password) {
            setErrorMsg('Email and password are required.');
            return;
        }

        setIsLoading(true);
        try {
            if (!dbAdapter || typeof dbAdapter.login !== 'function') {
                throw new Error("Configured database adapter does not support login.");
            }
            await dbAdapter.login({ email, password });
            if (onLogin) await onLogin();
        } catch (err) {
            setErrorMsg(err.message || 'Authentication failed. Please check your credentials.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
            background: 'var(--bg-primary)', color: 'var(--text-primary)', zIndex: 999999
        }}>
            {/* Background elements to match app aesthetic */}
            <div className="bg-shape shape-1" />
            <div className="bg-shape shape-2" />
            <div className="bg-shape shape-3" />

            <div style={{ marginBottom: '30px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <CustomLogo style={{ filter: 'drop-shadow(0 0 10px rgba(156, 39, 176, 0.4))', marginBottom: '10px' }} />
                <p style={{ color: 'var(--text-secondary)' }}>Sign in to access your workspace</p>
            </div>

            <form onSubmit={handleSubmit} className="glass-panel animate-slide-up" style={{
                padding: '40px', width: '100%', maxWidth: '400px',
                display: 'flex', flexDirection: 'column', gap: '20px'
            }}>
                {errorMsg && (
                    <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', borderRadius: '8px', color: 'var(--danger)', fontSize: '0.9rem', textAlign: 'center' }}>
                        {errorMsg}
                    </div>
                )}

                <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Email</label>
                    <div style={{ position: 'relative' }}>
                        <Mail size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                        <input
                            type="email"
                            className="ai-input"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="operator@company.com"
                            style={{ width: '100%', boxSizing: 'border-box', padding: '12px 12px 12px 40px', background: 'rgba(0,0,0,0.4)', borderRadius: '8px' }}
                            required
                        />
                    </div>
                </div>

                <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Password</label>
                    <div style={{ position: 'relative' }}>
                        <Lock size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                        <input
                            type="password"
                            className="ai-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            style={{ width: '100%', boxSizing: 'border-box', padding: '12px 12px 12px 40px', background: 'rgba(0,0,0,0.4)', borderRadius: '8px' }}
                            required
                        />
                    </div>
                </div>

                <button 
                    type="submit" 
                    className="btn hover-lift" 
                    disabled={isLoading}
                    style={{ 
                        marginTop: '10px', width: '100%', padding: '12px', 
                        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px',
                        fontWeight: 'bold', fontSize: '1rem'
                    }}
                >
                    {isLoading ? <Loader size={20} className="spin" /> : 'Authenticate'}
                </button>
            </form>
        </div>
    );
}
