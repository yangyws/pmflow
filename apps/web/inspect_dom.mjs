import { chromium } from 'playwright';

(async () => {
  console.log('--- Inspecting ReactFlow DOM Structure ---');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  await page.goto('http://localhost:8480');
  await page.waitForTimeout(1000);

  // Clear stale localStorage
  await page.evaluate(() => localStorage.clear());

  // Login
  const emailInput = await page.$('input[type="email"]');
  if (emailInput) {
    await page.fill('input[type="email"]', 'demo@pmflow.local');
    await page.fill('input[type="password"]', 'demo1234');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);
  }

  // Select project
  const projectBtn = await page.$('text="機房搬遷"');
  if (projectBtn) {
    await projectBtn.click();
    await page.waitForTimeout(1500);
  }

  // Click on "新關聯表" tab
  const simpleTab = await page.$('button:has-text("新關聯表")');
  if (simpleTab) {
    await simpleTab.click();
    await page.waitForTimeout(3000);
  }

  // Inspect all node elements in DOM
  const nodeElements = await page.evaluate(() => {
    const nodes = document.querySelectorAll('.react-flow__node');
    return Array.from(nodes).map((n) => ({
      id: n.getAttribute('data-id'),
      className: n.className,
      style: n.getAttribute('style'),
      text: n.innerText.slice(0, 50).replace(/\n/g, ' '),
      bounds: n.getBoundingClientRect(),
    }));
  });

  console.log('DOM Nodes count:', nodeElements.length);
  nodeElements.forEach((n) => console.log(JSON.stringify(n)));

  await browser.close();
})();
