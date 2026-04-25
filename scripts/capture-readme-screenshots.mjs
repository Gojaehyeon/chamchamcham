import fs from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "assets", "images");
const TARGET_URL = process.env.README_SCREENSHOT_URL ?? "http://127.0.0.1:3030";

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function gotoAndSettle(page, urlPath) {
  const url = new URL(urlPath, TARGET_URL).toString();
  await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
  await sleep(1500);
}

async function capture(page, fileName) {
  await page.screenshot({
    path: path.join(OUTPUT_DIR, fileName),
    fullPage: false,
  });
}

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: {
    width: 1280,
    height: 900,
    deviceScaleFactor: 2,
  },
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    "--autoplay-policy=no-user-gesture-required",
  ],
});

try {
  const page = await browser.newPage();
  const origin = new URL(TARGET_URL).origin;
  await browser
    .defaultBrowserContext()
    .overridePermissions(origin, ["camera", "microphone"]);
  await ensureDir(OUTPUT_DIR);

  // Home — mode select
  await gotoAndSettle(page, "/");
  await capture(page, "chamchamcham-home.png");

  // Attack mode — AI defender
  await gotoAndSettle(page, "/attack");
  await sleep(1500);
  await capture(page, "chamchamcham-attack.png");

  // Defense mode — AI attacker
  await gotoAndSettle(page, "/defense");
  await sleep(1500);
  await capture(page, "chamchamcham-defense.png");

  console.log(`Saved README screenshots to ${OUTPUT_DIR}`);
} finally {
  await browser.close();
}
