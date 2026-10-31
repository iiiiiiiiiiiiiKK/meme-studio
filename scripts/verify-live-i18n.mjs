import { chromium } from "playwright";

const url = "https://iiiiiiiiiiiiiKK.github.io/meme-studio/";
const browser = await chromium.launch({ args: ["--enable-unsafe-swiftshader"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("[pageerror] " + e.message));
page.on("response", (r) => { if (r.status() >= 400) errors.push(`[http ${r.status()}] ${r.url()}`); });

await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForSelector("h1", { timeout: 30000 });
console.log("title:", await page.title());

// models
for (const m of ["models/selfie.json", "models/selfie.bin", "models/facemesh.json"]) {
  const res = await page.request.get(new URL(m, url).href);
  console.log("model", m, res.status());
}

// language switch
await page.getByTestId("nav-settings").click();
await page.getByRole("button", { name: "中文" }).click();
await page.waitForTimeout(500);
console.log("nav-home:", (await page.getByTestId("nav-home").innerText()).trim());
console.log("nav-create:", (await page.getByTestId("nav-create").innerText()).trim());
console.log("html lang:", await page.locator("html").getAttribute("lang"));
await page.screenshot({ path: "docs/screenshots/zh-live-settings.png" });

// run the engine on the live build
await page.getByTestId("nav-create").click();
await page.waitForSelector('[data-testid="create-dropzone"]', { timeout: 20000 });
console.log("create page (zh):", (await page.getByTestId("main").innerText()).slice(0, 80).replace(/\n/g, " | "));
console.log("errors:", errors.length ? errors.join("\n") : "none");
await browser.close();
