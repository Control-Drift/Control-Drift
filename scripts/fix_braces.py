import os

components_to_patch = [
    "MitreHeatmap.jsx",
    "GapTracker.jsx",
    "Reports.jsx",
    "ExerciseWizard.jsx",
    "GapDetails.jsx"
]

base_dir = r"C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\src\components"

for comp in components_to_patch:
    filepath = os.path.join(base_dir, comp)
    if not os.path.exists(filepath):
        continue
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Fix excess closing braces from previous replaces
    content = content.replace("}}}>", "}}>")
    content = content.replace("}}}>", "}}>")
    content = content.replace("}}}", "}}")
    content = content.replace("}} }", "}}")
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        
    print(f"Cleaned braces in {comp}")
