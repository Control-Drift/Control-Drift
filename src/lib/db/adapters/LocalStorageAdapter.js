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

import { idbGet, idbSet, idbDelete } from '../idbStorage.js';

export default class LocalStorageAdapter {
    constructor() {
        this.type = 'local';
        this.STORAGE_KEY_EVENTS = 'events';
        this.STORAGE_KEY_GAPS = 'gaps';
        this.STORAGE_KEY_MITRE = 'mitre_coverage';
        this.STORAGE_KEY_SIMULATIONS = 'simulations_table';
        this.STORAGE_KEY_DRAFTS = 'wizard_drafts';
    }
    async checkAuth() { return true; }
    async login(credentials) { return true; }
    async logout() { return true; }
    async fetchData(key) {
        return await idbGet(key);
    }
    async saveData(key, data) {
        try {
            if (key === 'simulationSummaries' || key === 'simulation_summaries') {
                // Keep simulations_table in sync when callers pass a summaries dictionary
                const summariesObj = data && typeof data === 'object' ? data : {};
                const summaryIds = Object.keys(summariesObj);
                if (summaryIds.length === 0) {
                    await idbSet(this.STORAGE_KEY_SIMULATIONS, []);
                } else {
                    const current = await this.fetchSimulationsData();
                    const evidenceMap = {};
                    current.forEach(sim => {
                        if (sim && sim.id) evidenceMap[sim.id] = sim.evidence || [];
                    });
                    const updatedRows = summaryIds.map(id => ({
                        id,
                        summary: summariesObj[id] || {},
                        evidence: evidenceMap[id] || []
                    }));
                    await idbSet(this.STORAGE_KEY_SIMULATIONS, updatedRows);
                }
                await idbDelete('simulationSummaries', { notifySync: false });
                await idbDelete('simulation_summaries', { notifySync: false });
                return true;
            }
            if (key === 'simulationEvidence') {
                const evidenceObj = data && typeof data === 'object' ? data : {};
                const current = await this.fetchSimulationsData();
                const updatedRows = current.map(sim => ({
                    ...sim,
                    evidence: evidenceObj[sim.id] !== undefined ? evidenceObj[sim.id] : (sim.evidence || [])
                }));
                await idbSet(this.STORAGE_KEY_SIMULATIONS, updatedRows);
                await idbDelete('simulationEvidence', { notifySync: false });
                return true;
            }
            await idbSet(key, data);
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
        const data = await idbGet(this.STORAGE_KEY_SIMULATIONS);
        const rows = Array.isArray(data) ? data : [];

        // Reconcile any legacy/desynced keys ('simulationSummaries' / 'simulation_summaries') if present
        const legacySummaries = (await idbGet('simulation_summaries')) || (await idbGet('simulationSummaries'));
        if (legacySummaries && typeof legacySummaries === 'object' && !Array.isArray(legacySummaries)) {
            try {
                const rowMap = new Map(rows.map(r => [r.id, r]));
                Object.entries(legacySummaries).forEach(([id, summary]) => {
                    const existing = rowMap.get(id);
                    rowMap.set(id, {
                        id,
                        summary,
                        evidence: existing?.evidence || []
                    });
                });
                const merged = Array.from(rowMap.values());
                await idbSet(this.STORAGE_KEY_SIMULATIONS, merged, { notifySync: false });
                await idbDelete('simulationSummaries', { notifySync: false });
                await idbDelete('simulation_summaries', { notifySync: false });
                return merged;
            } catch (e) {
                console.warn('Failed to migrate legacy simulation summaries key:', e);
            }
        }

        return rows;
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
            await idbSet(this.STORAGE_KEY_SIMULATIONS, current);
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
            await idbSet(this.STORAGE_KEY_SIMULATIONS, filtered);
            await idbDelete('simulationSummaries', { notifySync: false });
            await idbDelete('simulation_summaries', { notifySync: false });
            
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

    // --- In-Progress Simulation Drafts Methods ---
    async fetchDrafts() {
        const idbDrafts = await idbGet(this.STORAGE_KEY_DRAFTS);
        let localDrafts = [];
        try {
            const rawLocal = localStorage.getItem(this.STORAGE_KEY_DRAFTS);
            if (rawLocal) localDrafts = JSON.parse(rawLocal);
        } catch (e) {
            // ignore
        }

        const mergedMap = new Map();
        (Array.isArray(localDrafts) ? localDrafts : []).forEach(d => {
            if (d && d.id) mergedMap.set(String(d.id), { ...d, storageSource: d.storageSource || 'local' });
        });
        (Array.isArray(idbDrafts) ? idbDrafts : []).forEach(d => {
            if (d && d.id) {
                const existing = mergedMap.get(String(d.id));
                if (!existing || new Date(d.timestamp || 0) >= new Date(existing.timestamp || 0)) {
                    mergedMap.set(String(d.id), { ...d, storageSource: d.storageSource || 'local' });
                }
            }
        });

        const sorted = Array.from(mergedMap.values()).sort(
            (a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0)
        );
        return sorted;
    }

    async saveDraft(draft) {
        const current = await this.fetchDrafts();
        const cleanId = String(draft.id || Date.now());
        const record = {
            id: cleanId,
            name: draft.name || draft.data?.simulationDetails?.name || 'Unnamed Simulation',
            step: Number(draft.step || draft.data?.step || 1),
            timestamp: draft.timestamp || new Date().toISOString(),
            data: draft.data || {},
            storageSource: 'local'
        };

        const updated = current.some(d => String(d.id) === cleanId)
            ? current.map(d => (String(d.id) === cleanId ? record : d))
            : [record, ...current];

        await idbSet(this.STORAGE_KEY_DRAFTS, updated);
        try {
            localStorage.setItem(this.STORAGE_KEY_DRAFTS, JSON.stringify(updated));
        } catch (e) {
            // Ignore localStorage quota if large evidence/payloads are in IndexedDB
        }
        return record;
    }

    async deleteDraft(id) {
        const current = await this.fetchDrafts();
        const cleanId = String(id);
        const updated = current.filter(d => String(d.id) !== cleanId);
        await idbSet(this.STORAGE_KEY_DRAFTS, updated);
        try {
            localStorage.setItem(this.STORAGE_KEY_DRAFTS, JSON.stringify(updated));
        } catch (e) {
            // Ignore
        }
        return { success: true };
    }

    async bulkImport(backupData) {
        try {
            if (backupData.gaps) await idbSet(this.STORAGE_KEY_GAPS, backupData.gaps, { notifySync: false });
            if (backupData.events) await idbSet(this.STORAGE_KEY_EVENTS, backupData.events, { notifySync: false });
            if (Array.isArray(backupData.simulationDrafts)) {
                await idbSet(this.STORAGE_KEY_DRAFTS, backupData.simulationDrafts, { notifySync: false });
                try {
                    localStorage.setItem(this.STORAGE_KEY_DRAFTS, JSON.stringify(backupData.simulationDrafts));
                } catch (e) {}
            }
            
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
            await idbSet(this.STORAGE_KEY_SIMULATIONS, simulationRows, { notifySync: true });
            await idbDelete('simulationSummaries', { notifySync: false });
            await idbDelete('simulation_summaries', { notifySync: false });
            await idbDelete('simulationEvidence', { notifySync: false });
            
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
