import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TAXONOMY_CACHE_PATH = './mitre_stix_cache.json';

function generateExercises(count) {
    const arr = [];
    for (let i = 0; i < count; i++) {
        arr.push({
            id: `mock-ex-${i}`,
            ttp: 'T1059.001',
            status: i % 2 === 0 ? 'high' : 'low',
            date: new Date().toISOString()
        });
    }
    return arr;
}

const mockExs = generateExercises(100000);
const db = {
    exercises: mockExs,
    gaps: [],
    campaignSummaries: {},
    campaignEvidence: {}
};

console.log("=========================================");
console.log("PROFILING SERIALIZATION AND DISK WRITE");
console.log("=========================================");

const t0 = performance.now();
const jsonStr = JSON.stringify(db, null, 2);
const t1 = performance.now();
console.log(`- JSON.stringify (100,000 exercises): ${(t1 - t0).toFixed(2)} ms`);
console.log(`- JSON size: ${(jsonStr.length / 1024 / 1024).toFixed(2)} MB`);

const tempPath = './temp_stress_test.json';
const t2 = performance.now();
fs.writeFileSync(tempPath, jsonStr, 'utf8');
const t3 = performance.now();
console.log(`- fs.writeFileSync: ${(t3 - t2).toFixed(2)} ms`);

if (fs.existsSync(tempPath)) {
    fs.unlinkSync(tempPath);
}

console.log("=========================================");
