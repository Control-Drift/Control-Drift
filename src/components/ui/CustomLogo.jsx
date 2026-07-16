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
import driftEmblem from '../../assets/drift_emblem.png';

export default function CustomLogo({ className = "", style = {}, iconOnly = false }) {
  if (iconOnly) {
      return (
          <img 
            className={className}
            src={driftEmblem} 
            alt="Control Drift Emblem" 
            style={{ 
              width: '32px', 
              height: '32px', 
              objectFit: 'contain',
              mixBlendMode: 'screen',
              flexShrink: 0,
              ...style
            }} 
          />
      );
  }

  return (
    <div 
      className={className} 
      style={{ 
        display: 'flex', 
        alignItems: 'center',
        gap: '10px',
        ...style,
      }}
    >
      {/* The Drift Emblem (AI Generated Image) */}
      <img 
        src={driftEmblem} 
        alt="Control Drift Emblem" 
        style={{ 
          width: '32px', 
          height: '32px', 
          objectFit: 'contain',
          mixBlendMode: 'screen', // Drops the black background cleanly against dark navs
          flexShrink: 0 
        }} 
      />

      {/* The Typography */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '6px',
        fontFamily: '"Orbitron", sans-serif',
        fontSize: '17px',
        lineHeight: 1,
        marginTop: '1px', // Visual baseline alignment
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
