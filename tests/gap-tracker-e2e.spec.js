import { test, expect } from '@playwright/test';

test.describe('Gap Tracker Validation E2E Flow', () => {
  let token = null;
  let role = null;

  test.beforeAll(async ({ request }) => {
    // Obtain SSO Auth Token
    const ssoResponse = await request.get('http://127.0.0.1:3001/auth/sso?role=admin');
    expect(ssoResponse.ok()).toBeTruthy();
    const ssoData = await ssoResponse.json();
    token = ssoData.token;
    role = ssoData.role;
  });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(({ token, role }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('roles', JSON.stringify([role]));
      localStorage.setItem('db_config', JSON.stringify({
        provider: 'local',
        endpoint: '',
        apiKey: ''
      }));

      // Seed a missed exercise and gap
      const testCampaign = 'E2E_Test_Campaign';
      localStorage.setItem('exercises', JSON.stringify([{
        id: 'ex-123',
        ttp: 'T1059',
        simulation: testCampaign,
        finding: 'Test Finding',
        outcome: 'Missed',
        coverageRating: 'None',
        remediation: 'Test Remediation',
        status: 'Missed',
        environment: ['Production'],
        tags: [],
        date: new Date().toISOString()
      }]));

      localStorage.setItem('gaps', JSON.stringify([{
        id: 'GAP-999',
        displayId: 'GAP-999',
        title: 'Missing Command Line Coverage',
        finding: 'Test Finding',
        ttp: 'T1059',
        phase: 'Execution',
        environment: ['Production'],
        severity: 'High',
        status: 'Open',
        priorityScore: 90,
        createdDate: new Date().toISOString(),
        resolvedDate: null,
        simulation: testCampaign
      }]));

      localStorage.setItem('simulations', JSON.stringify({
        [testCampaign]: {
            date: new Date().toISOString(),
            name: testCampaign,
            testResults: [{
                name: 'Test Finding',
                outcome: 'Missed',
                coverageRating: 'None',
                ttps: ['T1059']
            }],
            overallScore: 0,
            environments: ['Production']
        }
      }));
    }, { token, role });
  });

  test('Validating a gap auto-resolves it and updates simulation score', async ({ page }) => {
    // Navigate to gaps
    await page.goto('/gaps');
    
    // Check if the gap is rendered in the Open column
    const gapCard = page.locator('div.glass-panel', { hasText: 'Test Finding' }).first();
    await expect(gapCard).toBeVisible();

    // Click the gap to open the side panel
    await gapCard.click();
    await expect(page.locator('div', { hasText: 'GAP-999' }).first()).toBeVisible();

    // Click the Status dropdown (currently says OPEN)
    await page.locator('button', { hasText: 'OPEN' }).first().click();

    // Select "Resolved" from the dropdown to trigger the modal
    await page.getByText('RESOLVED', { exact: true }).first().click();

    // Wait for the modal
    await expect(page.locator('h2', { hasText: 'Validate Remediation' })).toBeVisible();

    // Fill out the validation form
    await page.getByRole('button', { name: 'Select Validation Outcome...' }).click(); // Outcome dropdown
    await page.getByRole('button', { name: 'Prevented & Alerted' }).click();

    const notesArea = page.locator('textarea').last();
    await expect(notesArea).toBeVisible();
    await notesArea.fill('E2E Test Validation passed');

    // Confirm Resolution
    const confirmBtn = page.locator('button', { hasText: 'Submit Validation' }).first();
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    // Wait for the modal to close
    await expect(page.locator('h2', { hasText: 'Validate Remediation' })).not.toBeVisible();

    // Verify it moved to the resolved column
    const resolvedColumn = page.locator('.gap-board > div').nth(3); // 4th column is Resolved
    await expect(resolvedColumn.locator('div.glass-panel', { hasText: 'Test Finding' })).toBeVisible();

    // Navigate to reports to check if it synced back to the simulation
    await page.goto('/reports');

    // Wait for reports to load
    await expect(page.locator('text=E2E_Test_Campaign')).toBeVisible();

    // Ensure the Optimal metric shows 1 (since it changed from Missed to Prevented)
    const optimalLabel = page.locator('div', { hasText: /^Optimal Coverage$/ }).first();
    const optimalScore = await optimalLabel.locator('..').locator('div').first().textContent();
    expect(optimalScore.trim()).toBe('1');

    // Ensure the No Coverage metric shows 0
    const noCoverageLabel = page.locator('div', { hasText: /^No Coverage$/ }).first();
    const noCoverageScore = await noCoverageLabel.locator('..').locator('div').first().textContent();
    expect(noCoverageScore.trim()).toBe('0');
  });
});
