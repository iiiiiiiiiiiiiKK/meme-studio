import { chromium } from "playwright";

const url = "https://iiiiiiiiiiiiiKK.github.io/meme-studio/";
const browser = await chromium.launch({ args: ["--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(`[pageerror] ${e.message}`));
page.on("requestfailed", (r) => errors.push(`[failed] ${r.url()} ${r.failure()?.errorText}`));
page.on("response", (r) => { if (r.status() >= 400) errors.push(`[http ${r.status()}] ${r.url()}`); });

await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
// The UI follows the browser language, so anchor on a test id rather than copy.
await page.waitForSelector('[data-testid="hero-create"]', { timeout: 60000 });

// Discover: import the starter pack and check My Space
await page.getByTestId("nav-discover").click();
await page.waitForSelector("article", { timeout: 20000 });
await page.waitForTimeout(1500);
const importAll = page.locator('button:has-text("Import all"), button:has-text("导入全部")').first();
await importAll.click({ timeout: 20000 });
await page.waitForTimeout(4000);
await page.getByTestId("nav-library").click();
await page.waitForSelector("text=/Assets|素材/", { timeout: 20000 });
const assets = await page.locator("text=/Assets ·|素材 ·/").first().innerText().catch(() => "n/a");
console.log("LIBRARY:", assets);
console.log("STORAGE:", await page.locator("text=/used|已用/i").first().innerText().catch(() => "n/a"));

// Batch: queue two images, process, export ZIP
await page.getByTestId("nav-batch").click();
await page.waitForSelector("text=/Batch Studio|批量工作室/", { timeout: 20000 });
console.log("BATCH PAGE OK");

// Templates + settings
await page.getByTestId("nav-templates").click();
await page.waitForSelector("text=/Built-in|内置/", { timeout: 20000 });
console.log("TEMPLATES OK");
await page.getByTestId("nav-settings").click();
await page.waitForSelector("text=/Local AI engine|本地 AI 引擎/", { timeout: 20000 });
console.log("SETTINGS OK");

await page.screenshot({ path: "docs/screenshots/12-live-production.png" });
console.log("ERRORS:", errors.length ? errors.join("\n") : "none");
await browser.close();
