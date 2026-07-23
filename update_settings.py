import os

path = r'C:\Users\thoma\.gemini\antigravity\scratch\control-drift\src\components\pages\Settings.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. AI Block
ai_start = """        {expandedPanels.ai && (
          <div className="panel-content glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>"""
ai_replace_start = """        <div style={{ display: 'grid', gridTemplateRows: expandedPanels.ai ? '1fr' : '0fr', transition: 'grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ paddingTop: '15px', opacity: expandedPanels.ai ? 1 : 0, transition: 'opacity 0.2s ease-in-out', pointerEvents: expandedPanels.ai ? 'auto' : 'none' }}>
              <div className="panel-content glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>"""
content = content.replace(ai_start, ai_replace_start)

ai_end = """            )}
          </div>
        )}"""
ai_replace_end = """            )}
              </div>
            </div>
          </div>
        </div>"""
content = content.replace(ai_end, ai_replace_end)

# 2. DB Block
db_start = """        {expandedPanels.db && (
        <>"""
db_replace_start = """        <div style={{ display: 'grid', gridTemplateRows: expandedPanels.db ? '1fr' : '0fr', transition: 'grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ paddingTop: '15px', opacity: expandedPanels.db ? 1 : 0, transition: 'opacity 0.2s ease-in-out', pointerEvents: expandedPanels.db ? 'auto' : 'none' }}>"""
content = content.replace(db_start, db_replace_start)

db_end = """        </>
        )}
      </div>"""
db_replace_end = """            </div>
          </div>
        </div>
      </div>"""
content = content.replace(db_end, db_replace_end)

# 3. Taxonomy Block
tax_start = """        {expandedPanels.taxonomy && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>"""
tax_replace_start = """        <div style={{ display: 'grid', gridTemplateRows: expandedPanels.taxonomy ? '1fr' : '0fr', transition: 'grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ paddingTop: '15px', opacity: expandedPanels.taxonomy ? 1 : 0, transition: 'opacity 0.2s ease-in-out', pointerEvents: expandedPanels.taxonomy ? 'auto' : 'none' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>"""
content = content.replace(tax_start, tax_replace_start)

tax_end = """        </div>
        )}
      </div>"""
tax_replace_end = """              </div>
            </div>
          </div>
        </div>
      </div>"""
content = content.replace(tax_end, tax_replace_end)

# Fix margins
content = content.replace("marginBottom: expandedPanels.ai ? '25px' : '0'", "marginBottom: 0")
content = content.replace("marginBottom: expandedPanels.db ? '15px' : '0'", "marginBottom: 0")
content = content.replace("marginBottom: expandedPanels.taxonomy ? '25px' : '0'", "marginBottom: 0")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Done replacing settings animations.")
