import React from 'react';

export default function BlackHoleIcon({ size = 24, className = "", style = {} }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      <defs>
        <linearGradient id="blackhole-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ff1b6b" />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
        
        <linearGradient id="blackhole-grad-glow" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(255, 27, 107, 0.4)" />
          <stop offset="50%" stopColor="rgba(168, 85, 247, 0.4)" />
          <stop offset="100%" stopColor="rgba(37, 99, 235, 0.4)" />
        </linearGradient>
      </defs>

      {/* Background glow for the accretion disk */}
      <ellipse cx="12" cy="12" rx="10" ry="3" stroke="url(#blackhole-grad-glow)" strokeWidth="4" fill="none" style={{ filter: 'blur(2px)' }} />

      {/* Back half of the accretion disk */}
      <path d="M 2 12 A 10 3 0 0 1 22 12" stroke="url(#blackhole-grad)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M 4 12 A 8 2 0 0 1 20 12" stroke="url(#blackhole-grad-glow)" strokeWidth="1" strokeLinecap="round" fill="none" />

      {/* The central black hole (Event Horizon) */}
      <circle cx="12" cy="12" r="5" fill="#0a0b10" stroke="url(#blackhole-grad)" strokeWidth="1.5" />
      
      {/* Inner photon ring */}
      <circle cx="12" cy="12" r="4" stroke="url(#blackhole-grad)" strokeWidth="0.5" strokeDasharray="1 2" fill="none" />

      {/* Front half of the accretion disk */}
      <path d="M 1.5 12 A 10.5 3.5 0 0 0 22.5 12" stroke="url(#blackhole-grad)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M 3 12 A 9 2.5 0 0 0 21 12" stroke="url(#blackhole-grad)" strokeWidth="1" strokeLinecap="round" fill="none" />

      {/* Gravitational lensing arches (top and bottom) */}
      <path d="M 7.5 8.5 A 5 5 0 0 1 16.5 8.5" stroke="url(#blackhole-grad)" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.8" />
      <path d="M 8.5 15.5 A 5 5 0 0 1 15.5 15.5" stroke="url(#blackhole-grad)" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.6" />
    </svg>
  );
}
