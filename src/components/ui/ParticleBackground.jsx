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

import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function ParticleNetwork({ mousePos }) {
  const count = 1200;
  
  const positions = useMemo(() => {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      p[i * 3] = (Math.random() - 0.5) * 60; // X
      p[i * 3 + 1] = (Math.random() - 0.5) * 60; // Y
      p[i * 3 + 2] = (Math.random() - 0.5) * 20; // Z
    }
    return p;
  }, [count]);

  const pointsRef = useRef();
  const targetRotation = useRef({ x: 0, y: 0 });

  useFrame(() => {
    if (document.hidden) return; // Strict pause on inactive tab

    if (pointsRef.current) {
      // Endless base rotation
      pointsRef.current.rotation.y += 0.0003;
      pointsRef.current.rotation.x += 0.0001;
      
      // Interactive mouse tilt calculation
      targetRotation.current.x = (mousePos.y * Math.PI) * 0.05;
      targetRotation.current.y = (mousePos.x * Math.PI) * 0.05;
      
      // Smoothly interpolate towards mouse position
      pointsRef.current.rotation.x += (targetRotation.current.x - pointsRef.current.rotation.x) * 0.05;
      pointsRef.current.rotation.y += (targetRotation.current.y - pointsRef.current.rotation.y) * 0.05;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial 
        size={0.06} 
        color="#9c27b0" 
        sizeAttenuation 
        transparent 
        opacity={0.5} 
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export default function ParticleBackground() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    // We attach the listener to the window so it detects mouse movement globally 
    // even though the Canvas has pointerEvents: 'none'
    const handleMouseMove = (e) => {
      setMousePos({
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: -(e.clientY / window.innerHeight) * 2 + 1,
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }}>
      <Canvas 
        camera={{ position: [0, 0, 15] }}
        dpr={[1, 1]} 
        gl={{ antialias: false, powerPreference: "high-performance" }}
      >
        <ParticleNetwork mousePos={mousePos} />
      </Canvas>
    </div>
  );
}
