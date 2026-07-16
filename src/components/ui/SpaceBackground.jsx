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

import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars } from '@react-three/drei';

function MovingStars() {
  const starsRef = useRef();
  
  useFrame(() => {
    if (starsRef.current) {
      starsRef.current.rotation.y += 0.0002;
      starsRef.current.rotation.x += 0.0001;
    }
  });

  return (
    <Stars 
        ref={starsRef}
        radius={50} 
        depth={50} 
        count={3000} 
        factor={3} 
        saturation={0} 
        fade 
        speed={1} 
    />
  );
}

export default function SpaceBackground() {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, pointerEvents: 'none' }}>
      <Canvas camera={{ position: [0, 0, 1] }}>
        <MovingStars />
      </Canvas>
    </div>
  );
}
