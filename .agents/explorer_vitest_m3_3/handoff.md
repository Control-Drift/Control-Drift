# Handoff Report: Milestone 3 Testing Strategy

## 1. Observation
We observed the following dependencies and environmental interactions in the project:
1. **HTML5 Canvas / Image loading in Image Compression**: In `src/AppContext.jsx` lines 126-141:
   ```javascript
   const img = new Image();
   img.src = dataUrl;
   img.onload = () => {
     ...
     const canvas = document.createElement('canvas');
     ...
     const ctx = canvas.getContext('2d');
     ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
     resolve(canvas.toDataURL('image/jpeg', 0.6));
   };
   ```
2. **External HTTP Network Call**: In `src/hooks/useMitreData.js` line 316:
   ```javascript
   const res = await fetch('https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json', { signal: controller.signal });
   ```
3. **SSO Parameter Parsing & URL Replacements**: In `src/hooks/useDbConnection.js` lines 45-53:
   ```javascript
   const params = new URLSearchParams(window.location.search);
   const token = params.get('token');
   ...
   const cleanUrl = window.location.origin + window.location.pathname;
   window.history.replaceState({}, document.title, cleanUrl);
   ```
4. **Local Storage Cache Interactions**:
   - In `src/hooks/useGapsData.js` lines 7-17:
     ```javascript
     const saved = localStorage.getItem('target_envs');
     ...
     localStorage.setItem('target_envs', JSON.stringify(targetEnvironments));
     ```
   - Similar `localStorage` dependencies in `useTagsData.js`, `useSecurityControlsData.js`, `useAiData.js`, `useMitreData.js`, `useDbConnection.js`.
5. **Database Adapter Interaction**: In `src/hooks/useGapsData.js` lines 33-52:
   ```javascript
   if (!adapter || typeof adapter.fetchGaps !== 'function') return;
   ...
   const data = await adapter.fetchGaps();
   ...
   if (hasChanges && adapter.type === 'local') {
       adapter.saveData('gaps', backfilledData);
   }
   ```

## 2. Logic Chain
1. Testing state management and context logic under Milestone 3 must run locally in a JSDOM unit test environment.
2. Under CODE_ONLY network mode and local execution constraints, JSDOM has no native support for the Canvas 2D context or image loading events (`Image.onload`), nor does it support external network fetches (hitting GitHub's MITRE STIX JSON will fail or leak execution environment).
3. Therefore, to ensure robust, isolated, and fast test execution, we must:
   - Stub the global `Image` class and mock the return value of `document.createElement('canvas')` (specifically `.getContext('2d')` and `.toDataURL()`).
   - Mock external HTTP fetches, specifically the GitHub MITRE ATT&CK STIX URL, or mock the React hook `useMitreData` and its underlying JSON cache keys in `localStorage`.
   - Mock window location and history state changes to test SSO authentication callbacks in `useDbConnection`.
   - Provide a clean, in-memory `localStorage` mock to prevent test pollution and local state leakage.
   - Construct a unified `dbAdapter` mockup that mirrors both `'local'` and remote APIs to test hook routing logic in `useGapsData` and `useExerciseActions`.

## 3. Caveats
- This investigation is read-only. No files inside the `src/` directory were modified or created.
- The JSDOM environment is assumed to be configured in Vitest (verified via `package.json` devDependencies containing `jsdom` and script `"test": "vitest"`).
- We assume that package schemas (like `validateBulkData` and `GapSchema` inside `src/lib/schemas.js`) should not be mocked as they are internal pure validation utilities.

## 4. Conclusion
We have compiled a complete, detailed test design and mocking specifications report at `C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\.agents\explorer_vitest_m3_3\analysis.md`. This includes precise mock code snippets for the database adapter, the 9 custom React hooks, JSDOM-specific globals (`localStorage`, `window.location`), and JSDOM-incompatible APIs (`Image` class, Canvas 2D context). This strategy will allow the Implementer to implement Milestone 3 test coverage cleanly and safely.

## 5. Verification Method
The plan can be verified by:
1. Confirming the existence of `C:\Users\thoma\.gemini\antigravity\scratch\eclipse-ops\.agents\explorer_vitest_m3_3\analysis.md` and reviewing the mock designs.
2. Once the tests are written by the implementer, they can be run using the project test runner command:
   ```powershell
   npx vitest run src/__tests__/
   ```
3. Checking that the test suite does not perform any network requests or throw Canvas/Image rendering crashes under JSDOM.
