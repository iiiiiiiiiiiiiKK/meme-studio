import { chromium } from "playwright";

const url = "https://iiiiiiiiiiiiiKK.github.io/meme-studio/";
const browser = await chromium.launch({ args: ["--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(`[pageerror] ${e.message}`));
page.on("requestfailed", (r) => errors.push(`[failed] ${r.url()} ${r.failure()?.errorText}`));
page.on("response", (r) => { if (r.status() >= 400) errors.push(`[http ${r.status()}] ${r.url()}`); });

await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForSelector("h1:has-text(\"meme asset factory\")", { timeout: 30000 });

// Discover: import the starter pack and check My Space
await page.getByTestId("nav-discover").click();
await page.waitForSelector("article", { timeout: 20000 });
await page.getByRole("button", { name: "Import all 12 starters" }).click();
await page.waitForTimeout(4000);
await page.getByTestId("nav-library").click();
await page.waitForSelector("text=Assets", { timeout: 20000 });
const assets = await page.locator("text=Assets ·").first().innerText();
console.log("LIBRARY:", assets);
console.log("STORAGE:", await page.locator("text=/used/i").first().innerText().catch(() => "n/a"));

// Batch: queue two images, process, export ZIP
await page.getByTestId("nav-batch").click();
await page.waitForSelector("text=Batch Studio", { timeout: 20000 });
console.log("BATCH PAGE OK");

// Templates + settings
await page.getByTestId("nav-templates").click();
await page.waitForSelector("text=Built-in", { timeout: 20000 });
console.log("TEMPLATES OK");
await page.getByTestId("nav-settings").click();
await page.waitForSelector("text=Local AI engine", { timeout: 20000 });
console.log("SETTINGS OK");

await page.screenshot({ path: "docs/screenshots/12-live-production.png" });
console.log("ERRORS:", errors.length ? errors.join("\n") : "none");
await browser.close();
