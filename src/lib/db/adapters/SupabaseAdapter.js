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

// We import this dynamically or assume the user has installed @supabase/supabase-js
// import { createClient } from '@supabase/supabase-js';

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

    async fetchExercises(page = 1, limit = 50, simulation = '') {
        let query = this.supabase
            .from('exercises')
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
        // In a real schema, simulations might be a separate table.
        // For simplicity, doing a distinct select if supported, or falling back to a function.
        const { data, error } = await this.supabase.rpc('get_distinct_simulations');
        if (error) {
            // Fallback: fetch all and extract (not efficient for large datasets)
            const { data: allData } = await this.supabase.from('exercises').select('simulation');
            const simulations = new Set();
            allData?.forEach(e => { if (e.simulation) simulations.add(e.simulation); });
            return Array.from(simulations);
        }
        return Array.isArray(data) ? data.map(d => d.simulation || d) : data;
    }

    async createExercise(exercise) {
        const { data, error } = await this.supabase
            .from('exercises')
            .insert([exercise])
            .select()
            .single();
            
        if (error) throw new Error(error.message);
        return data;
    }

    async updateExercise(id, exerciseData) {
        const { data, error } = await this.supabase
            .from('exercises')
            .update(exerciseData)
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
        // Supabase supports bulk upsert
        const { error } = await this.supabase.from('gaps').upsert(updates);
        if (error) throw new Error(error.message);
        return { success: true };
    }

    // fetchMitreCoverage is omitted. The application will use client-side mitreDataCalculated
    // which accurately computes coverage locally from fetched exercises.

    // --- Relational Simulations Methods ---
    
    async fetchSimulationsData() {
        const { data, error } = await this.supabase.from('simulations').select('*');
        if (error) {
            console.warn("simulations table not found or error. Returning empty arrays.", error.message);
            return [];
        }
        return data;
    }

    async upsertSimulation(simulationData) {
        const { data, error } = await this.supabase
            .from('simulations')
            .upsert([simulationData])
            .select()
            .single();
            
        if (error) throw new Error(error.message);
        return data;
    }

    async bulkImport(backupData) {
        // Run sequential bulk upserts for all 3 core entities
        if (backupData.gaps && backupData.gaps.length > 0) {
            const { error: gapsErr } = await this.supabase.from('gaps').upsert(backupData.gaps);
            if (gapsErr) throw new Error(`Gaps Import Error: ${gapsErr.message}`);
        }
        
        if (backupData.exercises && backupData.exercises.length > 0) {
            const { error: exercisesErr } = await this.supabase.from('exercises').upsert(backupData.exercises);
            if (exercisesErr) throw new Error(`Exercises Import Error: ${exercisesErr.message}`);
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
        
        return { success: true };
    }
}
