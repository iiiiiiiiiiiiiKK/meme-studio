import { chromium } from "playwright";
import zlib from "node:zlib";

function minimalPng(w, h) {
  const raw = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const inside = x > w * 0.25 && x < w * 0.75 && y > h * 0.25 && y < h * 0.75;
      const p = (y * w + x) * 4;
      raw[p] = inside ? 196 : 40; raw[p+1] = inside ? 120 : 40; raw[p+2] = inside ? 60 : 60; raw[p+3] = inside ? 255 : 0;
    }
  }
  const stride = w * 4 + 1;
  const scanlines = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    scanlines[y * stride] = 0;
    raw.copy(scanlines, y * stride + 1, y * w * 4, (y + 1) * w * 4);
  }
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(body) >>> 0, 0);
    return Buffer.concat([length, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([signature, chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(scanlines)), chunk("IEND", Buffer.alloc(0))]);
}

const url = process.argv[2] ?? "https://iiiiiiiiiiiiiKK.github.io/meme-studio/";
const browser = await chromium.launch({ args: ["--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(`[pageerror] ${e.message}`));
page.on("requestfailed", (r) => errors.push(`[failed] ${r.url()} ${r.failure()?.errorText}`));

await page.goto(url + "#/create", { waitUntil: "networkidle", timeout: 90000 });
await page.waitForSelector("[data-testid=\"create-dropzone\"]", { timeout: 30000 });
await page.locator("input[type=\"file\"][accept=\"image/*\"]").setInputFiles({ name: "prod.png", mimeType: "image/png", buffer: minimalPng(200, 200) });
await page.waitForTimeout(1500);
await page.getByTestId("run-analysis").click();

let summary = "";
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(3000);
  const body = await page.evaluate(() => document.body.innerText);
  const m = body.match(/\d+ face.*?·.*?·.*?ms/);
  if (m) { summary = m[0]; break; }
  if (body.includes("failed to start")) { summary = "ENGINE ERROR: " + body.match(/Local AI engine failed to start:[^\n]*/)?.[0]; break; }
}
console.log("ANALYSIS:", summary || "timeout");
const pills = await page.evaluate(() => Array.from(document.querySelectorAll("span")).map((s) => s.textContent).filter((t) => t && (t.includes("matte") || t === "Ready")).slice(0, 6));
console.log("PILLS:", JSON.stringify(pills));
const hasExport = await page.getByRole("button", { name: "Save to My Space" }).isVisible().catch(() => false);
console.log("RESULT PANEL:", hasExport);
await page.screenshot({ path: "docs/screenshots/13-live-cutout.png" });
console.log("ERRORS:", errors.length ? errors.join("\n") : "none");
await browser.close();
