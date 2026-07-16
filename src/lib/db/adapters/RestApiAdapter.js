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

// src/lib/db/adapters/RestApiAdapter.js
import { DatabaseAdapter } from '../core.js';

export class RestApiAdapter extends DatabaseAdapter {
    constructor(config) {
        super(config);
        this.type = 'rest';
        // Configuration expects: { endpoint: string, apiKey: string }
        this.endpoint = config.endpoint?.replace(/\/$/, ''); // Remove trailing slash
        this.apiKey = config.apiKey;
        this.token = localStorage.getItem('token') || null;
        
        const storedRoles = localStorage.getItem('roles');
        this.roles = storedRoles ? JSON.parse(storedRoles) : null;
    }

    getHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        if (this.apiKey) headers['x-api-key'] = this.apiKey;
        if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
        return headers;
    }

    async checkAuth() {
        return !!this.token;
    }

    async fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(id);
            return response;
        } catch (err) {
            clearTimeout(id);
            throw err;
        }
    }

    initiateSso(role = 'admin') {
        const redirectUri = window.location.origin + window.location.pathname;
        window.location.href = `${this.endpoint}/auth/sso?role=${role}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    }

    async login(credentials) {
        if (!this.endpoint) throw new Error("REST API endpoint not configured.");
        const res = await fetch(`${this.endpoint}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(this.apiKey ? { 'x-api-key': this.apiKey } : {}) },
            body: JSON.stringify(credentials)
        });
        
        if (!res.ok) {
            const errBody = await res.text().catch(() => '');
            throw new Error(`Login failed (HTTP ${res.status}): ${errBody || res.statusText}`);
        }
        
        const data = await res.json();
        if (!data.token) throw new Error("Server did not return an authentication token.");
        
        this.token = data.token;
        this.roles = data.roles || [];
        localStorage.setItem('token', this.token);
        localStorage.setItem('roles', JSON.stringify(this.roles));
        return true;
    }

    async handleSsoCallback(token) {
        this.token = token;
        try {
            const payloadBase64 = token.split('.')[1];
            const payloadJson = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
            const payload = JSON.parse(payloadJson);
            const role = payload.role;
            this.roles = Array.isArray(role) ? role : (role ? [role] : []);
        } catch (e) {
            console.error("Failed to decode SSO token:", e);
            this.roles = [];
        }
        localStorage.setItem('token', this.token);
        localStorage.setItem('roles', JSON.stringify(this.roles));
        return true;
    }

    async login(credentials) {
        const res = await this.fetchWithTimeout(`${this.endpoint}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials)
        });
        if (!res.ok) throw new Error('Login failed. Check credentials or endpoint.');
        
        const data = await res.json();
        this.token = data.token;
        
        // Decode token using atob to extract role claim
        try {
            const payloadBase64 = this.token.split('.')[1];
            const payloadJson = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
            const payload = JSON.parse(payloadJson);
            const role = payload.role;
            this.roles = Array.isArray(role) ? role : (role ? [role] : []);
        } catch (e) {
            console.error("Failed to decode token on login:", e);
            this.roles = [];
        }
        
        localStorage.setItem('token', this.token);
        localStorage.setItem('roles', JSON.stringify(this.roles));
        return true;
    }

    async logout() {
        this.token = null;
        this.roles = null;
        localStorage.removeItem('token');
        localStorage.removeItem('roles');
        return true;
    }

    async fetchData(key) {
        const res = await this.fetchWithTimeout(`${this.endpoint}/data/${key}`, { headers: this.getHeaders() });
        if (!res.ok) {
            if (res.status === 404) return null;
            throw new Error(`Failed to fetch data for ${key} from remote database.`);
        }
        return await res.json();
    }

    async saveData(key, data) {
        const res = await this.fetchWithTimeout(`${this.endpoint}/data/${key}`, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(`Failed to save data for ${key} to remote database.`);
        return await res.json();
    }

    // Granular API methods
    async fetchExercises(page = 1, limit = 50, simulation = '') {
        let url = `${this.endpoint}/api/exercises?page=${page}&limit=${limit}`;
        if (simulation) {
            url += `&simulation=${encodeURIComponent(simulation)}`;
        }
        url += `&sort=date&order=desc`;
        
        const res = await this.fetchWithTimeout(url, { headers: this.getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch exercises');
        return await res.json();
    }

    async fetchSimulations() {
        const res = await this.fetchWithTimeout(`${this.endpoint}/api/simulations`, { headers: this.getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch simulations');
        return await res.json();
    }

    async createExercise(exercise) {
        const res = await this.fetchWithTimeout(`${this.endpoint}/api/exercises`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(exercise)
        });
        if (!res.ok) throw new Error('Failed to create exercise');
        return await res.json();
    }

    async fetchGaps() {
        const res = await this.fetchWithTimeout(`${this.endpoint}/api/gaps`, { headers: this.getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch gaps');
        return await res.json();
    }

    async createGap(gap) {
        const res = await this.fetchWithTimeout(`${this.endpoint}/api/gaps`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(gap)
        });
        if (!res.ok) throw new Error('Failed to create gap');
        return await res.json();
    }

    async updateGap(id, gap) {
        const res = await this.fetchWithTimeout(`${this.endpoint}/api/gaps/${id}`, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify(gap)
        });
        if (!res.ok) throw new Error('Failed to update gap');
        return await res.json();
    }

    async deleteGap(id) {
        const res = await this.fetchWithTimeout(`${this.endpoint}/api/gaps/${id}`, {
            method: 'DELETE',
            headers: this.getHeaders()
        });
        if (!res.ok) throw new Error('Failed to delete gap');
        return await res.json();
    }

    async bulkUpdateGaps(gaps) {
        const res = await this.fetchWithTimeout(`${this.endpoint}/api/gaps`, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify(gaps)
        });
        if (!res.ok) throw new Error('Failed to bulk update gaps');
        return await res.json();
    }

    // --- Relational Simulations Methods ---
    
    async fetchSimulationsData() {
        try {
            const res = await this.fetchWithTimeout(`${this.endpoint}/api/simulations`, { headers: this.getHeaders() });
            if (!res.ok) return [];
            return await res.json();
        } catch (e) {
            console.warn("REST API simulations endpoint not found. Returning empty array.");
            return [];
        }
    }

    async upsertSimulation(simulationData) {
        const res = await this.fetchWithTimeout(`${this.endpoint}/api/simulations`, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify(simulationData)
        });
        if (!res.ok) throw new Error('Failed to upsert simulation');
        return await res.json();
    }

    async bulkImport(backupData) {
        const res = await this.fetchWithTimeout(`${this.endpoint}/api/bulk-import`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(backupData)
        });
        if (!res.ok) throw new Error('Failed to bulk import backup data');
        return await res.json();
    }
}
