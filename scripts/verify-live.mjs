import { chromium } from "playwright";

const url = process.argv[2] ?? "https://iiiiiiiiiiiiiKK.github.io/meme-studio/";
const browser = await chromium.launch({ args: ["--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const logs = [];
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
page.on("requestfailed", (r) => logs.push(`[failed] ${r.url()} ${r.failure()?.errorText}`));
page.on("response", (r) => { if (r.status() >= 400) logs.push(`[http ${r.status()}] ${r.url()}`); });
await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForSelector("h1:has-text(\"meme asset factory\")", { timeout: 30000 });
console.log("TITLE:", await page.title());
console.log("H1:", (await page.locator("h1").first().innerText()).replace(/\n/g, " "));
console.log("X LINK:", await page.getByTestId("author-x-link").getAttribute("href"));

// navigate to the cutout studio and run the local engine on a synthetic image
await page.getByTestId("nav-create").click();
await page.waitForSelector("[data-testid=\"create-dropzone\"]", { timeout: 20000 });
console.log("CREATE PAGE OK");

// models must be reachable
for (const m of ["models/rvm.json", "models/blazeface.json", "models/facemesh.json"]) {
  const res = await page.request.get(new URL(m, url).href);
  console.log("MODEL", m, res.status(), res.headers()["content-type"]);
}

// discover + library
await page.goto(url + "#/discover");
await page.waitForSelector("article", { timeout: 20000 });
console.log("DISCOVER CARDS:", await page.locator("article").count());
await page.goto(url + "#/settings");
await page.waitForSelector("text=Local AI engine", { timeout: 20000 });
console.log("SETTINGS OK");
await page.screenshot({ path: "docs/screenshots/12-live-production.png" });
console.log("LOGS:\n" + logs.join("\n"));
await browser.close();
