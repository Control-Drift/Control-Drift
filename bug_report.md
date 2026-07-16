# Control Drift (Iridescence) - QA Bug Report
**Date**: 2026-06-16  
**Auditor/QA**: QA Worker  

This report details five critical bugs, logic discrepancies, and state persistence leaks in the Control Drift (Iridescence) platform. These issues were programmatically simulated, traced, and verified using the Node validation suite `verify_qa_simulations.js`.

---

## 1. GRS Calculation Discrepancies
### Description
There is a calculation mismatch between the backend metrics API (`/api/metrics`) and the client-side fallback metrics calculation (located in `Dashboard.jsx` and `AppContext.jsx`).

### Root Causes
1. **Administrative Exercise Filtering**:
   - **Client**: AppContext filters out exercises belonging to the `'Admin Config'` simulation:
     ```javascript
     let filtered = all.filter(e => e.simulation !== 'Admin Config');
     ```
   - **Server**: The `/api/metrics` endpoint does not apply this filter, incorporating `'Admin Config'` exercises into its GRS score:
     ```javascript
     const valid = db.exercises.filter(ex => ex.status?.toLowerCase() !== 'na');
     ```
2. **Pagination Limits**:
   - **Client**: Client-side metrics calculations in `Dashboard.jsx` operate on the `contextExercises` state, which is capped at the current page size (default `50` elements) after fetching.
   - **Server**: The backend metrics API operates directly on the entire database (e.g., all 100,000 synthetic exercises).

### Reproduction & Payload
- **Input Data**: 100 exercises, where 20 belong to `'Admin Config'` (all `'high'`), and 80 are normal simulations (40 `'high'`, 40 `'low'`).
- **Server Result**: Processes all 100 exercises, resulting in a GRS score of **60%**.
- **Client Result**: Filters out the 20 `'Admin Config'` exercises, leaving 80. If paginated to a limit of 50, it processes only 50 exercises (e.g., 25 `'high'`, 25 `'low'`), resulting in a GRS score of **50%**.

---

## 2. MTTR Calculation Edge Cases
### Description
Negative time intervals (when `resolvedDate` is chronological before `createdDate` due to database corruption or manual clock synchronization errors) lead to mathematically incorrect internal values and are masked in the UI.

### Root Causes
1. **Incorrect Rounding & Modulo on Negative Numbers**:
   - The MTTR is calculated using `Math.floor` and `%`:
     ```javascript
     const days = Math.floor(meanSeconds / (3600 * 24));
     const hours = Math.floor((meanSeconds % (3600 * 24)) / 3600);
     ```
   - In JavaScript, `Math.floor` on negative numbers rounds *down* (towards negative infinity). For a negative interval of -2 hours (-7200 seconds):
     - `days = Math.floor(-7200 / 86400) = -1` (rounds down to -1 day).
     - `hours = Math.floor((-7200 % 86400) / 3600) = -2`.
     - Internally, this represents `-26 hours` ($-1 \times 24 - 2$), when the actual interval was only `-2 hours`.
2. **UI Masking**:
   - The UI hides negative MTTR values behind `> 0` checks:
     ```javascript
     if (days > 0) return `${days}d ${hours}h`;
     if (hours > 0) return `${hours}h`;
     return '< 1h';
     ```
   - As a result, a negative MTTR of any duration (even -50 days) outputs `< 1h` in the interface, silently masking the data integrity issue.

---

## 3. Sync and Persistence Leaks
### Description
State updates occurring in local fallback/storage mode are never persisted back to the `dbAdapter` JSON file database. Changes are kept in React memory and are lost upon page reload.

### Root Causes
1. **`updateExerciseValidation` Leak**:
   - In `AppContext.jsx`, the fallback branch (when `dbAdapter` has no custom `updateGap` function) updates the React state variables `exercises` and `gaps` but never calls `dbAdapter.saveData('gaps', gapsState)` to write the gaps back to disk.
2. **`handleDrop` Leak**:
   - In `GapTracker.jsx`, when a gap is moved out of `'Resolved'`, the associated exercises are updated back to `'low'` status in the React state:
     ```javascript
     setExercises(prev => prev.map(ex => { ... return { ...ex, status: 'low' }; }));
     ```
   - However, `dbAdapter.saveData('exercises', updatedExercises)` is never invoked, leaving the database out of sync.

---

## 4. Comma-Separated Multi-TTP Gaps
### Description
Resolving or validating a single technique within a security gap that targets multiple comma-separated TTPs (e.g. `'T1059.001, T1078'`) prematurely resolves the entire gap and corrupts the status history of unrelated techniques.

### Root Causes
1. **Premature Gap Resolution**:
   - When any single action item is validated (e.g. `'prevented'`), the entire gap is marked `'Resolved'` immediately:
     ```javascript
     if (['prevented', 'alerted', 'logged'].includes(newOutcomeStatus)) {
         return { ...gap, status: 'Resolved' };
     }
     ```
2. **Unrelated TTP Status Overwrite**:
   - `updateExerciseValidation` splits the gap's TTP string into `ttpList`. It then maps through the entire exercises array, updating the status of *all* exercises whose TTP is included in `ttpList` to the same status:
     ```javascript
     if (ttpList.includes(ex.ttp) && ex.simulation === simulationName) {
         return { ...ex, status: finalAggOutcome };
     }
     ```
   - This overwrites the status of other techniques in the gap (e.g., upgrading `T1078` from `'medium'` to `'high'` without any verification tests).

---

## 5. AppContext Missing Guards
### Description
The React application context throws runtime TypeErrors or sorting failures when encountered with malformed MITRE data or invalid dates.

### Root Causes
1. **`recalculateMitreStatuses` Crash**:
   - The loop `for (const tactic in mitreObj)` expects `mitreObj` to be defined. If `mitreObj` is `null` or `undefined`, the application crashes.
   - It also assumes `mitreObj[tactic].techniques` is an array. If `techniques` is missing, calling `techniques.forEach` throws a `TypeError: Cannot read properties of undefined (reading 'forEach')`.
2. **Unstable Sorting Contract in `filtered.sort`**:
   - The exercise sorter uses `new Date(b.date || 0) - new Date(a.date || 0)`.
   - If an exercise has an invalid date string (e.g. `'invalid-date-string'`), `new Date` returns `Invalid Date` (which evaluates to `NaN` when subtracted).
   - Returning `NaN` in a sort comparator violates JavaScript's strict weak ordering contract, resulting in unstable, inconsistent sorting.
