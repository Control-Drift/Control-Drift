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

import React, { useEffect, useRef } from 'react';

export default function BattleGlobe({ ratio }) {
  const containerRef = useRef(null);
  const stop1Ref = useRef(null);
  const stop2Ref = useRef(null);
  const stop3Ref = useRef(null);
  const redTextRef = useRef(null);
  const blueTextRef = useRef(null);

  const currentRatioRef = useRef(ratio);

  const isVisibleRef = useRef(true);

  useEffect(() => {
    let animationFrameId;

    const step = (timestamp) => {
      // Strictly pause rendering logic if not visible or tab inactive
      if (!isVisibleRef.current || document.hidden) {
         animationFrameId = window.requestAnimationFrame(step);
         return;
      }

      // Continuous smooth interpolation
      currentRatioRef.current += (ratio - currentRatioRef.current) * 0.015;
      
      const redPercent = currentRatioRef.current * 100;
      const blendStart = Math.max(0, redPercent - 15);
      const blendEnd = Math.min(100, redPercent + 15);

      // Direct DOM Updates
      if (stop1Ref.current) stop1Ref.current.setAttribute('offset', `${blendStart}%`);
      if (stop3Ref.current) stop3Ref.current.setAttribute('offset', `${blendEnd}%`);
      if (redTextRef.current) redTextRef.current.textContent = Math.round(redPercent);
      if (blueTextRef.current) blueTextRef.current.textContent = Math.round(100 - redPercent);
      
      if (containerRef.current) {
         containerRef.current.style.filter = `drop-shadow(0 0 20px rgba(255, 0, 85, ${currentRatioRef.current})) drop-shadow(0 0 20px rgba(0, 71, 171, ${(1-currentRatioRef.current)}))`;
      }

      animationFrameId = window.requestAnimationFrame(step);
    };
    
    animationFrameId = window.requestAnimationFrame(step);
    
    // Setup Intersection Observer
    const observer = new IntersectionObserver((entries) => {
      isVisibleRef.current = entries[0].isIntersecting;
    }, { threshold: 0.01 });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    // Handle tab visibility
    const handleVisibilityChange = () => {
       if (document.hidden) {
          isVisibleRef.current = false;
       } else {
          // Re-check intersection if it becomes visible
          // The observer will handle the true state, but we can optimistically resume
          isVisibleRef.current = true;
       }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
       if (animationFrameId) window.cancelAnimationFrame(animationFrameId);
       observer.disconnect();
       document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [ratio]);

  // Exact requested colors
  const CRIMSON = '#FF0055'; // Neon Red/Pink
  const PURPLE = '#B100FF';  // Neon Purple (unused now)
  const COBALT = '#0047AB';  // Classic Cobalt Blue

  // High-density grid intervals
  const radii = [8, 16, 24, 32, 40, 48, 56, 64, 72, 80];

  // Raw target ratio for text 
  const targetRedPercent = ratio * 100;
  const targetBluePercent = 100 - targetRedPercent;

  return (
    <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '30px', position: 'relative' }}>
      
      {/* Left Metric */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', color: CRIMSON, textShadow: `0 0 15px ${CRIMSON}`, borderRight: `2px solid ${CRIMSON}50`, paddingRight: '15px' }}>
         <span style={{ fontSize: '0.75rem', fontWeight: '900', letterSpacing: '2px', textTransform: 'uppercase' }}>Red Team</span>
         <span style={{ fontSize: '2rem', fontWeight: '900', transition: 'all 0.5s ease', lineHeight: '1' }}><span ref={redTextRef}>{Math.round(targetRedPercent)}</span><span style={{fontSize: '1rem'}}>%</span></span>
      </div>

      <div 
        ref={containerRef}
        className="animate-globe-wobble"
        style={{
          width: '120px',
          height: '120px',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent'
        }}
      >
         
         {/* WAVY FLUIDS CONFINED TO STATIC HIGH-RES WIREFRAME */}
         <svg width="120" height="120" viewBox="0 0 180 180" style={{ position: 'absolute', inset: 0, zIndex: 1, overflow: 'visible' }}>
            <defs>
               <filter id="wavy-boundary" x="-50%" y="-50%" width="200%" height="200%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="1" result="noise" />
                  <feDisplacementMap in="SourceGraphic" in2="noise" scale="35" xChannelSelector="R" yChannelSelector="G" />
               </filter>

               <linearGradient id="fluid-grad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="180" y2="0">
                  <stop offset="0%" stopColor={CRIMSON} />
                  <stop ref={stop1Ref} stopColor={CRIMSON} />
                  <stop ref={stop3Ref} stopColor={COBALT} />
                  <stop offset="100%" stopColor={COBALT} />
               </linearGradient>

               <mask id="globe-grid" maskUnits="userSpaceOnUse" x="-100" y="-100" width="380" height="380">
                  <g stroke="white" strokeWidth="0.85" fill="none" transform="translate(90, 90)">
                     <animateTransform attributeName="transform" type="rotate" values="0; 360" dur="180s" repeatCount="indefinite" additive="sum" />
                     <circle cx="0" cy="0" r="88" strokeWidth="1.5" />
                     {radii.map(r => <ellipse key={`lat-${r}`} cx="0" cy="0" rx="88" ry={r} />)}
                     <line x1="-88" y1="0" x2="88" y2="0" />
                     {radii.map(r => <ellipse key={`lon-${r}`} cx="0" cy="0" rx={r} ry="88" />)}
                     <line x1="0" y1="-88" x2="0" y2="88" />
                  </g>
               </mask>
            </defs>
            
            <rect x="-100" y="-100" width="380" height="380" fill="url(#fluid-grad)" filter="url(#wavy-boundary)" mask="url(#globe-grid)" opacity="0.95">
                <animateTransform attributeName="transform" type="translate" values="-8,-4; 8,4; -8,-4" dur="40s" repeatCount="indefinite" />
            </rect>
         </svg>
      </div>

      {/* Right Metric */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', color: COBALT, textShadow: `0 0 15px ${COBALT}`, borderLeft: `2px solid ${COBALT}50`, paddingLeft: '15px' }}>
         <span style={{ fontSize: '0.75rem', fontWeight: '900', letterSpacing: '2px', textTransform: 'uppercase' }}>Blue Team</span>
         <span style={{ fontSize: '2rem', fontWeight: '900', transition: 'all 0.5s ease', lineHeight: '1' }}><span ref={blueTextRef}>{Math.round(targetBluePercent)}</span><span style={{fontSize: '1rem'}}>%</span></span>
      </div>

    </div>
  );
}
