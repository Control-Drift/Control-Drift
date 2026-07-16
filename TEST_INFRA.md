# Iridescence Application E2E Test Infrastructure

This document outlines the architecture, methodology, and design choices for the programmatic End-to-End (E2E) testing framework of the Iridescence application.

## 1. Test Architecture Overview

The Iridescence E2E test runner runs inside the client application via React Router at `/test-runner`. It interacts directly with the `AppContext` state and verifies state transitions and side effects in real-time. This approach ensures that we test the absolute truth of our UI and state machine logic without requiring heavy browser automation wrappers (like Playwright or Cypress) during validation.

The test infrastructure is structured into a **4-tier test suite**:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                             TEST RUNNER (UI)                             │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────┐               ┌──────────────────────────┐  │
│  │   Tier 1: Environment   │               │     Tier 2: Campaign     │  │
│  │     & Configuration     │               │        Management        │  │
│  └─────────────────────────┘               └──────────────────────────┘  │
│                                                                          │
│  ┌─────────────────────────┐               ┌──────────────────────────┐  │
│  │     Tier 3: MITRE &     │               │     Tier 4: Copilot      │  │
│  │     Gap Validation      │               │     & Stream Parsing     │  │
│  └─────────────────────────┘               └──────────────────────────┘  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 2. The 4-Tier Test Suite Specification

### Tier 1: Environment & Config Validation
- **Goal**: Verify that system configurations and environment filters perform state transitions correctly.
- **Scope**:
  - Verification of default environment parameters loaded into context.
  - Runtime environment configuration updates (using `setEnvironmentConfig`) and checking state propagation.
  - Active environment filtering toggling (using `setActiveEnvironmentFilter`) and verifying state updates.

### Tier 2: Exercise Wizard & Campaign Management
- **Goal**: Validate that campaign exercises and metadata can be created, persisted, and queried.
- **Scope**:
  - Programmatic creation of exercise results via `completeExercise`.
  - Campaign evidence attachment (base64 image mapping) in the context.
  - Saving and updating campaign summaries (`campaignSummaries` state mapping).

### Tier 3: MITRE ATT&CK Mapping & Coverage Score Logic
- **Goal**: Validate core threat-mapping formulas and relations between exercises, gaps, and MITRE techniques.
- **Scope**:
  - **Gap Auto-Resolution**: When a threat technique (`ttp`) receives a `high` (prevented) status in an exercise, verify that any active/open security gap targeting that same TTP is automatically set to `Resolved` with system attestation notes.
  - **Validation Re-Testing**: Verify that `updateExerciseValidation` correctly recalculates aggregate technique/tactic outcome statuses inside the MITRE matrix.
  - **Tactic/Technique Scope Toggles**: Verify that `toggleTacticScope` and `toggleTechniqueScope` transition technique statuses between `na` and `unknown`, recalculating tactic coverage score logic.
  - **Status Dropdown Sync Leak with Multiple TTPs**: Verify that dragging or selecting status change from 'Resolved' back to Open/In Progress for a gap with multiple comma-separated TTPs reverts the exercise status of all those TTPs to 'low' and updates global MITRE statuses reactively immediately.


### Tier 4: AI Copilot & Stream Parsing
- **Goal**: Test AI assistant integration, key validation, and streaming text chunk parser.
- **Scope**:
  - API configuration boundaries: ensuring `generateAIContent` raises proper missing-key errors.
  - Stream simulation: Mocking chunked reader streams (`fetch` intercepting) to verify that `generateAIContentStream` parses streaming chunks sequentially and returns correct complete outputs without exceptions.

---

## 3. Methodology & Async Flow

### Asynchronous State Synchronization
React state updates are asynchronous and batched. To verify changes, a standard synchronous test runner would fail due to stale closures. The Iridescence E2E runner implements:
1. **Context Reference Mirroring**: A React ref (`contextRef`) mirrors the latest context object on every render.
2. **Polling Engine (`waitForCondition`)**: Tests invoke an asynchronous polling method that checks the `contextRef` value every 50ms (up to a timeout of 2000ms) until assertions resolve.

```javascript
const waitForCondition = (conditionFn, timeout = 2000) => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const check = () => {
      if (conditionFn()) resolve();
      else if (Date.now() - startTime > timeout) reject(new Error("Assertion timeout"));
      else setTimeout(check, 50);
    };
    check();
  });
};
```

### State Isolation & Restoration
To ensure that running E2E tests does not corrupt user data or pollute the local storage environment:
- **Automatic Backup**: On initial runner load, the complete `AppContext` state is serialized and cached in-memory.
- **Clean Sandbox**: The runner allows clearing the current state to run in a fresh workspace.
- **Restoration Hook**: After execution, the runner provides an explicit "Restore Original State" button, which programmatically reinstates all original settings, exercises, and gaps.

---

## 4. Execution Controls

The `TestRunner` component contains controls to:
- **Run All Tests / Stop Tests**: Control execution threads.
- **Sandbox Reset**: Clear data to test cold-start scenarios.
- **Restore Data**: Rollback testing data.
- **Detailed Assertion Logs**: Display step-by-step pass/fail logs for auditing.
