# med.stamih.com — "Alongside" Medication & Activity Tracker
## System Design (for review & approval — no code yet)

**Version:** draft 1 · 2026-08-21
**Author:** Steve (for Mihai's review)
**Status:** awaiting sign-off on the open decisions in §14 before any code is written.

---

## 1. What we're building (and for whom)

A shared, multi-patient medication + daily-activity tracker aimed at elderly users and the family members who look after them. One person (a caretaker/relative) can manage several **profiles** (e.g. grandma, grandpa); each profile has a daily schedule of pills and activities; anyone the profile is **shared with** sees the same live list and can log "taken / not taken / done". The headline feature is **reminders that reach a phone messaging app**, ideally lettting the person reply "took it / didn't" straight from the chat.

The design handoff (`design_handoff_medication_tracker/`) is high-fidelity and final for UI: 4 tabs (Today, History, Manage, Settings) + Login, three modal dialogs, bilingual Romanian (default) / English, large-type and high-contrast, rendered in a 480px phone-shaped column. The handoff's own README lists the "production gaps" (auth, backend/sync, notifications, photo storage, timezones, audit trail) — this document is how we close them.

**Guiding priorities (yours):** usability first; strong per-user data isolation; frequent iteration (so testability matters); prefer $0 solutions; minimal setup burden on end-users.

---

## 2. Recommended architecture at a glance

```
                 ┌─────────────────────────────────────────────┐
   Family phone  │  med.stamih.com  (PWA, installable)          │
   / desktop  ───┤  vanilla-JS SPA  +  organic-styles.css       │
                 │  (ported from the handoff logic)             │
                 └───────────────┬─────────────────────────────┘
                                 │  HTTPS JSON  (session cookie)
                                 ▼
                 ┌─────────────────────────────────────────────┐
   Shared cPanel │  PHP 8 API  (api/*.php)                      │
   host (already │   • auth: Google OAuth + local user/pass     │
   paid for)     │   • authorization on EVERY request           │
                 │   • profiles / items / logs / notes / media  │
                 │   • cron/dispatch.php  (reminder engine)      │
                 │   • webhook/telegram.php (two-way replies)    │
                 └───────────────┬───────────────┬─────────────┘
                                 │               │
                          MySQL  │               │  Bot API (free)
                          (source │               ▼
                          of truth)        ┌──────────────┐
                                 │         │  Telegram    │◀── patient / relative
                                 ▼         │  (+ optional │    taps "Took it ✓"
                          ┌──────────┐     │   WhatsApp)  │
                          │ media/   │     └──────────────┘
                          │ (photos) │            ▲
                          └──────────┘            │
   Free minute-pinger (cron-job.org) ── hits ─────┘ every minute →
   cron/dispatch.php sends due reminders + end-of-day summary
```

**In one sentence:** the same PHP/MySQL + vanilla-JS + Google-OAuth stack we already run for `dash.stamih.com` and `cal.stamih.com`, plus a Telegram bot for free two-way reminders, deployed from a GitHub repo through Actions (tests → FTP).

---

## 3. Tech stack — options & decision

| Option | Pros | Cons | Verdict |
| --- | --- | --- | --- |
| **A. PHP 8 + MySQL + vanilla-JS SPA** (same as dash/cal) | $0 (host already paid); we've built this exact auth/OAuth/sync pattern twice here; handoff logic is already vanilla JS → direct port; no build step; FTPS/Actions deploy already solved | PHP is old-fashioned; manual SQL; no framework guardrails (we add our own) | **CHOSEN** |
| B. Node/Express + Postgres | Nicer DX, one language front+back | Host is shared cPanel — no long-running Node process / no Postgres without a new paid host; new infra to learn & pay for | Rejected (cost + host mismatch) |
| C. Static SPA + BaaS (Supabase / Firebase) | Managed auth, realtime, row-level security out of the box | New vendor + free-tier limits & lock-in; Telegram/WhatsApp webhooks still need a server function; another account to manage; data leaves our host | Rejected (adds a dependency; our host already does the job for free) |

**Why A wins:** it reuses everything we've already proven on this host and turns the handoff's framework-agnostic JS into production with the least new surface area — which also means the fastest, cheapest path to the working end-to-end version you want.

**Front-end specifics:** keep it a single-file-ish vanilla SPA (like dash) — `index.html` + `app.js` + the handoff's `organic-styles.css` (drop-in, it's the token source of truth) + a small `i18n.js` carrying the handoff's `STR` object (RO/EN copy is already written — we reuse it verbatim). Ship it as a **PWA** (manifest + service worker) so families can "Add to Home Screen" and get an app icon + offline shell + (where supported) web-push. The handoff's `isScheduledOn()`, grouping, adherence and rendering logic port almost as-is; we swap its `localStorage` load/save for API calls.

---

## 4. Hosting & deployment — FTP-only vs GitHub

You asked specifically whether to keep deploying by FTP or set up a repo.

| | FTP-only (like digest/learn) | **GitHub repo + Actions → FTP (like dash/cal)** |
| --- | --- | --- |
| Version history / rollback | none (overwrite in place) | full git history, instant revert |
| Runs the test suite before deploy | no | **yes — CI gate; only green builds ship** |
| Secrets (DB pass, bot token, OAuth secret) | live only on server | kept out of git (`config.php` gitignored) + Actions secrets for FTP |
| Fit with "frequent changes + heavy testing" | poor | **excellent** |
| Setup cost | zero | ~30 min one-time (repo + workflow) |

**Recommendation: GitHub repo + GitHub Actions.** Because you explicitly expect frequent polishing and want unit/integration/functional tests, CI that runs those tests and only deploys on green is worth the small setup. This mirrors what already works for `dash.stamih.com`. `config.php` (DB creds, Google secret, Telegram token) stays gitignored and server-side; FTP creds live in Actions secrets, never in the repo. (If you'd rather avoid GitHub entirely, direct FTPS still works — we'd just run tests locally before each push and lose the CI safety net.)

---

## 5. Accounts, auth & the sharing model (the core of security)

The handoff fakes "one shared family login". Your requirement is richer: **multiple independent accounts, each of which can own several profiles and share any profile with other accounts**, with edits syncing to everyone. That's a many-to-many between *accounts* and *profiles*.

**Auth methods (both required):**
- **Google Sign-In** — the same OAuth + signed-cookie pattern as dash/cal (HMAC-signed `med_auth` cookie, no server session store needed).
- **Local username + password** — for the family members you onboard by hand. Passwords hashed with `password_hash()` (bcrypt). You create these accounts from an admin path; **self-serve non-Google signup stays off** (as you said), so there's no open registration to abuse.

**The model:**
- An **account** (`users`) is a login (Google or local).
- A **profile** (`profiles`) is a patient (grandma). It has its own schedule, history, notes, linked messaging channels, and timezone.
- **Membership** (`profile_members`) links accounts ↔ profiles with a role (`owner` / `editor`). Owner can share/unshare and delete the profile; editors can view and log everything. Sharing = inserting a membership row for another account (by email). This is exactly the mechanism we shipped for dash's shared widgets, generalised.

Because the *profile* (not a "family") is the unit of sharing, the same profile can be shared with the patient's own account, a relative's account and a caretaker's account — and any of them logging "taken" updates it for all, which is the behaviour you asked for.

---

## 6. Data model (MySQL)

```
users            id, email(unique), name, avatar, google_sub(null), pass_hash(null),
                 is_admin, created_at
profiles         id, name, relation, tint, avatar_url, timezone, created_by, created_at
profile_members  id, profile_id→profiles, user_id→users, role(owner|editor), created_at
                 UNIQUE(profile_id,user_id)
items            id, profile_id, type(pill|activity), name, count, grp(morning|noon|
                 evening|bedtime), time_min, purpose, note, photo_url,
                 freq(daily|weekly|monthly), days(json[0-6]), dom(1-31),
                 end_mode(never|date|count), end_date, end_count, start_date,
                 active, created_by, created_at, updated_at
logs             id, profile_id, item_id, date(YYYY-MM-DD), status(taken|skipped),
                 taken_min(null), at_epoch, actor_user_id, note   -- note = e.g. BP reading
                 UNIQUE(profile_id,item_id,date)
day_notes        id, profile_id, date, note, actor_user_id, updated_at
                 UNIQUE(profile_id,date)
channels         id, profile_id, kind(telegram|whatsapp|webpush), address(chat_id/phone/
                 subscription), label, verified, created_at   -- max 3 per profile enforced
notif_log        id, profile_id, item_id, date, channel_id, kind(due|overdue|summary),
                 sent_at, provider_msg_id, response(taken|skipped|null)  -- idempotency + audit
```

Notes on how this satisfies the spec + your adds:
- **Per-activity note** (blood-pressure values) → `logs.note`. **Per-day note** ("pain decreased today") → `day_notes`. **Audit trail** → `logs.actor_user_id` + `at_epoch` (closes the handoff's "no actor" gap).
- **Recurrence & end conditions** map 1:1 to the handoff's `Item` fields; the server owns `isScheduledOn()` so History/stats/reminders all agree.
- **Images** → uploaded to `media/` with unguessable names, served through an access-checked endpoint (never a guessable public path); DB stores the URL. (Data-URLs from the prototype are replaced.)
- **Up-to-3 linked channels per profile** → `channels`, enforced in code.

---

## 7. Data isolation — how we guarantee no one sees another user's meds

This is the security requirement, so it's a first-class rule, not an afterthought:

1. **Every** API request resolves the caller from the signed cookie, then authorizes the target **profile** via a single choke-point helper `requireProfile($profile_id, $minRole)` that checks a `profile_members` row exists for `(profile_id, user_id)`. No endpoint reads or writes profile data without passing through it. (Same shape as dash's `access()` check, which we already hardened after the Home-Base privacy incident — that lesson is baked in.)
2. **The client is never trusted** for "which profiles are mine". The server derives the profile list from memberships; the client can't request a `profile_id` it isn't a member of (403).
3. **Photos** are delivered by `media.php?id=…` which runs the same membership check before streaming the file; the `media/` dir is not directly browsable.
4. **Secrets** (`config.php`) are gitignored and server-only; FTP creds live in Actions secrets. Nothing sensitive in the repo or client.
5. **Standard hardening:** bcrypt passwords; HTTPS-only, `HttpOnly`, `SameSite` cookies; per-request CSRF token on state-changing calls; prepared statements everywhere (no string-built SQL); rate-limit login + webhook endpoints; validate/normalise all uploads (type + size + re-encode images to strip metadata).
6. **Medical-data note:** this is health information. We're not claiming HIPAA/GDPR-clinical compliance for a family tool, but we minimise exposure (no third-party analytics, data stays on our host, export is user-initiated) and we'll add a short privacy note. If you ever want formal compliance that's a bigger conversation — flagging it now.

---

## 8. Sync (shared, concurrent editing)

The host is shared PHP — no WebSockets. We use the pattern already proven on dash:
- **Optimistic local writes** (tap "Taken" → UI updates instantly) + **POST to server** as source of truth.
- **Short polling** of a `changes?since=<ts>` endpoint (~every 20–30 s while the Today/History tab is open, paused when the tab is hidden) so a log entered from grandma's phone appears on the relative's phone within half a minute.
- **Conflict rule:** per `(profile,item,date)` log is **last-write-wins**, but every write records `actor_user_id` + timestamp, so History can always show who set what. Concurrent edits on the same dose are rare in this domain (a handful of family members), so LWW is sufficient and simple.

---

## 9. Notifications & two-way messaging (the headline feature)

You said WhatsApp ideally, Telegram or another acceptable, and strongly prefer letting people reply *from the chat*. Here's the honest tradeoff after checking current (2026) terms.

| Channel | Cost | Setup burden | Two-way reply from chat | Reliability for elderly |
| --- | --- | --- | --- | --- |
| **Telegram Bot API** | **Free, unlimited** | **Tiny** — one BotFather token; user taps a deep link + "Start" once to link | **Excellent** — inline buttons "Took ✓ / Didn't ✗ / Snooze" → webhook, no typing | Great *if* they have Telegram |
| **WhatsApp Cloud API** | **Not free going forward** — no fixed free tier; from **Oct 1 2026** even the service window is billable; scheduled reminders are business-initiated **utility templates** billed per 24-h conversation | **Heavy** — Meta Business verification, a **dedicated phone number** (can't be your normal WhatsApp), **pre-approved message templates** | Yes — up to 3 reply buttons → webhook | Highest household penetration |
| SMS | Per-message paid (Twilio etc.) | Medium | Reply parsing only (no buttons) | Universal but paid |
| Web Push (PWA) | Free | User taps "Allow" once | **No** (one-way; can deep-link back to app) | Best-effort; weak on iOS |
| Email | Free-ish | Low | No (link back only) | Poor as a timely nudge |

**Recommendation — Telegram-first, WhatsApp as an optional Phase-2 add-on:**
- Ship **Telegram** as the default reminder channel: it's free, unlimited, instant to set up, and does exactly the "reply from the chat" flow you want (tap a button, done — ideal for elderly users; no app to open, no typing). Linking is one tap on a `t.me/AlongsideBot?start=<token>` deep link then "Start".
- Add **Web Push** as a free supplement for anyone who installs the PWA (in-app style banner reminders), so even non-Telegram users get *something* at no cost.
- Keep **WhatsApp Cloud API** as a **clearly-scoped optional add-on**: the code path and webhook are the same shape as Telegram, so we can add it later for family members who simply won't use Telegram. The catch to accept up-front: it needs Meta business verification + a dedicated number + approved utility templates, and it's a **paid** channel per conversation (though for a handful of daily reminders to a few family members the real cost is only a few cents/day, and utility templates in RO/EU are cheap). I'd wire it in Phase 2 once the core app is solid, rather than block the launch on Meta's approval process.

Because each profile allows **up to 3 linked channels**, a single profile can notify the patient *and* a relative *and* a caretaker — and they can be a mix (e.g. patient on WhatsApp, relative on Telegram) once WhatsApp is enabled.

**Reminder engine (scheduling):**
- A token-protected `cron/dispatch.php` runs every minute, computes which items are **due now** (per each profile's timezone), and sends a reminder to that profile's linked channels — writing a row to `notif_log` so it never double-sends (idempotent per `profile|item|date|kind`).
- **Overdue nudge:** if a due item is still un-logged after a configurable grace (e.g. 30–45 min), send one follow-up.
- **End-of-day summary:** at a per-profile evening time, send "Today for Ruth: 4 of 5 taken · 1 missed (evening blood-pressure)".
- **What triggers the minute-tick, for free:** primary = **cron-job.org** (free external pinger hitting the token URL every minute); alternative = the host's cPanel cron if available (to verify); and as a belt-and-braces fallback we can also point one of your existing always-on scheduled tasks at it. Minute-granularity matters, so we won't rely on 5-minute-only schedulers for the tick.

**Two-way flow (Telegram):** the reminder message carries inline buttons whose callback data encodes `profile|item|date|action`. `webhook/telegram.php` verifies the update, maps the `chat_id` → linked channel → profile (and checks that channel is allowed to log for that profile), writes the log with `actor` = "via Telegram", and edits the message to "✓ Recorded: taken at 08:12". No website visit needed — exactly your ask.

---

## 10. Feature → implementation map

| Spec / your requirement | How it's built |
| --- | --- |
| Today tab: grouped doses, one-tap taken/not-taken, progress ring, reminder banner, per-item state machine | Port handoff render logic; state from `logs` via API; optimistic writes |
| History: weekly grid, cell-cycling correction, 30-day full-history dialog, adherence stats, "Worth a look" | Port logic; server computes adherence; cell edit = `logs` upsert with actor |
| Manage: add/edit/remove items (recurrence + end), manage members, share profile | `items` CRUD; `profile_members` for sharing (invite by email) |
| Settings: language RO/EN, text size, show-photos, **export history**, sign out | prefs per-user; **export** = server-rendered printable HTML + CSV per profile & date range, "for your doctor" formatting |
| Multiple profiles per account; share across accounts; live cross-account sync | §5–§8 |
| Add pills/activities recurring forever or limited | `end_mode` never/date/count (already in model) |
| Image upload per med/activity | `media.php` upload + access-checked serve |
| Per-activity note (BP values) + per-day note | `logs.note` + `day_notes` |
| Reminders to phone + reply from chat + end-of-day summary | §9 |
| Link up to 3 phone/messaging accounts per profile | `channels` (max 3, verified) |
| Bilingual, elderly-optimized, mobile-first + desktop | reuse `STR` + `organic-styles.css`; PWA; 480px column centered on desktop |
| Timezones / DST (handoff gap) | per-profile `timezone`; all "due" math in that tz |

---

## 11. Testing plan (unit · integration · functional)

Because you expect frequent changes, tests are part of the deliverable and run in CI before every deploy.

- **Unit (fast, no DB).**
  - *PHP (PHPUnit):* recurrence resolution (`isScheduledOn` across daily/weekly/monthly + all three end modes), adherence math, timezone/"due-now" bucketing, authorization helper (member vs non-member vs wrong-role), channel-cap (max 3), reminder idempotency key.
  - *JS (Vitest):* client `isScheduledOn` parity with PHP (same fixtures both sides so they can't drift), i18n interpolation (`{name}`/`{n}`/`{time}`), date/time formatting per locale (EN 12-h vs RO 24-h), text-size scaling.
- **Integration (API + test DB).** Spin a MySQL service in Actions; hit real endpoints: login (Google-stub + local), create profile, share to a 2nd account, that account can read/write, a **3rd unrelated account gets 403** (the isolation guarantee, tested explicitly), log upsert + history correction with actor, export output shape, media upload + access-checked fetch (owner 200 / stranger 403), webhook records a log from a button press and is idempotent.
- **Functional / E2E (Playwright — already installed on the machine).** Real browser, desktop + mobile viewport, RO + EN: sign in → Today → mark taken/not-taken → see ring update; History cell-cycle + save; Manage add a weekly item with an end date → appears on the right days only; Settings text-size + language switch; **two-account sync** (log on account A, see it on account B within the poll window); reminder banner states. Plus the **Impeccable** craft pass (`detect.mjs` must return `[]`) per our standing app-work protocol, and screenshots reviewed at both sizes/locales.
- **CI gate.** GitHub Actions: on push → run PHPUnit + Vitest + Playwright headless → **only on all-green** does the FTP-deploy job run. A smoke check curls the live site + a health endpoint after deploy.

---

## 12. Build phases (so you get a working thing fast, then we polish)

1. **Foundations** — repo + Actions + DB schema + `config.php`; Google + local auth; the `requireProfile` authorization choke-point; organic-styles + PWA shell.
2. **Core app (end-to-end usable)** — profiles + membership/sharing; items CRUD; Today + History + Manage + Settings ported from the handoff; logs with actor; notes (per-item + per-day); image upload; export. Server sync + polling. *This is the "end-to-end working version" you asked for.*
3. **Reminders** — `channels` + Telegram linking; `cron/dispatch.php` (due + overdue + summary); `webhook/telegram.php` two-way; Web-Push supplement.
4. **Polish & feedback loop** — accessibility/large-type QA with real users, tune copy, tune reminder timing, then (optional) **WhatsApp** channel.

---

## 13. Cost summary

| Piece | Cost |
| --- | --- |
| Hosting (PHP/MySQL on the existing cPanel) | $0 (already paid) |
| Telegram reminders (two-way) | $0, unlimited |
| Minute-tick (cron-job.org) | $0 |
| GitHub repo + Actions CI | $0 (public-tier minutes are ample) |
| Web Push | $0 |
| **WhatsApp (optional, Phase 4)** | small per-conversation fee + Meta setup; opt-in only |
| **Total to launch** | **$0** |

---

## 14. Decisions — LOCKED 2026-08-21

1. **Notification strategy** — ✅ **Telegram-first + Web-Push at launch; WhatsApp deferred to optional Phase-4 add-on.**
2. **Deployment** — ✅ **GitHub repo + GitHub Actions CI** (tests gate the FTP deploy).
3. **Account model** — ✅ **Many-to-many: accounts own several profiles and share any profile by email (owner/editor); all members' input syncs.** (§5.)
4. **Desktop form factor** — *default (not blocking):* ship the faithful centered 480px column first; revisit a widened desktop layout after launch if wanted.
5. **Admin onboarding** — *default (not blocking):* a simple protected admin page (create local user, set temp password, share a profile) for you to run. Say the word if you'd prefer another mechanism.

**Next:** Phase 1 (foundations) on your go-ahead — repo + Actions + DB schema + `config.php`, Google + local auth, the `requireProfile` authorization choke-point, organic-styles + PWA shell.
