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

// src/lib/db/core.js

// The base adapter interface that all database providers must implement
export class DatabaseAdapter {
    constructor(config) {
        this.config = config || {};
    }
    
    // Auth methods
    async checkAuth() { return true; } // Returns true if authenticated or if auth is not required
    async login(credentials) { throw new Error('Not implemented'); }
    async logout() { throw new Error('Not implemented'); }
    async signup(credentials) { throw new Error('Not implemented'); }

    // Data methods
    async fetchData(key) { throw new Error('Not implemented'); }
    async saveData(key, data) { throw new Error('Not implemented'); }
    
    // Granular Data methods
    async fetchExercises(page = 1, limit = 50, simulation = '') { throw new Error('Not implemented'); }
    async fetchSimulations() { throw new Error('Not implemented'); }
    async createExercise(exercise) { throw new Error('Not implemented'); }
    async fetchGaps() { throw new Error('Not implemented'); }
    async createGap(gap) { throw new Error('Not implemented'); }
    async updateGap(id, gap) { throw new Error('Not implemented'); }
    async deleteGap(id) { throw new Error('Not implemented'); }
    async bulkUpdateGaps(gaps) { throw new Error('Not implemented'); }
    // fetchMitreCoverage is omitted. Handled client-side.
    
    // Relational Simulations methods
    async fetchSimulationsData() { throw new Error('Not implemented'); }
    async upsertSimulation(simulationData) { throw new Error('Not implemented'); }
    async bulkImport(data) { throw new Error('Not implemented'); }
}

export const dbManager = {
    adapter: null,
    
    async initialize(provider, config) {
        switch(provider) {
            case 'local':
                const LocalStorageAdapter = (await import('./adapters/LocalStorageAdapter.js')).default;
                this.adapter = new LocalStorageAdapter(config);
                break;
            case 'supabase':
                const { SupabaseAdapter } = await import('./adapters/SupabaseAdapter.js');
                this.adapter = new SupabaseAdapter(config);
                break;
            case 'firebase':
                const { FirebaseAdapter } = await import('./adapters/FirebaseAdapter.js');
                this.adapter = new FirebaseAdapter(config);
                break;
            case 'rest':
                const { RestApiAdapter } = await import('./adapters/RestApiAdapter.js');
                this.adapter = new RestApiAdapter(config);
                break;
            default:
                const DefaultAdapter = (await import('./adapters/LocalStorageAdapter.js')).default;
                this.adapter = new DefaultAdapter(config);
        }
        return this.adapter;
    },

    get() {
        if (!this.adapter) {
            throw new Error('Database adapter not initialized.');
        }
        return this.adapter;
    }
};
