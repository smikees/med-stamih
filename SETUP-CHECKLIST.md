# med.stamih.com — Your setup checklist (things only you can do)

I do all the code. These are the external accounts/consoles I can't touch. **Do the four "NOW" items to unblock Phase 1; the two "LATER" items wait until we build reminders (Phase 3).** Anything sensitive (DB password, Google secret, bot token) you can either paste here or place directly in `config.php` on the server yourself — I keep them only in the gitignored `config.php`, never in the repo.

---

## NOW — needed for Phase 1 (foundations)

### 1. Confirm the subdomain is live (2 min)
- In a browser, open **https://med.stamih.com** — it should load *something* (even a blank/placeholder page or a directory listing), and the padlock (SSL) should be valid.
- If it errors or SSL is missing: in cPanel → **Domains/Subdomains**, confirm `med.stamih.com` exists with a document root (usually `public_html/med.stamih.com`), and that **AutoSSL** has issued a cert for it.
- **Tell me:** does it load? padlock valid? (If not, I'll help troubleshoot.)

### 2. Create the MySQL database (5 min) — same as you did for dash/cal
- cPanel → **MySQL® Databases**:
  1. Create a database, e.g. `med_db` (cPanel will prefix it, e.g. `youracct_med_db`).
  2. Create a user, e.g. `med_admin`, with a strong password.
  3. **Add the user to the database** with **ALL PRIVILEGES**.
- **Give me:** the final database name, username, and host (almost always `localhost`) — and the password (paste here, or put it straight into `config.php` on the server once I've deployed the template).

### 3. Create the GitHub repo + add deploy secrets (10 min)
- Create a new **private** repo under your account — suggested name **`med-stamih`** (github.com/smikees/med-stamih). Leave it empty (no README) so I can push the scaffold.
- In the repo → **Settings → Secrets and variables → Actions → New repository secret**, add these three (exactly as named):
  - `FTP_SERVER` = `ftp.1ms.a84.mytemp.website`
  - `FTP_USERNAME` = `md-admin@med.stamih.com`
  - `FTP_PASSWORD` = *(the FTP password you gave me)*
- **Tell me:** the repo URL, and confirm the three secrets are saved. (The FTP creds live ONLY in these secrets — never in the code.)

### 4. Create the Google OAuth client (10 min) — same flow as learn/dash
- Go to **console.cloud.google.com** → your project (or a new one) → **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
- Application type: **Web application**. Name it e.g. "Alongside / med.stamih.com".
- **Authorized JavaScript origins:** `https://med.stamih.com`
- **Authorized redirect URIs:** `https://med.stamih.com/auth/callback.php`
- Also on the **OAuth consent screen**: make sure it's configured (External, app name "Alongside", your support email) and add the family members' Google emails as **Test users** (so they can sign in while the app is in "testing" mode) — or publish it.
- **Give me:** the **Client ID** (not secret — safe to share) and the **Client secret** (paste here or place in `config.php` yourself; it stays server-side, gitignored).

---

## LATER — needed for Phase 3 (reminders)

### 5. Create the Telegram bot (5 min)
- In Telegram, message **@BotFather** → `/newbot` → give it a name (e.g. "Alongside") and a username ending in `bot` (e.g. `AlongsideCareBot`).
- BotFather returns a **token** like `1234567:AA…`.
- **Give me:** the bot token (goes in `config.php`, server-side) and the bot's @username. I'll set up the webhook and the "link your account" deep link.

### 6. Create the reminder pinger (5 min) — free
- Sign up free at **cron-job.org** (or tell me you'd rather use your cPanel cron if the host has it).
- I'll give you the exact secret URL (`https://med.stamih.com/cron/dispatch.php?key=…`) to schedule **every minute**. You just paste it in.

---

## What I'm doing in parallel (no action needed from you)
- Scaffolding the repo: DB schema, `config.php` template, PHP API skeleton with the `requireProfile()` isolation choke-point, Google + local auth, the GitHub Actions test-and-deploy workflow, the PWA shell, and porting the handoff's `organic-styles.css` + logic.
- Once items **1–4** are done, I push the scaffold, we deploy, and you'll have a login you can test — then we build out the four tabs (Phase 2).

## Handy summary of what to hand back
| Item | What I need from you |
| --- | --- |
| Subdomain | "loads + SSL valid" (or the error) |
| MySQL | db name, user, host, password |
| GitHub | repo URL + "3 secrets saved" |
| Google | Client ID + Client secret |
| Telegram (later) | bot token + @username |
| Pinger (later) | cron-job.org account ready |
