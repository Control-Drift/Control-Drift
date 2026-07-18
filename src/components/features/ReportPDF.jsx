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
    return String(text).replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
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
    borderBottomColor: '#3b82f6', // Professional generic blue
    paddingBottom: 20,
    marginBottom: 30,
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
    marginTop: 25,
    marginBottom: 15,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  metricsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
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
    if (!outcome) return '#dc2626'; // Missed default
    if (outcome.includes(' ➔ ')) outcome = outcome.split(' ➔ ')[1];
    
    if (outcome === 'Prevented & Alerted' || outcome === 'Prevented' || outcome === 'Alerted') {
        return '#059669'; // Green
    } else if (outcome === 'Prevented') {
        return '#06b6d4'; // Cyan
    } else if (outcome === 'Logged') {
        return '#d97706'; // Orange
    } else if (outcome === 'Missed' || outcome === 'Error') {
        return '#dc2626'; // Red
    }
    return '#64748b'; // Gray for N/A or unknown
};

const getSeverityColor = (severity) => {
    if (severity === 'Critical') return { bg: '#f3e8ff', text: '#7e22ce' }; // Purple
    if (severity === 'High') return { bg: '#fef2f2', text: '#dc2626' }; // Red
    if (severity === 'Medium') return { bg: '#fff7ed', text: '#ea580c' }; // Orange
    if (severity === 'Low') return { bg: '#fefce8', text: '#ca8a04' }; // Yellow
    if (severity === 'Info') return { bg: '#f1f5f9', text: '#475569' }; // Slate
    return { bg: '#f8fafc', text: '#64748b' }; // Default
};

const getCoverageColor = (coverage) => {
    if (coverage === 'Optimal') return { bg: '#dcfce7', text: '#15803d' };
    if (coverage === 'Partial') return { bg: '#fef3c7', text: '#b45309' };
    if (coverage === 'Minimal') return { bg: '#ffedd5', text: '#c2410c' };
    if (coverage === 'None') return { bg: '#fee2e2', text: '#b91c1c' };
    return { bg: '#f1f5f9', text: '#475569' };
};

const ReportPDF = ({ simulationName, date, summary, events, testResults, participants, blocked, medium, minimal, missed, total, evidence, tags = [] }) => {
  const renderSummary = (text) => {
    if (!text) return <Text style={styles.summaryText}>No executive summary provided.</Text>;
    
    return text.split('\n').map((line, idx) => {
      const cleanLine = line.replace(/#|\*/g, '').trim().toLowerCase();
      if (cleanLine === 'executive summary') return null;
      if (cleanLine.startsWith('participants:')) return null;
      if (line.startsWith('### ')) {
         return <Text key={idx} style={{ fontSize: 13, fontWeight: 'bold', color: '#1e3a8a', marginTop: 15, marginBottom: 8 }}>{sanitizeText(line.replace('### ', ''))}</Text>;
      } else if (line.startsWith('## ')) {
         return <Text key={idx} style={{ fontSize: 15, fontWeight: 'bold', color: '#172554', marginTop: 20, marginBottom: 10 }}>{sanitizeText(line.replace('## ', ''))}</Text>;
      } else if (line.startsWith('# ')) {
         return <Text key={idx} style={{ fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginTop: 25, marginBottom: 12 }}>{sanitizeText(line.replace('# ', ''))}</Text>;
      } else if (line.startsWith('**') && line.endsWith('**')) {
         return <Text key={idx} style={{ fontSize: 11, fontWeight: 'bold', color: '#1e293b', marginTop: 10, marginBottom: 4 }}>{sanitizeText(line.replace(/\*\*/g, ''))}</Text>;
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
         return (
            <View key={idx} style={{ flexDirection: 'row', marginBottom: 4, paddingLeft: 10 }}>
               <Text style={{ fontSize: 11, color: '#334155', marginRight: 6 }}>•</Text>
               <Text style={{ fontSize: 11, lineHeight: 1.5, color: '#334155', flex: 1 }}>{sanitizeText(line.substring(2).replace(/\*\*/g, ''))}</Text>
            </View>
         );
      } else if (line.trim() === '') {
         return null;
      } else {
         return <Text key={idx} style={styles.summaryText}>{sanitizeText(line.replace(/\*/g, '').replace(/\*\*/g, ''))}</Text>;
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
            {participants && (
               <Text style={{ fontSize: 9, color: '#475569', marginTop: 10 }}>PARTICIPANTS: {sanitizeText(participants)}</Text>
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
                                  {proc.outcome?.includes(' ➔ ') ? '  [Re-Tested ✓]' : ''}
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
                                     return 'Missed ➔ Prevented ✓';
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
