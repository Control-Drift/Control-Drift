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

export default class LocalStorageAdapter {
    constructor() {
        this.type = 'local';
        this.STORAGE_KEY_EVENTS = 'events';
        this.STORAGE_KEY_GAPS = 'gaps';
        this.STORAGE_KEY_MITRE = 'mitre_coverage';
    }
    async checkAuth() { return true; }
    async login(credentials) { return true; }
    async logout() { return true; }
    async fetchData(key) {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    }
    async saveData(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (e) {
            if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                window.dispatchEvent(new Event('storage_quota_exceeded'));
                throw new Error('STORAGE_QUOTA_EXCEEDED');
            }
            throw e;
        }
    }
    async fetchGaps() { return await this.fetchData(this.STORAGE_KEY_GAPS) || []; }
    async saveGaps(gaps) { return await this.saveData(this.STORAGE_KEY_GAPS, gaps); }
    // fetchMitreCoverage is omitted. Handled client-side.
    async saveMitreCoverage(coverage) { return await this.saveData(this.STORAGE_KEY_MITRE, coverage); }

    // --- Relational Simulations Methods ---
    async fetchEvents(page = 1, limit = 50, simulation = '') {
        let all = await this.fetchData(this.STORAGE_KEY_EVENTS) || [];
        if (simulation) {
            all = all.filter(e => e.simulation === simulation);
        }
        all.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        const start = (page - 1) * limit;
        const end = start + limit;
        const sliced = all.slice(start, end);
        
        return {
            data: sliced,
            total: all.length,
            page,
            limit,
            totalPages: Math.ceil(all.length / limit)
        };
    }

    async fetchSimulations() {
        const all = await this.fetchData(this.STORAGE_KEY_EVENTS) || [];
        const simulations = new Set();
        all.forEach(e => { if (e.simulation) simulations.add(e.simulation); });
        return Array.from(simulations);
    }
    
    async fetchSimulationsData() {
        const data = localStorage.getItem('simulations_table');
        return data ? JSON.parse(data) : [];
    }

    async upsertSimulation(simulationData) {
        const current = await this.fetchSimulationsData();
        const index = current.findIndex(s => s.id === simulationData.id);
        if (index > -1) {
            current[index] = { ...current[index], ...simulationData };
        } else {
            current.push(simulationData);
        }
        try {
            localStorage.setItem('simulations_table', JSON.stringify(current));
            return simulationData;
        } catch (e) {
            if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                window.dispatchEvent(new Event('storage_quota_exceeded'));
                throw new Error('STORAGE_QUOTA_EXCEEDED');
            }
            throw e;
        }
    }

    async deleteSimulation(id) {
        const current = await this.fetchSimulationsData();
        const cleanId = (id || '').toString().trim().toLowerCase();
        const filtered = current.filter(s => (s.id || '').toString().trim().toLowerCase() !== cleanId);
        try {
            localStorage.setItem('simulations_table', JSON.stringify(filtered));
            
            // Clean up all related events
            const events = await this.fetchData(this.STORAGE_KEY_EVENTS) || [];
            const remainingEvents = events.filter(e => (e.simulation || '').toString().trim().toLowerCase() !== cleanId);
            await this.saveData(this.STORAGE_KEY_EVENTS, remainingEvents);
            
            // Clean up all related gaps
            const gaps = await this.fetchData(this.STORAGE_KEY_GAPS) || [];
            const remainingGaps = gaps.filter(g => (g.simulation || '').toString().trim().toLowerCase() !== cleanId);
            await this.saveData(this.STORAGE_KEY_GAPS, remainingGaps);
            
            return true;
        } catch (e) {
            if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                window.dispatchEvent(new Event('storage_quota_exceeded'));
                throw new Error('STORAGE_QUOTA_EXCEEDED');
            }
            throw e;
        }
    }

    async bulkImport(backupData) {
        try {
            if (backupData.gaps) localStorage.setItem(this.STORAGE_KEY_GAPS, JSON.stringify(backupData.gaps));
            if (backupData.events) localStorage.setItem(this.STORAGE_KEY_EVENTS, JSON.stringify(backupData.events));
            
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
            localStorage.setItem('simulations_table', JSON.stringify(simulationRows));
            
            return { success: true };
        } catch (e) {
            if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                window.dispatchEvent(new Event('storage_quota_exceeded'));
                throw new Error('STORAGE_QUOTA_EXCEEDED');
            }
            throw e;
        }
    }
}
