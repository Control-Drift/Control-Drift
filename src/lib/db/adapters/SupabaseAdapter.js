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

// src/lib/db/adapters/SupabaseAdapter.js
import { DatabaseAdapter } from '../core.js';

const DRAFT_NAMESPACE_PREFIX = '__draft__:';

export class SupabaseAdapter extends DatabaseAdapter {
    constructor(config) {
        super(config);
        this.type = 'supabase';
        
        const url = config.endpoint || config.supabaseUrl;
        const key = config.apiKey || config.supabaseAnonKey;
        
        if (!url || !key) {
            console.warn("Supabase URL and Anon Key are missing. Waiting for configuration.");
        }
        
        // Dynamic import workaround if the library isn't bundled yet
        this.initPromise = this._initClient(url, key);
        this.session = null;
    }

    async _initClient(url, key) {
        try {
            const { createClient } = await import('@supabase/supabase-js');
            this.supabase = createClient(url, key);
            
            // Check current session
            const { data: { session } } = await this.supabase.auth.getSession();
            this.session = session;
            
            // Listen for auth changes
            this.supabase.auth.onAuthStateChange((_event, session) => {
                this.session = session;
            });
        } catch(e) {
            console.error("Supabase SDK not found. Please run: npm install @supabase/supabase-js");
        }
    }

    async _fetchRoles(session) {
        this.roles = ['reader']; // Default to reader for security
        if (session && session.user) {
            try {
                const { data } = await this.supabase
                    .from('user_roles')
                    .select('role')
                    .eq('user_id', session.user.id)
                    .single();
                if (data && data.role) {
                    this.roles = [data.role];
                }
            } catch (err) {
                console.warn("Could not fetch user roles, defaulting to reader", err);
            }
        }
    }

    async checkAuth() {
        if (this.initPromise) await this.initPromise;
        if (!this.supabase) return false;
        const { data: { session } } = await this.supabase.auth.getSession();
        this.session = session;
        if (session) {
            await this._fetchRoles(session);
        }
        return !!session;
    }

    async login(credentials) {
        if (!this.supabase) throw new Error('Supabase client not initialized');
        const { email, password } = credentials;
        const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message);
        this.session = data.session;
        if (this.session) {
            await this._fetchRoles(this.session);
        }
        return true;
    }

    async logout() {
        if (!this.supabase) return;
        const { error } = await this.supabase.auth.signOut();
        if (error) throw new Error(error.message);
        this.session = null;
        return true;
    }

    initiateSso() {
        if (!this.supabase) return;
        const redirectUri = window.location.origin + window.location.pathname;
        this.supabase.auth.signInWithSSO({
            domain: 'your-corp-domain.com',
            options: {
                redirectTo: redirectUri
            }
        });
    }

    // --- Granular Data Methods mapped to Supabase PostgreSQL Tables ---

    async fetchEvents(page = 1, limit = 50, simulation = '') {
        let query = this.supabase
            .from('events')
            .select('*', { count: 'exact' });
            
        if (simulation) {
            query = query.eq('simulation', simulation);
        }
        
        const start = (page - 1) * limit;
        const end = start + limit - 1;
        
        const { data, count, error } = await query
            .order('date', { ascending: false })
            .range(start, end);
            
        if (error) throw new Error(error.message);
        return {
            data: data,
            total: count,
            page,
            limit,
            totalPages: Math.ceil(count / limit)
        };
    }

    async fetchSimulations() {
        const { data, error } = await this.supabase.rpc('get_distinct_simulations');
        if (error) {
            const { data: allData } = await this.supabase.from('events').select('simulation');
            const simulations = new Set();
            allData?.forEach(e => {
                if (e.simulation && !String(e.simulation).startsWith(DRAFT_NAMESPACE_PREFIX)) {
                    simulations.add(e.simulation);
                }
            });
            return Array.from(simulations);
        }
        const list = Array.isArray(data) ? data.map(d => d.simulation || d) : [];
        return list.filter(s => !String(s).startsWith(DRAFT_NAMESPACE_PREFIX));
    }

    async createEvent(eventObj) {
        const { data, error } = await this.supabase
            .from('events')
            .insert([eventObj])
            .select()
            .single();
            
        if (error) throw new Error(error.message);
        return data;
    }

    async updateEvent(id, eventData) {
        const { data, error } = await this.supabase
            .from('events')
            .update(eventData)
            .eq('id', id)
            .select()
            .single();
            
        if (error) throw new Error(error.message);
        return data;
    }

    async fetchGaps() {
        const { data, error } = await this.supabase.from('gaps').select('*');
        if (error) throw new Error(error.message);
        return data;
    }

    async createGap(gap) {
        const { data, error } = await this.supabase
            .from('gaps')
            .insert([gap])
            .select()
            .single();
            
        if (error) throw new Error(error.message);
        return data;
    }

    async updateGap(id, gapData) {
        const { data, error } = await this.supabase
            .from('gaps')
            .update(gapData)
            .eq('id', id)
            .select()
            .single();
            
        if (error) throw new Error(error.message);
        return data;
    }

    async deleteGap(id) {
        const { error } = await this.supabase.from('gaps').delete().eq('id', id);
        if (error) throw new Error(error.message);
        return { success: true };
    }

    async bulkUpdateGaps(updates) {
        const { error } = await this.supabase.from('gaps').upsert(updates);
        if (error) throw new Error(error.message);
        return { success: true };
    }

    // --- Relational Simulations Methods ---
    
    async fetchSimulationsData() {
        if (this.initPromise) await this.initPromise;
        if (!this.supabase) return [];
        const { data, error } = await this.supabase.from('simulations').select('*');
        if (error) {
            console.warn("simulations table not found or error. Returning empty arrays.", error.message);
            return [];
        }
        // Strictly exclude any namespaced in-progress draft rows so completed reports remain pristine
        return (data || []).filter(row => {
            const idStr = String(row?.id || '');
            if (idStr.startsWith(DRAFT_NAMESPACE_PREFIX)) return false;
            if (row?.summary && typeof row.summary === 'object' && row.summary.__isSimulationDraft) return false;
            return true;
        });
    }

    async upsertSimulation(simulationData) {
        if (this.initPromise) await this.initPromise;
        const { data, error } = await this.supabase
            .from('simulations')
            .upsert([simulationData])
            .select()
            .single();
            
        if (error) throw new Error(error.message);
        return data;
    }

    async deleteSimulation(id) {
        if (this.initPromise) await this.initPromise;
        // First delete associated events
        const { error: eventsError } = await this.supabase
            .from('events')
            .delete()
            .eq('simulation', id);
        if (eventsError) throw new Error(`Events deletion failed: ${eventsError.message}`);
        
        // Then delete associated gaps
        const { error: gapsError } = await this.supabase
            .from('gaps')
            .delete()
            .eq('simulation', id);
        if (gapsError) throw new Error(`Gaps deletion failed: ${gapsError.message}`);
        
        // Finally delete the simulation record itself
        const { error: simError } = await this.supabase
            .from('simulations')
            .delete()
            .eq('id', id);
        if (simError && simError.code !== '42P01') { 
            console.warn(`Simulation record deletion failed: ${simError.message}`);
        }
        
        return true;
    }

    // --- Dedicated In-Progress Simulation Drafts Section ---
    // Primary storage: dedicated `simulation_drafts` table in Supabase.
    // Zero-migration fallback: if `simulation_drafts` hasn't been created yet in SQL,
    // transparently stores under `__draft__:<id>` in `simulations` (isolated from reports).

    _normalizeDraftRecord(raw) {
        if (!raw) return null;
        // Case 1: Row from `simulation_drafts` table
        if (raw.data && typeof raw.data === 'object' && !raw.summary) {
            return {
                id: String(raw.id),
                name: raw.name || raw.data?.simulationDetails?.name || 'Unnamed Simulation',
                step: Number(raw.step || raw.data?.step || 1),
                timestamp: raw.updated_at || raw.timestamp || raw.created_at || new Date().toISOString(),
                data: raw.data,
                storageSource: 'supabase'
            };
        }
        // Case 2: Namespaced fallback row from `simulations` table
        if (raw.summary && typeof raw.summary === 'object' && raw.summary.__isSimulationDraft) {
            const s = raw.summary;
            const cleanId = String(s.id || String(raw.id || '').replace(DRAFT_NAMESPACE_PREFIX, ''));
            return {
                id: cleanId,
                name: s.name || s.data?.simulationDetails?.name || 'Unnamed Simulation',
                step: Number(s.step || s.data?.step || 1),
                timestamp: s.timestamp || s.updated_at || new Date().toISOString(),
                data: s.data || {},
                storageSource: 'supabase'
            };
        }
        return null;
    }

    async fetchDrafts() {
        if (this.initPromise) await this.initPromise;
        if (!this.supabase) return [];

        const draftMap = new Map();

        // 1. Try dedicated `simulation_drafts` table first
        try {
            const { data: tableDrafts, error: tableErr } = await this.supabase
                .from('simulation_drafts')
                .select('*')
                .order('updated_at', { ascending: false });

            if (!tableErr && Array.isArray(tableDrafts)) {
                tableDrafts.forEach(row => {
                    const norm = this._normalizeDraftRecord(row);
                    if (norm && norm.id) draftMap.set(norm.id, norm);
                });
            }
        } catch (err) {
            // Ignore if table doesn't exist yet; fallback below handles it
        }

        // 2. Also check namespaced `__draft__:` records in `simulations` so zero drafts are ever stranded
        try {
            const { data: nsDrafts, error: nsErr } = await this.supabase
                .from('simulations')
                .select('*')
                .like('id', `${DRAFT_NAMESPACE_PREFIX}%`);

            if (!nsErr && Array.isArray(nsDrafts)) {
                nsDrafts.forEach(row => {
                    const norm = this._normalizeDraftRecord(row);
                    if (norm && norm.id) {
                        const existing = draftMap.get(norm.id);
                        if (!existing || new Date(norm.timestamp) > new Date(existing.timestamp)) {
                            draftMap.set(norm.id, norm);
                        }
                    }
                });
            }
        } catch (err) {
            console.warn('Could not query namespaced drafts from Supabase:', err);
        }

        return Array.from(draftMap.values()).sort(
            (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
        );
    }

    async saveDraft(draft) {
        if (this.initPromise) await this.initPromise;
        if (!this.supabase) throw new Error('Supabase client not initialized');

        const cleanId = String(draft.id || Date.now()).replace(DRAFT_NAMESPACE_PREFIX, '');
        const nowIso = draft.timestamp || new Date().toISOString();
        const stepNum = Number(draft.step || draft.data?.step || 1);
        const draftName = draft.name || draft.data?.simulationDetails?.name || 'Unnamed Simulation';
        const draftPayload = draft.data || {};

        const dedicatedRow = {
            id: cleanId,
            name: draftName,
            step: stepNum,
            data: draftPayload,
            updated_at: nowIso
        };

        // 1. Attempt upsert into dedicated `simulation_drafts` table
        const { data: savedRow, error: tableErr } = await this.supabase
            .from('simulation_drafts')
            .upsert([dedicatedRow])
            .select()
            .single();

        if (!tableErr && savedRow) {
            // Clean up any legacy namespaced copy if it existed
            await this.supabase
                .from('simulations')
                .delete()
                .eq('id', `${DRAFT_NAMESPACE_PREFIX}${cleanId}`)
                .catch(() => {});

            return this._normalizeDraftRecord(savedRow);
        }

        // 2. Bulletproof Fallback: If `simulation_drafts` table hasn't been created in Supabase yet,
        // store in the isolated `__draft__:` partition of `simulations`
        const fallbackRow = {
            id: `${DRAFT_NAMESPACE_PREFIX}${cleanId}`,
            summary: {
                __isSimulationDraft: true,
                id: cleanId,
                name: draftName,
                step: stepNum,
                timestamp: nowIso,
                data: draftPayload
            },
            evidence: []
        };

        const { data: fbData, error: fbErr } = await this.supabase
            .from('simulations')
            .upsert([fallbackRow])
            .select()
            .single();

        if (fbErr) {
            throw new Error(`Failed to save draft to Supabase: ${fbErr.message}`);
        }

        return this._normalizeDraftRecord(fbData);
    }

    async deleteDraft(id) {
        if (this.initPromise) await this.initPromise;
        if (!this.supabase) throw new Error('Supabase client not initialized');

        const cleanId = String(id).replace(DRAFT_NAMESPACE_PREFIX, '');

        // Delete from dedicated `simulation_drafts` table (if present)
        const { error: tableErr } = await this.supabase
            .from('simulation_drafts')
            .delete()
            .eq('id', cleanId);

        if (tableErr && tableErr.code !== '42P01' && tableErr.code !== 'PGRST205') {
            console.warn('Warning deleting from simulation_drafts:', tableErr.message);
        }

        // Also delete from namespaced `simulations` fallback (if present)
        const { error: nsErr } = await this.supabase
            .from('simulations')
            .delete()
            .eq('id', `${DRAFT_NAMESPACE_PREFIX}${cleanId}`);

        if (nsErr && nsErr.code !== '42P01') {
            console.warn('Warning deleting namespaced draft:', nsErr.message);
        }

        return { success: true };
    }

    async bulkImport(backupData) {
        if (this.initPromise) await this.initPromise;
        // Run sequential bulk upserts for all core entities
        if (backupData.gaps && backupData.gaps.length > 0) {
            const { error: gapsErr } = await this.supabase.from('gaps').upsert(backupData.gaps);
            if (gapsErr) throw new Error(`Gaps Import Error: ${gapsErr.message}`);
        }
        
        if (backupData.events && backupData.events.length > 0) {
            const { error: eventsErr } = await this.supabase.from('events').upsert(backupData.events);
            if (eventsErr) throw new Error(`Events Import Error: ${eventsErr.message}`);
        }
        
        // Convert the dictionaries into relational rows
        const simulationRows = [];
        const summaries = backupData.simulationSummaries || {};
        const evidence = backupData.simulationEvidence || {};
        
        const allSimIds = new Set([...Object.keys(summaries), ...Object.keys(evidence)]);
        allSimIds.forEach(id => {
            simulationRows.push({
                id: id,
                summary: summaries[id] || '',
                evidence: evidence[id] || []
            });
        });
        
        if (simulationRows.length > 0) {
            const { error: simErr } = await this.supabase.from('simulations').upsert(simulationRows);
            if (simErr) throw new Error(`Simulations Import Error: ${simErr.message}`);
        }

        // Also import in-progress drafts if included in backup snapshot
        if (Array.isArray(backupData.simulationDrafts) && backupData.simulationDrafts.length > 0) {
            for (const draft of backupData.simulationDrafts) {
                try {
                    await this.saveDraft(draft);
                } catch (e) {
                    console.warn('Failed to import draft:', e);
                }
            }
        }
        
        return { success: true };
    }
}
