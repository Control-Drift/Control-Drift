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
import { Shield, Activity } from 'lucide-react';
import EnvironmentDropdown from '../../dropdowns/EnvironmentDropdown';
import SecurityControlFilterDropdown from '../../dropdowns/SecurityControlFilterDropdown';
import TagDropdown from '../../dropdowns/TagDropdown';

export default function HeatmapHeader({ 
  activeTactic, 
  setActiveTactic, 
  activeInfo, 
  mitreCoveragePercentage, 
  dashboardTotalValidated 
}) {
  return (
    <div className="heatmap-header responsive-row" style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', pointerEvents: 'none', gap: '15px', flexShrink: 0 }}>
      <div style={{ flex: '0 1 auto', maxWidth: '100%', marginBottom: '10px' }}>
        <div style={{ pointerEvents: 'auto', display: 'inline-block' }}>
          <h1 className="iridescent-text" style={{  margin: 0, fontSize: '2.5rem'  }}>{activeTactic ? `${activeTactic} Techniques` : 'Heat Globe'}</h1>
          <p style={{  color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: '0.85rem'  }}>
              {activeTactic ? 'Interact with specific TTPs mapped to this category.' : 'Analyze defensive coverage density across the MITRE ATT&CK framework.'}
          </p>
          {activeTactic && (
              <button 
                className="btn animate-fade-in" 
                style={{  marginTop: '8px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '4px 10px', fontSize: '0.75rem'  }}
              onClick={() => setActiveTactic(null)}
            >
              Zoom Out to Global View
            </button>
          )}
        </div>
      </div>

      <div className="responsive-row header-metrics" style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: '12px', transition: 'margin-right 0.3s cubic-bezier(0.16, 1, 0.3, 1)', marginRight: activeInfo ? '372px' : '0' }}>
        <div className="pills-container" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
            <div style={{  padding: '6px 14px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '20px', fontSize: '0.85rem', color: '#60a5fa', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 0 10px rgba(59, 130, 246, 0.1)'  }}>
                <Shield size={14} />
                ATT&CK Coverage: {mitreCoveragePercentage}%
            </div>
            <div style={{  padding: '6px 14px', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '20px', fontSize: '0.85rem', color: '#a78bfa', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 0 10px rgba(139, 92, 246, 0.1)'  }}>
                <Activity size={14} />
                Tested TTPs: {dashboardTotalValidated}
            </div>
        </div>
        <div className="heatmap-filters-container">
          <TagDropdown />
          <SecurityControlFilterDropdown />
          <EnvironmentDropdown />
        </div>
      </div>
    </div>
  );
}
