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

import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAppContext } from '../../AppContext';
import { X, Clock, Activity, Target, ArrowRight, Ban, RotateCcw, Search, Eye, EyeOff, Wrench, Key, Terminal, Anchor, ChevronsUp, Ghost, Unlock, Network, Package, Zap, Focus, Fingerprint, Info, Shield, ShieldAlert, ShieldCheck, PlaneTakeoff, ExternalLink, Send, LineChart as LucideLineChart, ChevronDown, ChevronRight, Siren, CornerDownRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { SatelliteStationIcon, StealthBomberIcon, HeavyTransportIcon } from '../ui/CustomIcons';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { TrackballControls, OrbitControls, Html, Stars, PerformanceMonitor } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useNavigate, useLocation } from 'react-router-dom';
import EnvironmentDropdown from '../dropdowns/EnvironmentDropdown';
import SecurityControlFilterDropdown from '../dropdowns/SecurityControlFilterDropdown';
import UnifiedPosturePill from '../ui/UnifiedPosturePill';
import { calculateAverageStatus } from '../../lib/mitreUtils';

// Subcomponents
import HeatmapHeader from './MitreHeatmap/HeatmapHeader';
import TacticsSidebar from './MitreHeatmap/TacticsSidebar';
import TacticDrilldown from './MitreHeatmap/TacticDrilldown';

/**
 * MitreHeatmap Component
 * 
 * CORE ARCHITECTURE:
 * This is a hybrid rendering component that combines a WebGL 3D Globe (using React Three Fiber)
 * with a standard DOM-based hierarchical Heatmap below it.
 * 
 * 1. WebGL Globe (`GradientSphere` / `BattleGlobe`):
 *    - Maps security coverage metrics onto a 3D sphere.
 *    - Utilizes a highly optimized custom shader and reduced vertex count (64x64) 
 *      to maintain 60FPS while rendering smooth, overlapping coverage glows.
 *    - Fallback Boundary is included for clients without hardware acceleration.
 * 
 * 2. DOM Heatmap:
 *    - Iterates over the unified `mitreData` object.
 *    - Aggregation logic dictates that a parent Tactic/Technique only receives an 'Optimal' 
 *      score if ALL of its tested sub-components are 'Optimal'. 
 *    - Clickable nodes drill down into historical simulation data.
 */

class WebGLFallbackBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '40px', background: 'rgba(20,20,20,0.5)', borderRadius: '12px', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', textAlign: 'center' }}>
          <ShieldAlert size={48} color="var(--warning)" style={{ marginBottom: '20px' }} />
          <h3 style={{ margin: '0 0 10px 0', color: 'var(--text-primary)' }}>3D Hardware Acceleration Required</h3>
          <p style={{ maxWidth: '400px', margin: 0, lineHeight: '1.5' }}>
            Your browser or device does not currently support WebGL, which is required to render the 3D Security Posture Heatmap. Please enable hardware acceleration in your browser settings to view this module.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

const statusColors = {
  high: '#10b981', // green
  medium: '#f59e0b', // yellow
  minimal: '#f97316', // orange
  low: '#ef4444', // red
  unknown: '#9ca3af', // gray
  na: '#475569',
  exception: '#a78bfa' // purple
};

const getPreventedStyle = (percentage) => {
    if (percentage >= 67) return { color: 'var(--success)', bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.2)' };
    if (percentage >= 34) return { color: 'var(--warning)', bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.2)' };
    return { color: 'var(--danger)', bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.2)' };
};

const ProgressRing = ({ radius, stroke, progress, color }) => {
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <svg
      height={radius * 2}
      width={radius * 2}
      style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}
    >
      <circle
        stroke="rgba(255,255,255,0.15)"
        fill="transparent"
        strokeWidth={stroke}
        r={normalizedRadius}
        cx={radius}
        cy={radius}
      />
      <circle
        stroke={color}
        fill="transparent"
        strokeWidth={stroke}
        strokeDasharray={circumference + ' ' + circumference}
        style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.5s ease-in-out', strokeLinecap: 'round' }}
        r={normalizedRadius}
        cx={radius}
        cy={radius}
      />
    </svg>
  );
};

function getTeamColor(time) {
  const t = (Math.sin(time) + 1) / 2;
  const hue = 186 + t * 27; // 186 (Cyan) to 213 (Blue)
  return new THREE.Color(`hsl(${Math.floor(hue)}, 100%, 50%)`);
}

function getTeamColorString(time) {
  const t = (Math.sin(time) + 1) / 2;
  const hue = 186 + t * 27; 
  return `hsl(${Math.floor(hue)}, 100%, 50%)`;
}

function GradientSphere({ nodes }) {
  const geometry = useMemo(() => {
     // Performance Fix: Reduced from 256x256 (65k vertices) to 64x64 (4k vertices).
     // This massively drops GPU load while keeping the lighting and glow visually identical.
     const geom = new THREE.SphereGeometry(6.9, 64, 64); 
     const positionAttribute = geom.getAttribute('position');
     const colors = [];
     const colorObj = new THREE.Color();
     const baseColor = new THREE.Color("#0a0816"); 

     const testedNodes = nodes.filter(n => n.color);

     for ( let i = 0; i < positionAttribute.count; i ++ ) {
       const vertex = new THREE.Vector3().fromBufferAttribute(positionAttribute, i);
       
       let r = 0, g = 0, b = 0, totalWeight = 0;
       let minTestedD = Infinity;

       for (const node of testedNodes) {
         const dist = vertex.distanceTo(node.position);
         if (dist < minTestedD) minTestedD = dist;
         
         const weight = 1.0 / Math.pow(dist + 0.05, 2.8); 
         
         let c = node.color.clone();
         c.lerp(new THREE.Color('#ffeedd'), 0.1); 
         
         if (dist < 1.5) {
            c.lerp(new THREE.Color('#fff4e6'), 0.35 * (1.5 - dist) / 1.5);
         }
         
         r += c.r * weight;
         g += c.g * weight;
         b += c.b * weight;
         totalWeight += weight;
       }
       
       if (totalWeight > 0) {
          colorObj.setRGB(r / totalWeight, g / totalWeight, b / totalWeight);
       } else {
          colorObj.copy(baseColor);
       }

       if (minTestedD > 1.8) {
          const falloff = Math.pow(Math.min(1, (minTestedD - 1.8) / 2.5), 1.5);
          colorObj.lerp(baseColor, falloff);
       }
       
       colors.push(colorObj.r, colorObj.g, colorObj.b);
     }
     
     geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
     return geom;
  }, [nodes]);

  React.useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  return (
    <mesh geometry={geometry}>
       <meshStandardMaterial 
          vertexColors={true} 
          roughness={0.15} 
          metalness={0.6} 
          emissive={"#0a0816"}
          emissiveIntensity={0.8}
       />
    </mesh>
  );
}

function PulsingWireframe({ radius }) {
  const matRef = useRef();
  
  const uniforms = useMemo(() => ({
    time: { value: 0 }
  }), []);

  useFrame((state) => {
      if (matRef.current) {
         matRef.current.uniforms.time.value = state.clock.elapsedTime;
      }
  });

  return (
    <mesh>
      <sphereGeometry args={[radius, 48, 48]} />
      <shaderMaterial 
        key="pulsing-mat-v3"
        ref={matRef}
        uniforms={uniforms}
        wireframe={true}
        transparent={true}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexShader={`
          varying vec3 vWorldPosition;
          void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * viewMatrix * worldPosition;
          }
        `}
        fragmentShader={`
          uniform float time;
          varying vec3 vWorldPosition;
          void main() {
            vec3 pos = normalize(vWorldPosition);
            
            // 1. Calculate a diagonal, wavy gradient across the sphere's surface.
            // Using a combination of x, y, z creates an angled blend instead of a simple vertical one.
            float baseGradient = (pos.y * 0.6 + pos.x * 0.3 + pos.z * 0.3) * 0.5 + 0.5;
            
            // 2. Add dynamic, swirling distortion to the gradient based on time.
            // This makes the colors look like they are shifting and swirling organically like a gas giant.
            baseGradient += sin(pos.x * 4.0 + time * 0.1) * 0.1;
            baseGradient += cos(pos.y * 3.0 - time * 0.06) * 0.1;
            
            // 3. Create a continuous wrapping phase value (t) that flows slowly over time.
            // fract() ensures the value loops perfectly between 0.0 and 1.0.
            float t = fract(baseGradient - time * 0.01);
            
            // 4. Smoothly cycle between Blue, Purple, and Red.
            // We use cosine waves mapped from [-1, 1] to [0, 1] using clamp() to create soft transitions.
            // The phase offset (t - 0.5) ensures Red and Blue peak at different times, creating Purple when they mix.
            float r = 0.2 + 0.8 * clamp(cos(6.28318 * (t - 0.5)), 0.0, 1.0); // Red channel peaks at t=0.5
            float g = 0.05; // Keep green very low to maintain the cyber aesthetic
            float b = 0.2 + 0.8 * clamp(cos(6.28318 * t), 0.0, 1.0); // Blue channel peaks at t=0.0 and t=1.0
            
            // Final output: Mix the RGB channels with a low opacity (0.25) for a glowing wireframe effect.
            gl_FragColor = vec4(r, g, b, 0.25);
          }
        `}
      />
    </mesh>
  );
}


const BomberIcon = ({ size = 24, color = "currentColor", ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M12 3 L22 15 L17 15 L12 19 L7 15 L2 15 Z" fill={color} fillOpacity="0.2" />
    <path d="M12 3 L12 19" strokeOpacity="0.5" />
  </svg>
);

const DistortionIcon = ({ size = 24, color = "currentColor", ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M3 12h3l3 -7l4 14l5 -7h3" />
    <path d="M2 5h4" />
    <path d="M18 19h4" />
  </svg>
);

const TACTIC_ICONS = {
  "Reconnaissance": Eye,
  "Resource Development": Wrench,
  "Initial Access": Key,
  "Execution": Terminal,
  "Persistence": Anchor,
  "Privilege Escalation": ChevronsUp,
  "Defense Evasion": Ghost,
  "Credential Access": Unlock,
  "Discovery": Search,
  "Lateral Movement": Network,
  "Collection": Package,
  "Command and Control": SatelliteStationIcon,
  "Exfiltration": HeavyTransportIcon,
  "Impact": Zap,
  "Defense Impairment": DistortionIcon,
  "Stealth": StealthBomberIcon
};

const TacticNode = React.memo(function TacticNode({ position, tactic, info, isActive, onClick, isVisible = true, globeRef }) {
  const color = statusColors[info.status] || statusColors.unknown;
  const [isHovered, setIsHovered] = useState(false);
  const [isOccluded, setIsOccluded] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const Icon = TACTIC_ICONS[tactic];

  useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleClick = useCallback((e) => {
     e.stopPropagation();
     onClick(tactic);
  }, [tactic, onClick]);

  const handlePointerEnter = useCallback(() => setIsHovered(true), []);
  const handlePointerLeave = useCallback(() => setIsHovered(false), []);
  
  return (
    <group position={position.clone().multiplyScalar(1.02)}>
      <Html distanceFactor={15} center zIndexRange={[100, 0]} occlude={globeRef ? [globeRef] : undefined} onOcclude={setIsOccluded}>
        <div 
          className={`tactic-node-label ${isActive ? 'active' : ''}`}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
          onClick={handleClick}
          onPointerDown={handleClick}
          style={{ 
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            color: isActive || isHovered ? '#ffffff' : '#f8fafc',
            padding: '4px 8px',
            textTransform: 'uppercase',
            letterSpacing: '2px',
            fontWeight: '900',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            textShadow: `0px 2px 4px rgba(0,0,0,0.9), 0px 0px 2px rgba(0,0,0,1), 0 0 10px ${color}`,
            transform: isHovered && !isActive ? 'scale(1.1) translateY(-4px)' : 'scale(1)',
            transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 1.2s ease-in-out',
            opacity: (!isMounted || isOccluded) ? 0 : (isVisible ? (isActive || isHovered ? 1 : 0.85) : 0.1),
            pointerEvents: (isVisible && !isOccluded) ? 'auto' : 'none',
            position: 'relative'
           }}>
          {Icon && (
             <Icon 
                 size={isActive ? 22 : 16} 
                 style={{  
                     marginBottom: '4px', 
                     transition: 'all 0.3s ease',
                     filter: `drop-shadow(0 0 6px ${color}) drop-shadow(0 0 12px ${color})`
                  }} 
                 color={isActive || isHovered ? '#ffffff' : color} 
             />
          )}
          
          <div style={{  display: 'flex', alignItems: 'center'  }}>
             {tactic}
          </div>
          
          {/* Tech HUD Underline Effect on Hover */}
          <div style={{ 
              position: 'absolute',
              bottom: 0,
              height: '1px',
              width: isHovered || isActive ? '100%' : '0%',
              backgroundColor: color,
              transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
              boxShadow: `0 0 8px ${color}`
           }}></div>
        </div>
      </Html>
    </group>
  );
});

const TechNode = React.memo(function TechNode({ node, isHovered, onClick, onHover, onUnhover, isVisible = true }) {
  const { position, info } = node;
  const color = statusColors[info.status] || statusColors.unknown;
  const isTested = info.status !== 'unknown' && info.status !== 'na';
  
  const groupRef = useRef();
  const solidMatRef = useRef();
  const wireMatRef = useRef();
  const fieldRef = useRef();
  const hoverScale = useRef(0);
  const testedFade = useRef(isTested ? 1 : 0);
  
  useFrame((state, delta) => {
    hoverScale.current = THREE.MathUtils.lerp(hoverScale.current, isHovered ? 1 : 0, delta * 12);
    testedFade.current = THREE.MathUtils.lerp(testedFade.current, isTested ? 1 : 0, delta * 8);

    if (groupRef.current) {
      const baseScale = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.15;
      groupRef.current.scale.setScalar(baseScale * Math.max(0, 1 - hoverScale.current * 1.5));
      groupRef.current.rotation.y += delta;
    }

    if (solidMatRef.current) {
      solidMatRef.current.opacity = isVisible ? testedFade.current : 0.1 * testedFade.current;
      solidMatRef.current.emissiveIntensity = testedFade.current * 6.0;
      solidMatRef.current.color.set(color);
      solidMatRef.current.emissive.set(color);
    }

    if (wireMatRef.current) {
      wireMatRef.current.opacity = isVisible ? (0.45 * (1 - testedFade.current)) : 0.08 * (1 - testedFade.current);
      wireMatRef.current.color.set(color);
      wireMatRef.current.emissive.set(color);
    }

    if (fieldRef.current) {
        fieldRef.current.rotation.y -= delta * 1.5;
        fieldRef.current.rotation.x += delta * 0.8;
        const pulse = Math.sin(state.clock.elapsedTime * 8) * 0.05;
        fieldRef.current.scale.setScalar(hoverScale.current * (1 + pulse));
        fieldRef.current.material.opacity = hoverScale.current * 0.45;
        fieldRef.current.material.color.set(color);
        fieldRef.current.material.emissive.set(color);
     }
  });

  const handleClick = useCallback((e) => {
     e.stopPropagation();
     onClick(node.techFull);
  }, [node.techFull, onClick]);

  const handlePointerOver = useCallback((e) => {
     e.stopPropagation();
     onHover(node);
     document.body.style.cursor = 'pointer';
  }, [node, onHover]);

  const handlePointerOut = useCallback((e) => {
     e.stopPropagation();
     onUnhover();
     document.body.style.cursor = 'default';
  }, [onUnhover]);

  return (
    <group position={position.clone().multiplyScalar(1.02)}>
      <mesh 
        onClick={handleClick}
        onPointerDown={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
         <sphereGeometry args={[0.08, 16, 16]} />
         <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <group ref={groupRef}>
        <mesh>
          <octahedronGeometry args={[0.035, 0]} />
          <meshStandardMaterial ref={solidMatRef} transparent depthWrite={false} />
        </mesh>
        <mesh>
           <octahedronGeometry args={[0.035, 0]} />
           <meshStandardMaterial ref={wireMatRef} wireframe transparent depthWrite={false} emissiveIntensity={1.0} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>
      
      <mesh ref={fieldRef}>
         <icosahedronGeometry args={[0.2, 1]} />
         <meshPhysicalMaterial 
            transparent 
            opacity={0} 
            wireframe 
            roughness={0}
            emissiveIntensity={1.5}
            blending={THREE.AdditiveBlending}
         />
      </mesh>
    </group>
  );
});

const MacroTechSpecks = React.memo(function MacroTechSpecks({ nodes, quickFilter }) {
  const solidRef = useRef();
  const wireRef = useRef();

  if (!nodes || nodes.length === 0) return null;

  useEffect(() => {
     if (!solidRef.current || !wireRef.current || nodes.length === 0) return;
     const dummy = new THREE.Object3D();
     const colorObj = new THREE.Color();

     nodes.forEach((n, i) => {
        const color = statusColors[n.info.status] || statusColors.unknown;
        const isTested = n.info.status !== 'unknown' && n.info.status !== 'na';
        let isVisible = true;
        if (quickFilter === 'critical') isVisible = (n.info.status === 'low' || n.info.status === 'minimal');
        if (quickFilter === 'tested') isVisible = isTested;
        if (quickFilter === 'untested') isVisible = n.info.status === 'unknown';

        const baseColor = new THREE.Color(color);
        if (!isVisible) {
           baseColor.multiplyScalar(0.02);
        } else if (isTested) {
           baseColor.multiplyScalar(8.0); // Medium bloom glow for tested nodes
        } else {
           baseColor.multiplyScalar(0.25); // Very dim translucent look for untested
        }
        colorObj.copy(baseColor);

        // Calculate positions and scales
        dummy.position.copy(n.position.clone().multiplyScalar(1.01));
        
        // Reset scales
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        solidRef.current.setMatrixAt(i, dummy.matrix);
        wireRef.current.setMatrixAt(i, dummy.matrix);

        if (isVisible) {
            if (isTested) {
                dummy.scale.set(0.03, 0.03, 0.03); // Just the right size
                dummy.updateMatrix();
                solidRef.current.setMatrixAt(i, dummy.matrix);
                solidRef.current.setColorAt(i, colorObj);
            } else {
                dummy.scale.set(0.012, 0.012, 0.012);
                dummy.updateMatrix();
                wireRef.current.setMatrixAt(i, dummy.matrix);
                wireRef.current.setColorAt(i, colorObj);
            }
        }
     });
     
     solidRef.current.instanceMatrix.needsUpdate = true;
     if (solidRef.current.instanceColor) solidRef.current.instanceColor.needsUpdate = true;
     
     wireRef.current.instanceMatrix.needsUpdate = true;
     if (wireRef.current.instanceColor) wireRef.current.instanceColor.needsUpdate = true;
  }, [nodes, quickFilter]);

  if (nodes.length === 0) return null;

  return (
     <group>
         <instancedMesh ref={solidRef} args={[null, null, nodes.length]}>
            <octahedronGeometry args={[1, 0]} />
            <meshStandardMaterial toneMapped={false} transparent opacity={1.0} depthWrite={false} />
         </instancedMesh>
         <instancedMesh ref={wireRef} args={[null, null, nodes.length]}>
            <octahedronGeometry args={[1, 0]} />
            <meshStandardMaterial toneMapped={false} transparent opacity={0.3} wireframe={true} blending={THREE.AdditiveBlending} depthWrite={false} />
         </instancedMesh>
     </group>
  );
});

function RotatingStars() {
  const groupRef = useRef();
  useFrame(() => {
    if (groupRef.current) {
      // Extremely subtle, slow drift
      groupRef.current.rotation.y -= 0.00005;
      groupRef.current.rotation.x += 0.00002;
    }
  });
  return (
    <group ref={groupRef}>
      <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} speed={0} />
    </group>
  );
}

function Scene({ mitreData, activeTactic, setActiveTactic, handleTechClick, quickFilter, events, simulationSummaries, exercisesByTtp }) {
  const radius = 7;
  const { camera } = useThree();
  const controlsRef = useRef();
  const [hoveredTech, setHoveredTech] = useState(null);
  const targetCamPosRef = useRef(new THREE.Vector3(0, 0, 18));
  const targetLookAtRef = useRef(new THREE.Vector3(0, 0, 0));
  const isTransitioningRef = useRef(false);
  
  const { tacticPoints, allTechniqueNodes } = useMemo(() => {
    const tPoints = [];
    const techNodes = [];
    const phi = Math.PI * (3 - Math.sqrt(5)); // The Golden Angle in radians (approx 137.5 degrees)
    const tactics = Object.keys(mitreData);
    const n = tactics.length;
    
    // 1. Distribute Tactics using a Fibonacci Sphere algorithm.
    // This perfectly spaces out 'n' points across the surface of a 3D sphere so they are equidistant.
    for (let i = 0; i < n; i++) {
      // Calculate the Y coordinate (height), evenly spaced from 1 (top) to -1 (bottom)
      const y = 1 - ((i * 2 + 1) / n);
      // Calculate the radius of the circular slice at this height
      const radiusAtY = Math.sqrt(1 - y * y);
      // Calculate the rotation angle around the Y axis by multiplying by the Golden Angle
      const theta = phi * i;
      
      // Convert polar coordinates to Cartesian (x,y,z) on the sphere's surface
      // Scale by the globe's radius to get the final 3D position
      const x = Math.cos(theta) * radiusAtY;
      const z = Math.sin(theta) * radiusAtY;
      const pos = new THREE.Vector3(x * radius, y * radius, z * radius);
      
      const techs = mitreData[tactics[i]].techniques;
      const tLen = techs.length;
      
      const testedTechs = techs.filter(t => t.status !== 'unknown' && t.status !== 'na');
      let blendedColor = null;
      if (testedTechs.length > 0) {
         let r = 0, g = 0, b = 0;
         for (const t of testedTechs) {
            const hex = statusColors[t.status] || statusColors.unknown;
            const c = new THREE.Color(hex);
            r += c.r; g += c.g; b += c.b;
         }
         blendedColor = new THREE.Color(r / testedTechs.length, g / testedTechs.length, b / testedTechs.length);
      }
      
      tPoints.push({
        label: tactics[i],
        position: pos,
        info: mitreData[tactics[i]],
        color: blendedColor // Will be null if completely untested
      });
      
      // 2. Distribute Techniques around their parent Tactic node using a Fermat's Spiral.
      // This creates a dense, organic circular cluster of dots around the main tactic label.
      for (let j = 0; j < tLen; j++) {
         const spiralTheta = j * 2.39996; // 137.5 degrees in radians
         const spiralRadius = Math.sqrt(j + 0.5) * 0.16; // Perfect geometric spacing for the spiral
         
         // Calculate the local 2D position on a flat plane
         const localX = Math.cos(spiralTheta) * spiralRadius;
         const localY = Math.sin(spiralTheta) * spiralRadius;
         
         // 3. Map the 2D plane onto the 3D surface of the sphere at the Tactic's location.
         // We construct a localized coordinate system (tangent and bitangent) aligned to the sphere's surface normal.
         const normal = pos.clone().normalize();
         let up = new THREE.Vector3(0, 1, 0);
         // Prevent gimbal lock if the node is exactly at the North or South pole
         if (Math.abs(normal.y) > 0.99) {
             up = new THREE.Vector3(1, 0, 0);
         }
         const tangent = new THREE.Vector3().crossVectors(up, normal).normalize();
         const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();
         
         // Apply the 2D offset along the tangent and bitangent axes, then wrap back to the sphere's radius
         const offset = tangent.multiplyScalar(localX).add(bitangent.multiplyScalar(localY));
         const techPos = pos.clone().add(offset).normalize().multiplyScalar(radius);
         
         techNodes.push({
            tactic: tactics[i],
            label: techs[j].id,
            position: techPos,
            info: techs[j],
            isTech: true,
            techFull: techs[j]
         });
      }
    }
    return { tacticPoints: tPoints, allTechniqueNodes: techNodes };
  }, [mitreData]);

  const groupRef = useRef();
  const innerGlobeRef = useRef();

  const prevActiveTacticRef = useRef(null);

  React.useEffect(() => {
     if (prevActiveTacticRef.current === activeTactic) return;
     prevActiveTacticRef.current = activeTactic;

     if (activeTactic) {
         const tacticNode = tacticPoints.find(t => t.label === activeTactic);
         if (tacticNode && groupRef.current) {
            const worldPos = tacticNode.position.clone().applyMatrix4(groupRef.current.matrixWorld);
            targetLookAtRef.current.copy(worldPos);
            
            // Calculate scale factor relative to the base radius of 7
            const scaleFactor = worldPos.length() / 7;
            // Push camera closer, scaling the zoom distance relative to the responsive scale
            // Add a little extra padding on mobile (smaller scaleFactor) so it doesn't get too cramped horizontally
            const zoomDist = 10.5 * scaleFactor + (1 - scaleFactor) * 3;
            const camTarget = worldPos.clone().normalize().multiplyScalar(zoomDist);
            targetCamPosRef.current.copy(camTarget);
            isTransitioningRef.current = true;
         }
     } else {
        targetLookAtRef.current.set(0, 0, 0);
        // Default unzoomed camera position should also respect the scale to some degree, but keep it at 16 as baseline
        targetCamPosRef.current.copy(camera.position.clone().normalize().multiplyScalar(16));
        isTransitioningRef.current = true;
     }
  }, [activeTactic, tacticPoints, camera]);

  const isInteractingRef = useRef(false);

  useFrame(() => {
    if (isTransitioningRef.current) {
       const startDir = camera.position.clone().normalize();
       const endDir = targetCamPosRef.current.clone().normalize();
       
       const qStart = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), startDir);
       const qEnd = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), endDir);
       qStart.slerp(qEnd, 0.04);
       
       const nextDir = new THREE.Vector3(0, 0, 1).applyQuaternion(qStart);
       const nextLen = THREE.MathUtils.lerp(camera.position.length(), targetCamPosRef.current.length(), 0.04);
       
       camera.position.copy(nextDir.multiplyScalar(nextLen));

       if (controlsRef.current) {
           controlsRef.current.target.lerp(targetLookAtRef.current, 0.04);
           controlsRef.current.update();
       }
       
       if (camera.position.distanceTo(targetCamPosRef.current) < 0.2 && controlsRef.current.target.distanceTo(targetLookAtRef.current) < 0.2) {
          isTransitioningRef.current = false;
       }
    } else {
       // Removed the aggressive auto-snap-back that caused flopping after panning.
       if (!activeTactic && groupRef.current) {
          groupRef.current.rotation.y += 0.0006;
          groupRef.current.rotation.x += 0.0003;
       }
    }
  });

  const onHover = useCallback((node) => {
     setHoveredTech(node);
  }, []);

  const onUnhover = useCallback(() => {
     setHoveredTech(null);
  }, []);

  return (
    <group ref={groupRef}>
      <mesh ref={innerGlobeRef}>
         <sphereGeometry args={[radius * 0.99, 64, 64]} />
         <meshBasicMaterial color="#0a0816" />
      </mesh>
      
      <PulsingWireframe radius={radius} />

      {!activeTactic && tacticPoints.map((node, i) => {
         let isVisible = true;
         if (quickFilter === 'critical') isVisible = node.info.techniques.some(t => t.status === 'low' || t.status === 'minimal');
         if (quickFilter === 'tested') isVisible = node.info.techniques.some(t => t.status !== 'unknown' && t.status !== 'na');
         if (quickFilter === 'untested') isVisible = node.info.techniques.some(t => t.status === 'unknown');

         return (
           <TacticNode 
             key={'tac-'+i} 
             position={node.position} 
             tactic={node.label} 
             info={node.info} 
             isActive={false}
             globeRef={innerGlobeRef}
             onClick={setActiveTactic} 
             isVisible={isVisible}
           />
         );
      })}
      
      {!activeTactic && <MacroTechSpecks nodes={allTechniqueNodes} quickFilter={quickFilter} />}

      {activeTactic && allTechniqueNodes.filter(t => t.tactic === activeTactic).map((node, i) => {
         let isVisible = true;
         if (quickFilter === 'critical') isVisible = (node.info.status === 'low' || node.info.status === 'minimal');
         if (quickFilter === 'tested') isVisible = node.info.status !== 'unknown' && node.info.status !== 'na';
         if (quickFilter === 'untested') isVisible = node.info.status === 'unknown';

         return (
           <TechNode 
             key={'tech-'+i} 
             node={node}
             isHovered={hoveredTech === node}
             onClick={handleTechClick} 
             onHover={onHover}
             onUnhover={onUnhover}
             isVisible={isVisible}
           />
         );
      })}

      {hoveredTech && (
        <Html position={hoveredTech.position.clone().multiplyScalar(1.05)} center zIndexRange={[100, 0]} style={{  pointerEvents: 'none'  }}>
           <div style={{ 
              background: 'rgba(5, 5, 8, 0.95)',
              padding: '16px',
              borderRadius: '12px',
              border: `1px solid ${statusColors[hoveredTech.info.status] || statusColors.unknown}`,
              whiteSpace: 'nowrap',
              boxShadow: `0 8px 32px ${statusColors[hoveredTech.info.status] || statusColors.unknown}40, inset 0 0 15px rgba(255,255,255,0.05)`,
              backdropFilter: 'blur(12px)',
              transform: 'translate(-50%, -100%) translateY(-25px)',
              color: '#fff',
              minWidth: '220px',
              animation: 'tooltipFade 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards'
            }}>
              <div style={{  display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px'  }}>
                <div style={{  fontWeight: '900', fontSize: '15px', color: statusColors[hoveredTech.info.status] || statusColors.unknown, textShadow: `0 0 10px ${statusColors[hoveredTech.info.status] || statusColors.unknown}`  }}>{hoveredTech.label}</div>
                <div style={{  display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase', background: 'rgba(255,255,255,0.1)', padding: '3px 8px', borderRadius: '4px', color: statusColors[hoveredTech.info.status] || '#fff'  }}>
                   {hoveredTech.info.status === 'unknown' ? 'Untested' : hoveredTech.info.status === 'high' ? 'Optimal Coverage' : hoveredTech.info.status === 'medium' ? 'Partial Coverage' : hoveredTech.info.status === 'minimal' ? 'Minimal Coverage' : hoveredTech.info.status === 'low' ? 'No Coverage' : hoveredTech.info.status + ' Coverage'}
                </div>
              </div>
              <div style={{  fontSize: '13px', color: '#fff', maxWidth: '280px', whiteSpace: 'normal', lineHeight: '1.4', marginBottom: '12px'  }}>{hoveredTech.info.name}</div>
              
              {(() => {
                if (hoveredTech.info.status === 'na') return null;
                const history = hoveredTech.info.history || exercisesByTtp[hoveredTech.info.id] || [];
                if (history.length === 0) return null;
                
                const outcomes = { prevented: 0, preventedAlerted: 0, alerted: 0, logged: 0, missed: 0 };
                history.forEach(e => {
                    const simName = e.simulation;
                    const simSummary = simulationSummaries[simName];
                    let countedFromRaw = false;
                    
                    if (simSummary && simSummary.testResults && simSummary.testResults.length > 0) {
                        const ttpProcs = simSummary.testResults.filter(p => {
                            if (Array.isArray(hoveredTech.info.id)) {
                                return (p.ttps || []).some(id => hoveredTech.info.id.some(sel => id === sel || id.startsWith(`${sel}.`)));
                            }
                            return (p.ttps || []).some(id => id === hoveredTech.info.id || id.startsWith(`${hoveredTech.info.id}.`));
                        });
                        if (ttpProcs.length > 0) {
                            ttpProcs.forEach(p => {
                                let out = p.outcome || '';
                                if (out.includes(' ➔ ')) out = out.split(' ➔ ')[1];
                                out = out.replace(' ✓', '').trim();
                                if (out.toLowerCase() === 'prevented & alerted') outcomes.preventedAlerted++;
                                else if (out.toLowerCase() === 'prevented') outcomes.prevented++;
                                else if (out.toLowerCase() === 'alerted' || out.toLowerCase() === 'detected') outcomes.alerted++;
                                else if (out.toLowerCase() === 'logged') outcomes.logged++;
                                else if (out.toLowerCase() === 'missed') outcomes.missed++;
                            });
                            countedFromRaw = true;
                        }
                    }
                    
                    if (!countedFromRaw) {
                        if (e.remediation && e.remediation.includes('Event:')) {
                            const eventLines = e.remediation.split('\n\n').filter(r => r.trim() && r.startsWith('Event:'));
                            if (eventLines.length > 0) {
                                eventLines.forEach(evtStr => {
                                    let out = '';
                                    const match = evtStr.match(/Event: .*? \[(.*?)\]/);
                                    if (match) out = match[1];
                                    if (!out) out = e.outcome || e.finding || '';
                                    
                                    if (out.includes(' ➔ ')) out = out.split(' ➔ ')[1];
                                    out = out.replace(' ✓', '').trim();
                                    if (out.toLowerCase() === 'prevented & alerted') outcomes.preventedAlerted++;
                                    else if (out.toLowerCase() === 'prevented') outcomes.prevented++;
                                    else if (out.toLowerCase() === 'alerted' || out.toLowerCase() === 'detected') outcomes.alerted++;
                                    else if (out.toLowerCase() === 'logged') outcomes.logged++;
                                    else if (out.toLowerCase() === 'missed') outcomes.missed++;
                                });
                                return;
                            }
                        }
                        
                        let out = e.outcome || e.finding || '';
                        if (out.includes(' ➔ ')) out = out.split(' ➔ ')[1];
                        out = out.replace(' ✓', '').trim();
                        if (out.toLowerCase() === 'prevented & alerted') outcomes.preventedAlerted++;
                        else if (out.toLowerCase() === 'prevented' || (!out && e.status === 'high')) outcomes.prevented++;
                        else if (out.toLowerCase() === 'alerted' || out.toLowerCase() === 'detected') outcomes.alerted++;
                        else if (out.toLowerCase() === 'logged' || (!out && e.status === 'medium') || (!out && e.status === 'minimal')) outcomes.logged++;
                        else if (out.toLowerCase() === 'missed' || (!out && e.status === 'low')) outcomes.missed++;
                    }
                });
                
                return (
                   <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px', marginBottom: '12px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                       <div style={{ width: '100%', fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '4px', letterSpacing: '0.5px' }}>Historical Outcomes</div>
                       {outcomes.prevented > 0 && <span style={{ fontSize: '0.65rem', background: 'rgba(0, 188, 212, 0.15)', color: 'var(--accent-secondary)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(0, 188, 212, 0.3)' }}>{outcomes.prevented} Prevented</span>}
                       {outcomes.preventedAlerted > 0 && <span style={{ fontSize: '0.65rem', background: 'rgba(16,185,129,0.15)', color: 'var(--success)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(16,185,129,0.3)' }}>{outcomes.preventedAlerted} Prevented & Alerted</span>}
                       {outcomes.alerted > 0 && <span style={{ fontSize: '0.65rem', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>{outcomes.alerted} Alerted</span>}
                       {outcomes.logged > 0 && <span style={{ fontSize: '0.65rem', background: 'rgba(245,158,11,0.15)', color: 'var(--warning)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(245,158,11,0.3)' }}>{outcomes.logged} Logged</span>}
                       {outcomes.missed > 0 && <span style={{ fontSize: '0.65rem', background: 'rgba(239,68,68,0.15)', color: 'var(--danger)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(239,68,68,0.3)' }}>{outcomes.missed} Missed</span>}
                   </div>
                );
              })()}
              
              <div style={{  display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--accent-secondary)', fontWeight: 'bold', background: 'rgba(192, 132, 252, 0.1)', padding: '6px 10px', borderRadius: '6px'  }}>
                <Target size={12} /> Click to view TTP Details
              </div>
           </div>
        </Html>
      )}
      
      <TrackballControls 
        ref={controlsRef} 
        noPan={false}
        rotateSpeed={2.5}
        zoomSpeed={1.0}
        dynamicDampingFactor={0.1}
        minDistance={2} 
        maxDistance={35} 
      />
    </group>
  );
}

const FormattedOutcome = ({ outcome, strikeThrough = false }) => {
    let safeOutcome = outcome ? String(outcome) : 'Unknown';
    safeOutcome = safeOutcome.replace(/Prevented \(No Alert\)/gi, 'Prevented');

    
    const isRetest = safeOutcome.includes('->') || safeOutcome.includes('➔');
    if (isRetest) {
        const parts = safeOutcome.split(/->|➔/);
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <FormattedOutcome outcome={parts[0].trim()} strikeThrough={true} />
                <ArrowRight size={14} color="var(--text-muted)" />
                <FormattedOutcome outcome={parts[1].trim()} />
            </div>
        );
    }
    
    let stat = 'na';
    const lower = safeOutcome.toLowerCase();
    const cleanLower = lower.replace('✓', '').trim();
    if (cleanLower === 'prevented & alerted' || cleanLower === 'optimal') stat = 'high';
    else if (cleanLower.includes('prevented')) stat = 'prevented';
    else if (cleanLower.includes('alerted')) stat = 'alerted';
    else if (cleanLower.includes('logged') || cleanLower.includes('partial')) stat = 'medium';
    else if (cleanLower.includes('missed') || cleanLower.includes('none')) stat = 'low';
    
    return <span className={`status-${stat}`} style={{ padding: '4px 10px', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: '1', textDecoration: strikeThrough ? 'line-through' : 'none', opacity: strikeThrough ? 0.7 : 1 }}>{safeOutcome.replace('✓', '').trim()}</span>;
};

const TechnicalDetails = ({ remediationStr, testResults = [], selectedTechId, fallbackCoverage }) => {
    const { mitreData } = useAppContext();
    const [expandedCodeData, setExpandedCodeData] = useState(null);

    if (!remediationStr) return null;
    const events = remediationStr.split(/(?=(?:^|\n)Event:\s+)/).map(e => e.trim()).filter(Boolean);
    
    // Fallback if the string doesn't follow the Event: [...] format
    if (events.length > 0 && !events[0].startsWith('Event:')) {
        return (
             <div style={{  margin: 0, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)'  }}>
                 {remediationStr.split('\n').map((line, i) => {
                     if (line.startsWith('Execution:')) {
                         return <div key={i} style={{  marginBottom: '8px', wordBreak: 'break-all', overflowWrap: 'anywhere'  }}><strong style={{  color: 'var(--danger)'  }}>Red Team Notes:</strong> {line.substring(10).trim()}</div>;
                     } else if (line.startsWith('Detection:')) {
                         return <div key={i} style={{  marginBottom: '8px', wordBreak: 'break-all', overflowWrap: 'anywhere'  }}><strong style={{  color: '#3b82f6'  }}>Blue Team Notes:</strong> {line.substring(10).trim()}</div>;
                     }
                     return <div key={i}>{line}</div>;
                 })}
             </div>
        );
    }

    return (
        <div style={{  display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px'  }}>
            {events.map((evt, i) => {
                let name = 'Unknown Event';
                let outcome = 'Unknown';
                let execNotes = 'No execution notes provided.';
                let detectNotes = 'No detection notes provided.';
                let expectedOutcome = null;

                const eventMatch = evt.match(/Event:\s*(.*?)(?:\s+\[(.*?)\])?(?=\n|$)/);
                if (eventMatch) {
                    name = eventMatch[1].trim();
                    if (eventMatch[2]) outcome = eventMatch[2].trim();
                }
                
                const execMatch = evt.match(/Execution:\s*([\s\S]*?)(?=\n(?:Detection:|Expected:|Event:)|$)/);
                if (execMatch) execNotes = execMatch[1].trim();
                
                const detectMatch = evt.match(/Detection:\s*([\s\S]*?)(?=\n(?:Execution:|Expected:|Event:)|$)/);
                if (detectMatch) detectNotes = detectMatch[1].trim();
                
                const expectedMatch = evt.match(/Expected:\s*([\s\S]*?)(?=\n(?:Execution:|Detection:|Event:)|$)/);
                if (expectedMatch) expectedOutcome = expectedMatch[1].trim();

                const ttpTestResults = testResults.filter(t => {
                    if (Array.isArray(selectedTechId)) {
                        return (t.ttps || []).some(id => selectedTechId.some(sel => id === sel || id.startsWith(`${sel}.`)));
                    }
                    return (t.ttps || []).some(id => id === selectedTechId || id.startsWith(`${selectedTechId}.`));
                });
                // Match by exact name to prevent mismatching if the array was deduplicated or reordered!
                const tr = ttpTestResults.find(t => t.name === name || t.name === `Event ${name}`) || ttpTestResults[i];
                const payloadCode = tr?.payloadCode;
                const procedureSteps = tr?.procedureSteps;
                
                let effectiveCoverage = tr?.coverageRating || fallbackCoverage || 'None';
                if (!tr && !fallbackCoverage) {
                    const cleanOutcome = outcome.replace('✓', '').trim();
                    if (cleanOutcome === 'Missed' || cleanOutcome === 'None') effectiveCoverage = 'None';
                    else if (cleanOutcome === 'Logged' || cleanOutcome === 'Partial') effectiveCoverage = 'Partial';
                    else if (cleanOutcome === 'Prevented' || cleanOutcome === 'Alerted' || cleanOutcome === 'Prevented & Alerted') effectiveCoverage = 'Optimal';
                }

                let subTechBadge = null;
                if (tr?.ttps) {
                    const subId = tr.ttps.find(id => {
                        if (Array.isArray(selectedTechId)) {
                            return selectedTechId.some(sel => id !== sel && id.startsWith(`${sel}.`));
                        }
                        return selectedTechId && id !== selectedTechId && id.startsWith(`${selectedTechId}.`);
                    });
                    
                    if (subId) {
                        let subName = 'Sub-Technique';
                        if (mitreData) {
                            for (const tactic of Object.values(mitreData)) {
                                const parentId = subId.split('.')[0];
                                const parentTech = tactic.techniques?.find(t => t.id === parentId);
                                if (parentTech) {
                                    const sub = parentTech.subTechniques?.find(s => s.id === subId);
                                    if (sub) {
                                        subName = sub.name;
                                        break;
                                    }
                                }
                            }
                        }
                        subTechBadge = `${subId} - ${subName}`;
                    }
                }

                return (
                    <div key={i} style={{  background: 'rgba(0,0,0,0.4)', border: '1px solid var(--glass-border)', borderRadius: '6px', padding: '12px'  }}>
                        <div style={{  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', gap: '12px'  }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                                <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem', wordBreak: 'break-word', lineHeight: '1.4' }}>{name}</strong>
                                {subTechBadge && (
                                    <span style={{ fontSize: '0.75rem', color: '#a78bfa', display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(139, 92, 246, 0.1)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(139, 92, 246, 0.2)', width: 'fit-content' }}>
                                        <CornerDownRight size={12} /> {subTechBadge}
                                    </span>
                                )}
                                {tr?.securityControls && tr.securityControls.length > 0 && (
                                    <span style={{ fontSize: '0.75rem', color: '#60a5fa', display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(59, 130, 246, 0.1)', padding: '2px 8px', borderRadius: '4px', width: 'fit-content' }}>
                                        <Shield size={12} /> {Array.isArray(tr.securityControls) ? tr.securityControls.join(', ') : tr.securityControls}
                                    </span>
                                )}
                            </div>
                            <div style={{  display: 'flex', gap: '8px', flexShrink: 0, marginTop: '2px'   }}>
                                <div title="Event Outcome" style={{ display: "inline-flex" }}><FormattedOutcome outcome={tr?.outcome || outcome} /></div>
                                <div 
                                     title="Event Coverage Rating"
                                     style={{  
                                     color: effectiveCoverage === 'Optimal' ? 'var(--success)' : 
                                            effectiveCoverage === 'Partial' ? 'var(--warning)' : 
                                            effectiveCoverage === 'Minimal' ? 'var(--minimal)' : 'var(--danger)', 
                                     fontWeight: 'bold',
                                     background: 'rgba(255,255,255,0.05)',
                                     padding: '4px 10px',
                                     borderRadius: '4px',
                                     fontSize: '0.85rem',
                                     lineHeight: '1',
                                     display: 'inline-flex',
                                     alignItems: 'center',
                                     justifyContent: 'center'
                                 }}>
                                     {effectiveCoverage === 'None' ? 'No' : effectiveCoverage} Coverage
                                 </div>
                            </div>
                        </div>
                        
                        <div style={{  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.8rem', marginBottom: (payloadCode || procedureSteps) ? '12px' : '0'  }}>
                            <div>
                                <span style={{  display: 'block', color: 'var(--danger)', fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: '4px', fontWeight: 'bold'  }}>Red Team Notes</span>
                                <span style={{ color: 'var(--text-secondary)', lineHeight: '1.4', display: 'block', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{execNotes}</span>
                            </div>
                            <div>
                                <span style={{  display: 'block', color: '#3b82f6', fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: '4px', fontWeight: 'bold'   }}>Blue Team Notes</span>
                                {detectNotes.includes('**[Validation Re-Test]**') ? (
                                    <>
                                        <span style={{ color: 'var(--text-secondary)', lineHeight: '1.4', display: 'block', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{detectNotes.split('**[Validation Re-Test]**')[0].trim()}</span>
                                        <div style={{ marginTop: '12px', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '10px', borderRadius: '6px' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success)', fontWeight: 'bold', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '6px' }}><ShieldCheck size={14} /> Validation Re-Test</span>
                                            <span style={{ display: 'block', whiteSpace: 'pre-wrap', color: 'var(--text-primary)', lineHeight: '1.4' }}>{detectNotes.split('**[Validation Re-Test]**')[1].trim()}</span>
                                        </div>
                                    </>
                                ) : (
                                    <span style={{ color: 'var(--text-secondary)', lineHeight: '1.4', display: 'block', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{detectNotes}</span>
                                )}
                            </div>
                        </div>

                        {(payloadCode || procedureSteps) && (
                            <div style={{  paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)'   }}>
                               <button onClick={() => setExpandedCodeData({ type: payloadCode ? 'Payload' : 'Procedure', content: payloadCode || procedureSteps })} className="btn hover-lift" style={{  background: 'transparent', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)', padding: '4px 10px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '5px'  }}>
                                  <Terminal size={12} /> {payloadCode ? 'View Payload' : 'View Procedure Steps'}
                               </button>
                            </div>
                        )}
                    </div>
                );
            })}


            {expandedCodeData && (
                <div className="absolute-overlay" style={{  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.2)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px'  }} onClick={() => setExpandedCodeData(null)}>
                     <div className="glass-panel animate-fade-in responsive-modal" style={{  display: 'flex', flexDirection: 'column', background: 'rgba(10, 11, 16, 0.75)', backdropFilter: 'blur(16px)', border: '1px solid var(--accent-primary)', borderRadius: '8px', maxHeight: '95%', maxWidth: '95%', overflow: 'hidden'  }} onClick={e => e.stopPropagation()}>
                         <div style={{  padding: '15px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)'  }}>
                             <h3 style={{  margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-primary)'  }}>
                                 <Terminal size={20} color="var(--accent-primary)" /> {expandedCodeData.type === 'Payload' ? 'Raw Payload' : 'Procedure Steps'}
                             </h3>
                             <button onClick={() => setExpandedCodeData(null)} style={{  background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px'  }} className="hover-lift">
                                 <X size={20} />
                             </button>
                         </div>
                         <div style={{  padding: '20px', overflowY: 'auto', flex: 1  }}>
                             <PayloadDisplay code={expandedCodeData.content} />
                         </div>
                     </div>
                </div>
            )}
        </div>
    );
};

const PayloadDisplay = ({ code }) => (
    <div className="animate-fade-in" style={{  background: '#000', padding: '15px', borderRadius: '8px', border: '1px solid var(--glass-border)', overflowX: 'auto'  }}>
        <pre style={{ margin: 0, color: '#10b981', fontFamily: 'monospace', fontSize: '0.85rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{code}</pre>
    </div>
);

import TagDropdown from '../dropdowns/TagDropdown';

/**
 * MitreHeatmap Component
 * 
 * Renders a 3D visualization of the MITRE ATT&CK Matrix using @react-three/fiber.
 * 
 * CORE LOGIC:
 * 1. Fetches raw STIX data from Mitre (via `useMitreData` hook).
 * 2. Joins the current state of `events` to determine coverage status.
 * 3. Renders a 3D grid of cubes, color-coded by the aggregated `status` of each technique.
 * 4. Includes a `WebGLFallbackBoundary` to prevent app crashes on unsupported devices.
 * 
 * NOMENCLATURE MAP:
 * - "Event": A single technique test.
 * - "Simulation": A campaign of events.
 */
const ResponsiveScale = ({ children }) => {
  const [scale, setScale] = useState(1);
  const [yOffset, setYOffset] = useState(0);
  
  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      
      let newScale = 1;
      let newYOffset = 0;
      
      if (w <= 480) { newScale = 0.45; newYOffset = 4.0; }
      else if (w <= 768 || h <= 500) { newScale = 0.55; newYOffset = 2.5; }
      else if (w <= 900 || h <= 650) { newScale = 0.65; newYOffset = 1.5; }
      else if (w <= 1100 || h <= 750) { newScale = 0.75; newYOffset = 1.0; }
      else if (w <= 1400 || h <= 900) { newScale = 0.85; newYOffset = 0.5; }
      
      setScale(newScale);
      setYOffset(newYOffset);
    };
    
    handleResize(); // Initial call
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return <group scale={scale} position={[0, yOffset, 0]}>{children}</group>;
};

export default function MitreHeatmap() {
  const { mitreData, isMitreLoading, mitreProgress, events, gaps, completeExercise, toggleTacticScope, toggleTechniqueScope, activeEnvironmentFilter, setActiveEnvironmentFilter, activeTagFilter, activeSecurityControlFilter, simulationSummaries, setActiveAiContext } = useAppContext();
  
  React.useLayoutEffect(() => {
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.style.padding = '0px';
    }
    return () => {
      if (mainContent) {
        mainContent.style.padding = '';
      }
    };
  }, []);
  
  const exercisesByTtp = useMemo(() => {
     const map = {};
     Object.values(events || {}).forEach(e => {
        if (activeTagFilter !== 'All' && !(Array.isArray(e.tags) ? e.tags.includes(activeTagFilter) : e.tags === activeTagFilter)) return;
        if (!map[e.ttp]) map[e.ttp] = [];
        map[e.ttp].push(e);
     });
     return map;
  }, [events, activeTagFilter]);

  const [activeTactic, setActiveTactic] = useState(null);
  const [selectedTech, setSelectedTech] = useState(null);
  const [activeModalTab, setActiveModalTab] = useState('history');
  const [searchTerm, setSearchTerm] = useState('');
  const [quickFilter, setQuickFilter] = useState('all');
  const [expandedTechs, setExpandedTechs] = useState(new Set());
  const [isNavigatorCollapsed, setIsNavigatorCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
     setActiveAiContext({
         view: 'Security Posture (MITRE ATT&CK Heatmap)',
         description: 'Interactive 3D visualization of the MITRE ATT&CK matrix showing technique coverage and testing status.',
         mitreCoverageSummary: mitreData ? Object.entries(mitreData).map(([tacticName, tactic]) => ({
             tactic: tacticName,
             totalTechniques: tactic.techniques.length,
             testedTechniques: tactic.techniques.filter(t => t.inScope).length
         })) : []
     });
     return () => setActiveAiContext(null);
  }, [setActiveAiContext, mitreData]);


  const handleTechClick = useCallback((tech) => {
    const history = tech.history || exercisesByTtp[tech.id] || [];
    setSelectedTech({ ...tech, tactic: activeTactic, history });
    setActiveModalTab('history');
  }, [exercisesByTtp, activeTactic]);

  const toggleDescope = (e, tech) => {
    e.stopPropagation();
    toggleTechniqueScope(tech.id, activeEnvironmentFilter);
  };

  const resolvedMitreData = useMemo(() => {
     if (!mitreData) return {};
     const resolved = JSON.parse(JSON.stringify(mitreData));
     delete resolved['Reconnaissance'];
     delete resolved['Resource Development'];
     
     for (const tactic in resolved) {
         const techs = resolved[tactic].techniques;
         let tacticPrevented = 0;
         let tacticTotal = 0;
         
         for (let i = 0; i < techs.length; i++) {
             if (activeEnvironmentFilter !== 'All') {
                 techs[i].status = techs[i].environments?.[activeEnvironmentFilter] || 'unknown';
                 techs[i].preventedCount = techs[i].preventedStats?.[activeEnvironmentFilter]?.prevented || 0;
                 techs[i].totalCount = techs[i].preventedStats?.[activeEnvironmentFilter]?.total || 0;
             } else {
                 const originalStatus = techs[i].status;
                 let tPrev = 0, tTot = 0;
                 if (techs[i].preventedStats) {
                     Object.values(techs[i].preventedStats).forEach(s => { tPrev += s.prevented; tTot += s.total; });
                 }
                 techs[i].preventedCount = tPrev;
                 techs[i].totalCount = tTot;
                 
                 const activeEnvStatuses = Object.values(techs[i].environments || {}).filter(s => s !== 'unknown' && s !== 'na');
                 if (originalStatus === 'na') {
                     techs[i].status = 'na';
                 } else if (activeEnvStatuses.length === 0) {
                     techs[i].status = Object.keys(techs[i].environments || {}).length > 0 && Object.values(techs[i].environments || {}).every(s => s === 'na') ? 'na' : 'unknown';
                 } else {
                     techs[i].status = calculateAverageStatus(activeEnvStatuses);
                 }
             }
             tacticPrevented += techs[i].preventedCount;
             tacticTotal += techs[i].totalCount;
             techs[i].preventedPercentage = techs[i].totalCount > 0 ? Math.round((techs[i].preventedCount / techs[i].totalCount) * 100) : 0;
             techs[i].hasTests = techs[i].totalCount > 0;

             if (techs[i].subTechniques) {
                 techs[i].subTechniques.forEach(sub => {
                     let subPrev = 0, subTot = 0;
                     if (sub.history) {
                         sub.history.forEach(ex => {
                             if (activeEnvironmentFilter === 'All' || (ex.environment === activeEnvironmentFilter || (Array.isArray(ex.environment) && ex.environment.includes(activeEnvironmentFilter)))) {
                                 const calcStatus = (ex.status && ex.status.toLowerCase() !== 'completed') ? ex.status : (ex.coverageRating === 'Optimal' ? 'high' : ex.coverageRating === 'Partial' ? 'medium' : ex.coverageRating === 'Minimal' ? 'minimal' : ex.coverageRating === 'None' ? 'low' : ex.coverageRating === 'N/A' ? 'na' : 'unknown');
                                 if (calcStatus === 'high' || calcStatus === 'medium' || calcStatus === 'minimal' || calcStatus === 'low') {
                                     subTot++;
                                     if (ex.outcome === 'Prevented') subPrev++;
                                 }
                             }
                         });
                     }
                     sub.preventedCount = subPrev;
                     sub.totalCount = subTot;
                     sub.preventedPercentage = subTot > 0 ? Math.round((subPrev / subTot) * 100) : 0;
                     sub.hasTests = subTot > 0;
                 });
             }
         }
         
         resolved[tactic].preventedPercentage = tacticTotal > 0 ? Math.round((tacticPrevented / tacticTotal) * 100) : 0;
         resolved[tactic].hasTests = tacticTotal > 0;

         const activeStatuses = techs.map(t => t.status).filter(s => s !== 'unknown' && s !== 'na');
         if (activeStatuses.length === 0) {
             resolved[tactic].status = techs.every(t => t.status === 'na') ? 'na' : 'unknown';
         } else {
             const allStatuses = techs.map(t => t.status);
             resolved[tactic].status = calculateAverageStatus(allStatuses);
         }
     }
     return resolved;
  }, [mitreData, activeEnvironmentFilter]);

  React.useEffect(() => {
      if (selectedTech && resolvedMitreData && selectedTech.tactic) {
          const tacticData = resolvedMitreData[selectedTech.tactic];
          if (tacticData) {
              let updatedTech = tacticData.techniques.find(t => t.id === selectedTech.id);
              if (!updatedTech) {
                  tacticData.techniques.forEach(t => {
                      if (t.subTechniques) {
                          const sub = t.subTechniques.find(s => s.id === selectedTech.id);
                          if (sub) updatedTech = sub;
                      }
                  });
              }
              if (updatedTech) {
                  const history = updatedTech.history || exercisesByTtp[updatedTech.id] || [];
                  if (updatedTech.status !== selectedTech.status || history.length !== selectedTech.history.length || JSON.stringify(history) !== JSON.stringify(selectedTech.history)) {
                      setSelectedTech(prev => ({ ...prev, ...updatedTech, history }));
                  }
              }
          }
      }
  }, [resolvedMitreData, exercisesByTtp]);

  React.useEffect(() => {
     if (location.state?.returnToTTP && !isMitreLoading && resolvedMitreData) {
         const ttpId = location.state.returnToTTP;
         const tactic = location.state.returnToTactic;
         setActiveTactic(tactic);
         
         let techObj = null;
         if (resolvedMitreData[tactic]) {
             techObj = resolvedMitreData[tactic].techniques.find(t => t.id === ttpId);
         }
         if (techObj) {
             const history = techObj.history || exercisesByTtp[ttpId] || [];
             setSelectedTech({ ...techObj, tactic, history });
         }
         
         // Clear the state using React Router so it doesn't get stuck in a loop on subsequent renders
         navigate(location.pathname, { replace: true, state: {} });
     }
  }, [location, isMitreLoading, resolvedMitreData, exercisesByTtp, navigate]);

  if (isMitreLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', width: '100%' }}>
        <div className="glass-panel animate-fade-in" style={{ padding: '50px 60px', textAlign: 'center', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '350px', background: 'rgba(15, 23, 42, 0.6)' }}>
          <Activity size={32} style={{ animation: 'pulse 2s infinite', color: 'var(--accent-primary)', marginBottom: '20px' }} />
          <h2 style={{ color: 'var(--text-primary)', margin: '0 0 10px 0', fontSize: '1.2rem', letterSpacing: '0.5px' }}>Loading MITRE ATT&CK Framework</h2>
          <p style={{ margin: '0 0 25px 0', fontSize: '0.9rem', opacity: 0.8 }}>Downloading enterprise STIX dataset...</p>
          
          {/* Progress Bar Container */}
          <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
            <div style={{ 
              position: 'absolute', top: 0, left: 0, height: '100%', 
              background: 'linear-gradient(90deg, var(--accent-primary), #8b5cf6)',
              width: `${mitreProgress || 0}%`,
              transition: 'width 0.3s ease-out',
              boxShadow: '0 0 10px var(--accent-primary)'
            }}></div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: '10px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <span>{mitreProgress || 0}%</span>
            <span>~47 MB</span>
          </div>
        </div>
      </div>
    );
  }

  if (!mitreData) {
    return (
      <div className="glass-panel animate-fade-in" style={{ padding: '60px 40px', textAlign: 'center', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <ShieldAlert size={48} style={{ marginBottom: '20px', color: 'var(--danger)' }} />
        <h2 style={{ color: 'var(--text-primary)', marginBottom: '10px' }}>ATT&CK Data Unavailable</h2>
        <p>The MITRE ATT&CK Framework could not be loaded. Please check your network connection or Data Sources settings.</p>
      </div>
    );
  }

  const activeInfo = activeTactic ? resolvedMitreData[activeTactic] : null;
  const activeTotalTechs = activeInfo ? activeInfo.techniques.filter(t => t.status !== 'na').length : 0;
  const activeTestedTechs = activeInfo ? activeInfo.techniques.filter(t => t.status !== 'unknown' && t.status !== 'na').length : 0;

  // Calculate Global Micro-Metrics for Header (Tested TTPs)
  const processedTTPs = new Set();
  if (gaps) {
      gaps.forEach(g => {
          if (activeEnvironmentFilter === 'All' || (Array.isArray(g.environment) ? g.environment.includes(activeEnvironmentFilter) : g.environment === activeEnvironmentFilter)) {
              if (g.ttp) {
                  g.ttp.split(',').forEach(t => {
                      if (t.trim()) processedTTPs.add(t.trim());
                  });
              }
          }
      });
  }
  if (resolvedMitreData && Object.keys(resolvedMitreData).length > 0) {
      Object.keys(resolvedMitreData).forEach(tactic => {
          if (tactic === 'Reconnaissance' || tactic === 'Resource Development') return;
          resolvedMitreData[tactic].techniques.forEach(tech => {
              if (tech.environments?.[activeEnvironmentFilter] !== 'na') {
                  if (tech.status && tech.status !== 'unknown' && tech.status !== 'na') {
                      processedTTPs.add(tech.id);
                  }
                  if (tech.subTechniques) {
                      tech.subTechniques.forEach(sub => {
                          if (sub.hasTests) {
                              processedTTPs.add(sub.id);
                          }
                      });
                  }
              }
          });
      });
  }
  const dashboardTotalValidated = processedTTPs.size;

  const openGapsCount = gaps.filter(g => g.status === 'Open' || g.status === 'In Progress').length;

  let mitreCoveragePercentage = 0;
  let testedInScopeCount = 0;
  if (resolvedMitreData && Object.keys(resolvedMitreData).length > 0) {
      let totalInScope = 0;
      Object.keys(resolvedMitreData).forEach(tacticName => {
          if (tacticName === 'Reconnaissance' || tacticName === 'Resource Development') return;
          resolvedMitreData[tacticName].techniques.forEach(tech => {
              if (tech.environments?.[activeEnvironmentFilter] !== 'na') {
                  totalInScope++;
                  if (tech.status !== 'unknown' && tech.status !== 'na') testedInScopeCount++;
              }
          });
      });
      if (totalInScope > 0) mitreCoveragePercentage = Math.round((testedInScopeCount / totalInScope) * 100);
  }

  return (
    <div className="mitre-heatmap-root" style={{ position: 'relative', width: '100%', flex: 1, minHeight: 0, background: 'radial-gradient(circle at center, #0a0b12 0%, #030305 100%)', overflow: 'hidden' }}>
      {/* UI Overlay for Header & Left Sidebar */}
      <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, right: 0, pointerEvents: 'none', display: 'flex', flexDirection: 'column', zIndex: 1000 }}>
         <HeatmapHeader 
           activeTactic={activeTactic}
           setActiveTactic={setActiveTactic}
           activeInfo={activeInfo}
           mitreCoveragePercentage={mitreCoveragePercentage}
           dashboardTotalValidated={dashboardTotalValidated}
         />

      {/* Tactics Quick-Nav Sidebar */}
      <TacticsSidebar
        activeTactic={activeTactic}
        setActiveTactic={setActiveTactic}
        isNavigatorCollapsed={isNavigatorCollapsed}
        setIsNavigatorCollapsed={setIsNavigatorCollapsed}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        quickFilter={quickFilter}
        setQuickFilter={setQuickFilter}
        resolvedMitreData={resolvedMitreData}
        statusColors={statusColors}
      />
      </div>

      <WebGLFallbackBoundary>
        <div className="globe-container" style={{ width: '100%', height: '100%' }}>
          <Canvas 
            dpr={[1, 1]} 
            camera={{ position: [0, 0, 16], fov: 60 }}
            gl={{ antialias: false, powerPreference: "high-performance" }}
          >
            <ambientLight intensity={1.5} />
            <pointLight position={[10, 10, 10]} intensity={3.5} color="#ffffff" />
            <pointLight position={[-10, -10, -10]} intensity={3} color="var(--accent-primary)" />
            <RotatingStars />
            
            <ResponsiveScale>
              <Scene mitreData={resolvedMitreData} activeTactic={activeTactic} setActiveTactic={setActiveTactic} handleTechClick={handleTechClick} quickFilter={quickFilter} events={events} simulationSummaries={simulationSummaries} exercisesByTtp={exercisesByTtp} />
            </ResponsiveScale>
            
            <EffectComposer disableNormalPass>
              <Bloom luminanceThreshold={0.15} luminanceSmoothing={0.85} height={300} intensity={2.0} />
            </EffectComposer>
          </Canvas>
        </div>
      </WebGLFallbackBoundary>

      {/* Expanded Tactic Details Panel */}
      <TacticDrilldown
        activeInfo={activeInfo}
        activeTactic={activeTactic}
        setActiveTactic={setActiveTactic}
        TACTIC_ICONS={TACTIC_ICONS}
        statusColors={statusColors}
        toggleTacticScope={toggleTacticScope}
        exercisesByTtp={exercisesByTtp}
        simulationSummaries={simulationSummaries}
        searchTerm={searchTerm}
        handleTechClick={handleTechClick}
        toggleDescope={toggleDescope}
      />

      {/* Historical Event Modal */}
      {selectedTech && (
        <div className="animate-fade-in ttp-modal-container" style={{  background: 'rgba(0,0,0,0.2)', zIndex: 3000  }}>
          <div className="glass-panel ttp-modal" style={{ pointerEvents: 'auto', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)', border: '1px solid var(--accent-primary)', boxShadow: '0 0 40px rgba(156, 39, 176, 0.2)', boxSizing: 'border-box'  }}>
            <div style={{  padding: '24px 30px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: 'linear-gradient(180deg, rgba(156, 39, 176, 0.08) 0%, transparent 100%)', flexShrink: 0  }}>
               <div style={{  display: 'flex', alignItems: 'flex-start', gap: '16px', flex: 1  }}>
                   <div style={{  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center'  }}>
                       <Fingerprint size={24} color="var(--accent-secondary)" />
                   </div>
                   <div style={{  display: 'flex', flexDirection: 'column', gap: '12px', flex: 1  }}>
                       <div>
                           <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                               <h2 style={{  margin: 0, color: '#fff', fontSize: '1.5rem', fontFamily: 'monospace', letterSpacing: '1px'  }}>{selectedTech.id}</h2>
                               <div style={{  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: '600', letterSpacing: '0.5px', textTransform: 'uppercase', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '6px', border: `1px solid ${statusColors[selectedTech.status] || '#fff'}60`, color: statusColors[selectedTech.status] || '#fff'  }}>
                                 {selectedTech.status === 'unknown' ? 'Untested' : selectedTech.status === 'high' ? 'Optimal Coverage' : selectedTech.status === 'medium' ? 'Partial Coverage' : selectedTech.status === 'minimal' ? 'Minimal Coverage' : selectedTech.status === 'low' ? 'No Coverage' : selectedTech.status}
                               </div>
                           </div>
                           <h3 style={{  margin: '8px 0 0 0', color: 'var(--text-primary)', fontSize: '1.2rem', fontWeight: '500'  }}>{selectedTech.name}</h3>
                           <p style={{  margin: '4px 0 0 0', color: 'var(--accent-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.8  }}>
                               {selectedTech.tactic} {selectedTech.id.includes('.') ? ` • Sub-Technique of ${resolvedMitreData[selectedTech.tactic]?.techniques.find(t => t.id === selectedTech.id.split('.')[0])?.name || selectedTech.id.split('.')[0]}` : ''}
                           </p>
                       </div>
                   </div>
               </div>
               <button onClick={() => { setSelectedTech(null); setActiveModalTab('history'); }} className="btn hover-lift" style={{  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px', borderRadius: '8px', color: 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0  }}>
                 <X size={20} />
               </button>
            </div>


            
            <div style={{  padding: '25px', overflowY: 'auto', flex: 1, minHeight: 0  }}>
                <div className="animate-fade-in">
                    {selectedTech.status === 'na' ? (
                        <div style={{  padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px dashed var(--glass-border)'  }}>
                        <p style={{  margin: 0  }}>This technique is explicitly marked as out of scope. Test outcomes are disassociated.</p>
                        </div>
                    ) : selectedTech.history.length === 0 ? (
                        <div style={{  padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px dashed var(--glass-border)'  }}>
                        <p style={{  margin: 0  }}>No historical testing data found for this technique.</p>
                        </div>
                    ) : (
                        <div style={{  display: 'flex', flexDirection: 'column', gap: '15px'  }}>
                        {(() => {
                            const techOutcomes = { preventedNoAlert: 0, alerted: 0, preventedAlerted: 0, logged: 0, missed: 0 };
                            
                            selectedTech.history.forEach(e => {
                                
                                const simName = e.simulation;
                                const simSummary = simulationSummaries[simName];
                                let countedFromRaw = false;
                                
                                if (simSummary && simSummary.testResults && simSummary.testResults.length > 0) {
                                    const ttpProcs = simSummary.testResults.filter(p => {
                                        if (Array.isArray(selectedTech.id)) {
                                            return (p.ttps || []).some(id => selectedTech.id.some(sel => id === sel || id.startsWith(`${sel}.`)));
                                        }
                                        return (p.ttps || []).some(id => id === selectedTech.id || id.startsWith(`${selectedTech.id}.`));
                                    });
                                    if (ttpProcs.length > 0) {
                                        ttpProcs.forEach(p => {
                                            let out = p.outcome || '';
                                            const parts = out.split(/->|➔/);
                                            out = parts[parts.length - 1].replace(' ✓', '').replace('✓', '').trim();
                                            
                                            if (out.toLowerCase() === 'prevented & alerted') techOutcomes.preventedAlerted++;
                                            else if (out.toLowerCase() === 'prevented') techOutcomes.preventedNoAlert++;
                                            else if (out.toLowerCase() === 'alerted' || out.toLowerCase() === 'detected') techOutcomes.alerted++;
                                            else if (out.toLowerCase() === 'logged') techOutcomes.logged++;
                                            else if (out.toLowerCase() === 'missed') techOutcomes.missed++;
                                        });
                                        countedFromRaw = true;
                                    }
                                }
                                
                                if (!countedFromRaw) {
                                    if (e.remediation && e.remediation.includes('Event:')) {
                                        const eventLines = e.remediation.split('\n\n').filter(r => r.trim() && r.startsWith('Event:'));
                                        if (eventLines.length > 0) {
                                            eventLines.forEach(evtStr => {
                                                let out = '';
                                                const match = evtStr.match(/Event: .*? \[(.*?)\]/);
                                                if (match) out = match[1];
                                                if (!out) out = e.outcome || e.finding || '';
                                                
                                                const parts = out.split(/->|➔/);
                                                out = parts[parts.length - 1].replace(' ✓', '').replace('✓', '').trim();
                                                
                                                if (out.toLowerCase() === 'prevented & alerted') techOutcomes.preventedAlerted++;
                                                else if (out.toLowerCase() === 'prevented') techOutcomes.preventedNoAlert++;
                                                else if (out.toLowerCase() === 'alerted' || out.toLowerCase() === 'detected') techOutcomes.alerted++;
                                                else if (out.toLowerCase() === 'logged') techOutcomes.logged++;
                                                else if (out.toLowerCase() === 'missed') techOutcomes.missed++;
                                            });
                                            return;
                                        }
                                    }
                                    
                                    let out = e.outcome || e.finding || '';
                                    const parts = out.split(/->|➔/);
                                    out = parts[parts.length - 1].replace(' ✓', '').replace('✓', '').trim();
                                    
                                    if (out.toLowerCase() === 'prevented & alerted') techOutcomes.preventedAlerted++;
                                    else if (out.toLowerCase() === 'prevented' || (!out && e.status === 'high')) techOutcomes.preventedNoAlert++;
                                    else if (out.toLowerCase() === 'alerted' || out.toLowerCase() === 'detected') techOutcomes.alerted++;
                                    else if (out.toLowerCase() === 'logged' || (!out && e.status === 'medium') || (!out && e.status === 'minimal')) techOutcomes.logged++;
                                    else if (out.toLowerCase() === 'missed' || (!out && e.status === 'low')) techOutcomes.missed++;
                                }
                            });

                            const Pill = ({ icon: Icon, count, label, pillColor, pillBg, border }) => {
                                const active = count > 0;
                                if (!active) return null;
                                return (
                                    <span style={{ 
                                        display: 'inline-flex', alignItems: 'center', gap: '6px', 
                                        fontSize: '0.75rem', fontWeight: 'bold', 
                                        background: pillBg, 
                                        color: pillColor, 
                                        padding: '4px 10px', borderRadius: '20px', 
                                        border: border, 
                                        boxShadow: `0 2px 10px ${pillBg}`, 
                                        height: 'auto',
                                        width: 'max-content',
                                        letterSpacing: '0.5px'
                                    }}>
                                        <Icon size={12} strokeWidth={2.5} /> {count} {label}
                                    </span>
                                );
                            };

                            return (
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '15px', margin: '0 0 10px 0' }}>
                                        <h4 style={{ margin: 0, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}><Clock size={18} /> Simulation History</h4>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                            <Pill icon={Shield} count={techOutcomes.preventedNoAlert} label="Prevented" pillColor="var(--accent-secondary)" pillBg="rgba(0, 188, 212, 0.12)" border="1px solid rgba(0, 188, 212, 0.25)" />
                                            <Pill icon={Siren} count={techOutcomes.alerted} label="Alerted" pillColor="#3b82f6" pillBg="rgba(59, 130, 246, 0.12)" border="1px solid rgba(59, 130, 246, 0.25)" />
                                            <Pill icon={ShieldCheck} count={techOutcomes.preventedAlerted} label="Prevented & Alerted" pillColor="var(--success)" pillBg="rgba(16, 185, 129, 0.12)" border="1px solid rgba(16, 185, 129, 0.25)" />
                                            <Pill icon={Info} count={techOutcomes.logged} label="Logged" pillColor="var(--warning)" pillBg="rgba(245, 158, 11, 0.12)" border="1px solid rgba(245, 158, 11, 0.25)" />
                                            <Pill icon={EyeOff} count={techOutcomes.missed} label="Missed" pillColor="var(--danger)" pillBg="rgba(239, 68, 68, 0.12)" border="1px solid rgba(239, 68, 68, 0.25)" />
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                        {(() => {
                            const groupedHistory = {};
                            selectedTech.history.forEach(ex => {
                                if (!groupedHistory[ex.simulation]) {
                                    groupedHistory[ex.simulation] = {
                                        ...ex,
                                        ttps: [ex.ttp],
                                        remediationStrs: ex.remediation ? [ex.remediation] : []
                                    };
                                } else {
                                    if (!groupedHistory[ex.simulation].ttps.includes(ex.ttp)) {
                                        groupedHistory[ex.simulation].ttps.push(ex.ttp);
                                    }
                                    if (ex.remediation && !groupedHistory[ex.simulation].remediationStrs.includes(ex.remediation)) {
                                        groupedHistory[ex.simulation].remediationStrs.push(ex.remediation);
                                    }
                                }
                            });
                            
                            const finalHistory = Object.values(groupedHistory).map(g => ({
                                ...g,
                                remediation: g.remediationStrs.join('\n\n')
                            })).sort((a, b) => new Date(b.date) - new Date(a.date));

                            return finalHistory.map((ex, i) => (
                                <div key={i} className="glass-panel" style={{  padding: '20px', background: 'rgba(255,255,255,0.02)'  }}>
                                <div style={{  display: 'flex', justifyContent: 'space-between', marginBottom: '15px', paddingBottom: '10px', borderBottom: '1px solid var(--glass-border)'  }}>
                                    <div style={{ flex: 1, paddingRight: '15px' }}>
                                    <strong style={{  color: 'var(--text-primary)', fontSize: '1.1rem', display: 'block', marginBottom: '8px', lineHeight: '1.4'  }}>
                                        {ex.simulation}
                                    </strong>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start' }}>
                                        {ex.ttps.filter(id => id !== selectedTech.id).map(ttp => (
                                            <span key={ttp} style={{ fontSize: '0.75rem', background: 'rgba(156, 39, 176, 0.15)', border: '1px solid var(--accent-primary)', color: '#fff', padding: '4px 10px', borderRadius: '6px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                ↳ {ttp} {selectedTech.subTechniques?.find(s => s.id === ttp)?.name ? `- ${selectedTech.subTechniques.find(s => s.id === ttp).name}` : ''}
                                            </span>
                                        ))}
                                        <span style={{  fontSize: '0.85rem', color: 'var(--text-muted)'  }}>{new Date(ex.date).toLocaleString()}</span>
                                    </div>
                                    </div>
                                    <div style={{  display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px'  }}>
                                        <div style={{  display: 'flex', gap: '8px'  }}>
                                        <button onClick={() => navigate('/reports', { state: { simulation: ex.simulation, fromPosture: true, returnToTTP: selectedTech.id, returnToTactic: selectedTech.tactic } })} className="btn" style={{  background: 'transparent', border: '1px solid var(--accent-secondary)', color: 'var(--accent-secondary)', padding: '4px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '5px'  }}>
                                        View Simulation Report <ArrowRight size={12} />
                                        </button>
                                    </div>
                                    </div>
                                </div>

                                <div style={{  fontSize: '0.9rem', lineHeight: '1.6', marginTop: '10px'  }}>
                                    <p style={{  margin: '0 0 5px 0'  }}><strong style={{  color: 'var(--text-secondary)'  }}>Technical Details:</strong></p>
                                    <TechnicalDetails remediationStr={ex.remediation} testResults={simulationSummaries?.[ex.simulation]?.testResults || []} selectedTechId={ex.ttp || ex.ttps} fallbackCoverage={ex.coverageRating || (activeInfo.status === 'medium' ? 'Partial' : activeInfo.status === 'high' ? 'Optimal' : activeInfo.status === 'minimal' ? 'Minimal' : activeInfo.status === 'low' ? 'None' : undefined)} />
                                </div>
                                </div>
                            ));
                        })()}
                        </div>
                    )}
                </div>
            </div>
            
            <div style={{  padding: '20px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.2)'  }}>
               <button className="btn" onClick={() => setSelectedTech(null)}>Close Viewer</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
