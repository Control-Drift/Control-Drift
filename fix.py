import sys

with open('src/components/features/AttackPath.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove the button from the gap node card
target_node_button = '''                                                        {/* Payload Button */}
                                                        {(() => {
                                                            let rawPayload = '';
                                                            let isPayloadCode = false;
                                                            if (simulationSummaries) {
                                                                const gapTTPs = (gap.ttp || '').split(',').map(t => t.trim()).filter(Boolean);
                                                                const procMatcher = (r) => (gap.finding && r.name && r.name.toLowerCase() === gap.finding.toLowerCase()) || (r.ttps && gapTTPs.length > 0 && r.ttps.some(t => gapTTPs.includes(t)));
                                                                const simSummary = Object.values(simulationSummaries).find(s => s.name === gap.simulation || s.id === gap.simulation);
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
                                                            }
                                                            if (!rawPayload) return null;
                                                            
                                                            return (
                                                                <div style={{ marginTop: '10px' }}>
                                                                    <button 
                                                                        onClick={(e) => { e.stopPropagation(); setSelectedGap(gap); setShowGapCode(true); }}
                                                                        className="btn hover-lift"
                                                                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', padding: '4px 8px', fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '4px', borderRadius: '4px', fontWeight: 'bold' }}
                                                                    >
                                                                        <Code size={12} /> {isPayloadCode ? 'Payload' : 'Procedure'}
                                                                    </button>
                                                                </div>
                                                            );
                                                        })()}
'''
if target_node_button in content:
    content = content.replace(target_node_button, '')
else:
    print('Failed to find target_node_button')

# 2. Modify details card to show payload always instead of using a toggle button
target_modal_button = '''                                            {rawPayload && (
                                                <button 
                                                    onClick={() => setShowGapCode(!showGapCode)} 
                                                    className="btn hover-lift" 
                                                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', padding: '6px 12px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px', borderRadius: '6px', fontWeight: 'bold' }}
                                                >
                                                    <Code size={16} /> {showGapCode ? 'Hide' : 'View'} {isPayloadCode ? 'Payload' : 'Procedure Steps'}
                                                </button>
                                            )}
                                        </div>
                                        {showGapCode && rawPayload && (
                                            <div className="animate-fade-in" style={{ background: '#0a0a0a', padding: '20px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '0.9rem', color: '#10b981', overflowX: 'auto', border: '1px solid rgba(16,185,129,0.3)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', marginBottom: '10px', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)' }}>
                                                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                                                    {rawPayload}
                                                </pre>
                                            </div>
                                        )}'''

replacement_modal_button = '''                                        </div>
                                        {rawPayload && (
                                            <div className="animate-fade-in" style={{ background: '#0a0a0a', padding: '20px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '0.9rem', color: '#10b981', overflowX: 'auto', border: '1px solid rgba(16,185,129,0.3)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', marginBottom: '10px', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)' }}>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 'bold' }}>{isPayloadCode ? 'Raw Payload' : 'Procedure Steps'}</div>
                                                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                                                    {rawPayload}
                                                </pre>
                                            </div>
                                        )}'''

if target_modal_button in content:
    content = content.replace(target_modal_button, replacement_modal_button)
else:
    print('Failed to find target_modal_button')

with open('src/components/features/AttackPath.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done!')
