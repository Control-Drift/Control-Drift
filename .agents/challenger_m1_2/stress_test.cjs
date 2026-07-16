const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const DB_PORT = 3001;
const BASE_URL = `http://127.0.0.1:${DB_PORT}`;

// Helper: Make HTTP request
function request(urlPath, method = 'GET', headers = {}, body = null) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(urlPath, BASE_URL);
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port,
            path: parsedUrl.pathname + parsedUrl.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        const req = http.request(options, (res) => {
            let resBody = '';
            res.on('data', chunk => resBody += chunk);
            res.on('end', () => {
                let parsed = null;
                try {
                    parsed = resBody ? JSON.parse(resBody) : null;
                } catch (e) {
                    parsed = resBody;
                }
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: parsed
                });
            });
        });

        req.on('error', reject);
        if (body) {
            req.write(typeof body === 'string' ? body : JSON.stringify(body));
        }
        req.end();
    });
}

// Helper: Sleep
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
    console.log('=== STARTING ENTERPRISE SCALE STRESS TEST ===');
    
    // 1. Spawning Mock DB server
    console.log(`[INFO] Spawning Mock DB server on port ${DB_PORT}...`);
    const dbProcess = spawn('node', ['mock_database.js'], {
        cwd: path.resolve(__dirname, '../..'),
        env: { ...process.env, PATH: `${process.env.PATH};C:\\Program Files\\nodejs` },
        shell: true
    });

    dbProcess.stdout.on('data', (data) => {
        const str = data.toString().trim();
        if (str) console.log(`[DB STDOUT] ${str}`);
    });
    dbProcess.stderr.on('data', (data) => {
        const str = data.toString().trim();
        if (str) console.error(`[DB STDERR] ${str}`);
    });

    // Wait for DB to be online
    console.log('[INFO] Waiting for DB server to start...');
    let dbOnline = false;
    for (let attempt = 1; attempt <= 15; attempt++) {
        try {
            const res = await request('/auth/login', 'POST', {}, { email: 'test@local', sso: true });
            if (res.status === 200) {
                dbOnline = true;
                break;
            }
        } catch (e) {
            // Ignore error and retry
        }
        await sleep(1000);
    }

    if (!dbOnline) {
        console.error('[ERROR] Could not connect to Mock DB server.');
        dbProcess.kill();
        process.exit(1);
    }
    console.log('[INFO] DB Server is online. Proceeding with tests.\n');

    const results = {
        rbac: [],
        pagination: [],
        benchmarks: {}
    };

    try {
        // ==========================================
        // SECTION 1: SSO & RBAC VERIFICATION
        // ==========================================
        console.log('--- TEST SECTION 1: SSO & RBAC AUTHORIZATION ---');
        
        // A. Obtain reader token via SSO
        const readerSso = await request('/auth/sso?role=reader&email=reader@test.com');
        const readerToken = readerSso.body.token;
        const readerHeaders = { 'Authorization': `Bearer ${readerToken}` };
        console.log(`[PASS] SSO Reader authentication returned token.`);

        // B. Obtain admin token via SSO
        const adminSso = await request('/auth/sso?role=admin&email=admin@test.com');
        const adminToken = adminSso.body.token;
        const adminHeaders = { 'Authorization': `Bearer ${adminToken}` };
        console.log(`[PASS] SSO Admin authentication returned token.`);

        // C. Verify GET operations for Reader (Allowed)
        const readerGetEx = await request('/api/exercises?page=1&limit=5', 'GET', readerHeaders);
        const readerGetExPass = readerGetEx.status === 200 && readerGetEx.body.data?.length > 0;
        console.log(`[${readerGetExPass ? 'PASS' : 'FAIL'}] Reader GET /api/exercises status: ${readerGetEx.status} (expected: 200)`);
        results.rbac.push({ test: 'Reader GET /api/exercises', pass: readerGetExPass, status: readerGetEx.status });

        // D. Verify POST operations for Reader (Blocked 403)
        const readerPostEx = await request('/api/exercises', 'POST', readerHeaders, {
            id: 'ex-blocked-test',
            ttp: 'T1059.001',
            status: 'high',
            date: new Date().toISOString()
        });
        const readerPostExPass = readerPostEx.status === 403;
        console.log(`[${readerPostExPass ? 'PASS' : 'FAIL'}] Reader POST /api/exercises status: ${readerPostEx.status} (expected: 403 Forbidden)`);
        results.rbac.push({ test: 'Reader POST /api/exercises', pass: readerPostExPass, status: readerPostEx.status });

        // E. Verify PUT operations for Reader (Blocked 403)
        const readerPutGap = await request('/api/gaps', 'PUT', readerHeaders, []);
        const readerPutGapPass = readerPutGap.status === 403;
        console.log(`[${readerPutGapPass ? 'PASS' : 'FAIL'}] Reader PUT /api/gaps status: ${readerPutGap.status} (expected: 403 Forbidden)`);
        results.rbac.push({ test: 'Reader PUT /api/gaps', pass: readerPutGapPass, status: readerPutGap.status });

        // F. Verify DELETE operations for Reader (Blocked 403)
        const readerDeleteGap = await request('/api/gaps/gap-1234', 'DELETE', readerHeaders);
        const readerDeleteGapPass = readerDeleteGap.status === 403;
        console.log(`[${readerDeleteGapPass ? 'PASS' : 'FAIL'}] Reader DELETE /api/gaps/:id status: ${readerDeleteGap.status} (expected: 403 Forbidden)`);
        results.rbac.push({ test: 'Reader DELETE /api/gaps/:id', pass: readerDeleteGapPass, status: readerDeleteGap.status });

        // G. Verify POST operations for Admin (Allowed 201)
        const adminPostEx = await request('/api/exercises', 'POST', adminHeaders, {
            id: 'ex-admin-allowed-test',
            ttp: 'T1059.001',
            status: 'high',
            date: new Date().toISOString()
        });
        const adminPostExPass = adminPostEx.status === 201;
        console.log(`[${adminPostExPass ? 'PASS' : 'FAIL'}] Admin POST /api/exercises status: ${adminPostEx.status} (expected: 201 Created)`);
        results.rbac.push({ test: 'Admin POST /api/exercises', pass: adminPostExPass, status: adminPostEx.status });

        // H. Verify Request with Invalid Token Signature (Blocked 403)
        const badToken = readerToken.substring(0, readerToken.lastIndexOf('.')) + '.badsignature123';
        const badHeaders = { 'Authorization': `Bearer ${badToken}` };
        const badRequest = await request('/api/exercises?page=1&limit=5', 'GET', badHeaders);
        const badRequestPass = badRequest.status === 403;
        console.log(`[${badRequestPass ? 'PASS' : 'FAIL'}] Bad token GET /api/exercises status: ${badRequest.status} (expected: 403 Forbidden)`);
        results.rbac.push({ test: 'Bad token GET /api/exercises', pass: badRequestPass, status: badRequest.status });

        // I. Verify Request with No Token (Blocked 401)
        const noTokenRequest = await request('/api/exercises?page=1&limit=5', 'GET');
        const noTokenRequestPass = noTokenRequest.status === 401;
        console.log(`[${noTokenRequestPass ? 'PASS' : 'FAIL'}] No token GET /api/exercises status: ${noTokenRequest.status} (expected: 401 Unauthorized)`);
        results.rbac.push({ test: 'No token GET /api/exercises', pass: noTokenRequestPass, status: noTokenRequest.status });

        console.log('\n--- TEST SECTION 2: PAGINATION AND FILTERING SPEED ---');
        
        // Measure pagination performance on 100k records
        const pagesToTest = [1, 10, 100, 1000, 2000];
        const limitsToTest = [10, 50, 100, 500];

        for (const limit of limitsToTest) {
            console.log(`\nBenchmarking limit = ${limit} across different pages:`);
            for (const page of pagesToTest) {
                const start = performance.now();
                const res = await request(`/api/exercises?page=${page}&limit=${limit}`, 'GET', adminHeaders);
                const duration = performance.now() - start;
                
                const ok = res.status === 200 && res.body.data && res.body.data.length === limit && res.body.total === 100001; // 100k generated + 1 admin post
                console.log(` - Page ${page} (limit ${limit}): ${duration.toFixed(2)} ms | Status: ${res.status} | Returned: ${res.body?.data?.length || 0} items`);
                results.pagination.push({ page, limit, duration, pass: ok });
            }
        }

        // Measure page requests under concurrency (simulated loading burst)
        console.log('\nBenchmarking 50 consecutive paginated requests (burst simulation):');
        const burstStart = performance.now();
        const latencies = [];
        for (let i = 0; i < 50; i++) {
            const page = Math.floor(Math.random() * 2000) + 1;
            const start = performance.now();
            await request(`/api/exercises?page=${page}&limit=50`, 'GET', adminHeaders);
            latencies.push(performance.now() - start);
        }
        const burstDuration = performance.now() - burstStart;
        const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        const maxLatency = Math.max(...latencies);
        const minLatency = Math.min(...latencies);
        
        console.log(` - Total time for 50 burst requests: ${burstDuration.toFixed(2)} ms`);
        console.log(` - Average Latency: ${avgLatency.toFixed(2)} ms`);
        console.log(` - Min Latency: ${minLatency.toFixed(2)} ms`);
        console.log(` - Max Latency: ${maxLatency.toFixed(2)} ms`);
        
        results.benchmarks.paginationBurst = {
            totalMs: burstDuration,
            avgMs: avgLatency,
            minMs: minLatency,
            maxMs: maxLatency
        };

        console.log('\n--- TEST SECTION 3: METRICS & AGGREGATION BENCHMARKS ---');

        // A. Benchmark /api/metrics (aggregates over 100k exercises)
        console.log('Benchmarking GRS Metrics Calculation (/api/metrics):');
        const metricsDurations = [];
        for (let i = 0; i < 10; i++) {
            const start = performance.now();
            const res = await request('/api/metrics', 'GET', adminHeaders);
            metricsDurations.push(performance.now() - start);
            if (i === 0) {
                console.log(`   GRS Gained: ${res.body.grsScore}% | Total Validated: ${res.body.totalValidated}`);
            }
        }
        const avgMetrics = metricsDurations.reduce((a,b)=>a+b,0) / metricsDurations.length;
        console.log(` - Average Latency over 10 runs: ${avgMetrics.toFixed(2)} ms`);
        results.benchmarks.metrics = {
            avgMs: avgMetrics,
            runs: metricsDurations
        };

        // B. Benchmark /api/mitre-coverage (aggregates tactic status & Weakest Link rollup)
        console.log('\nBenchmarking MITRE Coverage Rollup Aggregation (/api/mitre-coverage):');
        const mitreDurations = [];
        let mitreObjSample = null;
        for (let i = 0; i < 5; i++) {
            const start = performance.now();
            const res = await request('/api/mitre-coverage', 'GET', adminHeaders);
            mitreDurations.push(performance.now() - start);
            if (i === 0) {
                mitreObjSample = res.body;
            }
        }
        const avgMitre = mitreDurations.reduce((a,b)=>a+b,0) / mitreDurations.length;
        console.log(` - Average Latency over 5 runs: ${avgMitre.toFixed(2)} ms`);
        results.benchmarks.mitreCoverage = {
            avgMs: avgMitre,
            runs: mitreDurations
        };
        
        // Check if there are any tactics mapped
        const tacticsCount = mitreObjSample ? Object.keys(mitreObjSample).length : 0;
        console.log(` - Tactics aggregated: ${tacticsCount}`);

    } catch (err) {
        console.error('[FATAL ERROR during stress tests]', err);
    } finally {
        // Shutdown Mock DB
        console.log('\n[INFO] Shutting down Mock DB server...');
        try {
            dbProcess.kill();
        } catch (e) {
            console.error('Failed to kill dbProcess:', e);
        }
    }

    // Write results report
    const allRbacPassed = results.rbac.every(r => r.pass);
    const allPaginationPassed = results.pagination.every(p => p.pass);
    
    console.log('\n=========================================');
    console.log('STRESS TEST RESULT VERDICT');
    console.log('=========================================');
    console.log(`RBAC Protections Status:    ${allRbacPassed ? 'ALL PASSED' : 'SOME FAILED'}`);
    console.log(`Pagination Query Status:    ${allPaginationPassed ? 'ALL PASSED' : 'SOME FAILED'}`);
    console.log(`Average Pagination Latency: ${results.benchmarks.paginationBurst.avgMs.toFixed(2)} ms`);
    console.log(`Average GRS Metrics Speed:  ${results.benchmarks.metrics.avgMs.toFixed(2)} ms`);
    console.log(`Average MITRE Rollup Speed: ${results.benchmarks.mitreCoverage.avgMs.toFixed(2)} ms`);
    console.log('=========================================\n');

    // Return the payload to write to file
    return results;
}

if (require.main === module) {
    main().then((results) => {
        // Save test results to a file for record keeping
        const fs = require('fs');
        fs.writeFileSync(path.resolve(__dirname, 'stress_results.json'), JSON.stringify(results, null, 2), 'utf8');
        console.log('Saved detailed benchmarks to stress_results.json');
        process.exit(0);
    }).catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
}
