# Alongside — a gentle medication & activity tracker for families

**Alongside** helps families keep track of an older relative's daily medicines and
activities — together. You add each pill or task with its time, everyone you share
the profile with sees the same list, ticks things off, and can get friendly reminders
on Telegram. Notes, photos and a shareable history make it easy to stay on top of
things as a family.

Live: **[med.stamih.com](https://med.stamih.com)** · Romanian (default) and English.

> Built for real use: large, calm, mobile-first UI for the person taking the meds, and
> a shared multi-caretaker view for the family looking after them.

---

## What you can use it for

- **Never miss a dose.** Each medicine or activity has a time; Today shows what's due,
  what's done, and what's overdue, grouped by part of the day (morning / midday /
  evening / bedtime).
- **Look after more than one person.** Keep separate profiles (e.g. grandma and
  grandpa), each with its own list.
- **Do it as a family.** Share a profile by email so several accounts — say a daughter
  and her father — see and update the same list live. Everyone can link their own
  Telegram to be reminded.
- **Two-way Telegram reminders.** Reminders arrive as a chat message with buttons —
  *Taken · Not taken · Snooze* — so the patient can log a dose straight from Telegram.
  An end-of-day summary wraps up how the day went.
- **Record the details that matter.** Add a note to any logged item (e.g. a blood
  pressure reading like `120/80`), a note for the whole day, and a photo of the pill or
  its box so it's easy to recognise.
- **Fix mistakes and see the history.** A weekly adherence grid lets you correct any day;
  the full history is a tap away and exports to a spreadsheet (CSV) for the doctor.
- **Flexible schedules.** Daily, weekly (chosen weekdays) or monthly; end never, on a
  date, or after N times. Doses can be whole numbers or **½ / ¼**.

---

## Features at a glance

| Area | What's included |
| --- | --- |
| **Today** | Day-part sections, progress ring, due/overdue reminder banner, one-tap *taken / not taken*, edit-time, per-item notes, per-day note |
| **History** | Weekly adherence % + grid, tap-to-correct any day, 30-day full history, "worth a look" misses, CSV export per person |
| **Manage** | Add/edit items (type, dose, time, repeat, end rule, purpose, note, photo), family members, per-profile Telegram links, "notify now" |
| **Reminders** | Telegram bot with inline *Taken / Not taken / Snooze*, overdue nudge, daily summary, up to 3 linked chats per profile |
| **Sharing** | Many-to-many: an account owns profiles and shares them (owner / editor) with other accounts by email; live-ish sync |
| **Accessibility** | Large text options, high-contrast calm palette, big touch targets, mobile-first with a comfortable desktop column |
| **Languages** | Romanian (default) + English, including correct Romanian name grammar (e.g. *Ziua Marianei*) |
| **Photos** | Upload a pill/box photo; tap to open full-screen; images are access-checked and EXIF/GPS is stripped on upload |

---

## Tech stack

- **Frontend:** vanilla JavaScript single-page app + PWA (installable, offline shell).
  No build step — plain `index.html` + `app.js` + `logic.js` + `i18n.js` + CSS.
- **Backend:** PHP 8 + MySQL/MariaDB on shared cPanel hosting.
- **Auth:** Google OAuth (HMAC-signed cookie) **and** local email/password (bcrypt).
  No open sign-up — accounts are created by an admin.
- **Reminders:** Telegram Bot API (webhook for two-way buttons) + a one-minute cron
  dispatcher.
- **CI/CD:** GitHub Actions lints PHP and deploys over FTPS on every push to `main`.

The design system ("Organic") is a warm, rounded, cream-and-terracotta theme tuned for
older users on phones.

---

## How it works

```
Browser (PWA)  ──►  PHP API (api/*.php)  ──►  MySQL
      ▲                     │
      │                     ├─ media.php     access-checked photo serving
      │                     ├─ webhook/…      Telegram → log taken/skipped
      └───────── Telegram ◄─┴─ cron/dispatch  due / overdue / daily summary
```

Every request that touches a profile passes through a single `require_profile()`
authorisation check, so a client can never read or write a profile it isn't a member
of. Photos live outside the web root and are streamed only through `media.php` after
that same check.

See **[SYSTEM-DESIGN.md](SYSTEM-DESIGN.md)** for the full architecture and data model,
and **[SETUP-CHECKLIST.md](SETUP-CHECKLIST.md)** for the step-by-step first-time setup.

---

## Self-hosting

You'll need PHP 8 + MySQL hosting (cPanel works well), a Google OAuth client, and a
Telegram bot.

1. **Clone & configure.** Copy `config.php.example` to `config.php` and fill in DB
   credentials, `AUTH_SECRET`, `INSTALL_KEY`, `CRON_KEY`, `ADMIN_EMAILS`, the Google
   client ID/secret + redirect URI, and `TELEGRAM_BOT_TOKEN` / `TELEGRAM_BOT_USER`.
   `config.php` is git-ignored — upload it to the server separately, never commit it.
2. **Create the schema.** Visit `https://your-domain/install.php?key=<INSTALL_KEY>`
   once. It's idempotent and also seeds the admin accounts from `ADMIN_EMAILS`.
3. **Sign in** with a Google admin account, then create family logins and profiles from
   the admin page.
4. **Set the Telegram webhook** to `https://your-domain/webhook/telegram.php`.
5. **Add a cron job** (every minute) that calls
   `curl -s "https://your-domain/cron/dispatch.php?key=<CRON_KEY>"`.

### Deploying updates

Push to `main`. GitHub Actions (`.github/workflows/deploy.yml`) runs `php -l` on every
PHP file, then deploys over FTPS. `config.php`, uploaded `media/**`, and docs are
excluded so they're never overwritten or deleted. FTP credentials live in repo secrets.

---

## Project structure

```
index.html            PWA shell + asset versions
app.js                SPA (Today / History / Manage / Settings, dialogs, sync)
logic.js              window.MED — schedule logic, icons, day-part + time helpers
i18n.js               full RO/EN strings
styles.css / app.css  Organic design system + app styles
db.php                PDO, cookie auth, CSRF, require_profile() choke-point
auth/                 Google OAuth + local login/callback/me/logout
api/                  profiles, items, logs, channels, notify, export
media.php             access-checked photo upload (GD resize, EXIF strip) + serving
tg.php / remind.php   Telegram helpers + shared reminder builder
sched.php             server-side schedule check (mirrors the client)
webhook/telegram.php  /start linking + inline-button logging
cron/dispatch.php     minute-by-minute reminder engine
install.php           idempotent schema loader + admin seeding
schema.sql            tables + idempotent migrations
admin/                create local users, profiles, sharing
```

---

## Privacy & security

- Per-profile data isolation enforced server-side on every request.
- Photos are stored outside the web root, served only through an access check, and have
  EXIF/GPS metadata stripped on upload.
- Secrets (`config.php`, FTP env, Google client secret) are git-ignored and never shipped
  in the client.
- No open sign-up; accounts are provisioned by an admin.

---

## Roadmap / ideas

- WhatsApp reminders (optional, alongside Telegram).
- Richer, printable PDF history for appointments.
- Real-time sync between caretakers (currently a light background refresh).

---

## License

Alongside is free software licensed under the **GNU Affero General Public License v3.0**
(AGPL-3.0) — see [LICENSE](LICENSE). In short: you are free to use, study, share and
modify it, but if you run a modified version as a network service, you must make the
source of that version available to its users.

Copyright © 2026 Mihai Stănculescu.

---

## Status

Actively used and iterated. Romanian-first, English-ready. Contributions and issues
welcome — if a Romanian name doesn't inflect correctly in a title, or a schedule edge
case looks off, open an issue.
