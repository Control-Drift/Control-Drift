# Project: Vitest Test Suite Setup

## Architecture
- React 18, Vite, Vitest, React Testing Library, jsdom.
- Core non-AI modules to be tested:
  - Components: Reports (`src/components/Reports.jsx`), GapTracker (`src/components/GapTracker.jsx`), Settings (`src/components/Settings.jsx`), AttackPath (`src/components/AttackPath.jsx`)
  - Logic/Context/Hooks: AppContext (`src/AppContext.jsx`), useGapsData (`src/hooks/useGapsData.js`), etc.
- Integration environment: tests run with `npm run test` or `npx vitest run`.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Test Setup Verification | Verify Vitest & RTL configuration works, write a dummy/sanity test, and execute it | None | DONE |
| 2 | Component Testing | Write unit/integration tests for Reports, GapTracker, Settings, and AttackPath components | M1 | DONE |
| 3 | State & Logic/Context Testing | Write unit/integration tests for AppContext and useGapsData hook | M1 | DONE |
| 4 | Verification & Audit | Run all tests, ensure they pass, and run Forensic Auditor to verify integrity | M2, M3 | DONE |

## Interface Contracts
### Components ↔ Context
- Components must consume state and actions from AppContext via React's `useContext` or hooks.
- Mocking AppContext is required for testing individual components in isolation.
