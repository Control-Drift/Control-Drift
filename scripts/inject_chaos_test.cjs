const fs = require('fs');
const path = require('path');

const dataPath = 'C:\\Users\\thoma\\.gemini\\antigravity\\scratch\\eclipse-ops\\synthetic_stress_data.json';

// Some chaos strings
const unbrokenA = 'A'.repeat(5000);
const zalgo = 'Z͑ͫ̓ͪ̂ͫ̽͏̴̙̤̞͉͚̯̞̠͍A̴̵̜̰͔ͫ͗͢L̞ͨͧͥG̴̻͈͍͔̹̑͗̎̅͛́Ǫ̵̹̻̝̳͂̌̌͘!̷̝̝̿̋ͨͭ̎!'.repeat(100) + ' T̐̒o̿̉ȏ̐ M̽͑û̚c̽̚h̾̈́ T͒͒e̎̉x͛̚ẗ́͗'.repeat(50);
const noSpaces = 'ThisIsAVeryLongStringThatHasAbsolutelyNoSpacesAndWillProbablyCauseSomeOverflowIssuesIfYouDoNotHandleItCorrectlyWithWordBreakProperties'.repeat(50);
const nestedQuotes = '"""{\'["{\'[{""hello""}]\'}"]\'}"""'.repeat(100);
const htmlInjection = '<script>alert(1)</script><div style="width: 10000px; height: 10000px; background: red;"></div>'.repeat(50);

const chaosStrings = [unbrokenA, zalgo, noSpaces, nestedQuotes, htmlInjection];

function getRandomChaos() {
  return chaosStrings[Math.floor(Math.random() * chaosStrings.length)];
}

try {
  const rawData = fs.readFileSync(dataPath, 'utf8');
  const data = JSON.parse(rawData);
  
  if (data.exercises) {
    for (let i = 0; i < Math.min(5, data.exercises.length); i++) {
        let ex = data.exercises[i];
        if (ex.name !== undefined) ex.name = getRandomChaos();
        if (ex.execNotes !== undefined) ex.execNotes = getRandomChaos();
        if (ex.detNotes !== undefined) ex.detNotes = getRandomChaos();
    }
  }

  if (data.gaps) {
    for (let i = 0; i < Math.min(5, data.gaps.length); i++) {
        let gap = data.gaps[i];
        if (gap.finding !== undefined) gap.finding = getRandomChaos();
        if (gap.remediation !== undefined) gap.remediation = getRandomChaos();
        if (gap.ttp !== undefined) gap.ttp = getRandomChaos();
    }
  }

  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
  console.log('Successfully injected chaos into synthetic_stress_data.json');
} catch (error) {
  console.error('Failed to inject chaos:', error);
}
