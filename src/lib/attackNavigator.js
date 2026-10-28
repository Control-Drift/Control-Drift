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

import { lookupTTPName, calculateConfidenceAndDecay } from './mitreUtils';
import { getHistoricalBaselineForTTP, getHistoricalProceduresForTTPs } from './simulationAutomation';

export const TACTIC_NAME_TO_SHORTNAME = {
    'Reconnaissance': 'reconnaissance',
    'Resource Development': 'resource-development',
    'Initial Access': 'initial-access',
    'Execution': 'execution',
    'Persistence': 'persistence',
    'Privilege Escalation': 'privilege-escalation',
    'Defense Evasion': 'defense-evasion',
    'Defense Impairment': 'defense-impairment',
    'Stealth': 'stealth',
    'Credential Access': 'credential-access',
    'Discovery': 'discovery',
    'Lateral Movement': 'lateral-movement',
    'Collection': 'collection',
    'Command and Control': 'command-and-control',
    'Exfiltration': 'exfiltration',
    'Impact': 'impact'
};

export const SHORTNAME_TO_TACTIC_NAME = Object.entries(TACTIC_NAME_TO_SHORTNAME).reduce(
    (acc, [name, short]) => {
        acc[short] = name;
        return acc;
    },
    {}
);

export function toTacticShortname(tacticName = '') {
    if (!tacticName) return '';
    if (TACTIC_NAME_TO_SHORTNAME[tacticName]) return TACTIC_NAME_TO_SHORTNAME[tacticName];
    return String(tacticName).trim().toLowerCase().replace(/\s+/g, '-');
}

function getTacticTechniquesArray(tacticValue) {
    if (Array.isArray(tacticValue)) return tacticValue;
    if (tacticValue && Array.isArray(tacticValue.techniques)) return tacticValue.techniques;
    return [];
}

function getSubTechniquesArray(techNode) {
    if (!techNode) return [];
    if (Array.isArray(techNode.subTechniques)) return techNode.subTechniques;
    if (Array.isArray(techNode.subtechniques)) return techNode.subtechniques;
    return [];
}

function averageEnvStatus(statuses = []) {
    const valid = statuses.filter((s) => s && s !== 'unknown' && s !== 'na' && s !== 'exception');
    if (valid.length === 0) return 'unknown';
    const scoreMap = { high: 100, medium: 50, minimal: 25, low: 0 };
    const total = valid.reduce((sum, s) => sum + (scoreMap[s] ?? 0), 0);
    const avg = total / valid.length;
    if (avg >= 75) return 'high';
    if (avg >= 50) return 'medium';
    if (avg >= 25) return 'minimal';
    return 'low';
}

function statusFromExerciseRecord(ex = {}) {
    const rawStatus = String(ex.status || '').toLowerCase();
    if (['high', 'medium', 'minimal', 'low', 'na'].includes(rawStatus)) {
        return rawStatus;
    }
    const cov = String(ex.coverageRating || '').toLowerCase();
    if (cov.includes('optimal')) return 'high';
    if (cov.includes('partial')) return 'medium';
    if (cov.includes('minimal')) return 'minimal';
    if (cov.includes('none') || cov.includes('no coverage')) return 'low';
    if (cov === 'n/a') return 'na';

    const out = String(ex.outcome || ex.finding || '').toLowerCase();
    if (out.includes('prevented') || out.includes('alerted')) return 'high';
    if (out.includes('logged') || out.includes('partial')) return 'medium';
    if (out.includes('missed')) return 'low';
    return 'unknown';
}

/**
 * Evaluates the current Control Drift posture for a single TTP ID across mitreData,
 * open gaps, and historical simulation executions.
 */
export function evaluateTtpPosture(
    rawTtpId,
    mitreData = {},
    gaps = [],
    simulationSummaries = {},
    events = {},
    environmentFilter = 'All'
) {
    const ttpId = String(rawTtpId || '').trim().toUpperCase();
    const matchedNodes = [];
    const tactics = [];

    Object.entries(mitreData || {}).forEach(([tacticName, tacticVal]) => {
        const techniques = getTacticTechniquesArray(tacticVal);
        techniques.forEach((tech) => {
            if (tech.id?.toUpperCase() === ttpId) {
                matchedNodes.push(tech);
                if (!tactics.includes(tacticName)) tactics.push(tacticName);
            }
            const subs = getSubTechniquesArray(tech);
            subs.forEach((sub) => {
                if (sub.id?.toUpperCase() === ttpId) {
                    matchedNodes.push(sub);
                    if (!tactics.includes(tacticName)) tactics.push(tacticName);
                }
            });
        });
    });

    const primaryNode = matchedNodes[0] || null;
    const rawLookupName = lookupTTPName(mitreData, ttpId);
    const name =
        primaryNode?.name ||
        (rawLookupName && rawLookupName !== 'Unknown Technique' ? rawLookupName : ttpId);

    const baseline = getHistoricalBaselineForTTP(ttpId, simulationSummaries, events);
    const historyArr = getHistoricalProceduresForTTPs(
        [{ id: ttpId, name }],
        simulationSummaries,
        events,
        mitreData
    );
    const procedures = historyArr?.[0]?.procedures || [];

    // Resolve status from node (respecting environmentFilter), node history, or historical procedures
    let status = 'unknown';
    if (environmentFilter !== 'All' && primaryNode?.environments?.[environmentFilter]) {
        status = primaryNode.environments[environmentFilter];
    } else if (primaryNode?.status && primaryNode.status !== 'unknown') {
        status = primaryNode.status;
    }

    if (status === 'unknown' && primaryNode?.environments) {
        if (environmentFilter !== 'All') {
            status = primaryNode.environments[environmentFilter] || 'unknown';
        } else {
            const allEnvValues = Object.values(primaryNode.environments);
            if (allEnvValues.length > 0 && allEnvValues.every((s) => s === 'na')) {
                status = 'na';
            } else {
                status = averageEnvStatus(allEnvValues);
            }
        }
    }

    if (status === 'unknown' && Array.isArray(primaryNode?.history) && primaryNode.history.length > 0) {
        const matchingHist = primaryNode.history.filter((ex) => {
            if (environmentFilter === 'All') return true;
            return Array.isArray(ex.environment)
                ? ex.environment.includes(environmentFilter)
                : (ex.environment || 'Windows Workstation') === environmentFilter;
        });
        const histStatuses = matchingHist
            .map((ex) => statusFromExerciseRecord(ex))
            .filter((s) => s !== 'unknown');
        if (histStatuses.length > 0) {
            status = averageEnvStatus(histStatuses);
        }
    }

    if (status === 'unknown' && procedures.length > 0) {
        const latestOut = procedures[0]?.outcome || baseline?.expectedOutcome || '';
        if (latestOut === 'Missed') status = 'low';
        else if (latestOut === 'Logged' || latestOut === 'Partial') status = 'medium';
        else if (latestOut === 'Prevented' || latestOut === 'Alerted' || latestOut === 'Prevented & Alerted') {
            status = 'high';
        }
    }

    // Compute temporal decay & depth from node or historical procedures
    const latestDate =
        primaryNode?.lastTestedDate ||
        procedures[0]?.date ||
        baseline?.lastTestedDate ||
        (Array.isArray(primaryNode?.history) && primaryNode.history.length > 0
            ? primaryNode.history[0]?.date
            : null);

    const testCount = Math.max(
        primaryNode?.executionCount || 0,
        primaryNode?.variationCount || 0,
        primaryNode?.testCount || 0,
        procedures.length,
        Array.isArray(primaryNode?.history) ? primaryNode.history.length : 0
    );

    const decayMeta =
        primaryNode?.driftStatus && primaryNode.driftStatus !== 'Untested'
            ? {
                  driftStatus: primaryNode.driftStatus,
                  daysSinceLastTest: primaryNode.daysSinceLastTest ?? null,
                  confidenceLabel: primaryNode.confidenceLabel || primaryNode.depthTier || 'Low',
                  decayFactor: primaryNode.decayFactor ?? 1.0,
                  needsRetest: Boolean(primaryNode.needsRetest)
              }
            : calculateConfidenceAndDecay(testCount, latestDate, {
                  status,
                  controlCount: baseline?.securityControls?.length || 0
              });

    const driftStatus = decayMeta.driftStatus || 'Untested';
    const daysSinceLastTest = decayMeta.daysSinceLastTest ?? null;
    const depthTier = decayMeta.confidenceLabel || 'Untested';
    const variationCount = testCount;
    const decayFactor = decayMeta.decayFactor ?? 1.0;
    const needsRetest = Boolean(decayMeta.needsRetest);

    // Check open/in-progress gaps matching this TTP and active environment filter
    const activeGaps = (gaps || []).filter((g) => {
        if (g.status !== 'Open' && g.status !== 'In Progress') return false;
        if (environmentFilter !== 'All' && g.environment) {
            const matchesEnv = Array.isArray(g.environment)
                ? g.environment.includes(environmentFilter)
                : g.environment === environmentFilter;
            if (!matchesEnv) return false;
        }
        const tokens = String(g.ttp || '')
            .split(',')
            .map((t) => t.trim().split(/[\s-]/)[0].toUpperCase())
            .filter(Boolean);
        return tokens.includes(ttpId);
    });

    const criticalActiveGaps = activeGaps.filter((g) => {
        const finding = String(g.finding || g.outcome || '').toLowerCase();
        const cov = String(g.coverageRating || '').toLowerCase();
        if (finding === 'logged' || cov === 'partial') return false;
        return true;
    });

    let category = 'untested';
    let statusLabel = 'Untested Blind Spot';
    let readinessPoints = 0;
    let color = '#64748b';

    if (status === 'na') {
        category = 'outOfScope';
        statusLabel = 'Out of Scope (N/A)';
        readinessPoints = 100;
        color = '#475569';
    } else if (status === 'low' || status === 'minimal') {
        category = 'exposedGap';
        statusLabel =
            status === 'minimal'
                ? 'Minimal Coverage (25%)'
                : activeGaps.length > 0
                  ? `No Coverage — Open Gap (${activeGaps.length})`
                  : 'No Coverage (Missed)';
        readinessPoints = status === 'minimal' ? 25 : 0;
        color = status === 'minimal' ? '#f97316' : '#ef4444';
    } else if (driftStatus === 'Decayed' || driftStatus === 'Aging' || needsRetest) {
        category = 'decayed';
        statusLabel =
            driftStatus === 'Decayed'
                ? `Decayed (${daysSinceLastTest ?? 90}+d)`
                : `Aging (${daysSinceLastTest ?? 45}d)`;
        readinessPoints = driftStatus === 'Decayed' ? 35 : 60;
        color = '#eab308';
    } else if (status === 'high' || status === 'medium') {
        category = 'coveredFresh';
        statusLabel = status === 'high' ? 'Optimal Coverage (100%)' : 'Partial Coverage (50%)';
        readinessPoints = status === 'high' ? 100 : 50;
        color = status === 'high' ? '#10b981' : '#f59e0b';
    } else if (criticalActiveGaps.length > 0) {
        category = 'exposedGap';
        statusLabel = `Open Gap (${criticalActiveGaps.length})`;
        readinessPoints = 5;
        color = '#ef4444';
    } else if (activeGaps.length > 0) {
        category = 'coveredFresh';
        statusLabel = 'Partial Coverage (Logged Gap)';
        readinessPoints = 50;
        color = '#f59e0b';
    } else if (status === 'unknown' && variationCount === 0) {
        category = 'untested';
        statusLabel = 'Untested Blind Spot';
        readinessPoints = 0;
        color = '#64748b';
    } else if (variationCount > 0) {
        const lastOutcome = baseline?.expectedOutcome || procedures[0]?.outcome || '';
        if (lastOutcome === 'Missed') {
            category = 'exposedGap';
            statusLabel = 'Missed in Prior Test';
            readinessPoints = 0;
            color = '#ef4444';
        } else if (lastOutcome === 'Logged' || lastOutcome === 'Partial') {
            category = 'coveredFresh';
            statusLabel = 'Partial Coverage (Logged)';
            readinessPoints = 50;
            color = '#f59e0b';
        } else {
            category = 'coveredFresh';
            statusLabel = `Optimal Coverage (${lastOutcome || 'Validated'})`;
            readinessPoints = 100;
            color = '#10b981';
        }
    }

    return {
        id: ttpId,
        name,
        tactics,
        category,
        statusLabel,
        status,
        driftStatus,
        daysSinceLastTest,
        depthTier,
        variationCount,
        decayFactor,
        openGapCount: activeGaps.length,
        activeGaps,
        readinessPoints,
        color,
        baseline,
        procedures
    };
}

/**
 * Computes a complete Posture Readiness Delta Analysis for a list of TTPs
 * (from an Adversary Group, Malware/Tool, CTI Advisory, or imported Navigator Layer).
 */
export function computeReadinessDeltaForTTPs(
    ttpItems = [],
    mitreData = {},
    gaps = [],
    simulationSummaries = {},
    events = {},
    environmentFilter = 'All'
) {
    const seen = new Set();
    const evaluated = [];

    (ttpItems || []).forEach((item) => {
        const rawId = typeof item === 'string' ? item : item?.id || item?.techniqueID || '';
        const cleanId = String(rawId || '').trim().toUpperCase();
        if (!cleanId || !/^T\d{4}(?:\.\d{3})?$/.test(cleanId)) return;
        if (seen.has(cleanId)) return;
        seen.add(cleanId);

        const posture = evaluateTtpPosture(
            cleanId,
            mitreData,
            gaps,
            simulationSummaries,
            events,
            environmentFilter
        );
        const itemProcDesc =
            typeof item === 'object' ? item.procedureDesc || item.comment || '' : '';
        evaluated.push({
            ...posture,
            tactics:
                typeof item === 'object' && Array.isArray(item.tactics) && item.tactics.length > 0
                    ? item.tactics
                    : posture.tactics,
            procedureDesc: itemProcDesc,
            externalComment: itemProcDesc,
            externalScore: typeof item === 'object' ? item.score ?? null : null,
            externalColor: typeof item === 'object' ? item.color || '' : ''
        });
    });

    const coveredFresh = evaluated.filter((t) => t.category === 'coveredFresh');
    const decayed = evaluated.filter((t) => t.category === 'decayed');
    const exposedGap = evaluated.filter((t) => t.category === 'exposedGap');
    const untested = evaluated.filter((t) => t.category === 'untested');
    const outOfScope = evaluated.filter((t) => t.category === 'outOfScope');

    const activePool = evaluated.filter((t) => t.category !== 'outOfScope');
    const readinessScore =
        activePool.length > 0
            ? Math.round(
                  activePool.reduce((sum, item) => sum + item.readinessPoints, 0) / activePool.length
              )
            : 0;

    // Priority order for Delta Campaign: Open Gaps first, then Untested Blind Spots, then Decayed/Aging
    const deltaTTPs = [...exposedGap, ...untested, ...decayed];

    return {
        total: evaluated.length,
        activeTotal: activePool.length,
        readinessScore,
        coveredFresh,
        decayed,
        exposedGap,
        untested,
        outOfScope,
        deltaTTPs,
        allTTPs: evaluated
    };
}

/**
 * Generates a standard MITRE ATT&CK Navigator Layer v4.5 JSON object from Control Drift posture
 * or a scoped subset of TTPs (e.g., an APT group or CTI advisory).
 */
export function exportAttackNavigatorLayer({
    mitreData = {},
    gaps = [],
    simulationSummaries = {},
    events = {},
    environmentFilter = 'All',
    layerName = '',
    description = '',
    filterToTtpIds = null
} = {}) {
    const dateStr = new Date().toISOString().split('T')[0];
    const effectiveName =
        layerName ||
        `Control Drift Posture (${environmentFilter === 'All' ? 'All Environments' : environmentFilter}) - ${dateStr}`;
    const effectiveDesc =
        description ||
        `Exported from Control Drift on ${new Date().toLocaleString()}. Environment Filter: ${environmentFilter}. Reflects empirical validation coverage, procedural depth, and temporal control decay.`;

    const scopedMap = new Map();
    if (Array.isArray(filterToTtpIds) && filterToTtpIds.length > 0) {
        filterToTtpIds.forEach((item) => {
            const id = (
                typeof item === 'string' ? item : item?.id || item?.techniqueID || ''
            ).toUpperCase();
            if (id) {
                scopedMap.set(id, typeof item === 'object' ? item : { id });
            }
        });
    }
    const isScoped = scopedMap.size > 0;

    const techniques = [];
    const seenTechIds = new Set();

    const buildTechniqueEntry = (node) => {
        const ttpId = String(node.id || '').toUpperCase();
        if (!ttpId) return;
        if (isScoped && !scopedMap.has(ttpId)) return;
        if (seenTechIds.has(ttpId)) return;

        const posture = evaluateTtpPosture(
            ttpId,
            mitreData,
            gaps,
            simulationSummaries,
            events,
            environmentFilter
        );
        const scopedMeta = scopedMap.get(ttpId);

        if (!isScoped && posture.category === 'untested') {
            return;
        }

        seenTechIds.add(ttpId);

        let score = posture.readinessPoints;
        let color = posture.color || '#10b981';

        if (posture.category === 'coveredFresh') {
            color = posture.status === 'high' ? '#10b981' : '#f59e0b';
        } else if (posture.category === 'decayed') {
            color = '#eab308';
        } else if (posture.category === 'exposedGap') {
            color = posture.status === 'minimal' ? '#f97316' : '#ef4444';
        } else if (posture.category === 'outOfScope') {
            color = '#475569';
        } else if (posture.category === 'untested') {
            color = '#8b5cf6';
            score = 0;
        }

        const commentParts = [
            `Posture: ${posture.statusLabel}`,
            posture.depthTier !== 'Untested'
                ? `Depth: ${posture.depthTier} (${posture.variationCount} variation${posture.variationCount === 1 ? '' : 's'})`
                : 'Depth: Untested',
            posture.daysSinceLastTest != null ? `Last Tested: ${posture.daysSinceLastTest}d ago` : null,
            posture.openGapCount > 0 ? `Open Gaps: ${posture.openGapCount}` : null,
            posture.baseline?.securityControls?.length
                ? `Controls: ${posture.baseline.securityControls.join(', ')}`
                : null,
            scopedMeta?.procedureDesc ? `CTI Procedure: ${scopedMeta.procedureDesc}` : null
        ].filter(Boolean);

        const isSubtechnique = ttpId.includes('.');
        const entry = {
            techniqueID: ttpId,
            score,
            color,
            comment: commentParts.join(' | '),
            enabled: posture.category !== 'outOfScope',
            metadata: [
                { name: 'Posture Status', value: posture.statusLabel },
                { name: 'Validation Depth', value: `${posture.depthTier} (${posture.variationCount})` },
                { name: 'Drift State', value: posture.driftStatus },
                ...(posture.daysSinceLastTest != null
                    ? [{ name: 'Days Since Test', value: String(posture.daysSinceLastTest) }]
                    : [])
            ],
            links: []
        };

        if (!isSubtechnique) {
            entry.showSubtechniques = false;
        }

        techniques.push(entry);
    };

    Object.entries(mitreData || {}).forEach(([, tacticVal]) => {
        const techList = getTacticTechniquesArray(tacticVal);
        techList.forEach((tech) => {
            buildTechniqueEntry(tech);
            const subs = getSubTechniquesArray(tech);
            subs.forEach((sub) => {
                buildTechniqueEntry(sub);
            });
        });
    });

    if (isScoped) {
        scopedMap.forEach((meta, ttpId) => {
            if (!seenTechIds.has(ttpId)) {
                buildTechniqueEntry({ id: ttpId, name: meta.name || ttpId });
            }
        });
    }

    // Automatically expand parent techniques in ATT&CK Navigator whenever any of their sub-techniques are annotated
    const parentsWithAnnotatedSubs = new Set(
        techniques
            .filter((t) => t.techniqueID.includes('.'))
            .map((t) => t.techniqueID.split('.')[0])
    );

    parentsWithAnnotatedSubs.forEach((parentId) => {
        const existingParent = techniques.find((t) => t.techniqueID === parentId);
        if (existingParent) {
            existingParent.showSubtechniques = true;
        } else {
            techniques.push({
                techniqueID: parentId,
                enabled: true,
                showSubtechniques: true
            });
        }
    });

    return {
        name: effectiveName,
        versions: {
            attack: '19',
            navigator: '5.3.2',
            layer: '4.5'
        },
        domain: 'enterprise-attack',
        description: effectiveDesc,
        filters: {
            platforms: [
                'Windows',
                'macOS',
                'Linux',
                'PRE',
                'Office Suite',
                'Identity Provider',
                'SaaS',
                'IaaS',
                'Network Devices',
                'Containers',
                'ESXi'
            ]
        },
        sorting: 0,
        layout: {
            layout: 'side',
            aggregateFunction: 'average',
            showID: true,
            showName: true,
            showAggregateScores: false,
            countUnscored: false,
            expandedSubtechniques: 'annotated'
        },
        hideDisabled: false,
        techniques,
        gradient: {
            colors: ['#ef4444', '#f97316', '#eab308', '#f59e0b', '#10b981'],
            minValue: 0,
            maxValue: 100
        },
        legendItems: [
            { label: 'Optimal Coverage — Fresh (Score 100)', color: '#10b981' },
            { label: 'Partial Coverage — Fresh (Score 50)', color: '#f59e0b' },
            { label: 'Aging / Decayed — Needs Retest (Score 35-60)', color: '#eab308' },
            { label: 'Minimal Coverage (Score 25)', color: '#f97316' },
            { label: 'No Coverage / Open Gap (Score 0)', color: '#ef4444' },
            { label: 'Untested Blind Spot (Scoped Threat)', color: '#8b5cf6' },
            { label: 'Out of Scope (N/A)', color: '#475569' }
        ],
        metadata: [
            { name: 'Generator', value: 'Control Drift BAS & Purple Team Platform' },
            { name: 'Environment Filter', value: String(environmentFilter) },
            { name: 'Export Timestamp', value: new Date().toISOString() }
        ],
        links: [],
        showTacticRowBackground: false,
        tacticRowBackground: '#dddddd',
        selectTechniquesAcrossTactics: true,
        selectSubtechniquesWithParent: false,
        selectVisibleTechniques: false
    };
}

/**
 * Triggers a browser file download for a MITRE ATT&CK Navigator Layer JSON object.
 */
export function downloadNavigatorLayerJson(layerObj, customFilename = '') {
    const safeName = (customFilename || layerObj?.name || 'control-drift-navigator-layer')
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    const filename = safeName.endsWith('.json') ? safeName : `${safeName}.json`;
    const blob = new Blob([JSON.stringify(layerObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Parses an imported MITRE ATT&CK Navigator Layer (.json) and computes a Posture Readiness Delta Analysis.
 */
export function parseAttackNavigatorLayer(
    rawInput,
    mitreData = {},
    gaps = [],
    simulationSummaries = {},
    events = {},
    environmentFilter = 'All'
) {
    let parsed = rawInput;
    if (typeof rawInput === 'string') {
        try {
            parsed = JSON.parse(rawInput);
        } catch {
            throw new Error('Invalid JSON file. Please upload a valid MITRE ATT&CK Navigator Layer (.json).');
        }
    }

    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.techniques)) {
        throw new Error(
            'Unrecognized ATT&CK Navigator Layer format: missing "techniques" array.'
        );
    }

    const enabledEntries = parsed.techniques.filter((t) => t && t.techniqueID && t.enabled !== false);

    const annotatedEntries = enabledEntries.filter(
        (t) =>
            (t.score !== undefined && t.score !== null && Number(t.score) > 0) ||
            (typeof t.color === 'string' && t.color.trim() !== '') ||
            (typeof t.comment === 'string' && t.comment.trim() !== '')
    );

    const effectiveEntries =
        enabledEntries.length > 80 &&
        annotatedEntries.length > 0 &&
        annotatedEntries.length < enabledEntries.length
            ? annotatedEntries
            : enabledEntries;

    const byId = new Map();
    effectiveEntries.forEach((entry) => {
        const id = String(entry.techniqueID || '').trim().toUpperCase();
        if (!/^T\d{4}(?:\.\d{3})?$/.test(id)) return;

        if (!byId.has(id)) {
            byId.set(id, {
                id,
                score: entry.score ?? null,
                color: entry.color || '',
                comment: entry.comment ? String(entry.comment).trim() : '',
                tactics: entry.tactic ? [entry.tactic] : []
            });
        } else {
            const existing = byId.get(id);
            if (entry.score != null && (existing.score == null || entry.score > existing.score)) {
                existing.score = entry.score;
            }
            if (entry.comment && !existing.comment.includes(entry.comment.trim())) {
                existing.comment = existing.comment
                    ? `${existing.comment} | ${entry.comment.trim()}`
                    : entry.comment.trim();
            }
            if (entry.tactic && !existing.tactics.includes(entry.tactic)) {
                existing.tactics.push(entry.tactic);
            }
        }
    });

    const uniqueItems = Array.from(byId.values());
    const delta = computeReadinessDeltaForTTPs(
        uniqueItems,
        mitreData,
        gaps,
        simulationSummaries,
        events,
        environmentFilter
    );

    return {
        layerName: parsed.name || 'Imported ATT&CK Layer',
        description: parsed.description || '',
        domain: parsed.domain || 'enterprise-attack',
        version: parsed.versions?.layer || parsed.version || '4.5',
        rawTechniqueCount: parsed.techniques.length,
        ...delta
    };
}
