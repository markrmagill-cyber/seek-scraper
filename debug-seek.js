const { chromium } = require('playwright');

async function test() {
  const browser = await chromium.launch({ 
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-web-security",
      "--disable-features=IsolateOrigins,site-per-process"
    ]
  });
  
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
    locale: "en-AU",
    timezoneId: "Australia/Sydney",
    extraHTTPHeaders: {
      "Accept-Language": "en-AU,en;q=0.9",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    }
  });

  // Remove webdriver flag
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3] });
    Object.defineProperty(navigator, "languages", { get: () => ["en-AU", "en"] });
  });

  const page = await context.newPage();
  
  await page.goto("https://www.seek.com.au/jobs?where=All-Australia", {
    waitUntil: "domcontentloaded", timeout: 60000
  });
  
  await page.waitForTimeout(5000);
  
  const result = await page.evaluate(() => {
    const allLinks = document.querySelectorAll("a");
    const jobLinks = [];
    allLinks.forEach(a => {
      const href = a.href || "";
      if (href.includes("/job/")) jobLinks.push(href.split("?")[0]);
    });
    return {
      totalLinks: allLinks.length,
      jobLinks: [...new Set(jobLinks)].slice(0, 5),
      title: document.title
    };
  });
  
  console.log("Page title:", result.title);
  console.log("Total links:", result.totalLinks);
  console.log("Job links:", result.jobLinks);
  
  await browser.close();
}

test().catch(console.error);
