import { test, expect } from '@playwright/test';

test.describe('Audit Log & Report Locking E2E Flow', () => {
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

      // Seed a completed simulation
      const testCampaign = 'E2E_Audit_Test_Campaign';
      
      localStorage.setItem('exercises', JSON.stringify([{
        id: 'ex-audit-123',
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

      localStorage.setItem('simulations_table', JSON.stringify([{
        id: testCampaign,
        summary: {
            date: new Date().toISOString(),
            name: testCampaign,
            testResults: [{
                name: 'Test Finding',
                outcome: 'Missed',
                coverageRating: 'None',
                ttps: ['T1059']
            }],
            overallScore: 0,
            environments: ['Production'],
            executiveSummary: 'This is the finalized original summary.',
            auditLog: []
        },
        evidence: []
      }]));
    }, { token, role });
  });

  test('Unlock Report workflow requires justification and stamps UI', async ({ page }) => {
    // Navigate to reports
    await page.goto('/reports');
    
    // Select the campaign
    await page.locator('h3', { hasText: 'E2E_Audit_Test_Campaign' }).first().click();

    // Verify it's locked by default. In our implementation, the editor lacks the 'editing' class or the 'Unlock Report' button is visible
    const unlockBtn = page.locator('button', { hasText: /Unlock Report for Editing/i }).first();
    
    try {
        await expect(unlockBtn).toBeVisible({ timeout: 5000 });
    } catch (err) {
        console.error("HTML DUMP:");
        console.error(await page.locator('body').innerHTML());
        throw err;
    }

    // Click Unlock Report
    await unlockBtn.click();

    // Wait for the modal
    await expect(page.locator('text=Unlock Report for Editing')).toBeVisible();

    // Fill in justification
    const justificationText = 'Auditor requested additional context for finding.';
    const justifyInput = page.getByPlaceholder('e.g. Correcting typo in the executive summary...');
    await expect(justifyInput).toBeVisible();
    await justifyInput.fill(justificationText);

    // Click Unlock Report
    await page.locator('button', { hasText: 'Unlock Report' }).nth(1).click();

    // Verify the "Save Changes" button is now visible (since it's unlocked)
    await expect(page.locator('button', { hasText: 'Save Changes' })).toBeVisible();

    // Verify the Audit Log badge appears
    await expect(page.locator('span', { hasText: 'Edited' })).toBeVisible();

    // Hover or verify the justification is stamped
    // The UI should display the justification we typed
    await expect(page.locator(`text=${justificationText}`)).toBeVisible();
  });
});
