const fs = require('fs');

const dataPath = './synthetic_stress_data.json';
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const zalgoText = "T̐̒o̿̉ȏ̐ M̽͑û̚c̽̚h̾̈́ T͒͒e̎̉x͛̚ẗ́͗ T̐̒o̿̉ȏ̐ M̽͑û̚c̽̚h̾̈́ T͒͒e̎̉x͛̚ẗ́͗ T̐̒o̿̉ȏ̐ M̽͑û̚c̽̚h̾̈́ T͒͒e̎̉x͛̚ẗ́͗ T̐̒o̿̉ȏ̐ M̽͑û̚c̽̚h̾̈́ T͒͒e̎̉x͛̚ẗ́͗";
const longA = "A".repeat(5000);
const unbrokenUnicode = "ಠ_ಠ ".repeat(1000).replace(/ /g, "");

// Modify first 5 exercises
for (let i = 0; i < 5; i++) {
  data.exercises[i].execNotes = longA;
  data.exercises[i].detNotes = unbrokenUnicode;
  data.exercises[i].finding = zalgoText;
  data.exercises[i].campaign = "CHAOS_CAMPAIGN_1";
}

// Modify first 5 gaps
for (let i = 0; i < 5; i++) {
  data.gaps[i].finding = zalgoText;
  data.gaps[i].remediation = longA;
  data.gaps[i].ttp = "T1003.001";
}

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
console.log('Injected chaos into first 5 exercises and gaps.');
