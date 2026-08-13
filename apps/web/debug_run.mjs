import { chromium } from 'playwright';

(async () => {
  console.log('--- Starting Automated Browser Audit with Fit View ---');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  await page.goto('http://localhost:8480');
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Login if required
  const emailInput = await page.$('input[type="email"]');
  if (emailInput) {
    console.log('Logging in as demo@pmflow.local...');
    await page.fill('input[type="email"]', 'demo@pmflow.local');
    await page.fill('input[type="password"]', 'demo1234');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);
  }

  // Select project
  const projectBtn = await page.$('text="機房搬遷"');
  if (projectBtn) {
    console.log('Selecting project...');
    await projectBtn.click();
    await page.waitForTimeout(1500);
  }

  // Click on "新關聯表" tab
  const simpleTab = await page.$('button:has-text("新關聯表")');
  if (simpleTab) {
    console.log('Navigating to 新關聯表 tab...');
    await simpleTab.click();
    await page.waitForTimeout(2000);
  }

  // Click "🎯 顯示全部" button to fit view
  const fitBtn = await page.$('button:has-text("顯示全部")');
  if (fitBtn) {
    console.log('Clicking 顯示全部 button...');
    await fitBtn.click();
    await page.waitForTimeout(1000);
  }

  // Take screenshot
  const screenshotPath = 'C:/Users/Guset/.gemini/antigravity-cli/brain/2306590f-4589-4ae8-8623-678aa3866b42/simplegraph_live_audit.png';
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`Saved snapshot to ${screenshotPath}`);

  await browser.close();
  console.log('--- Audit Completed ---');
})();
