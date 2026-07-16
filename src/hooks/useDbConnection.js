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

import { useState, useEffect, useCallback } from 'react';
import { dbManager } from '../lib/db/core';
import { obfuscate, deobfuscate } from '../lib/obfuscator';

export function useDbConnection() {
    const [dbConfig, setDbConfig] = useState({ provider: 'local', endpoint: '', apiKey: '' });
    const [dbAdapter, setDbAdapter] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(true);
    const [isDbLoading, setIsDbLoading] = useState(true);
    const [userRole, setUserRole] = useState(null);

    const [globalAiConfig, setGlobalAiConfig] = useState(null);

    // Fetch deployment configuration globally (if provided by IT Admin)
    useEffect(() => {
        let isMounted = true;
        fetch('/config.json')
            .then(res => {
                if (!res.ok) throw new Error('config.json not found');
                return res.json();
            })
            .then(data => {
                if (isMounted && data) {
                    // Check for nested config format
                    if (data.database && data.database.provider) {
                        setDbConfig(prev => {
                            if (prev.provider !== data.database.provider || prev.endpoint !== data.database.endpoint || prev.apiKey !== data.database.apiKey) {
                                return { ...prev, ...data.database };
                            }
                            return prev;
                        });
                    } 
                    // Fallback to legacy flat format
                    else if (data.provider) {
                        setDbConfig(prev => {
                            if (prev.provider !== data.provider || prev.endpoint !== data.endpoint || prev.apiKey !== data.apiKey) {
                                return { ...prev, ...data };
                            }
                            return prev;
                        });
                    }
                    
                    if (data.ai) {
                        setGlobalAiConfig(data.ai);
                    }
                }
            })
            .catch(() => {
                // Silently fallback to localStorage if no global config exists
            });
        return () => { isMounted = false; };
    }, []);

    // Removed localStorage sync for enterprise config

    useEffect(() => {
        if (isAuthenticated && dbAdapter) {
            if (dbAdapter.roles && dbAdapter.roles.length > 0) {
                setUserRole(dbAdapter.roles[0]);
            } else {
                setUserRole('admin');
            }
        } else if (!isAuthenticated) {
            setUserRole(null);
        }
    }, [isAuthenticated, dbAdapter]);

    const initDb = useCallback(async (onLoadComplete) => {
        setIsDbLoading(true);
        try {
            const params = new URLSearchParams(window.location.search);
            const token = params.get('token');
            
            const adapter = await dbManager.initialize(dbConfig.provider, dbConfig);
            setDbAdapter(adapter);
            
            if (token) {
                const cleanUrl = window.location.origin + window.location.pathname;
                window.history.replaceState({}, document.title, cleanUrl);
                if (adapter.handleSsoCallback) {
                    await adapter.handleSsoCallback(token);
                }
            }
            
            const authOk = await adapter.checkAuth();
            setIsAuthenticated(authOk);
            
            if (authOk) {
                if (adapter.roles && adapter.roles.length > 0) {
                    setUserRole(adapter.roles[0]);
                } else {
                    setUserRole('admin');
                }
                if (onLoadComplete) await onLoadComplete(adapter);
            }
        } catch (e) {
            console.error("DB Init error", e);
        } finally {
            setIsDbLoading(false);
        }
    }, [dbConfig]);

    return {
        dbConfig,
        setDbConfig,
        dbAdapter,
        isAuthenticated,
        setIsAuthenticated,
        isDbLoading,
        userRole,
        initDb,
        globalAiConfig
    };
}
