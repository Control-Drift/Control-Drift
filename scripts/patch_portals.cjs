const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src', 'components');

const filesToPatch = [
  'CoverageRatingDropdown.jsx',
  'EventTTPDropdown.jsx',
  'OutcomeDropdown.jsx',
  'SecurityControlsDropdown.jsx',
  'SeverityDropdown.jsx',
  'ValidationOutcomeDropdown.jsx'
];

for (const file of filesToPatch) {
  const filepath = path.join(dir, file);
  let content = fs.readFileSync(filepath, 'utf8');

  // Replace coordinate math
  content = content.replace(
    /const bounds = dropdownRef\.current\.getBoundingClientRect\(\);\s*setRect\(\{\s*top: bounds\.bottom \+ window\.scrollY \+ 5,\s*left: bounds\.left \+ window\.scrollX,\s*width: bounds\.width\s*\}\);/g,
    `const bounds = dropdownRef.current.getBoundingClientRect();
                const scale = window.appScale || 1;
                setRect({
                    top: (bounds.bottom + window.scrollY + 5) / scale,
                    left: (bounds.left + window.scrollX) / scale,
                    width: bounds.width / scale
                });`
  );

  // Replace createPortal(..., document.body)
  content = content.replace(
    /createPortal\(([\s\S]*?),\s*document\.body\s*\)/g,
    `createPortal($1, document.getElementById('root'))`
  );

  fs.writeFileSync(filepath, content, 'utf8');
  console.log(`Patched ${file}`);
}
