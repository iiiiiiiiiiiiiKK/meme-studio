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
console.log("LIVE OK · title:", await page.title());

// Editor round trip on the deployed bundle.
await page.getByTestId("nav-templates").click();
await page.waitForSelector("[data-testid=\"preset-use-builtin-square\"]", { timeout: 30000 });
await page.getByTestId("preset-use-builtin-square").click();
await page.waitForSelector("[data-testid=\"add-text-layer\"]", { timeout: 30000 });
await page.getByTestId("add-text-layer").click();
await page.waitForTimeout(800);
await page.getByTestId("text-layer-content").first().fill("LIVE TEST");
await page.waitForTimeout(600);
await page.getByTestId("editor-save").click();
await page.waitForTimeout(2500);
const saved = await page.evaluate(() => document.body.innerText.includes("Project saved to this device"));
console.log("EDITOR SAVE:", saved ? "ok" : "no toast");

// Export dialog on the live build.
await page.getByTestId("editor-export").click();
await page.waitForSelector("text=Export canvas", { timeout: 20000 });
const size = await page.evaluate(() => {
  const el = Array.from(document.querySelectorAll("p")).find((p) => p.textContent?.startsWith("Output:"));
  return el?.textContent ?? null;
});
console.log("EXPORT DIALOG:", size);
await page.screenshot({ path: "docs/screenshots/14-live-editor.png" });
console.log("ERRORS:", errors.length ? errors.join("\n") : "none");
await browser.close();
