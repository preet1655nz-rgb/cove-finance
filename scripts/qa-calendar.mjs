import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const base = process.argv[2] || "http://127.0.0.1:8080";
mkdirSync("/workspace/screenshots", { recursive: true });

const browser = await chromium.launch({ headless: true });
const errors = [];

async function shot(page, name) {
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: true });
}

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on("pageerror", (e) => errors.push(`page: ${e.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });

  await page.goto(`${base}/calendar`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(400);
  const calendarText = await page.locator("body").innerText();
  if (!/Calendar/.test(calendarText)) throw new Error("Calendar heading missing");
  await shot(page, "qa-calendar");

  await page.getByRole("button", { name: "Statement" }).first().click();
  await page.waitForTimeout(300);
  await shot(page, "qa-statement-empty");

  await page.getByRole("button", { name: "Try a sample" }).click();
  await page.waitForTimeout(400);
  const dialogText = await page.locator('[role="dialog"]').innerText();
  if (!/COUNTDOWN/i.test(dialogText)) throw new Error("Sample rows missing");
  if (!/in/i.test(dialogText) || !/out/i.test(dialogText)) throw new Error("Income/expense summary missing");
  const salaryRow = page.locator('[role="dialog"] li').filter({ hasText: "ACME" });
  await salaryRow.waitFor();
  const salaryPressed = await salaryRow.locator('button[aria-pressed="true"]').innerText();
  if (salaryPressed.trim() !== "In") throw new Error(`Salary not marked income, got ${salaryPressed}`);
  const shopRow = page.locator('[role="dialog"] li').filter({ hasText: "COUNTDOWN" });
  const shopPressed = await shopRow.locator('button[aria-pressed="true"]').innerText();
  if (shopPressed.trim() !== "Out") throw new Error(`Countdown not marked expense, got ${shopPressed}`);
  await shot(page, "qa-statement-review");

  await page.getByRole("button", { name: /Import/ }).click();
  await page.waitForTimeout(500);
  await shot(page, "qa-calendar-after-import");

  await page.getByRole("button", { name: "14 August 2026" }).click();
  await page.waitForTimeout(200);
  const dayText = await page.locator("body").innerText();
  if (!/ACME|SALARY/i.test(dayText)) throw new Error("Salary not visible on the 14th");
  await shot(page, "qa-calendar-day");

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  mobile.on("pageerror", (e) => errors.push(`mobile page: ${e.message}`));
  await mobile.goto(`${base}/calendar`, { waitUntil: "networkidle", timeout: 45000 });
  await mobile.waitForTimeout(400);
  await mobile.screenshot({ path: "/workspace/screenshots/qa-calendar-mobile.png", fullPage: true });
  await mobile.getByRole("link", { name: "Calendar" }).click();
  await mobile.waitForTimeout(200);

  const verdict = {
    ok: errors.length === 0,
    errors,
    calendarHasHeading: /Calendar/.test(calendarText),
    sampleClassified: true,
  };
  writeFileSync("/workspace/screenshots/qa-calendar.json", JSON.stringify(verdict, null, 2));
  console.log(JSON.stringify(verdict, null, 2));
  if (!verdict.ok) process.exit(1);
} finally {
  await browser.close();
}
