import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const url = "https://iiiiiiiiiiiiiKK.github.io/meme-studio/";
const browser = await chromium.launch({ args: ["--enable-unsafe-swiftshader"] });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => { if (r.status() >= 400) errors.push(String(r.status()) + " " + r.url()); });

await page.goto(url + "#/create", { waitUntil: "networkidle", timeout: 90000 });
await page.waitForSelector('[data-testid="create-dropzone"]', { timeout: 30000 });
const buf = readFileSync("node_modules/@vladmandic/human/assets/samples.jpg");
await page.locator('input[type="file"][accept="image/*"]').setInputFiles({ name: "group.jpg", mimeType: "image/jpeg", buffer: buf });
await page.waitForTimeout(1200);
await page.getByTestId("run-analysis").click();

let body = "";
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(2500);
  body = await page.evaluate(() => document.body.innerText);
  if (/张人脸|faces? ·/.test(body)) break;
}
const summary = body.match(/[^\n]*(张人脸|faces? ·)[^\n]*/);
console.log("analysis:", summary ? summary[0].trim() : "TIMEOUT");

// pick the "Head" mode and read the resulting sticker size
await page.getByRole("button", { name: /^头部$|^Head$/ }).first().click();
await page.waitForTimeout(2500);
const after = await page.evaluate(() => document.body.innerText);
const size = after.match(/(\d+)×(\d+) · (保留透明通道|alpha kept)/);
console.log("head result:", size ? size[0] : "none");
console.log("errors:", errors.length ? errors.slice(0, 4).join("; ") : "none");
await browser.close();
