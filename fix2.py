import sys

with open('src/components/features/AttackPath.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

target = '''                                        </div>
                                        {rawPayload && (
                                            <div className="animate-fade-in" style={{ background: '#0a0a0a', padding: '20px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '0.9rem', color: '#10b981', overflowX: 'auto', border: '1px solid rgba(16,185,129,0.3)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', marginBottom: '10px', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)' }}>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 'bold' }}>{isPayloadCode ? 'Raw Payload' : 'Procedure Steps'}</div>
                                                <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                                                    {rawPayload}
                                                </pre>
                                            </div>
                                        )}'''

replacement = '''                                            {rawPayload && (
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

if target in content:
    content = content.replace(target, replacement)
    with open('src/components/features/AttackPath.jsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print('Done!')
else:
    print('Failed to find target')
