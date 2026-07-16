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
injected_str = ", wordBreak: 'break-all', overflowWrap: 'anywhere', minWidth: 0, flexShrink: 1, maxHeight: '100%', overflowY: 'auto'"

for comp in components_to_patch:
    filepath = os.path.join(base_dir, comp)
    if not os.path.exists(filepath):
        continue
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Step 1: Remove the injected string entirely
    # It might be followed by } or }}
    content = content.replace(injected_str, "")
    
    # Step 2: Now we might have broken braces, like `style={ display: 'block' }` instead of `style={{ display: 'block' }}`
    # Or `style={{ { color: 'var(--text-secondary)' }` instead of `style={{ color: 'var(--text-secondary)' }}`
    # Because we removed the injected string, those lines might look like:
    # `style={ display: 'block' }` -> wait, originally it was `style={ display: 'block' , wordBreak... }`
    # Now it is `style={ display: 'block' }` OR `style={{  display: 'block' }}` depending on if fix_ui touched it.
    
    # Let's fix the specific patterns:
    
    # Pattern A: style={ key: value, ... } -> needs to be style={{ key: value, ... }}
    # How to identify? `style={` followed by a word character, not `{`.
    def fix_single_brace(match):
        inner = match.group(1)
        # Only fix if it looks like an object literal without outer braces
        # i.e., contains a colon, and not starting with `{` or quote
        if re.match(r'^\s*[a-zA-Z0-9_]+\s*:', inner):
            return f"style={{{{ {inner} }}}}"
        return match.group(0)
    
    content = re.sub(r'style=\{([^\{\}]+)\}', fix_single_brace, content)
    
    # Pattern B: style={{ { ... } }} -> caused by our greedy fix_ui.
    # We should just replace `style={{ { ` with `style={{ `
    content = content.replace("style={{ { ", "style={{ ")
    
    # Pattern C: style={ { ... } } that might have been mangled?
    # No, `style={{ {` was exactly what was printed. Let's check `style={{ { color:`
    
    # What about the injected `className="glass-panel" style={{ wordBreak... }}`?
    # Since we removed the injected string, it might now be `className="glass-panel" style={{ }}`
    content = content.replace('className="glass-panel" style={{  }}', 'className="glass-panel"')
    content = content.replace('className="animate-fade-in" style={{  }}', 'className="animate-fade-in"')
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print(f"Cleaned {comp}")
