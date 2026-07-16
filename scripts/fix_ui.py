import os
import re

components_to_patch = [
    "MitreHeatmap.jsx",
    "GapTracker.jsx",
    "Reports.jsx",
    "ExerciseWizard.jsx",
    "GapDetails.jsx"
]

base_dir = r"C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\src\components"

# The exact injected string:
# ", wordBreak: 'break-all', overflowWrap: 'anywhere', minWidth: 0, flexShrink: 1, maxHeight: '100%', overflowY: 'auto'"

bad_style_pattern = r"style=\{([\s\S]*?), wordBreak: 'break-all', overflowWrap: 'anywhere', minWidth: 0, flexShrink: 1, maxHeight: '100%', overflowY: 'auto'\}"

def fix_style(match):
    inner = match.group(1)
    # Restore correct double braces and include the styles
    return f"style={{{{ {inner}, wordBreak: 'break-all', overflowWrap: 'anywhere', minWidth: 0, flexShrink: 1, maxHeight: '100%', overflowY: 'auto' }}}}"

for comp in components_to_patch:
    filepath = os.path.join(base_dir, comp)
    if not os.path.exists(filepath):
        continue
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Fix the improperly injected style braces
    fixed_content = re.sub(bad_style_pattern, fix_style, content)
    
    # Also we injected className="glass-panel" style={{ wordBreak... }} where style was missing
    # Let's check how that injected.
    # In my previous script:
    # def add_style_to_class(match):
    #     class_attr = match.group(0)
    #     return f'{class_attr} style={{{{ wordBreak: "break-all", overflowWrap: "anywhere", minWidth: 0, flexShrink: 1, maxHeight: "100%", overflowY: "auto" }}}}'
    # That one uses f'{class_attr} style={{{{ ... }}}}', which results in `className="glass-panel" style={{ ... }}`. That is correct!
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(fixed_content)
        
    print(f"Fixed {comp}")
