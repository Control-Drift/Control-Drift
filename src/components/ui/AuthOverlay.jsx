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
import { Lock, User, Key, Loader2, Database } from 'lucide-react';

export default function AuthOverlay({ dbAdapter, onLoginSuccess }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedRole, setSelectedRole] = useState('admin');

    const isLocalMode = dbAdapter && dbAdapter.constructor.name === 'LocalStorageAdapter';

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            await dbAdapter.login({ email: username, password, role: selectedRole });
            onLoginSuccess();
        } catch (err) {
            setError(err.message || 'Authentication failed. Please check your credentials.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSsoClick = () => {
        if (dbAdapter && typeof dbAdapter.initiateSso === 'function') {
            dbAdapter.initiateSso(selectedRole);
        } else {
            setError('SSO is not supported by the active database adapter.');
        }
    };

    return (
        <div className="animate-fade-in" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'radial-gradient(circle at 50% 30%, rgba(156, 39, 176, 0.15) 0%, rgba(10,10,12,0.98) 60%)', backdropFilter: 'blur(20px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ padding: '40px', width: '100%', maxWidth: '440px', margin: '0 20px', position: 'relative', background: '#0a0a0f', border: '1px solid rgba(190, 40, 210, 0.6)', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)' }}>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px', paddingBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ background: '#050508', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Database size={28} color="#00E5FF" />
                    </div>
                    <div>
                        <h2 style={{ color: '#ffffff', margin: 0, fontSize: '1.5rem', fontWeight: 'bold', letterSpacing: '0.02em' }}>
                            Workspace Locked
                        </h2>
                        <span style={{ color: '#00E5FF', fontSize: '0.8rem', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 'bold' }}>
                            Authentication Required
                        </span>
                    </div>
                </div>

                {error && (
                    <div className="animate-fade-in" style={{ background: 'rgba(239,68,68,0.1)', border: '1px dashed rgba(239,68,68,0.3)', color: '#ef4444', padding: '12px', borderRadius: '8px', marginBottom: '24px', fontSize: '0.9rem', textAlign: 'center' }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {isLocalMode ? (
                        <div>
                            <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Master Passphrase (AES-GCM Encryption)</label>
                            <div style={{ position: 'relative' }}>
                                <Key size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input 
                                    type="password" 
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    style={{ boxSizing: 'border-box', width: '100%', padding: '14px 14px 14px 48px', fontSize: '1rem', background: '#050508', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', color: '#ffffff', transition: 'border 0.2s', outline: 'none' }}
                                    onFocus={(e) => e.target.style.border = '1px solid #00E5FF'}
                                    onBlur={(e) => e.target.style.border = '1px solid rgba(255,255,255,0.05)'}
                                />
                            </div>
                        </div>
                    ) : (
                        <>
                            <div>
                                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Username</label>
                                <div style={{ position: 'relative' }}>
                                    <User size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input 
                                        type="text" 
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        required
                                        style={{ boxSizing: 'border-box', width: '100%', padding: '14px 14px 14px 48px', fontSize: '1rem', background: '#050508', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', color: '#ffffff', transition: 'border 0.2s', outline: 'none' }}
                                        onFocus={(e) => e.target.style.border = '1px solid #00E5FF'}
                                        onBlur={(e) => e.target.style.border = '1px solid rgba(255,255,255,0.05)'}
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</label>
                                <div style={{ position: 'relative' }}>
                                    <Key size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input 
                                        type="password" 
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        style={{ boxSizing: 'border-box', width: '100%', padding: '14px 14px 14px 48px', fontSize: '1rem', background: '#050508', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', color: '#ffffff', transition: 'border 0.2s', outline: 'none' }}
                                        onFocus={(e) => e.target.style.border = '1px solid #00E5FF'}
                                        onBlur={(e) => e.target.style.border = '1px solid rgba(255,255,255,0.05)'}
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assigned Role</label>
                                <select 
                                    value={selectedRole}
                                    onChange={(e) => setSelectedRole(e.target.value)}
                                    style={{ boxSizing: 'border-box', width: '100%', padding: '14px', fontSize: '1.05rem', background: '#050508', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', color: '#ffffff', outline: 'none', cursor: 'pointer' }}
                                >
                                    <option value="admin">Admin (Write / Read)</option>
                                    <option value="reader">Reader (Read-Only)</option>
                                </select>
                            </div>
                        </>
                    )}

                    <div style={{ paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '5px' }}>
                        <button 
                            type="submit" 
                            disabled={isLoading}
                            style={{ width: '100%', padding: '14px', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', opacity: isLoading ? 0.7 : 1, background: '#0a0a0f', color: '#ffffff', border: '1px solid rgba(190, 40, 210, 0.5)', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
                            onMouseOver={(e) => { if(!isLoading) { e.currentTarget.style.background = 'rgba(190, 40, 210, 0.1)'; e.currentTarget.style.boxShadow = '0 0 15px rgba(190, 40, 210, 0.2)'; } }}
                            onMouseOut={(e) => { e.currentTarget.style.background = '#0a0a0f'; e.currentTarget.style.boxShadow = 'none'; }}
                        >
                            {isLoading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Lock size={18} />}
                            {isLoading ? (isLocalMode ? 'Decrypting Storage...' : 'Authenticating...') : (isLocalMode ? 'Unlock Local Vault' : 'Unlock Workspace')}
                        </button>
                        
                        {!isLocalMode && (
                            <button 
                                type="button"
                                onClick={handleSsoClick}
                                disabled={isLoading}
                                style={{ width: '100%', padding: '14px', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', opacity: isLoading ? 0.7 : 1, background: '#0a0a0f', color: '#00E5FF', border: '1px solid rgba(0, 229, 255, 0.5)', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
                                onMouseOver={(e) => { if(!isLoading) { e.currentTarget.style.background = 'rgba(0, 229, 255, 0.1)'; e.currentTarget.style.boxShadow = '0 0 15px rgba(0, 229, 255, 0.2)'; } }}
                                onMouseOut={(e) => { e.currentTarget.style.background = '#0a0a0f'; e.currentTarget.style.boxShadow = 'none'; }}
                            >
                                <User size={18} />
                                Sign in with SAML/SSO
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}

