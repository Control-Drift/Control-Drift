# Synthesis: E2E Regression Locator Fix

## Problem Description
The Playwright E2E tests fail on selecting options from the "Actual Outcome" dropdown because `OutcomeDropdown.jsx` renders options inside a React Portal attached directly to `document.body` (under CSS class `.portal-dropdown-menu`).
The failing tests attempt to locate options locally inside the dropdown button's sibling tree:
- `page.locator('label:has-text("Actual Outcome")').first().locator('..').locator('button:has-text("Prevented")')`
Since the options are outside this container, these selections timeout and fail the tests.

---

## Required Modifications

### 1. `tests/wizard-e2e.spec.js`
- **Line 198**: Change from:
  `await page.locator('label:has-text("Actual Outcome")').first().locator('..').locator('button:has-text("Prevented")').first().click({ force: true });`
  to:
  `await page.locator('.portal-dropdown-menu button:has-text("Prevented & Alerted")').first().click({ force: true });`
- **Line 217**: Change from:
  `await page.locator('label:has-text("Actual Outcome")').nth(1).locator('..').locator('button:has-text("Logged")').click({ force: true });`
  to:
  `await page.locator('.portal-dropdown-menu button:has-text("Logged")').first().click({ force: true });`
- **Line 236**: Change from:
  `await page.locator('label:has-text("Actual Outcome")').nth(2).locator('..').locator('button:has-text("Missed")').click({ force: true });`
  to:
  `await page.locator('.portal-dropdown-menu button:has-text("Missed")').first().click({ force: true });`

### 2. `tests/wizard-e2e-10.spec.js`
- **Line 218**: Change from:
  `await page.locator('label:has-text("Actual Outcome")').first().locator('..').locator('button:has-text("Prevented")').first().click({ force: true });`
  to:
  `await page.locator('.portal-dropdown-menu button:has-text("Prevented & Alerted")').first().click({ force: true });`
- **Line 236**: Change from:
  `await page.locator('label:has-text("Actual Outcome")').nth(1).locator('..').locator('button:has-text("Logged")').first().click({ force: true });`
  to:
  `await page.locator('.portal-dropdown-menu button:has-text("Logged")').first().click({ force: true });`
- **Line 254**: Change from:
  `await page.locator('label:has-text("Actual Outcome")').nth(2).locator('..').locator('button:has-text("Missed")').first().click({ force: true });`
  to:
  `await page.locator('.portal-dropdown-menu button:has-text("Missed")').first().click({ force: true });`

### 3. `tests/wizard-stress.spec.js`
- **Line 242**: Change from:
  `await page.locator('label:has-text("Actual Outcome")').first().locator('..').locator('button:has-text("Prevented")').first().click({ force: true });`
  to:
  `await page.locator('.portal-dropdown-menu button:has-text("Prevented & Alerted")').first().click({ force: true });`
- **Line 275**: Change from:
  `await page.locator('label:has-text("Actual Outcome")').nth(1).locator('..').locator('button:has-text("Logged")').first().click({ force: true });`
  to:
  `await page.locator('.portal-dropdown-menu button:has-text("Logged")').first().click({ force: true });`
- **Line 308**: Change from:
  `await page.locator('label:has-text("Actual Outcome")').nth(2).locator('..').locator('button:has-text("Missed")').first().click({ force: true });`
  to:
  `await page.locator('.portal-dropdown-menu button:has-text("Missed")').first().click({ force: true });`

---

## Verification
Run:
- `npm run test:e2e` to verify all standard E2E tests pass.
- `npm run test:e2e:stress` to verify stress tests also pass.
