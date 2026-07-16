# Handoff Report - Milestone 3 Testing Strategy for AppContext

## 1. Observation
We analyzed `src/AppContext.jsx` and its dependencies in the `eclipse-ops` project.
Specifically, we observed:
- **Data Loading Orchestration**: In `src/AppContext.jsx`, `loadData` (lines 93-101) sequentially awaits data loading across hooks:
  ```javascript
  const loadData = useCallback(async (adapter) => {
      if (!adapter) return;
      await exData.loadAllData(adapter);
      await gapsData.fetchGaps(adapter);
      await simsData.fetchSimulations(adapter);
      
      // Load initial Mitre skeleton
      await mitreHook.loadMitreSkeleton();
  }, [exData.loadAllData, gapsData.fetchGaps, simsData.fetchSimulations, mitreHook.loadMitreSkeleton]);
  ```
- **Initialization & Sync Logic**:
  - `initDb` is triggered on mount (lines 107-109) with a callback wrapped in `loadDataRef.current` to prevent dependency tracking cycles:
    ```javascript
    useEffect(() => {
        initDb((adapter) => loadDataRef.current(adapter));
    }, [dbConfig, initDb]);
    ```
  - An interval triggers sync checks every 15 seconds (lines 112-115) using a cleanup return:
    ```javascript
    useEffect(() => {
        const interval = setInterval(() => checkSyncQueue(dbAdapter, isAuthenticated), 15000);
        return () => clearInterval(interval);
    }, [dbAdapter, isAuthenticated, checkSyncQueue]);
    ```
- **Utility Functions**:
  - `toggleTacticScope` (lines 144-156) uses `setBaseMitreData` and checks if `tactic.techniques.every(t => t.status === 'na')` to toggle all statuses between `'na'` and `'unknown'`.
  - `toggleTechniqueScope` (lines 159-180) updates a technique globally across tactics, and also updates `environments[environment]` status if environment is not `'All'`.
  - `compressImage` (lines 126-141) leverages `new Image()` and `document.createElement('canvas')` to scale image down if it exceeds `maxWidth`.
  - `injectTestData` (lines 120-123) displays an informational toast message that stress test injection is disabled.

## 2. Logic Chain
- To thoroughly verify the provider's orchestration, mount, and sync logic without making external database or network calls, all hooks (e.g. `useDbConnection`, `useAppUI`, etc.) should be mocked.
- Verifying `initDb` callback behaviors requires triggering the callback with a mock adapter and verifying that `exData.loadAllData`, `gapsData.fetchGaps`, `simsData.fetchSimulations`, and `mitreHook.loadMitreSkeleton` are called.
- Verifying the 15-second interval requires mock timers (`vi.useFakeTimers`) to advance time, check invocation of `checkSyncQueue` with the mock adapter/auth parameters, and check unmount/interval cleanup.
- Verifying browser-based APIs (`Image` and `Canvas` inside `compressImage`) requires stubbing `global.Image` and `global.document.createElement` in jsdom.

## 3. Caveats
- No tests were implemented or executed during this read-only exploration phase.
- Assumed standard JSDOM test runner settings are available through Vitest.

## 4. Conclusion
We designed a comprehensive testing strategy for testing `AppContext.jsx` in isolation. The detailed test specification, custom hook mocks, canvas/image mock stubs, and a complete code blueprint have been documented in the analysis report.

## 5. Verification Method
1. Inspect the detailed strategy in `C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\.agents\explorer_vitest_m3_2\analysis.md`.
2. When implemented, run the Vitest suite using `npm run test` (or `npx vitest`) to verify that all context integration tests pass.
