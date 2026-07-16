const opentype = require('opentype.js');

async function main() {
  const urls = [
    'https://raw.githubusercontent.com/google/fonts/main/ofl/chakrapetch/ChakraPetch-Bold.ttf',
    'https://raw.githubusercontent.com/google/fonts/main/ofl/quantico/Quantico-Bold.ttf',
    'https://raw.githubusercontent.com/google/fonts/main/ofl/russoone/RussoOne-Regular.ttf'
  ];

  for (const fontUrl of urls) {
    console.log("Trying:", fontUrl);
    const res = await fetch(fontUrl);
    if (!res.ok) {
      console.log("Failed:", res.status);
      continue;
    }
    const buffer = await res.arrayBuffer();
    const font = opentype.parse(buffer);
    
    // Font size 28, y=24
    const controlPath = font.getPath('CONTROL', 0, 24, 28).toPathData(2);
    const driftPath = font.getPath('DRIFT', 170, 24, 28).toPathData(2); 
    
    console.log("=== " + fontUrl.split('/').pop() + " ===");
    console.log("CONTROL:\n" + controlPath);
    console.log("DRIFT:\n" + driftPath);
  }
}

main().catch(console.error);
