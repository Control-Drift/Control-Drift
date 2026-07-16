// verify_api.js
import { spawn } from 'child_process';
import http from 'http';

const PORT = 3001;

function request(path, method = 'GET', headers = {}, body = null) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: '127.0.0.1',
            port: PORT,
            path,
            method,
            headers
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        statusCode: res.statusCode,
                        data: data ? JSON.parse(data) : null
                    });
                } catch (e) {
                    resolve({
                        statusCode: res.statusCode,
                        data: data
                    });
                }
            });
        });
        req.on('error', reject);
        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

async function runTests() {
    console.log('--- STARTING API VERIFICATION TESTS ---');
    
    // 1. Authenticate to get token
    console.log('Logging in as admin...');
    const loginRes = await request('/auth/login', 'POST', { 'Content-Type': 'application/json' }, {
        email: 'admin@local',
        role: 'admin'
    });
    
    if (loginRes.statusCode !== 200 || !loginRes.data.token) {
        throw new Error(`Login failed with status: ${loginRes.statusCode}`);
    }
    const token = loginRes.data.token;
    const authHeader = { 'Authorization': `Bearer ${token}` };
    console.log('Login successful! Token acquired.');

    // 2. Inject test exercises with campaign/simulation properties
    console.log('Injecting test exercises...');
    const ex1 = {
        id: 'test-api-ex-1',
        ttp: 'T1059.001',
        campaign: 'Stress Test',
        simulation: 'Stress Test',
        status: 'high',
        date: new Date().toISOString()
    };
    const ex2 = {
        id: 'test-api-ex-2',
        ttp: 'T1003.001',
        simulation: 'Stress Test', // only simulation
        status: 'low',
        date: new Date().toISOString()
    };
    const ex3 = {
        id: 'test-api-ex-3',
        ttp: 'T1485',
        campaign: 'Stress Test', // only campaign
        status: 'minimal',
        date: new Date().toISOString()
    };

    const writeRes1 = await request('/api/exercises', 'POST', { 'Content-Type': 'application/json', ...authHeader }, ex1);
    const writeRes2 = await request('/api/exercises', 'POST', { 'Content-Type': 'application/json', ...authHeader }, ex2);
    const writeRes3 = await request('/api/exercises', 'POST', { 'Content-Type': 'application/json', ...authHeader }, ex3);

    if (writeRes1.statusCode !== 201 || writeRes2.statusCode !== 201 || writeRes3.statusCode !== 201) {
        throw new Error('Failed to create test exercises.');
    }
    console.log('Test exercises injected.');

    // 3. Test /api/campaigns and /api/simulations GET handler alignment
    console.log('Testing /api/campaigns endpoint...');
    const campaignsRes = await request('/api/campaigns', 'GET', authHeader);
    console.log('Campaigns output:', campaignsRes.data);
    if (!campaignsRes.data.includes('Stress Test')) {
        throw new Error('/api/campaigns did not return "Stress Test"');
    }

    console.log('Testing /api/simulations endpoint...');
    const simulationsRes = await request('/api/simulations', 'GET', authHeader);
    console.log('Simulations output:', simulationsRes.data);
    if (!simulationsRes.data.includes('Stress Test')) {
        throw new Error('/api/simulations did not return "Stress Test"');
    }

    // 4. Test /api/exercises GET handler filtering (both campaign and simulation query parameters and properties)
    console.log('Filtering exercises by campaign=Stress Test...');
    const filterCampRes = await request('/api/exercises?campaign=Stress+Test', 'GET', authHeader);
    console.log(`Found ${filterCampRes.data.data.length} exercises when filtering by campaign.`);
    // Should find test-api-ex-1, test-api-ex-2, test-api-ex-3 (because mock database maps and normalizes them, and filters on both)
    if (filterCampRes.data.data.length < 3) {
        throw new Error(`Expected at least 3 exercises, got ${filterCampRes.data.data.length}`);
    }

    console.log('Filtering exercises by simulation=Stress Test...');
    const filterSimRes = await request('/api/exercises?simulation=Stress+Test', 'GET', authHeader);
    console.log(`Found ${filterSimRes.data.data.length} exercises when filtering by simulation.`);
    if (filterSimRes.data.data.length < 3) {
        throw new Error(`Expected at least 3 exercises, got ${filterSimRes.data.data.length}`);
    }

    // 5. Test /api/metrics GET handler
    console.log('Testing /api/metrics endpoint...');
    const metricsRes = await request('/api/metrics', 'GET', authHeader);
    console.log('Metrics output:', {
        grsScore: metricsRes.data.grsScore,
        totalValidated: metricsRes.data.totalValidated,
        areaData: metricsRes.data.areaData
    });
    if (metricsRes.data.totalValidated === 0) {
        throw new Error('Metrics totalValidated should be greater than 0');
    }
    
    console.log('--- ALL API VERIFICATION TESTS PASSED ---');
}

// Start database server process
const dbProc = spawn('node', ['mock_database.js']);
dbProc.stdout.on('data', (data) => {
    const output = data.toString();
    console.log('[DB]', output.trim());
    if (output.includes('ENTERPRISE MOCK DB SERVER ONLINE')) {
        runTests()
            .then(() => {
                dbProc.kill();
                process.exit(0);
            })
            .catch(err => {
                console.error('Test failed:', err);
                dbProc.kill();
                process.exit(1);
            });
    }
});

dbProc.stderr.on('data', (data) => {
    console.error('[DB ERROR]', data.toString().trim());
});

setTimeout(() => {
    console.error('Startup timeout');
    dbProc.kill();
    process.exit(1);
}, 10000);
