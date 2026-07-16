# Purple Team Simulation Wizard Abuse & Boundary Testing: Vulnerabilities and Assessment Report

## 1. Executive Summary

This report documents the security guardrails, boundary checks, and E2E verification of the Purple Team Simulation Wizard and Gap Tracker within the Control Drift application. 

A comprehensive suite of abuse and boundary test cases is implemented in `tests/abuse-e2e.spec.js` to ensure the application's business logic, progress flows, and state transition pipelines are resilient against malicious or unintended user inputs, step bypasses, and state-injection attempts.

During execution, a flakiness issue was identified in the test suite that caused tests to fail under system load. This issue was diagnosed, debugged, and successfully patched. All tests now pass cleanly in headless mode.

---

## 2. Test Execution Results

All 6 test suites defined in `tests/abuse-e2e.spec.js` run and pass cleanly:

| Test Case ID | Test Case Name | Status | Duration |
|---|---|---|---|
| 1 | Wizard Progress Guardrails | **PASS** | ~4.5s |
| 2 | Step-Skipping Bypass Check | **PASS** | ~1.2s |
| 3 | Duplicate Simulation Names and Event Merging | **PASS** | ~4.8s |
| 4 | Gap Tracker Risk Acceptance Cascade | **PASS** | ~1.5s |
| 5 | Gap Tracker Resolution & Validation Blockers | **PASS** | ~2.1s |
| 6 | Revocation of Resolution & Risk Acceptance | **PASS** | ~1.2s |

*Total execution time:* **14.2s - 15.3s** (using 1 headless worker).

---

## 3. Discovered Vulnerabilities & Boundary Protections Checked

The test suite validates the following critical application boundary checks and guardrails:

### A. Wizard Progress Guardrails
*   **Vulnerability/Risk Checked:** Creation of malformed or incomplete simulations (missing names, target environments, TTPs, or empty events).
*   **Protection Mechanism:** The wizard blocks navigation to subsequent steps and displays explicit validation alerts. Step 3 enforces that every event must be named (preventing default names like `Event 1`), must have a documented execution outcome, and must be mapped to at least one MITRE TTP. Step 4 blocks submission if the Executive Summary is left blank.

### B. Step-Skipping Bypass via Session State Injection
*   **Vulnerability/Risk Checked:** Users bypassing step validation by programmatically modifying `wizard_step` in `sessionStorage` (e.g. forcing step value to `4` on a fresh session).
*   **Protection Mechanism:** Even if the step state is manipulated to force render the final summary page, the form submission handler still validates that required fields (like the Executive Summary) exist in the local state. If submitted under this state, the application safely falls back to storing `"Ad-hoc Simulation"` in localStorage instead of crashing or corrupting database indexes.

### C. Risk Acceptance Validation
*   **Vulnerability/Risk Checked:** Remediators bypassing security controls by accepting risks without documenting who approved it or the rationale behind it.
*   **Protection Mechanism:** The "Accept Risk" modal enforces that both the "Approving Authority" and the "Risk Justification" are non-empty strings. Submitting empty values triggers a validation warning and blocks the state transition.

### D. Gap Resolution Blockers
*   **Vulnerability/Risk Checked:** Gaps being prematurely marked as "Resolved" when the validation outcome is non-optimal (e.g. the control only `Logged` the technique, rather than `Prevented` or `Alerted` it).
*   **Protection Mechanism:** The validation submission checks if the outcome is in the optimal list (`Prevented & Alerted`, `Prevented (No Alert)`, `Prevented`, `Alerted`). Non-optimal validation results keep the gap status as `"In Progress"` and display a warning toast to the user.

### E. Risk Acceptance and Resolution Revocation
*   **Vulnerability/Risk Checked:** Stale risk acceptance justification or resolved dates persisting when a gap is dragged back into the active queue.
*   **Protection Mechanism:** Dragging a gap back to `"In Progress"` clears all approval authorities and justification text from the record.

---

## 4. Test Suite Flakiness & Debugging Details

### The Bug
The previous test suite hung or failed during Test 5 (`Gap Tracker Resolution & Validation Blockers`) at the following block:
```javascript
    // Click submit with retry loop using precise modal selector
    await page.locator('div.glass-panel:has(h2:has-text("Validate Remediation")) button:has-text("Submit Validation")').click();
    try {
      await expect(page.getByText('Gap remains In Progress. Optimal coverage (Prevented/Alerted) is required to resolve.')).toBeVisible({ timeout: 3000 });
    } catch (e) {
      console.log("Validation blocker warning toast did not appear, retrying submit click...");
      await page.locator('div.glass-panel:has(h2:has-text("Validate Remediation")) button:has-text("Submit Validation")').click();
      await expect(page.getByText('Gap remains In Progress. Optimal coverage (Prevented/Alerted) is required to resolve.')).toBeVisible({ timeout: 5000 });
    }
```

### Rationale & Cause
1. When "Submit Validation" is clicked with a non-optimal outcome (`Logged`), the click handler asynchronously calls `updateExerciseValidation(...)`.
2. As soon as the async validation completes, the click handler unmounts the modal by calling `setActiveValidationGap(null)`.
3. If the toast message took slightly longer than 3.0 seconds to appear on screen due to CPU or Vite hot-module load, the first `expect` timed out.
4. The `catch` block ran immediately, attempting to click the "Submit Validation" button again.
5. Because the first click *did* succeed, the modal had already unmounted, meaning the "Submit Validation" button was no longer in the DOM.
6. This caused the locator inside the `catch` block to fail, leading to test failure.

### The Fix
The double-click retry logic was replaced with a direct, robust single click followed by a generous 10-second timeout assertion. This allows ample time for the toast notification to render without introducing race conditions or trying to click unmounted DOM elements:
```javascript
    // Click submit using precise modal selector
    await page.locator('div.glass-panel:has(h2:has-text("Validate Remediation")) button:has-text("Submit Validation")').click();
    await expect(page.getByText('Gap remains In Progress. Optimal coverage (Prevented/Alerted) is required to resolve.')).toBeVisible({ timeout: 10000 });
```
A similar change was applied to the resolution success validation block:
```javascript
    // Click submit
    await page.locator('div.glass-panel:has(h2:has-text("Validate Remediation")) button:has-text("Submit Validation")').click();
    await expect(page.getByText('Gap Resolved successfully.')).toBeVisible({ timeout: 10000 });
```

Following these changes, the entire test suite executes reliably and passes consistently.
