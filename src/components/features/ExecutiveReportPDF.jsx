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
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Svg,
  Defs,
  LinearGradient,
  Stop,
  Path,
} from '@react-pdf/renderer';

// Exact Orbitron 900 (Black) vector paths matching CustomLogo.jsx in the side menu
const ORBITRON_CONTROL_PATH =
  'M13.93 15.00L3.67 15.00Q2.93 15.00 2.33 14.64Q1.73 14.28 1.37 13.68Q1.01 13.07 1.01 12.34L1.01 4.70Q1.01 3.97 1.37 3.36Q1.73 2.76 2.33 2.40Q2.93 2.04 3.67 2.04L13.93 2.04L13.93 4.85L4.39 4.85Q4.10 4.85 3.95 4.99Q3.80 5.14 3.80 5.44L3.80 11.60Q3.80 11.89 3.95 12.04Q4.10 12.19 4.39 12.19L13.93 12.19L13.93 15.00ZM26.56 15.00L18.93 15.00Q18.21 15.00 17.60 14.64Q16.99 14.28 16.63 13.67Q16.27 13.06 16.27 12.34L16.27 4.70Q16.27 3.97 16.63 3.36Q16.99 2.76 17.60 2.40Q18.21 2.04 18.93 2.04L26.56 2.04Q27.28 2.04 27.89 2.40Q28.49 2.76 28.86 3.36Q29.23 3.97 29.23 4.70L29.23 12.34Q29.23 13.06 28.86 13.67Q28.49 14.28 27.89 14.64Q27.28 15.00 26.56 15.00ZM19.06 4.85L19.06 12.19L26.40 12.19L26.40 4.85L19.06 4.85ZM34.50 15.00L31.71 15.00L31.71 2.04L34.59 2.04L41.84 10.68L41.84 2.04L44.67 2.04L44.67 15.00L41.79 15.00L34.50 6.32L34.50 15.00ZM54.42 15.00L51.61 15.00L51.61 4.85L46.54 4.85L46.54 2.04L59.50 2.04L59.50 4.85L54.42 4.85L54.42 15.00ZM74.29 15.00L71.41 15.00L67.83 10.75L64.14 10.75L64.14 15.00L61.35 15.00L61.35 2.06L71.62 2.06Q72.36 2.06 72.97 2.42Q73.57 2.78 73.94 3.39Q74.31 4.00 74.31 4.72L74.31 8.07Q74.31 8.79 73.94 9.40Q73.57 10.01 72.97 10.37Q72.36 10.73 71.62 10.73L71.48 10.73L74.29 14.05L74.29 15.00ZM64.14 4.85L64.14 7.93L71.48 7.93L71.48 4.85L64.14 4.85ZM86.96 15.00L79.32 15.00Q78.60 15.00 77.99 14.64Q77.38 14.28 77.02 13.67Q76.66 13.06 76.66 12.34L76.66 4.70Q76.66 3.97 77.02 3.36Q77.38 2.76 77.99 2.40Q78.60 2.04 79.32 2.04L86.96 2.04Q87.68 2.04 88.28 2.40Q88.88 2.76 89.25 3.36Q89.62 3.97 89.62 4.70L89.62 12.34Q89.62 13.06 89.25 13.67Q88.88 14.28 88.28 14.64Q87.68 15.00 86.96 15.00ZM79.45 4.85L79.45 12.19L86.79 12.19L86.79 4.85L79.45 4.85ZM105.08 15.00L92.12 15.00L92.12 2.02L94.91 2.02L94.91 12.19L105.08 12.19L105.08 15.00Z';

const ORBITRON_DRIFT_PATH =
  'M122.40 15.00L112.12 15.00L112.12 2.04L122.40 2.04Q123.14 2.04 123.74 2.40Q124.34 2.76 124.71 3.36Q125.08 3.97 125.08 4.70L125.08 12.34Q125.08 13.06 124.71 13.67Q124.34 14.28 123.74 14.64Q123.14 15.00 122.40 15.00ZM114.89 4.85L114.89 12.19L122.26 12.19L122.26 4.85L114.89 4.85ZM140.54 15.00L137.66 15.00L134.08 10.75L130.39 10.75L130.39 15.00L127.60 15.00L127.60 2.06L137.88 2.06Q138.61 2.06 139.22 2.42Q139.82 2.78 140.19 3.39Q140.56 4.00 140.56 4.72L140.56 8.07Q140.56 8.79 140.19 9.40Q139.82 10.01 139.22 10.37Q138.61 10.73 137.88 10.73L137.73 10.73L140.54 14.05L140.54 15.00ZM130.39 4.85L130.39 7.93L137.73 7.93L137.73 4.85L130.39 4.85ZM145.25 15.00L142.50 15.00L142.50 2.04L145.25 2.04L145.25 15.00ZM150.16 15.00L147.34 15.00L147.34 2.04L159.31 2.04L159.31 4.85L150.16 4.85L150.16 7.12L157.52 7.12L157.52 9.92L150.16 9.92L150.16 15.00ZM168.23 15.00L165.42 15.00L165.42 4.85L160.35 4.85L160.35 2.04L173.31 2.04L173.31 4.85L168.23 4.85L168.23 15.00Z';

const sanitizeText = (text) => {
  if (!text) return '';
  return String(text).replace(
    /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
    ''
  );
};

const styles = StyleSheet.create({
  page: {
    padding: 36,
    backgroundColor: '#ffffff',
    fontFamily: 'Helvetica',
    color: '#0f172a',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: '#7c3aed',
    paddingBottom: 14,
    marginBottom: 20,
  },
  headerLeft: {
    maxWidth: '68%',
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  logoSvg: {
    width: 145,
    height: 14,
    marginBottom: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  badge: {
    backgroundColor: '#0f172a',
    color: '#ffffff',
    padding: '4px 8px',
    borderRadius: 4,
    fontSize: 8,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  metaText: {
    fontSize: 8,
    color: '#64748b',
  },
  scoreHeroRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  scoreHeroBox: {
    flex: 1,
    padding: 14,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderLeftWidth: 5,
    borderRadius: 6,
  },
  scoreHeroLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#475569',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  scoreHeroValue: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 3,
  },
  scoreHeroDesc: {
    fontSize: 8,
    color: '#64748b',
    lineHeight: 1.3,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  metricCard: {
    width: '31.5%',
    padding: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderTopWidth: 3,
    borderRadius: 5,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 7.5,
    fontWeight: 'bold',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0f172a',
    marginTop: 12,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  table: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 5,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  th: {
    fontSize: 7.5,
    fontWeight: 'bold',
    color: '#334155',
    textTransform: 'uppercase',
  },
  td: {
    fontSize: 8,
    color: '#1e293b',
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 36,
    right: 36,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7.5,
    color: '#94a3b8',
  },
});

export default function ExecutiveReportPDF({
  metrics = {},
  driftingTTPs = [],
  openGaps = [],
  topSecurityControls = [],
  activeTagFilter = 'All',
}) {
  const {
    grsScore = 0,
    totalValidated = 0,
    mitreCoveragePercentage = 0,
    openGapsCount = 0,
    resolutionRate = 0,
    residualRisk = 0,
    mttrText = 'N/A',
    driftingCount = 0,
    radarData = [],
  } = metrics;

  const generatedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const getScoreColor = (score) => {
    if (score >= 80) return '#059669';
    if (score >= 50) return '#d97706';
    return '#dc2626';
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <View style={styles.headerLeft}>
            <Svg viewBox="0 0 175 17" style={styles.logoSvg}>
              <Defs>
                <LinearGradient id="driftGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <Stop offset="0%" stopColor="#f43f5e" />
                  <Stop offset="45%" stopColor="#a855f7" />
                  <Stop offset="80%" stopColor="#2563eb" />
                  <Stop offset="100%" stopColor="#2563eb" />
                </LinearGradient>
              </Defs>
              <Path d={ORBITRON_CONTROL_PATH} fill="#0f172a" />
              <Path d={ORBITRON_DRIFT_PATH} fill="url(#driftGrad)" />
            </Svg>
            <Text style={styles.title}>Executive Security Posture Report</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.badge}>Executive Summary</Text>
            <Text style={styles.metaText}>Generated: {generatedDate}</Text>
            <Text style={styles.metaText}>Scope Filter: {sanitizeText(activeTagFilter)}</Text>
          </View>
        </View>

        {/* Unified Global Readiness Score Hero */}
        <View style={styles.scoreHeroRow}>
          <View style={[styles.scoreHeroBox, { borderLeftColor: getScoreColor(grsScore) }]}>
            <Text style={styles.scoreHeroLabel}>Global Readiness Score (GRS)</Text>
            <Text style={[styles.scoreHeroValue, { color: getScoreColor(grsScore) }]}>
              {totalValidated > 0 ? `${grsScore} / 100` : 'No Baseline'}
            </Text>
            <Text style={styles.scoreHeroDesc}>
              Unified enterprise readiness metric combining simulation coverage outcomes across {totalValidated} validated MITRE ATT&amp;CK techniques, active gap severity weighting ({openGapsCount} open gaps), procedural test depth, and TTP validation decay ({driftingCount} techniques currently flagged for re-testing).
            </Text>
          </View>
        </View>

        {/* Core Telemetry Grid */}
        <View style={styles.metricsGrid}>
          <View style={[styles.metricCard, { borderTopColor: '#6366f1' }]}>
            <Text style={[styles.metricValue, { color: '#0f172a' }]}>{totalValidated}</Text>
            <Text style={styles.metricLabel}>Validated TTPs</Text>
          </View>
          <View style={[styles.metricCard, { borderTopColor: '#3b82f6' }]}>
            <Text style={[styles.metricValue, { color: '#2563eb' }]}>{mitreCoveragePercentage}%</Text>
            <Text style={styles.metricLabel}>In-Scope ATT&CK Coverage</Text>
          </View>
          <View style={[styles.metricCard, { borderTopColor: '#f59e0b' }]}>
            <Text style={[styles.metricValue, { color: '#d97706' }]}>{driftingCount}</Text>
            <Text style={styles.metricLabel}>Decayed TTPs (&gt;90d Stale)</Text>
          </View>
          <View style={[styles.metricCard, { borderTopColor: '#10b981' }]}>
            <Text style={[styles.metricValue, { color: '#059669' }]}>{resolutionRate}%</Text>
            <Text style={styles.metricLabel}>Gap Resolution Rate</Text>
          </View>
          <View style={[styles.metricCard, { borderTopColor: '#ef4444' }]}>
            <Text style={[styles.metricValue, { color: '#dc2626' }]}>{residualRisk}</Text>
            <Text style={styles.metricLabel}>Weighted Residual Risk ({openGapsCount} Open)</Text>
          </View>
          <View style={[styles.metricCard, { borderTopColor: '#a855f7' }]}>
            <Text style={[styles.metricValue, { color: '#7c3aed' }]}>{sanitizeText(mttrText)}</Text>
            <Text style={styles.metricLabel}>Mean Time To Remediate (MTTR)</Text>
          </View>
        </View>

        {/* Kill Chain Exposure Breakdown */}
        <Text style={styles.sectionTitle}>1. Cyber Kill Chain Exposure</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, { width: '38%' }]}>Kill Chain Phase</Text>
            <Text style={[styles.th, { width: '20%' }]}>Tested TTPs</Text>
            <Text style={[styles.th, { width: '22%' }]}>Exposure Rate</Text>
            <Text style={[styles.th, { width: '20%' }]}>Posture Status</Text>
          </View>
          {(radarData || []).map((phase, idx) => {
            const tested = phase.tested || 0;
            const risk = phase.risk || 0;
            const status =
              tested === 0
                ? 'Untested'
                : risk >= 70
                ? 'Critical Risk'
                : risk >= 50
                ? 'High Risk'
                : risk >= 30
                ? 'Moderate Risk'
                : risk > 0
                ? 'Low Risk'
                : 'Secured';
            const statusColor =
              tested === 0
                ? '#64748b'
                : risk >= 50
                ? '#dc2626'
                : risk >= 30
                ? '#d97706'
                : '#059669';
            return (
              <View key={idx} style={styles.tableRow}>
                <Text style={[styles.td, { width: '38%', fontWeight: 'bold' }]}>
                  {sanitizeText(phase.subject)}
                </Text>
                <Text style={[styles.td, { width: '20%' }]}>{tested}</Text>
                <Text style={[styles.td, { width: '22%', fontWeight: 'bold', color: statusColor }]}>
                  {tested > 0 ? `${risk}%` : 'N/A'}
                </Text>
                <Text style={[styles.td, { width: '20%', fontWeight: 'bold', color: statusColor }]}>
                  {status}
                </Text>
              </View>
            );
          })}
        </View>

        {/* TTP Decay Watchlist */}
        <Text style={styles.sectionTitle}>2. TTP Decay Watchlist (Decayed &amp; Aging Validations)</Text>
        {driftingTTPs.length === 0 ? (
          <View style={{ padding: 10, backgroundColor: '#f8fafc', borderRadius: 4, marginBottom: 12 }}>
            <Text style={{ fontSize: 8.5, color: '#475569' }}>
              All validated techniques are currently Fresh and within their active validation cycle.
            </Text>
          </View>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { width: '16%' }]}>TTP ID</Text>
              <Text style={[styles.th, { width: '34%' }]}>Technique Name</Text>
              <Text style={[styles.th, { width: '20%' }]}>Tactic</Text>
              <Text style={[styles.th, { width: '15%' }]}>Staleness</Text>
              <Text style={[styles.th, { width: '15%' }]}>Drift Status</Text>
            </View>
            {driftingTTPs.slice(0, 10).map((item, idx) => (
              <View key={idx} style={styles.tableRow}>
                <Text style={[styles.td, { width: '16%', fontWeight: 'bold' }]}>{sanitizeText(item.id)}</Text>
                <Text style={[styles.td, { width: '34%' }]}>{sanitizeText(item.name)}</Text>
                <Text style={[styles.td, { width: '20%', color: '#475569' }]}>{sanitizeText(item.tactic)}</Text>
                <Text style={[styles.td, { width: '15%' }]}>
                  {item.daysSinceLastTest != null ? `${item.daysSinceLastTest}d ago` : 'N/A'}
                </Text>
                <Text
                  style={[
                    styles.td,
                    {
                      width: '15%',
                      fontWeight: 'bold',
                      color: item.needsRetest ? '#d97706' : '#ca8a04',
                    },
                  ]}
                >
                  {sanitizeText(item.driftStatus)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Priority Open Coverage Gaps */}
        <Text style={styles.sectionTitle}>3. Priority Open Coverage Gaps</Text>
        {openGaps.length === 0 ? (
          <View style={{ padding: 10, backgroundColor: '#f8fafc', borderRadius: 4, marginBottom: 12 }}>
            <Text style={{ fontSize: 8.5, color: '#475569' }}>No open coverage gaps in the current scope.</Text>
          </View>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { width: '18%' }]}>TTP</Text>
              <Text style={[styles.th, { width: '44%' }]}>Gap / Finding</Text>
              <Text style={[styles.th, { width: '18%' }]}>Severity</Text>
              <Text style={[styles.th, { width: '20%' }]}>Status</Text>
            </View>
            {openGaps.slice(0, 8).map((gap, idx) => {
              const sevColor =
                gap.severity === 'Critical'
                  ? '#dc2626'
                  : gap.severity === 'High'
                  ? '#ea580c'
                  : gap.severity === 'Medium'
                  ? '#d97706'
                  : '#2563eb';
              return (
                <View key={idx} style={styles.tableRow}>
                  <Text style={[styles.td, { width: '18%', fontWeight: 'bold' }]}>
                    {sanitizeText(gap.ttp || 'N/A')}
                  </Text>
                  <Text style={[styles.td, { width: '44%' }]}>
                    {sanitizeText((gap.name || gap.finding || 'Coverage Gap').slice(0, 65))}
                  </Text>
                  <Text style={[styles.td, { width: '18%', fontWeight: 'bold', color: sevColor }]}>
                    {sanitizeText(gap.severity || 'Medium')}
                  </Text>
                  <Text style={[styles.td, { width: '20%' }]}>{sanitizeText(gap.status || 'Open')}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Top Security Controls */}
        {topSecurityControls && topSecurityControls.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>4. Security Control Efficacy</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, { width: '50%' }]}>Security Control</Text>
                <Text style={[styles.th, { width: '25%' }]}>Triggered / Tested</Text>
                <Text style={[styles.th, { width: '25%' }]}>Efficacy Rate</Text>
              </View>
              {topSecurityControls.slice(0, 6).map((ctrl, idx) => {
                const pct = ctrl.totalTTPs > 0 ? Math.round((ctrl.positiveOutcomes / ctrl.totalTTPs) * 100) : 0;
                return (
                  <View key={idx} style={styles.tableRow}>
                    <Text style={[styles.td, { width: '50%', fontWeight: 'bold' }]}>
                      {sanitizeText(ctrl.name)}
                    </Text>
                    <Text style={[styles.td, { width: '25%' }]}>
                      {ctrl.positiveOutcomes} / {ctrl.totalTTPs}
                    </Text>
                    <Text
                      style={[
                        styles.td,
                        {
                          width: '25%',
                          fontWeight: 'bold',
                          color: pct >= 75 ? '#059669' : pct >= 40 ? '#d97706' : '#dc2626',
                        },
                      ]}
                    >
                      {pct}%
                    </Text>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>Control Drift — Adversary Simulation &amp; Posture Management</Text>
          <Text
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
