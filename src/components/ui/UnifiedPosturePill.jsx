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
import { AlertTriangle } from 'lucide-react';

const UnifiedPosturePill = ({ outcome, coverage }) => {
    const effectiveCoverage = coverage;
    const cleanOutcome = outcome ? outcome.replace(/ z" .* o"/g, '').trim() : '';
    
    if (!effectiveCoverage) return null;
    
    // Normalize outcome to ensure 'Untested' or 'Unknown' are handled cleanly
    const safeOutcome = outcome || (effectiveCoverage === 'Optimal' ? 'Prevented' : effectiveCoverage === 'Partial' ? 'Logged' : effectiveCoverage === 'Minimal' ? 'Minimal' : effectiveCoverage === 'None' ? 'Missed' : 'Unknown');
    
    // Map coverage to expected outcome according to strict taxonomy
    const expectedOutcome = effectiveCoverage === 'Optimal' ? 'Prevented' : effectiveCoverage === 'Partial' ? 'Logged' : effectiveCoverage === 'Minimal' ? 'Missed' : effectiveCoverage === 'None' ? 'Missed' : 'Unknown';
    
    // Control drift is when the raw technical outcome doesn't match the expected outcome 
    // for that coverage rating (e.g., 'Logged' outcome but 'Optimal' coverage).
    // Note: 'Alerted' is also a valid Optimal/Partial outcome in some contexts, so we provide flexibility
    let isDrift = safeOutcome !== expectedOutcome && safeOutcome !== 'Untested';
    if (effectiveCoverage === 'Optimal' && safeOutcome === 'Alerted') isDrift = false;
    if (effectiveCoverage === 'Partial' && safeOutcome === 'Alerted') isDrift = false;
    if (effectiveCoverage === 'Minimal' && safeOutcome === 'Minimal') isDrift = false;

    const coverageColor = effectiveCoverage === 'None' ? 'var(--danger)' : effectiveCoverage === 'Minimal' ? 'var(--minimal)' : effectiveCoverage === 'Partial' ? 'var(--warning)' : 'var(--success)';
    const coverageBg = effectiveCoverage === 'None' ? 'rgba(239, 68, 68, 0.15)' : effectiveCoverage === 'Minimal' ? 'rgba(249, 115, 22, 0.15)' : effectiveCoverage === 'Partial' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)';
    const coverageBorder = effectiveCoverage === 'None' ? 'rgba(239, 68, 68, 0.3)' : effectiveCoverage === 'Minimal' ? 'rgba(249, 115, 22, 0.3)' : effectiveCoverage === 'Partial' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)';
    
    let outcomeColor = 'var(--text-secondary)';
    let outcomeBg = 'rgba(255,255,255,0.05)';
    let outcomeBorder = 'rgba(255,255,255,0.1)';

    const outClean = typeof safeOutcome === 'string' ? safeOutcome.trim() : String(safeOutcome);
    if (outClean === 'Prevented & Alerted') {
        outcomeColor = 'var(--success)';
        outcomeBg = 'rgba(16, 185, 129, 0.15)';
        outcomeBorder = 'rgba(16, 185, 129, 0.3)';
    } else if (outClean === 'Prevented' || outClean === 'Prevented') {
        outcomeColor = '#06b6d4'; // Cyan
        outcomeBg = 'rgba(6, 182, 212, 0.15)';
        outcomeBorder = 'rgba(6, 182, 212, 0.3)';
    } else if (outClean === 'Alerted') {
        outcomeColor = '#3b82f6'; // Blue
        outcomeBg = 'rgba(59, 130, 246, 0.15)';
        outcomeBorder = 'rgba(59, 130, 246, 0.3)';
    } else if (outClean.startsWith('Logged')) {
        outcomeColor = 'var(--warning)';
        outcomeBg = 'rgba(245, 158, 11, 0.15)';
        outcomeBorder = 'rgba(245, 158, 11, 0.3)';
    } else if (outClean.startsWith('Minimal')) {
        outcomeColor = 'var(--minimal)';
        outcomeBg = 'rgba(249, 115, 22, 0.15)';
        outcomeBorder = 'rgba(249, 115, 22, 0.3)';
    } else if (outClean === 'Missed') {
        outcomeColor = 'var(--danger)';
        outcomeBg = 'rgba(239, 68, 68, 0.15)';
        outcomeBorder = 'rgba(239, 68, 68, 0.3)';
    }

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span 
                style={{ 
                    fontSize: '0.65rem', 
                    padding: '2px 8px', 
                    borderRadius: '4px', 
                    textTransform: 'uppercase', 
                    fontWeight: 'bold', 
                    background: outcomeBg, 
                    color: outcomeColor, 
                    border: `1px solid ${outcomeBorder}`, 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '4px' 
                }} 
                title={isDrift ? `Control Drift: Expected outcome was ${expectedOutcome}, but actual outcome was ${safeOutcome}` : `Outcome: ${safeOutcome}`}
            >
                {isDrift && <AlertTriangle size={12} color="var(--warning)" style={{ flexShrink: 0 }} />}
                {safeOutcome}
            </span>
            <span style={{  background: coverageBg, border: `1px solid ${coverageBorder}`, color: coverageColor, padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.65rem', textTransform: 'uppercase', display: 'flex', alignItems: 'center'  }}>
                {effectiveCoverage === 'None' || effectiveCoverage === 'Zero' ? 'No' : effectiveCoverage} Coverage
            </span>
        </div>
    );
};

export default UnifiedPosturePill;
