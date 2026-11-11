import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync, createReadStream } from "node:fs";
import { join, extname, normalize } from "node:path";
import { randomUUID, createHash, randomBytes } from "node:crypto";
import { STATES, getState, isStateOpen, nextOpen, stateNow } from "./src/states.mjs";

const ROOT = new URL(".", import.meta.url).pathname;
const PUBLIC = join(ROOT, "public");
const DATA_DIR = join(ROOT, "data");
const DB_PATH = join(DATA_DIR, "db.json");
const PORT = Number(process.env.PORT || 4173);

await mkdir(DATA_DIR, { recursive: true });
if (!existsSync(DB_PATH)) await writeFile(DB_PATH, JSON.stringify({ users: [], filings: [], messages: [] }, null, 2));

async function db() { return JSON.parse(await readFile(DB_PATH, "utf8")); }
async function save(data) { await writeFile(DB_PATH, JSON.stringify(data, null, 2)); }
function hash(pw, salt) { return createHash("sha256").update(salt + ":" + pw).digest("hex"); }
function json(res, code, body) { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)); }
async function body(req) {
  let raw = ""; for await (const c of req) raw += c;
  try { return JSON.parse(raw || "{}"); } catch { return {}; }
}
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, contactPref: u.contactPref, state: u.state, createdAt: u.createdAt });

function approvalText(f, state) {
  return [
    `UI Help (${state ? state.name : f.state}): please review your weekly request for the week ending ${f.weekEnd}.`,
    `Worked this week: ${f.worked ? "Yes" : "No"} · Earnings: $${f.earnings || 0} · Able & available: ${f.ableAvailable ? "Yes" : "No"} · Job contacts: ${f.jobContacts}`,
    `Reply YES to approve filing exactly as shown, or open UI Help to edit. Nothing is filed without your yes.`,
  ].join("\n");
}

async function preloginCheck(state) {
  const started = new Date().toISOString();
  let loginHost = state.loginUrl;
  try { loginHost = new URL(state.loginUrl).hostname; } catch {}
  try {
    const r = await fetch(state.loginUrl, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 UIHelpPreloginCheck/0.1" } });
    const text = await r.text();
    const loginish = /Social Security|SSN|password|sign in|log ?in|username|ID\.me|Login\.gov/i.test(text);
    const botShield = /shieldsquare|captcha/i.test(text) && !loginish;
    return {
      ok: true, checkedAt: started, state: state.code, stateName: state.name, agency: state.agency,
      url: state.loginUrl, loginHost, reachable: r.status >= 200 && r.status < 400, httpStatus: r.status,
      loginFormDetected: loginish,
      hoursOnPage: state.code === "MN" ? /6:00 A\.M\. to 8:00 P\.M/i.test(text) : null,
      botShield, loginVia: state.loginVia || null,
      systemOpenNow: isStateOpen(state), hoursText: state.hoursText,
      note: botShield
        ? `${state.name} bounced this automated check to a bot shield. A real browser session may be required; we stop at login either way.`
        : `Login page for ${state.name} reached at ${loginHost}. We stop here — no credentials are entered in this build.`,
    };
  } catch (e) {
    return { ok: false, checkedAt: started, state: state.code, stateName: state.name, agency: state.agency, url: state.loginUrl, loginHost, reachable: false, error: String(e.message || e), loginVia: state.loginVia || null, systemOpenNow: isStateOpen(state), hoursText: state.hoursText };
  }
}

function statusFor(state) {
  const open = isStateOpen(state);
  const nxt = open === false ? nextOpen(state) : null;
  return {
    state: state.code, stateName: state.name, agency: state.agency, open,
    availabilityKnown: open !== null,
    nowStateTime: stateNow(state), timezone: state.timezone,
    hoursText: state.hoursText, hours: state.hours,
    nextOpen: nxt ? stateNow(state, nxt) : null,
    loginUrl: state.loginUrl, infoUrl: state.infoUrl, loginVia: state.loginVia || null,
  };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;

  if (p === "/api/states") return json(res, 200, { states: STATES.map(({ code, name, agency, status, type, hoursText, hours, timezone, loginVia, loginUrl, infoUrl }) => ({ code, name, agency, status, type: type || "state", hoursText, hours, timezone, loginVia: loginVia || null, loginUrl, infoUrl })) });

  const statusMatch = p.match(/^\/api\/states\/([A-Za-z]{2})\/status$/);
  if (statusMatch && req.method === "GET") {
    const st = getState(statusMatch[1]);
    if (!st) return json(res, 404, { error: `Unknown state: ${statusMatch[1].toUpperCase()}` });
    return json(res, 200, statusFor(st));
  }

  const checkMatch = p.match(/^\/api\/states\/([A-Za-z]{2})\/prelogin-check$/);
  if (checkMatch && req.method === "POST") {
    const st = getState(checkMatch[1]);
    if (!st) return json(res, 404, { error: `Unknown state: ${checkMatch[1].toUpperCase()}` });
    return json(res, 200, await preloginCheck(st));
  }

  // Back-compat aliases for the original MN-only build.
  if (p === "/api/mn/status") return json(res, 200, { ...statusFor(getState("MN")), nowCentral: stateNow(getState("MN")) });
  if (p === "/api/mn/prelogin-check" && req.method === "POST") return json(res, 200, await preloginCheck(getState("MN")));

  if (p === "/api/signup" && req.method === "POST") {
    const b = await body(req);
    if (!b.name || !/.+@.+\..+/.test(b.email || "") || !b.password) return json(res, 400, { error: "Name, a valid email, and a password for UI Help are required." });
    if (/^\d{9}$/.test(String(b.password).replace(/\D/g, "")) && String(b.password).replace(/\D/g, "").length === 9) return json(res, 400, { error: "Never use your SSN as a password. Pick a different password for UI Help." });
    const data = await db();
    if (data.users.some((u) => u.email.toLowerCase() === b.email.toLowerCase())) return json(res, 409, { error: "An account with that email already exists. Sign in with it instead." });
    const st = getState(b.state || "MN");
    if (!st) return json(res, 400, { error: `Unknown state: ${String(b.state).toUpperCase()}. Pick a state from the list.` });
    const salt = randomBytes(8).toString("hex");
    const user = { id: randomUUID(), name: b.name.trim(), email: b.email.trim(), phone: (b.phone || "").trim(), contactPref: ["email", "text", "both"].includes(b.contactPref) ? b.contactPref : "email", consentEmail: !!b.consentEmail, consentText: !!b.consentText, state: st.code, salt, passwordHash: hash(b.password, salt), createdAt: new Date().toISOString() };
    data.users.push(user); await save(data);
    return json(res, 201, { user: publicUser(user), note: "This is your UI Help account. It is not your state account, and we never ask for your SSN or state password here." });
  }

  if (p === "/api/filings" && req.method === "POST") {
    const b = await body(req); const data = await db();
    const user = data.users.find((u) => u.id === b.userId);
    if (!user) return json(res, 400, { error: "Create your UI Help account first (step 1)." });
    if (!b.weekEnd) return json(res, 400, { error: "Pick the week-ending date for this request." });
    const f = { id: randomUUID(), userId: user.id, state: user.state || "MN", weekEnd: b.weekEnd, worked: !!b.worked, earnings: Number(b.earnings || 0), employer: b.employer || "", ableAvailable: !!b.ableAvailable, refusedWork: !!b.refusedWork, jobContacts: Number(b.jobContacts || 0), notes: b.notes || "", status: "awaiting_approval", createdAt: new Date().toISOString(), approvedAt: null };
    data.filings.push(f);
    const via = user.contactPref === "both" ? "email + text" : user.contactPref;
    data.messages.push({ id: randomUUID(), userId: user.id, filingId: f.id, via, simulated: true, body: approvalText(f, getState(f.state)), createdAt: new Date().toISOString() });
    await save(data);
    return json(res, 201, { filing: f, message: "Approval request created. In this build the email/text is simulated in the inbox below — no real message is sent yet." });
  }

  if (p.startsWith("/api/filings/") && p.endsWith("/approve") && req.method === "POST") {
    const id = p.split("/")[3]; const data = await db(); const f = data.filings.find((x) => x.id === id);
    if (!f) return json(res, 404, { error: "Filing not found." });
    if (f.status !== "awaiting_approval") return json(res, 409, { error: `This filing is already ${f.status}.` });
    f.status = "queued"; f.approvedAt = new Date().toISOString();
    const st = getState(f.state) || getState("MN"); const open = isStateOpen(st);
    f.scheduledFor = open === true ? `Next available filing run (${st.name} system is open now)` : open === false ? `Next window: ${st.hoursText} — opens ${stateNow(st, nextOpen(st))}` : `Next available filing run (${st.name} hours not published — see official site)`;
    f.nextStep = `Stops at the ${st.name} login page (${st.loginUrl}). Secure state login is not built yet, so nothing is submitted to the state in this build.`;
    await save(data); return json(res, 200, { filing: f });
  }

  if (p.startsWith("/api/filings/") && p.endsWith("/decline") && req.method === "POST") {
    const id = p.split("/")[3]; const data = await db(); const f = data.filings.find((x) => x.id === id);
    if (!f) return json(res, 404, { error: "Filing not found." });
    f.status = "declined"; await save(data); return json(res, 200, { filing: f });
  }

  if (p === "/api/dashboard" && req.method === "GET") {
    const email = (url.searchParams.get("email") || "").toLowerCase(); const data = await db();
    const user = data.users.find((u) => u.email.toLowerCase() === email);
    if (!user) return json(res, 404, { error: "No UI Help account for that email yet. Start with step 1." });
    return json(res, 200, { user: publicUser(user), filings: data.filings.filter((f) => f.userId === user.id).reverse(), messages: data.messages.filter((m) => m.userId === user.id).reverse() });
  }

  // Static files
  const file = p === "/" ? "index.html" : p.slice(1);
  const safe = normalize(file).replace(/^(\.\.[/\\])+/, "");
  const full = join(PUBLIC, safe);
  if (!full.startsWith(PUBLIC) || !existsSync(full)) { res.writeHead(404); return res.end("Not found"); }
  const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };
  res.writeHead(200, { "content-type": types[extname(full)] || "application/octet-stream" });
  createReadStream(full).pipe(res);
});

server.listen(PORT, () => console.log(`UI Help running at http://localhost:${PORT}`));
