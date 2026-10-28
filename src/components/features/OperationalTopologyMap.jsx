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

import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
    Target,
    Shield,
    UserCheck,
    Radio,
    Maximize2,
    Minimize2,
    Crosshair,
    Terminal,
    Plus,
    Wrench,
    X,
    ArrowRight,
    Edit3,
    Cpu,
    Server,
    Layers
} from 'lucide-react';
import { classifyTtpOperationalRole } from '../../lib/mitreStixCti';

const PRESET_TOOLS = [
    'PowerShell',
    'CMD / WMIC',
    'Certutil',
    'Rundll32 / Regsvr32',
    'Impacket',
    'Rubeus',
    'Mimikatz',
    'Cobalt Strike',
    'Sliver C2',
    'Mythic',
    'BloodHound / SharpHound',
    'WinRM / PsExec'
];

/**
 * Parses Threat Infrastructure entries into C2 / Redirector nodes.
 */
function parseThreatInfraNodes(raw = '') {
    const trimmed = (raw || '').trim();
    if (!trimmed) return { nodes: [], isHopChain: false };

    const isHopChain = /->|➔|>/.test(trimmed);
    const delimiter = isHopChain ? /(?:->|➔|>)+/ : /[,;\n]+/;

    const nodes = trimmed
        .split(delimiter)
        .map(s => s.trim())
        .filter(Boolean)
        .map((entry, idx, arr) => {
            const parenMatch = entry.match(/\(([^)]+)\)/);
            const cleanEntry = entry.replace(/\([^)]*\)/g, '').trim();
            const portMatch = cleanEntry.match(/:(\d{2,5})\b/);
            const isIp = /^(?:\d{1,3}\.){3}\d{1,3}/.test(cleanEntry);
            const proto = parenMatch
                ? parenMatch[1].toUpperCase()
                : portMatch
                ? `PORT ${portMatch[1]}`
                : isIp
                ? 'IPV4'
                : 'DOMAIN';

            let badge = 'C2 NODE';
            if (isHopChain && arr.length > 1) {
                badge = idx === 0 ? 'TEAMSERVER' : `REDIRECTOR #${idx}`;
            } else if (isIp) {
                badge = idx === 0 ? 'C2 SERVER' : 'SOURCE IP';
            } else if (cleanEntry.includes('.')) {
                badge = 'REDIRECTOR';
            }

            return {
                id: `c2-${idx}`,
                index: idx,
                raw: entry,
                label: cleanEntry || entry,
                proto,
                badge
            };
        });

    return { nodes, isHopChain };
}

/**
 * Serializes node strings back into the blueprint string.
 */
function serializeNodes(rawStrings = [], isChain = false) {
    const cleaned = rawStrings.map(s => s.trim()).filter(Boolean);
    return cleaned.join(isChain ? ' -> ' : ', ');
}

/**
 * Parses Target Asset entries into Host nodes.
 */
function parseTargetAssetNodes(raw = '') {
    const trimmed = (raw || '').trim();
    if (!trimmed) return { nodes: [], isPivotChain: false };

    const isPivotChain = /->|➔|>/.test(trimmed);
    const delimiter = isPivotChain ? /(?:->|➔|>)+/ : /[,;\n]+/;

    const nodes = trimmed
        .split(delimiter)
        .map(s => s.trim())
        .filter(Boolean)
        .map((entry, idx, arr) => {
            const parenMatch = entry.match(/\(([^)]+)\)/);
            const primary = entry.replace(/\([^)]*\)/g, '').trim();
            const sub = parenMatch ? parenMatch[1].trim() : '';

            let hostType = 'ENDPOINT';
            if (/\bdc\d*|\bad\b|domain/i.test(primary)) hostType = 'DOMAIN CTRL';
            else if (/\bsrv|\bsql|\bdb|\bapp|\bweb|\bfileshare|\bsmb/i.test(primary)) hostType = 'SERVER';
            else if (/\baws|\baz|\bgcp|\bcloud|\bk8s|\btenant/i.test(primary)) hostType = 'CLOUD ASSET';
            else if (/\bwkstn|\bwin|\blap|\bdesk/i.test(primary)) hostType = 'WORKSTATION';

            let hopBadge = hostType;
            if (isPivotChain && arr.length > 1) {
                if (idx === 0) hopBadge = `HOP 1 • FOOTHOLD`;
                else if (idx === arr.length - 1) hopBadge = `HOP ${idx + 1} • OBJECTIVE`;
                else hopBadge = `HOP ${idx + 1} • PIVOT`;
            }

            return {
                id: `target-${idx}`,
                index: idx,
                raw: entry,
                label: primary || entry,
                sub,
                hostType,
                hopBadge
            };
        });

    return { nodes, isPivotChain };
}

/**
 * Infers default execution conduits from selected TTPs when the user hasn't clicked explicit tool chips yet.
 */
function inferConduitsFromTTPs(selectedTTPs = []) {
    const inferred = [];
    (selectedTTPs || []).forEach(t => {
        const id = (typeof t === 'string' ? t : t?.id || '').toUpperCase();
        if (id === 'T1059.001') inferred.push('PowerShell');
        else if (id === 'T1059.003') inferred.push('cmd.exe');
        else if (id === 'T1059.004') inferred.push('bash / sh');
        else if (id === 'T1047') inferred.push('WMI / wmic');
        else if (id === 'T1106') inferred.push('Win32 Native API');
        else if (id.startsWith('T1218')) inferred.push('LOLBin Proxy');
    });
    return [...new Set(inferred)];
}

/**
 * Computes role breakdown pills for a given list of TTP objects.
 */
function computeRolePillsForTtps(ttps = []) {
    const counts = { CONDUIT: 0, PRECURSOR: 0, MODIFIER: 0, ANCHOR: 0 };
    (ttps || []).forEach(t => {
        const roleObj = classifyTtpOperationalRole(t);
        const key = roleObj?.role || 'ANCHOR';
        counts[key] = (counts[key] || 0) + 1;
    });
    const pills = [];
    if (counts.CONDUIT > 0) pills.push({ label: `${counts.CONDUIT} Conduit${counts.CONDUIT > 1 ? 's' : ''}`, color: '#38bdf8' });
    if (counts.PRECURSOR > 0) pills.push({ label: `${counts.PRECURSOR} Recon`, color: '#a78bfa' });
    if (counts.MODIFIER > 0) pills.push({ label: `${counts.MODIFIER} Evasion`, color: '#f472b6' });
    if (counts.ANCHOR > 0) pills.push({ label: `${counts.ANCHOR} Objective${counts.ANCHOR > 1 ? 's' : ''}`, color: '#fbbf24' });
    return pills;
}

const CONSTRUCTOR_MICRO_ANIMATIONS_CSS = `
@keyframes cdNodeMaterialize {
    0% {
        opacity: 0;
        transform: translateY(8px) scale(0.965);
        filter: brightness(1.35);
    }
    100% {
        opacity: 1;
        transform: translateY(0) scale(1);
        filter: brightness(1);
    }
}

@keyframes cdDrawerUnfurl {
    0% {
        opacity: 0;
        transform: translateY(-6px);
    }
    100% {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes cdChipPop {
    0% {
        opacity: 0;
        transform: scale(0.82);
    }
    70% {
        transform: scale(1.04);
    }
    100% {
        opacity: 1;
        transform: scale(1);
    }
}

@keyframes cdSocketSonar {
    0% {
        transform: translate(-50%, -50%) scale(1);
        opacity: 0.75;
    }
    100% {
        transform: translate(-50%, -50%) scale(2.45);
        opacity: 0;
    }
}

@keyframes cdStatusPulse {
    0%, 100% {
        transform: scale(1);
        opacity: 1;
    }
    50% {
        transform: scale(1.28);
        opacity: 0.65;
    }
}

@keyframes cdScanlineSweep {
    0% {
        transform: translateY(-100%);
    }
    100% {
        transform: translateY(500%);
    }
}

@keyframes cdActiveBorderPulse {
    0%, 100% {
        box-shadow: 0 8px 22px rgba(0, 0, 0, 0.55), 0 0 0 1px var(--module-accent, #a855f7), 0 0 16px var(--module-glow, rgba(168, 85, 247, 0.35));
    }
    50% {
        box-shadow: 0 8px 26px rgba(0, 0, 0, 0.65), 0 0 0 1.5px var(--module-accent, #a855f7), 0 0 24px var(--module-glow, rgba(168, 85, 247, 0.55));
    }
}

.cd-constructor-module {
    animation: cdNodeMaterialize 0.36s cubic-bezier(0.16, 1, 0.3, 1) backwards;
    transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1),
                box-shadow 0.24s cubic-bezier(0.16, 1, 0.3, 1),
                border-color 0.22s ease,
                background 0.22s ease;
    will-change: transform, box-shadow;
}

.cd-constructor-module:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 26px rgba(0, 0, 0, 0.6), 0 0 18px var(--module-glow, rgba(168, 85, 247, 0.25)) !important;
}

.cd-constructor-module.cd-module-editing {
    animation: cdActiveBorderPulse 2s ease-in-out infinite;
}

.cd-dock-btn {
    transition: transform 0.16s cubic-bezier(0.16, 1, 0.3, 1),
                box-shadow 0.18s ease,
                background 0.18s ease,
                border-color 0.18s ease,
                filter 0.18s ease;
}

.cd-dock-btn:hover {
    transform: translateY(-1px);
    filter: brightness(1.16);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
}

.cd-dock-btn:active {
    transform: translateY(0) scale(0.96);
}

.cd-slot-interactive {
    transition: background 0.18s ease, border-color 0.18s ease, transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.18s ease;
}

.cd-slot-interactive:hover {
    background: rgba(255, 255, 255, 0.065) !important;
    border-color: rgba(255, 255, 255, 0.2) !important;
    transform: translateX(1.5px);
}

.cd-chip-anim {
    animation: cdChipPop 0.26s cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
    transition: transform 0.15s cubic-bezier(0.16, 1, 0.3, 1), filter 0.15s ease, box-shadow 0.15s ease;
}

.cd-chip-anim:hover {
    transform: translateY(-1px) scale(1.03);
    filter: brightness(1.15);
}

.cd-drawer-panel {
    animation: cdDrawerUnfurl 0.24s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes cdPopoutEnter {
    0% {
        opacity: 0;
        transform: scale(0.95) translateY(10px);
    }
    100% {
        opacity: 1;
        transform: scale(1) translateY(0);
    }
}

.cd-popout-window {
    animation: cdPopoutEnter 0.26s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
`;

/**
 * Dedicated SVG Wire Alley between two node columns.
 * Because this SVG sits strictly in the gap column between Left Column and Right Column,
 * x=0 is guaranteed to be the exact right socket of the left nodes and x=100 is the exact left socket of the right nodes.
 * Wires can NEVER cross over node cards or text!
 */
function WireAlley({
    leftCount = 1,
    rightCount = 1,
    startColor = '#34d399',
    endColor = '#f59e0b',
    idPrefix = 'alley',
    activeLeftIndex = null,
    activeRightIndex = null,
    inModal = false
}) {
    const svgW = 100;
    const svgH = 260;

    const getYPositions = (count) =>
        Array.from({ length: Math.max(count, 1) }, (_, i) => ((i + 0.5) / Math.max(count, 1)) * svgH);

    const y1List = getYPositions(leftCount);
    const y2List = getYPositions(rightCount);
    const gradId = `wireGrad-${idPrefix}`;
    const glowId = `wireGlow-${idPrefix}`;
    const hasAnyHover = activeLeftIndex !== null || activeRightIndex !== null;

    return (
        <div
            style={{
                width: inModal ? '120px' : '44px',
                minWidth: inModal ? '90px' : '36px',
                alignSelf: 'stretch',
                position: 'relative',
                pointerEvents: 'none',
                flexShrink: 0
            }}
        >
            <svg
                viewBox={`0 0 ${svgW} ${svgH}`}
                preserveAspectRatio="none"
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'block',
                    overflow: 'visible'
                }}
            >
                <defs>
                    <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor={startColor} stopOpacity="0.95" />
                        <stop offset="100%" stopColor={endColor} stopOpacity="0.95" />
                    </linearGradient>
                    <filter id={glowId} x="-35%" y="-35%" width="170%" height="170%">
                        <feGaussianBlur stdDeviation="2.5" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {y1List.map((y1, i) =>
                    y2List.map((y2, j) => {
                        const pathD = `M 0 ${y1} C 50 ${y1}, 50 ${y2}, 100 ${y2}`;
                        const isPathHighlighted =
                            (activeLeftIndex !== null && activeLeftIndex === i) ||
                            (activeRightIndex !== null && activeRightIndex === j);
                        const pathOpacity = !hasAnyHover ? 1 : isPathHighlighted ? 1 : 0.35;
                        const dashDur = isPathHighlighted
                            ? `${0.65 + (i + j) * 0.08}s`
                            : `${1.4 + (i + j) * 0.2}s`;
                        const pulseDur = isPathHighlighted
                            ? `${0.95 + (i + j) * 0.12}s`
                            : `${1.8 + (i + j) * 0.25}s`;

                        return (
                            <g
                                key={`${idPrefix}-${i}-${j}`}
                                style={{
                                    opacity: pathOpacity,
                                    transition: 'opacity 0.22s ease'
                                }}
                            >
                                {/* Subtle outer energy rail */}
                                <path
                                    d={pathD}
                                    fill="none"
                                    stroke={isPathHighlighted ? endColor : startColor}
                                    strokeOpacity={isPathHighlighted ? '0.32' : '0.14'}
                                    strokeWidth={isPathHighlighted ? '6' : '4'}
                                    style={{ transition: 'stroke-width 0.2s ease, stroke-opacity 0.2s ease' }}
                                />
                                {/* Animated dashed vector */}
                                <path
                                    d={pathD}
                                    fill="none"
                                    stroke={`url(#${gradId})`}
                                    strokeWidth={isPathHighlighted ? '2.5' : '2'}
                                    strokeDasharray="5 5"
                                    filter={`url(#${glowId})`}
                                >
                                    <animate
                                        attributeName="stroke-dashoffset"
                                        from="20"
                                        to="0"
                                        dur={dashDur}
                                        repeatCount="indefinite"
                                    />
                                </path>
                                {/* Primary traveling telemetry pulse */}
                                <circle
                                    r={isPathHighlighted ? '3.8' : '3.1'}
                                    fill={endColor}
                                    filter={`url(#${glowId})`}
                                >
                                    <animateMotion
                                        dur={pulseDur}
                                        repeatCount="indefinite"
                                        path={pathD}
                                    />
                                </circle>
                                {/* Secondary offset data packet on highlighted or active links */}
                                <circle
                                    r={isPathHighlighted ? '2.6' : '1.9'}
                                    fill={isPathHighlighted ? '#ffffff' : startColor}
                                    opacity={isPathHighlighted ? '0.95' : '0.7'}
                                    filter={`url(#${glowId})`}
                                >
                                    <animateMotion
                                        dur={pulseDur}
                                        begin="-0.9s"
                                        repeatCount="indefinite"
                                        path={pathD}
                                    />
                                </circle>
                            </g>
                        );
                    })
                )}
            </svg>
        </div>
    );
}

/**
 * Hardware-style Socket Port dot rendered on the left or right edge of a Constructor Node,
 * complete with a subtle sonar ping micro-animation.
 */
function PortSocket({ side = 'right', color = '#34d399', isActive = false }) {
    return (
        <span
            style={{
                position: 'absolute',
                top: '50%',
                [side]: '-5px',
                transform: 'translateY(-50%)',
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: '#090d16',
                border: `2px solid ${color}`,
                boxShadow: isActive ? `0 0 12px ${color}, 0 0 4px #fff` : `0 0 8px ${color}`,
                zIndex: 5,
                pointerEvents: 'none',
                transition: 'box-shadow 0.2s ease, transform 0.2s ease'
            }}
        >
            {/* Outer Sonar Ping Ring */}
            <span
                style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    border: `1.5px solid ${color}`,
                    animation: `cdSocketSonar ${isActive ? '1.2s' : '2.4s'} cubic-bezier(0, 0, 0.2, 1) infinite`,
                    pointerEvents: 'none'
                }}
            />
        </span>
    );
}

export default function OperationalTopologyMap({
    blueprint = {},
    updateBlueprint,
    environmentLabels = [],
    selectedTTPs = [],
    selectedTTPsCount = 0,
    compact = false
}) {
    const isEditable = typeof updateBlueprint === 'function';
    const [isExpandedModal, setIsExpandedModal] = useState(false);

    // Inline editor state: { type: 'c2' | 'target' | 'identity' | 'staging' | 'tooling' | 'hostTtps', index?: number, hostKey?: string, isNew?: boolean }
    const [activeEditor, setActiveEditor] = useState(null);
    const [draftValue, setDraftValue] = useState('');
    const [customToolInput, setCustomToolInput] = useState('');
    // Hover state for interactive wire & socket acceleration: { tier: 'tier1' | 'tier2' | 'tier3', index: number } | null
    const [hoveredNode, setHoveredNode] = useState(null);
    const inlineInputRef = useRef(null);

    useEffect(() => {
        if (
            activeEditor &&
            activeEditor.type !== 'tooling' &&
            activeEditor.type !== 'hostTtps' &&
            inlineInputRef.current
        ) {
            inlineInputRef.current.focus();
            inlineInputRef.current.select();
        }
    }, [activeEditor]);

    const { nodes: c2Nodes, isHopChain: isC2Chain } = useMemo(
        () => parseThreatInfraNodes(blueprint?.threatInfra),
        [blueprint?.threatInfra]
    );
    const hasC2 = c2Nodes.length > 0 || activeEditor?.type === 'c2';

    const { nodes: parsedTargets, isPivotChain } = useMemo(
        () => parseTargetAssetNodes(blueprint?.targetAssets),
        [blueprint?.targetAssets]
    );

    const targetNodes = useMemo(() => {
        if (parsedTargets.length > 0) return parsedTargets;
        const envName =
            environmentLabels?.length > 0 ? `${environmentLabels.join(' / ')} Enclave` : 'Target Environment';
        return [
            {
                id: 'target-env-default',
                index: 0,
                raw: '',
                label: envName,
                sub: isEditable ? 'Click to set IP / Hostname' : 'Active Scope',
                hostType: 'ENVIRONMENT',
                hopBadge: 'TARGET SCOPE',
                isDefaultEnv: true
            }
        ];
    }, [parsedTargets, environmentLabels, isEditable]);

    const explicitTools = Array.isArray(blueprint?.tooling) ? blueprint.tooling : [];
    const inferredConduits = useMemo(() => inferConduitsFromTTPs(selectedTTPs), [selectedTTPs]);
    const effectiveTools = explicitTools.length > 0 ? explicitTools : inferredConduits;

    const testAccountText = (blueprint?.testAccounts || '').trim();
    const stagingText = (blueprint?.stagingAndDeconfliction || '').trim();
    const hostTtpAssignments = blueprint?.hostTtpAssignments || {};

    /**
     * Resolves which TTPs are active on a given Target Host node.
     * By default (or when no custom subset is assigned to that host), ALL selectedTTPs are bound to the host,
     * so every endpoint immediately reflects changes made in Step 1!
     */
    const getTtpsForTargetNode = (node) => {
        const allScoped = Array.isArray(selectedTTPs) ? selectedTTPs : [];
        if (allScoped.length === 0) return [];
        const assignedIds = hostTtpAssignments[node.raw];
        if (!Array.isArray(assignedIds) || assignedIds.length === 0) {
            return allScoped;
        }
        const filtered = allScoped.filter(t => assignedIds.includes(t.id));
        return filtered.length > 0 ? filtered : allScoped;
    };

    const handleToggleHostTtp = (hostRawKey, ttpId) => {
        if (!isEditable || !hostRawKey) return;
        const allIds = (selectedTTPs || []).map(t => t.id);
        const currentAssigned = Array.isArray(hostTtpAssignments[hostRawKey])
            ? hostTtpAssignments[hostRawKey].filter(id => allIds.includes(id))
            : [...allIds];

        let nextAssigned;
        if (currentAssigned.includes(ttpId)) {
            nextAssigned = currentAssigned.filter(id => id !== ttpId);
        } else {
            nextAssigned = [...currentAssigned, ttpId];
        }

        // If all TTPs are selected (or none left), clear custom override so it tracks all scoped TTPs dynamically
        const nextMap = { ...hostTtpAssignments };
        if (nextAssigned.length === 0 || nextAssigned.length === allIds.length) {
            delete nextMap[hostRawKey];
        } else {
            nextMap[hostRawKey] = nextAssigned;
        }
        updateBlueprint('hostTtpAssignments', nextMap);
    };

    const ttpCount = selectedTTPs?.length || selectedTTPsCount || 0;

    // --- Interactive Node Handlers ---
    const handleStartAddC2 = () => {
        if (!isEditable) return;
        setDraftValue('');
        setActiveEditor({ type: 'c2', index: c2Nodes.length, isNew: true });
    };

    const handleStartEditC2 = (node) => {
        if (!isEditable) return;
        setDraftValue(node.raw);
        setActiveEditor({ type: 'c2', index: node.index, isNew: false });
    };

    const handleRemoveC2 = (idxToRemove, e) => {
        e?.stopPropagation();
        if (!isEditable) return;
        const remaining = c2Nodes.filter((_, i) => i !== idxToRemove).map(n => n.raw);
        updateBlueprint('threatInfra', serializeNodes(remaining, isC2Chain));
        if (activeEditor?.type === 'c2') setActiveEditor(null);
    };

    const handleStartAddTarget = (asPivotHop = false) => {
        if (!isEditable) return;
        setDraftValue('');
        setActiveEditor({ type: 'target', index: parsedTargets.length, isNew: true, asPivotHop });
    };

    const handleStartEditTarget = (node) => {
        if (!isEditable) return;
        setDraftValue(node.isDefaultEnv ? '' : node.raw);
        setActiveEditor({
            type: 'target',
            index: node.index,
            isNew: Boolean(node.isDefaultEnv),
            asPivotHop: isPivotChain
        });
    };

    const handleRemoveTarget = (idxToRemove, e) => {
        e?.stopPropagation();
        if (!isEditable) return;
        const remaining = parsedTargets.filter((_, i) => i !== idxToRemove).map(n => n.raw);
        updateBlueprint('targetAssets', serializeNodes(remaining, isPivotChain));
        if (activeEditor?.type === 'target') setActiveEditor(null);
    };

    const handleStartEditIdentity = (e) => {
        e?.stopPropagation();
        if (!isEditable) return;
        setDraftValue(testAccountText);
        setActiveEditor({ type: 'identity' });
    };

    const handleStartEditStaging = (e) => {
        e?.stopPropagation();
        if (!isEditable) return;
        setDraftValue(stagingText);
        setActiveEditor({ type: 'staging' });
    };

    const commitActiveEditor = () => {
        if (!activeEditor || !isEditable) return;
        const val = draftValue.trim();

        if (activeEditor.type === 'c2') {
            const rawList = c2Nodes.map(n => n.raw);
            if (activeEditor.isNew) {
                if (val) rawList.push(val);
            } else {
                if (val) rawList[activeEditor.index] = val;
                else rawList.splice(activeEditor.index, 1);
            }
            updateBlueprint('threatInfra', serializeNodes(rawList, isC2Chain));
        } else if (activeEditor.type === 'target') {
            const rawList = parsedTargets.map(n => n.raw);
            const useChain = activeEditor.asPivotHop || isPivotChain;
            if (activeEditor.isNew) {
                if (val) rawList.push(val);
            } else {
                if (val) rawList[activeEditor.index] = val;
                else rawList.splice(activeEditor.index, 1);
            }
            updateBlueprint('targetAssets', serializeNodes(rawList, useChain));
        } else if (activeEditor.type === 'identity') {
            updateBlueprint('testAccounts', val);
        } else if (activeEditor.type === 'staging') {
            updateBlueprint('stagingAndDeconfliction', val);
        }

        setActiveEditor(null);
        setDraftValue('');
    };

    const handleTogglePresetTool = (toolName) => {
        if (!isEditable) return;
        const exists = explicitTools.some(t => t.toLowerCase() === toolName.toLowerCase());
        if (exists) {
            updateBlueprint(
                'tooling',
                explicitTools.filter(t => t.toLowerCase() !== toolName.toLowerCase())
            );
        } else {
            updateBlueprint('tooling', [...explicitTools, toolName]);
        }
    };

    const handleAddCustomTool = () => {
        if (!isEditable) return;
        const trimmed = customToolInput.trim();
        if (!trimmed) return;
        const parts = trimmed.split(',').map(s => s.trim()).filter(Boolean);
        const next = [...explicitTools];
        parts.forEach(p => {
            if (!next.some(t => t.toLowerCase() === p.toLowerCase())) {
                next.push(p);
            }
        });
        updateBlueprint('tooling', next);
        setCustomToolInput('');
    };

    const handleRemoveTool = (toolName, e) => {
        e?.stopPropagation();
        if (!isEditable) return;
        updateBlueprint(
            'tooling',
            explicitTools.filter(t => t !== toolName)
        );
    };

    const postureBadge = useMemo(() => {
        if (hasC2 && isPivotChain) {
            return { label: 'EXTERNAL C2 ➔ LATERAL PIVOT', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.14)' };
        }
        if (hasC2) {
            return { label: 'EXTERNAL C2 / REMOTE INGRESS', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.14)' };
        }
        if (isPivotChain) {
            return { label: 'INTERNAL LATERAL PIVOT CHAIN', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.14)' };
        }
        return { label: 'ASSUMED BREACH / HOST-LOCAL', color: '#34d399', bg: 'rgba(16, 185, 129, 0.14)' };
    }, [hasC2, isPivotChain]);

    const inlineInputCss = {
        width: '100%',
        boxSizing: 'border-box',
        background: 'rgba(5, 7, 12, 0.95)',
        border: '1px solid #c084fc',
        borderRadius: '6px',
        padding: '5px 8px',
        color: '#fff',
        fontFamily: 'monospace',
        fontSize: '0.74rem',
        outline: 'none'
    };

    const renderCanvas = (inModal = false) => {
        const displayC2Nodes =
            activeEditor?.type === 'c2' && activeEditor.isNew
                ? [
                      ...c2Nodes,
                      {
                          id: 'c2-new-draft',
                          index: c2Nodes.length,
                          raw: '',
                          label: '',
                          proto: 'NEW',
                          badge: 'NEW C2 NODE',
                          isDraft: true
                      }
                  ]
                : c2Nodes;

        const displayTargetNodes =
            activeEditor?.type === 'target' && activeEditor.isNew && parsedTargets.length > 0
                ? [
                      ...targetNodes,
                      {
                          id: 'target-new-draft',
                          index: parsedTargets.length,
                          raw: '',
                          label: '',
                          sub: '',
                          hostType: 'ENDPOINT',
                          hopBadge: activeEditor.asPivotHop ? `HOP ${parsedTargets.length + 1} • PIVOT` : 'NEW ENDPOINT',
                          isDraft: true
                      }
                  ]
                : targetNodes;

        const maxRows = Math.max(hasC2 ? displayC2Nodes.length : 1, displayTargetNodes.length, 1);
        const canvasHeight = inModal
            ? Math.max(580, maxRows * 135 + 110)
            : compact
            ? Math.max(175, maxRows * 68 + 48)
            : Math.max(225, maxRows * 88 + 56);

        return (
            <div
                style={{
                    position: 'relative',
                    width: '100%',
                    minHeight: `${canvasHeight}px`,
                    borderRadius: inModal ? '14px' : '10px',
                    background:
                        'radial-gradient(circle at 50% 45%, rgba(168, 85, 247, 0.12) 0%, rgba(12, 17, 29, 0.96) 58%, rgba(5, 7, 12, 0.99) 100%)',
                    border: inModal
                        ? '1.5px solid rgba(168, 85, 247, 0.55)'
                        : '1px solid rgba(168, 85, 247, 0.3)',
                    boxShadow: inModal
                        ? 'inset 0 0 60px rgba(0, 0, 0, 0.85), 0 28px 80px rgba(0, 0, 0, 0.88), 0 0 40px rgba(168, 85, 247, 0.22)'
                        : 'inset 0 0 40px rgba(0, 0, 0, 0.8), 0 8px 24px rgba(0, 0, 0, 0.4)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    userSelect: 'none'
                }}
            >
                <style>{CONSTRUCTOR_MICRO_ANIMATIONS_CSS}</style>

                {/* Blueprint Constructor Dot-Matrix & Grid Overlay */}
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundImage:
                            'radial-gradient(rgba(148, 163, 184, 0.12) 1px, transparent 1px), linear-gradient(rgba(148, 163, 184, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.03) 1px, transparent 1px)',
                        backgroundSize: '20px 20px, 80px 80px, 80px 80px',
                        pointerEvents: 'none'
                    }}
                />

                {/* Subtle Tactical Telemetry Scanline Sweep */}
                <div
                    style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: 0,
                        height: '22%',
                        background:
                            'linear-gradient(180deg, transparent 0%, rgba(168, 85, 247, 0.045) 50%, rgba(56, 189, 248, 0.07) 96%, transparent 100%)',
                        animation: 'cdScanlineSweep 7.5s linear infinite',
                        pointerEvents: 'none',
                        zIndex: 1
                    }}
                />

                {/* Top Constructor Palette Bar */}
                <div
                    style={{
                        position: 'relative',
                        zIndex: 4,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '6px',
                        padding: '8px 12px',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                        background: 'rgba(6, 9, 16, 0.88)',
                        fontSize: '0.64rem',
                        letterSpacing: '0.5px',
                        textTransform: 'uppercase',
                        fontWeight: 700
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span
                            style={{
                                padding: '3px 8px',
                                borderRadius: '5px',
                                background: postureBadge.bg,
                                border: `1px solid ${postureBadge.color}55`,
                                color: postureBadge.color,
                                fontSize: '0.6rem',
                                fontWeight: 800,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                transition: 'all 0.25s ease'
                            }}
                        >
                            <span
                                style={{
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    background: postureBadge.color,
                                    boxShadow: `0 0 6px ${postureBadge.color}`,
                                    animation: 'cdStatusPulse 2.2s ease-in-out infinite'
                                }}
                            />
                            {postureBadge.label}
                        </span>

                        {isEditable && (
                            <>
                                <button
                                    type="button"
                                    className="cd-dock-btn"
                                    onClick={handleStartAddC2}
                                    title="Spawn an external C2 Server, Redirector, or Source IP module"
                                    style={{
                                        background: 'rgba(14, 165, 233, 0.12)',
                                        border: '1px solid rgba(56, 189, 248, 0.4)',
                                        color: '#7dd3fc',
                                        borderRadius: '5px',
                                        padding: '3px 8px',
                                        fontSize: '0.61rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}
                                >
                                    <Plus size={10} /> C2 Node
                                </button>

                                <button
                                    type="button"
                                    className="cd-dock-btn"
                                    onClick={() =>
                                        setActiveEditor(prev =>
                                            prev?.type === 'tooling' ? null : { type: 'tooling' }
                                        )
                                    }
                                    title="Configure Offensive Tooling & Frameworks"
                                    style={{
                                        background:
                                            activeEditor?.type === 'tooling'
                                                ? 'rgba(168, 85, 247, 0.32)'
                                                : 'rgba(168, 85, 247, 0.12)',
                                        border: '1px solid rgba(192, 132, 252, 0.45)',
                                        color: '#e9d5ff',
                                        borderRadius: '5px',
                                        padding: '3px 8px',
                                        fontSize: '0.61rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}
                                >
                                    <Wrench size={10} /> Arsenal ({explicitTools.length})
                                </button>

                                <button
                                    type="button"
                                    className="cd-dock-btn"
                                    onClick={() =>
                                        parsedTargets.length === 0
                                            ? handleStartEditTarget(targetNodes[0])
                                            : handleStartAddTarget(false)
                                    }
                                    title="Spawn a Target Endpoint module"
                                    style={{
                                        background: 'rgba(245, 158, 11, 0.12)',
                                        border: '1px solid rgba(245, 158, 11, 0.45)',
                                        color: '#fcd34d',
                                        borderRadius: '5px',
                                        padding: '3px 8px',
                                        fontSize: '0.61rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}
                                >
                                    <Plus size={10} /> Endpoint
                                </button>

                                {parsedTargets.length >= 1 && (
                                    <button
                                        type="button"
                                        className="cd-dock-btn"
                                        onClick={() => handleStartAddTarget(true)}
                                        title="Add a Lateral Movement Pivot Hop (Host A -> Host B)"
                                        style={{
                                            background: 'rgba(245, 158, 11, 0.18)',
                                            border: '1px solid rgba(251, 191, 36, 0.5)',
                                            color: '#fde68a',
                                            borderRadius: '5px',
                                            padding: '3px 8px',
                                            fontSize: '0.61rem',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}
                                    >
                                        <ArrowRight size={10} /> Pivot Hop
                                    </button>
                                )}
                            </>
                        )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                            type="button"
                            className="cd-dock-btn"
                            onClick={() => setIsExpandedModal(!inModal)}
                            title={inModal ? 'Close Fullscreen Constructor' : 'Expand Constructor'}
                            style={{
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.12)',
                                color: 'var(--text-muted)',
                                borderRadius: '4px',
                                padding: '3px 6px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.62rem'
                            }}
                        >
                            {inModal ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
                        </button>
                    </div>
                </div>

                {/* Inline Arsenal / Tooling Drawer */}
                {isEditable && activeEditor?.type === 'tooling' && (
                    <div
                        className="cd-drawer-panel"
                        style={{
                            position: 'relative',
                            zIndex: 6,
                            padding: '12px 14px',
                            background: 'rgba(11, 15, 25, 0.98)',
                            borderBottom: '1px solid rgba(168, 85, 247, 0.4)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#e9d5ff', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <Wrench size={12} color="#c084fc" /> Bind Offensive Tooling &amp; C2 Frameworks
                            </span>
                            <button
                                type="button"
                                className="cd-dock-btn"
                                onClick={() => setActiveEditor(null)}
                                style={{
                                    background: 'rgba(168, 85, 247, 0.25)',
                                    border: '1px solid rgba(168, 85, 247, 0.5)',
                                    color: '#f3e8ff',
                                    borderRadius: '4px',
                                    padding: '2px 8px',
                                    fontSize: '0.65rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >
                                Done
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                            {PRESET_TOOLS.map(preset => {
                                const isSelected = explicitTools.some(
                                    t => t.toLowerCase() === preset.toLowerCase()
                                );
                                return (
                                    <button
                                        key={preset}
                                        type="button"
                                        className="cd-dock-btn"
                                        onClick={() => handleTogglePresetTool(preset)}
                                        style={{
                                            padding: '3px 8px',
                                            borderRadius: '5px',
                                            fontSize: '0.68rem',
                                            fontWeight: isSelected ? 700 : 500,
                                            cursor: 'pointer',
                                            background: isSelected
                                                ? 'rgba(16, 185, 129, 0.18)'
                                                : 'rgba(255, 255, 255, 0.04)',
                                            border: isSelected
                                                ? '1px solid rgba(16, 185, 129, 0.5)'
                                                : '1px solid rgba(255, 255, 255, 0.1)',
                                            color: isSelected ? '#6ee7b7' : 'var(--text-muted)'
                                        }}
                                    >
                                        {isSelected ? `✓ ${preset}` : `+ ${preset}`}
                                    </button>
                                );
                            })}
                        </div>

                        <div style={{ display: 'flex', gap: '6px' }}>
                            <input
                                type="text"
                                value={customToolInput}
                                onChange={e => setCustomToolInput(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddCustomTool();
                                    }
                                }}
                                placeholder="Add custom binary, script, or framework (e.g. Havoc, SharpDPAPI) + Enter..."
                                style={{ ...inlineInputCss, flex: 1 }}
                            />
                            <button
                                type="button"
                                className="cd-dock-btn"
                                onClick={handleAddCustomTool}
                                style={{
                                    padding: '0 12px',
                                    borderRadius: '5px',
                                    background: 'rgba(168, 85, 247, 0.25)',
                                    border: '1px solid rgba(168, 85, 247, 0.5)',
                                    color: '#f3e8ff',
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >
                                + Bind
                            </button>
                        </div>
                    </div>
                )}

                {/* Per-Endpoint TTP Binder Drawer (when user clicks the TTP slot on a specific Endpoint) */}
                {isEditable && activeEditor?.type === 'hostTtps' && activeEditor.hostKey && (
                    <div
                        className="cd-drawer-panel"
                        style={{
                            position: 'relative',
                            zIndex: 6,
                            padding: '10px 14px',
                            background: 'rgba(11, 15, 25, 0.98)',
                            borderBottom: '1px solid rgba(245, 158, 11, 0.4)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#fde68a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Crosshair size={12} color="#fbbf24" /> Bind Scoped TTPs to Endpoint: <code>{activeEditor.hostKey}</code>
                            </span>
                            <button
                                type="button"
                                className="cd-dock-btn"
                                onClick={() => setActiveEditor(null)}
                                style={{
                                    background: 'rgba(245, 158, 11, 0.2)',
                                    border: '1px solid rgba(245, 158, 11, 0.45)',
                                    color: '#fde68a',
                                    borderRadius: '4px',
                                    padding: '2px 8px',
                                    fontSize: '0.65rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >
                                Done
                            </button>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                            {(selectedTTPs || []).map(ttp => {
                                const assignedList = hostTtpAssignments[activeEditor.hostKey];
                                const isBound = !Array.isArray(assignedList) || assignedList.includes(ttp.id);
                                const roleInfo = classifyTtpOperationalRole(ttp);
                                return (
                                    <button
                                        key={ttp.id}
                                        type="button"
                                        className="cd-dock-btn"
                                        onClick={() => handleToggleHostTtp(activeEditor.hostKey, ttp.id)}
                                        style={{
                                            padding: '3px 8px',
                                            borderRadius: '5px',
                                            fontSize: '0.67rem',
                                            fontFamily: 'monospace',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            background: isBound ? 'rgba(245, 158, 11, 0.18)' : 'rgba(255,255,255,0.03)',
                                            border: isBound ? `1px solid ${roleInfo.color}` : '1px solid rgba(255,255,255,0.08)',
                                            color: isBound ? '#fff' : 'var(--text-muted)',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '5px'
                                        }}
                                    >
                                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isBound ? roleInfo.color : '#475569' }} />
                                        {isBound ? `✓ ${ttp.id}` : ttp.id}
                                        <span style={{ fontFamily: 'sans-serif', fontWeight: 500, fontSize: '0.63rem', opacity: 0.85 }}>
                                            {ttp.name}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Main Constructor Canvas: Flex Row with Dedicated Wire Alleys so wires NEVER cross over cards */}
                <div
                    style={{
                        position: 'relative',
                        zIndex: 2,
                        flex: 1,
                        display: 'flex',
                        alignItems: 'stretch',
                        padding: inModal ? '22px 26px' : '16px 16px'
                    }}
                >
                    {/* TIER 1: Either C2 Nodes (if hasC2) OR Operator Foothold Module (if no C2) */}
                    <div
                        style={{
                            flex: hasC2 ? '1.05' : '1',
                            minWidth: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-around',
                            gap: '12px'
                        }}
                    >
                        {hasC2 ? (
                            displayC2Nodes.map((node, c2Idx) => {
                                const isEditingThis =
                                    activeEditor?.type === 'c2' && activeEditor.index === node.index;
                                const isHoveredThis =
                                    hoveredNode?.tier === 'tier1' && hoveredNode.index === c2Idx;
                                return (
                                    <div
                                        key={node.id}
                                        className={`cd-constructor-module${isEditingThis ? ' cd-module-editing' : ''}`}
                                        onMouseEnter={() => setHoveredNode({ tier: 'tier1', index: c2Idx })}
                                        onMouseLeave={() => setHoveredNode(null)}
                                        onClick={() => !isEditingThis && handleStartEditC2(node)}
                                        title={isEditable ? 'Click to edit C2 IP / Domain / Listener' : node.label}
                                        style={{
                                            '--module-accent': '#38bdf8',
                                            '--module-glow': 'rgba(56, 189, 248, 0.32)',
                                            animationDelay: `${c2Idx * 0.06}s`,
                                            position: 'relative',
                                            borderRadius: '8px',
                                            background: 'linear-gradient(180deg, rgba(14, 25, 45, 0.96) 0%, rgba(8, 13, 24, 0.98) 100%)',
                                            border: isEditingThis
                                                ? '1px solid #38bdf8'
                                                : '1px solid rgba(56, 189, 248, 0.45)',
                                            borderTop: '2px solid #38bdf8',
                                            boxShadow: '0 6px 18px rgba(0, 0, 0, 0.45)',
                                            cursor: isEditable ? 'pointer' : 'default',
                                            display: 'flex',
                                            flexDirection: 'column'
                                        }}
                                    >
                                        <PortSocket side="right" color="#38bdf8" isActive={isHoveredThis || isEditingThis} />

                                        {/* Module Header */}
                                        <div
                                            style={{
                                                padding: '5px 10px',
                                                background: 'rgba(56, 189, 248, 0.1)',
                                                borderBottom: '1px solid rgba(56, 189, 248, 0.2)',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}
                                        >
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.58rem', fontWeight: 800, color: '#38bdf8', letterSpacing: '0.6px' }}>
                                                <Radio size={10} /> {node.badge}
                                            </span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                <span style={{ fontSize: '0.55rem', padding: '1px 5px', borderRadius: '3px', background: 'rgba(56, 189, 248, 0.16)', color: '#bae6fd', fontFamily: 'monospace', fontWeight: 700 }}>
                                                    {node.proto}
                                                </span>
                                                {isEditable && !node.isDraft && (
                                                    <button
                                                        type="button"
                                                        onClick={e => handleRemoveC2(node.index, e)}
                                                        title="Delete C2 module"
                                                        style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0, display: 'flex' }}
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Module Body */}
                                        <div style={{ padding: '8px 10px' }}>
                                            {isEditingThis ? (
                                                <div onClick={e => e.stopPropagation()}>
                                                    <input
                                                        ref={inlineInputRef}
                                                        type="text"
                                                        value={draftValue}
                                                        onChange={e => setDraftValue(e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') commitActiveEditor();
                                                            else if (e.key === 'Escape') setActiveEditor(null);
                                                        }}
                                                        onBlur={commitActiveEditor}
                                                        placeholder="10.50.4.22 or cdn.lab.local:443"
                                                        style={inlineInputCss}
                                                    />
                                                </div>
                                            ) : (
                                                <div style={{ fontFamily: 'monospace', fontSize: inModal ? '0.84rem' : '0.76rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.label}</span>
                                                    {isEditable && <Edit3 size={11} color="rgba(56, 189, 248, 0.6)" style={{ flexShrink: 0 }} />}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            /* Operator / Execution Foothold Constructor Module */
                            <div
                                className="cd-constructor-module"
                                onMouseEnter={() => setHoveredNode({ tier: 'tier1', index: 0 })}
                                onMouseLeave={() => setHoveredNode(null)}
                                style={{
                                    '--module-accent': '#10b981',
                                    '--module-glow': 'rgba(52, 211, 153, 0.3)',
                                    position: 'relative',
                                    borderRadius: '9px',
                                    background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.96) 0%, rgba(9, 13, 22, 0.99) 100%)',
                                    border: '1px solid rgba(52, 211, 153, 0.45)',
                                    borderTop: '2px solid #10b981',
                                    boxShadow: '0 8px 20px rgba(0, 0, 0, 0.5)',
                                    display: 'flex',
                                    flexDirection: 'column'
                                }}
                            >
                                <PortSocket side="right" color="#34d399" isActive={hoveredNode?.tier === 'tier1'} />

                                {/* Module Header */}
                                <div
                                    style={{
                                        padding: '6px 11px',
                                        background: 'rgba(16, 185, 129, 0.1)',
                                        borderBottom: '1px solid rgba(52, 211, 153, 0.2)',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}
                                >
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.6rem', fontWeight: 800, color: '#6ee7b7', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                                        <Terminal size={11} /> Foothold Module
                                    </span>
                                    <span style={{ fontSize: '0.54rem', padding: '1px 5px', borderRadius: '3px', background: 'rgba(16, 185, 129, 0.16)', color: '#a7f3d0', fontWeight: 700, fontFamily: 'monospace' }}>
                                        ORIGIN
                                    </span>
                                </div>

                                {/* Module Body Slots */}
                                <div style={{ padding: '9px 11px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                                    {/* Slot 1: Identity */}
                                    <div>
                                        <div style={{ fontSize: '0.54rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px' }}>
                                            Identity Context
                                        </div>
                                        {activeEditor?.type === 'identity' ? (
                                            <div onClick={e => e.stopPropagation()}>
                                                <input
                                                    ref={inlineInputRef}
                                                    type="text"
                                                    value={draftValue}
                                                    onChange={e => setDraftValue(e.target.value)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') commitActiveEditor();
                                                        else if (e.key === 'Escape') setActiveEditor(null);
                                                    }}
                                                    onBlur={commitActiveEditor}
                                                    placeholder="CORP\svc_backup [Local Admin]"
                                                    style={inlineInputCss}
                                                />
                                            </div>
                                        ) : (
                                            <div
                                                className="cd-slot-interactive"
                                                onClick={handleStartEditIdentity}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    gap: '5px',
                                                    padding: '4px 7px',
                                                    borderRadius: '5px',
                                                    background: 'rgba(255, 255, 255, 0.03)',
                                                    border: '1px solid rgba(255, 255, 255, 0.07)',
                                                    cursor: isEditable ? 'pointer' : 'default',
                                                    fontFamily: 'monospace',
                                                    fontSize: '0.7rem',
                                                    color: testAccountText ? '#f8fafc' : 'var(--text-muted)'
                                                }}
                                            >
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    <UserCheck size={11} color="#34d399" style={{ flexShrink: 0 }} />
                                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {testAccountText || (isEditable ? '+ Bind Test Account' : 'Default Context')}
                                                    </span>
                                                </span>
                                                {isEditable && testAccountText && (
                                                    <X
                                                        size={11}
                                                        onClick={e => {
                                                            e.stopPropagation();
                                                            updateBlueprint('testAccounts', '');
                                                        }}
                                                        style={{ color: '#94a3b8', cursor: 'pointer', flexShrink: 0 }}
                                                    />
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Slot 2: Arsenal / Tooling */}
                                    <div>
                                        <div style={{ fontSize: '0.54rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px' }}>
                                            Bound Arsenal
                                        </div>
                                        <div
                                            onClick={() => isEditable && setActiveEditor({ type: 'tooling' })}
                                            style={{
                                                display: 'flex',
                                                flexWrap: 'wrap',
                                                gap: '4px',
                                                cursor: isEditable ? 'pointer' : 'default'
                                            }}
                                        >
                                            {effectiveTools.map(t => {
                                                const isExplicit = explicitTools.includes(t);
                                                return (
                                                    <span
                                                        key={t}
                                                        className="cd-chip-anim"
                                                        style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                            fontSize: '0.62rem',
                                                            fontWeight: 700,
                                                            padding: '2px 6px',
                                                            borderRadius: '4px',
                                                            background: 'rgba(168, 85, 247, 0.22)',
                                                            border: '1px solid rgba(192, 132, 252, 0.45)',
                                                            color: '#f3e8ff'
                                                        }}
                                                    >
                                                        {t}
                                                        {isEditable && isExplicit && (
                                                            <X
                                                                size={10}
                                                                onClick={e => handleRemoveTool(t, e)}
                                                                style={{ cursor: 'pointer' }}
                                                            />
                                                        )}
                                                    </span>
                                                );
                                            })}
                                            {isEditable && (
                                                <span
                                                    className="cd-chip-anim"
                                                    style={{
                                                        fontSize: '0.6rem',
                                                        fontWeight: 700,
                                                        padding: '2px 6px',
                                                        borderRadius: '4px',
                                                        background: 'rgba(168, 85, 247, 0.1)',
                                                        border: '1px dashed rgba(192, 132, 252, 0.4)',
                                                        color: '#d8b4fe'
                                                    }}
                                                >
                                                    + Tool
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Slot 3: Staging / Guardrail */}
                                    {(stagingText || isEditable) && (
                                        <div>
                                            {activeEditor?.type === 'staging' ? (
                                                <div onClick={e => e.stopPropagation()}>
                                                    <input
                                                        ref={inlineInputRef}
                                                        type="text"
                                                        value={draftValue}
                                                        onChange={e => setDraftValue(e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') commitActiveEditor();
                                                            else if (e.key === 'Escape') setActiveEditor(null);
                                                        }}
                                                        onBlur={commitActiveEditor}
                                                        placeholder="C:\ProgramData\USOShared\, X-PurpleSim"
                                                        style={inlineInputCss}
                                                    />
                                                </div>
                                            ) : (
                                                <div
                                                    className="cd-slot-interactive"
                                                    onClick={handleStartEditStaging}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        gap: '4px',
                                                        padding: '3px 7px',
                                                        borderRadius: '5px',
                                                        background: 'rgba(244, 63, 94, 0.08)',
                                                        border: '1px dashed rgba(244, 63, 94, 0.35)',
                                                        color: stagingText ? '#fda4af' : 'var(--text-muted)',
                                                        fontSize: '0.62rem',
                                                        fontFamily: 'monospace',
                                                        cursor: isEditable ? 'pointer' : 'default'
                                                    }}
                                                >
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        <Shield size={10} color="#fb7185" style={{ flexShrink: 0 }} />
                                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {stagingText || '+ Bind Staging Path / Guardrail'}
                                                        </span>
                                                    </span>
                                                    {isEditable && stagingText && (
                                                        <X
                                                            size={10}
                                                            onClick={e => {
                                                                e.stopPropagation();
                                                                updateBlueprint('stagingAndDeconfliction', '');
                                                            }}
                                                            style={{ color: '#94a3b8', cursor: 'pointer', flexShrink: 0 }}
                                                        />
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* WIRE ALLEY 1 */}
                    <WireAlley
                        leftCount={hasC2 ? displayC2Nodes.length : 1}
                        rightCount={hasC2 ? 1 : displayTargetNodes.length}
                        startColor={hasC2 ? '#38bdf8' : '#34d399'}
                        endColor={hasC2 ? '#c084fc' : '#f59e0b'}
                        idPrefix="alley-1"
                        inModal={inModal}
                        activeLeftIndex={hoveredNode?.tier === 'tier1' ? hoveredNode.index : null}
                        activeRightIndex={
                            hasC2
                                ? hoveredNode?.tier === 'tier2'
                                    ? 0
                                    : null
                                : hoveredNode?.tier === 'tier3'
                                ? hoveredNode.index
                                : null
                        }
                    />

                    {/* TIER 2 (Only when C2 is active): Central Arsenal & Conduit Hub */}
                    {hasC2 && (
                        <>
                            <div
                                style={{
                                    flex: '0.9',
                                    minWidth: 0,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center'
                                }}
                            >
                                <div
                                    className="cd-constructor-module"
                                    onMouseEnter={() => setHoveredNode({ tier: 'tier2', index: 0 })}
                                    onMouseLeave={() => setHoveredNode(null)}
                                    onClick={() => isEditable && setActiveEditor({ type: 'tooling' })}
                                    style={{
                                        '--module-accent': '#c084fc',
                                        '--module-glow': 'rgba(192, 132, 252, 0.34)',
                                        animationDelay: '0.06s',
                                        position: 'relative',
                                        borderRadius: '9px',
                                        background: 'linear-gradient(180deg, rgba(30, 17, 54, 0.96) 0%, rgba(11, 15, 26, 0.99) 100%)',
                                        border: '1px solid rgba(192, 132, 252, 0.5)',
                                        borderTop: '2px solid #c084fc',
                                        boxShadow: '0 8px 20px rgba(0, 0, 0, 0.5)',
                                        cursor: isEditable ? 'pointer' : 'default',
                                        display: 'flex',
                                        flexDirection: 'column'
                                    }}
                                >
                                    <PortSocket side="left" color="#c084fc" isActive={hoveredNode?.tier === 'tier2'} />
                                    <PortSocket side="right" color="#c084fc" isActive={hoveredNode?.tier === 'tier2'} />

                                    <div
                                        style={{
                                            padding: '5px 10px',
                                            background: 'rgba(168, 85, 247, 0.14)',
                                            borderBottom: '1px solid rgba(192, 132, 252, 0.22)',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}
                                    >
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.58rem', fontWeight: 800, color: '#e9d5ff', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                                            <Wrench size={10} color="#c084fc" /> Conduit Module
                                        </span>
                                    </div>

                                    <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                            {effectiveTools.map(t => {
                                                const isExplicit = explicitTools.includes(t);
                                                return (
                                                    <span key={t} className="cd-chip-anim" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.6rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'rgba(168, 85, 247, 0.25)', border: '1px solid rgba(192, 132, 252, 0.45)', color: '#f3e8ff' }}>
                                                        {t}
                                                        {isEditable && isExplicit && (
                                                            <X size={9} onClick={e => handleRemoveTool(t, e)} style={{ cursor: 'pointer' }} />
                                                        )}
                                                    </span>
                                                );
                                            })}
                                            {isEditable && (
                                                <span className="cd-chip-anim" style={{ fontSize: '0.58rem', color: '#d8b4fe', fontWeight: 700, padding: '2px 5px', border: '1px dashed rgba(192, 132, 252, 0.4)', borderRadius: '4px' }}>
                                                    + Tool
                                                </span>
                                            )}
                                        </div>

                                        {activeEditor?.type === 'staging' ? (
                                            <div onClick={e => e.stopPropagation()}>
                                                <input
                                                    ref={inlineInputRef}
                                                    type="text"
                                                    value={draftValue}
                                                    onChange={e => setDraftValue(e.target.value)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') commitActiveEditor();
                                                        else if (e.key === 'Escape') setActiveEditor(null);
                                                    }}
                                                    onBlur={commitActiveEditor}
                                                    placeholder="Staging Path / Guardrail..."
                                                    style={inlineInputCss}
                                                />
                                            </div>
                                        ) : (
                                            (stagingText || isEditable) && (
                                                <div
                                                    className="cd-slot-interactive"
                                                    onClick={handleStartEditStaging}
                                                    style={{
                                                        padding: '3px 6px',
                                                        borderRadius: '4px',
                                                        background: 'rgba(244, 63, 94, 0.1)',
                                                        border: '1px dashed rgba(244, 63, 94, 0.35)',
                                                        color: stagingText ? '#fda4af' : 'var(--text-muted)',
                                                        fontSize: '0.59rem',
                                                        fontFamily: 'monospace',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                >
                                                    <Shield size={9} color="#fb7185" style={{ flexShrink: 0 }} />
                                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {stagingText || '+ Guardrail'}
                                                    </span>
                                                </div>
                                            )
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* WIRE ALLEY 2 */}
                            <WireAlley
                                leftCount={1}
                                rightCount={displayTargetNodes.length}
                                startColor="#c084fc"
                                endColor="#f59e0b"
                                idPrefix="alley-2"
                                inModal={inModal}
                                activeLeftIndex={hoveredNode?.tier === 'tier2' ? 0 : null}
                                activeRightIndex={hoveredNode?.tier === 'tier3' ? hoveredNode.index : null}
                            />
                        </>
                    )}

                    {/* TIER 3: Target Endpoint Modules (Every Endpoint shows its bound TTPs & Role Breakdown!) */}
                    <div
                        style={{
                            flex: '1.1',
                            minWidth: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-around',
                            gap: '12px'
                        }}
                    >
                        {displayTargetNodes.map((node, idx) => {
                            const isEditingThis =
                                activeEditor?.type === 'target' && activeEditor.index === node.index;
                            const isHoveredThis =
                                hoveredNode?.tier === 'tier3' && hoveredNode.index === idx;
                            const nodeTtps = getTtpsForTargetNode(node);
                            const nodeRolePills = computeRolePillsForTtps(nodeTtps);
                            const hasCustomSubset =
                                Boolean(node.raw) && Array.isArray(hostTtpAssignments[node.raw]);

                            return (
                                <div
                                    key={node.id}
                                    className={`cd-constructor-module${isEditingThis ? ' cd-module-editing' : ''}`}
                                    onMouseEnter={() => setHoveredNode({ tier: 'tier3', index: idx })}
                                    onMouseLeave={() => setHoveredNode(null)}
                                    onClick={() => !isEditingThis && handleStartEditTarget(node)}
                                    title={isEditable ? 'Click to set Target Hostname / IP' : node.label}
                                    style={{
                                        '--module-accent': '#f59e0b',
                                        '--module-glow': 'rgba(245, 158, 11, 0.32)',
                                        animationDelay: `${idx * 0.06}s`,
                                        position: 'relative',
                                        borderRadius: '9px',
                                        background: 'linear-gradient(180deg, rgba(24, 20, 14, 0.96) 0%, rgba(10, 12, 19, 0.99) 100%)',
                                        border: isEditingThis
                                            ? '1px solid #fbbf24'
                                            : node.isDefaultEnv
                                            ? '1px dashed rgba(245, 158, 11, 0.45)'
                                            : '1px solid rgba(245, 158, 11, 0.5)',
                                        borderTop: '2px solid #f59e0b',
                                        boxShadow: '0 8px 20px rgba(0, 0, 0, 0.5)',
                                        cursor: isEditable ? 'pointer' : 'default',
                                        display: 'flex',
                                        flexDirection: 'column'
                                    }}
                                >
                                    <PortSocket side="left" color="#f59e0b" isActive={isHoveredThis || isEditingThis} />

                                    {/* Endpoint Module Header */}
                                    <div
                                        style={{
                                            padding: '5px 10px',
                                            background: 'rgba(245, 158, 11, 0.1)',
                                            borderBottom: '1px solid rgba(245, 158, 11, 0.2)',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}
                                    >
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.58rem', fontWeight: 800, color: '#fbbf24', letterSpacing: '0.6px' }}>
                                            <Cpu size={10} /> {node.hopBadge}
                                        </span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            {node.sub && (
                                                <span style={{ fontSize: '0.55rem', padding: '1px 5px', borderRadius: '3px', background: 'rgba(245, 158, 11, 0.16)', color: '#fde68a', fontFamily: 'monospace', fontWeight: 700, maxWidth: '105px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {node.sub}
                                                </span>
                                            )}
                                            {isEditable && !node.isDefaultEnv && !node.isDraft && (
                                                <button
                                                    type="button"
                                                    onClick={e => handleRemoveTarget(node.index, e)}
                                                    title="Delete Endpoint module"
                                                    style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0, display: 'flex' }}
                                                >
                                                    <X size={12} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Endpoint Module Body */}
                                    <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {isEditingThis ? (
                                            <div onClick={e => e.stopPropagation()}>
                                                <input
                                                    ref={inlineInputRef}
                                                    type="text"
                                                    value={draftValue}
                                                    onChange={e => setDraftValue(e.target.value)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') commitActiveEditor();
                                                        else if (e.key === 'Escape') setActiveEditor(null);
                                                    }}
                                                    onBlur={commitActiveEditor}
                                                    placeholder="e.g. 10.0.0.210 or WKSTN-FIN-04 (10.10.20.15)"
                                                    style={inlineInputCss}
                                                />
                                            </div>
                                        ) : (
                                            <div style={{ fontFamily: 'monospace', fontSize: inModal ? '0.84rem' : '0.76rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.label}</span>
                                                {isEditable && <Edit3 size={11} color="rgba(251, 191, 36, 0.65)" style={{ flexShrink: 0 }} />}
                                            </div>
                                        )}

                                        {/* When C2 is active, show/edit Test Identity on primary target endpoint */}
                                        {hasC2 && idx === 0 && (
                                            activeEditor?.type === 'identity' ? (
                                                <div onClick={e => e.stopPropagation()}>
                                                    <input
                                                        ref={inlineInputRef}
                                                        type="text"
                                                        value={draftValue}
                                                        onChange={e => setDraftValue(e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') commitActiveEditor();
                                                            else if (e.key === 'Escape') setActiveEditor(null);
                                                        }}
                                                        onBlur={commitActiveEditor}
                                                        placeholder="Test Account (e.g. CORP\svc_backup)"
                                                        style={inlineInputCss}
                                                    />
                                                </div>
                                            ) : (
                                                (testAccountText || isEditable) && (
                                                    <div
                                                        className="cd-slot-interactive"
                                                        onClick={handleStartEditIdentity}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'space-between',
                                                            gap: '4px',
                                                            padding: '2px 5px',
                                                            borderRadius: '4px',
                                                            border: '1px solid transparent',
                                                            fontSize: '0.62rem',
                                                            fontFamily: 'monospace',
                                                            color: testAccountText ? '#6ee7b7' : 'var(--text-muted)'
                                                        }}
                                                    >
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            <UserCheck size={10} color="#34d399" style={{ flexShrink: 0 }} />
                                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                {testAccountText || '+ Bind Account'}
                                                            </span>
                                                        </span>
                                                        {isEditable && testAccountText && (
                                                            <X
                                                                size={10}
                                                                onClick={e => {
                                                                    e.stopPropagation();
                                                                    updateBlueprint('testAccounts', '');
                                                                }}
                                                            />
                                                        )}
                                                    </div>
                                                )
                                            )
                                        )}

                                        {/* Bound TTPs & Role Breakdown on EVERY Endpoint! */}
                                        {nodeRolePills.length > 0 && (
                                            <div
                                                className="cd-slot-interactive"
                                                onClick={e => {
                                                    if (isEditable && node.raw) {
                                                        e.stopPropagation();
                                                        setActiveEditor(prev =>
                                                            prev?.type === 'hostTtps' && prev.hostKey === node.raw
                                                                ? null
                                                                : { type: 'hostTtps', hostKey: node.raw }
                                                        );
                                                    }
                                                }}
                                                title={
                                                    isEditable && node.raw
                                                        ? `Bound TTPs: ${nodeTtps.map(t => t.id).join(', ')}. Click to customize which TTPs execute on ${node.label}`
                                                        : nodeTtps.map(t => `${t.id} (${t.name})`).join(', ')
                                                }
                                                style={{
                                                    display: 'flex',
                                                    flexWrap: 'wrap',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    padding: '4px 5px 2px 5px',
                                                    borderRadius: '4px',
                                                    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                                                    cursor: isEditable && node.raw ? 'pointer' : 'default'
                                                }}
                                            >
                                                {nodeRolePills.map((pill, pillIdx) => (
                                                    <span
                                                        key={pill.label}
                                                        className="cd-chip-anim"
                                                        style={{
                                                            animationDelay: `${pillIdx * 0.04}s`,
                                                            fontSize: '0.57rem',
                                                            fontWeight: 700,
                                                            padding: '1px 5px',
                                                            borderRadius: '4px',
                                                            background: 'rgba(255, 255, 255, 0.05)',
                                                            border: `1px solid ${pill.color}44`,
                                                            color: pill.color,
                                                            whiteSpace: 'nowrap'
                                                        }}
                                                    >
                                                        {pill.label}
                                                    </span>
                                                ))}
                                                {hasCustomSubset && (
                                                    <span style={{ fontSize: '0.54rem', color: '#fde68a', fontFamily: 'monospace' }}>
                                                        ({nodeTtps.length}/{ttpCount})
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <>
            {renderCanvas(false)}

            {isExpandedModal && (
                <div
                    onClick={() => setIsExpandedModal(false)}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 9999,
                        background: 'rgba(2, 4, 10, 0.42)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '24px'
                    }}
                >
                    <div
                        className="cd-popout-window"
                        onClick={e => e.stopPropagation()}
                        style={{
                            width: 'min(1440px, 95vw)',
                            maxHeight: '92vh',
                            overflowY: 'auto',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px'
                        }}
                    >
                        {renderCanvas(true)}
                    </div>
                </div>
            )}
        </>
    );
}
