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

/**
 * Calculates the average coverage status for a given array of statuses based on strict rules.
 * 
 * Rules:
 * - If the array is completely empty of valid scores, returns 'unknown' or 'na'.
 * - If ALL elements are 'high', returns 'high'.
 * - If there are <= 2 elements, returns the lowest (pessimistic) score.
 * - If there are > 2 elements, calculates a weighted average (high=3, medium=2, minimal=1, low=0).
 * - A high average (>= 2.5) is downgraded to 'medium' if not ALL elements were 'high'.
 * 
 * @param {Array<string>} statuses - Array of string statuses (e.g. 'high', 'medium', 'minimal', 'low', 'na', 'unknown')
 * @returns {string} The resolved status string.
 */
export const calculateAverageStatus = (statuses) => {
    const valid = statuses.filter(s => s === 'high' || s === 'medium' || s === 'minimal' || s === 'low');
    
    if (valid.length === 0) {
        if (statuses.length > 0 && statuses.every(s => s === 'na')) return 'na';
        return 'unknown';
    }
    
    const allOptimal = valid.every(s => s === 'high');
    if (allOptimal) return 'high';

    let totalScore = 0;
    valid.forEach(s => {
        if (s === 'high') totalScore += 3;
        else if (s === 'medium') totalScore += 2;
        else if (s === 'minimal') totalScore += 1;
    });
    const avg = totalScore / valid.length;
    
    let finalStatus = 'low';
    if (avg >= 2.5) finalStatus = 'high';
    else if (avg >= 1.5) finalStatus = 'medium';
    else if (avg >= 0.5) finalStatus = 'minimal';
    
    // Prevent a single non-optimal event from averaging out to 'Optimal' if the rest were 'Optimal'
    if (finalStatus === 'high' && !allOptimal) {
        finalStatus = 'medium';
    }
    
    return finalStatus;
};

/**
 * Calculates Testing Baseline Confidence (Simulation Density) and Density-Modulated Temporal Control Drift Decay
 * for a MITRE ATT&CK technique or sub-technique.
 *
 * Unifies Simulation Density and Temporal Decay into a single retention curve:
 * - Validations within the 30-day fresh grace window retain 100% credit (decayFactor = 1.0).
 * - Beyond 30 days, validation credit decays exponentially with a half-life modulated by simulation density:
 *   T_eff(N) = halfLifeDays * (1 + 0.15 * min(N - 1, 4))  (90d for 1 test, up to 144d for 5+ tests).
 *
 * @param {number} testCount - Number of valid test executions/procedures recorded for the TTP.
 * @param {string|number|Date|null} lastTestedDate - Most recent test or validation re-test timestamp.
 * @param {Object} [options] - Optional configuration overrides (graceDays, halfLifeDays, staleThresholdDays, referenceTime).
 * @returns {Object} Confidence and decay metadata for unified GRS scoring, 3D visual weight, and UI badges.
 */
export const calculateConfidenceAndDecay = (testCount = 0, lastTestedDate = null, options = {}) => {
    const {
        graceDays = 30,
        halfLifeDays = 90,
        staleThresholdDays,
        agingThresholdDays,
        status = null,
        controlCount = 0,
        referenceTime = Date.now()
    } = options;

    if (!testCount || testCount <= 0) {
        return {
            testCount: 0,
            lastTestedDate: null,
            daysSinceLastTest: null,
            effectiveHalfLifeDays: halfLifeDays,
            effectiveAgingDays: 45,
            effectiveStaleDays: 90,
            daysUntilDecay: null,
            densityFactor: 0,
            decayFactor: 0,
            visualWeight: 0,
            confidenceLabel: 'Untested',
            driftStatus: 'Untested',
            needsRetest: false
        };
    }

    // 1. Simulation Density Factor D(N) in [0.40, 1.00]
    const densityFactor = Math.min(1.0, 0.40 + 0.20 * Math.max(0, testCount - 1));

    // 2. Mastery-Based Decay Lifespans (Graduated Aging & Decayed windows by Depth & Coverage)
    // - Shallow Depth (1 test) or fragile posture (low/minimal coverage): 45d Aging / 90d Decayed
    // - Medium Depth (2-3 tests): 75d Aging / 150d Decayed
    // - High Depth (4+ tests): 105d Aging / 180d Decayed (or 120d Aging / 240d Decayed when Optimal/multi-control)
    const isFragilePosture = status === 'low' || status === 'minimal';
    const isResilientPosture = status === 'high' || controlCount >= 2;

    let computedAgingDays = 45;
    let computedStaleDays = 90;

    if (!isFragilePosture) {
        if (testCount >= 4) {
            computedAgingDays = isResilientPosture ? 120 : 105;
            computedStaleDays = isResilientPosture ? 240 : 180;
        } else if (testCount >= 2) {
            computedAgingDays = 75;
            computedStaleDays = 150;
        }
    }

    const effectiveAgingDays =
        typeof agingThresholdDays === 'number' ? agingThresholdDays : computedAgingDays;
    const effectiveStaleDays =
        typeof staleThresholdDays === 'number' ? staleThresholdDays : computedStaleDays;

    // 3. Density-Modulated Temporal Control Drift Decay F_decay in [0.25, 1.00]
    // Higher simulation density (more unique procedures validated) extends the effective half-life by up to +60% (90d -> 144d).
    const effectiveHalfLifeDays = Math.round(
        halfLifeDays * (1 + 0.15 * Math.min(Math.max(0, testCount - 1), 4))
    );

    let daysSinceLastTest = 0;
    if (lastTestedDate) {
        const parsedTime = new Date(lastTestedDate).getTime();
        if (!Number.isNaN(parsedTime)) {
            daysSinceLastTest = Math.max(0, Math.floor((referenceTime - parsedTime) / (1000 * 60 * 60 * 24)));
        }
    }

    let decayFactor = 1.0;
    if (daysSinceLastTest > graceDays) {
        const lambda = Math.LN2 / effectiveHalfLifeDays;
        decayFactor = Math.max(0.25, Math.exp(-lambda * (daysSinceLastTest - graceDays)));
    }

    // 4. Combined Visual Weight W in [0.25, 1.00] for 3D Heat Globe rendering
    const rawWeight = 0.35 * densityFactor + 0.65 * decayFactor;
    const visualWeight = Math.min(1.0, Math.max(0.25, Number(rawWeight.toFixed(3))));

    // 5. Depth Tier (Low: 1 test, Medium: 2-3 tests, High: 4+ tests) & State (Fresh / Aging / Decayed)
    let confidenceLabel = 'Low';
    if (testCount >= 4) {
        confidenceLabel = 'High';
    } else if (testCount >= 2) {
        confidenceLabel = 'Medium';
    }

    let driftStatus = 'Fresh';
    if (daysSinceLastTest > effectiveStaleDays) {
        driftStatus = 'Decayed';
    } else if (daysSinceLastTest > effectiveAgingDays) {
        driftStatus = 'Aging';
    }

    const needsRetest = daysSinceLastTest > effectiveStaleDays;
    const daysUntilDecay = Math.max(0, effectiveStaleDays - daysSinceLastTest);

    return {
        testCount,
        lastTestedDate: lastTestedDate ? new Date(lastTestedDate).toISOString() : null,
        daysSinceLastTest,
        effectiveHalfLifeDays,
        effectiveAgingDays,
        effectiveStaleDays,
        daysUntilDecay,
        densityFactor: Number(densityFactor.toFixed(2)),
        decayFactor: Number(decayFactor.toFixed(2)),
        visualWeight,
        confidenceLabel,
        driftStatus,
        needsRetest
    };
};

/**
 * Standard MITRE ATT&CK Enterprise Kill Chain tactic order.
 */
export const KILL_CHAIN_ORDER = [
    "Reconnaissance", "Resource Development", "Initial Access", "Execution",
    "Persistence", "Privilege Escalation", "Defense Evasion", "Credential Access",
    "Discovery", "Lateral Movement", "Collection", "Command and Control",
    "Exfiltration", "Impact", "Defense Impairment", "Stealth"
];

/**
 * Looks up a MITRE ATT&CK technique or sub-technique name by ID across the mitreData dictionary.
 *
 * @param {Object} mitreData - The parsed MITRE ATT&CK dictionary keyed by tactic name.
 * @param {string} ttpId - Technique or sub-technique ID (e.g. 'T1059' or 'T1059.001').
 * @returns {string} The resolved technique/sub-technique name, or 'Unknown Technique'.
 */
export const lookupTTPName = (mitreData, ttpId) => {
    if (!mitreData || !ttpId) return 'Unknown Technique';
    const cleanId = String(ttpId).trim();
    for (const tactic of Object.values(mitreData)) {
        if (!tactic || !Array.isArray(tactic.techniques)) continue;
        const tech = tactic.techniques.find(t => t.id === cleanId);
        if (tech) return tech.name;
        const parentId = cleanId.split('.')[0];
        const parentTech = tactic.techniques.find(t => t.id === parentId);
        if (parentTech && Array.isArray(parentTech.subTechniques)) {
            const sub = parentTech.subTechniques.find(s => s.id === cleanId);
            if (sub) return sub.name;
        }
    }
    return 'Unknown Technique';
};
