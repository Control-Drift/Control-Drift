const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src', 'components');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx'));

for (const file of files) {
  const filepath = path.join(dir, file);
  let content = fs.readFileSync(filepath, 'utf8');

  if (content.includes('document.body')) {
    // Replace createPortal(..., document.body) across multiple lines if needed
    // Using a simple string replacement for the exact closing tag is safer
    let oldContent = content;
    content = content.replace(/,\s*document\.body\s*\)/g, ", document.getElementById('root'))");
    
    if (oldContent !== content) {
      fs.writeFileSync(filepath, content, 'utf8');
      console.log(`Patched createPortal in ${file}`);
    }
  }
}
