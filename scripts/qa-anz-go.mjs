import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const base = process.argv[2] || "http://127.0.0.1:8080";
const fixtures = join(dirname(fileURLToPath(import.meta.url)), "fixtures/statements");
mkdirSync("/workspace/screenshots", { recursive: true });

const browser = await chromium.launch({ headless: true });
const errors = [];

function fail(msg) {
  errors.push(msg);
  throw new Error(msg);
}

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on("pageerror", (e) => errors.push(`page: ${e.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });

  await page.goto(`${base}/calendar`, { waitUntil: "networkidle", timeout: 45000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(400);

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Clear all" }).click();
  await page.waitForTimeout(250);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const emptied = await page.locator("body").innerText();
  if (/Monthly salary/.test(emptied) && /\$7,400/.test(emptied)) {
    // try once more if persist raced
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("button", { name: "Clear all" }).click();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }

  await page.getByRole("button", { name: "Statement" }).first().click();
  await page.waitForTimeout(200);
  const dialog = page.locator('[role="dialog"]');
  if (!/PDF/i.test(await dialog.innerText())) fail("Upload dialog does not mention PDF");

  await page.locator('input[type="file"]').setInputFiles(join(fixtures, "anz-go.pdf"));
  const reviewReady = page.locator('[role="dialog"] li').first();
  try {
    await reviewReady.waitFor({ timeout: 20000 });
  } catch {
    const stuck = await dialog.innerText();
    fail(`PDF review did not appear: ${stuck.slice(0, 800)}`);
  }
  await page.waitForTimeout(400);
  await page.screenshot({ path: "/workspace/screenshots/qa-anz-pdf-review.png", fullPage: true });

  const review = await dialog.innerText();
  if (!/12 in/i.test(review) || !/35 out/i.test(review)) fail(`Expected 12 in · 35 out, got: ${review.slice(0, 500)}`);
  if (!/\$1,869\.18/.test(review)) fail("Missing wage $1,869.18");
  if (!/\$228\.44/.test(review)) fail("Missing DIDI $228.44");
  if (!/Waitomo/i.test(review)) fail("Missing Waitomo");

  const didi = dialog.locator("li").filter({ hasText: "DIDI" }).first();
  const didiSide = await didi.locator('button[aria-pressed="true"]').innerText();
  if (didiSide.trim() !== "In") fail(`DIDI marked ${didiSide}, expected In`);

  const waitomo = dialog.locator("li").filter({ hasText: "Waitomo" }).first();
  const waitomoSide = await waitomo.locator('button[aria-pressed="true"]').innerText();
  if (waitomoSide.trim() !== "Out") fail(`Waitomo marked ${waitomoSide}, expected Out`);

  const wage = dialog.locator("li").filter({ hasText: "Wage" }).first();
  const wageSide = await wage.locator('button[aria-pressed="true"]').innerText();
  if (wageSide.trim() !== "In") fail(`Wage marked ${wageSide}, expected In`);

  await page.getByRole("button", { name: /Import 47/ }).click();
  await page.waitForTimeout(800);
  await page.getByText("Withdrawals", { exact: true }).waitFor({ timeout: 8000 });
  await page.screenshot({ path: "/workspace/screenshots/qa-anz-calendar-july.png", fullPage: true });

  const heading = await page.locator("h2").filter({ hasText: /2026/ }).first().innerText();
  if (!/July 2026/.test(heading)) {
    for (let i = 0; i < 6 && !/July 2026/.test(await page.locator("h2").filter({ hasText: /2026/ }).first().innerText()); i++) {
      await page.getByRole("button", { name: "Previous month" }).click();
      await page.waitForTimeout(200);
    }
  }
  await page.screenshot({ path: "/workspace/screenshots/qa-anz-calendar-july.png", fullPage: true });

  const cal = await page.locator("body").innerText();
  if (!/July 2026/.test(cal)) fail(`Expected July 2026, got heading area: ${cal.slice(0, 400)}`);
  const colWd = await page.getByText("Withdrawals", { exact: true }).count();
  const colDp = await page.getByText("Deposits", { exact: true }).count();
  const colBal = await page.getByText("Balance", { exact: true }).count();
  if (!colWd || !colDp || !colBal) {
    fail(`Calendar missing statement columns wd=${colWd} dp=${colDp} bal=${colBal} text=${cal.slice(0, 900)}`);
  }
  if (!/Totals at end of page/i.test(cal)) fail("Calendar missing totals row");
  if (!/Balance brought forward/i.test(cal)) fail("Calendar missing brought-forward row");
  if (!/\$4,326/.test(cal) && !/4,326\.35/.test(cal)) fail(`July income not ~$4,326: ${cal.slice(0, 800)}`);
  if (!/\$6,076/.test(cal) && !/6,076\.35/.test(cal)) fail("July expense not ~$6,076");

  await page.getByRole("button", { name: "14 July 2026", exact: true }).click();
  await page.waitForTimeout(250);
  const day14 = await page.locator("body").innerText();
  if (!/\$1,926\.54/.test(day14) && !/1,926\.54/.test(day14)) fail("14 Jul missing wage $1,926.54");
  await page.screenshot({ path: "/workspace/screenshots/qa-anz-july-14.png", fullPage: true });

  await page.getByRole("button", { name: "Previous month" }).click();
  await page.waitForTimeout(300);
  const june = await page.locator("body").innerText();
  if (!/June 2026/.test(june)) fail("Did not move to June");
  if (!/\$2,593/.test(june) && !/2,593\.36/.test(june)) fail("June income not ~$2,593");
  await page.screenshot({ path: "/workspace/screenshots/qa-anz-calendar-june.png", fullPage: true });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  mobile.on("pageerror", (e) => errors.push(`mobile page: ${e.message}`));
  await mobile.goto(`${base}/calendar`, { waitUntil: "networkidle", timeout: 45000 });
  await mobile.waitForTimeout(400);
  await mobile.screenshot({ path: "/workspace/screenshots/qa-anz-mobile.png", fullPage: true });
  const mob = await mobile.locator("body").innerText();
  if (!/Statement/.test(mob)) fail("Mobile calendar missing Statement");

  const verdict = { ok: errors.length === 0, errors };
  writeFileSync("/workspace/screenshots/qa-anz-go.json", JSON.stringify(verdict, null, 2));
  console.log(JSON.stringify(verdict, null, 2));
  if (!verdict.ok) process.exit(1);
} catch (err) {
  const verdict = { ok: false, errors: [...errors, String(err)] };
  writeFileSync("/workspace/screenshots/qa-anz-go.json", JSON.stringify(verdict, null, 2));
  console.error(JSON.stringify(verdict, null, 2));
  process.exit(1);
} finally {
  await browser.close();
}
