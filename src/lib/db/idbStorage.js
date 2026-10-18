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

const DB_NAME = 'control_drift_db';
const DB_VERSION = 1;
const STORE_NAME = 'kv_store';

const MIGRATION_KEYS = [
    'events',
    'gaps',
    'simulations_table',
    'mitre_coverage',
    'mitre_data_v4'
];

let dbPromise = null;

function isIdbSupported() {
    return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function notifyOtherTabs(key) {
    try {
        localStorage.setItem('control_drift_sync_ping', JSON.stringify({ key, ts: Date.now() }));
    } catch (_) {
        // Ignore if localStorage is unavailable
    }
}

function openDatabase() {
    if (!isIdbSupported()) {
        return Promise.resolve(null);
    }
    if (dbPromise) {
        return dbPromise;
    }

    dbPromise = new Promise((resolve) => {
        try {
            const request = window.indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };

            request.onsuccess = async (event) => {
                const db = event.target.result;
                await migrateFromLocalStorage(db);
                resolve(db);
            };

            request.onerror = (event) => {
                console.warn('IndexedDB open failed, falling back to localStorage:', event.target?.error);
                resolve(null);
            };
        } catch (err) {
            console.warn('IndexedDB initialization error, falling back to localStorage:', err);
            resolve(null);
        }
    });

    return dbPromise;
}

function rawIdbGet(db, key) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result !== undefined ? req.result : null);
        req.onerror = () => reject(req.error);
    });
}

function rawIdbSet(db, key, value) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(value, key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error || req.error);
    });
}

function rawIdbDelete(db, key) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error || req.error);
    });
}

/**
 * One-time automatic migration of existing localStorage datasets into IndexedDB.
 * Also reconciles any legacy 'simulationSummaries' / 'simulation_summaries' keys
 * into 'simulations_table' and frees up the 5MB localStorage quota.
 */
async function migrateFromLocalStorage(db) {
    try {
        // 1. Reconcile legacy simulation summary keys with simulations_table if present in localStorage
        const rawTable = localStorage.getItem('simulations_table');
        const rawLegacy = localStorage.getItem('simulation_summaries') || localStorage.getItem('simulationSummaries');
        if (rawLegacy) {
            try {
                const legacySummaries = JSON.parse(rawLegacy);
                const rows = rawTable ? JSON.parse(rawTable) : [];
                if (legacySummaries && typeof legacySummaries === 'object' && !Array.isArray(legacySummaries)) {
                    const rowMap = new Map(( Array.isArray(rows) ? rows : [] ).map(r => [r.id, r]));
                    Object.entries(legacySummaries).forEach(([id, summary]) => {
                        const existing = rowMap.get(id);
                        rowMap.set(id, {
                            id,
                            summary,
                            evidence: existing?.evidence || []
                        });
                    });
                    const existingIdb = await rawIdbGet(db, 'simulations_table');
                    if (Array.isArray(existingIdb)) {
                        existingIdb.forEach(r => {
                            if (r && r.id && !rowMap.has(r.id)) {
                                rowMap.set(r.id, r);
                            }
                        });
                    }
                    await rawIdbSet(db, 'simulations_table', Array.from(rowMap.values()));
                }
            } catch (e) {
                console.warn('Legacy simulation summaries migration warning:', e);
            }
            localStorage.removeItem('simulationSummaries');
            localStorage.removeItem('simulation_summaries');
            localStorage.removeItem('simulationEvidence');
        }

        // 2. Migrate standard keys from localStorage to IndexedDB if present
        for (const key of MIGRATION_KEYS) {
            const rawVal = localStorage.getItem(key);
            if (rawVal !== null) {
                try {
                    const parsed = JSON.parse(rawVal);
                    const existingInIdb = await rawIdbGet(db, key);
                    if (existingInIdb === null) {
                        await rawIdbSet(db, key, parsed);
                    }
                    localStorage.removeItem(key);
                } catch (e) {
                    console.warn(`Failed to migrate key "${key}" from localStorage to IndexedDB:`, e);
                }
            }
        }
    } catch (err) {
        console.warn('Error during localStorage -> IndexedDB migration:', err);
    }
}

export async function idbGet(key) {
    const db = await openDatabase();
    if (db) {
        try {
            const val = await rawIdbGet(db, key);
            if (val !== null) return val;
        } catch (err) {
            console.warn(`idbGet("${key}") failed, checking localStorage fallback:`, err);
        }
    }
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch (_) {
        return null;
    }
}

export async function idbSet(key, value, options = { notifySync: true }) {
    const db = await openDatabase();
    if (db) {
        try {
            // Ensure value is a clean cloneable JSON structure
            const cleanValue = value !== undefined ? JSON.parse(JSON.stringify(value)) : null;
            await rawIdbSet(db, key, cleanValue);
            if (options?.notifySync) {
                notifyOtherTabs(key);
            }
            return true;
        } catch (e) {
            if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                window.dispatchEvent(new Event('storage_quota_exceeded'));
                throw new Error('STORAGE_QUOTA_EXCEEDED');
            }
            console.warn(`idbSet("${key}") failed, falling back to localStorage:`, e);
        }
    }

    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (e) {
        if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            window.dispatchEvent(new Event('storage_quota_exceeded'));
            throw new Error('STORAGE_QUOTA_EXCEEDED');
        }
        throw e;
    }
}

export async function idbDelete(key, options = { notifySync: true }) {
    const db = await openDatabase();
    if (db) {
        try {
            await rawIdbDelete(db, key);
        } catch (e) {
            console.warn(`idbDelete("${key}") error:`, e);
        }
    }
    localStorage.removeItem(key);
    if (options?.notifySync) {
        notifyOtherTabs(key);
    }
    return true;
}
