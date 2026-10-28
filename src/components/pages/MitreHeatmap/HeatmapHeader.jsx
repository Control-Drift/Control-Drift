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

import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Shield, Activity, Clock, Download, Upload, X, Play, Compass, CheckCircle2, AlertTriangle, HelpCircle, Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../../AppContext';
import { useToast } from '../../ui/Toast';
import EnvironmentDropdown from '../../dropdowns/EnvironmentDropdown';
import SecurityControlFilterDropdown from '../../dropdowns/SecurityControlFilterDropdown';
import TagDropdown from '../../dropdowns/TagDropdown';
import {
  exportAttackNavigatorLayer,
  downloadNavigatorLayerJson,
  parseAttackNavigatorLayer
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
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [importedLayerAnalysis, setImportedLayerAnalysis] = useState(null);

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

  const handleImportLayerFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const analysis = parseAttackNavigatorLayer(
          ev.target.result,
          effectiveMitreData,
          gaps,
          simulationSummaries,
          effectiveEvents,
          activeEnvironmentFilter
        );
        setImportedLayerAnalysis(analysis);
        addToast(
          `Loaded "${analysis.layerName}" (${analysis.total} TTPs) — Readiness: ${analysis.readinessScore}%`,
          'info'
        );
      } catch (err) {
        addToast(err.message || 'Could not parse ATT&CK Navigator JSON.', 'error');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleLaunchFromLayer = (mode = 'delta') => {
    if (!importedLayerAnalysis) return;
    const targetList =
      mode === 'delta' && importedLayerAnalysis.deltaTTPs.length > 0
        ? importedLayerAnalysis.deltaTTPs
        : importedLayerAnalysis.allTTPs;

    if (!targetList || targetList.length === 0) {
      addToast('No techniques available to launch in this selection.', 'warning');
      return;
    }

    navigate('/simulation', {
      state: {
        emulationPlan: {
          name: `${importedLayerAnalysis.layerName} (${mode === 'delta' ? 'Readiness Delta' : 'Full Layer'})`,
          goals:
            importedLayerAnalysis.description ||
            `Validate organizational detection & prevention readiness against imported MITRE ATT&CK Navigator Layer "${importedLayerAnalysis.layerName}" (${targetList.length} TTPs scoped; current readiness ${importedLayerAnalysis.readinessScore}%).`,
          ttps: targetList.map((t) => ({
            id: t.id,
            name: t.name,
            procedureDesc: t.externalComment || ''
          })),
          targetStep: 1
        }
      }
    });
    setImportedLayerAnalysis(null);
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

          {/* ATT&CK Navigator Export / Import Controls */}
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

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn hover-lift"
            title="Import a MITRE ATT&CK Navigator Layer (.json) to run a Readiness Delta Analysis & scope a campaign"
            style={{
              padding: '6px 12px',
              background: 'rgba(6, 182, 212, 0.12)',
              border: '1px solid rgba(6, 182, 212, 0.35)',
              borderRadius: '20px',
              fontSize: '0.78rem',
              color: '#22d3ee',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <Upload size={13} />
            Import Layer
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImportLayerFile}
            style={{ display: 'none' }}
          />
        </div>

        <div className="heatmap-filters-container">
          <TagDropdown />
          <SecurityControlFilterDropdown />
          <EnvironmentDropdown />
        </div>
      </div>

      {/* Imported ATT&CK Navigator Layer Delta Analysis Modal */}
      {importedLayerAnalysis &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.78)',
              backdropFilter: 'blur(10px)',
              zIndex: 99999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px'
            }}
            onClick={() => setImportedLayerAnalysis(null)}
          >
            <div
              className="glass-panel animate-fade-in"
              style={{
                width: '100%',
                maxWidth: '880px',
                maxHeight: '88vh',
                display: 'flex',
                flexDirection: 'column',
                background: 'rgba(11, 14, 23, 0.96)',
                border: '1px solid rgba(34, 211, 238, 0.35)',
                borderRadius: '14px',
                boxShadow: '0 24px 60px rgba(0, 0, 0, 0.75)',
                overflow: 'hidden'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div
                style={{
                  padding: '18px 24px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'rgba(255, 255, 255, 0.02)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: 'rgba(6, 182, 212, 0.14)',
                      border: '1px solid rgba(6, 182, 212, 0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#22d3ee'
                    }}
                  >
                    <Layers size={20} />
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: '0.7rem',
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                        color: '#22d3ee',
                        fontWeight: 700
                      }}
                    >
                      MITRE ATT&CK Navigator Readiness Delta
                    </div>
                    <h3 style={{ margin: '2px 0 0 0', fontSize: '1.25rem', color: 'var(--text-primary)' }}>
                      {importedLayerAnalysis.layerName}
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setImportedLayerAnalysis(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    padding: '6px'
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {importedLayerAnalysis.description && (
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {importedLayerAnalysis.description}
                  </p>
                )}

                {/* KPI Summary Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: '12px' }}>
                  <div style={{ padding: '14px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.25)' }}>
                    <div style={{ fontSize: '0.72rem', color: '#93c5fd', fontWeight: 700, textTransform: 'uppercase' }}>Layer Readiness</div>
                    <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#60a5fa', marginTop: '4px' }}>
                      {importedLayerAnalysis.readinessScore}%
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {importedLayerAnalysis.total} Scoped TTPs
                    </div>
                  </div>

                  <div style={{ padding: '14px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                    <div style={{ fontSize: '0.72rem', color: '#6ee7b7', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle2 size={13} /> Covered & Fresh
                    </div>
                    <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#34d399', marginTop: '4px' }}>
                      {importedLayerAnalysis.coveredFresh.length}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Optimal / Partial validated</div>
                  </div>

                  <div style={{ padding: '14px', borderRadius: '10px', background: 'rgba(234, 179, 8, 0.08)', border: '1px solid rgba(234, 179, 8, 0.28)' }}>
                    <div style={{ fontSize: '0.72rem', color: '#fde047', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={13} /> Decayed / Aging
                    </div>
                    <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#facc15', marginTop: '4px' }}>
                      {importedLayerAnalysis.decayed.length}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Needs re-validation</div>
                  </div>

                  <div style={{ padding: '14px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.28)' }}>
                    <div style={{ fontSize: '0.72rem', color: '#fca5a5', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertTriangle size={13} /> Open Gaps
                    </div>
                    <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#f87171', marginTop: '4px' }}>
                      {importedLayerAnalysis.exposedGap.length}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Missed / Minimal coverage</div>
                  </div>

                  <div style={{ padding: '14px', borderRadius: '10px', background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.28)' }}>
                    <div style={{ fontSize: '0.72rem', color: '#c4b5fd', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <HelpCircle size={13} /> Blind Spots
                    </div>
                    <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#a78bfa', marginTop: '4px' }}>
                      {importedLayerAnalysis.untested.length}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Never tested in Control Drift</div>
                  </div>
                </div>

                {/* Technique Breakdown Table */}
                <div
                  style={{
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    background: 'rgba(0, 0, 0, 0.25)'
                  }}
                >
                  <div
                    style={{
                      padding: '10px 14px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      justifyContent: 'space-between'
                    }}
                  >
                    <span>TECHNIQUE POSTURE COMPARISON</span>
                    <span>
                      Delta Actionable: {importedLayerAnalysis.deltaTTPs.length} of {importedLayerAnalysis.total} TTPs
                    </span>
                  </div>
                  <div style={{ maxHeight: '290px', overflowY: 'auto' }}>
                    {importedLayerAnalysis.allTTPs.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          padding: '10px 14px',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '12px'
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span
                              style={{
                                fontFamily: 'monospace',
                                fontWeight: 700,
                                fontSize: '0.82rem',
                                color: '#38bdf8'
                              }}
                            >
                              {item.id}
                            </span>
                            <span style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--text-primary)' }}>
                              {item.name}
                            </span>
                            {item.tactics?.length > 0 && (
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                ({item.tactics.join(', ')})
                              </span>
                            )}
                          </div>
                          {item.externalComment && (
                            <div
                              style={{
                                fontSize: '0.74rem',
                                color: 'var(--text-secondary)',
                                marginTop: '3px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}
                              title={item.externalComment}
                            >
                              Layer Note: {item.externalComment}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          {item.variationCount > 0 && (
                            <span
                              style={{
                                fontSize: '0.7rem',
                                padding: '2px 8px',
                                borderRadius: '10px',
                                background: 'rgba(255, 255, 255, 0.06)',
                                color: 'var(--text-secondary)'
                              }}
                            >
                              {item.variationCount} var{item.variationCount === 1 ? '' : 's'}
                            </span>
                          )}
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '3px 10px',
                              borderRadius: '12px',
                              background: `${item.color}22`,
                              border: `1px solid ${item.color}66`,
                              color: item.color
                            }}
                          >
                            {item.statusLabel}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div
                style={{
                  padding: '16px 24px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  background: 'rgba(0, 0, 0, 0.35)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    const layerName = importedLayerAnalysis.layerName;
                    setImportedLayerAnalysis(null);
                    navigate('/research', { state: { activeTab: 'analyzer', importedLayerName: layerName } });
                  }}
                  className="btn hover-lift"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--glass-border)',
                    color: 'var(--text-secondary)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.8rem',
                    padding: '8px 14px'
                  }}
                >
                  <Compass size={15} />
                  Open Threat Research Hub
                </button>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => handleLaunchFromLayer('all')}
                    className="btn hover-lift"
                    style={{
                      background: 'rgba(59, 130, 246, 0.14)',
                      border: '1px solid rgba(59, 130, 246, 0.4)',
                      color: '#60a5fa',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      padding: '8px 16px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Play size={14} />
                    Emulate All ({importedLayerAnalysis.total} TTPs)
                  </button>

                  {importedLayerAnalysis.deltaTTPs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleLaunchFromLayer('delta')}
                      className="btn btn-premium-ai hover-lift"
                      style={{
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        padding: '8px 18px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Play size={14} />
                      Launch Delta Campaign ({importedLayerAnalysis.deltaTTPs.length} Exposed/Untested/Decayed)
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
