import http from 'http';
import crypto from 'crypto';
import url from 'url';
import fs from 'fs';
import path from 'path';
import https from 'https';

const PORT = 3001;
const JWT_SECRET = 'super-secret-enterprise-key';
const TAXONOMY_CACHE_PATH = './mitre_stix_cache.json';

// Mock DB
let db = {
    exercises: [],
    gaps: [],
    campaignSummaries: {},
    campaignEvidence: {}
};

// Generate Mock Data for Stress Testing
console.log('Generating 100,000 synthetic exercises for stress testing...');
for (let i = 0; i < 100000; i++) {
    db.exercises.push({
        id: `mock-ex-${i}`,
        ttp: 'T1059.001',
        status: i % 2 === 0 ? 'high' : 'low',
        date: new Date().toISOString()
    });
}
console.log('Synthetic data generation complete.');

// Simple JWT Creation (Raw Node.js)
function createJWT(payload) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    return `${header}.${body}.${signature}`;
}

// Simple JWT Verification
function verifyJWT(token) {
    try {
        const [header, body, signature] = token.split('.');
        const expectedSignature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
        if (signature === expectedSignature) {
            return JSON.parse(Buffer.from(body, 'base64url').toString());
        }
    } catch (e) {
        return null;
    }
    return null;
}

// Map key parameter in /data/:key to db object fields
function mapKeyToDbField(key) {
    const mappings = {
        'exercises': 'exercises',
        'gaps': 'gaps',
        'campaignSummaries': 'campaignSummaries',
        'campaignEvidence': 'campaignEvidence'
    };
    return mappings[key] || null;
}

// MITRE ATT&CK taxonomy fetcher and parser
let cachedMitreTaxonomy = null;
let parsedTaxonomyMemory = null;

function downloadTaxonomy() {
    return new Promise((resolve, reject) => {
        console.log('[MITRE] Downloading MITRE STIX database from GitHub...');
        https.get('https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json', (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`Failed to download taxonomy: Status ${res.statusCode}`));
                return;
            }
            let raw = '';
            res.on('data', chunk => raw += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(raw);
                    fs.writeFileSync(TAXONOMY_CACHE_PATH, JSON.stringify(parsed));
                    console.log('[MITRE] Saved taxonomy cache successfully.');
                    resolve(parsed);
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function getMitreTaxonomy() {
    if (cachedMitreTaxonomy) return cachedMitreTaxonomy;
    
    if (fs.existsSync(TAXONOMY_CACHE_PATH)) {
        try {
            console.log('[MITRE] Loading taxonomy from local cache...');
            const data = fs.readFileSync(TAXONOMY_CACHE_PATH, 'utf8');
            cachedMitreTaxonomy = JSON.parse(data);
            return cachedMitreTaxonomy;
        } catch (e) {
            console.error('[MITRE] Cache parsing failed, re-downloading...', e);
        }
    }
    
    try {
        cachedMitreTaxonomy = await downloadTaxonomy();
        return cachedMitreTaxonomy;
    } catch (err) {
        console.error('[MITRE] Failed to obtain MITRE database:', err);
        return null;
    }
}

function parseTaxonomy(stixData) {
    const tacticsMap = {};
    const mitreOutput = {};
    
    stixData.objects.forEach(obj => {
        if (obj.type === 'x-mitre-tactic') {
            tacticsMap[obj.x_mitre_shortname] = obj.name;
            mitreOutput[obj.name] = { status: 'unknown', techniques: [] };
        }
    });
    
    stixData.objects.forEach(obj => {
        if (obj.type === 'attack-pattern' && !obj.revoked && !obj.x_mitre_deprecated) {
            const idObj = obj.external_references?.find(ref => ref.source_name === 'mitre-attack');
            if (idObj && idObj.external_id) {
                obj.kill_chain_phases?.forEach(phase => {
                    if (phase.kill_chain_name === 'mitre-attack') {
                        const tacticName = tacticsMap[phase.phase_name];
                        if (tacticName && mitreOutput[tacticName]) {
                            if (!mitreOutput[tacticName].techniques.find(t => t.id === idObj.external_id)) {
                                mitreOutput[tacticName].techniques.push({ 
                                    id: idObj.external_id, 
                                    name: obj.name, 
                                    status: 'unknown' 
                                });
                            }
                        }
                    }
                });
            }
        }
    });
    
    Object.keys(mitreOutput).forEach(k => {
        mitreOutput[k].techniques.sort((a,b) => a.id.localeCompare(b.id));
    });
    
    return mitreOutput;
}

async function getParsedTaxonomy() {
    if (parsedTaxonomyMemory) return parsedTaxonomyMemory;
    const stix = await getMitreTaxonomy();
    if (!stix) return null;
    parsedTaxonomyMemory = parseTaxonomy(stix);
    return parsedTaxonomyMemory;
}

// Rollup calculation logic
function calculateMitreCoverage(exercises) {
    const baseData = parsedTaxonomyMemory;
    if (!baseData) return null;
    
    // Deep copy base taxonomy
    const next = JSON.parse(JSON.stringify(baseData));
    
    // Initialize each technique
    for (const tactic in next) {
        next[tactic].techniques.forEach(t => {
            if (t.status !== 'na') {
                t.status = 'unknown';
            }
            t.environments = {}; 
        });
    }
    
    // Map exercises by TTP and environment
    const exMap = {};
    exercises.forEach(ex => {
        const envArray = Array.isArray(ex.environment) ? ex.environment : [ex.environment || 'Windows Workstation'];
        let score = 0;
        if (ex.status === 'high') score = 100;
        else if (ex.status === 'medium') score = 50;
        else if (ex.status === 'minimal') score = 25;
        else if (ex.status === 'low') score = 0;
        else if (ex.status === 'na') score = -1;
        
        if (!exMap[ex.ttp]) exMap[ex.ttp] = {};
        envArray.forEach(env => {
            if (!exMap[ex.ttp][env]) exMap[ex.ttp][env] = [];
            if (score >= 0) exMap[ex.ttp][env].push(score);
            else if (score === -1 && exMap[ex.ttp][env].length === 0) exMap[ex.ttp][env].push(-1);
        });
    });
    
    // Update environment statuses for techniques
    for (const tactic in next) {
        next[tactic].techniques.forEach(t => {
            if (exMap[t.id]) {
                Object.keys(exMap[t.id]).forEach(env => {
                    const scores = exMap[t.id][env];
                    if (scores.length === 0) return;
                    if (scores[0] === -1) {
                        t.environments[env] = 'na';
                        return;
                    }
                    
                    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
                    let finalStatus = 'high';
                    if (avg === 100) finalStatus = 'high';
                    else if (avg >= 50 && avg < 100) finalStatus = 'medium';
                    else if (avg > 0 && avg < 50) finalStatus = 'minimal';
                    else if (avg === 0) finalStatus = 'low';
                    
                    t.environments[env] = finalStatus;
                });
            }
        });
    }
    
    // Recalculate rollup statuses (weakest link logic)
    recalculateMitreStatuses(next, exercises);
    
    return next;
}

function recalculateMitreStatuses(mitreObj, exercises) {
    for (const tactic in mitreObj) {
        const allTechs = mitreObj[tactic].techniques;
        
        const parentSubsMap = {};
        allTechs.forEach(t => {
            if (t.id.includes('.')) {
                const parentId = t.id.split('.')[0];
                if (!parentSubsMap[parentId]) parentSubsMap[parentId] = [];
                parentSubsMap[parentId].push(t);
            }
        });

        const getAggStatus = (statuses) => {
            if (statuses.length === 0) return 'unknown';
            if (statuses.includes('low')) return 'low';
            if (statuses.includes('medium')) return 'medium';
            if (statuses.includes('high')) return 'high';
            return 'unknown';
        };

        allTechs.forEach(t => {
            const hasSubs = !t.id.includes('.') && parentSubsMap[t.id];
            if (!hasSubs) {
                const targetExercises = exercises.filter(ex => ex.ttp === t.id);
                if (targetExercises.length > 0) {
                    const statuses = targetExercises.map(ex => ex.status).filter(s => s !== 'unknown' && s !== 'na');
                    if (statuses.length > 0) {
                        t.status = getAggStatus(statuses);
                    } else {
                        const allExStatuses = targetExercises.map(ex => ex.status);
                        if (allExStatuses.every(s => s === 'na')) {
                            t.status = 'na';
                        } else {
                            t.status = 'unknown';
                        }
                    }
                }
            }
        });

        allTechs.forEach(t => {
            if (!t.id.includes('.') && parentSubsMap[t.id]) {
                const subs = parentSubsMap[t.id];
                const activeStatuses = subs.map(sub => sub.status).filter(s => s !== 'unknown' && s !== 'na');
                
                const directExercise = exercises.find(ex => ex.ttp === t.id);
                if (directExercise && directExercise.status && directExercise.status !== 'unknown' && directExercise.status !== 'na') {
                    activeStatuses.push(directExercise.status);
                }
                
                if (activeStatuses.length === 0) {
                    const allStatuses = subs.map(sub => sub.status);
                    if (allStatuses.length > 0 && allStatuses.every(s => s === 'na')) {
                        t.status = 'na';
                    } else {
                        t.status = 'unknown';
                    }
                } else {
                    t.status = getAggStatus(activeStatuses);
                }
            }
        });

        const parentTechs = allTechs.filter(t => !t.id.includes('.'));
        const activeTacticStatuses = parentTechs.map(t => t.status).filter(s => s !== 'unknown' && s !== 'na');
        
        if (activeTacticStatuses.length === 0) {
            const allTacticStatuses = parentTechs.map(t => t.status);
            if (allTacticStatuses.length > 0 && allTacticStatuses.every(s => s === 'na')) {
                mitreObj[tactic].status = 'na';
            } else {
                mitreObj[tactic].status = 'unknown';
            }
        } else {
            mitreObj[tactic].status = getAggStatus(activeTacticStatuses);
        }
    }
}

const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');

    if (req.method === 'OPTIONS') return res.writeHead(204).end();

    const getBody = () => new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => resolve(body ? JSON.parse(body) : {}));
    });

    const reqUrl = url.parse(req.url, true);
    const path = reqUrl.pathname;

    // 1. Authentication Endpoints (Bypasses token verification check below)
    if (path === '/auth/login' && req.method === 'POST') {
        const body = await getBody();
        console.log(`[AUTH] Login attempt for: ${body.email} (SSO: ${body.sso})`);
        
        let role = 'reader'; // Default role
        if (body.sso || body.provider === 'saml') {
            if (body.email && (body.email.includes('admin') || body.email.startsWith('admin@'))) {
                role = 'admin';
            }
        } else {
            if (body.role === 'admin' || (body.email && body.email.includes('admin'))) {
                role = 'admin';
            } else if (body.role === 'reader') {
                role = 'reader';
            } else {
                role = 'admin'; // Backward-compatible default
            }
        }
        
        const token = createJWT({ email: body.email, role });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ token, role }));
    }

    if (path === '/auth/sso' && req.method === 'GET') {
        const redirectUri = reqUrl.query.redirect_uri;
        const role = reqUrl.query.role === 'admin' ? 'admin' : 'reader';
        const email = reqUrl.query.email || `${role}@sso.local`;
        
        const token = createJWT({ email, role });
        console.log(`[AUTH SSO] SSO Login redirect triggered for ${email} as ${role}`);
        
        if (redirectUri) {
            res.writeHead(302, { 'Location': `${redirectUri}?token=${encodeURIComponent(token)}` });
            return res.end();
        } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ token, role }));
        }
    }

    // 2. Token Verification & Middleware for Protected Routes
    if (path.startsWith('/api/') || path.startsWith('/data/')) {
        const authHeader = req.headers['authorization'];
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Missing or Invalid Token' }));
        }
        
        const token = authHeader.split(' ')[1];
        const user = verifyJWT(token);
        if (!user) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Forbidden: Invalid Signature' }));
        }
        
        // RBAC Enforcement: restrict all write endpoints (POST, PUT, DELETE) to 'admin'
        const isWriteMethod = ['POST', 'PUT', 'DELETE'].includes(req.method);
        if (isWriteMethod && user.role !== 'admin') {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Forbidden: Admin role required for write operations' }));
        }
        
        // Attach user role metadata to request context
        req.user = user;
    }

    // 3. /data/:key Storage Endpoints (Authenticated)
    if (path.startsWith('/data/')) {
        const key = path.substring(6); // Extract suffix of "/data/"
        const dbField = mapKeyToDbField(key);
        
        if (!dbField) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: `Invalid data key: ${key}` }));
        }
        
        if (req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(db[dbField]));
        }
        
        if (req.method === 'PUT') {
            const body = await getBody();
            db[dbField] = body;
            console.log(`[DB WRITE] Updated remote data field: ${dbField}`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: true }));
        }
        
        if (req.method === 'DELETE') {
            db[dbField] = Array.isArray(db[dbField]) ? [] : {};
            console.log(`[DB WRITE] Cleared remote data field: ${dbField}`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: true }));
        }
    }

    // 4. /api/ Protected Endpoints
    if (path.startsWith('/api/')) {
        // Exercises (GET with pagination, filtering, sorting)
        if (path === '/api/exercises' && req.method === 'GET') {
            let filtered = [...db.exercises];
            
            // Filtering by campaign
            if (reqUrl.query.campaign) {
                const campaignQuery = reqUrl.query.campaign.toLowerCase();
                filtered = filtered.filter(ex => ex.campaign && ex.campaign.toLowerCase() === campaignQuery);
            }
            
            // Sorting by date
            if (reqUrl.query.sortBy === 'date' || reqUrl.query.sort === 'date') {
                const order = (reqUrl.query.order || reqUrl.query.direction || 'desc').toLowerCase();
                filtered.sort((a, b) => {
                    const dateA = new Date(a.date || 0);
                    const dateB = new Date(b.date || 0);
                    return order === 'asc' ? dateA - dateB : dateB - dateA;
                });
            }
            
            // Pagination
            const page = parseInt(reqUrl.query.page) || 1;
            const limit = parseInt(reqUrl.query.limit) || 50;
            const total = filtered.length;
            const startIndex = (page - 1) * limit;
            const endIndex = page * limit;
            const paginated = filtered.slice(startIndex, endIndex);
            
            console.log(`[DB READ] Exercises Page ${page} (Limit: ${limit}, Total: ${total}) - Campaign Filter: ${reqUrl.query.campaign || 'None'}`);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
                data: paginated,
                total,
                page,
                limit
            }));
        }

        if (path === '/api/exercises' && req.method === 'POST') {
            const body = await getBody();
            db.exercises.push(body);
            console.log(`[DB WRITE] Created new exercise: ${body.id}`);
            res.writeHead(201, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: true, id: body.id }));
        }

        // Gaps CRUD Endpoints
        if (path === '/api/gaps') {
            if (req.method === 'GET') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify(db.gaps));
            }
            
            if (req.method === 'POST') {
                const body = await getBody();
                if (!body.id) {
                    body.id = `gap-${crypto.randomUUID()}`;
                }
                db.gaps.push(body);
                console.log(`[DB WRITE] Created new gap: ${body.id}`);
                res.writeHead(201, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success: true, data: body }));
            }
            
            if (req.method === 'PUT') {
                const body = await getBody(); // Bulk update array
                if (!Array.isArray(body)) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Body must be an array for bulk update' }));
                }
                db.gaps = body;
                console.log(`[DB WRITE] Bulk updated gaps: ${db.gaps.length} items`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success: true }));
            }
        }
        
        const gapIdMatch = path.match(/^\/api\/gaps\/([^/]+)$/);
        if (gapIdMatch) {
            const gapId = gapIdMatch[1];
            
            if (req.method === 'GET') {
                const gap = db.gaps.find(g => g.id === gapId);
                if (!gap) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Gap not found' }));
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify(gap));
            }
            
            if (req.method === 'PUT') {
                const body = await getBody();
                const idx = db.gaps.findIndex(g => g.id === gapId);
                if (idx === -1) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Gap not found' }));
                }
                db.gaps[idx] = { ...db.gaps[idx], ...body, id: gapId };
                console.log(`[DB WRITE] Updated gap: ${gapId}`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success: true, data: db.gaps[idx] }));
            }
            
            if (req.method === 'DELETE') {
                const idx = db.gaps.findIndex(g => g.id === gapId);
                if (idx === -1) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Gap not found' }));
                }
                const deleted = db.gaps.splice(idx, 1);
                console.log(`[DB WRITE] Deleted gap: ${gapId}`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ success: true, data: deleted[0] }));
            }
        }

        // Server-Side MITRE Coverage Aggregator
        if (path === '/api/mitre-coverage' && req.method === 'GET') {
            console.log(`[DB AGGREGATE] Calculating MITRE technique coverage across ${db.exercises.length} exercises...`);
            const taxonomy = await getParsedTaxonomy();
            if (!taxonomy) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Failed to load MITRE taxonomy' }));
            }
            const aggregatedData = calculateMitreCoverage(db.exercises);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(aggregatedData));
        }

        // Global Metrics (GET)
        if (path === '/api/metrics' && req.method === 'GET') {
            console.log(`[DB AGGREGATE] Calculating global metrics across ${db.exercises.length} records`);
            let high = 0, low = 0;
            db.exercises.forEach(ex => {
                if (ex.status === 'high') high++;
                if (ex.status === 'low') low++;
            });
            const grs = db.exercises.length === 0 ? 0 : Math.round((high / db.exercises.length) * 100);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ grs, totalExercises: db.exercises.length, optimal: high, noCoverage: low }));
        }
    }

    // Catch all 404
    res.writeHead(404);
    res.end();
});

server.listen(PORT, () => {
    console.log(`\n🚀 ENTERPRISE MOCK DB SERVER ONLINE on port ${PORT}\n`);
});
