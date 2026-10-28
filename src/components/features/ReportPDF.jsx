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
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

const sanitizeText = (text) => {
    if (!text) return '';
    return String(text)
        .replace(/➔|→/g, '->')
        .replace(/✓/g, 'Verified')
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
};

const parseCommaItems = (str) => {
    if (!str || typeof str !== 'string') return [];
    return str
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    backgroundColor: '#ffffff',
    fontFamily: 'Helvetica',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 3,
    borderBottomColor: '#3b82f6',
    paddingBottom: 20,
    marginBottom: 24,
  },
  headerLeft: {
    maxWidth: '70%',
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  reportTypeBadge: {
    backgroundColor: '#1e293b',
    color: '#ffffff',
    padding: '4px 8px',
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
    marginTop: 22,
    marginBottom: 12,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  metricsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 15,
  },
  metricBox: {
    flex: 1,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderTopWidth: 4,
    borderRadius: 6,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 8,
    color: '#64748b',
    textTransform: 'uppercase',
    fontWeight: 'bold',
    letterSpacing: 0.5,
    textAlign: 'center'
  },
  blueprintContainer: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 14,
    marginBottom: 22,
  },
  blueprintHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 8,
    marginBottom: 12,
  },
  blueprintTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  methodologyBadge: {
    backgroundColor: '#f3e8ff',
    borderWidth: 1,
    borderColor: '#d8b4fe',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  methodologyBadgeText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#6b21a8',
    textTransform: 'uppercase',
  },
  topologyRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
  },
  topologyNode: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderRadius: 6,
    overflow: 'hidden',
  },
  topologyNodeHeader: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  topologyNodeTitle: {
    fontSize: 7.5,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  topologyNodeBody: {
    padding: 8,
  },
  topologyConnector: {
    width: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topologyConnectorText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#94a3b8',
  },
  topologyItemPill: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    paddingVertical: 3,
    paddingHorizontal: 6,
    marginBottom: 4,
  },
  topologyItemText: {
    fontSize: 8.5,
    color: '#1e293b',
    fontWeight: 'bold',
  },
  topologyEmptyText: {
    fontSize: 8,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  hostTtpWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    paddingTop: 3,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  hostTtpPill: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1.5,
    marginRight: 3,
    marginBottom: 3,
  },
  hostTtpText: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#1d4ed8',
  },
  deconflictionBar: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  deconflictionLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#475569',
    textTransform: 'uppercase',
    marginRight: 8,
    width: 145,
  },
  deconflictionValue: {
    fontSize: 8.5,
    color: '#0f172a',
    flex: 1,
    lineHeight: 1.4,
  },
  summaryText: {
    fontSize: 11,
    lineHeight: 1.6,
    color: '#334155',
    marginBottom: 8,
    wordBreak: 'break-word',
  },
  table: {
    width: '100%',
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 2,
    borderBottomColor: '#cbd5e1',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  col1: { width: '30%', paddingRight: 10 },
  col2: { width: '15%', paddingRight: 10 },
  col3: { width: '55%' },
  thText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#475569',
    textTransform: 'uppercase',
  },
  tdText: {
    fontSize: 10,
    color: '#1e293b',
    lineHeight: 1.4,
  },
  tdLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#64748b',
    marginTop: 6,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  badgeHigh: { color: '#059669', fontWeight: 'bold' },
  badgeMedium: { color: '#d97706', fontWeight: 'bold' },
  badgeLow: { color: '#dc2626', fontWeight: 'bold' },
  evidenceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  evidenceImg: {
    width: '48%',
    height: 200,
    objectFit: 'contain',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    padding: 5,
    marginBottom: 15,
  },
  tagLabel: {
    fontSize: 8,
    color: '#64748b',
    marginRight: 4,
    marginTop: 3,
    textTransform: 'uppercase',
    fontWeight: 'bold'
  },
  tag: {
    fontSize: 9,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 4,
    marginBottom: 4,
  }
});

const getOutcomeColor = (outcome) => {
    if (!outcome) return '#dc2626';
    if (outcome.includes(' ➔ ')) outcome = outcome.split(' ➔ ')[1];
    else if (outcome.includes('->')) outcome = outcome.split('->')[1]?.trim() || outcome;
    
    if (outcome === 'Prevented & Alerted' || outcome === 'Prevented' || outcome === 'Alerted') {
        return '#059669';
    } else if (outcome === 'Logged') {
        return '#d97706';
    } else if (outcome === 'Missed' || outcome === 'Error') {
        return '#dc2626';
    }
    return '#64748b';
};

const getSeverityColor = (severity) => {
    if (severity === 'Critical') return { bg: '#f3e8ff', text: '#7e22ce' };
    if (severity === 'High') return { bg: '#fef2f2', text: '#dc2626' };
    if (severity === 'Medium') return { bg: '#fff7ed', text: '#ea580c' };
    if (severity === 'Low') return { bg: '#fefce8', text: '#ca8a04' };
    if (severity === 'Info') return { bg: '#f1f5f9', text: '#475569' };
    return { bg: '#f8fafc', text: '#64748b' };
};

const getCoverageColor = (coverage) => {
    if (coverage === 'Optimal') return { bg: '#dcfce7', text: '#15803d' };
    if (coverage === 'Partial') return { bg: '#fef3c7', text: '#b45309' };
    if (coverage === 'Minimal') return { bg: '#ffedd5', text: '#c2410c' };
    if (coverage === 'None') return { bg: '#fee2e2', text: '#b91c1c' };
    return { bg: '#f1f5f9', text: '#475569' };
};

const ReportPDF = ({
    simulationName,
    date,
    summary,
    events,
    testResults,
    participants,
    blocked,
    medium,
    minimal,
    missed,
    total,
    evidence,
    tags = [],
    operationalBlueprint = null,
    environment = null,
    executionMethodology = null
}) => {
  const bp = operationalBlueprint || {};
  const toolingList = Array.isArray(bp.tooling) ? bp.tooling.filter(Boolean) : [];
  const infraNodes = parseCommaItems(bp.threatInfra);
  const targetNodes = parseCommaItems(bp.targetAssets);
  const identityNodes = parseCommaItems(bp.testAccounts);
  const hostAssignments = bp.hostTtpAssignments && typeof bp.hostTtpAssignments === 'object' ? bp.hostTtpAssignments : {};
  const hasBlueprint =
    toolingList.length > 0 ||
    infraNodes.length > 0 ||
    targetNodes.length > 0 ||
    identityNodes.length > 0 ||
    Boolean(bp.stagingAndDeconfliction?.trim());

  const envLabel = Array.isArray(environment)
    ? environment.filter(Boolean).join(', ')
    : typeof environment === 'string'
    ? environment
    : '';

  const allFallbackTtpIds = Array.from(
    new Set(
      (testResults || []).flatMap((r) => (Array.isArray(r.ttps) ? r.ttps : []))
    )
  );

  const renderSummary = (text) => {
    if (!text) return <Text style={styles.summaryText}>No executive summary provided.</Text>;
    
    return text.split('\n').map((line, idx) => {
      const cleanLine = line.replace(/#|\*/g, '').trim().toLowerCase();
      if (cleanLine === 'executive summary') return null;
      if (cleanLine.startsWith('participants:')) return null;
      const stripInline = (s) => sanitizeText(s.replace(/\*\*/g, '').replace(/`/g, '').replace(/^\*|\*$/g, ''));
      if (line.startsWith('### ')) {
         return <Text key={idx} style={{ fontSize: 13, fontWeight: 'bold', color: '#1e3a8a', marginTop: 15, marginBottom: 8 }}>{stripInline(line.replace('### ', ''))}</Text>;
      } else if (line.startsWith('## ')) {
         return <Text key={idx} style={{ fontSize: 15, fontWeight: 'bold', color: '#172554', marginTop: 20, marginBottom: 10 }}>{stripInline(line.replace('## ', ''))}</Text>;
      } else if (line.startsWith('# ')) {
         return <Text key={idx} style={{ fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginTop: 25, marginBottom: 12 }}>{stripInline(line.replace('# ', ''))}</Text>;
      } else if (line.startsWith('**') && line.endsWith('**')) {
         return <Text key={idx} style={{ fontSize: 11, fontWeight: 'bold', color: '#1e293b', marginTop: 10, marginBottom: 4 }}>{stripInline(line)}</Text>;
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
         return (
            <View key={idx} style={{ flexDirection: 'row', marginBottom: 4, paddingLeft: 10 }}>
               <Text style={{ fontSize: 11, color: '#334155', marginRight: 6 }}>•</Text>
               <Text style={{ fontSize: 11, lineHeight: 1.5, color: '#334155', flex: 1 }}>{stripInline(line.substring(2))}</Text>
            </View>
         );
      } else if (line.trim() === '') {
         return null;
      } else {
         return <Text key={idx} style={styles.summaryText}>{stripInline(line)}</Text>;
      }
    });
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerContainer}>
          <View style={styles.headerLeft}>
            <Text style={styles.reportTypeBadge}>Adversary Simulation</Text>
            <Text style={styles.title}>{sanitizeText(simulationName)}</Text>
            <Text style={styles.subtitle}>Executive After-Action Report</Text>
            {envLabel ? (
               <Text style={{ fontSize: 9, color: '#475569', marginTop: 8 }}>ENVIRONMENT: {sanitizeText(envLabel)}</Text>
            ) : null}
            {participants && (
               <Text style={{ fontSize: 9, color: '#475569', marginTop: envLabel ? 4 : 10 }}>PARTICIPANTS: {sanitizeText(participants)}</Text>
            )}
            {tags && tags.length > 0 && (
               <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
                  <Text style={styles.tagLabel}>TAGS:</Text>
                  {tags.map((t, idx) => (
                    <Text key={idx} style={[styles.tag, { backgroundColor: '#3b82f6', color: '#ffffff' }]}>{t}</Text>
                  ))}
               </View>
            )}
          </View>
          <View style={styles.headerRight}>
            <Text style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>COMPLETED ON</Text>
            <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#1e293b' }}>{new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</Text>
            <Text style={{ fontSize: 10, color: '#64748b', marginTop: 8, marginBottom: 4 }}>STATUS</Text>
            <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#059669' }}>Completed</Text>
          </View>
        </View>

        <View style={styles.metricsContainer}>
          {blocked > 0 ? (
            <View style={[styles.metricBox, { borderTopColor: '#10b981' }]}>
              <Text style={[styles.metricValue, { color: '#059669' }]}>{blocked}</Text>
              <Text style={styles.metricLabel}>Optimal Coverage</Text>
            </View>
          ) : null}
          {medium > 0 ? (
            <View style={[styles.metricBox, { borderTopColor: '#f59e0b' }]}>
              <Text style={[styles.metricValue, { color: '#d97706' }]}>{medium}</Text>
              <Text style={styles.metricLabel}>Partial Coverage</Text>
            </View>
          ) : null}
          {minimal > 0 ? (
            <View style={[styles.metricBox, { borderTopColor: '#f97316' }]}>
              <Text style={[styles.metricValue, { color: '#c2410c' }]}>{minimal}</Text>
              <Text style={styles.metricLabel}>Minimal Coverage</Text>
            </View>
          ) : null}
          {missed > 0 ? (
            <View style={[styles.metricBox, { borderTopColor: '#ef4444' }]}>
              <Text style={[styles.metricValue, { color: '#dc2626' }]}>{missed}</Text>
              <Text style={styles.metricLabel}>No Coverage</Text>
            </View>
          ) : null}
          {total > 0 ? (
            <View style={[styles.metricBox, { borderTopColor: '#64748b' }]}>
              <Text style={[styles.metricValue, { color: '#0f172a' }]}>{total}</Text>
              <Text style={styles.metricLabel}>Total Validated</Text>
            </View>
          ) : null}
        </View>

        {hasBlueprint && (
          <View style={styles.blueprintContainer} wrap={false}>
            <View style={styles.blueprintHeaderRow}>
              <Text style={styles.blueprintTitle}>Blueprint &amp; Target Topology</Text>
              {executionMethodology && (
                <View style={styles.methodologyBadge}>
                  <Text style={styles.methodologyBadgeText}>
                    {executionMethodology === 'atomic' ? 'Atomic 1:1 Control Validation' : 'Compound Adversary Emulation'}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.topologyRow}>
              {/* Node 1: Threat Infra */}
              <View style={[styles.topologyNode, { borderColor: '#fecaca' }]}>
                <View style={[styles.topologyNodeHeader, { backgroundColor: '#fef2f2', borderBottomColor: '#fecaca' }]}>
                  <Text style={[styles.topologyNodeTitle, { color: '#b91c1c' }]}>1. Threat Infra / C2</Text>
                </View>
                <View style={styles.topologyNodeBody}>
                  {infraNodes.length > 0 ? (
                    infraNodes.map((node, i) => (
                      <View key={i} style={styles.topologyItemPill}>
                        <Text style={styles.topologyItemText}>{sanitizeText(node)}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.topologyEmptyText}>Not specified</Text>
                  )}
                </View>
              </View>

              <View style={styles.topologyConnector}>
                <Text style={styles.topologyConnectorText}>-&gt;</Text>
              </View>

              {/* Node 2: Tooling & Frameworks */}
              <View style={[styles.topologyNode, { borderColor: '#e9d5ff' }]}>
                <View style={[styles.topologyNodeHeader, { backgroundColor: '#faf5ff', borderBottomColor: '#e9d5ff' }]}>
                  <Text style={[styles.topologyNodeTitle, { color: '#7e22ce' }]}>2. Offensive Tooling</Text>
                </View>
                <View style={styles.topologyNodeBody}>
                  {toolingList.length > 0 ? (
                    toolingList.map((tool, i) => (
                      <View key={i} style={[styles.topologyItemPill, { backgroundColor: '#faf5ff', borderColor: '#e9d5ff' }]}>
                        <Text style={[styles.topologyItemText, { color: '#6b21a8' }]}>{sanitizeText(tool)}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.topologyEmptyText}>Native / Unspecified</Text>
                  )}
                </View>
              </View>

              <View style={styles.topologyConnector}>
                <Text style={styles.topologyConnectorText}>-&gt;</Text>
              </View>

              {/* Node 3: Target Endpoints & Per-Host TTPs */}
              <View style={[styles.topologyNode, { borderColor: '#bfdbfe', flex: 1.35 }]}>
                <View style={[styles.topologyNodeHeader, { backgroundColor: '#eff6ff', borderBottomColor: '#bfdbfe' }]}>
                  <Text style={[styles.topologyNodeTitle, { color: '#1d4ed8' }]}>3. Target Endpoints &amp; TTPs</Text>
                </View>
                <View style={styles.topologyNodeBody}>
                  {targetNodes.length > 0 ? (
                    targetNodes.map((host, i) => {
                      const assignedTtps = Array.isArray(hostAssignments[host])
                        ? hostAssignments[host]
                        : allFallbackTtpIds;
                      return (
                        <View key={i} style={styles.topologyItemPill}>
                          <Text style={styles.topologyItemText}>{sanitizeText(host)}</Text>
                          {assignedTtps.length > 0 && (
                            <View style={styles.hostTtpWrap}>
                              {assignedTtps.map((tid, idx) => (
                                <View key={idx} style={styles.hostTtpPill}>
                                  <Text style={styles.hostTtpText}>{sanitizeText(tid)}</Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      );
                    })
                  ) : (
                    <Text style={styles.topologyEmptyText}>Not specified</Text>
                  )}
                </View>
              </View>

              <View style={styles.topologyConnector}>
                <Text style={styles.topologyConnectorText}>-&gt;</Text>
              </View>

              {/* Node 4: Identity Context */}
              <View style={[styles.topologyNode, { borderColor: '#fde68a' }]}>
                <View style={[styles.topologyNodeHeader, { backgroundColor: '#fffbeb', borderBottomColor: '#fde68a' }]}>
                  <Text style={[styles.topologyNodeTitle, { color: '#b45309' }]}>4. Identity Context</Text>
                </View>
                <View style={styles.topologyNodeBody}>
                  {identityNodes.length > 0 ? (
                    identityNodes.map((acct, i) => (
                      <View key={i} style={styles.topologyItemPill}>
                        <Text style={styles.topologyItemText}>{sanitizeText(acct)}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.topologyEmptyText}>Not specified</Text>
                  )}
                </View>
              </View>
            </View>

            {bp.stagingAndDeconfliction?.trim() && (
              <View style={styles.deconflictionBar}>
                <Text style={styles.deconflictionLabel}>Staging &amp; Deconfliction:</Text>
                <Text style={styles.deconflictionValue}>{sanitizeText(bp.stagingAndDeconfliction.trim())}</Text>
              </View>
            )}
          </View>
        )}

        <View style={{ marginBottom: 25 }}>
          <Text style={styles.sectionTitle}>Executive Summary</Text>
          <View>
             {renderSummary(summary)}
          </View>
        </View>

        <View>
          <Text style={styles.sectionTitle}>Technical Findings</Text>
          <View style={{ marginTop: 10 }}>
            {testResults && testResults.length > 0 ? (
               testResults.map((proc, j) => {
                  const severityStyle = getSeverityColor(proc.severity);
                  const coverageStyle = getCoverageColor(proc.coverageRating);
                  
                  return (
                  <View key={j} style={{ backgroundColor: '#f8fafc', padding: 12, borderRadius: 6, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0' }} wrap={false}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, alignItems: 'flex-start' }}>
                          <View style={{ flex: 1, paddingRight: 10 }}>
                              <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#1e293b', marginBottom: 4 }}>
                                  {j + 1}. {sanitizeText(proc.name) || 'Unnamed Event'}
                                  {proc.outcome?.includes(' ➔ ') || proc.outcome?.includes('->') ? '  [Re-Tested]' : ''}
                                  {(proc.timestamp || proc.date) ? `  [${new Date(proc.timestamp || proc.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}]` : ''}
                              </Text>
                              {proc.expectedOutcome && proc.expectedOutcome !== proc.outcome && (
                                  <Text style={{ fontSize: 9, color: '#dc2626', fontStyle: 'italic' }}>Control Drift Detected</Text>
                              )}
                          </View>
                          
                          <View style={{ flexDirection: 'row', gap: 6 }}>
                             {proc.coverageRating && proc.coverageRating !== 'N/A' && (
                                <View style={{ backgroundColor: coverageStyle.bg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: coverageStyle.text + '30' }}>
                                   <Text style={{ fontSize: 9, fontWeight: 'bold', color: coverageStyle.text, textTransform: 'uppercase' }}>{proc.coverageRating} Coverage</Text>
                                </View>
                             )}
                             {proc.severity && proc.severity !== 'N/A' && proc.severity !== 'Auto-Calculate' && (
                                <View style={{ backgroundColor: severityStyle.bg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: severityStyle.text + '30' }}>
                                   <Text style={{ fontSize: 9, fontWeight: 'bold', color: severityStyle.text, textTransform: 'uppercase' }}>{proc.severity} Severity</Text>
                                </View>
                             )}
                          </View>
                      </View>
                      
                      <View style={{ flexDirection: 'row', gap: 15, marginBottom: 12 }}>
                          <View style={{ alignItems: 'flex-start' }}>
                              <Text style={{ fontSize: 8, color: '#64748b', textTransform: 'uppercase', marginBottom: 3, fontWeight: 'bold' }}>Expected Outcome</Text>
                              <View style={{ backgroundColor: '#ffffff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: '#cbd5e1' }}>
                                 <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#475569' }}>{sanitizeText(proc.expectedOutcome) || 'N/A'}</Text>
                              </View>
                          </View>
                          <View style={{ alignItems: 'flex-start' }}>
                              <Text style={{ fontSize: 8, color: '#64748b', textTransform: 'uppercase', marginBottom: 3, fontWeight: 'bold' }}>Actual Outcome</Text>
                              <View style={{ backgroundColor: '#ffffff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: '#cbd5e1' }}>
                                 <Text style={{ fontSize: 10, fontWeight: 'bold', color: getOutcomeColor(proc.outcome) }}>{sanitizeText(proc.outcome) || 'N/A'}</Text>
                              </View>
                          </View>
                      </View>
                      
                      <View style={{ marginBottom: 10 }}>
                          {proc.ttps && proc.ttps.length > 0 && (
                              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
                                  <Text style={styles.tagLabel}>MAPPED TTPs:</Text>
                                  {proc.ttps.map((ttp, tIdx) => (
                                      <Text key={tIdx} style={[styles.tag, { backgroundColor: '#f1f5f9', color: '#334155', borderWidth: 1, borderColor: '#cbd5e1' }]}>{ttp}</Text>
                                  ))}
                              </View>
                          )}

                          {proc.securityControls && proc.securityControls.length > 0 && (
                              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                                  <Text style={styles.tagLabel}>CONTROLS:</Text>
                                  {proc.securityControls.map((sc, scIdx) => (
                                      <Text key={scIdx} style={[styles.tag, { backgroundColor: '#f8fafc', color: '#475569', borderWidth: 1, borderColor: '#e2e8f0' }]}>{sc}</Text>
                                  ))}
                              </View>
                          )}
                      </View>
                      
                      <View style={{ flexDirection: 'row', marginTop: 5, gap: 10 }}>
                          {proc.execNotes && (
                              <View style={{ flex: 1, backgroundColor: '#ffffff', padding: 10, borderRadius: 6, borderWidth: 1, borderColor: '#e2e8f0' }}>
                                  <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#dc2626', marginBottom: 6, textTransform: 'uppercase', borderBottomWidth: 1, borderBottomColor: '#fee2e2', paddingBottom: 4 }}>Red Team Notes</Text>
                                  <Text style={{ fontSize: 10, color: '#334155', lineHeight: 1.5, wordBreak: 'break-word' }}>{sanitizeText(proc.execNotes)}</Text>
                              </View>
                          )}
                          {proc.detNotes && (
                              <View style={{ flex: 1, backgroundColor: '#ffffff', padding: 10, borderRadius: 6, borderWidth: 1, borderColor: '#e2e8f0' }}>
                                  <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#2563eb', marginBottom: 6, textTransform: 'uppercase', borderBottomWidth: 1, borderBottomColor: '#dbeafe', paddingBottom: 4 }}>Blue Team Notes</Text>
                                  <Text style={{ fontSize: 10, color: '#334155', lineHeight: 1.5, wordBreak: 'break-word' }}>{sanitizeText(proc.detNotes)}</Text>
                              </View>
                          )}
                          {(!proc.execNotes && !proc.detNotes) && (
                              <View style={{ flex: 1, backgroundColor: '#ffffff', padding: 10, borderRadius: 6, borderWidth: 1, borderColor: '#e2e8f0' }}>
                                <Text style={{ fontSize: 10, color: '#94a3b8', fontStyle: 'italic' }}>No execution or detection notes provided.</Text>
                              </View>
                          )}
                      </View>

                      {proc.evidence && proc.evidence.length > 0 && (
                         <View style={{ marginTop: 12 }}>
                            <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>Attached Evidence</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                                {proc.evidence.map((img, k) => (
                                   <Image key={k} src={img} style={{ width: 140, height: 90, objectFit: 'contain', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 4, marginRight: 10, marginBottom: 10, backgroundColor: '#ffffff' }} />
                                ))}
                            </View>
                         </View>
                      )}
                  </View>
                  );
               })
            ) : (
               events.map((ex, i) => {
                 const badgeStyle = ex.status === 'high' ? styles.badgeHigh : ex.status === 'medium' ? styles.badgeMedium : styles.badgeLow;
                 return (
                   <View key={i} style={{ borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 15, marginBottom: 15 }} wrap={false}>
                     <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, alignItems: 'center' }}>
                        <View>
                           <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#1e293b' }}>{ex.ttp}</Text>
                           <Text style={{ fontSize: 10, color: '#64748b' }}>Legacy Record</Text>
                        </View>
                        <View style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: '#e2e8f0' }}>
                           <Text style={[styles.tdText, badgeStyle]}>Overall: {sanitizeText((() => {
                                 if (ex.finding?.includes('[Validation Re-Test]')) {
                                     return 'Missed -> Prevented (Verified)';
                                 }

                                 let text = ex.finding || ex.status || 'Missed';
                                 if (text.includes('**Aggregated')) {
                                     text = text.split('\n')[0].split(':')[1]?.replace(/\*\*/g, '').trim() || text;
                                 } else if (text.includes('Outcome:')) {
                                     text = text.split('-')[0].replace('Outcome:', '').trim();
                                 }
                                 if (text.includes('**[Validation Re-Test Successful]**')) {
                                     text = text.replace('**[Validation Re-Test Successful]**', '').trim();
                                 } else if (text.includes('**[Validation Re-Test Notes]**')) {
                                     text = text.replace('**[Validation Re-Test Notes]**', '').trim();
                                 }
                                 
                                 text = text.replace(/\s*\(\d+%\)/g, '').trim();
                                 
                                 return text;
                           })())}</Text>
                        </View>
                     </View>
                     <Text style={styles.tdLabel}>Notes</Text>
                     <Text style={{ fontSize: 10, color: '#475569', marginBottom: 8, wordBreak: 'break-word' }}>{sanitizeText(ex.remediation) || 'N/A'}</Text>
                   </View>
                 );
               })
            )}
          </View>
        </View>
      </Page>
      
      {evidence && evidence.length > 0 && (!testResults || testResults.length === 0) && (
         <Page size="A4" style={styles.page}>
           <Text style={styles.sectionTitle}>Attached Evidence</Text>
           <View style={styles.evidenceGrid}>
             {evidence.map((b64, idx) => (
                <Image key={idx} src={b64} style={styles.evidenceImg} />
             ))}
           </View>
         </Page>
      )}
    </Document>
  );
};

export default ReportPDF;
