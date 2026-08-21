# Handoff: Alongside — Family Medication Tracker

A build-ready specification for a shared, multi-person medication & daily-task tracker aimed at families caring for older relatives. Everything a developer needs to recreate the design in a production codebase is in this document; the HTML in `prototype/` and `source/` is the reference implementation.

---

## Overview

**Alongside** lets one shared family login manage the daily medicine and activity schedules of several people (e.g. grandparents, a parent). Any signed-in family member can:

- See what each person needs to take **today**, grouped by time of day, and mark each item taken / not taken.
- Correct the record for **past days** in a weekly history grid, and review a 30-day log.
- **Manage** each person's list of medicines and activities (add / edit / remove, with recurrence and end conditions), and manage the family members themselves.
- Set **preferences**: interface language (Romanian / English), text size, and whether pill photos show.

The product is deliberately **large-type, high-contrast, low-jargon** — designed for older users and for anxious family members checking in remotely. Tone is warm and plain-spoken ("Marked not taken", "Worth a look"), never clinical.

The design is **fully bilingual (Romanian default + English)**. Romanian is the primary market; all copy, date/time formatting, and even the heading font switch with language (see [Localization](#localization)).

---

## About the design files

The files in this bundle are **design references created in HTML** — a working prototype showing intended look, copy, and behavior. **They are not production code to copy verbatim.** The task is to **recreate these designs in the target codebase's own environment** (React / React Native / Flutter / SwiftUI / etc.) using its established patterns, component library, state management, and networking — or, if no codebase exists yet, to pick an appropriate stack and implement there.

The prototype stores everything in `localStorage` and has no real accounts, notifications, or server. Production needs a real backend and auth — see [Production gaps](#production-gaps-not-in-the-prototype).

### What's in this bundle

| Path | What it is |
| --- | --- |
| `README.md` | This spec — implement from this alone. |
| `prototype/medication-tracker-prototype.html` | **Standalone, self-contained** prototype. Open directly in any browser (no server, no build). Try it first to feel the interactions. |
| `source/Alongside - Medication Tracker.dc.html` | The original annotated source (markup + full logic class). Read this for exact behavior, seed data, and copy strings. |
| `design-system/organic-styles.css` | **The design token source of truth.** All colors, spacing, radii, shadows, type. |
| `design-system/organic-readme.md` | The "Organic" design system's own usage guide. |

> The prototype uses a small in-house template runtime. **Ignore the runtime** — it is not part of the product. Read the `<x-dc>` markup for structure and the `class Component` block for logic; both are plain and framework-agnostic in intent.

---

## Fidelity

**High-fidelity.** Colors, typography, spacing, radii, copy, and interactions are final. Recreate the UI to match, pulling exact values from [Design tokens](#design-tokens). Where the prototype and this document ever disagree, **this document wins** for intent; the prototype wins for exact pixel detail.

---

## Design language (read first)

The app uses the **Organic** design system — warm, rounded, a little playful. Applying it consistently matters more than any single screen.

- **Ground:** cream `#f5ead8` app background; a slightly darker sand `#ebddc5` for cards/surfaces; near-black `#201e1d` text.
- **Two accents:** terracotta `#c67139` (primary / "not taken" / attention) and sage `#7a8a5e` (secondary / "taken" / success). Each has a 100–900 tonal ramp — light steps (100–200) for tinted fills, mid (500) as base, dark (700–800) for text on those tints.
- **Over-rounded:** cards ~24–26px radius, dialogs ~28px+, all buttons/inputs/chips fully pill (`border-radius: 999px`). No sharp corners, no hairline-only geometry.
- **Soft decoration:** large translucent accent-tinted circles bleed off the top-right corner of each screen header (decorative only, `overflow:hidden` on the phone frame clips them).
- **Type:** Caprasimo (display, headings) over Figtree (body). In Romanian the heading font is **Baloo 2** instead of Caprasimo (Caprasimo lacks Romanian diacritics — ș/ț/ă/î). Body stays Figtree in both languages.
- **Icons:** Lucide, drawn at **stroke-width 2.75** (heavier/rounder than Lucide default), `stroke-linecap`/`linejoin` round. All icons in the prototype are inline SVG paths; use your Lucide package equivalents. Icon names used: check, x, plus, minus, pencil, trash, clock, bell, globe, gear (settings-cog), camera, chevron-left/right, rotate-ccw, calendar, circle-check (today), and custom morning/noon/evening/bedtime/pill/activity glyphs.
- **Frame:** the whole app renders in a **max-width 480px column, centered**, min-height 100vh, with `--shadow-lg` and `overflow:hidden` — i.e. a phone-shaped app. On real mobile it's full-bleed; the width cap is for the desktop preview.

---

## Global layout

Two top-level states, chosen by auth:

1. **Login** (unauthenticated) — full-screen, centered vertically, no bottom nav.
2. **App** (authenticated) — a scrollable content area above a fixed **bottom tab bar** with 4 tabs: **Today, History, Manage, Settings**. The content area is `flex:1; overflow-y:auto`; the tab bar is `border-top:1px solid divider`, background = app bg.

Bottom tab item: vertical stack (icon 24px + label 12–13px bold), `min-height:62px`, `flex:1` each. Active tab = terracotta `--color-accent`; inactive = `--color-neutral-600`. No pill/background on active — color only.

Three **modal dialogs** overlay everything (item editor, person editor, full-history) — see [Dialogs](#dialogs).

---

## Screens / views

### 1. Login

- **Purpose:** enter the shared family credentials.
- **Layout:** vertically centered column, `padding: 40px 28px`. Two decorative circles bleed off corners (sage top-right 300px, terracotta bottom-left 140px).
- **Components (top → bottom):**
  - **Brand row:** 60px terracotta circle with a white pill icon + "Alongside" (Caprasimo ~2.1em) and tagline beneath (`Daily medicines, together` / `Medicamente zilnice, împreună`), neutral-700.
  - **Heading:** "Welcome back" / "Bine ai revenit" (~1.8em) + subline "Sign in to your family's daily list." (neutral-700).
  - **Family card:** surface-fill, radius 24px. Uppercase kicker "The Bennett family" / "Familia Bennett", then a row of member avatars (46px circles, colored, white initial, name below). Read-only display of who's in this family.
  - **Email field** — prefilled `bennett.family@email.com`.
  - **Password field** — type password, prefilled `password` (dots).
  - **Sign in button** — primary, full width, `min-height:58px`, ~1.2em.
  - **Help line** — centered, neutral-600: "Trouble signing in? Call Sarah on (555) 010-2929".
- **Behavior:** Sign in ignores field contents in the prototype and goes straight to **Today**. In production, authenticate against the family account.

### 2. Today (default tab)

- **Purpose:** the daily driver — what a person needs now, and one-tap logging.
- **Header:** kicker = greeting + date (`Good morning · Wed 21 Aug`, greeting varies by current hour: <12 morning, <17 afternoon, else evening). Title = "Ruth's day" / "Ziua lui Ruth". Decorative sage circle top-right.
- **Person switcher:** horizontal scroll row of **person chips** (pill, 34px avatar + name). Active chip = terracotta border + surface fill; inactive = divider border, transparent. Selecting a person re-renders the whole Today view for them. This same switcher appears on Today, History, and Manage (Manage keeps its own independent selection).
- **Summary card:** surface, radius 26px, `--shadow-sm`. Left: a 76px **progress ring** (SVG, sage stroke, `stroke-width 8`, r 30, rounded cap, sweeps from top) with the taken fraction centered (e.g. "0/3"). Right: headline + subline:
  - headline: `All done for today` (0 pending) / `Nothing scheduled` (empty) / `N pill(s) left to take`.
  - subline: `{done} of {total} taken` (+ ` · {n} not taken` if any skipped), or `Add items in Manage` when empty.
- **Reminder banner:** one line with a bell icon, tinted by urgency:
  - overdue → accent-100 bg / accent-800 text: "Morning medicines are overdue"
  - due now → same tint: "Morning medicines are due now"
  - upcoming → neutral-200 bg: "Next reminder · Evening at 8:00 PM"
  - all done → accent-2-100 (sage) bg: "All done for today — lovely work"
- **Sections:** items are grouped. **Pills** are grouped by time-of-day bucket: **Morning** (05:00–11:00), **Midday** (11:00–15:00), **Evening** (16:00–21:00), **Bedtime** (21:00–24:00). All **activities/tasks** collect into a single "Activities" section regardless of time. Empty buckets are omitted.
  - **Section header:** 38px circle icon (time-of-day glyph; sage tint) + label (Caprasimo ~1.35em). Pill sections show a small bell + "Reminder 7:00" beneath the label, and a **status badge** on the right:
    - all taken → "All done" (sage accent-2-200 / accent-2-800)
    - due now (current time in bucket window) → "Due now" (accent-500 fill / bg text)
    - overdue (past bucket window, still pending) → "Overdue" (accent-700 / bg)
    - upcoming → "Coming up" (neutral-200 / neutral-800)
  - Activities section has no badge and no reminder line.
- **Item card:** surface, radius 24px, `--shadow-sm`, `padding:16px`.
  - Left (if photos on): 54px circle, pill items tinted accent-100, activities accent-2-100; shows uploaded photo (cover) or a pill/activity icon.
  - Body: **name** (1.2em bold) + right-aligned time (`clock icon + 7:00 AM`). Detail line (neutral-700): pills show `take {count} · for {purpose}` (purpose lowercased), activities show the purpose. Optional **note chip** (accent-100 pill): e.g. "Before breakfast, empty stomach".
  - **Action zone** (state machine per item, per day):
    - **pending:** two side-by-side buttons — primary "**Taken**" (check icon) + secondary "**Didn't take**" (x icon), each `min-height:54px`. Activities read "**Done**" / "**Didn't do**".
    - **taken:** a sage accent-2-100 rounded bar: check + "Taken at 7:12 AM" (or "Taken" if no time) and a "**Change**" ghost button (reverts to pending). Below it a small underlined "**Edit time**" link → opens an inline 30-min-increment time `<select>` + Close, to correct the recorded intake time *without* changing taken/skipped state.
    - **not taken:** a terracotta accent-100 pill bar: x + "Marked not taken" + "**Change**" (reverts to pending).
- **Empty state:** if the person has no items, a centered message "Nothing on Ruth's list yet." + primary "Add the first item" (→ opens item editor for that person).

### 3. History

- **Purpose:** review adherence and **correct past records**.
- **Header:** kicker "This week" / title "Ruth's week". Person switcher (same as Today).
- **Two stat cards** (side by side, surface, radius 20px):
  - adherence % this week (sage accent-2-700 number, ~1.9em) + "taken this week".
  - doses taken count + "of {N} taken this week".
- **Week navigation:** ‹ prev / caption / › next. Caption reads "This week", "Last week", or a date range "8 Jul – 14 Jul". Next is disabled at the current week (`weekOffset >= 0`); can page arbitrarily far back.
- **Grid:** surface card, radius 24px, `--shadow-sm`, horizontally scrollable. Column layout: `116px` name column + 7 day columns. Header row: day-of-week abbrev + date number (today's number is terracotta + bold). Each row = one scheduled item; each cell is a **tappable button**:
  - taken → "✓" sage (accent-2-100 / accent-2-700)
  - not taken → "✕" terracotta (accent-100 / accent-700)
  - no record → "–" (neutral-200 / neutral-500)
  - **not scheduled that day** → "N/A" (neutral-100 / neutral-400), **not tappable**
  - **future day** → blank, not tappable
- **Tapping a cell cycles** its status: none → taken → skipped → none. First edit snapshots the log; a "Tap any square to correct it — saved for the whole family." hint shows, and when dirty, **Cancel changes** (rotate icon, restores snapshot) + **Save changes** (check) appear. Save just clears the dirty flag (edits were already applied live).
- **Legend:** four chips explaining ✓ / ✕ / – / N/A.
- **"View entire history"** link → opens the full-history dialog (last 30 days).
- **"Worth a look":** a short list (max 5) of recent misses/no-records from the past 6 days — 34px status circle + name + "Mon morning · not taken".

### 4. Manage

- **Purpose:** set up each person's list, and manage family members.
- **Header:** kicker "Set up" / title "Manage". Person switcher (**independent** selection from Today/History).
- **List section:** "{name}'s list" heading + primary "**+ Add**" button (opens item editor). Then a column of compact rows (surface, radius 18px): optional 44px photo/icon, name (bold) + meta line (`take 2 · Morning · Diabetes` for pills; `Activity · Evening` for tasks), optional recurrence line in sage (`Weekly · Mon, Wed` / `Monthly · day 15` / `until 12 Aug`). Each row has an **edit (pencil)** and **remove (trash)** icon button (44px, secondary).
- **Family members section:** "Family members" heading + note "Everyone signed in to this family can view and update any list." A surface card lists each person: 40px avatar + name + relationship, with **edit (pencil)** and, if more than one person exists, **remove (trash)** ghost icon buttons. A "**+ Add a family member**" ghost button at the bottom.
- **Fix-a-mistake callout:** sage accent-2-100 card — "Fixing a mistake" + body + "Go to History" secondary button.

### 5. Settings

- **Purpose:** preferences (persisted locally in prototype; per-user in production).
- **Header:** kicker "Preferences" / title "Settings".
- **Language card:** globe icon + "Language" + two big pill toggle buttons: **English** / **Română**. Selected = terracotta fill / bg text; unselected = divider border, transparent.
- **Text size card:** "Text size" + three pill toggles **Standard / Large / Extra large** (each rendered at its own size as a preview). This scales the whole app's root font: Standard 17px, Large 19px (default), Extra large 22px. All app sizing uses `em`, so this scales everything proportionally.
- **Show pill photos card:** label + **On / Off** toggle. Off hides all the photo/icon avatars on Today and Manage.
- **Sign out:** ghost, full-width → returns to Login.

---

## Dialogs

All dialogs: fixed backdrop (`neutral-900 @ 50%`), centered card `width: min(440px, 100%)`, radius ~28px+, surface/neutral-100 fill, `--shadow-lg`, `max-height:88vh` scroll. Backdrop click closes; card click stops propagation.

### Item editor (add / edit medicine or activity)

Title "Add to the list" / "Edit item". Fields, in order:

1. **Name** (text) — placeholder "e.g. Metformin, or Back exercise".
2. **Photo (optional)** — 60px circle preview + "Add/Change photo" file button (`accept="image/*"`, read as data URL) + "Remove" when set.
3. **Type** (select: Medicine / Activity·task) + **How many** (number, min 1) — side by side.
4. **When** (select: Morning/Midday/Evening/Bedtime) + **Time** (select, 30-min increments across 24h) — side by side.
5. **Repeats** (select: Every day / Weekly / Monthly).
   - if **Weekly** → **On these days**: 7 pill day-toggles (Su–Sa), multi-select.
   - if **Monthly** → **Day of the month**: select 1–31.
6. **Ends (optional)** — three pill mode toggles: **No end / On a date / After N times**.
   - "On a date" → date input.
   - "After N times" → number input (min 1) + "times".
7. **What it's for (optional)** (text) — placeholder "e.g. Blood pressure".
8. **Special note (optional)** (text) — placeholder "e.g. take with food".

Actions: **Cancel** (secondary) / **Save** (primary). Save is a no-op if name is blank. New items get `startDate = today` (used for "after N times" counting). Saving targets the currently-selected **Manage** person.

### Person editor (add / edit family member)

Title "Add a family member" / "Edit family member". Add mode shows a subline "They'll appear in the switcher with an empty list you can fill in." Fields: **Name** (placeholder "e.g. Eleanor") + **Relationship** (placeholder "e.g. Mother"). Actions Cancel / Save(Add). New person: initial = first letter of name, relation defaults to "Family", assigned a tint cycling through the accent ramp, given an empty schedule, and becomes the selected Manage person. At least one person must remain (remove is hidden for the last one).

### Full history (30-day log)

Title "Full history" + subline "{name} · Last 30 days" + close (x) button. Grouped by day (most recent first, only days with scheduled items). Each day: heading (`Wed 21 Aug`, "This week" badge on today) + rows: 30px status circle (✓/✕/–) + item name + time + right-aligned status label ("Taken at 8:04 AM" / "Not taken" / "No record").

---

## Interactions & behavior

- **Navigation** is client-side view switching (no routing in prototype; use your router in production: `/today`, `/history`, `/manage`, `/settings`, `/login`). Switching tabs resets transient history state (week offset, dirty edits, open time-editors).
- **Person selection** is independent between the Today/History pair and Manage.
- **Logging** is optimistic and immediate — tapping Taken/Didn't take writes the log for `personId | dateISO | itemId` right away. "Taken" records the current time by default; "Edit time" and history cell edits let you correct it.
- **History cell cycling:** none → taken → skipped → none. Batched under a snapshot so Cancel can restore.
- **Recurrence resolution** (`isScheduledOn(item, date)`), used by Today, History, and stats:
  - daily → every day; weekly → only if `date.getDay()` ∈ `item.days`; monthly → only if `date.getDate() === item.dom`.
  - end handling: `endMode` = `never` | `date` (hide after `endDate`) | `count` (hide after the Nth occurrence counted from `startDate`).
- **Text size** multiplies the root `em`; **language** swaps all strings, date/time formatting, and heading font live.
- **No transitions/animations** beyond default; keep it calm. Respect `prefers-reduced-motion` if you add any.
- **Accessibility:** large hit targets (buttons 44–58px min height), high contrast, `aria-label` on all icon-only buttons. Keyboard focus uses the design system's 2px terracotta `:focus-visible` ring — **do not** ship default-blue focus rings. Body text in the terracotta accent must use a deep ramp step (accent-700+) for contrast, not the base accent.

---

## State management

Prototype state shape (recreate as your store / server models):

```
data = {
  people:   [{ id, name, initial, relation, tintVar }],       // tintVar = a color-ramp CSS var
  schedules:{ [personId]: [ Item ] },
  logs:     { [`${personId}|${dateISO}|${itemId}`]: LogEntry },
}

Item = {
  id, name, type: 'pill'|'activity', count,
  group: 'morning'|'noon'|'evening'|'bedtime', time,   // time = minutes since midnight
  purpose, note, photo,                                 // photo = data URL / image URL
  freq: 'daily'|'weekly'|'monthly', days: number[]/*0–6*/, dom: 1–31,
  endMode: 'never'|'date'|'count', endDate: ISO, endCount: number, startDate: ISO,
}

LogEntry = { status: 'taken'|'skipped', mins: number|null /* taken-at, mins since midnight */, at: epochMs }
// absence of a key = "no record"

prefs = { lang: 'en'|'ro', textSize: 'Standard'|'Large'|'Extra large', showPhotos: bool }
```

- Prototype persistence: `localStorage` keys `alongside_v4` (data, versioned) and `alongside_prefs_v1` (prefs). **Replace with your backend.** Because any family member edits shared lists and logs, the server is the source of truth and should sync across devices.
- The prototype ships **seed data** (three people — Ruth/Grandmother, George/Grandfather, Eleanor/Mother — with realistic medicine lists and ~6 days of randomized history). Use it for demos; do not ship it as real data. Full seed is in `source/…dc.html` (`seed()` / `seedLogs()`).

---

## Localization

- Two locales, **`ro` (default)** and `en`. Every user-facing string exists in both — see the `STR` object in `source/…dc.html` for the complete, final copy in both languages. Do not re-translate; reuse those strings.
- **Interpolation** uses `{name}`, `{n}`, `{time}`, `{group}`, etc.
- **Medicine/purpose/relationship terms** are translated via a `TD` lookup (e.g. Thyroid→Tiroidă) — for seed content only; user-entered names are shown as typed.
- **Time format:** English 12-hour `7:12 AM`; Romanian 24-hour `07:12`.
- **Dates:** localized day/month abbreviations (both locales in `source`).
- **Heading font per locale:** English → **Caprasimo**; Romanian → **Baloo 2** (700). Load Baloo 2 (Google Fonts) alongside Caprasimo/Figtree; select at runtime by locale so Romanian diacritics render.

---

## Design tokens

Exact values — the source of truth is `design-system/organic-styles.css`. Pull these into your theme; don't hard-code hexes ad hoc.

### Color

| Role | Value |
| --- | --- |
| bg (app) | `#f5ead8` |
| surface (cards) | `#ebddc5` |
| text | `#201e1d` |
| divider | `#201e1d` @ 16% |
| accent (terracotta) | `#c67139` |
| accent-2 (sage) | `#7a8a5e` |

Neutral ramp 100→900: `#f9f4ed #eee7db #dcd3c4 #c0b6a5 #a19786 #82796a #645c50 #474238 #2e2b25`

Accent (terracotta) 100→900: `#fff2eb #ffe1d0 #ffc6a5 #f6a06b #d67f48 #b2622d #8c491a #643312 #402310`

Accent-2 (sage) 100→900: `#f0fae1 #e1eecc #ccdbb2 #aebf92 #8fa073 #728157 #56633f #3d472b #272e1b`

**Semantic use:** taken/success = sage (fill accent-2-100, text/mark accent-2-700/800). Not-taken/attention = terracotta (fill accent-100, text accent-700/800). No-record = neutral-200/500. Body-on-tint always uses the 700–800 step.

### Type

- Body: **Figtree** (400 / 600 / 700).
- Heading: **Caprasimo** (400) — EN; **Baloo 2** (700) — RO.
- Base scale (design system): h1 42 / h2 32 / h3 25 / h4 20px; body 15px, line-height 1.55. In-app, sizes are expressed in `em` relative to a root that the text-size setting sets to 17 / 19 / 22px.
- Heading line-height 1.12, letter-spacing -0.015em.

### Spacing

`--space-1..8` = `4.4 / 8.8 / 13.2 / 17.6 / 26.4 / 35.2px` (1.10× density scale). Screen gutters in-app are 20px; card padding 16–20px.

### Radius

`--radius-sm 8 / --radius-md 16 / --radius-lg 28px`. **Override:** cards & dialogs use `radius-lg × 1.15` (~32px); **buttons, inputs, tags, chips are fully pill (`999px`)**. In-app cards commonly use 18–26px directly.

### Shadow

- `--shadow-sm`: `0 1px 2px rgba(46,43,37,.14)`
- `--shadow-md`: `0 3px 10px rgba(46,43,37,.16)`
- `--shadow-lg`: `0 12px 32px rgba(46,43,37,.22)`

### Components (from the system) to reuse

`.btn` (+ `-primary` solid accent / `-secondary` outline / `-ghost` / `-icon` / `-block`), `.tag` (+ accent / accent-2 / neutral / outline), `.field`+`.input` (pill, surface fill, terracotta caret & focus), `.card` (+ elev-sm/md/lg), `.dialog` + `.dialog-backdrop`/`-title`/`-body`/`-actions`. All states (hover/active/focus/disabled/selection) are pre-themed in the CSS — match them.

---

## Assets

- **No bitmap assets ship with the design.** Avatars are colored circles with a letter initial. Pill/activity thumbnails are Lucide-style inline SVG icons unless the user uploads a photo.
- **User photos** (pill photos, and person avatars in production) are uploaded via a file input and stored as data URLs in the prototype — in production, upload to your storage and keep URLs.
- **Icons:** Lucide (https://lucide.dev), stroke-width 2.75. The custom time-of-day glyphs (morning/noon/evening/bedtime) and pill/activity are simple Lucide-derived paths; exact `d` attributes are in the `ICONS` map in `source/…dc.html`.
- **Fonts:** Google Fonts — Caprasimo, Figtree (400/600/700), Baloo 2 (700).

---

## Production gaps (not in the prototype)

These are **UI-only or stubbed** and need real implementation:

1. **Accounts & auth** — one shared family login is faked; Sign in / Sign out just switch views. Build real family accounts with multiple member logins, all scoped to one shared dataset.
2. **Sync / backend** — all data is local. Because the whole point is *shared* lists that any member updates, you need a server as source of truth with multi-device sync (and ideally conflict handling on concurrent log edits).
3. **Reminders / notifications** — the bell banners and "Reminder 7:00" lines are **display only**. Real push notifications and/or SMS reminders (at each item's scheduled time, with overdue nudges) are a core promised feature and must be built.
4. **Photo storage** — data URLs → real upload/CDN.
5. **Time zones / DST** — the prototype uses local device time and minutes-since-midnight; define behavior across time zones for remote family members.
6. **Audit trail** — "saved for the whole family" implies edits should ideally record who changed what and when (`LogEntry.at` exists but no actor).

---

## Files (reference order)

1. `prototype/medication-tracker-prototype.html` — run it first.
2. `README.md` — this spec.
3. `source/Alongside - Medication Tracker.dc.html` — exact markup, logic, seed data, and both languages' full copy.
4. `design-system/organic-styles.css` — token source of truth.
5. `design-system/organic-readme.md` — design-system guide.
