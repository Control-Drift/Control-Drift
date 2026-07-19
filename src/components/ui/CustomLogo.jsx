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

import emblem from '../../assets/drift_emblem.png';

const LogoMark = ({ size = 32 }) => (
  <div style={{ height: size, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <img 
      src={emblem} 
      alt="Control Drift" 
      height="100%" 
      style={{ objectFit: 'contain', width: 'auto' }} 
    />
  </div>
);

export default function CustomLogo({ className = "", style = {}, iconOnly = false }) {
  if (iconOnly) {
      return (
        <div className={className} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '32px', width: 'auto', ...style }}>
          <LogoMark size={32} />
        </div>
      );
  }

  return (
    <div 
      className={className} 
      style={{ 
        display: 'flex', 
        alignItems: 'center',
        gap: '0px',
        ...style,
      }}
    >
      <LogoMark size={16} />
      
      {/* The Typography */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '6px',
        fontFamily: '"Orbitron", sans-serif',
        fontSize: '18px',
        lineHeight: 1,
      }}>
        {/* Heavy, rigid control */}
        <span style={{ 
          fontWeight: 900, 
          color: '#ffffff', 
          letterSpacing: '0.5px',
          textShadow: '0px 2px 4px rgba(0,0,0,0.5)'
        }}>
          CONTROL
        </span>
        
        {/* Light, fluid drift */}
        <span style={{ 
          fontWeight: 900, 
          letterSpacing: '0.5px',
          background: 'linear-gradient(90deg, #f43f5e 0%, #a855f7 50%, #3b82f6 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          filter: 'drop-shadow(0px 2px 8px rgba(168, 85, 247, 0.4))'
        }}>
          DRIFT
        </span>
      </div>
    </div>
  );
}
