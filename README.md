# UI Help (pre-login build) — all 50 states + DC/PR/VI

File on your time. We submit in theirs.

State unemployment sites keep their own hours — Minnesota's applicant system ([login](https://www1.ui.mn.gov/ui_applicant/ui/applicant/login)), for one, is open Sunday–Friday, 6:00 a.m.–8:00 p.m. Central and closed Saturdays and nights. UI Help collects everything 24/7, asks the filer to approve the exact filing by email/text, and queues it for the next open window in their state.

Coverage: all 50 states, plus the District of Columbia, Puerto Rico, and the U.S. Virgin Islands. Every login/info URL, agency, and timezone came from an official source — see [STATES.md](STATES.md) for the full table, per-state verification, and notes. Hours are encoded only where a state publishes them; this project never guesses hours.

## What this build does (everything before state login)

1. **Sign up for UI Help** — name, email, phone, your state, approval channel (email/text/both), and a UI Help password. This is *not* a state account. We never ask for an SSN or a state password.
2. **Weekly check-in, 24/7** — week ending, work/earnings, able & available, refusals, job contacts.
3. **Approve before anything files** — the app drafts the exact approval message (simulated email/text in this build; no real message is sent) and the filer must choose “Yes, file it like this.” Declining files nothing.
4. **Queue + pre-login check** — approved filings show the next open window for the filer's state (or “hours not published” where the state does not publish them). The runner checks the real login page and **stops at login**. Nothing is submitted to any state.

## Run it

```bash
npm start
# open http://localhost:4173
```

Check any state's login page from the command line (Playwright when installed, page-fetch fallback otherwise):

```bash
npm run check -- CA
npm run check:mn
# real browser: npm i -D playwright && npx playwright install chromium
```

Regenerate the state data after editing the research table:

```bash
npm run states
```

## API

- `GET /api/states` — all states/districts/territories with agency, URLs, timezone, hours
- `GET /api/states/:code/status` — open/closed for that state right now (`open` is `null` when hours are not published)
- `POST /api/states/:code/prelogin-check` — fetches that state's login page and stops at login
- `POST /api/signup` · `POST /api/filings` · `POST /api/filings/:id/approve|decline` · `GET /api/dashboard?email=`
- `/api/mn/*` aliases remain for backward compatibility

## Layout

- [server.mjs](server.mjs) — zero-dependency Node server + API, JSON storage in `data/db.json`
- [data/states.json](data/states.json) — 50 states + DC/PR/VI (source of truth at runtime)
- [scripts/generate-states.mjs](scripts/generate-states.mjs) — generates `data/states.json` and `STATES.md` from the verified research rows
- [src/states.mjs](src/states.mjs) — registry loader and timezone-correct open/closed logic
- [public/](public/) — mobile-first UI with a state picker
- [worker/prelogin-check.mjs](worker/prelogin-check.mjs) — Playwright pre-login checker for any state; never enters credentials

## Not built yet (on purpose)

- Secure state login / credential vault — never collect SSNs or state passwords in chat, logs, or this UI. Many states also require ID.me / Login.gov, which must be handed off to, never bypassed
- Real email/SMS delivery (needs a provider account)
- Post-login filing flows — each state needs its own consented, supervised mapping session with redacted screens
- Submitting anything to any state
