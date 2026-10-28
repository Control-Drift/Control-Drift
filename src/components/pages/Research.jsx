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

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
    Compass,
    Search,
    Download,
    CheckSquare,
    Square,
    X,
    ExternalLink,
    Loader2,
    Users,
    Wrench,
    ChevronDown,
    ChevronUp,
    ChevronRight,
    Info,
    ArrowRight,
    Zap
} from 'lucide-react';
import { useAppContext } from '../../AppContext';
import { useToast } from '../ui/Toast';
import BlackHoleIcon from '../ui/BlackHoleIcon';
import {
    computeReadinessDeltaForTTPs,
    exportAttackNavigatorLayer,
    downloadNavigatorLayerJson
} from '../../lib/attackNavigator';
import {
    loadMitreCtiData,
    buildKillChainBoardForEntity,
    buildScenarioNarrativeFromSelection
} from '../../lib/mitreStixCti';

export default function Research() {
    const {
        mitreData,
        gaps,
        simulationSummaries,
        events,
        allEventsData,
        activeEnvironmentFilter
    } = useAppContext();
    const { addToast } = useToast();
    const navigate = useNavigate();

    // STIX CTI dataset loading state
    const [ctiData, setCtiData] = useState(null);
    const [isCtiLoading, setIsCtiLoading] = useState(true);
    const [ctiError, setCtiError] = useState(null);

    // Selected TTPs for Step 1 Campaign Scope
    const [stagedTTPs, setStagedTTPs] = useState([]);
    const [scopeSourceLabel, setScopeSourceLabel] = useState('');
    const [scopeSourceId, setScopeSourceId] = useState('');

    // Threat Catalog State
    const [catalogType, setCatalogType] = useState('groups'); // 'groups' | 'software'
    const [actorSearch, setActorSearch] = useState('');
    const [actorSort, setActorSort] = useState('ttps_desc');
    const [selectedEntityId, setSelectedEntityId] = useState(null);
    const [showBioDetails, setShowBioDetails] = useState(false);

    // Unified Kill Chain Board Filters
    const [activePhaseFilter, setActivePhaseFilter] = useState('all'); // 'all' or phase.id
    const [priorityFilter, setPriorityFilter] = useState('all'); // 'all' | 'priority' | 'delta' | 'selected'
    const [selectedToolFilter, setSelectedToolFilter] = useState('all'); // 'all' or toolName
    const [isToolDropdownOpen, setIsToolDropdownOpen] = useState(false);
    const [toolDropdownSearch, setToolDropdownSearch] = useState('');
    const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
    const toolDropdownRef = useRef(null);
    const sortDropdownRef = useRef(null);
    const [techSearch, setTechSearch] = useState('');
    const [collapsedPhases, setCollapsedPhases] = useState({});

    // Slide-Over Technique Deep-Dive Drawer State
    const [drawerTtpId, setDrawerTtpId] = useState(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (toolDropdownRef.current && !toolDropdownRef.current.contains(e.target)) {
                setIsToolDropdownOpen(false);
            }
            if (sortDropdownRef.current && !sortDropdownRef.current.contains(e.target)) {
                setIsSortDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        let mounted = true;
        setIsCtiLoading(true);
        loadMitreCtiData()
            .then((data) => {
                if (!mounted) return;
                setCtiData(data);
                if (data?.groups?.length > 0) {
                    const defaultGroup =
                        data.groups.find((g) => g.name.toLowerCase().includes('apt3')) ||
                        data.groups.find((g) => g.name.toLowerCase().includes('apt29')) ||
                        data.groups[0];
                    setSelectedEntityId(defaultGroup.id);
                }
                setIsCtiLoading(false);
            })
            .catch((err) => {
                if (!mounted) return;
                setCtiError(err.message || 'Failed to load MITRE CTI knowledge base');
                setIsCtiLoading(false);
            });
        return () => {
            mounted = false;
        };
    }, []);

    // Filtered & sorted Threat Groups or Malware/Tools
    const catalogEntities = useMemo(() => {
        if (!ctiData) return [];
        const sourceList = catalogType === 'groups' ? ctiData.groups : ctiData.software;
        const q = actorSearch.trim().toLowerCase();

        const filtered = sourceList.filter((item) => {
            if (!q) return true;
            if (item.name.toLowerCase().includes(q) || item.id.toLowerCase().includes(q)) {
                return true;
            }
            if ((item.aliases || []).some((a) => a.toLowerCase().includes(q))) {
                return true;
            }
            if (item.description && item.description.toLowerCase().includes(q)) {
                return true;
            }
            return false;
        });

        return [...filtered].sort((a, b) => {
            if (actorSort === 'name_asc') return a.name.localeCompare(b.name);
            return b.ttps.length - a.ttps.length || a.name.localeCompare(b.name);
        });
    }, [ctiData, catalogType, actorSearch, actorSort]);

    // Currently selected Threat Group or Software object
    const selectedEntity = useMemo(() => {
        if (!ctiData || !selectedEntityId) return null;
        const list = catalogType === 'groups' ? ctiData.groups : ctiData.software;
        return list.find((item) => item.id === selectedEntityId) || list[0] || null;
    }, [ctiData, catalogType, selectedEntityId]);

    // Readiness Delta & Posture Evaluation for the selected Entity
    const selectedEntityDelta = useMemo(() => {
        if (!selectedEntity) return null;
        return computeReadinessDeltaForTTPs(
            selectedEntity.ttps,
            mitreData,
            gaps,
            simulationSummaries,
            allEventsData || events,
            activeEnvironmentFilter
        );
    }, [selectedEntity, mitreData, gaps, simulationSummaries, allEventsData, events, activeEnvironmentFilter]);

    // Unified Cyber Kill Chain Board + Priority Ranking for the selected Entity
    const entityKillChainBoard = useMemo(() => {
        if (!selectedEntity || !selectedEntityDelta) return null;
        return buildKillChainBoardForEntity(
            selectedEntityDelta.allTTPs,
            selectedEntity.software || [],
            ctiData
        );
    }, [selectedEntity, selectedEntityDelta, ctiData]);

    // Reset sub-filters when switching actors
    useEffect(() => {
        setActivePhaseFilter('all');
        setPriorityFilter('all');
        setSelectedToolFilter('all');
        setIsToolDropdownOpen(false);
        setToolDropdownSearch('');
        setTechSearch('');
        setShowBioDetails(false);
        setCollapsedPhases({});
    }, [selectedEntityId, catalogType]);

    // Slide-Over Drawer Technique Data + Internal Historical Control Drift Procedures
    const drawerTechnique = useMemo(() => {
        if (!drawerTtpId || !ctiData?.techniquesById) return null;
        return ctiData.techniquesById[drawerTtpId] || null;
    }, [drawerTtpId, ctiData]);

    const drawerHistoricalVariations = useMemo(() => {
        if (!drawerTechnique) return [];
        const ttpId = drawerTechnique.id;
        const variations = [];

        Object.entries(simulationSummaries || {}).forEach(([simName, simData]) => {
            if (!simData || typeof simData !== 'object') return;
            const results = Array.isArray(simData.testResults) ? simData.testResults : [];
            results.forEach((proc) => {
                const rawTtps = Array.isArray(proc.ttps)
                    ? proc.ttps
                    : Array.isArray(proc.mappedTTPs)
                    ? proc.mappedTTPs
                    : proc.ttp
                    ? [proc.ttp]
                    : [];
                const normalizedIds = rawTtps.map((x) =>
                    String(typeof x === 'object' ? x.id : x)
                        .trim()
                        .toUpperCase()
                );
                if (normalizedIds.includes(ttpId)) {
                    variations.push({
                        simName,
                        date: simData.timestamp || simData.date || '',
                        name: proc.name || `${ttpId} Procedure`,
                        outcome: proc.outcome || proc.expectedOutcome || 'Unknown',
                        payloadCode: proc.payloadCode || proc.procedureSteps || '',
                        controls: Array.isArray(proc.securityControls) ? proc.securityControls : []
                    });
                }
            });
        });

        return variations.slice(0, 8);
    }, [drawerTechnique, simulationSummaries]);

    // Staging Helpers
    const isTtpStaged = (id) => stagedTTPs.some((t) => t.id === id);

    const toggleStageTtp = (ttpObj, sourceEntity = null) => {
        const cleanId = String(ttpObj.id).toUpperCase();
        const activeEntity = sourceEntity || selectedEntity || null;
        if (activeEntity) {
            setScopeSourceLabel(activeEntity.name);
            setScopeSourceId(activeEntity.id || '');
        }
        setStagedTTPs((prev) => {
            if (prev.some((t) => t.id === cleanId)) {
                return prev.filter((t) => t.id !== cleanId);
            }
            const stixTech = ctiData?.techniquesById?.[cleanId];
            const entityTtpMatch = activeEntity?.ttps?.find((x) => x.id === cleanId);
            const resolvedProcedureDesc =
                ttpObj.procedureDesc ||
                ttpObj.externalComment ||
                entityTtpMatch?.procedureDesc ||
                '';
            return [
                ...prev,
                {
                    id: cleanId,
                    name: ttpObj.name || stixTech?.name || cleanId,
                    tactics:
                        (Array.isArray(ttpObj.tactics) && ttpObj.tactics.length > 0
                            ? ttpObj.tactics
                            : entityTtpMatch?.tactics) ||
                        stixTech?.tactics ||
                        [],
                    procedureDesc: resolvedProcedureDesc
                }
            ];
        });
    };

    const setScopeFromTtpList = (list = [], label = '', entityId = '', modeLabel = '') => {
        const map = new Map();
        list.forEach((item) => {
            const cleanId = String(item.id).toUpperCase();
            const stixTech = ctiData?.techniquesById?.[cleanId];
            map.set(cleanId, {
                id: cleanId,
                name: item.name || stixTech?.name || cleanId,
                tactics: item.tactics || stixTech?.tactics || [],
                procedureDesc: item.procedureDesc || item.externalComment || ''
            });
        });
        const finalItems = Array.from(map.values());
        setStagedTTPs(finalItems);
        if (label) setScopeSourceLabel(label);
        if (entityId !== undefined) setScopeSourceId(entityId);
        addToast(
            `Scoped ${finalItems.length} priority techniques${modeLabel ? ` (${modeLabel})` : ''}.`,
            'success'
        );
    };

    const togglePhaseTopPriority = (phase, sourceEntity = null) => {
        const targetItems =
            phase.topPriorityTTPs?.length > 0 ? phase.topPriorityTTPs : phase.ttps.slice(0, 2);
        const ids = targetItems.map((t) => t.id);
        const allSelected = ids.length > 0 && ids.every((id) => stagedTTPs.some((s) => s.id === id));

        if (sourceEntity) {
            setScopeSourceLabel(sourceEntity.name);
            setScopeSourceId(sourceEntity.id || '');
        }

        if (allSelected) {
            setStagedTTPs((prev) => prev.filter((t) => !ids.includes(t.id)));
        } else {
            setStagedTTPs((prev) => {
                const map = new Map(prev.map((item) => [item.id, item]));
                targetItems.forEach((item) => {
                    const cleanId = String(item.id).toUpperCase();
                    const stixTech = ctiData?.techniquesById?.[cleanId];
                    map.set(cleanId, {
                        id: cleanId,
                        name: item.name || stixTech?.name || cleanId,
                        tactics: item.tactics || stixTech?.tactics || [],
                        procedureDesc: item.procedureDesc || item.externalComment || ''
                    });
                });
                return Array.from(map.values());
            });
        }
    };

    const clearPhaseSelection = (phase) => {
        const phaseIds = new Set(phase.ttps.map((t) => t.id));
        setStagedTTPs((prev) => prev.filter((t) => !phaseIds.has(t.id)));
    };

    const toggleOperationalChain = (chain, sourceEntity = null) => {
        if (!chain || !Array.isArray(chain.ttps)) return;
        const ids = chain.ttps.map((t) => t.id);
        const allSelected = ids.length > 0 && ids.every((id) => stagedTTPs.some((s) => s.id === id));

        if (sourceEntity) {
            setScopeSourceLabel(sourceEntity.name);
            setScopeSourceId(sourceEntity.id || '');
        }

        if (allSelected) {
            setStagedTTPs((prev) => prev.filter((t) => !ids.includes(t.id)));
            addToast(`Removed "${chain.shortTitle}" chain from scope.`, 'info');
        } else {
            setStagedTTPs((prev) => {
                const map = new Map(prev.map((item) => [item.id, item]));
                chain.ttps.forEach((item) => {
                    const cleanId = String(item.id).toUpperCase();
                    const stixTech = ctiData?.techniquesById?.[cleanId];
                    map.set(cleanId, {
                        id: cleanId,
                        name: item.name || stixTech?.name || cleanId,
                        tactics: item.tactics || stixTech?.tactics || [],
                        procedureDesc: item.procedureDesc || item.externalComment || ''
                    });
                });
                return Array.from(map.values());
            });
            addToast(
                `Scoped Compound Event: "${chain.shortTitle}" (${chain.ttps.length} chained TTPs).`,
                'success'
            );
        }
    };

    const stageTtpWithCompanionAnchor = (ttpItem, companionObj, allBoardTtps = [], sourceEntity = null) => {
        if (!ttpItem) return;
        if (sourceEntity) {
            setScopeSourceLabel(sourceEntity.name);
            setScopeSourceId(sourceEntity.id || '');
        }
        const fullAnchor =
            allBoardTtps.find((x) => x.id === companionObj?.id) || companionObj;
        const pair = [ttpItem, fullAnchor].filter(Boolean);

        setStagedTTPs((prev) => {
            const map = new Map(prev.map((item) => [item.id, item]));
            pair.forEach((item) => {
                const cleanId = String(item.id).toUpperCase();
                const stixTech = ctiData?.techniquesById?.[cleanId];
                map.set(cleanId, {
                    id: cleanId,
                    name: item.name || stixTech?.name || cleanId,
                    tactics: item.tactics || stixTech?.tactics || [],
                    procedureDesc: item.procedureDesc || item.externalComment || ''
                });
            });
            return Array.from(map.values());
        });
        if (fullAnchor) {
            addToast(
                `Scoped ${ttpItem.id} fused with Anchor Objective ${fullAnchor.id} (${fullAnchor.name}).`,
                'success'
            );
        }
    };

    // Launch into Step 1 (Scope Only — NO mock data in Step 2 or Step 3)
    const handleSendToStep1 = () => {
        if (stagedTTPs.length === 0) {
            addToast('Select at least 1 technique or Kill Chain phase first.', 'warning');
            return;
        }
        const entityLabel =
            (selectedEntity ? selectedEntity.name : '') ||
            scopeSourceLabel ||
            'Adversary';
        const entityId =
            (selectedEntity ? selectedEntity.id : '') ||
            scopeSourceId ||
            '';

        // Ensure every staged TTP carries the active threat group's documented behavior text
        const enrichedStagedTTPs = stagedTTPs.map((t) => {
            const activeEntityPool = selectedEntity?.ttps;
            const entityMatch = activeEntityPool
                ? activeEntityPool.find((x) => x.id === t.id)
                : null;
            const stixExampleMatch =
                !t.procedureDesc && !entityMatch?.procedureDesc && entityId
                    ? ctiData?.techniquesById?.[t.id]?.procedureExamples?.find(
                          (ex) => ex.actorId === entityId
                      )
                    : null;
            return {
                ...t,
                tactics:
                    Array.isArray(t.tactics) && t.tactics.length > 0
                        ? t.tactics
                        : entityMatch?.tactics || ctiData?.techniquesById?.[t.id]?.tactics || [],
                procedureDesc:
                    entityMatch?.procedureDesc ||
                    t.procedureDesc ||
                    stixExampleMatch?.description ||
                    ''
            };
        });

        const campaignName = `${entityLabel} Emulation`;
        const scenarioGoals = buildScenarioNarrativeFromSelection(
            entityLabel,
            entityId,
            enrichedStagedTTPs
        );

        const stagedIdSet = new Set(enrichedStagedTTPs.map((t) => t.id));
        const suggestedToolsSet = new Set();
        if (catalogType === 'software' && selectedEntity?.name) {
            suggestedToolsSet.add(selectedEntity.name);
        } else if (catalogType === 'groups') {
            if (selectedToolFilter !== 'All') {
                const matchedFilterTool = actorTools.find((sw) => sw.id === selectedToolFilter);
                if (matchedFilterTool?.name) suggestedToolsSet.add(matchedFilterTool.name);
            }
            // Also include up to 4 actor tools whose TTPs overlap with the staged TTPs
            actorTools.forEach((sw) => {
                if (suggestedToolsSet.size >= 5) return;
                const overlaps = (sw.ttps || []).some((t) => stagedIdSet.has(t.id));
                if (overlaps && sw.name) {
                    suggestedToolsSet.add(sw.name);
                }
            });
        }

        navigate('/simulation', {
            state: {
                emulationPlan: {
                    name: campaignName,
                    goals: scenarioGoals,
                    ttps: enrichedStagedTTPs.map((t) => ({
                        id: t.id,
                        name: t.name,
                        procedureDesc: t.procedureDesc || ''
                    })),
                    selectedTTPs: enrichedStagedTTPs.map((t) => ({ id: t.id, name: t.name })),
                    suggestedTooling: Array.from(suggestedToolsSet),
                    targetStep: 1
                }
            }
        });
    };

    // Export Actor as ATT&CK Navigator JSON
    const handleExportEntityLayer = (entityName, ttpList) => {
        const layer = exportAttackNavigatorLayer({
            mitreData,
            gaps,
            simulationSummaries,
            events: allEventsData || events,
            environmentFilter: activeEnvironmentFilter,
            layerName: `${entityName} — Control Drift Readiness Layer`,
            filterToTtpIds: ttpList
        });
        downloadNavigatorLayerJson(layer, `${entityName}_Readiness_Layer.json`);
        addToast(`Exported ATT&CK Navigator Layer for ${entityName}`, 'success');
    };

    const getPostureBadgeStyle = (category) => {
        if (category === 'exposedGap') {
            return {
                label: 'Exposed Gap',
                color: '#ef4444',
                bg: 'rgba(239, 68, 68, 0.14)',
                border: 'rgba(239, 68, 68, 0.35)'
            };
        }
        if (category === 'decayed') {
            return {
                label: 'Decayed',
                color: '#f97316',
                bg: 'rgba(249, 115, 22, 0.14)',
                border: 'rgba(249, 115, 22, 0.35)'
            };
        }
        if (category === 'untested') {
            return {
                label: 'Untested',
                color: '#eab308',
                bg: 'rgba(234, 179, 8, 0.14)',
                border: 'rgba(234, 179, 8, 0.35)'
            };
        }
        return {
            label: 'Validated',
            color: '#10b981',
            bg: 'rgba(16, 185, 129, 0.14)',
            border: 'rgba(16, 185, 129, 0.35)'
        };
    };

    const getPriorityBadgeStyle = (tier) => {
        if (tier === 'CRITICAL') {
            return {
                label: 'CRITICAL PRIORITY',
                color: '#ef4444',
                bg: 'rgba(239, 68, 68, 0.16)',
                border: 'rgba(239, 68, 68, 0.45)'
            };
        }
        if (tier === 'HIGH') {
            return {
                label: 'HIGH PRIORITY',
                color: '#f59e0b',
                bg: 'rgba(245, 158, 11, 0.15)',
                border: 'rgba(245, 158, 11, 0.4)'
            };
        }
        if (tier === 'COVERED') {
            return {
                label: 'COVERED',
                color: '#10b981',
                bg: 'rgba(16, 185, 129, 0.12)',
                border: 'rgba(16, 185, 129, 0.3)'
            };
        }
        if (tier === 'LOW') {
            return {
                label: 'LOW',
                color: '#94a3b8',
                bg: 'rgba(148, 163, 184, 0.1)',
                border: 'rgba(148, 163, 184, 0.25)'
            };
        }
        return {
            label: 'MEDIUM',
            color: '#38bdf8',
            bg: 'rgba(56, 189, 248, 0.12)',
            border: 'rgba(56, 189, 248, 0.3)'
        };
    };

    // Reusable Unified Cyber Kill Chain Board renderer (used by both Threat Catalog and Report Analyzer)
    const renderUnifiedKillChainBoard = (killChainBoard, sourceEntityObj) => {
        if (!killChainBoard || killChainBoard.phases.length === 0) {
            return (
                <div
                    style={{
                        padding: '32px',
                        textAlign: 'center',
                        color: 'var(--text-muted)',
                        fontSize: '0.88rem'
                    }}
                >
                    No executable Cyber Kill Chain techniques mapped for this selection.
                </div>
            );
        }

        const q = techSearch.trim().toLowerCase();

        // Filter phases and their ranked TTPs based on active controls
        const visiblePhases = killChainBoard.phases
            .filter((phase) => activePhaseFilter === 'all' || phase.id === activePhaseFilter)
            .map((phase) => {
                const filteredTtps = phase.ttps.filter((t) => {
                    if (
                        priorityFilter === 'priority' &&
                        t.priorityTier !== 'CRITICAL' &&
                        t.priorityTier !== 'HIGH'
                    ) {
                        return false;
                    }
                    if (priorityFilter === 'delta' && t.category === 'coveredFresh') {
                        return false;
                    }
                    if (priorityFilter === 'selected' && !isTtpStaged(t.id)) {
                        return false;
                    }
                    if (
                        selectedToolFilter !== 'all' &&
                        !(t.matchedTools || []).includes(selectedToolFilter)
                    ) {
                        return false;
                    }
                    if (q) {
                        const matchesId = t.id.toLowerCase().includes(q);
                        const matchesName = (t.name || '').toLowerCase().includes(q);
                        const matchesProc = (t.procedureDesc || '').toLowerCase().includes(q);
                        const matchesTool = (t.matchedTools || []).some((m) =>
                            m.toLowerCase().includes(q)
                        );
                        if (!matchesId && !matchesName && !matchesProc && !matchesTool) {
                            return false;
                        }
                    }
                    return true;
                });

                return {
                    ...phase,
                    filteredTtps
                };
            })
            .filter((phase) => phase.filteredTtps.length > 0);

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* 1. Interactive Cyber Kill Chain Pipeline Bar */}
                <div
                    style={{
                        background: 'rgba(10, 12, 18, 0.72)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '10px',
                        padding: '12px 14px'
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '10px',
                            marginBottom: '10px'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                                style={{
                                    fontSize: '0.74rem',
                                    fontWeight: 800,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.6px',
                                    color: '#22d3ee'
                                }}
                            >
                                Cyber Kill Chain Progression
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                — Techniques inside each phase are ranked by{' '}
                                <strong style={{ color: 'var(--text-secondary)' }}>
                                    Priority & Impact Score
                                </strong>{' '}
                                (Open Gaps + Control Drift + Arsenal Tool Overlap + Documented CTI)
                            </span>
                        </div>

                        {activePhaseFilter !== 'all' && (
                            <button
                                type="button"
                                onClick={() => setActivePhaseFilter('all')}
                                style={{
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    color: 'var(--text-secondary)',
                                    borderRadius: '6px',
                                    padding: '3px 9px',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >
                                Show All Phases ({killChainBoard.enrichedAllTTPs.length})
                            </button>
                        )}
                    </div>

                    {/* 7 Cyber Kill Chain Stage Pills */}
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(${killChainBoard.phases.length}, minmax(135px, 1fr))`,
                            gap: '8px',
                            overflowX: 'auto'
                        }}
                    >
                        {killChainBoard.phases.map((phase, pIdx) => {
                            const isFiltered = activePhaseFilter === phase.id;
                            const selectedInPhase = phase.ttps.filter((t) =>
                                isTtpStaged(t.id)
                            ).length;
                            const hasScoped = selectedInPhase > 0;

                            return (
                                <div
                                    key={phase.id}
                                    className="research-phase-tile"
                                    onClick={() =>
                                        setActivePhaseFilter((prev) =>
                                            prev === phase.id ? 'all' : phase.id
                                        )
                                    }
                                    style={{
                                        animationDelay: `${pIdx * 35}ms`,
                                        padding: '9px 11px',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        background: isFiltered
                                            ? 'rgba(6, 182, 212, 0.12)'
                                            : hasScoped
                                            ? 'rgba(168, 85, 247, 0.08)'
                                            : 'rgba(255,255,255,0.02)',
                                        border: isFiltered
                                            ? '1px solid rgba(34, 211, 238, 0.55)'
                                            : hasScoped
                                            ? '1px solid rgba(168, 85, 247, 0.35)'
                                            : '1px solid rgba(255,255,255,0.07)',
                                        borderTop: isFiltered
                                            ? '3px solid #22d3ee'
                                            : hasScoped
                                            ? '3px solid #c084fc'
                                            : '3px solid rgba(148, 163, 184, 0.32)'
                                    }}
                                >
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            gap: '4px',
                                            marginBottom: '4px'
                                        }}
                                    >
                                        <span
                                            style={{
                                                fontSize: '0.66rem',
                                                fontWeight: 800,
                                                color: isFiltered
                                                    ? '#22d3ee'
                                                    : hasScoped
                                                    ? '#d8b4fe'
                                                    : '#94a3b8',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.4px'
                                            }}
                                        >
                                            Phase {phase.phaseNumber}
                                        </span>
                                        {hasScoped && (
                                            <span
                                                className="research-badge-pop"
                                                style={{
                                                    fontSize: '0.64rem',
                                                    fontWeight: 800,
                                                    padding: '1px 6px',
                                                    borderRadius: '999px',
                                                    background: 'rgba(168, 85, 247, 0.22)',
                                                    color: '#d8b4fe',
                                                    border: '1px solid rgba(168, 85, 247, 0.4)'
                                                }}
                                            >
                                                {selectedInPhase} Scoped
                                            </span>
                                        )}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: '0.78rem',
                                            fontWeight: 800,
                                            color: 'var(--text-primary)',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            marginBottom: '4px'
                                        }}
                                        title={phase.name}
                                    >
                                        {phase.name}
                                    </div>
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            fontSize: '0.69rem',
                                            color: 'var(--text-muted)'
                                        }}
                                    >
                                        <span>{phase.ttps.length} TTPs</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Compact 1-Line Quick Attack Chains Strip */}
                    {Array.isArray(killChainBoard.operationalChains) &&
                        killChainBoard.operationalChains.length > 0 && (
                            <div
                                style={{
                                    marginTop: '10px',
                                    paddingTop: '10px',
                                    borderTop: '1px solid rgba(255,255,255,0.06)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    gap: '7px'
                                }}
                            >
                                <span
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        fontSize: '0.7rem',
                                        fontWeight: 800,
                                        color: 'var(--text-secondary)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.4px',
                                        marginRight: '2px'
                                    }}
                                    title="1-click multi-TTP attack chains that bundle an Execution Conduit + Precursor Discovery + Modifier + Anchor Objective"
                                >
                                    <Zap size={12} color="#c084fc" />
                                    Quick Chains:
                                </span>
                                {killChainBoard.operationalChains.map((chain) => {
                                    const allChainScoped = chain.ttpIds.every((id) =>
                                        isTtpStaged(id)
                                    );
                                    const someChainScoped =
                                        !allChainScoped &&
                                        chain.ttpIds.some((id) => isTtpStaged(id));

                                    return (
                                        <button
                                            key={chain.id}
                                            type="button"
                                            className="research-filter-pill"
                                            onClick={() =>
                                                toggleOperationalChain(chain, sourceEntityObj)
                                            }
                                            title={`${chain.title}: ${chain.ttps
                                                .map(
                                                    (t) =>
                                                        `${t.operationalRole?.shortLabel || 'TTP'} ${t.id} (${t.name})`
                                                )
                                                .join(' ➔ ')}`}
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                padding: '4px 10px',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                fontSize: '0.72rem',
                                                fontWeight: 700,
                                                background: allChainScoped
                                                    ? 'rgba(168, 85, 247, 0.18)'
                                                    : someChainScoped
                                                    ? 'rgba(168, 85, 247, 0.08)'
                                                    : 'rgba(255,255,255,0.03)',
                                                border: allChainScoped
                                                    ? '1px solid rgba(192, 132, 252, 0.5)'
                                                    : someChainScoped
                                                    ? '1px solid rgba(168, 85, 247, 0.3)'
                                                    : '1px solid rgba(255,255,255,0.09)',
                                                color: allChainScoped
                                                    ? '#e9d5ff'
                                                    : 'var(--text-primary)'
                                            }}
                                        >
                                            <span
                                                style={{
                                                    color: allChainScoped ? '#d8b4fe' : '#22d3ee',
                                                    fontWeight: 800
                                                }}
                                            >
                                                {allChainScoped ? '✓' : '+'} {chain.shortTitle}
                                            </span>
                                            <span
                                                style={{
                                                    fontFamily: 'monospace',
                                                    fontSize: '0.67rem',
                                                    color: 'var(--text-muted)'
                                                }}
                                            >
                                                ({chain.ttpIds.join(' ➔ ')})
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                </div>

                {/* 2. Search & Priority Filter Toolbar */}
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '10px',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        background: 'rgba(10, 12, 18, 0.65)',
                        border: '1px solid rgba(255,255,255,0.07)',
                        position: 'relative',
                        zIndex: isToolDropdownOpen ? 60 : 2
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        {[
                            {
                                id: 'all',
                                label: `All TTPs (${killChainBoard.enrichedAllTTPs.length})`
                            },
                            {
                                id: 'priority',
                                label: `Critical & High Priority (${
                                    killChainBoard.enrichedAllTTPs.filter(
                                        (t) =>
                                            t.priorityTier === 'CRITICAL' ||
                                            t.priorityTier === 'HIGH'
                                    ).length
                                })`
                            },
                            {
                                id: 'delta',
                                label: `Untested / Decayed (${
                                    killChainBoard.enrichedAllTTPs.filter(
                                        (t) => t.category !== 'coveredFresh'
                                    ).length
                                })`
                            },
                            {
                                id: 'selected',
                                label: `Scoped (${
                                    killChainBoard.enrichedAllTTPs.filter((t) => isTtpStaged(t.id))
                                        .length
                                })`
                            }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                className="research-filter-pill"
                                onClick={() => setPriorityFilter(tab.id)}
                                style={{
                                    padding: '5px 10px',
                                    borderRadius: '6px',
                                    border:
                                        priorityFilter === tab.id
                                            ? '1px solid rgba(6, 182, 212, 0.45)'
                                            : '1px solid rgba(255,255,255,0.08)',
                                    background:
                                        priorityFilter === tab.id
                                            ? 'rgba(6, 182, 212, 0.15)'
                                            : 'rgba(255,255,255,0.02)',
                                    color:
                                        priorityFilter === tab.id
                                            ? '#22d3ee'
                                            : 'var(--text-secondary)',
                                    fontSize: '0.74rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >
                                {tab.label}
                            </button>
                        ))}

                        {/* Custom Glassmorphic Actor Malware/Tool Filter Dropdown */}
                        {killChainBoard.actorTools.length > 0 && (
                            <div ref={toolDropdownRef} style={{ position: 'relative' }}>
                                <button
                                    type="button"
                                    className="research-filter-pill"
                                    onClick={() => {
                                        setIsToolDropdownOpen((prev) => !prev);
                                        if (!isToolDropdownOpen) setToolDropdownSearch('');
                                    }}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '7px',
                                        padding: '5px 11px',
                                        borderRadius: '6px',
                                        fontSize: '0.74rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        background:
                                            selectedToolFilter !== 'all'
                                                ? 'rgba(168, 85, 247, 0.16)'
                                                : isToolDropdownOpen
                                                ? 'rgba(168, 85, 247, 0.1)'
                                                : 'rgba(255,255,255,0.02)',
                                        border:
                                            selectedToolFilter !== 'all' || isToolDropdownOpen
                                                ? '1px solid rgba(192, 132, 252, 0.55)'
                                                : '1px solid rgba(255,255,255,0.08)',
                                        boxShadow:
                                            selectedToolFilter !== 'all' || isToolDropdownOpen
                                                ? '0 0 12px rgba(168, 85, 247, 0.22)'
                                                : 'none',
                                        color:
                                            selectedToolFilter !== 'all'
                                                ? '#e9d5ff'
                                                : isToolDropdownOpen
                                                ? 'var(--text-primary)'
                                                : 'var(--text-secondary)'
                                    }}
                                >
                                    <Wrench
                                        size={12}
                                        color={
                                            selectedToolFilter !== 'all' || isToolDropdownOpen
                                                ? '#c084fc'
                                                : 'var(--text-muted)'
                                        }
                                    />
                                    <span>
                                        {selectedToolFilter === 'all'
                                            ? `Filter by Actor Tool (${killChainBoard.actorTools.length})`
                                            : selectedToolFilter}
                                    </span>
                                    {selectedToolFilter !== 'all' && (
                                        <span
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedToolFilter('all');
                                                setIsToolDropdownOpen(false);
                                            }}
                                            title="Clear tool filter"
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                padding: '1px',
                                                borderRadius: '4px',
                                                color: '#d8b4fe'
                                            }}
                                        >
                                            <X size={12} />
                                        </span>
                                    )}
                                    <ChevronDown
                                        size={13}
                                        color={
                                            selectedToolFilter !== 'all' || isToolDropdownOpen
                                                ? '#c084fc'
                                                : 'var(--text-muted)'
                                        }
                                        style={{
                                            transform: isToolDropdownOpen
                                                ? 'rotate(180deg)'
                                                : 'rotate(0deg)',
                                            transition: 'transform 0.2s ease'
                                        }}
                                    />
                                </button>

                                {isToolDropdownOpen && (
                                    <div
                                        className="animate-fade-in"
                                        style={{
                                            position: 'absolute',
                                            top: 'calc(100% + 6px)',
                                            left: 0,
                                            minWidth: '275px',
                                            maxWidth: '340px',
                                            background: 'rgba(13, 15, 24, 0.98)',
                                            backdropFilter: 'blur(16px)',
                                            border: '1px solid rgba(168, 85, 247, 0.45)',
                                            borderRadius: '10px',
                                            padding: '8px',
                                            boxShadow:
                                                '0 16px 40px rgba(0, 0, 0, 0.7), 0 0 20px rgba(156, 39, 176, 0.18)',
                                            zIndex: 1000,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '6px'
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                padding: '2px 6px'
                                            }}
                                        >
                                            <span
                                                style={{
                                                    fontSize: '0.64rem',
                                                    fontWeight: 800,
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.8px',
                                                    color: 'var(--text-muted)'
                                                }}
                                            >
                                                Actor Arsenal ({killChainBoard.actorTools.length})
                                            </span>
                                            {selectedToolFilter !== 'all' && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedToolFilter('all');
                                                        setIsToolDropdownOpen(false);
                                                    }}
                                                    style={{
                                                        background: 'transparent',
                                                        border: 'none',
                                                        color: '#c084fc',
                                                        fontSize: '0.68rem',
                                                        fontWeight: 700,
                                                        cursor: 'pointer',
                                                        padding: 0
                                                    }}
                                                >
                                                    Reset
                                                </button>
                                            )}
                                        </div>

                                        {killChainBoard.actorTools.length > 5 && (
                                            <div style={{ position: 'relative' }}>
                                                <Search
                                                    size={12}
                                                    color="var(--text-muted)"
                                                    style={{
                                                        position: 'absolute',
                                                        left: '9px',
                                                        top: '50%',
                                                        transform: 'translateY(-50%)'
                                                    }}
                                                />
                                                <input
                                                    type="text"
                                                    className="ai-input"
                                                    placeholder="Search actor malware or tool..."
                                                    value={toolDropdownSearch}
                                                    onChange={(e) =>
                                                        setToolDropdownSearch(e.target.value)
                                                    }
                                                    onClick={(e) => e.stopPropagation()}
                                                    style={{
                                                        width: '100%',
                                                        boxSizing: 'border-box',
                                                        padding: '5px 8px 5px 26px',
                                                        fontSize: '0.73rem',
                                                        borderRadius: '6px',
                                                        background: 'rgba(0,0,0,0.45)'
                                                    }}
                                                />
                                            </div>
                                        )}

                                        <div
                                            className="custom-scrollbar"
                                            style={{
                                                maxHeight: '260px',
                                                overflowY: 'auto',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '2px',
                                                paddingRight: '2px'
                                            }}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedToolFilter('all');
                                                    setIsToolDropdownOpen(false);
                                                }}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    gap: '8px',
                                                    width: '100%',
                                                    padding: '7px 9px',
                                                    borderRadius: '6px',
                                                    border:
                                                        selectedToolFilter === 'all'
                                                            ? '1px solid rgba(168, 85, 247, 0.35)'
                                                            : '1px solid transparent',
                                                    background:
                                                        selectedToolFilter === 'all'
                                                            ? 'rgba(168, 85, 247, 0.15)'
                                                            : 'transparent',
                                                    color:
                                                        selectedToolFilter === 'all'
                                                            ? '#e9d5ff'
                                                            : 'var(--text-secondary)',
                                                    fontSize: '0.76rem',
                                                    fontWeight:
                                                        selectedToolFilter === 'all' ? 700 : 500,
                                                    cursor: 'pointer',
                                                    textAlign: 'left',
                                                    transition: 'all 0.15s ease'
                                                }}
                                                onMouseEnter={(e) => {
                                                    if (selectedToolFilter !== 'all') {
                                                        e.currentTarget.style.background =
                                                            'rgba(255,255,255,0.05)';
                                                        e.currentTarget.style.color =
                                                            'var(--text-primary)';
                                                    }
                                                }}
                                                onMouseLeave={(e) => {
                                                    if (selectedToolFilter !== 'all') {
                                                        e.currentTarget.style.background =
                                                            'transparent';
                                                        e.currentTarget.style.color =
                                                            'var(--text-secondary)';
                                                    }
                                                }}
                                            >
                                                <span>All Actor Tools</span>
                                                <span
                                                    style={{
                                                        fontSize: '0.66rem',
                                                        fontWeight: 700,
                                                        padding: '1px 6px',
                                                        borderRadius: '999px',
                                                        background: 'rgba(255,255,255,0.06)',
                                                        color: 'var(--text-muted)'
                                                    }}
                                                >
                                                    {killChainBoard.actorTools.length}
                                                </span>
                                            </button>

                                            {killChainBoard.actorTools
                                                .filter((sw) => {
                                                    const sq = toolDropdownSearch
                                                        .trim()
                                                        .toLowerCase();
                                                    if (!sq) return true;
                                                    return (
                                                        sw.name.toLowerCase().includes(sq) ||
                                                        (sw.type || '').toLowerCase().includes(sq)
                                                    );
                                                })
                                                .map((sw) => {
                                                    const isActive = selectedToolFilter === sw.name;
                                                    const isMalware =
                                                        (sw.type || '').toLowerCase() === 'malware';
                                                    const matchingTtpCount =
                                                        killChainBoard.enrichedAllTTPs.filter((t) =>
                                                            (t.matchedTools || []).includes(sw.name)
                                                        ).length;

                                                    return (
                                                        <button
                                                            key={sw.id}
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedToolFilter(sw.name);
                                                                setIsToolDropdownOpen(false);
                                                            }}
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'space-between',
                                                                gap: '10px',
                                                                width: '100%',
                                                                padding: '7px 9px',
                                                                borderRadius: '6px',
                                                                border: isActive
                                                                    ? '1px solid rgba(168, 85, 247, 0.4)'
                                                                    : '1px solid transparent',
                                                                background: isActive
                                                                    ? 'rgba(168, 85, 247, 0.18)'
                                                                    : 'transparent',
                                                                color: isActive
                                                                    ? '#f3e8ff'
                                                                    : 'var(--text-primary)',
                                                                fontSize: '0.76rem',
                                                                fontWeight: isActive ? 700 : 500,
                                                                cursor: 'pointer',
                                                                textAlign: 'left',
                                                                transition: 'all 0.15s ease'
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                if (!isActive) {
                                                                    e.currentTarget.style.background =
                                                                        'rgba(255,255,255,0.05)';
                                                                }
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                if (!isActive) {
                                                                    e.currentTarget.style.background =
                                                                        'transparent';
                                                                }
                                                            }}
                                                        >
                                                            <span
                                                                style={{
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'ellipsis',
                                                                    whiteSpace: 'nowrap'
                                                                }}
                                                            >
                                                                {sw.name}
                                                            </span>
                                                            <div
                                                                style={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '5px',
                                                                    flexShrink: 0
                                                                }}
                                                            >
                                                                {matchingTtpCount > 0 && (
                                                                    <span
                                                                        style={{
                                                                            fontSize: '0.64rem',
                                                                            color: 'var(--text-muted)',
                                                                            fontFamily: 'monospace'
                                                                        }}
                                                                    >
                                                                        {matchingTtpCount} TTP
                                                                        {matchingTtpCount === 1
                                                                            ? ''
                                                                            : 's'}
                                                                    </span>
                                                                )}
                                                                <span
                                                                    style={{
                                                                        fontSize: '0.62rem',
                                                                        fontWeight: 800,
                                                                        padding: '2px 6px',
                                                                        borderRadius: '4px',
                                                                        textTransform: 'uppercase',
                                                                        letterSpacing: '0.3px',
                                                                        background: isMalware
                                                                            ? 'rgba(239, 68, 68, 0.14)'
                                                                            : 'rgba(168, 85, 247, 0.14)',
                                                                        border: isMalware
                                                                            ? '1px solid rgba(239, 68, 68, 0.32)'
                                                                            : '1px solid rgba(168, 85, 247, 0.32)',
                                                                        color: isMalware
                                                                            ? '#f87171'
                                                                            : '#d8b4fe'
                                                                    }}
                                                                >
                                                                    {sw.type || 'Tool'}
                                                                </span>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div style={{ position: 'relative', width: '250px' }}>
                        <Search
                            size={13}
                            color="var(--text-muted)"
                            style={{
                                position: 'absolute',
                                left: '10px',
                                top: '50%',
                                transform: 'translateY(-50%)'
                            }}
                        />
                        <input
                            type="text"
                            className="ai-input"
                            placeholder="Filter T-code, name, tool, command..."
                            value={techSearch}
                            onChange={(e) => setTechSearch(e.target.value)}
                            style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                padding: '5px 10px 5px 28px',
                                fontSize: '0.76rem',
                                borderRadius: '6px'
                            }}
                        />
                    </div>
                </div>

                {/* 3. Unified Cyber Kill Chain Phase Sections */}
                {visiblePhases.length === 0 ? (
                    <div
                        style={{
                            padding: '28px',
                            textAlign: 'center',
                            color: 'var(--text-muted)',
                            background: 'rgba(10, 12, 18, 0.5)',
                            borderRadius: '10px',
                            border: '1px solid rgba(255,255,255,0.06)'
                        }}
                    >
                        No techniques match the active filter criteria.
                    </div>
                ) : (
                    visiblePhases.map((phase, phaseIdx) => {
                        const isCollapsed = !!collapsedPhases[phase.id];
                        const selectedInPhase = phase.ttps.filter((t) => isTtpStaged(t.id));
                        const hasScoped = selectedInPhase.length > 0;
                        const topIds = (phase.topPriorityTTPs || []).map((t) => t.id);

                        return (
                            <div
                                key={phase.id}
                                className="research-phase-section"
                                style={{
                                    animationDelay: `${phaseIdx * 45}ms`,
                                    background: 'rgba(10, 12, 18, 0.65)',
                                    border: hasScoped
                                        ? '1px solid rgba(168, 85, 247, 0.32)'
                                        : '1px solid rgba(255,255,255,0.08)',
                                    borderLeft: hasScoped
                                        ? '3px solid #c084fc'
                                        : '3px solid rgba(34, 211, 238, 0.35)',
                                    borderRadius: '10px',
                                    overflow: 'hidden'
                                }}
                            >
                                {/* Kill Chain Phase Section Header */}
                                <div
                                    style={{
                                        padding: '11px 16px',
                                        background: hasScoped
                                            ? 'rgba(168, 85, 247, 0.04)'
                                            : 'rgba(255,255,255,0.02)',
                                        borderBottom: isCollapsed
                                            ? '1px solid transparent'
                                            : '1px solid rgba(255,255,255,0.06)',
                                        transition: 'border-color 0.25s ease, background-color 0.25s ease',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        flexWrap: 'wrap',
                                        gap: '10px'
                                    }}
                                >
                                    <div
                                        onClick={() =>
                                            setCollapsedPhases((prev) => ({
                                                ...prev,
                                                [phase.id]: !prev[phase.id]
                                            }))
                                        }
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            cursor: 'pointer',
                                            flex: 1,
                                            minWidth: '240px'
                                        }}
                                    >
                                        <ChevronDown
                                            size={16}
                                            color="var(--text-secondary)"
                                            className={`research-chevron ${
                                                isCollapsed ? 'is-collapsed' : ''
                                            }`}
                                        />
                                        <span
                                            style={{
                                                fontSize: '0.7rem',
                                                fontWeight: 800,
                                                padding: '2px 8px',
                                                borderRadius: '4px',
                                                background: hasScoped
                                                    ? 'rgba(168, 85, 247, 0.16)'
                                                    : 'rgba(6, 182, 212, 0.1)',
                                                border: hasScoped
                                                    ? '1px solid rgba(168, 85, 247, 0.35)'
                                                    : '1px solid rgba(6, 182, 212, 0.22)',
                                                color: hasScoped ? '#d8b4fe' : '#22d3ee',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.5px',
                                                transition: 'all 0.2s ease'
                                            }}
                                        >
                                            Phase {phase.phaseNumber}
                                        </span>
                                        <span
                                            style={{
                                                fontSize: '0.92rem',
                                                fontWeight: 800,
                                                color: 'var(--text-primary)'
                                            }}
                                        >
                                            {phase.name}
                                        </span>
                                        <span
                                            style={{
                                                fontSize: '0.73rem',
                                                color: 'var(--text-muted)'
                                            }}
                                        >
                                            ({phase.tactics.join(' • ')})
                                        </span>
                                    </div>

                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            flexWrap: 'wrap'
                                        }}
                                    >
                                        <span
                                            style={{
                                                fontSize: '0.73rem',
                                                color: 'var(--text-secondary)'
                                            }}
                                        >
                                            {phase.filteredTtps.length} TTP
                                            {phase.filteredTtps.length === 1 ? '' : 's'}
                                            {selectedInPhase.length > 0 && (
                                                <strong
                                                    style={{
                                                        color: '#d8b4fe',
                                                        marginLeft: '6px'
                                                    }}
                                                >
                                                    • {selectedInPhase.length} Scoped
                                                </strong>
                                            )}
                                        </span>

                                        {selectedInPhase.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => clearPhaseSelection(phase)}
                                                style={{
                                                    padding: '4px 8px',
                                                    borderRadius: '6px',
                                                    border: '1px solid rgba(255,255,255,0.1)',
                                                    background: 'transparent',
                                                    color: 'var(--text-muted)',
                                                    fontSize: '0.7rem',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Clear
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Ranked TTP Rows Inside Phase (Smooth CSS Grid Accordion) */}
                                <div
                                    className={`research-accordion-grid ${
                                        isCollapsed ? '' : 'is-open'
                                    }`}
                                >
                                    <div className="research-accordion-inner">
                                        {phase.filteredTtps.map((ttp, idx) => {
                                            const staged = isTtpStaged(ttp.id);
                                            const priorityStyle = getPriorityBadgeStyle(
                                                ttp.priorityTier
                                            );
                                            const postureStyle = getPostureBadgeStyle(ttp.category);
                                            const isTopRecommended = topIds.includes(ttp.id);

                                            return (
                                                <div
                                                    key={ttp.id}
                                                    className={`research-ttp-row ${
                                                        staged ? 'is-staged' : ''
                                                    }`}
                                                    onClick={() =>
                                                        toggleStageTtp(ttp, sourceEntityObj)
                                                    }
                                                    style={{
                                                        display: 'grid',
                                                        gridTemplateColumns:
                                                            '32px 138px 220px 1fr 135px 76px',
                                                        alignItems: 'center',
                                                        gap: '12px',
                                                        padding: '10px 16px',
                                                        borderBottom:
                                                            idx < phase.filteredTtps.length - 1
                                                                ? '1px solid rgba(255,255,255,0.04)'
                                                                : 'none',
                                                        background: staged
                                                            ? 'rgba(168, 85, 247, 0.09)'
                                                            : isTopRecommended
                                                            ? 'rgba(6, 182, 212, 0.03)'
                                                            : 'transparent',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    {/* 1. Checkbox */}
                                                    <div
                                                        className={
                                                            staged ? 'research-check-pop' : ''
                                                        }
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center'
                                                        }}
                                                    >
                                                        {staged ? (
                                                            <CheckSquare
                                                                size={16}
                                                                color="#c084fc"
                                                            />
                                                        ) : (
                                                            <Square
                                                                size={16}
                                                                color="rgba(255,255,255,0.25)"
                                                            />
                                                        )}
                                                    </div>

                                                    {/* 2. Priority Tier & Score Badge */}
                                                    <div
                                                        style={{
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            gap: '3px'
                                                        }}
                                                    >
                                                        <span
                                                            style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'space-between',
                                                                gap: '4px',
                                                                fontSize: '0.64rem',
                                                                fontWeight: 800,
                                                                padding: '2px 7px',
                                                                borderRadius: '4px',
                                                                background: priorityStyle.bg,
                                                                color: priorityStyle.color,
                                                                border: `1px solid ${priorityStyle.border}`,
                                                                width: 'fit-content'
                                                            }}
                                                            title={`Priority Score: ${ttp.priorityScore}/100`}
                                                        >
                                                            <span>{priorityStyle.label}</span>
                                                        </span>
                                                        <span
                                                            style={{
                                                                fontSize: '0.65rem',
                                                                color: 'var(--text-muted)',
                                                                fontFamily: 'monospace'
                                                            }}
                                                        >
                                                            Impact Score: {ttp.priorityScore}/100
                                                        </span>
                                                    </div>

                                                    {/* 3. Technique ID, Name & Operational Role */}
                                                    <div style={{ minWidth: 0 }}>
                                                        <div
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                flexWrap: 'wrap',
                                                                gap: '5px',
                                                                marginBottom: '2px'
                                                            }}
                                                        >
                                                            <span
                                                                style={{
                                                                    fontFamily: 'monospace',
                                                                    fontWeight: 800,
                                                                    color: '#22d3ee',
                                                                    fontSize: '0.78rem'
                                                                }}
                                                            >
                                                                {ttp.id}
                                                            </span>
                                                            {(() => {
                                                                const roleInfo =
                                                                    ttp.operationalRole ||
                                                                    classifyTtpOperationalRole(ttp);
                                                                return (
                                                                    <span
                                                                        style={{
                                                                            fontSize: '0.61rem',
                                                                            fontWeight: 800,
                                                                            padding: '1px 5px',
                                                                            borderRadius: '4px',
                                                                            background: roleInfo.bg,
                                                                            color: roleInfo.color,
                                                                            border: `1px solid ${roleInfo.border}`
                                                                        }}
                                                                        title={roleInfo.description}
                                                                    >
                                                                        {roleInfo.shortLabel}
                                                                    </span>
                                                                );
                                                            })()}
                                                        </div>
                                                        <div
                                                            style={{
                                                                fontSize: '0.82rem',
                                                                fontWeight: 700,
                                                                color: 'var(--text-primary)',
                                                                whiteSpace: 'nowrap',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis'
                                                            }}
                                                            title={ttp.name}
                                                        >
                                                            {ttp.name}
                                                        </div>
                                                    </div>

                                                    {/* 4. Priority Reasons + Companion Anchor + Observed Adversary Tradecraft */}
                                                    <div style={{ minWidth: 0 }}>
                                                        {((Array.isArray(ttp.priorityReasons) &&
                                                            ttp.priorityReasons.length > 0) ||
                                                            (ttp.operationalRole?.role !==
                                                                'ANCHOR' &&
                                                                ttp.companionAnchor)) && (
                                                            <div
                                                                style={{
                                                                    display: 'flex',
                                                                    flexWrap: 'wrap',
                                                                    gap: '5px',
                                                                    marginBottom: '4px'
                                                                }}
                                                            >
                                                                {(ttp.priorityReasons || []).map(
                                                                    (r, rIdx) => (
                                                                        <span
                                                                            key={rIdx}
                                                                            style={{
                                                                                fontSize: '0.64rem',
                                                                                fontWeight: 700,
                                                                                padding: '1px 6px',
                                                                                borderRadius: '4px',
                                                                                background: r.bg,
                                                                                color: r.color,
                                                                                border: `1px solid ${r.border}`
                                                                            }}
                                                                        >
                                                                            {r.label}
                                                                        </span>
                                                                    )
                                                                )}
                                                                {ttp.operationalRole?.role !==
                                                                    'ANCHOR' &&
                                                                    ttp.companionAnchor && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                stageTtpWithCompanionAnchor(
                                                                                    ttp,
                                                                                    ttp.companionAnchor,
                                                                                    killChainBoard.enrichedAllTTPs,
                                                                                    sourceEntityObj
                                                                                );
                                                                            }}
                                                                            style={{
                                                                                fontSize: '0.63rem',
                                                                                fontWeight: 700,
                                                                                padding: '1px 6px',
                                                                                borderRadius: '4px',
                                                                                background: isTtpStaged(
                                                                                    ttp
                                                                                        .companionAnchor
                                                                                        .id
                                                                                )
                                                                                    ? 'rgba(168, 85, 247, 0.2)'
                                                                                    : 'rgba(6, 182, 212, 0.08)',
                                                                                color: isTtpStaged(
                                                                                    ttp
                                                                                        .companionAnchor
                                                                                        .id
                                                                                )
                                                                                    ? '#e9d5ff'
                                                                                    : '#67e8f9',
                                                                                border: isTtpStaged(
                                                                                    ttp
                                                                                        .companionAnchor
                                                                                        .id
                                                                                )
                                                                                    ? '1px solid rgba(168, 85, 247, 0.4)'
                                                                                    : '1px solid rgba(6, 182, 212, 0.25)',
                                                                                cursor: 'pointer'
                                                                            }}
                                                                            title={`Click to scope ${ttp.id} together with its companion Anchor Objective ${ttp.companionAnchor.id} (${ttp.companionAnchor.name})`}
                                                                        >
                                                                            {isTtpStaged(
                                                                                ttp.companionAnchor
                                                                                    .id
                                                                            )
                                                                                ? `✓ Fused w/ ${ttp.companionAnchor.id}`
                                                                                : `+ Fuse w/ Anchor ${ttp.companionAnchor.id} (${ttp.companionAnchor.name})`}
                                                                        </button>
                                                                    )}
                                                            </div>
                                                        )}
                                                        <div
                                                            style={{
                                                                fontSize: '0.75rem',
                                                                color: 'var(--text-secondary)',
                                                                lineHeight: 1.35,
                                                                display: '-webkit-box',
                                                                WebkitLineClamp: 2,
                                                                WebkitBoxOrient: 'vertical',
                                                                overflow: 'hidden'
                                                            }}
                                                            title={
                                                                ttp.procedureDesc ||
                                                                ttp.externalComment ||
                                                                ''
                                                            }
                                                        >
                                                            {ttp.procedureDesc ||
                                                                ttp.externalComment || (
                                                                    <span
                                                                        style={{
                                                                            color: 'var(--text-muted)'
                                                                        }}
                                                                    >
                                                                        Known adversary technique in{' '}
                                                                        {phase.name}.
                                                                    </span>
                                                                )}
                                                        </div>
                                                    </div>

                                                    {/* 5. Internal Control Drift Posture */}
                                                    <div>
                                                        <span
                                                            style={{
                                                                fontSize: '0.67rem',
                                                                fontWeight: 800,
                                                                padding: '3px 8px',
                                                                borderRadius: '999px',
                                                                background: postureStyle.bg,
                                                                color: postureStyle.color,
                                                                border: `1px solid ${postureStyle.border}`,
                                                                display: 'inline-block'
                                                            }}
                                                        >
                                                            {postureStyle.label}
                                                        </span>
                                                        {ttp.testCount > 0 && (
                                                            <div
                                                                style={{
                                                                    fontSize: '0.65rem',
                                                                    color: 'var(--text-muted)',
                                                                    marginTop: '3px'
                                                                }}
                                                            >
                                                                {ttp.testCount} prior test
                                                                {ttp.testCount === 1 ? '' : 's'}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* 6. Inspect Drawer Trigger */}
                                                    <div style={{ textAlign: 'right' }}>
                                                        <button
                                                            type="button"
                                                            className="research-inspect-btn"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setDrawerTtpId(ttp.id);
                                                            }}
                                                            style={{
                                                                background:
                                                                    'rgba(255,255,255,0.04)',
                                                                border: '1px solid rgba(255,255,255,0.1)',
                                                                color: 'var(--text-secondary)',
                                                                borderRadius: '6px',
                                                                padding: '4px 9px',
                                                                fontSize: '0.71rem',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            Inspect
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        );
    };

    return (
        <div
            className="animate-fade-in"
            style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                minHeight: 0,
                gap: '14px',
                paddingBottom: '20px'
            }}
        >
            {/* Top Header: Standard Page Title + Mode Tabs + Primary Step 1 Handoff */}
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '15px',
                    flexShrink: 0
                }}
            >
                <div>
                    <h1
                        className="iridescent-text"
                        style={{
                            fontSize: '2.5rem',
                            margin: '0 0 5px 0',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '15px'
                        }}
                    >
                        Threat Catalog
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                        MITRE ATT&CK STIX 2.1 • Cyber Kill Chain Prioritization & Scoping
                    </p>
                </div>

                {/* Right: Active Scope Pill + Send to Simulation Launcher CTA */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    {stagedTTPs.length > 0 && (
                        <div
                            className="research-badge-pop"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '6px 11px',
                                borderRadius: '8px',
                                background: 'rgba(168, 85, 247, 0.14)',
                                border: '1px solid rgba(168, 85, 247, 0.35)',
                                fontSize: '0.77rem',
                                color: '#e9d5ff',
                                fontWeight: 700
                            }}
                        >
                            <span>{stagedTTPs.length} TTPs Scoped</span>
                            <button
                                type="button"
                                onClick={() => {
                                    setStagedTTPs([]);
                                    setScopeSourceLabel('');
                                    setScopeSourceId('');
                                }}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: 0
                                }}
                                title="Clear scoped TTPs"
                            >
                                <X size={13} />
                            </button>
                        </div>
                    )}
                    <button
                        type="button"
                        className="btn hover-lift"
                        onClick={handleSendToStep1}
                        disabled={stagedTTPs.length === 0}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        <span>
                            Send to Simulation Launcher
                            {stagedTTPs.length > 0 ? ` (${stagedTTPs.length})` : ''}
                        </span>
                        <ArrowRight size={15} />
                    </button>
                </div>
            </div>

            {isCtiLoading ? (
                <div
                    className="glass-panel"
                    style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                        padding: '50px'
                    }}
                >
                    <Loader2
                        size={28}
                        color="#22d3ee"
                        style={{ animation: 'spin 1s linear infinite' }}
                    />
                    <div
                        style={{
                            fontSize: '0.92rem',
                            fontWeight: 700,
                            color: 'var(--text-primary)'
                        }}
                    >
                        Indexing MITRE ATT&CK STIX 2.1 Threat Knowledge Base...
                    </div>
                </div>
            ) : ctiError ? (
                <div className="glass-panel" style={{ padding: '24px', color: 'var(--danger)' }}>
                    Failed to load CTI data: {ctiError}
                </div>
            ) : (
                /* ============================================================================
                   THREAT CATALOG (APT GROUPS & MALWARE / TOOLS)
                   ============================================================================ */
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: '280px 1fr',
                        gap: '14px',
                        flex: 1,
                        minHeight: 0
                    }}
                >
                    {/* Left Sidebar: Compact Entity Browser */}
                    <div
                        className="glass-panel"
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                            background: 'rgba(10, 12, 18, 0.7)'
                        }}
                    >
                        <div
                            style={{
                                padding: '12px',
                                borderBottom: '1px solid rgba(255,255,255,0.06)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px'
                            }}
                        >
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: '4px',
                                    background: 'rgba(0,0,0,0.35)',
                                    padding: '3px',
                                    borderRadius: '7px'
                                }}
                            >
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCatalogType('groups');
                                        if (ctiData?.groups?.length) {
                                            setSelectedEntityId(ctiData.groups[0].id);
                                        }
                                    }}
                                    style={{
                                        padding: '6px',
                                        borderRadius: '5px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontWeight: 700,
                                        fontSize: '0.75rem',
                                        background:
                                            catalogType === 'groups'
                                                ? 'rgba(6, 182, 212, 0.18)'
                                                : 'transparent',
                                        color:
                                            catalogType === 'groups'
                                                ? '#22d3ee'
                                                : 'var(--text-secondary)'
                                    }}
                                >
                                    APT Groups ({ctiData.groups.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCatalogType('software');
                                        if (ctiData?.software?.length) {
                                            setSelectedEntityId(ctiData.software[0].id);
                                        }
                                    }}
                                    style={{
                                        padding: '6px',
                                        borderRadius: '5px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontWeight: 700,
                                        fontSize: '0.75rem',
                                        background:
                                            catalogType === 'software'
                                                ? 'rgba(168, 85, 247, 0.2)'
                                                : 'transparent',
                                        color:
                                            catalogType === 'software'
                                                ? '#d8b4fe'
                                                : 'var(--text-secondary)'
                                    }}
                                >
                                    Malware / Tools ({ctiData.software.length})
                                </button>
                            </div>

                            <div style={{ display: 'flex', gap: '6px' }}>
                                <div style={{ position: 'relative', flex: 1 }}>
                                    <Search
                                        size={14}
                                        color="var(--text-muted)"
                                        style={{
                                            position: 'absolute',
                                            left: '9px',
                                            top: '50%',
                                            transform: 'translateY(-50%)'
                                        }}
                                    />
                                    <input
                                        type="text"
                                        className="ai-input"
                                        placeholder="Search actor, alias, ID..."
                                        value={actorSearch}
                                        onChange={(e) => setActorSearch(e.target.value)}
                                        style={{
                                            width: '100%',
                                            boxSizing: 'border-box',
                                            padding: '6px 8px 6px 28px',
                                            fontSize: '0.78rem'
                                        }}
                                    />
                                </div>
                                <div ref={sortDropdownRef} style={{ position: 'relative' }}>
                                    <button
                                        type="button"
                                        onClick={() => setIsSortDropdownOpen((prev) => !prev)}
                                        title="Sort catalog"
                                        style={{
                                            height: '100%',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '5px',
                                            padding: '5px 8px',
                                            borderRadius: '6px',
                                            fontSize: '0.72rem',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            background: isSortDropdownOpen
                                                ? 'rgba(6, 182, 212, 0.14)'
                                                : 'rgba(0,0,0,0.4)',
                                            border: isSortDropdownOpen
                                                ? '1px solid rgba(34, 211, 238, 0.5)'
                                                : '1px solid var(--glass-border)',
                                            color: isSortDropdownOpen
                                                ? '#22d3ee'
                                                : 'var(--text-secondary)',
                                            whiteSpace: 'nowrap'
                                        }}
                                    >
                                        <span>
                                            {actorSort === 'name_asc' ? 'A–Z' : 'Most TTPs'}
                                        </span>
                                        <ChevronDown
                                            size={12}
                                            style={{
                                                transform: isSortDropdownOpen
                                                    ? 'rotate(180deg)'
                                                    : 'rotate(0deg)',
                                                transition: 'transform 0.2s ease'
                                            }}
                                        />
                                    </button>

                                    {isSortDropdownOpen && (
                                        <div
                                            className="animate-fade-in"
                                            style={{
                                                position: 'absolute',
                                                top: 'calc(100% + 5px)',
                                                right: 0,
                                                minWidth: '130px',
                                                background: 'rgba(13, 15, 24, 0.98)',
                                                backdropFilter: 'blur(16px)',
                                                border: '1px solid rgba(34, 211, 238, 0.45)',
                                                borderRadius: '8px',
                                                padding: '5px',
                                                boxShadow: '0 12px 30px rgba(0, 0, 0, 0.65)',
                                                zIndex: 1000,
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '2px'
                                            }}
                                        >
                                            {[
                                                { id: 'ttps_desc', label: 'Most TTPs' },
                                                { id: 'name_asc', label: 'A–Z Name' }
                                            ].map((opt) => {
                                                const isActive = actorSort === opt.id;
                                                return (
                                                    <button
                                                        key={opt.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setActorSort(opt.id);
                                                            setIsSortDropdownOpen(false);
                                                        }}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'space-between',
                                                            width: '100%',
                                                            padding: '6px 8px',
                                                            borderRadius: '5px',
                                                            border: isActive
                                                                ? '1px solid rgba(34, 211, 238, 0.35)'
                                                                : '1px solid transparent',
                                                            background: isActive
                                                                ? 'rgba(6, 182, 212, 0.16)'
                                                                : 'transparent',
                                                            color: isActive
                                                                ? '#22d3ee'
                                                                : 'var(--text-secondary)',
                                                            fontSize: '0.74rem',
                                                            fontWeight: isActive ? 700 : 500,
                                                            cursor: 'pointer',
                                                            textAlign: 'left'
                                                        }}
                                                    >
                                                        <span>{opt.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div
                            className="custom-scrollbar"
                            style={{
                                flex: 1,
                                overflowY: 'auto',
                                padding: '8px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px'
                            }}
                        >
                            {catalogEntities.map((item) => {
                                const isSelected = selectedEntity?.id === item.id;
                                return (
                                    <div
                                        key={item.id}
                                        className={`research-entity-card ${
                                            isSelected ? 'is-selected' : ''
                                        }`}
                                        onClick={() => setSelectedEntityId(item.id)}
                                        style={{
                                            padding: '9px 11px',
                                            borderRadius: '7px',
                                            cursor: 'pointer',
                                            background: isSelected
                                                ? 'rgba(6, 182, 212, 0.13)'
                                                : 'rgba(255,255,255,0.015)',
                                            border: isSelected
                                                ? '1px solid rgba(6, 182, 212, 0.4)'
                                                : '1px solid rgba(255,255,255,0.04)'
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }}
                                        >
                                            <span
                                                style={{
                                                    fontWeight: 700,
                                                    fontSize: '0.83rem',
                                                    color: isSelected
                                                        ? '#22d3ee'
                                                        : 'var(--text-primary)',
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis'
                                                }}
                                            >
                                                {item.name}
                                            </span>
                                            <span
                                                style={{
                                                    fontSize: '0.67rem',
                                                    fontFamily: 'monospace',
                                                    color: 'var(--text-muted)',
                                                    flexShrink: 0
                                                }}
                                            >
                                                {item.ttps.length} TTPs
                                            </span>
                                        </div>
                                        {item.aliases?.length > 0 && (
                                            <div
                                                style={{
                                                    fontSize: '0.68rem',
                                                    color: 'var(--text-muted)',
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    marginTop: '2px'
                                                }}
                                            >
                                                {item.aliases.slice(0, 2).join(', ')}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right Workspace: Compact Header + Unified Cyber Kill Chain Board */}
                    {selectedEntity && selectedEntityDelta && entityKillChainBoard ? (
                        <div
                            key={selectedEntity.id}
                            className="custom-scrollbar research-workspace-animate"
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '14px',
                                overflowY: 'auto',
                                paddingRight: '4px'
                            }}
                        >
                            {/* Compact Actor Header Bar */}
                            <div
                                className="glass-panel"
                                style={{
                                    padding: '14px 18px',
                                    background: 'rgba(13, 16, 25, 0.8)',
                                    border: '1px solid rgba(255,255,255,0.08)'
                                }}
                            >
                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        flexWrap: 'wrap',
                                        gap: '12px'
                                    }}
                                >
                                    {/* Left: ID + Name + Top Aliases + Profile Toggle */}
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            flexWrap: 'wrap'
                                        }}
                                    >
                                        <span
                                            style={{
                                                fontSize: '0.72rem',
                                                fontFamily: 'monospace',
                                                fontWeight: 800,
                                                padding: '3px 8px',
                                                borderRadius: '5px',
                                                background: 'rgba(6, 182, 212, 0.14)',
                                                color: '#22d3ee',
                                                border: '1px solid rgba(6, 182, 212, 0.3)'
                                            }}
                                        >
                                            {selectedEntity.id}
                                        </span>
                                        <h3
                                            style={{
                                                margin: 0,
                                                fontSize: '1.22rem',
                                                fontWeight: 800,
                                                color: 'var(--text-primary)'
                                            }}
                                        >
                                            {selectedEntity.name}
                                        </h3>
                                        {selectedEntity.aliases?.length > 0 && (
                                            <span
                                                style={{
                                                    fontSize: '0.76rem',
                                                    color: 'var(--text-muted)'
                                                }}
                                            >
                                                ({selectedEntity.aliases.slice(0, 3).join(', ')}
                                                {selectedEntity.aliases.length > 3
                                                    ? ` +${selectedEntity.aliases.length - 3}`
                                                    : ''}
                                                )
                                            </span>
                                        )}
                                        <button
                                            type="button"
                                            className="research-filter-pill"
                                            onClick={() => setShowBioDetails((v) => !v)}
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                background: 'rgba(255,255,255,0.04)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '6px',
                                                padding: '3px 8px',
                                                fontSize: '0.71rem',
                                                color: 'var(--text-secondary)',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <Info size={12} /> Profile{' '}
                                            <ChevronDown
                                                size={12}
                                                className={`research-chevron ${
                                                    showBioDetails ? 'is-flipped' : ''
                                                }`}
                                            />
                                        </button>
                                    </div>

                                    {/* Right: Posture Summary + Auto-Scope Priority Buttons */}
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            flexWrap: 'wrap'
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                padding: '5px 10px',
                                                borderRadius: '7px',
                                                background: 'rgba(0,0,0,0.3)',
                                                border: '1px solid rgba(255,255,255,0.07)',
                                                fontSize: '0.74rem'
                                            }}
                                        >
                                            <span style={{ color: 'var(--text-secondary)' }}>
                                                Validated:{' '}
                                                <strong style={{ color: '#10b981' }}>
                                                    {selectedEntityDelta.coveredFresh.length}
                                                </strong>
                                                /{selectedEntityDelta.total}
                                            </span>
                                            <span style={{ color: 'rgba(255,255,255,0.15)' }}>
                                                |
                                            </span>
                                            <span style={{ color: 'var(--text-secondary)' }}>
                                                Readiness:{' '}
                                                <strong
                                                    style={{
                                                        color:
                                                            selectedEntityDelta.readinessScore >= 70
                                                                ? '#10b981'
                                                                : selectedEntityDelta.readinessScore >=
                                                                  40
                                                                ? '#f59e0b'
                                                                : '#ef4444'
                                                    }}
                                                >
                                                    {selectedEntityDelta.readinessScore}%
                                                </strong>
                                            </span>
                                        </div>

                                        <button
                                            type="button"
                                            className="btn hover-lift"
                                            onClick={() =>
                                                handleExportEntityLayer(
                                                    selectedEntity.name,
                                                    selectedEntity.ttps
                                                )
                                            }
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '5px',
                                                padding: '6px 10px',
                                                fontSize: '0.74rem',
                                                background: 'rgba(255,255,255,0.04)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                color: 'var(--text-secondary)'
                                            }}
                                            title="Download MITRE ATT&CK Navigator Layer (.json)"
                                        >
                                            <Download size={13} /> Layer (.json)
                                        </button>
                                    </div>
                                </div>

                                {/* Collapsible Actor Biography (Smooth CSS Grid Accordion) */}
                                <div
                                    className={`research-accordion-grid ${
                                        showBioDetails ? 'is-open' : ''
                                    }`}
                                >
                                    <div className="research-accordion-inner">
                                        <div
                                            style={{
                                                marginTop: '12px',
                                                paddingTop: '12px',
                                                borderTop: '1px solid rgba(255,255,255,0.06)',
                                                fontSize: '0.8rem',
                                                color: 'var(--text-secondary)',
                                                lineHeight: 1.55
                                            }}
                                        >
                                            <p style={{ margin: '0 0 8px 0' }}>
                                                {selectedEntity.description ||
                                                    'No description available.'}
                                            </p>
                                            {selectedEntity.url && (
                                                <a
                                                    href={selectedEntity.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        color: '#22d3ee',
                                                        fontSize: '0.74rem',
                                                        textDecoration: 'none'
                                                    }}
                                                >
                                                    Official MITRE ATT&CK Reference{' '}
                                                    <ExternalLink size={12} />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Unified Cyber Kill Chain Board */}
                            {renderUnifiedKillChainBoard(entityKillChainBoard, selectedEntity)}
                        </div>
                    ) : null}
                </div>
            )}

            {/* ============================================================================
                SLIDE-OVER TECHNIQUE DEEP-DIVE DRAWER (PORTAL)
               ============================================================================ */}
            {drawerTechnique &&
                createPortal(
                    <div
                        className="research-drawer-backdrop"
                        onClick={() => setDrawerTtpId(null)}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0, 0, 0, 0.65)',
                            backdropFilter: 'blur(4px)',
                            zIndex: 9999,
                            display: 'flex',
                            justifyContent: 'flex-end'
                        }}
                    >
                        <div
                            onClick={(e) => e.stopPropagation()}
                            className="custom-scrollbar research-drawer-panel"
                            style={{
                                width: 'min(640px, 92vw)',
                                height: '100%',
                                background: '#0b0e17',
                                borderLeft: '1px solid rgba(255,255,255,0.12)',
                                padding: '22px',
                                overflowY: 'auto',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '18px',
                                boxSizing: 'border-box'
                            }}
                        >
                            {/* Drawer Header */}
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start',
                                    gap: '12px',
                                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                                    paddingBottom: '14px'
                                }}
                            >
                                <div>
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            marginBottom: '6px',
                                            flexWrap: 'wrap'
                                        }}
                                    >
                                        <span
                                            style={{
                                                fontFamily: 'monospace',
                                                fontWeight: 800,
                                                fontSize: '0.82rem',
                                                padding: '3px 8px',
                                                borderRadius: '5px',
                                                background: 'rgba(6, 182, 212, 0.15)',
                                                color: '#22d3ee',
                                                border: '1px solid rgba(6, 182, 212, 0.35)'
                                            }}
                                        >
                                            {drawerTechnique.id}
                                        </span>
                                        {(drawerTechnique.tactics || []).map((tac) => (
                                            <span
                                                key={tac}
                                                style={{
                                                    fontSize: '0.68rem',
                                                    padding: '2px 7px',
                                                    borderRadius: '4px',
                                                    background: 'rgba(255,255,255,0.05)',
                                                    color: 'var(--text-secondary)'
                                                }}
                                            >
                                                {tac}
                                            </span>
                                        ))}
                                    </div>
                                    <h3
                                        style={{
                                            margin: 0,
                                            fontSize: '1.15rem',
                                            fontWeight: 800,
                                            color: 'var(--text-primary)'
                                        }}
                                    >
                                        {drawerTechnique.name}
                                    </h3>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <button
                                        type="button"
                                        className="btn hover-lift"
                                        onClick={() => toggleStageTtp(drawerTechnique)}
                                        style={{
                                            padding: '6px 12px',
                                            fontSize: '0.76rem',
                                            fontWeight: 700,
                                            background: isTtpStaged(drawerTechnique.id)
                                                ? 'rgba(168, 85, 247, 0.2)'
                                                : 'rgba(6, 182, 212, 0.15)',
                                            color: isTtpStaged(drawerTechnique.id)
                                                ? '#d8b4fe'
                                                : '#22d3ee',
                                            border: '1px solid rgba(6, 182, 212, 0.35)'
                                        }}
                                    >
                                        {isTtpStaged(drawerTechnique.id)
                                            ? '✓ In Step 1 Scope'
                                            : '+ Add to Scope'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDrawerTtpId(null)}
                                        style={{
                                            background: 'rgba(255,255,255,0.05)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            color: 'var(--text-secondary)',
                                            borderRadius: '6px',
                                            padding: '6px',
                                            cursor: 'pointer',
                                            display: 'flex'
                                        }}
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* 1. Internal Control Drift Historical Variations */}
                            <div
                                style={{
                                    padding: '14px',
                                    borderRadius: '8px',
                                    background: 'rgba(16, 185, 129, 0.04)',
                                    border: '1px solid rgba(16, 185, 129, 0.2)'
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: '0.74rem',
                                        fontWeight: 800,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px',
                                        color: '#10b981',
                                        marginBottom: '8px'
                                    }}
                                >
                                    Simulation History
                                </div>
                                {drawerHistoricalVariations.length === 0 ? (
                                    <div
                                        style={{
                                            fontSize: '0.78rem',
                                            color: 'var(--text-muted)'
                                        }}
                                    >
                                        Never validated in your workspace. Scoping this TTP into
                                        Step 1 will establish your initial baseline.
                                    </div>
                                ) : (
                                    <div
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '8px'
                                        }}
                                    >
                                        {drawerHistoricalVariations.map((v, i) => (
                                            <div
                                                key={i}
                                                style={{
                                                    padding: '10px',
                                                    borderRadius: '6px',
                                                    background: 'rgba(0,0,0,0.35)',
                                                    border: '1px solid rgba(255,255,255,0.06)'
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        fontSize: '0.75rem',
                                                        marginBottom: '4px'
                                                    }}
                                                >
                                                    <strong style={{ color: 'var(--text-primary)' }}>
                                                        {v.name} ({v.simName})
                                                    </strong>
                                                    <span style={{ color: '#22d3ee' }}>
                                                        {v.outcome}
                                                    </span>
                                                </div>
                                                {v.payloadCode && (
                                                    <pre
                                                        style={{
                                                            margin: 0,
                                                            padding: '8px',
                                                            borderRadius: '4px',
                                                            background: 'rgba(0,0,0,0.45)',
                                                            color: '#cbd5e1',
                                                            fontSize: '0.72rem',
                                                            overflowX: 'auto',
                                                            fontFamily: 'monospace'
                                                        }}
                                                    >
                                                        {v.payloadCode}
                                                    </pre>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* 2. Real-World Adversary STIX Procedure Examples */}
                            <div>
                                <div
                                    style={{
                                        fontSize: '0.74rem',
                                        fontWeight: 800,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px',
                                        color: '#22d3ee',
                                        marginBottom: '8px'
                                    }}
                                >
                                    Real-World Adversary Procedure Examples (
                                    {drawerTechnique.procedureExamples?.length || 0})
                                </div>
                                {drawerTechnique.procedureExamples?.length > 0 ? (
                                    <div
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '6px'
                                        }}
                                    >
                                        {drawerTechnique.procedureExamples.map((ex, i) => (
                                            <div
                                                key={i}
                                                style={{
                                                    padding: '9px 12px',
                                                    borderRadius: '6px',
                                                    background: 'rgba(255,255,255,0.02)',
                                                    border: '1px solid rgba(255,255,255,0.06)',
                                                    fontSize: '0.77rem',
                                                    color: 'var(--text-secondary)',
                                                    lineHeight: 1.45
                                                }}
                                            >
                                                <strong style={{ color: 'var(--text-primary)' }}>
                                                    {ex.actorName} ({ex.actorId}):{' '}
                                                </strong>
                                                {ex.description}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div
                                        style={{
                                            fontSize: '0.78rem',
                                            color: 'var(--text-muted)'
                                        }}
                                    >
                                        No specific procedure examples documented in STIX.
                                    </div>
                                )}
                            </div>

                            {/* 3. Technical Description & Detection Data Sources */}
                            <div>
                                <div
                                    style={{
                                        fontSize: '0.74rem',
                                        fontWeight: 800,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px',
                                        color: 'var(--text-muted)',
                                        marginBottom: '6px'
                                    }}
                                >
                                    MITRE Technical Description & Telemetry Sources
                                </div>
                                <p
                                    style={{
                                        margin: '0 0 10px 0',
                                        fontSize: '0.78rem',
                                        color: 'var(--text-secondary)',
                                        lineHeight: 1.55
                                    }}
                                >
                                    {drawerTechnique.description}
                                </p>
                                {drawerTechnique.dataSources?.length > 0 && (
                                    <div
                                        style={{
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            gap: '5px'
                                        }}
                                    >
                                        {drawerTechnique.dataSources.map((ds) => (
                                            <span
                                                key={ds}
                                                style={{
                                                    fontSize: '0.68rem',
                                                    padding: '2px 7px',
                                                    borderRadius: '4px',
                                                    background: 'rgba(6, 182, 212, 0.1)',
                                                    color: '#22d3ee',
                                                    border: '1px solid rgba(6, 182, 212, 0.25)'
                                                }}
                                            >
                                                {ds}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
        </div>
    );
}
