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
        <linearGradient id="bh-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ff1b6b" />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
        
        <clipPath id="top-half">
          <rect x="0" y="0" width="24" height="12" />
        </clipPath>

        <mask id="bh-mask">
          <rect width="24" height="24" fill="white" />
          <circle cx="12" cy="12" r="3.5" fill="black" clipPath="url(#top-half)" />
        </mask>
      </defs>

      {/* 1. Concentric Circles (2 glowing rings + 1 black void) */}
      {/* Glows */}
      <circle cx="12" cy="12" r="7" stroke="url(#bh-grad)" strokeWidth="3.5" fill="none" opacity="0.4" style={{ filter: 'blur(2px)' }} />
      <circle cx="12" cy="12" r="5" stroke="url(#bh-grad)" strokeWidth="3.5" fill="none" opacity="0.4" style={{ filter: 'blur(2px)' }} />
      {/* Cores */}
      <circle cx="12" cy="12" r="7" stroke="url(#bh-grad)" strokeWidth="1.2" fill="none" />
      <circle cx="12" cy="12" r="5" stroke="url(#bh-grad)" strokeWidth="1.2" fill="none" />
      {/* Black Void */}
      <circle cx="12" cy="12" r="3.5" fill="#0a0b10" />

      {/* 2. Rings around them (Horizontal Ellipses, back-half masked out by the void) */}
      <g mask="url(#bh-mask)">
        {/* Glows */}
        <ellipse cx="12" cy="12" rx="10" ry="2.6" stroke="url(#bh-grad)" strokeWidth="3.5" fill="none" opacity="0.4" style={{ filter: 'blur(2px)' }} />
        <ellipse cx="12" cy="12" rx="8" ry="1.6" stroke="url(#bh-grad)" strokeWidth="3.5" fill="none" opacity="0.4" style={{ filter: 'blur(2px)' }} />
        {/* Cores */}
        <ellipse cx="12" cy="12" rx="10" ry="2.6" stroke="url(#bh-grad)" strokeWidth="1.2" fill="none" />
        <ellipse cx="12" cy="12" rx="8" ry="1.6" stroke="url(#bh-grad)" strokeWidth="1.2" fill="none" />
      </g>
    </svg>
  );
}
