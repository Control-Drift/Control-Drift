const puppeteer = require('puppeteer');

async function test() {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.toString()));

    try {
        await page.goto('http://localhost:5173/');
        await new Promise(r => setTimeout(r, 6000));
        
        console.log("Setting localStorage...");
        await page.evaluate(() => {
            localStorage.setItem('target_security_controls', JSON.stringify(["OSSEC"]));
        });
        
        console.log("Navigating to Heatmap with OSSEC filter...");
        const clicked = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const btn = buttons.find(b => b.textContent.includes('See in Heatmap'));
            if (btn) {
                btn.click();
                return true;
            }
            return false;
        });
        
        console.log("Clicked button:", clicked);
        await new Promise(r => setTimeout(r, 3000));
        
    } catch (e) {
        console.error("Script error:", e);
    } finally {
        await browser.close();
        process.exit(0);
    }
}

test();
