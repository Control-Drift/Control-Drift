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

style_to_inject = ", wordBreak: 'break-all', overflowWrap: 'anywhere', minWidth: 0, flexShrink: 1, maxHeight: '100%', overflowY: 'auto'"

for comp in components_to_patch:
    filepath = os.path.join(base_dir, comp)
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        continue
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # Find all style={{ ... }} and inject our styles right before the closing }}
    # We will only target divs to avoid breaking non-layout elements too much, or just all style blocks
    
    # We will look for style={{...}}
    # A simple regex to find style={{...}}
    def replacer(match):
        inner = match.group(1)
        # avoid double injecting
        if "wordBreak:" in inner:
            return match.group(0)
        return f"style={{{inner}{style_to_inject}}}"

    patched_content = re.sub(r'style=\{\{(.*?)\}\}', replacer, content, flags=re.DOTALL)
    
    # Also add it to divs that don't have style but have className="glass-panel"
    # Actually, a simpler way is to replace className="glass-panel" with className="glass-panel" style={{ wordBreak: 'break-all', overflowWrap: 'anywhere', minWidth: 0, flexShrink: 1, maxHeight: '100%', overflowY: 'auto' }}
    # But some might already have style.
    
    # Let's just do the style={{...}} injection first.
    # What if a glass-panel doesn't have a style prop?
    # We can inject style={{ wordBreak: 'break-all', overflowWrap: 'anywhere', minWidth: 0, flexShrink: 1, maxHeight: '100%', overflowY: 'auto' }} into any <div className="glass-panel" or <div className="animate-fade-in" that doesn't have style.
    
    def add_style_to_class(match):
        class_attr = match.group(0)
        return f'{class_attr} style={{{{ wordBreak: "break-all", overflowWrap: "anywhere", minWidth: 0, flexShrink: 1, maxHeight: "100%", overflowY: "auto" }}}}'

    # Find <div className="glass-panel"> without style
    patched_content = re.sub(r'className="glass-panel"(?!\s*style)', add_style_to_class, patched_content)
    patched_content = re.sub(r'className="animate-fade-in"(?!\s*style)', add_style_to_class, patched_content)
    
    # Write back
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(patched_content)
        
    print(f"Patched {comp}")
