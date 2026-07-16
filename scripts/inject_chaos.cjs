const fs = require('fs');

const path = 'C:/Users/thoma/.gemini/antigravity/scratch/eclipse-ops/synthetic_stress_data.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

// Chaos generation functions
const zalgo = "T̐̒o̿̉ȏ̐ M̽͑û̚c̽̚h̾̈́ T͒͒e̎̉x͛̚ẗ́͗ T̐̒o̿̉ȏ̐ M̽͑û̚c̽̚h̾̈́ T͒͒e̎̉x͛̚ẗ́͗ ".repeat(50);
const unbrokenString = "A".repeat(10000);
const unbrokenUnicode = "ಠ_ಠ".repeat(2000);

const chaosData = [
    zalgo,
    unbrokenString,
    unbrokenUnicode,
    "<html><body><script>alert('chaos')</script></body></html>".repeat(100)
];

function getRandomChaos() {
    return chaosData[Math.floor(Math.random() * chaosData.length)];
}

// Inject chaos into 10 random exercises
let exIndices = [];
for (let i = 0; i < 10; i++) {
    const idx = Math.floor(Math.random() * data.exercises.length);
    exIndices.push(idx);
    data.exercises[idx].executionNotes = getRandomChaos();
    data.exercises[idx].detectionNotes = getRandomChaos();
    data.exercises[idx].tactic = getRandomChaos();
}

// Inject chaos into 10 random gaps
let gapIndices = [];
for (let i = 0; i < 10; i++) {
    const idx = Math.floor(Math.random() * data.gaps.length);
    gapIndices.push(idx);
    data.gaps[idx].finding = getRandomChaos();
    data.gaps[idx].remediation = getRandomChaos();
    data.gaps[idx].title = getRandomChaos();
    data.gaps[idx].relatedTtp = getRandomChaos();
}

fs.writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');

console.log(`Injected chaos into exercises: ${exIndices.join(', ')}`);
console.log(`Injected chaos into gaps: ${gapIndices.join(', ')}`);
