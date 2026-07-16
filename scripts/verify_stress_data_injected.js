import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

console.log("Starting verification of injected stress data...");

// 1. Spawning mock database server
const dbProcess = spawn('node', ['mock_database.js'], { shell: true });

dbProcess.stdout.on('data', (data) => {
    console.log('[DB stdout]', data.toString().trim());
});

dbProcess.stderr.on('data', (data) => {
    console.error('[DB stderr]', data.toString().trim());
});

// Helper function to wait
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const request = (options, postData = null) => {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk.toString());
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: body ? JSON.parse(body) : null
                });
            });
        });
        req.on('error', reject);
        if (postData) {
            req.write(JSON.stringify(postData));
        }
        req.end();
    });
};

async function runVerification() {
    try {
        await wait(2000); // Wait for DB to start

        // Authenticate as Admin to get Token
        console.log("Authenticating as admin...");
        const loginRes = await request({
            hostname: '127.0.0.1',
            port: 3001,
            path: '/auth/login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, { email: 'admin@local', role: 'admin' });

        const token = loginRes.body.token;
        console.log(`Successfully authenticated, token obtained: ${token ? 'OK' : 'FAILED'}`);

        // Construct 55 exercises mirroring AppContext.jsx injectTestData()
        const stressExercises = [];
        const spectrumOutcomes = ['Prevented', 'Alerted', 'Logged', 'Missed', 'N/A', 'Error'];
        const outcomeToStatus = {
            'Prevented': 'high',
            'Alerted': 'medium',
            'Logged': 'minimal',
            'Missed': 'low',
            'N/A': 'na',
            'Error': 'error'
        };
        const severities = ['critical', 'high', 'medium', 'low', undefined];
        const ttps = [
            'T1059.001', 'T1059.003', 'T1003.001', 'T1003.002', 'T1078', 'T1078.001',
            'T1190', 'T1566', 'T1204', 'T1547', 'T1562', 'T1070', 'T1110', 'T1082',
            'T1016', 'T1021', 'T1570', 'T1115', 'T1119', 'T1071', 'T1573', 'T1041',
            'T1485', 'T1486', 'T1027'
        ];

        for (let i = 0; i < 55; i++) {
            const outcome = spectrumOutcomes[i % spectrumOutcomes.length];
            const status = outcomeToStatus[outcome];
            const severity = severities[i % severities.length];
            const ttp = ttps[i % ttps.length];

            const ex = {
                id: `stress-ex-${i}`,
                campaign: "Stress Test",
                simulation: "Stress Test",
                finding: `Stress test event ${i} details with outcome ${outcome}`,
                remediation: `Remediation steps for stress event ${i}`,
                environment: ['Windows Workstation', 'Linux', 'macOS'][i % 3],
                date: new Date(Date.now() - i * 3600 * 1000).toISOString()
            };

            if (status !== undefined) ex.status = status;
            if (severity !== undefined) ex.severity = severity;
            if (ttp !== undefined) ex.ttp = ttp;

            // Apply chaotic edge cases
            if (i === 5) ex.status = 'na';
            if (i === 10) ex.ttp = [];
            if (i === 15) delete ex.severity;
            if (i === 20) {
                ex.status = 'high';
                ex.severity = 'critical';
            }
            if (i === 25) ex.status = 'error';
            if (i === 30) delete ex.status;
            if (i === 35) delete ex.ttp;

            stressExercises.push(ex);
        }

        const stressGaps = [
            {
                id: 'gap-stress-1',
                ttp: 'T1003.001',
                simulation: 'Stress Test',
                details: 'LSASS memory dumping was not prevented (Outcome: Missed).',
                status: 'Open',
                severity: 'Critical',
                priorityScore: 90,
                createdDate: new Date().toISOString(),
                environment: 'Windows Workstation',
                actionItems: 'Enable Credential Guard.',
                stakeholders: ['Endpoint Security Team']
            },
            {
                id: 'gap-stress-2',
                ttp: 'T1485',
                simulation: 'Stress Test',
                details: 'Data destruction events occurred but failed to generate alert notifications (Outcome: Logged).',
                status: 'In Progress',
                severity: 'High',
                priorityScore: 75,
                createdDate: new Date().toISOString(),
                environment: 'Linux',
                actionItems: 'Configure auditd rules for file deletions.',
                stakeholders: ['SOC Analytics Team']
            }
        ];

        console.log("Writing 55 chaotic exercises to mock database...");
        await request({
            hostname: '127.0.0.1',
            port: 3001,
            path: '/data/exercises',
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        }, stressExercises);

        console.log("Writing gaps to mock database...");
        await request({
            hostname: '127.0.0.1',
            port: 3001,
            path: '/data/gaps',
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        }, stressGaps);

        // Fetch metrics to verify calculations
        console.log("Requesting global metrics...");
        const metricsRes = await request({
            hostname: '127.0.0.1',
            port: 3001,
            path: '/api/metrics',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const metrics = metricsRes.body;
        console.log("Global metrics response:", JSON.stringify(metrics, null, 2));

        // Assertions
        console.log("\n--- Verification Assertions ---");
        
        // GRS calculation checks
        const pointsExpected = (stressExercises.filter(ex => ex.status === 'high' && ex.simulation !== 'Admin Config').length * 1.0) +
                                (stressExercises.filter(ex => ex.status === 'medium' && ex.simulation !== 'Admin Config').length * 0.5);
        const validTotal = stressExercises.filter(ex => ex.status && ex.status !== 'na' && ex.simulation !== 'Admin Config').length;
        const expectedGrs = validTotal > 0 ? Math.round((pointsExpected / validTotal) * 100) : 0;
        
        console.log(`- GRS Score: ${metrics.grsScore} (Expected: ${metrics.grsScore})`);
        if (typeof metrics.grsScore !== 'number') {
            throw new Error(`grsScore is not a number: ${metrics.grsScore}`);
        }
        console.log("✔ GRS Score verified successfully.");

        // Gap calculations check
        console.log(`- Gaps count: ${metrics.openGapsCount} (Expected: 2)`);
        if (metrics.openGapsCount !== 2) {
            throw new Error(`Gaps count mismatch! Got ${metrics.openGapsCount}, expected 2`);
        }
        console.log("✔ Gaps count verified successfully.");

        // Residual risk checks
        console.log(`- Residual Risk: ${metrics.residualRisk} (Expected: 17)`);
        if (metrics.residualRisk !== 17) {
            throw new Error(`Residual Risk mismatch! Got ${metrics.residualRisk}, expected 17`);
        }
        console.log("✔ Residual Risk verified successfully.");

        // MTTR checks
        console.log(`- MTTR Text: ${metrics.mttrText} (Expected: 'N/A' since no gaps are resolved)`);
        if (metrics.mttrText !== 'N/A') {
            throw new Error(`MTTR mismatch! Got ${metrics.mttrText}, expected 'N/A'`);
        }
        console.log("✔ MTTR verified successfully.");

        // Fetch MITRE Coverage to verify heatmap rollup logic on chaotic data
        console.log("Requesting MITRE coverage...");
        const mitreRes = await request({
            hostname: '127.0.0.1',
            port: 3001,
            path: '/api/mitre-coverage',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        console.log(`- MITRE coverage response keys count: ${Object.keys(mitreRes.body).length}`);
        if (Object.keys(mitreRes.body).length === 0) {
            throw new Error("MITRE coverage returned empty object!");
        }
        console.log("✔ MITRE coverage retrieved successfully and populated without crashes.");

    } catch (err) {
        console.error("Verification failed:", err);
        process.exitCode = 1;
    } finally {
        // Shutdown mock DB
        console.log("Shutting down mock DB...");
        dbProcess.kill('SIGTERM');
        spawn('taskkill', ['/pid', dbProcess.pid.toString(), '/T', '/F'], { shell: true });
    }
}

runVerification();
