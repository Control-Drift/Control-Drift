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
      </defs>

      {/* Back halves of the accretion disk rings (drawn behind black hole) -> TOP HALF -> Sweep 0 */}
      <path d="M 1 12 A 11 3.5 0 0 0 23 12" stroke="url(#blackhole-grad)" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.6" />
      <path d="M 3 12 A 9 2.5 0 0 0 21 12" stroke="url(#blackhole-grad)" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.8" />
      <path d="M 5 12 A 7 1.5 0 0 0 19 12" stroke="url(#blackhole-grad)" strokeWidth="1.5" strokeLinecap="round" fill="none" />

      {/* The central black hole (Event Horizon) */}
      <circle cx="12" cy="12" r="4.5" fill="#0a0b10" stroke="url(#blackhole-grad)" strokeWidth="1.5" />

      {/* Front halves of the accretion disk rings (drawn in front of black hole) -> BOTTOM HALF -> Sweep 1 */}
      <path d="M 1 12 A 11 3.5 0 0 1 23 12" stroke="url(#blackhole-grad)" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.6" />
      <path d="M 3 12 A 9 2.5 0 0 1 21 12" stroke="url(#blackhole-grad)" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.8" />
      <path d="M 5 12 A 7 1.5 0 0 1 19 12" stroke="url(#blackhole-grad)" strokeWidth="1.5" strokeLinecap="round" fill="none" />

      {/* Gravitational lensing rings (top) -> TOP HALF -> Sweep 0 */}
      <path d="M 8 7.5 A 4 4 0 0 0 16 7.5" stroke="url(#blackhole-grad)" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.9" />
      <path d="M 9.5 5.5 A 2.5 2.5 0 0 0 14.5 5.5" stroke="url(#blackhole-grad)" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.5" />
      
      {/* Gravitational lensing rings (bottom) -> BOTTOM HALF -> Sweep 1 */}
      <path d="M 8 16.5 A 4 4 0 0 1 16 16.5" stroke="url(#blackhole-grad)" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.9" />
      <path d="M 9.5 18.5 A 2.5 2.5 0 0 1 14.5 18.5" stroke="url(#blackhole-grad)" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.5" />
    </svg>
  );
}
