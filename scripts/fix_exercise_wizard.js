const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'ExerciseWizard.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Replace <button with <button type="button" where it doesn't already have a type
content = content.replace(/<button(?!\s+type=)(.*?)>/g, '<button type="button"$1>');

// Replace <input with <input onKeyDown={e => e.stopPropagation()} where it doesn't already have onKeyDown
content = content.replace(/<input(?!\s+[^>]*onKeyDown=)(.*?)>/g, '<input onKeyDown={e => e.stopPropagation()}$1>');

// Replace <textarea with <textarea onKeyDown={e => e.stopPropagation()} where it doesn't already have onKeyDown
content = content.replace(/<textarea(?!\s+[^>]*onKeyDown=)(.*?)>/g, '<textarea onKeyDown={e => e.stopPropagation()}$1>');

// For the specific textarea that already has onKeyDown, we need to inject e.stopPropagation() inside it.
// The existing one is:
// onKeyDown={e => {
//     if (e.key === 'Enter' && !e.shiftKey) {
content = content.replace(
    /onKeyDown=\{e => \{\s*if \(e\.key === 'Enter' && !e\.shiftKey\) \{/,
    "onKeyDown={e => { e.stopPropagation();\n                                if (e.key === 'Enter' && !e.shiftKey) {"
);

fs.writeFileSync(filePath, content);
console.log("Fixed ExerciseWizard.jsx");
