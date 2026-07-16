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

export default function VoidTraceIcon({ size = 32, className = "", style = {} }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ filter: 'drop-shadow(0 0 8px rgba(109, 40, 217, 0.4))', ...style }}
    >
      <defs>
        <linearGradient id="vtGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1d4ed8" />
          <stop offset="50%" stopColor="#6d28d9" />
          <stop offset="100%" stopColor="#be123c" />
        </linearGradient>
      </defs>
      
      {/* Stealth Bomber V (pointing down) */}
      <path 
        d="M12 21L22 6L16 8L12 5L8 8L2 6L12 21Z" 
        fill="url(#vtGradient)" 
      />
    </svg>
  );
}
