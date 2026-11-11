const $ = (s) => document.querySelector(s);
let currentUser = null;
let selectedState = "MN";
let allStates = [];

function saveSession() {
  try { localStorage.setItem("uihelp-session", JSON.stringify(currentUser)); }
  catch { $("#storageWarn").classList.remove("hidden"); }
}
function loadSession() {
  try { const raw = localStorage.getItem("uihelp-session"); if (raw) currentUser = JSON.parse(raw); }
  catch { $("#storageWarn").classList.remove("hidden"); }
}
async function api(path, opts = {}) {
  const r = await fetch(path, { headers: { "content-type": "application/json" }, ...opts });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
  return data;
}
function setMsg(el, text, ok = true) { el.textContent = text; el.className = "msg " + (ok ? "ok" : "err"); }
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function refreshStatus() {
  try {
    const s = await api(`/api/states/${selectedState}/status`);
    const el = $("#mnStatus");
    if (s.open === true) el.textContent = `${s.stateName} is OPEN now · ${s.hoursText} · UI Help is open 24/7`;
    else if (s.open === false) el.textContent = `${s.stateName} is CLOSED · Opens ${s.nextOpen || "next window"} · UI Help is open 24/7`;
    else el.textContent = `${s.stateName} hours not published — check the official site · UI Help is open 24/7`;
    el.classList.toggle("closed", s.open === false);
    const meta = allStates.find((x) => x.code === selectedState);
    if (meta) $("#stateMeta").innerHTML = `${esc(meta.agency)} · <a href="${esc(meta.infoUrl)}" target="_blank" rel="noopener">Official info</a> · <a href="${esc(meta.loginUrl)}" target="_blank" rel="noopener">Official login</a>${meta.loginVia ? ` · Login via ${esc(meta.loginVia)}` : ""}`;
  } catch { $("#mnStatus").textContent = "State hours unavailable — UI Help is still open 24/7"; }
}

function renderDashboard(data) {
  currentUser = data.user; saveSession();
  if (data.user?.state) { selectedState = data.user.state; const sel = $("#stateSelect"); if (sel) sel.value = selectedState; const su = $("#signupState"); if (su) su.value = selectedState; refreshStatus(); }
  $("#inbox").innerHTML = data.messages.length
    ? data.messages.map((m) => `<div class="message"><strong>Simulated ${esc(m.via)} — not actually sent yet</strong>\n\n${esc(m.body)}</div>`).join("")
    : `<p class="empty">No approval requests yet.</p>`;
  $("#filings").innerHTML = data.filings.map((f) => `
    <article class="filing">
      <div class="filing-head"><span>Week ending ${esc(f.weekEnd)}</span><span class="badge ${esc(f.status)}">${esc(f.status.replaceAll("_", " "))}</span></div>
      <p>State: ${esc(f.state || "")} · Worked: ${f.worked ? "Yes" : "No"} · Earnings $${esc(f.earnings)} · Able &amp; available: ${f.ableAvailable ? "Yes" : "No"} · Job contacts: ${esc(f.jobContacts)}</p>
      ${f.scheduledFor ? `<p><strong>${esc(f.scheduledFor)}</strong></p><p class="small">${esc(f.nextStep)}</p>` : ""}
      ${f.status === "awaiting_approval" ? `<div class="actions"><button data-approve="${f.id}">Yes, file it like this</button><button class="secondary" data-decline="${f.id}">No, don’t file</button></div>` : ""}
    </article>`).join("") || `<p class="empty">No filings yet.</p>`;
  document.querySelectorAll("[data-approve]").forEach((b) => b.onclick = () => decide(b.dataset.approve, "approve"));
  document.querySelectorAll("[data-decline]").forEach((b) => b.onclick = () => decide(b.dataset.decline, "decline"));
}

async function loadDashboard(email) {
  renderDashboard(await api(`/api/dashboard?email=${encodeURIComponent(email)}`));
}
async function decide(id, action) {
  const f = await api(`/api/filings/${id}/${action}`, { method: "POST" });
  alert(action === "approve" ? `Queued. ${f.filing.scheduledFor}` : "Declined. Nothing will be filed.");
  if (currentUser) await loadDashboard(currentUser.email);
}

$("#signupForm").addEventListener("submit", async (e) => {
  e.preventDefault(); const fd = new FormData(e.target); const msg = $("#signupMsg");
  try {
    const { user } = await api("/api/signup", { method: "POST", body: JSON.stringify({ name: fd.get("name"), email: fd.get("email"), phone: fd.get("phone"), password: fd.get("password"), state: fd.get("state"), contactPref: fd.get("contactPref"), consentEmail: fd.get("consentEmail") === "on", consentText: fd.get("consentText") === "on" }) });
    currentUser = user; saveSession(); selectedState = user.state; $("#stateSelect").value = selectedState; refreshStatus(); setMsg(msg, `Account created for ${user.email} (${user.state}). Now do your weekly check-in in step 2.`);
  } catch (err) { setMsg(msg, err.message, false); }
});

$("#lookupForm").addEventListener("submit", async (e) => {
  e.preventDefault(); try { await loadDashboard(new FormData(e.target).get("email")); } catch (err) { alert(err.message); }
});

$("#weeklyForm").addEventListener("submit", async (e) => {
  e.preventDefault(); const fd = new FormData(e.target); const msg = $("#weeklyMsg");
  if (!currentUser) return setMsg(msg, "Create your account in step 1 first.", false);
  try {
    await api("/api/filings", { method: "POST", body: JSON.stringify({ userId: currentUser.id, weekEnd: fd.get("weekEnd"), worked: fd.get("worked") === "yes", earnings: fd.get("earnings"), employer: fd.get("employer"), ableAvailable: fd.get("ableAvailable") === "yes", refusedWork: fd.get("refusedWork") === "yes", jobContacts: fd.get("jobContacts"), notes: fd.get("notes") }) });
    setMsg(msg, "Saved. Your approval request is in step 3 — review it before anything is queued.");
    await loadDashboard(currentUser.email);
    document.querySelector("#step3").scrollIntoView({ behavior: "smooth" });
  } catch (err) { setMsg(msg, err.message, false); }
});

$("#checkBtn").addEventListener("click", async () => {
  const out = $("#checkOut"); const name = (allStates.find((x) => x.code === selectedState) || {}).name || selectedState;
  out.textContent = `Checking the real ${name} login page (stopping at login)…`;
  try { const r = await api(`/api/states/${selectedState}/prelogin-check`, { method: "POST" }); out.textContent = JSON.stringify(r, null, 2); }
  catch (err) { out.textContent = err.message; }
});

(async () => {
  loadSession();
  if (currentUser?.state) selectedState = currentUser.state;
  try {
    const { states } = await api("/api/states");
    allStates = states;
    const opts = states.map((s) => `<option value="${esc(s.code)}">${esc(s.name)}${s.type !== "state" ? " (" + esc(s.type) + ")" : ""}</option>`).join("");
    $("#stateSelect").innerHTML = opts; $("#signupState").innerHTML = opts;
    $("#stateSelect").value = selectedState; $("#signupState").value = selectedState;
    $("#stateSelect").addEventListener("change", (e) => { selectedState = e.target.value; $("#signupState").value = selectedState; refreshStatus(); });
    $("#signupState").addEventListener("change", (e) => { selectedState = e.target.value; $("#stateSelect").value = selectedState; refreshStatus(); });
    $("#stateList").innerHTML = states.map((s) => `<div class="state-row"><span><a href="${esc(s.infoUrl)}" target="_blank" rel="noopener">${esc(s.name)}</a> — ${esc(s.agency)}</span><span class="badge">Live · ${esc(s.hoursText)}</span></div>`).join("");
  } catch {}
  await refreshStatus(); setInterval(refreshStatus, 60000);
  if (currentUser?.email) loadDashboard(currentUser.email).catch(() => {});
})();
