import { chromium } from "playwright";

const API_URL = "https://api.yesjobs.com.au/api/seek-import/jobs";
const API_KEY = "yesjobs-seek-key-2024";
const JOBS_PER_RUN = 1000;
const BATCH_SIZE = 3;

const CATEGORIES = [
  "jobs-in-accounting",
  "jobs-in-administration-office-support",
  "jobs-in-banking-financial-services",
  "jobs-in-call-centre-customer-service",
  "jobs-in-community-services-development",
  "jobs-in-construction",
  "jobs-in-education-training",
  "jobs-in-engineering",
  "jobs-in-government-defence",
  "jobs-in-healthcare-medical",
  "jobs-in-hospitality-tourism",
  "jobs-in-human-resources-recruitment",
  "jobs-in-information-communication-technology",
  "jobs-in-legal",
  "jobs-in-manufacturing-transport-logistics",
  "jobs-in-marketing-communications",
  "jobs-in-mining-resources-energy",
  "jobs-in-retail-consumer-products",
  "jobs-in-sales",
  "jobs-in-trades-services"
];

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const randomDelay = (min: number, max: number) => delay(Math.floor(Math.random() * (max - min) + min));

const mapJobType = (workType: string): string => {
  const lower = workType?.toLowerCase() || "";
  if (lower.includes("full")) return "FULL_TIME";
  if (lower.includes("part")) return "PART_TIME";
  if (lower.includes("contract")) return "CONTRACT";
  if (lower.includes("casual") || lower.includes("freelance")) return "FREELANCE";
  if (lower.includes("intern")) return "INTERNSHIP";
  return "FULL_TIME";
};

const cleanText = (text: string): string => {
  return text
    .replace(/```[a-z]*/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[\u2022*]/g, " ")
    .replace(/\s+\.\s+/g, ". ")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const trimToSentence = (text: string, maxLen: number): string => {
  const stopWords = ["what we offer", "we offer", "why join", "benefits", "apply now",
    "please submit", "send your", "click apply", "if you are interested",
    "what\u2019s in it for you", "in return", "perks", "salary package"];
  let result = text;
  const lower = text.toLowerCase();
  for (const stop of stopWords) {
    const idx = lower.indexOf(stop);
    if (idx > 100) { result = text.substring(0, idx).trim(); break; }
  }
  if (result.length <= maxLen) return result;
  const trimmed = result.substring(0, maxLen);
  const lastDot = Math.max(trimmed.lastIndexOf(". "), trimmed.lastIndexOf("! "), trimmed.lastIndexOf("? "));
  const lastSpace = trimmed.lastIndexOf(" ");
  return lastDot > maxLen * 0.6 ? trimmed.substring(0, lastDot + 1).trim() : trimmed.substring(0, lastSpace).trim();
};

const removeAIPreamble = (text: string): string => {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^here is[^\n]*\n/gi, "").trim();
  cleaned = cleaned.replace(/^here are[^\n]*\n/gi, "").trim();
  cleaned = cleaned
    .replace(/\bShe\b/g, "The candidate").replace(/\bHe\b/g, "The candidate")
    .replace(/\bshe\b/g, "the candidate").replace(/\bhe\b/g, "the candidate")
    .replace(/\bHer\b/g, "The candidate").replace(/\bHis\b/g, "The candidate")
    .replace(/\bher\b/g, "the candidate").replace(/\bhis\b/g, "the candidate");
  return cleaned;
};

const cleanWithAI = async (text: string): Promise<string> => {
  if (!text || text.length < 50) return text;
  const prompt = `[INST]Write a 3-sentence professional summary of this job. Use "This role" to start. Never use she/he/her/his. No intro phrases. Write directly:[/INST]\n${text.substring(0, 1000)}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: "llama3.2:3b",
        prompt,
        stream: false,
        options: { temperature: 0.3, num_predict: 400 }
      })
    });
    clearTimeout(timeout);
    const result = await response.json();
    return removeAIPreamble(result.response?.trim() || "") || text.substring(0, 400);
  } catch(e: any) {
    return text.substring(0, 400);
  }
};

const sendBatch = async (jobs: any[]): Promise<any> => {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify(jobs),
  });
  return response.json();
};

async function scrapeSeekJobs() {
  console.log("Starting Seek scraper - Target: " + JOBS_PER_RUN + " jobs");
  console.log(new Date().toISOString());

  const proxyUser = process.env.PROXY_USERNAME || "hfyqlaym";
  const proxyPass = process.env.PROXY_PASSWORD || "7iz9d8vsyslp";
  const browser = await chromium.launch({
    headless: true,
    proxy: {
      server: "http://p.webshare.io:80",
      username: proxyUser + "-au-" + Math.floor(Math.random() * 20 + 1),
      password: proxyPass
    },
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-blink-features=AutomationControlled"]
  });

  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
    locale: "en-AU",
    timezoneId: "Australia/Sydney",
    extraHTTPHeaders: {
      "Accept-Language": "en-AU,en;q=0.9",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3] });
    Object.defineProperty(navigator, "languages", { get: () => ["en-AU", "en"] });
  });

  let page = await context.newPage();
  let totalImported = 0;
  let totalSkipped = 0;
  let totalFailed = 0;
  const batch: any[] = [];
  let catIdx = 0;
  let pageNum = 1;

  try {
    while ((totalImported + batch.length) < JOBS_PER_RUN) {
      if (catIdx >= CATEGORIES.length) {
        console.log("All categories done!");
        break;
      }

      const category = CATEGORIES[catIdx];
      const seekUrl = "https://www.seek.com.au/" + category + "?where=All-Australia&page=" + pageNum;
      console.log("\nCategory: " + category + " Page: " + pageNum);

      try {
        await page.goto(seekUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
        // Wait for Cloudflare challenge to pass
        await page.waitForTimeout(5000);
        const title = await page.title();
        console.log("Page title: " + title);
        if (title.includes("moment") || title.includes("Just a")) {
          console.log("Cloudflare detected - waiting 30 seconds...");
          await page.waitForTimeout(30000);
          const newTitle = await page.title();
          console.log("Title after wait: " + newTitle);
        }
        await randomDelay(2000, 3000);
      } catch(e: any) {
        console.log("Page load failed - retrying with new connection...");
        await page.close();
        page = await context.newPage();
        await randomDelay(5000, 8000);
        continue;
      }

      // Wait for jobs to load
      await page.waitForTimeout(5000);
      // Debug - count all links
      const allLinks = await page.evaluate(() => {
        const all = document.querySelectorAll("a[href]");
        const jobLinks = Array.from(all).filter((a: any) => a.href.includes("/job/"));
        console.log("Total links: " + all.length + ", Job links: " + jobLinks.length);
        return jobLinks.slice(0,3).map((a: any) => a.href);
      });
      console.log("Sample job links:", JSON.stringify(allLinks));
      const jobLinks = await page.evaluate(() => {
        const links = document.querySelectorAll("a[href*='/job/']");
        const urls: string[] = [];
        links.forEach((a: any) => {
          const href = a.href || "";
          if (href.includes("/job/") && href.includes("seek.com")) {
            const clean = href.split("?")[0];
            if (!urls.includes(clean)) urls.push(clean);
          }
        });
        // Also try data-automation links
        if (urls.length === 0) {
          document.querySelectorAll("[data-automation='job-list-item'] a").forEach((a: any) => {
            const href = a.href || "";
            if (href && !urls.includes(href)) urls.push(href.split("?")[0]);
          });
        }
        return urls.slice(0, 22);
      });

      console.log("Found " + jobLinks.length + " jobs");

      if (jobLinks.length === 0) {
        console.log("No jobs on page " + pageNum + " - switching category");
        catIdx++;
        pageNum = 1;
        continue;
      }

      for (const jobUrl of jobLinks) {
        if ((totalImported + batch.length) >= JOBS_PER_RUN) break;

        try {
          await randomDelay(3000, 6000);
          await page.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
          await randomDelay(2000, 4000);

          const jobData = await page.evaluate(() => {
            const getText = (selector: string) =>
              (document.querySelector("[data-automation=\"" + selector + "\"]") as any)?.textContent?.trim() || "";

            const descEl = document.querySelector("[data-automation=\"jobAdDetails\"]");
            const convertToText = (el: any): string => {
              if (!el) return "";
              const clone = el.cloneNode(true);
              clone.querySelectorAll("p, div, h1, h2, h3, h4").forEach((node: any) => {
                node.prepend(document.createTextNode("\n"));
                node.append(document.createTextNode("\n"));
              });
              clone.querySelectorAll("br").forEach((node: any) => node.replaceWith(document.createTextNode("\n")));
              clone.querySelectorAll("li").forEach((node: any) => node.prepend(document.createTextNode("\n")));
              return (clone.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
            };

            const fullText = convertToText(descEl);
            const lower = fullText.toLowerCase();
            const stopIdx = lower.search(/(equal opportunity|report this job|unlock job insights|be careful|supporting diversity)/);
            const safeText = stopIdx > 100 ? fullText.substring(0, stopIdx).trim() : fullText;

            const respIdx = lower.search(/\n(key responsibilit|about the role|the role|your role|responsibilities)/);
            const skillsIdx = lower.search(/\n(skills|requirements|about you|you will need|to be successful|essential criteria)/);
            const benefitsIdx = lower.search(/\n(what we offer|benefits|why join)/);

            let description = "", keyResponsibilities = "", skillsAndExperience = "";

            if (respIdx > 30 && skillsIdx > respIdx) {
              description = safeText.substring(0, respIdx).trim();
              const skillsEnd = benefitsIdx > skillsIdx ? benefitsIdx : safeText.length;
              keyResponsibilities = safeText.substring(respIdx, skillsIdx).trim();
              skillsAndExperience = safeText.substring(skillsIdx, skillsEnd).trim();
            } else if (respIdx > 30) {
              description = safeText.substring(0, respIdx).trim();
              keyResponsibilities = safeText.substring(respIdx).trim();
              skillsAndExperience = "";
            } else {
              const sentences = safeText.split(/(?<=[.!?])\s+/).filter((s: string) => s.trim().length > 15);
              const t = Math.floor(sentences.length / 3);
              description = sentences.slice(0, t).join(" ").trim();
              keyResponsibilities = sentences.slice(t, t * 2).join(" ").trim();
              skillsAndExperience = sentences.slice(t * 2).join(" ").trim();
            }

            return {
              title: getText("job-detail-title"),
              company: getText("advertiser-name"),
              location: getText("job-detail-location"),
              classification: getText("job-detail-classifications"),
              workType: getText("job-detail-work-type"),
              salary: (document.querySelector("[data-automation=\"job-detail-salary\"]") as any)?.textContent?.trim() || "",
              description,
              keyResponsibilities,
              skillsAndExperience,
            };
          });

          if (!jobData.title) continue;

          const aiDescription = await cleanWithAI(cleanText(jobData.description || jobData.title));
          const aiResponsibilities = trimToSentence(cleanText(jobData.keyResponsibilities || jobData.description), 1200);
          const aiSkills = jobData.skillsAndExperience ?
            trimToSentence(cleanText(jobData.skillsAndExperience), 1200) :
            trimToSentence(cleanText(jobData.keyResponsibilities || ""), 1200);

          const salaryNumbers = jobData.salary.match(/[\d,]+/g) || [];
          const salaryMin = salaryNumbers[0] ? parseInt(salaryNumbers[0].replace(/,/g, "")) : 0;
          const salaryMax = salaryNumbers[1] ? parseInt(salaryNumbers[1].replace(/,/g, "")) : salaryMin;

          batch.push({
            Listing_Title: jobData.title,
            Listing_Description: aiDescription,
            Key_Responsibilities: aiResponsibilities,
            Skills_Experience: aiSkills,
            Employment_Type: jobData.workType || "Full time",
            Location: jobData.location,
            Salary_Min: salaryMin.toString(),
            Salary_Max: salaryMax.toString(),
            Classification: jobData.classification,
            jobType: mapJobType(jobData.workType),
            Company_Name: jobData.company,
            Listing_URL: jobUrl,
          });

          console.log("  " + (totalImported + batch.length) + "/" + JOBS_PER_RUN + ": " + jobData.title + " | " + jobData.company);

          if (batch.length >= BATCH_SIZE) {
            const result = await sendBatch([...batch]);
            totalImported += result.data?.imported || 0;
            totalSkipped += result.data?.skipped || 0;
            totalFailed += result.data?.failed || 0;
            console.log("  Batch saved: " + result.data?.imported + " new, " + result.data?.skipped + " skipped");
            batch.length = 0;
            await randomDelay(2000, 3000);
          }

        } catch(e: any) {
          console.log("  Failed: " + e.message);
          totalFailed++;
          // Recreate page on tunnel failure
          if (e.message.includes("TUNNEL") || e.message.includes("SSL") || e.message.includes("interrupted")) {
            try {
              await page.close();
              page = await context.newPage();
              await randomDelay(3000, 5000);
            } catch(e2: any) {}
          }
        }
      }

      pageNum++;
      if (pageNum > 25) {
        pageNum = 1;
        catIdx++;
        console.log("Switching to next category: " + (CATEGORIES[catIdx] || "done"));
      }

      await randomDelay(2000, 3000);
    }

    if (batch.length > 0) {
      const result = await sendBatch([...batch]);
      totalImported += result.data?.imported || 0;
      totalSkipped += result.data?.skipped || 0;
    }

  } finally {
    await browser.close();
  }

  console.log("\nSCRAPING COMPLETE!");
  console.log("Imported: " + totalImported);
  console.log("Skipped: " + totalSkipped);
  console.log("Failed: " + totalFailed);
  console.log(new Date().toISOString());
}

scrapeSeekJobs().catch(console.error);
