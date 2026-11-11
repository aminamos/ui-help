// Pre-login check for any state. Opens the real login page with Playwright,
// confirms a login form is there, saves a screenshot, and STOPS.
// It never types an SSN, password, or any credential and never submits anything.
//
// Run:  npm run check -- CA        (default: MN)
//       npm run check:mn           (same as: npm run check -- MN)
// Needs Playwright + a browser:  npm i -D playwright && npx playwright install chromium
import { getState, isStateOpen, STATES } from "../src/states.mjs";

const code = (process.argv[2] || "MN").toUpperCase();
const state = getState(code);
if (!state) {
  console.error(`Unknown state code: ${code}`);
  console.error(`Known codes: ${STATES.map((s) => s.code).join(", ")}`);
  process.exit(1);
}
const loginish = /Social Security|SSN|password|sign in|log ?in|username|ID\.me|Login\.gov/i;
console.log(`${state.name} (${state.code}) — ${state.agency}`);
console.log(`Login: ${state.loginUrl}`);
if (state.loginVia) console.log(`Login via: ${state.loginVia}`);
console.log(`Hours: ${state.hoursText} · System open right now: ${isStateOpen(state)}`);

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.log("\nPlaywright is not installed, so no browser was launched.");
  console.log("Falling back to a plain page fetch:");
  const r = await fetch(state.loginUrl, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 UIHelpPreloginCheck/0.1" } });
  const text = await r.text();
  console.log(`  HTTP ${r.status}`);
  console.log(`  Login page detected: ${loginish.test(text)}`);
  if (state.code === "MN") console.log(`  Hours printed on page: ${/6:00 A\.M\. to 8:00 P\.M/i.test(text)}`);
  console.log(`  Bot shield instead of login page: ${/shieldsquare|captcha/i.test(text) && !loginish.test(text)}`);
  console.log("\nTo run the real-browser check: npm i -D playwright && npx playwright install chromium");
  process.exit(0);
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const resp = await page.goto(state.loginUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  const content = await page.content();
  console.log(`HTTP ${resp?.status()}`);
  console.log(`Title: ${await page.title()}`);
  console.log(`Login page present: ${loginish.test(content)}`);
  console.log(`Bot shield / captcha: ${/shieldsquare|captcha/i.test(content) && !loginish.test(content)}`);
  const shot = `worker/${state.code.toLowerCase()}-login.png`;
  await page.screenshot({ path: shot, fullPage: false });
  console.log(`Screenshot saved to ${shot}`);
  console.log("Stopped at login. No credentials entered, nothing submitted.");
} finally {
  await browser.close();
}
