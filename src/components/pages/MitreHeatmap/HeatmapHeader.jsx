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
import { Shield, Activity, Clock, Download } from 'lucide-react';
import { useAppContext } from '../../../AppContext';
import { useToast } from '../../ui/Toast';
import EnvironmentDropdown from '../../dropdowns/EnvironmentDropdown';
import SecurityControlFilterDropdown from '../../dropdowns/SecurityControlFilterDropdown';
import TagDropdown from '../../dropdowns/TagDropdown';
import {
  exportAttackNavigatorLayer,
  downloadNavigatorLayerJson
} from '../../../lib/attackNavigator';

export default function HeatmapHeader({
  activeTactic,
  setActiveTactic,
  activeInfo,
  mitreCoveragePercentage,
  dashboardTotalValidated,
  driftingCount = 0,
  resolvedMitreData = null
}) {
  const { mitreData, gaps, simulationSummaries, events, allEventsData, activeEnvironmentFilter } = useAppContext();
  const { addToast } = useToast();

  const effectiveMitreData = resolvedMitreData && Object.keys(resolvedMitreData).length > 0 ? resolvedMitreData : mitreData;
  const effectiveEvents = allEventsData && Object.keys(allEventsData).length > 0 ? allEventsData : events;

  const handleExportLayer = () => {
    try {
      const layer = exportAttackNavigatorLayer({
        mitreData: effectiveMitreData,
        gaps,
        simulationSummaries,
        events: effectiveEvents,
        environmentFilter: activeEnvironmentFilter
      });
      downloadNavigatorLayerJson(layer);
      addToast(
        `Exported MITRE ATT&CK Navigator Layer (${layer.techniques.length} technique mappings).`,
        'success'
      );
    } catch (err) {
      addToast(`Failed to export Navigator layer: ${err.message}`, 'error');
    }
  };

  return (
    <div
      className="heatmap-header responsive-row"
      style={{
        padding: '12px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        pointerEvents: 'none',
        gap: '15px',
        flexShrink: 0
      }}
    >
      <div style={{ flex: '0 1 auto', maxWidth: '100%', marginBottom: '10px' }}>
        <div style={{ pointerEvents: 'auto', display: 'inline-block' }}>
          <h1 className="iridescent-text" style={{ margin: 0, fontSize: '2.5rem' }}>
            {activeTactic ? `${activeTactic} Techniques` : 'Heat Globe'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: '0.85rem' }}>
            {activeTactic
              ? 'Interact with specific TTPs mapped to this category.'
              : 'Analyze defensive coverage density across the MITRE ATT&CK framework.'}
          </p>
          {activeTactic && (
            <button
              className="btn animate-fade-in"
              style={{
                marginTop: '8px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid var(--danger)',
                color: 'var(--danger)',
                padding: '4px 10px',
                fontSize: '0.75rem'
              }}
              onClick={() => setActiveTactic(null)}
            >
              Zoom Out to Global View
            </button>
          )}
        </div>
      </div>

      <div
        className="responsive-row header-metrics"
        style={{
          pointerEvents: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          flexWrap: 'wrap',
          gap: '12px',
          transition: 'margin-right 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          marginRight: activeInfo ? '372px' : '0'
        }}
      >
        <div
          className="pills-container"
          style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
            alignItems: 'center'
          }}
        >
          <div
            style={{
              padding: '6px 14px',
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              borderRadius: '20px',
              fontSize: '0.85rem',
              color: '#60a5fa',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 0 10px rgba(59, 130, 246, 0.1)'
            }}
          >
            <Shield size={14} />
            ATT&CK Coverage: {mitreCoveragePercentage}%
          </div>
          <div
            style={{
              padding: '6px 14px',
              background: 'rgba(139, 92, 246, 0.1)',
              border: '1px solid rgba(139, 92, 246, 0.2)',
              borderRadius: '20px',
              fontSize: '0.85rem',
              color: '#a78bfa',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 0 10px rgba(139, 92, 246, 0.1)'
            }}
          >
            <Activity size={14} />
            Tested TTPs: {dashboardTotalValidated}
          </div>
          {driftingCount > 0 && (
            <div
              style={{
                padding: '6px 14px',
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '20px',
                fontSize: '0.85rem',
                color: '#fbbf24',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 0 10px rgba(245, 158, 11, 0.15)'
              }}
              title="Techniques whose validation freshness has decayed and need re-testing"
            >
              <Clock size={14} />
              Decayed TTPs: {driftingCount}
            </div>
          )}

          {/* ATT&CK Navigator Export Control */}
          <button
            type="button"
            onClick={handleExportLayer}
            className="btn hover-lift"
            title="Export current Control Drift posture, depth & decay as a MITRE ATT&CK Navigator Layer (.json)"
            style={{
              padding: '6px 12px',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              borderRadius: '20px',
              fontSize: '0.78rem',
              color: '#34d399',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <Download size={13} />
            Export Navigator (.json)
          </button>
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
