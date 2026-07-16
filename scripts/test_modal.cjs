const { chromium } = require('@playwright/test');
(async () => {
  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto('http://localhost:5173/posture');
    await page.waitForTimeout(2000);
    // Find the first TTP card that we can click to open a modal
    // Actually we don't have data.
    // Let's inject a gap into local storage so we can test it!
    const testExercise = [{
        id: '123',
        ttp: 'T1059',
        status: 'high',
        simulation: 'Test Sim',
        date: new Date().toISOString()
    }];
    const testSummary = {
        'Test Sim': {
            testResults: [{
                name: 'Auto-Gen Event 8',
                eventType: 'Payload',
                payloadCode: 'powershell.exe -ExecutionPolicy Bypass'
            }]
        }
    };
    await page.evaluate(({ testExercise, testSummary }) => {
        localStorage.setItem('exercises', JSON.stringify(testExercise));
        localStorage.setItem('simulationSummaries', JSON.stringify(testSummary));
    }, { testExercise, testSummary });

    await page.reload();
    await page.waitForTimeout(2000);

    // Click T1059 to open the modal
    await page.evaluate(() => {
        const textNodes = Array.from(document.querySelectorAll('text'));
        const t1059Node = textNodes.find(n => n.textContent.includes('T1059'));
        if (t1059Node) {
            // Find parent g
            const parent = t1059Node.closest('g');
            if (parent) {
                // simulate click
                parent.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            }
        }
    });

    await page.waitForTimeout(1000);

    // Click View Raw Payload
    await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const btn = buttons.find(b => b.textContent.includes('View Raw Payload'));
        if (btn) btn.click();
    });

    await page.waitForTimeout(1000);

    // Get bounding box of the modal
    const bbox = await page.evaluate(() => {
        const h3 = Array.from(document.querySelectorAll('h3')).find(h => h.textContent.includes('Raw Payload'));
        if (!h3) return null;
        const modal = h3.closest('.glass-panel');
        const overlay = modal.parentElement;
        return {
            modalRect: modal.getBoundingClientRect(),
            overlayRect: overlay.getBoundingClientRect(),
            bodyRect: document.body.getBoundingClientRect()
        };
    });

    console.log(JSON.stringify(bbox, null, 2));
    
    await browser.close();
  } catch (e) {
    console.error(e);
  }
})();
