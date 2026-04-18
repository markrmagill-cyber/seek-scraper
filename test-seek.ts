import { chromium } from 'playwright';

async function testSeek() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  await page.goto('https://www.seek.com.au/jobs?where=All-Australia', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  const firstJobUrl = await page.evaluate(() => {
    const link = document.querySelector('a[href*="/job/"]');
    return link ? 'https://www.seek.com.au' + link.getAttribute('href')?.split('?')[0] : '';
  });

  console.log('Job URL:', firstJobUrl);

  if (firstJobUrl) {
    await page.goto(firstJobUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    const data = await page.evaluate(() => {
      const selectors = document.querySelectorAll('[data-automation]');
      const found: string[] = [];
      selectors.forEach((el: any) => {
        const text = el.textContent?.trim().substring(0, 80);
        found.push(el.getAttribute('data-automation') + ' => ' + text);
      });
      return found;
    });

    console.log('\n=== SELECTORS FOUND ===');
    data.forEach(s => console.log(s));
  }

  await browser.close();
}

testSeek().catch(console.error);
