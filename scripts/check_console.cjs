const { chromium } = require('@playwright/test');
(async () => {
  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('console', msg => console.log('BROWSER_CONSOLE:', msg.type(), msg.text()));
    page.on('pageerror', error => console.log('BROWSER_ERROR:', error));
    await page.goto('http://localhost:5173/attack-path');
    await page.waitForTimeout(2000);
    await browser.close();
  } catch (e) {
    console.error(e);
  }
})();
