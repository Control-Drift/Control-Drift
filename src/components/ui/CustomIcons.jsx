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

import React from 'react';

export const SatelliteStationIcon = ({ size = 24, color = "currentColor", ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
        {/* Base Building / Station */}
        <path d="M4 22h16" strokeWidth="2" />
        <path d="M6 22V16l2-2h8l2 2v6" />
        <path d="M10 22v-3h4v3" />
        
        {/* Antenna Array on side */}
        <line x1="18" y1="16" x2="18" y2="10" />
        <line x1="16" y1="12" x2="20" y2="12" />
        <circle cx="18" cy="9" r="1" fill={color} />

        {/* Pivot Joint for Main Dish */}
        <path d="M12 14v-2" />
        <circle cx="12" cy="11" r="1.5" fill={color} />
        
        {/* Massive Tilted Dish Assembly */}
        <g transform="rotate(25 12 11)">
            {/* Main Dish Bowl */}
            <path d="M3 7a9 5 0 0 0 18 0" />
            {/* 3D Dish Rim */}
            <ellipse cx="12" cy="7" rx="9" ry="2" />
            {/* Center Receiver Stem */}
            <line x1="12" y1="7" x2="12" y2="1" />
            {/* Sub-reflector */}
            <path d="M10 2 Q12 0 14 2" />
            
            {/* Transmitting Signal Waves */}
            <path d="M6 -3a8 8 0 0 1 12 0" strokeDasharray="2 3" opacity="0.6" />
            <path d="M8 -6a5 5 0 0 1 8 0" strokeDasharray="1 3" opacity="0.3" />
        </g>
    </svg>
);


export const StealthBomberIcon = ({ size = 24, color = "currentColor", ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
        {/* Northrop B-2 Spirit Shape */}
        <path d="M12 3 L2 13 L6 17 L8 15 L12 19 L16 15 L18 17 L22 13 Z" fill={color} fillOpacity="0.15" />
        {/* Cockpit / Center hump */}
        <path d="M12 3v5" opacity="0.5" />
        {/* Subtle motion lines */}
        <path d="M12 21v3" opacity="0.4" strokeDasharray="1 2" />
    </svg>
);

export const HeavyTransportIcon = ({ size = 24, color = "currentColor", ...props }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
        {/* Massive Top-Down C-17 Globemaster Silhouette */}
        <path d="M12 2 L9 5 L9 9 L2 14 L2 16 L9 13 L9 18 L5 20 L5 21 L12 22 L19 21 L19 20 L15 18 L15 13 L22 16 L22 14 L15 9 L15 5 Z" fill={color} fillOpacity="0.15" />
        {/* Fuselage Spine / Canopy */}
        <path d="M12 2v20" opacity="0.5" />
        {/* Wing details (subtle) */}
        <path d="M9 11l-3 2 M15 11l3 2" opacity="0.4" />
    </svg>
);


