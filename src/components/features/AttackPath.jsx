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
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../AppContext';
import { ShieldAlert, Shield, X, Package, Monitor, Zap, Network, SatelliteDish, Sparkles, Activity, Fingerprint, AlertCircle, Crosshair, FileText, Terminal, ChevronDown, ChevronUp, Swords, Map as MapIcon, Target, Code } from 'lucide-react';
import BlackHoleIcon from '../ui/BlackHoleIcon';

// Custom Cyber Kill Chain Icons - Highly Detailed
const CyberEyeIcon = ({ size = 32, color = "currentColor", ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
        {/* Smooth organic outer eye housing */}
        <path d="M2 12c3.5-5 8.5-7 10-7s6.5 2 10 7c-3.5 5-8.5 7-10 7s-6.5-2-10-7z" />
        {/* Outer Lens Housing */}
        <circle cx="12" cy="12" r="5" />
        {/* Inner focusing ring */}
        <circle cx="12" cy="12" r="3" strokeDasharray="1 2" />
        {/* Core optical sensor */}
        <circle cx="12" cy="12" r="1.5" fill={color} />
        {/* HUD Targeting Crosshairs */}
        <line x1="12" y1="4" x2="12" y2="7" />
        <line x1="12" y1="17" x2="12" y2="20" />
        <line x1="4" y1="12" x2="7" y2="12" />
        <line x1="17" y1="12" x2="20" y2="12" />
    </svg>
);

const TreasureMapIcon = ({ size = 32, color = "currentColor", ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        {/* Map Outline */}
        <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
        
        {/* Zig-zag Path */}
        <path d="M6 10l4 2l4-2l3 3" strokeDasharray="2 2" />
        
        {/* Crosshair / X marks the spot */}
        <line x1="15" y1="11" x2="19" y2="15" />
        <line x1="19" y1="11" x2="15" y2="15" />
    </svg>
);

const LaserGunIcon = ({ size = 32, color = "currentColor", ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
        {/* Heavy Angular Cyberpunk Frame */}
        <path d="M3 7h11l2 2h3v4h-3l-2 2H3V7z" />
        {/* Underbarrel Attachment */}
        <rect x="5" y="15" width="6" height="2" />
        {/* Ergonomic Cyber Grip */}
        <path d="M6 15l-1.5 6h4.5l1.5-6" />
        {/* Trigger & Guard */}
        <path d="M11 15v2.5a1.5 1.5 0 0 1-1.5 1.5H8" />
        {/* Cyber-vents on barrel */}
        <line x1="7" y1="9" x2="7" y2="13" />
        <line x1="10" y1="9" x2="10" y2="13" />
        <line x1="13" y1="9" x2="13" y2="13" />
        {/* Power Core */}
        <circle cx="16" cy="11" r="0.5" fill={color} />
        {/* Tactical Sights */}
        <path d="M4 7V5h2v2" />
        <path d="M12 7V6h2v1" />
        {/* Energy Beam */}
        <line x1="21" y1="11" x2="24" y2="11" strokeWidth="2" strokeDasharray="1 1" />
    </svg>
);

const DeliveryTruckIcon = ({ size = 32, color = "currentColor", ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
        {/* Modern Aerodynamic Van Body */}
        <path d="M2 10C2 7.8 3.8 6 6 6h7c2.2 0 4.5 1 6 2.5l2 2C21.8 11.3 22 12.4 22 13.5V17h-2c0 1.7-1.3 3-3 3s-3-1.3-3-3H10c0 1.7-1.3 3-3 3s-3-1.3-3-3H2V10z" />
        
        {/* Cab Window */}
        <path d="M13 7h1c1.5 0 3 1 4 2l1.5 1.5C19.8 11 20 11.5 20 12h-7V7z" />
        
        {/* Wheels inside wheel wells */}
        <circle cx="7" cy="17" r="2" fill="var(--bg-primary)" />
        <circle cx="7" cy="17" r="0.5" fill={color} />
        <circle cx="17" cy="17" r="2" fill="var(--bg-primary)" />
        <circle cx="17" cy="17" r="0.5" fill={color} />
        
        {/* Mail Envelope Graphic on side */}
        <rect x="4" y="10" width="5" height="3" rx="0.5" />
        <path d="M4 10l2.5 1.5L9 10" />
        
        {/* Road/Speed lines */}
        <line x1="2" y1="21" x2="6" y2="21" strokeDasharray="2 2" />
        <line x1="10" y1="21" x2="14" y2="21" strokeDasharray="2 2" />
    </svg>
);

const ExploitIcon = ({ size = 32, color = "currentColor", ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
        {/* Malware Bug Body */}
        <rect x="8" y="6" width="8" height="12" rx="3" />
        <path d="M10 6V4a2 2 0 0 1 4 0v2" />
        <path d="M10 2L8 4" />
        <path d="M14 2l2 2" />
        {/* Circuit Board Legs */}
        <path d="M8 8H4v-2" />
        <path d="M8 12H3" />
        <path d="M8 16H4v2" />
        <path d="M16 8h4v-2" />
        <path d="M16 12h5" />
        <path d="M16 16h4v2" />
        {/* Embedded Lightning Core */}
        <path d="M13 7l-3 5h3l-1 4 3-6h-2z" fill={color} />
    </svg>
);

const NetworkSpreadIcon = ({ size = 32, color = "currentColor", ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
        {/* Central Core Server */}
        <rect x="9" y="9" width="6" height="6" rx="1" fill={color} fillOpacity="0.2" />
        <path d="M10 12h4" />
        <path d="M12 10v4" />
        {/* Outbound Propagation Beams */}
        <path d="M12 9V3" strokeDasharray="2 2" />
        <path d="M12 15v6" strokeDasharray="2 2" />
        <path d="M9 12H3" strokeDasharray="2 2" />
        <path d="M15 12h6" strokeDasharray="2 2" />
        {/* Secondary Infected Nodes */}
        <circle cx="12" cy="3" r="2" />
        <circle cx="12" cy="21" r="2" />
        <circle cx="3" cy="12" r="2" />
        <circle cx="21" cy="12" r="2" />
        {/* Orbital Security Rings */}
        <path d="M6 6l3 3" />
        <path d="M18 6l-3 3" />
        <path d="M6 18l3-3" />
        <path d="M18 18l-3-3" />
        <circle cx="12" cy="12" r="8" strokeDasharray="1 4" opacity="0.5" />
    </svg>
);

const ToolboxIcon = ({ size = 32, color = "currentColor", ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
        {/* Armored Crate Body */}
        <rect x="2" y="9" width="20" height="12" rx="1" />
        {/* Heavy Crate Lid */}
        <rect x="1" y="8" width="22" height="3" rx="0.5" />
        {/* Mechanical Handle */}
        <path d="M7 8V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3" />
        <line x1="9" y1="5" x2="15" y2="5" />
        {/* Cyber Core Lock */}
        <circle cx="12" cy="15" r="2" fill={color} />
        <line x1="12" y1="15" x2="12" y2="11" />
        <line x1="9" y1="15" x2="6" y2="15" />
        <line x1="15" y1="15" x2="18" y2="15" />
        {/* Tech Corner Reinforcements */}
        <path d="M2 18h3v3" />
        <path d="M22 18h-3v3" />
        <path d="M6 21v-3h12v3" opacity="0.4" />
    </svg>
);

const SatelliteIcon = ({ size = 32, color = "currentColor", ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
        {/* Tripod Base */}
        <path d="M12 16l-4 6" />
        <path d="M12 16l4 6" />
        <path d="M12 16v6" />
        {/* Pivot Joint */}
        <circle cx="12" cy="16" r="1.5" fill={color} />
        
        {/* Tilted Dish Assembly */}
        <g transform="rotate(35 12 16)">
            {/* Dish Bowl */}
            <path d="M5 12a7 4 0 0 0 14 0" />
            {/* 3D Dish Rim */}
            <ellipse cx="12" cy="12" rx="7" ry="1.5" />
            {/* Center Antenna */}
            <line x1="12" y1="12" x2="12" y2="6" />
            <circle cx="12" cy="5" r="1" />
            <line x1="10" y1="7" x2="14" y2="7" />
            {/* Transmitting Signal Waves */}
            <path d="M8 2a6 6 0 0 1 8 0" />
            <path d="M10 -1a3 3 0 0 1 4 0" />
        </g>
    </svg>
);
const ObjectivesIcon = ({ size = 32, color = "currentColor", ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
        {/* Cyber Fortress Base */}
        <path d="M3 21h18" strokeWidth="2" />
        {/* Fortress Walls & Battlements */}
        <path d="M4 21V9l2-2h2v2h2v-2h4v2h2v-2h2l2 2v12" />
        {/* Central Citadel Keep */}
        <path d="M8 21v-7l4-4 4 4v7" />
        {/* Inner Keep Details (Crown motif) */}
        <path d="M10 16l2-2 2 2" />
        {/* Data Portcullis */}
        <path d="M10 21v-3h4v3" />
        <line x1="12" y1="18" x2="12" y2="21" />
        {/* Floating Keys / Jewels */}
        <circle cx="12" cy="4" r="1.5" fill={color} />
        <circle cx="6" cy="6" r="1" />
        <circle cx="18" cy="6" r="1" />
    </svg>
);

export default function AttackPath() {
    const { gaps, events, mitreData, setActiveAiContext, generateAIContent, aiSettings, isAiActive, simulationSummaries } = useAppContext();
    const [selectedGap, setSelectedGap] = useState(null);

    const getTacticTags = (ttpString, fallbackTactic) => {
        const ttps = (ttpString || '').split(',').map(t => t.trim()).filter(Boolean);
        const tactics = new Set();
        if (mitreData) {
            ttps.forEach(ttp => {
                const parentId = ttp.includes('.') ? ttp.split('.')[0] : ttp;
                for (const [tacticName, tactic] of Object.entries(mitreData)) {
                    if (tactic.techniques?.some(t => t.id === parentId)) {
                        tactics.add(tacticName);
                        break;
                    }
                }
            });
        }
        return tactics.size > 0 ? Array.from(tactics) : [fallbackTactic || 'Unknown Phase'];
    };
    const [showGapCode, setShowGapCode] = useState(false);
    useEffect(() => {
        if (selectedGap) setShowGapCode(false);
    }, [selectedGap]);
    const [hoveredNode, setHoveredNode] = useState(null);
    const [hoveredEdge, setHoveredEdge] = useState(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const navigate = useNavigate();

    const containerRef = useRef(null);
    const nodesRef = useRef(new Map());
    const [paths, setPaths] = useState([]);
    const [scrollHeight, setScrollHeight] = useState('100%');
    
    const [aiEdges, setAiEdges] = useState(() => {
        try {
            const cached = sessionStorage.getItem('attack_path_edges');
            return cached ? JSON.parse(cached) : null;
        } catch (e) {
            return null;
        }
    });
    
    useEffect(() => {
        if (aiEdges !== null) {
            sessionStorage.setItem('attack_path_edges', JSON.stringify(aiEdges));
        }
    }, [aiEdges]);

    const [isGeneratingPaths, setIsGeneratingPaths] = useState(false);

    const handleGeneratePaths = async () => {
        if (!isAiActive) return;
        setIsGeneratingPaths(true);
        try {
            const gapsPayload = gaps.filter(g => g.status !== 'Resolved' && g.status !== 'Risk Accepted' && g.coverageRating !== 'Optimal').map(g => ({
                id: String(g.id),
                phase: g.phase,
                ttp: g.ttp,
                environment: g.environment,
                severity: g.severity,
                description: g.finding
            }));
            const prompt = `Analyze these security gaps. Act as an expert Red Teamer. Identify the SINGLE most critical, continuous end-to-end attack path that an adversary would take. 
The path MUST start from the earliest applicable phase and chain together vulnerabilities sequentially through the phases until reaching the final objective.
Do NOT return independent edges or branches. You MUST return a single linear sequence of gap IDs representing the steps in the attack.
Return a valid JSON object matching this exact schema:
{
  "path": [
    {"gapId": "GAP-X", "rationale": "Initial access gained via..."},
    {"gapId": "GAP-Y", "rationale": "Used access from GAP-X to..."},
    {"gapId": "GAP-Z", "rationale": "Pivoted from GAP-Y to achieve..."}
  ]
}
Do not include markdown code block wrappers, return ONLY the raw JSON string.\nGaps: ${JSON.stringify(gapsPayload)}`;
            
            const responseText = await generateAIContent(prompt);
            
            // Remove <think> blocks first (for reasoning models)
            let cleanText = responseText.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '').trim();
            
            // Robustly extract JSON block
            let jsonText = cleanText;
            const jsonBlockMatch = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
            if (jsonBlockMatch) {
                jsonText = jsonBlockMatch[1].trim();
            } else {
                // Fallback: extract substring from first { to last }
                const firstBrace = cleanText.indexOf('{');
                const lastBrace = cleanText.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                    jsonText = cleanText.substring(firstBrace, lastBrace + 1);
                }
            }
            
            const parsed = JSON.parse(jsonText);
            
            let validEdges = [];
            if (parsed.path && Array.isArray(parsed.path) && parsed.path.length > 1) {
                // Force strictly logical left-to-right flow by sorting nodes by their actual rendered column
                const phaseColumns = ['Delivery', 'Exploitation', 'Installation', 'Command and Control', 'Lateral Movement', 'Actions on Objectives'];
                const getPhaseIdx = (node) => {
                    const gapId = typeof node === 'string' ? node : (node?.gapId || '');
                    const cleanId = String(gapId).replace('GAP-', '').trim();
                    for (let i = 0; i < phaseColumns.length; i++) {
                        const colItems = itemsByPhase[phaseColumns[i]];
                        if (colItems && colItems.some(g => String(g.id) === cleanId)) {
                            return i;
                        }
                    }
                    return 99;
                };
                
                parsed.path.sort((a, b) => {
                    const idxA = getPhaseIdx(a);
                    const idxB = getPhaseIdx(b);
                    if (idxA === idxB) return 0;
                    if (idxA === 99) return 1;
                    if (idxB === 99) return -1;
                    return idxA - idxB;
                });

                for (let i = 0; i < parsed.path.length - 1; i++) {
                    const source = parsed.path[i];
                    const target = parsed.path[i+1];
                    const sourceId = typeof source === 'string' ? source : source?.gapId;
                    const targetId = typeof target === 'string' ? target : target?.gapId;
                    
                    if (sourceId && targetId) {
                        validEdges.push({
                            sourceId: String(sourceId).replace('GAP-', '').trim(),
                            targetId: String(targetId).replace('GAP-', '').trim(),
                            rationale: target?.rationale || 'AI identified escalation vector'
                        });
                    }
                }
            } else if (parsed.edges && Array.isArray(parsed.edges)) {
                // Fallback for old schema if it hallucinates it
                validEdges = parsed.edges.map(e => ({
                    sourceId: String(e.sourceId).replace('GAP-', ''),
                    targetId: String(e.targetId).replace('GAP-', ''),
                    rationale: e.rationale || 'AI identified escalation vector'
                }));
            }
            
            setAiEdges(validEdges);
        } catch (e) {
            console.error("AI Path generation failed", e);
            setAiEdges([]); // Set empty array to show no paths found or failed
        } finally {
            setIsGeneratingPaths(false);
        }
    };

    useEffect(() => {
        setActiveAiContext({
            view: 'Attack Path Diagram',
            description: 'Visual cyber kill chain graph showing current vulnerabilities (gaps) plotted across attack phases.',
            activeGaps: gaps.filter(g => g.status !== 'Resolved').map(g => ({
                id: g.id,
                title: g.title,
                ttp: g.ttp,
                phase: g.phase,
                environment: g.environment,
                severity: g.severity
            }))
        });
        return () => setActiveAiContext(null);
    }, [gaps, setActiveAiContext]);

    const phases = useMemo(() => [
        { id: 'Delivery', icon: <DeliveryTruckIcon size={32} /> },
        { id: 'Exploitation', icon: <ExploitIcon size={32} /> },
        { id: 'Installation', icon: <ToolboxIcon size={32} /> },
        { id: 'Command and Control', icon: <SatelliteIcon size={32} /> },
        { id: 'Lateral Movement', icon: <NetworkSpreadIcon size={32} /> },
        { id: 'Actions on Objectives', icon: <ObjectivesIcon size={32} /> }
    ], []);

    const getTTPName = (idString) => {
        if (!mitreData || !idString) return '';
        const ids = idString.split(',').map(s => s.trim());
        const names = [];
        ids.forEach(id => {
            let found = false;
            for (const tactic of Object.values(mitreData)) {
                if (found) break;
                const tech = tactic.techniques.find(t => t.id === id);
                if (tech) {
                    names.push(tech.name);
                    found = true;
                    break;
                }
                for (const t of tactic.techniques) {
                    if (t.subTechniques) {
                        const sub = t.subTechniques.find(s => s.id === id);
                        if (sub) {
                            names.push(sub.name);
                            found = true;
                            break;
                        }
                    }
                }
            }
        });
        return names.length > 0 ? names.join(', ') : '';
    };

    const activeGaps = useMemo(() => gaps.filter(g => g.status !== 'Resolved' && g.coverageRating !== 'Optimal'), [gaps]);

    const itemsByPhase = useMemo(() => {
        const grouped = {};
        phases.forEach(p => grouped[p.id] = []);

        const processItem = (item, isDefense) => {
            let foundTactics = [];
            if (mitreData) {
                const ttps = (item.ttp || '').split(',').map(t => t.trim());
                for (const [tacticName, tacticObj] of Object.entries(mitreData)) {
                    if (tacticName === 'Reconnaissance' || tacticName === 'Resource Development') continue;
                    if (tacticObj.techniques.some(t => ttps.includes(t.id) || (t.subTechniques && t.subTechniques.some(s => ttps.includes(s.id))))) {
                        foundTactics.push(tacticName);
                    }
                }
            }
            
            let assignedPhaseIndex = -1;
            let finalTactic = null;

            foundTactics.forEach(t => {
                let pIndex = 5; // Actions on Objectives
                if (['Initial Access'].includes(t)) pIndex = 0;
                else if (['Execution'].includes(t)) pIndex = 1;
                else if (['Persistence', 'Privilege Escalation', 'Defense Evasion'].includes(t)) pIndex = 2;
                else if (['Discovery', 'Lateral Movement', 'Credential Access', 'Collection'].includes(t)) pIndex = 3;
                else if (['Command and Control'].includes(t)) pIndex = 4;
                
                if (pIndex > assignedPhaseIndex) {
                    assignedPhaseIndex = pIndex;
                    finalTactic = t;
                }
            });

            let assignedPhase = 'Actions on Objectives';
            if (assignedPhaseIndex === 0) assignedPhase = 'Delivery';
            else if (assignedPhaseIndex === 1) assignedPhase = 'Exploitation';
            else if (assignedPhaseIndex === 2) assignedPhase = 'Installation';
            else if (assignedPhaseIndex === 3) assignedPhase = 'Lateral Movement';
            else if (assignedPhaseIndex === 4) assignedPhase = 'Command and Control';

            if (grouped[assignedPhase]) {
                const ttpName = getTTPName(item.ttp);
                grouped[assignedPhase].push({ ...item, tactic: finalTactic, ttpName, isDefense });
            }
        };

        activeGaps.forEach(g => processItem(g, false));

        return grouped;
    }, [activeGaps, mitreData]);

    const getSeverityColor = (severity) => {
        switch(severity) {
            case 'Critical': return '#a855f7'; // purple-500
            case 'High': return '#ef4444'; // red-500
            case 'Medium': return '#f97316'; // orange-500
            default: return '#eab308'; // yellow-500 (Low)
        }
    };

    // Remove globalThreatLevel and threatColor calculations since we'll just use paths.length

    const getPhaseIcon = (tactic, size = 20, color = 'currentColor', style = {}) => {
        let assignedPhase = 'Actions on Objectives';
        if (['Initial Access'].includes(tactic)) assignedPhase = 'Delivery';
        else if (['Execution'].includes(tactic)) assignedPhase = 'Exploitation';
        else if (['Persistence', 'Privilege Escalation', 'Defense Evasion'].includes(tactic)) assignedPhase = 'Installation';
        else if (['Command and Control'].includes(tactic)) assignedPhase = 'Command and Control';
        else if (['Discovery', 'Lateral Movement', 'Credential Access', 'Collection'].includes(tactic)) assignedPhase = 'Lateral Movement';

        const props = { size, color, style };
        switch(assignedPhase) {
            case 'Delivery': return <DeliveryTruckIcon {...props} />;
            case 'Exploitation': return <ExploitIcon {...props} />;
            case 'Installation': return <ToolboxIcon {...props} />;
            case 'Command and Control': return <SatelliteIcon {...props} />;
            case 'Lateral Movement': return <NetworkSpreadIcon {...props} />;
            default: return <ObjectivesIcon {...props} />;
        }
    };

    // Recalculate paths on resize or data change
    useEffect(() => {
        const updatePaths = () => {
            if (!containerRef.current) return;
            const containerRect = containerRef.current.getBoundingClientRect();
            const scrollLeft = containerRef.current.scrollLeft;
            const scrollTop = containerRef.current.scrollTop;
            setScrollHeight(containerRef.current.scrollHeight);
            
            if (!aiEdges) {
                setPaths([]);
                return;
            }

            const edgesMap = new Map();
            
            aiEdges.forEach(edge => {
                const sourceGapId = edge.sourceId;
                const targetGapId = edge.targetId;
                const edgeId = `${sourceGapId}-${targetGapId}`;
            
                const sourceEl = nodesRef.current.get(String(sourceGapId));
                const targetEl = nodesRef.current.get(String(targetGapId));
                if (!sourceEl || !targetEl) return;

                const sourceRect = sourceEl.getBoundingClientRect();
                const targetRect = targetEl.getBoundingClientRect();
                
                const scale = window.appScale || 1;
                const startX = (sourceRect.right - containerRect.left + scrollLeft) / scale;
                const startY = (sourceRect.top + sourceRect.height / 2 - containerRect.top + scrollTop) / scale;
                const endX = (targetRect.left - containerRect.left + scrollLeft) / scale;
                const endY = (targetRect.top + targetRect.height / 2 - containerRect.top + scrollTop) / scale;

                const cp1X = startX + (endX - startX) / 2;
                const cp1Y = startY;
                const cp2X = startX + (endX - startX) / 2;
                const cp2Y = endY;

                edgesMap.set(edgeId, {
                    id: edgeId,
                    sourceId: sourceGapId,
                    targetId: targetGapId,
                    rationale: edge.rationale,
                    d: `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`,
                    color: 'rgba(239, 68, 68, 0.4)',
                    highlightedColor: 'rgba(239, 68, 68, 1)',
                    strokeWidth: 2,
                    isCritical: true,
                    isDisrupted: false
                });
            });
            
            setPaths(Array.from(edgesMap.values()));
        };

        updatePaths();
        // Delay update slightly to ensure DOM is fully rendered
        const timeoutId = setTimeout(updatePaths, 100);
        const container = containerRef.current;
        if (container) container.addEventListener('scroll', updatePaths);
        window.addEventListener('resize', updatePaths);
        return () => {
            clearTimeout(timeoutId);
            if (container) container.removeEventListener('scroll', updatePaths);
            window.removeEventListener('resize', updatePaths);
        };
    }, [aiEdges, itemsByPhase, phases]);

    // Graph traversal for Interactive Hover Highlighting
    const activeTraceNodes = useMemo(() => {
        if (!hoveredNode) return new Set();
        
        const highlighted = new Set();
        highlighted.add(String(hoveredNode));
        
        // Upstream traversal (only backwards)
        const upQueue = [String(hoveredNode)];
        while (upQueue.length > 0) {
            const current = upQueue.shift();
            paths.forEach(p => {
                if (String(p.targetId) === current && !highlighted.has(String(p.sourceId))) {
                    highlighted.add(String(p.sourceId));
                    upQueue.push(String(p.sourceId));
                }
            });
        }
        
        // Downstream traversal (only forwards)
        const downQueue = [String(hoveredNode)];
        while (downQueue.length > 0) {
            const current = downQueue.shift();
            paths.forEach(p => {
                if (String(p.sourceId) === current && !highlighted.has(String(p.targetId))) {
                    highlighted.add(String(p.targetId));
                    downQueue.push(String(p.targetId));
                }
            });
        }
        
        return highlighted;
    }, [hoveredNode, paths]);
    const [appScale, setAppScale] = useState(1);

    useEffect(() => {
        const handleResize = () => {
            const width = window.innerWidth;
            let newScale = 1;
            if (width < 1600) {
                newScale = Math.max(0.6, width / 1600);
            }
            setAppScale(newScale);
            window.appScale = newScale;
            // Trigger an immediate resize event to update path calculations
            window.dispatchEvent(new Event('attackpath-resize'));
        };
        
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
            <div className="animate-fade-in" style={{ width: '100%', height: '100%' }}>
                <div 
                    style={{ 
                        height: `${100 / appScale}%`, 
                        width: `${100 / appScale}%`, 
                        display: 'flex', 
                        flexDirection: 'column',
                        transform: `scale(${appScale})`,
                        transformOrigin: 'top left'
                    }}
                >
            <div style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 className="iridescent-text" style={{ fontSize: '2.5rem', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '15px' }}>
                        Attack Path
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', margin: 0 }}>
                        Visualizing how adversaries could chain together your open coverage gaps to achieve their objective.
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    {isAiActive && (
                        <>
                            <button 
                                className={`btn-premium-ai ${isGeneratingPaths ? 'loading' : ''}`}
                                onClick={handleGeneratePaths}
                                disabled={isGeneratingPaths || activeGaps.length === 0}
                            >
                                <BlackHoleIcon size={20} className={isGeneratingPaths ? 'animate-pulse' : ''} />
                                {isGeneratingPaths ? 'AI Assessing Vectors...' : 'Map Viable Paths'}
                            </button>
                            <div style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '15px 25px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', boxShadow: '0 0 20px rgba(0,0,0,0.5)' }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Viable Paths</span>
                                <div style={{ fontSize: '2.2rem', fontWeight: 'bold', color: paths.length > 10 ? 'var(--danger)' : paths.length > 5 ? 'var(--warning)' : 'var(--accent-secondary)', textShadow: `0 0 15px ${paths.length > 10 ? 'var(--danger)' : 'transparent'}`, fontFamily: 'monospace' }}>
                                    {paths.length}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div 
                ref={containerRef}
                className="glass-panel" 
                style={{ flex: 1, position: 'relative', overflowX: 'auto', overflowY: 'auto', display: 'flex', background: '#08090c' }}
            >
                {/* Cyber Grid Background */}
                <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(56, 189, 248, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(56, 189, 248, 0.05) 1px, transparent 1px)', backgroundSize: '40px 40px', opacity: 0.8, pointerEvents: 'none' }}></div>
                
                {activeGaps.length === 0 && (
                    <div style={{ 
                        position: 'absolute',
                        inset: 0,
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        padding: '40px', 
                        textAlign: 'center',
                        background: 'radial-gradient(circle at center, rgba(16, 185, 129, 0.08) 0%, transparent 70%)',
                        color: 'var(--text-primary)',
                        zIndex: 20
                    }}>
                        <div style={{ 
                            background: 'rgba(255, 255, 255, 0.02)', 
                            border: '1px solid var(--glass-border)', 
                            padding: '24px', 
                            borderRadius: '12px', 
                            marginBottom: '20px', 
                            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Shield size={40} color="var(--text-muted)" />
                        </div>
                        <h2 style={{ fontSize: '1.5rem', margin: '0 0 10px 0', color: 'var(--text-primary)', fontWeight: '500' }}>No Active Attack Paths</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '500px', lineHeight: '1.6', margin: 0 }}>
                            There are currently no active coverage gaps plotted across the kill chain.
                        </p>
                    </div>
                )}
                
                {activeGaps.length > 0 && (
                    <div className="attack-path-canvas-container" style={{ position: 'relative', display: 'flex', padding: '40px 20px', gap: '20px', width: '100%', minWidth: 'max-content', boxSizing: 'border-box', justifyContent: 'center' }}>
                        {/* SVG Laser Web Overlay */}
                        <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0, overflow: 'visible' }}>
                            {paths.map(p => {
                                const isHighlighted = hoveredNode ? (activeTraceNodes.has(String(p.sourceId)) && activeTraceNodes.has(String(p.targetId))) : false;
                                const isDimmed = hoveredNode ? !isHighlighted : false;
                                const strokeColor = isHighlighted ? p.highlightedColor : p.color;

                                return (
                                <g 
                                    key={p.id} 
                                    style={{ opacity: (isHighlighted ? 1 : isDimmed ? 0.15 : (p.isCritical ? 1 : 0.4)), transition: 'opacity 0.3s', zIndex: p.isCritical ? 10 : 1, cursor: p.rationale ? 'help' : 'default' }}
                                    onMouseEnter={(e) => {
                                        if (p.rationale) {
                                            setHoveredEdge(p);
                                            setMousePos({ x: e.clientX / (window.appScale || 1), y: e.clientY / (window.appScale || 1) });
                                        }
                                    }}
                                    onMouseMove={(e) => {
                                        if (p.rationale) setMousePos({ x: e.clientX / (window.appScale || 1), y: e.clientY / (window.appScale || 1) });
                                    }}
                                    onMouseLeave={() => setHoveredEdge(null)}
                                >
                                        {/* Outer Glow (Geometry based, ultra-fast) */}
                                        {(isHighlighted || (!isDimmed && p.isCritical)) && (
                                            <>
                                                <path d={p.d} fill="none" stroke={strokeColor} strokeWidth="12" opacity="0.15" />
                                                <path d={p.d} fill="none" stroke={strokeColor} strokeWidth="6" opacity="0.3" />
                                            </>
                                        )}
                                        
                                        {/* Base line */}
                                        <path 
                                            d={p.d} 
                                            fill="none" 
                                            stroke={strokeColor} 
                                            strokeWidth={isHighlighted ? "4" : p.strokeWidth} 
                                            style={{ transition: 'all 0.3s' }}
                                        />
                                    </g>
                                )
                            })}
                        </svg>
                        
                        {/* Hardware-Accelerated Data Orbs (Laser Beams) */}
                        {paths.map(p => {
                            const isHighlighted = hoveredNode ? (activeTraceNodes.has(String(p.sourceId)) && activeTraceNodes.has(String(p.targetId))) : false;
                            const isDimmed = hoveredNode ? !isHighlighted : false;
                            if (isDimmed) return null;
                            
                            return (
                                <div 
                                    key={`orb-${p.id}`}
                                    style={{
                                        position: 'absolute', top: 0, left: 0, 
                                        width: p.isCritical ? '40px' : '30px', 
                                        height: p.isCritical ? '4px' : '2px',
                                        background: `linear-gradient(90deg, transparent 0%, ${p.color} 70%, #fff 100%)`,
                                        borderRadius: '10px',
                                        boxShadow: `0 0 12px 2px ${p.color}`,
                                        pointerEvents: 'none', zIndex: 0,
                                        offsetPath: `path('${p.d}')`,
                                        animation: p.isCritical ? 'moveOrb 2s linear infinite' : 'moveOrb 4s linear infinite'
                                    }}
                                />
                            )
                        })}

                        {phases.map((phase, i) => {
                                const severityOrder = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
                                const phaseGaps = (itemsByPhase[phase.id] || []).sort((a, b) => (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0));
                                const hasGaps = phaseGaps && phaseGaps.length > 0;
                                
                                return (
                                    <div key={phase.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '1 1 0', minWidth: '280px', zIndex: 1, position: 'relative' }}>
                                        {/* Cyber Phase Header */}
                                        <div style={{ 
                                            width: '100%', padding: '15px',
                                            background: hasGaps ? 'linear-gradient(180deg, rgba(239, 68, 68, 0.1) 0%, transparent 100%)' : 'rgba(255,255,255,0.02)', 
                                            borderTop: `3px solid ${hasGaps ? 'var(--danger)' : 'var(--glass-border)'}`,
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                            color: hasGaps ? 'var(--text-primary)' : 'var(--text-muted)',
                                            marginBottom: '40px', position: 'relative',
                                            boxShadow: hasGaps ? 'inset 0 15px 30px -15px rgba(239, 68, 68, 0.3)' : 'none',
                                        }}>
                                            {React.cloneElement(phase.icon, { color: hasGaps ? 'var(--danger)' : 'var(--text-muted)', style: { marginBottom: '8px' }})}
                                            <div style={{ fontWeight: 'bold', fontSize: '0.85rem', letterSpacing: '1px', textTransform: 'uppercase', textAlign: 'center' }}>
                                                {phase.id}
                                            </div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                                {hasGaps ? phaseGaps.length : 0} nodes
                                            </div>
                                        </div>

                                        {/* Gap Nodes (HUD Targets) */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px', width: '100%' }}>
                                            {hasGaps && phaseGaps.map(gap => {
                                                const isHighlighted = hoveredNode ? (activeTraceNodes.has(gap.id) || activeTraceNodes.has(String(gap.id))) : false;
                                                const isDimmed = hoveredNode ? !isHighlighted : false;
                                                
                                                const borderColor = gap.isDefense ? '#10b981' : getSeverityColor(gap.severity);
                                                const baseBg = gap.isDefense ? 'rgba(16, 185, 129, 0.05)' : 'rgba(10,11,16,0.95)';
                                                const hoverBg = gap.isDefense ? `radial-gradient(circle at 50% 0%, rgba(16, 185, 129, 0.2) 0%, rgba(16, 185, 129, 0.05) 80%)` : `radial-gradient(circle at 50% 0%, ${getSeverityColor(gap.severity)}30 0%, rgba(10,11,16,0.95) 80%)`;
                                                const boxShadowHighlighted = gap.isDefense ? `0 0 25px rgba(16, 185, 129, 0.4), inset 0 0 15px rgba(16, 185, 129, 0.2)` : `0 0 25px ${getSeverityColor(gap.severity)}60, inset 0 0 15px ${getSeverityColor(gap.severity)}30`;
                                                const boxShadowDimmed = gap.isDefense ? `0 8px 25px rgba(0,0,0,0.6), inset 0 0 10px rgba(16, 185, 129, 0.1)` : `0 8px 25px rgba(0,0,0,0.6), inset 0 0 10px rgba(255,255,255,0.02)`;

                                                return (
                                                    <div 
                                                        key={gap.id} 
                                                        ref={el => {
                                                            if (el) nodesRef.current.set(gap.id, el);
                                                            else nodesRef.current.delete(gap.id);
                                                        }}
                                                        className="attack-path-node"
                                                        onClick={() => setSelectedGap(gap)}
                                                        onMouseEnter={() => setHoveredNode(gap.id)}
                                                        onMouseLeave={() => setHoveredNode(null)}
                                                        style={{ 
                                                            background: isHighlighted ? `radial-gradient(circle at 50% 0%, ${getSeverityColor(gap.severity)}30 0%, rgba(10,11,16,0.95) 80%)` : 'rgba(10,11,16,0.95)', 
                                                            border: `1px solid ${getSeverityColor(gap.severity)}${isHighlighted ? 'ff' : '80'}`, 
                                                            borderRadius: '6px', padding: '15px', position: 'relative', cursor: 'pointer',
                                                            boxShadow: isHighlighted ? `0 0 25px ${getSeverityColor(gap.severity)}60, inset 0 0 15px ${getSeverityColor(gap.severity)}30` : `0 8px 25px rgba(0,0,0,0.6), inset 0 0 10px rgba(255,255,255,0.02)`,
                                                            transition: 'border-color 0.4s, box-shadow 0.4s, opacity 0.4s',
                                                            transform: 'translateZ(0)',
                                                            fontFamily: 'monospace',
                                                            opacity: isDimmed ? 0.3 : 1,
                                                            zIndex: isHighlighted ? 10 : 1,
                                                            minHeight: '145px',
                                                            display: 'flex',
                                                            flexDirection: 'column'
                                                        }}
                                                    >
                                                        {/* Cybernetic decorative corners */}
                                                        <div style={{ position: 'absolute', top: '-1px', left: '-1px', width: '8px', height: '8px', borderTop: `2px solid ${getSeverityColor(gap.severity)}`, borderLeft: `2px solid ${getSeverityColor(gap.severity)}` }} />
                                                        <div style={{ position: 'absolute', top: '-1px', right: '-1px', width: '8px', height: '8px', borderTop: `2px solid ${getSeverityColor(gap.severity)}`, borderRight: `2px solid ${getSeverityColor(gap.severity)}` }} />
                                                        <div style={{ position: 'absolute', bottom: '-1px', left: '-1px', width: '8px', height: '8px', borderBottom: `2px solid ${getSeverityColor(gap.severity)}`, borderLeft: `2px solid ${getSeverityColor(gap.severity)}` }} />
                                                        <div style={{ position: 'absolute', bottom: '-1px', right: '-1px', width: '8px', height: '8px', borderBottom: `2px solid ${getSeverityColor(gap.severity)}`, borderRight: `2px solid ${getSeverityColor(gap.severity)}` }} />

                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'flex-start', gap: '10px', flex: 1, overflow: 'hidden', minWidth: 0 }}>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0, flex: 1 }}>
                                                                <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 'bold', lineHeight: '1.3', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', display: '-webkit-box', overflow: 'hidden', wordBreak: 'break-all' }}>
                                                                    {gap.finding || gap.id}
                                                                </div>
                                                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '6px' }}>
                                                                    {getTacticTags(gap.ttp, gap.tactic).map(tag => (
                                                                        <span key={tag} style={{ fontSize: '0.65rem', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 'bold', background: 'rgba(255, 255, 255, 0.1)', padding: '2px 6px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                                                                            {tag}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                    <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold', marginRight: '6px' }}>{gap.ttp}</span>
                                                                    {gap.ttpName}
                                                                </div>
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                                                                <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#000', padding: '2px 6px', background: getSeverityColor(gap.severity), borderRadius: '2px', textTransform: 'uppercase' }}>
                                                                    {gap.severity}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Environment tag */}
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', marginTop: '15px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                <Monitor size={12} color="var(--accent-secondary)" style={{ flexShrink: 0 }} /> 
                                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                    {Array.isArray(gap.environment) ? gap.environment.join(', ') : (gap.environment || 'Unknown Environment')}
                                                                </span>
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                {gap.status === 'Risk Accepted' && (
                                                                    <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: 'var(--text-primary)', padding: '2px 6px', background: 'rgba(100, 116, 139, 0.5)', border: '1px solid rgba(148, 163, 184, 0.5)', borderRadius: '2px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                                                                        Risk Accepted
                                                                    </span>
                                                                )}
                                                                {gap.securityControls && gap.securityControls.length > 0 && (
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(59, 130, 246, 0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(59, 130, 246, 0.2)' }} title={gap.securityControls.join(', ')}>
                                                                        <Shield size={10} color="#60a5fa" />
                                                                        <span style={{ fontSize: '0.65rem', color: '#60a5fa', fontWeight: 'bold' }}>{gap.securityControls.length}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        

                                                        {/* Fake data stream lines */}
                                                        <div style={{ marginTop: '10px', width: '100%', height: '2px', background: 'rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden' }}>
                                                            <div style={{ position: 'absolute', top: 0, left: '-30%', width: '30%', height: '100%', background: getSeverityColor(gap.severity), animation: 'htmlLaserPulse 4s linear infinite' }} />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                )}
            </div>

            {/* Gap Details Modal */}
            {hoveredEdge && hoveredEdge.rationale && createPortal(
                <div style={{
                    position: 'fixed',
                    left: mousePos.x + 15,
                    top: mousePos.y + 15,
                    background: 'rgba(10,11,16,0.95)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid var(--accent-primary)',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    color: 'var(--text-primary)',
                    maxWidth: '350px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.5), 0 0 15px rgba(156,39,176,0.3)',
                    zIndex: 10000,
                    pointerEvents: 'none'
                }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', fontWeight: 'bold' }}>AI Escalation Rationale</div>
                    <div style={{ fontSize: '0.9rem', lineHeight: '1.4' }}>{hoveredEdge.rationale}</div>
                </div>, document.getElementById('root'))}

            {selectedGap && createPortal(
                <div className="animate-fade-in fixed-overlay" style={{ position: 'fixed', top: 0, left: 'var(--sidebar-width)', right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setSelectedGap(null)}>
                    <div className="glass-panel slide-in-staggered responsive-modal" style={{ background: 'rgba(10,11,16,0.6)', backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)', border: '1px solid var(--glass-border)', boxShadow: '0 0 50px rgba(0,0,0,0.8)', overflowY: 'auto', overflowX: 'hidden', maxHeight: '90vh', borderRadius: '12px', padding: '0', position: 'relative' }} onClick={e => e.stopPropagation()}>
                        
                        {/* Modal Cyber styling */}
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '3px', background: `linear-gradient(90deg, transparent, ${getSeverityColor(selectedGap.severity)}, transparent)` }} />

                        <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
                            <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '10px', textTransform: 'uppercase', letterSpacing: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '15px' }}>
                                {getPhaseIcon(selectedGap.tactic, 20, getSeverityColor(selectedGap.severity), { flexShrink: 0 })}
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {selectedGap.eventName || selectedGap.finding || selectedGap.name || selectedGap.ttp || selectedGap.id}
                                </span>
                            </h2>
                            <button className="btn hover-lift" onClick={() => setSelectedGap(null)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 16px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                                Close <X size={16} />
                            </button>
                        </div>
                        <div style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '25px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', background: 'rgba(0,0,0,0.3)', padding: '25px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                                    <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: '80px' }}>
                                        <Fingerprint size={32} color="var(--accent-primary)" />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                                            {getTacticTags(selectedGap.ttp, selectedGap.tactic).map(tag => (
                                                <span key={tag} style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold', background: 'rgba(156, 39, 176, 0.1)', border: '1px solid rgba(156, 39, 176, 0.3)', padding: '2px 8px', borderRadius: '4px' }}>
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                        <h2 style={{ margin: 0, color: '#fff', fontSize: '1.5rem', fontFamily: 'monospace', letterSpacing: '1px' }}>{selectedGap.ttp}</h2>
                                        <div style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: '500' }}>
                                            {selectedGap.ttpName}
                                        </div>
                                    </div>
                                </div>
                                
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                                    <div style={{ display: 'flex', flex: 1, minWidth: '150px', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '8px', border: `1px solid ${getSeverityColor(selectedGap.severity)}40`, color: getSeverityColor(selectedGap.severity) }}>
                                        <ShieldAlert size={16} />
                                        <span style={{ fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{selectedGap.severity} Severity</span>
                                    </div>
                                    
                                    <div style={{ display: 'flex', flex: 1, minWidth: '150px', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-primary)' }}>
                                        <Monitor size={16} color="var(--accent-secondary)" />
                                        <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>{Array.isArray(selectedGap.environment) ? selectedGap.environment.join(', ') : (selectedGap.environment || 'Unknown')}</span>
                                    </div>
                                    
                                    <div style={{ display: 'flex', flex: 1, minWidth: '150px', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '8px', border: `1px solid ${(selectedGap.status === 'Resolved' ? 'var(--success)' : selectedGap.status === 'In Progress' ? 'var(--warning)' : selectedGap.status === 'Risk Accepted' ? 'var(--text-muted)' : 'var(--danger)')}40`, color: (selectedGap.status === 'Resolved' ? 'var(--success)' : selectedGap.status === 'In Progress' ? 'var(--warning)' : selectedGap.status === 'Risk Accepted' ? 'var(--text-muted)' : 'var(--danger)') }}>
                                        <Activity size={16} />
                                        <span style={{ fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{selectedGap.status}</span>
                                    </div>
                                    {selectedGap.securityControls && selectedGap.securityControls.length > 0 && (
                                        <div style={{ display: 'flex', flex: 1, minWidth: '150px', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'rgba(59, 130, 246, 0.05)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)', color: '#60a5fa' }}>
                                            <Shield size={16} />
                                            <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>{selectedGap.securityControls.join(', ')}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            {(() => {
                                let rawPayload = selectedGap.payloadCode || selectedGap.procedureSteps || '';
                                let isPayloadCode = !!selectedGap.payloadCode;
                                if (!rawPayload && simulationSummaries) {
                                    let foundProcs = [];
                                    const gapTTPs = (selectedGap.ttp || '').split(',').map(t => t.trim()).filter(Boolean);
                                    
                                    const procMatcher = (r) => {
                                        const nameMatch = selectedGap.finding && r.name && r.name.toLowerCase() === selectedGap.finding.toLowerCase();
                                        const ttpMatch = r.ttps && gapTTPs.length > 0 && r.ttps.some(t => gapTTPs.includes(t));
                                        return nameMatch || ttpMatch;
                                    };
                                    
                                    if (selectedGap.simulation) {
                                        const simSummary = Object.values(simulationSummaries).find(s => s.name === selectedGap.simulation || s.id === selectedGap.simulation);
                                        if (simSummary && simSummary.testResults) {
                                            foundProcs = simSummary.testResults.filter(procMatcher);
                                        }
                                    }
                                    if (foundProcs.length === 0) {
                                        for (const sim of Object.values(simulationSummaries)) {
                                            if (sim.testResults) {
                                                const matches = sim.testResults.filter(procMatcher);
                                                if (matches.length > 0) {
                                                    foundProcs = matches;
                                                    break;
                                                }
                                            }
                                        }
                                    }
                                    
                                    if (foundProcs.length > 0) {
                                        const payloadCodes = foundProcs.map(r => r.payloadCode).filter(Boolean);
                                        const procSteps = foundProcs.map(r => r.procedureSteps).filter(Boolean);
                                        if (payloadCodes.length > 0) {
                                            rawPayload = payloadCodes.join('\n\n');
                                            isPayloadCode = true;
                                        } else if (procSteps.length > 0) {
                                            rawPayload = procSteps.join('\n\n');
                                            isPayloadCode = false;
                                        }
                                    }
                                }

                                return (
                                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
                                            <h3 style={{ margin: '0', fontSize: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <AlertCircle size={18} color="var(--accent-primary)" /> {selectedGap.isDefense ? 'Event Details' : 'Technical Event Details'}
                                            </h3>
                                            {rawPayload && (
                                                <button 
                                                    onClick={() => setShowGapCode(!showGapCode)} 
                                                    className="btn hover-lift" 
                                                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', padding: '6px 12px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px', borderRadius: '6px', fontWeight: 'bold' }}
                                                >
                                                    <Code size={16} /> {showGapCode ? 'Hide' : 'View'} {isPayloadCode ? 'Payload' : 'Procedure Steps'}
                                                </button>
                                            )}
                                        </div>
                                        {showGapCode && rawPayload && (
                                            <div className="animate-fade-in" style={{ background: '#0a0a0a', padding: '20px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '0.9rem', color: '#10b981', overflowX: 'auto', overflowY: 'auto', maxHeight: '300px', border: '1px solid rgba(16,185,129,0.3)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', marginBottom: '10px', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)' }}>
                                                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                                                    {rawPayload}
                                                </pre>
                                            </div>
                                        )}
                                        
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', paddingTop: '5px', marginBottom: '10px' }}>
                                            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '12px 16px' }}>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Outcome</div>
                                                <div style={{ fontSize: '1.1rem', color: (() => {
                                                    const str = selectedGap.outcome || '';
                                                    const clean = str.replace('✓', '').trim();
                                                    const finalOut = clean.includes('➔') ? clean.split('➔')[1].trim() : clean;
                                                    if (finalOut === 'Prevented & Alerted') return 'var(--success)';
                                                    if (finalOut.includes('Prevented')) return '#06b6d4';
                                                    if (finalOut === 'Alerted') return '#3b82f6';
                                                    if (finalOut.startsWith('Logged') || finalOut === 'Partial') return 'var(--warning)';
                                                    if (finalOut === 'Missed') return 'var(--danger)';
                                                    return 'var(--text-primary)';
                                                })(), fontWeight: 'bold' }}>{selectedGap.outcome || 'Unknown'}</div>
                                            </div>
                                            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '12px 16px' }}>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Coverage Rating</div>
                                                <div style={{ fontSize: '1.1rem', color: selectedGap.coverageRating === 'Optimal' ? 'var(--success)' : selectedGap.coverageRating === 'Partial' ? 'var(--warning)' : selectedGap.coverageRating === 'Minimal' ? 'var(--minimal)' : selectedGap.coverageRating === 'None' ? 'var(--danger)' : 'var(--text-primary)', fontWeight: 'bold' }}>{selectedGap.coverageRating || 'Unknown'}</div>
                                            </div>
                                        </div>

                                        {(selectedGap.details || selectedGap.finding) && (
                                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6', whiteSpace: 'pre-wrap', marginTop: '10px' }}>
                                                {String(selectedGap.details || selectedGap.finding || '').split('\n').map((line, i) => {
                                                    if (line.startsWith('Execution:')) {
                                                        return <div key={i} style={{  marginBottom: '10px', display: 'flex', gap: '12px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px'  }}><strong style={{  color: 'var(--danger)', width: '170px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px'  }}><Crosshair size={14} /> Red Team Notes:</strong> <span style={{ flex: 1, color: 'var(--text-primary)', lineHeight: '1.5' }}>{line.substring(10).trim()}</span></div>;
                                                    } else if (line.startsWith('Detection:')) {
                                                        return <div key={i} style={{  marginBottom: '10px', display: 'flex', gap: '12px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px'  }}><strong style={{  color: '#3b82f6', width: '170px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px'  }}><Shield size={14} /> Blue Team Notes:</strong> <span style={{ flex: 1, color: 'var(--text-primary)', lineHeight: '1.5' }}>{line.substring(10).trim()}</span></div>;
                                                    }
                                                    return <div key={i} style={{ marginBottom: '8px' }}>{line}</div>;
                                                })}
                                            </div>
                                        )}

                                    </div>
                                );
                            })()}

                            {selectedGap.remediation && (
                                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '20px' }}>
                                    <h3 style={{ margin: '0 0 15px 0', fontSize: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>
                                        <FileText size={18} color="var(--warning)" /> Remediation Strategy
                                    </h3>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                                        {selectedGap.remediation}
                                    </div>
                                </div>
                            )}                            {!selectedGap.isDefense && (
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                                    <button 
                                        className="btn hover-lift" 
                                        onClick={() => navigate('/gaps', { state: { openGapId: selectedGap.id } })}
                                        style={{ background: 'var(--accent-secondary)', color: '#000', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 25px', fontWeight: 'bold', fontSize: '0.95rem', boxShadow: '0 0 15px rgba(56, 189, 248, 0.4)' }}
                                    >
                                        <Zap size={18} /> Open in Gap Tracker
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>,
                document.getElementById('root')
            )}
        </div>
        </div>
        </div>
    );
}
