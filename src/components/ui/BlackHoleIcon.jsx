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
        
        <mask id="blackhole-mask">
          <rect width="24" height="24" fill="white" />
          <circle cx="12" cy="12" r="4.5" fill="black" />
        </mask>
      </defs>

      {/* 1. Back halves of horizontal ellipses (Masked by black hole) */}
      <g mask="url(#blackhole-mask)">
        {/* Glow */}
        <path d="M 1 12 A 11 2.5 0 0 0 23 12" stroke="url(#blackhole-grad)" strokeWidth="3.5" fill="none" opacity="0.4" style={{ filter: 'blur(2px)' }} />
        <path d="M 3.5 12 A 8.5 1.5 0 0 0 20.5 12" stroke="url(#blackhole-grad)" strokeWidth="3.5" fill="none" opacity="0.4" style={{ filter: 'blur(2px)' }} />
        {/* Core */}
        <path d="M 1 12 A 11 2.5 0 0 0 23 12" stroke="url(#blackhole-grad)" strokeWidth="1.2" strokeLinecap="round" fill="none" />
        <path d="M 3.5 12 A 8.5 1.5 0 0 0 20.5 12" stroke="url(#blackhole-grad)" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      </g>

      {/* 2. Vertical Circular Rings */}
      {/* Glow */}
      <circle cx="12" cy="12" r="8" stroke="url(#blackhole-grad)" strokeWidth="3.5" fill="none" opacity="0.4" style={{ filter: 'blur(2px)' }} />
      <circle cx="12" cy="12" r="6" stroke="url(#blackhole-grad)" strokeWidth="3.5" fill="none" opacity="0.4" style={{ filter: 'blur(2px)' }} />
      {/* Core */}
      <circle cx="12" cy="12" r="8" stroke="url(#blackhole-grad)" strokeWidth="1.2" fill="none" />
      <circle cx="12" cy="12" r="6" stroke="url(#blackhole-grad)" strokeWidth="1.2" fill="none" />

      {/* 3. Front halves of horizontal ellipses (Not masked, crosses in front) */}
      {/* Glow */}
      <path d="M 1 12 A 11 2.5 0 0 1 23 12" stroke="url(#blackhole-grad)" strokeWidth="3.5" fill="none" opacity="0.4" style={{ filter: 'blur(2px)' }} />
      <path d="M 3.5 12 A 8.5 1.5 0 0 1 20.5 12" stroke="url(#blackhole-grad)" strokeWidth="3.5" fill="none" opacity="0.4" style={{ filter: 'blur(2px)' }} />
      {/* Core */}
      <path d="M 1 12 A 11 2.5 0 0 1 23 12" stroke="url(#blackhole-grad)" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <path d="M 3.5 12 A 8.5 1.5 0 0 1 20.5 12" stroke="url(#blackhole-grad)" strokeWidth="1.2" strokeLinecap="round" fill="none" />
    </svg>
  );
}
