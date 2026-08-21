import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
const logs = [];
page.on("pageerror", (e) => logs.push(e.message));

await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
await page.evaluate(() => {
  for (const k of Object.keys(localStorage)) localStorage.removeItem(k);
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(400);

async function ask(q) {
  const panelOpen = await page.getByText("Reads your ledger").isVisible().catch(() => false);
  if (!panelOpen) await page.getByRole("button", { name: "Ask Cove" }).click();
  await page.getByPlaceholder("Ask Cove anything about your money").fill(q);
  await page.getByRole("button", { name: "Send" }).click();
  await page.waitForFunction(() => !document.body.innerText.includes("Reading your books…"), null, { timeout: 20000 });
  await page.waitForTimeout(200);
  return page.locator(".fixed.inset-x-3, .lg\\:w-\\[400px\\]").first().innerText();
}

const askDate = await ask("add uber income $400");
const added = await ask("08/08/2026");
await page.screenshot({ path: "/workspace/screenshots/ask-cove-add.png" });

await page.getByRole("link", { name: /Activity|Log/ }).first().click();
await page.waitForTimeout(400);
const activity = await page.locator("main").innerText();

const deleted = await ask("delete uber");
await page.getByRole("link", { name: /Activity|Log/ }).first().click();
await page.waitForTimeout(300);
const afterDelete = await page.locator("main").innerText();

const result = {
  askedForDate: /date/i.test(askDate) && !/Entry added/i.test(askDate),
  addedLogged: /Entry added/i.test(added) && /400/.test(added) && /2026-08-08/.test(added),
  onActivity: /Uber/i.test(activity) && /400/.test(activity),
  deletedOk: /Deleted/i.test(deleted),
  goneFromActivity: !/Uber/i.test(afterDelete) || /Deleted/i.test(deleted),
  pageErrors: logs.slice(0, 5),
};
console.log(JSON.stringify(result, null, 2));
console.log("---ASK DATE---\n", askDate.slice(-400));
console.log("---ADDED---\n", added.slice(-400));
await browser.close();
if (!result.askedForDate || !result.addedLogged || !result.onActivity || !result.deletedOk) process.exit(1);
