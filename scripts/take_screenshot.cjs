const { chromium } = require('@playwright/test');
(async () => {
  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto('http://localhost:5173/gaps');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'C:\\Users\\thoma\\.gemini\\antigravity\\brain\\a07fbfcb-db2c-4fe2-b9b7-dfee9c0ff7ed\\scratch\\gaps_screenshot.png' });
    
    await page.goto('http://localhost:5173/attack-path');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'C:\\Users\\thoma\\.gemini\\antigravity\\brain\\a07fbfcb-db2c-4fe2-b9b7-dfee9c0ff7ed\\scratch\\attack_screenshot.png' });
    
    await browser.close();
  } catch (e) {
    console.error(e);
  }
})();
