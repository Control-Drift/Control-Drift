const opentype = require('opentype.js');

async function run() {
  try {
    const cssResponse = await fetch('https://fonts.googleapis.com/css?family=Michroma', {
      headers: {
        'User-Agent': 'curl/7.81.0'
      }
    });
    const cssText = await cssResponse.text();
    const match = cssText.match(/url\((https:\/\/[^)]+\.ttf)\)/);
    const fontUrl = match[1];
    const response = await fetch(fontUrl);
    const buffer = await response.arrayBuffer();
    const font = opentype.parse(buffer);
    
    const fontSize = 24;
    
    function getWordPath(word) {
      let x = 0;
      let path = new opentype.Path();
      for (let i = 0; i < word.length; i++) {
        const char = word[i];
        const glyph = font.charToGlyph(char);
        const glyphPath = glyph.getPath(x, 24, fontSize);
        path.commands.push(...glyphPath.commands);
        x += glyph.advanceWidth * (fontSize / font.unitsPerEm);
      }
      return { path: path.toPathData(), width: x };
    }
    
    const voidData = getWordPath('VOID');
    const trData = getWordPath('TR');
    const vData = getWordPath('V');
    const ceData = getWordPath('CE');
    
    console.log("\n--- PATH DATA ---");
    console.log("VOID:");
    console.log(voidData.path);
    
    console.log("\nTR:");
    console.log(trData.path);
    
    console.log("\nV:");
    console.log(vData.path);
    
    console.log("\nCE:");
    console.log(ceData.path);
    
    console.log("\n--- ADVANCE WIDTHS ---");
    console.log("VOID:", voidData.width);
    console.log("TR:", trData.width);
    console.log("V:", vData.width);
    console.log("CE:", ceData.width);
    
  } catch(e) {
    console.error(e);
  }
}

run();
