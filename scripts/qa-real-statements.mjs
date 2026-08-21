import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const base = process.argv[2] || "http://127.0.0.1:8080";
const fixtures = join(dirname(fileURLToPath(import.meta.url)), "fixtures/statements");
mkdirSync("/workspace/screenshots", { recursive: true });

const browser = await chromium.launch({ headless: true });
const errors = [];
const notes = [];

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
  await page.waitForTimeout(400);

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Clear all" }).click();
  await page.waitForTimeout(300);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  await page.getByRole("button", { name: "Statement" }).first().click();
  await page.waitForTimeout(200);
  await page.locator('input[type="file"][accept*="csv"]').setInputFiles(join(fixtures, "westpac.csv"));
  await page.waitForTimeout(600);

  const dialog = page.locator('[role="dialog"]');
  const review = await dialog.innerText();
  await page.screenshot({ path: "/workspace/screenshots/qa-real-westpac-review.png", fullPage: true });

  if (!review.includes("$7,432.18")) fail("Salary $7,432.18 missing from Westpac review");
  if (!review.includes("$87.43")) fail("Countdown $87.43 missing");
  if (!review.includes("$2,150.00")) fail("Rent $2,150.00 missing");
  if (!review.includes("$12.07")) fail("Interest $12.07 missing");
  if (!/4 in/i.test(review) || !/16 out/i.test(review)) fail(`Expected 4 in · 16 out, got: ${review.slice(0, 400)}`);

  const payroll = dialog.locator("li").filter({ hasText: "PAYROLL" });
  const payrollSide = await payroll.locator('button[aria-pressed="true"]').innerText();
  if (payrollSide.trim() !== "In") fail(`Payroll marked ${payrollSide}, expected In`);

  const countdown = dialog.locator("li").filter({ hasText: "COUNTDOWN" });
  const countdownSide = await countdown.locator('button[aria-pressed="true"]').innerText();
  if (countdownSide.trim() !== "Out") fail(`Countdown marked ${countdownSide}, expected Out`);

  const rent = dialog.locator("li").filter({ hasText: "KAURI" });
  const rentSide = await rent.locator('button[aria-pressed="true"]').innerText();
  if (rentSide.trim() !== "Out") fail(`Rent marked ${rentSide}, expected Out`);

  await page.getByRole("button", { name: /Import 20/ }).click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: "/workspace/screenshots/qa-real-calendar.png", fullPage: true });

  const cal = await page.locator("body").innerText();
  if (!/\$9,023/.test(cal) && !/\$9,022/.test(cal)) fail(`Calendar income not ~$9,023: ${cal.slice(0, 500)}`);
  if (!/\$3,439/.test(cal)) fail("Calendar expense not $3,439");

  await page.getByRole("button", { name: "20 August 2026", exact: true }).click();
  await page.waitForTimeout(250);
  const day20 = await page.locator("body").innerText();
  if (!/\$7,432.18/.test(day20)) fail("20 Aug missing salary $7,432.18");
  if (!/In|Salary|PAYROLL|DHB/i.test(day20)) fail("20 Aug missing payroll label");
  await page.screenshot({ path: "/workspace/screenshots/qa-real-day-salary.png", fullPage: true });

  await page.getByRole("button", { name: "19 August 2026", exact: true }).click();
  await page.waitForTimeout(250);
  const day19 = await page.locator("body").innerText();
  if (!/\$87.43/.test(day19)) fail("19 Aug missing $87.43 groceries");
  if (!/\$7.50/.test(day19)) fail("19 Aug missing $7.50 coffee");
  await page.screenshot({ path: "/workspace/screenshots/qa-real-day-spend.png", fullPage: true });

  await page.goto(`${base}/activity`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const activity = await page.locator("body").innerText();
  if (!/20 entries/.test(activity)) fail(`Expected 20 entries, got ${activity.match(/(\d+) entries/)?.[0]}`);
  if (!activity.includes("$9,022.85")) fail("Activity missing $9,022.85 in");
  if (!activity.includes("$3,439.07")) fail("Activity missing $3,439.07 out");
  await page.screenshot({ path: "/workspace/screenshots/qa-real-activity.png", fullPage: true });
  notes.push("Westpac: 20 rows, $9,022.85 in, $3,439.07 out");

  await page.getByRole("button", { name: "Statement" }).click();
  await page.waitForTimeout(200);
  await page.locator('input[type="file"][accept*="csv"]').setInputFiles(join(fixtures, "westpac.csv"));
  await page.waitForTimeout(600);
  const dupReview = await page.locator('[role="dialog"]').innerText();
  await page.screenshot({ path: "/workspace/screenshots/qa-real-dupes.png", fullPage: true });
  if (!/already in Cove/i.test(dupReview)) fail("Re-uploading Westpac should mark every row as already in Cove");
  const importBtn = page.getByRole("button", { name: /^Import/ });
  if (!(await importBtn.isDisabled())) fail("Duplicate statement should disable import");
  notes.push("Westpac re-upload: all duplicates, import disabled");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Clear all" }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Statement" }).first().click();
  await page.waitForTimeout(200);
  await page.locator('input[type="file"][accept*="csv"]').setInputFiles(join(fixtures, "chase.csv"));
  await page.waitForTimeout(600);
  const chase = await page.locator('[role="dialog"]').innerText();
  await page.screenshot({ path: "/workspace/screenshots/qa-real-chase.png", fullPage: true });
  if (!chase.includes("$7,432.18")) fail("Chase salary amount missing");
  if (!/4 in/i.test(chase) || !/16 out/i.test(chase)) fail(`Chase expected 4 in · 16 out: ${chase.slice(0, 300)}`);
  const chasePay = page.locator('[role="dialog"] li').filter({ hasText: "PAYROLL" });
  const chaseSide = await chasePay.locator('button[aria-pressed="true"]').innerText();
  if (chaseSide.trim() !== "In") fail(`Chase payroll marked ${chaseSide}`);
  notes.push("Chase US MM/DD: salary in, groceries out");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Clear all" }).click();
  await page.keyboard.press("Escape");
  await page.goto(`${base}/calendar`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Statement" }).first().click();
  await page.locator('input[type="file"][accept*="ofx"]').setInputFiles(join(fixtures, "household.ofx"));
  await page.waitForTimeout(600);
  const ofx = await page.locator('[role="dialog"]').innerText();
  await page.screenshot({ path: "/workspace/screenshots/qa-real-ofx.png", fullPage: true });
  const ofxPay = page.locator('[role="dialog"] li').filter({ hasText: "DHB" });
  const ofxSide = await ofxPay.locator('button[aria-pressed="true"]').innerText();
  if (ofxSide.trim() !== "In") fail(`OFX payroll marked ${ofxSide}`);
  if (!ofx.includes("$7,432.18")) fail("OFX missing $7,432.18");
  if (!ofx.includes("$87.43")) fail("OFX missing $87.43");
  notes.push("OFX classified salary in, countdown out");

  await page.getByRole("button", { name: /Import/ }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "1 August 2026", exact: true }).click();
  await page.waitForTimeout(200);
  const aug1 = await page.locator("body").innerText();
  if (!/\$2,150.00/.test(aug1)) fail("OFX rent $2,150.00 not on 1 Aug");
  await page.screenshot({ path: "/workspace/screenshots/qa-real-ofx-calendar.png", fullPage: true });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto(`${base}/calendar`, { waitUntil: "networkidle" });
  await mobile.waitForTimeout(400);
  await mobile.screenshot({ path: "/workspace/screenshots/qa-real-mobile.png", fullPage: true });

  const verdict = { ok: errors.length === 0, errors, notes };
  writeFileSync("/workspace/screenshots/qa-real-statements.json", JSON.stringify(verdict, null, 2));
  console.log(JSON.stringify(verdict, null, 2));
  if (!verdict.ok) process.exit(1);
} catch (err) {
  const verdict = { ok: false, errors: [...errors, String(err)], notes };
  writeFileSync("/workspace/screenshots/qa-real-statements.json", JSON.stringify(verdict, null, 2));
  console.log(JSON.stringify(verdict, null, 2));
  process.exit(1);
} finally {
  await browser.close();
}
