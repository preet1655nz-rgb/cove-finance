import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
const logs = [];
page.on("console", (m) => {
  if (m.type() === "error") logs.push(`error: ${m.text()}`);
});
page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));
page.on("requestfailed", (r) => logs.push(`fail: ${r.url()} ${r.failure()?.errorText}`));

await page.goto("http://127.0.0.1:8080/calendar", { waitUntil: "networkidle" });
await page.getByRole("button", { name: /statement/i }).first().click();
await page.locator('input[type="file"]').setInputFiles("/workspace/attachments/State.pdf");
await page.waitForFunction(() => {
  const t = document.querySelector('[role="dialog"]')?.innerText ?? "";
  return /to import|could not be read|no selectable text|locked/i.test(t);
}, { timeout: 20000 });
const body = await page.getByRole("dialog").innerText();
await page.screenshot({ path: "/workspace/screenshots/state-pdf-upload.png" });
const ok =
  /78 to import/.test(body) &&
  /20 in/.test(body) &&
  /58 out/.test(body) &&
  /ANZ-style/.test(body) &&
  !/could not be read/i.test(body);
console.log(JSON.stringify({ ok, head: body.slice(0, 800), logs }, null, 2));
await browser.close();
if (!ok) process.exit(1);
