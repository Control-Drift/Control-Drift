import { spawn } from 'child_process';
import dns from 'dns';

// Ensure localhost resolves to IPv4 first for reliable HTTP requests
dns.setDefaultResultOrder('ipv4first');

console.log("Starting mock database server for challenger tests...");

const dbProcess = spawn('"C:\\Program Files\\nodejs\\node.exe"', ['mock_database.js'], {
    cwd: 'C:/Users/thoma/.gemini/antigravity/scratch/eclipse-ops',
    shell: true
});

let dbStarted = false;

dbProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(`[DB] ${output.trim()}`);
    if (output.includes('ENTERPRISE MOCK DB SERVER ONLINE')) {
        dbStarted = true;
    }
});

dbProcess.stderr.on('data', (data) => {
    console.error(`[DB ERROR] ${data.toString().trim()}`);
});

// Wait for DB to start
await new Promise((resolve) => {
    const interval = setInterval(() => {
        if (dbStarted) {
            clearInterval(interval);
            resolve();
        }
    }, 100);
});

console.log("Database server is online. Starting tests...");

try {
    // 1. Get Tokens
    console.log("\n--- Testing Authentication & Token Retrieval ---");
    const adminLoginRes = await fetch('http://127.0.0.1:3001/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@local', role: 'admin' })
    });
    const adminData = await adminLoginRes.json();
    const adminToken = adminData.token;
    console.log(`Admin login token retrieved: ${adminToken ? 'OK' : 'FAIL'}`);

    const readerLoginRes = await fetch('http://127.0.0.1:3001/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'reader@local', role: 'reader' })
    });
    const readerData = await readerLoginRes.json();
    const readerToken = readerData.token;
    console.log(`Reader login token retrieved: ${readerToken ? 'OK' : 'FAIL'}`);

    // 2. Verify RBAC
    console.log("\n--- Testing RBAC Restrictions ---");

    // GET is allowed for reader
    const getExercisesReader = await fetch('http://127.0.0.1:3001/api/exercises?page=1&limit=5', {
        headers: { 'Authorization': `Bearer ${readerToken}` }
    });
    console.log(`Reader GET /api/exercises status: ${getExercisesReader.status} (Expected: 200)`);

    // POST is forbidden for reader
    const postExerciseReader = await fetch('http://127.0.0.1:3001/api/exercises', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${readerToken}`
        },
        body: JSON.stringify({ id: 'test-rbac-1', ttp: 'T1059.001', status: 'low' })
    });
    const postExerciseReaderJson = await postExerciseReader.json();
    console.log(`Reader POST /api/exercises status: ${postExerciseReader.status} (Expected: 403)`);
    console.log(`Reader POST error message: ${JSON.stringify(postExerciseReaderJson)}`);

    // POST is allowed for admin
    const postExerciseAdmin = await fetch('http://127.0.0.1:3001/api/exercises', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ id: 'test-rbac-admin-1', ttp: 'T1059.001', status: 'low', campaign: 'Test Admin' })
    });
    console.log(`Admin POST /api/exercises status: ${postExerciseAdmin.status} (Expected: 201)`);

    // PUT gaps is forbidden for reader
    const putGapReader = await fetch('http://127.0.0.1:3001/api/gaps', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${readerToken}`
        },
        body: JSON.stringify([])
    });
    console.log(`Reader PUT /api/gaps status: ${putGapReader.status} (Expected: 403)`);

    // PUT gaps is allowed for admin
    const putGapAdmin = await fetch('http://127.0.0.1:3001/api/gaps', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify([{ id: 'gap-rbac-1', status: 'Open', severity: 'High' }])
    });
    console.log(`Admin PUT /api/gaps status: ${putGapAdmin.status} (Expected: 200)`);

    // 3. Test Pagination Performance with Sorting (which is used in App)
    console.log("\n--- Testing Pagination Performance WITH SORTING (100k exercises) ---");
    const latenciesSorted = [];
    const testPages = [1, 2, 50, 100, 500, 1000, 1900];
    const limit = 50;

    for (const page of testPages) {
        const start = performance.now();
        const res = await fetch(`http://127.0.0.1:3001/api/exercises?page=${page}&limit=${limit}&sort=date&order=desc`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const elapsed = performance.now() - start;
        latenciesSorted.push(elapsed);
        
        const data = await res.json();
        console.log(`Fetched Page ${page} (sorted, limit ${limit}): status ${res.status}, returned ${data.data?.length} exercises. Time: ${elapsed.toFixed(2)} ms`);
    }

    const meanLatencySorted = latenciesSorted.reduce((a, b) => a + b, 0) / latenciesSorted.length;
    console.log(`\nSorted Pagination Performance Summary:`);
    console.log(`- Min Latency: ${Math.min(...latenciesSorted).toFixed(2)} ms`);
    console.log(`- Max Latency: ${Math.max(...latenciesSorted).toFixed(2)} ms`);
    console.log(`- Mean Latency: ${meanLatencySorted.toFixed(2)} ms`);

    // Challenge scenario: multiple rapid sorted page requests (simulate page bashing)
    console.log("\n--- Simulating 20 Rapid Sorted Page Requests ---");
    const rapidLatenciesSorted = [];
    const promisesSorted = [];
    for (let i = 1; i <= 20; i++) {
        const page = i * 5;
        const start = performance.now();
        promisesSorted.push(
            fetch(`http://127.0.0.1:3001/api/exercises?page=${page}&limit=50&sort=date&order=desc`, {
                headers: { 'Authorization': `Bearer ${adminToken}` }
            }).then(async (res) => {
                const elapsed = performance.now() - start;
                rapidLatenciesSorted.push(elapsed);
                await res.json();
            })
        );
    }
    await Promise.all(promisesSorted);
    const meanRapidLatencySorted = rapidLatenciesSorted.reduce((a, b) => a + b, 0) / rapidLatenciesSorted.length;
    console.log(`Rapid Sorted Requests Performance:`);
    console.log(`- Min Latency: ${Math.min(...rapidLatenciesSorted).toFixed(2)} ms`);
    console.log(`- Max Latency: ${Math.max(...rapidLatenciesSorted).toFixed(2)} ms`);
    console.log(`- Mean Latency: ${meanRapidLatencySorted.toFixed(2)} ms`);

} catch (err) {
    console.error("Test execution failed:", err);
} finally {
    console.log("\nStopping database server...");
    dbProcess.kill();
    // Force kill if process is not terminated (especially on Windows)
    spawn('taskkill', ['/pid', dbProcess.pid.toString(), '/T', '/F'], { shell: true });
}
