const { chromium } = require('@playwright/test');
(async () => {
  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('console', msg => console.log('BROWSER_CONSOLE:', msg.type(), msg.text()));
    page.on('pageerror', error => console.log('BROWSER_ERROR:', error));
    await page.goto('http://localhost:5173/gaps');
    await page.waitForTimeout(2000);
    const content = await page.content();
    console.log("BODY_LENGTH:", content.length);
    console.log(content.substring(0, 500));
    const isError = await page.evaluate(() => document.body.innerText.includes('Error'));
    console.log("HAS_ERROR:", isError);
    await browser.close();
  } catch (e) {
    console.error(e);
  }
})();
