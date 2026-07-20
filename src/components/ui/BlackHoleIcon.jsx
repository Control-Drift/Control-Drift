import React from 'react';

export default function BlackHoleIcon({ size = 24, className = "", style = {} }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 28 28" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
    >
      <defs>
        <linearGradient id="bh-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ff1b6b" />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
        
        <mask id="bh-mask">
          <rect width="28" height="28" fill="white" />
          {/* A precise path covering only the top half of the central void to mask out the back ellipses */}
          <path d="M 9.5 14 A 4.5 4.5 0 0 1 18.5 14 Z" fill="black" />
        </mask>
      </defs>

      {/* 1. Concentric Circles (2 glowing rings + 1 black void) */}
      {/* Glows */}
      <circle cx="14" cy="14" r="8.5" stroke="url(#bh-grad)" strokeWidth="3.5" fill="none" opacity="0.4" style={{ filter: 'blur(2px)' }} />
      <circle cx="14" cy="14" r="6.5" stroke="url(#bh-grad)" strokeWidth="3.5" fill="none" opacity="0.4" style={{ filter: 'blur(2px)' }} />
      {/* Cores */}
      <circle cx="14" cy="14" r="8.5" stroke="url(#bh-grad)" strokeWidth="1.2" fill="none" />
      <circle cx="14" cy="14" r="6.5" stroke="url(#bh-grad)" strokeWidth="1.2" fill="none" />
      {/* Black Void */}
      <circle cx="14" cy="14" r="4.5" fill="#0a0b10" />

      {/* 2. Rings around them (Horizontal Ellipses, back-half masked out by the void) */}
      <g mask="url(#bh-mask)">
        {/* Glows */}
        <ellipse cx="14" cy="14" rx="12" ry="3.5" stroke="url(#bh-grad)" strokeWidth="3.5" fill="none" opacity="0.4" style={{ filter: 'blur(2px)' }} />
        <ellipse cx="14" cy="14" rx="9.5" ry="2" stroke="url(#bh-grad)" strokeWidth="3.5" fill="none" opacity="0.4" style={{ filter: 'blur(2px)' }} />
        {/* Cores */}
        <ellipse cx="14" cy="14" rx="12" ry="3.5" stroke="url(#bh-grad)" strokeWidth="1.2" fill="none" />
        <ellipse cx="14" cy="14" rx="9.5" ry="2" stroke="url(#bh-grad)" strokeWidth="1.2" fill="none" />
      </g>
    </svg>
  );
}
