import sys

with open('src/components/pages/Reports.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

target = '''                                      <td style={{  padding: '15px 10px', verticalAlign: 'top', width: '30%'  }}>
                                          <div><span style={{  color: 'var(--text-secondary)'  }}>{ex.remediation || 'N/A'}</span></div>
                                      </td>
                                   </tr>
                                );'''

replacement = '''                                      <td style={{  padding: '15px 10px', verticalAlign: 'top', width: '30%'  }}>
                                          <div><span style={{  color: 'var(--text-secondary)'  }}>{ex.remediation || 'N/A'}</span></div>
                                          {(() => {
                                              let rawPayload = '';
                                              let isPayloadCode = false;
                                              const gapTTPs = (ex.ttp || '').split(',').map(t => t.trim()).filter(Boolean);
                                              const procMatcher = (r) => (ex.finding && r.name && r.name.toLowerCase() === ex.finding.toLowerCase()) || (r.ttps && gapTTPs.length > 0 && r.ttps.some(t => gapTTPs.includes(t)));
                                              const simSummary = simulationSummaries[selectedSimulation];
                                              if (simSummary && simSummary.testResults) {
                                                  const foundProcs = simSummary.testResults.filter(procMatcher);
                                                  if (foundProcs.length > 0) {
                                                      const payloadCodes = foundProcs.map(r => r.payloadCode).filter(Boolean);
                                                      const procSteps = foundProcs.map(r => r.procedureSteps).filter(Boolean);
                                                      if (payloadCodes.length > 0) {
                                                          rawPayload = payloadCodes.join('\\n\\n');
                                                          isPayloadCode = true;
                                                      } else if (procSteps.length > 0) {
                                                          rawPayload = procSteps.join('\\n\\n');
                                                          isPayloadCode = false;
                                                      }
                                                  }
                                              }
                                              if (!rawPayload) return null;
                                              return (
                                                  <button 
                                                      onClick={() => setViewingCodeData({ type: isPayloadCode ? 'Payload' : 'Procedure', content: rawPayload })} 
                                                      className="btn" 
                                                      style={{  marginTop: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 10px', fontSize: '0.8rem', borderRadius: '4px'   }}
                                                  >
                                                      <Code size={14} /> {isPayloadCode ? 'View Payload' : 'View Procedure Steps'}
                                                  </button>
                                              );
                                          })()}
                                      </td>
                                   </tr>
                                );'''

if target in content:
    content = content.replace(target, replacement)
    with open('src/components/pages/Reports.jsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print('Replaced successfully')
else:
    print('Target not found')
