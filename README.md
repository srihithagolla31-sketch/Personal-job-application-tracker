# JobTrack: Personal Job Application Tracker

A gamified personal tracker for job and internship applications (PRD **PST_PD_044**).
You record applications, track their status, save recruiter contacts and schedule follow-ups.
While you do that you earn **XP**, level up, complete **daily quests**, keep **streaks** and unlock **trophies**.

Built with the stack the PRD requires: **HTML5, CSS3, Bootstrap 5, vanilla JavaScript and localStorage**.
The particle scene uses the GSAP core from a CDN. There is no backend, no framework and no build step. Sign-in screens are included as a frontend layer
that can be connected to any authentication provider later (see [Authentication](#authentication)).

---

**Live demo:** https://srihithagolla31-sketch.github.io/Personal-job-application-tracker/

## Run it

```bash
npm start          # zero-dependency static server → http://localhost:5944
npm test           # 33 unit tests (Node's built-in test runner)
```

You can also serve the folder with any static server (`python3 -m http.server`).
The live demo is hosted on **GitHub Pages**, served straight from the `main` branch root, so every push to `main` redeploys it automatically.
Use a local server rather than opening `index.html` from disk: the preview sign-in uses the Web Crypto API, which browsers only expose on `https://` and `localhost` pages.

## Features

| Area | What you get |
|---|---|
| **Account** | Sign in, create account, forgot password, sign out (user menu, Settings or command palette). Every app screen requires sign-in |
| **Dashboard** | Progress card (level ring, XP bar, streak) and a suggested next step. It also has 3 daily quests, a summary row of 6 metrics that link to filtered lists, a pipeline map with stage conversion %, a follow-up queue, recently updated applications, an 18-week activity heatmap and a trophy preview |
| **Applications** | Search by company, role or recruiter. Filter by status (chips), type and priority. Sort by updated, applied, company, follow-up or priority. A full table on desktop becomes stacked cards on phones. You can change status inline. **Kanban board** with drag-and-drop between status columns |
| **Add / Edit** | Two-column modal (full-screen on phones), status picker chips, priority segment, quick follow-up dates (+3d/+1w/+2w) and company autocomplete. Inline validation tied to each field with `aria-describedby`. `Ctrl+Enter` saves |
| **Details** | Clickable status stepper, job details, timestamped notes (delete with undo) and a full history timeline. Follow-up panel (complete / +3d / +1w / pick a date / clear). Recruiter contact with mailto/tel links, copy buttons, edit and clear |
| **Follow-ups** | Overdue, due today & upcoming, and completed groups. Month calendar with status dots. Toggle to include rejected/withdrawn applications |
| **Contacts** | Recruiters collected from the applications, linked back to each one |
| **Trophies** | 16 achievements (bronze/silver/gold), XP breakdown by source, XP log, and the XP rules |
| **Settings** | Account details and sign out, display name, particle background on/off, sound effects, reduce motion. CSV export, JSON backup, validated CSV/JSON import, load sample data, delete all |
| **Power-user** | `Ctrl/⌘+K` command palette with fuzzy search; `N`, `/`, `B`, `?`, and `G` then `D/A/F/C/T/S` shortcuts |

### Game layer

* **XP is derived, never stored.** It is recalculated from the records on every render, so it can't drift out of sync with the data.
* XP sources:
  * Log an application: +10
  * First time an application reaches a stage: Applied +15, Assessment +25, Interview +40, **Offer +120**, Rejected +10 ("resilience")
  * Complete a follow-up: +15
  * Timestamped note: +5 (max 5 per application)
  * Each daily quest: +20
* **Anti-farming:** stage XP is paid once per stage per application, so toggling a status back and forth earns nothing.
* **Levels:** cumulative XP for level L is `50·L·(L−1)`. Ranks go from Rookie to Career Legend.
* **Feedback:** XP earned is shown in the confirmation toast. Level-ups open a short dialog, trophies show a toast, and optional sound cues can be turned on in Settings.

### Design: Cosmos

A dark theme over a live particle scene, with the clutter taken out.

* **Palette:** black space (`#030409`), warm-white type (`#f4f1ea`), gold for XP and progress (`#f2b544`), ice blue for links and focus (`#7ab6ff`). Green, red and amber are used only for meaning (offer, rejected, overdue, due today), and every status also has an icon and a text label.
* **Particle scene** (`js/background.js`): about 5,000 particles in gold, warm white and ice blue form a sculpture in a starfield. Each screen has its own shape (dashboard: rocket, applications: briefcase, trophies: trophy, everything else: ringed planet) and GSAP morphs between them. It turns toward the cursor, bursts on clicks, sparkles on XP gains and explodes and re-forms on level-ups and offers. On the sign-in screens it sits beside the form; on app screens it stays softer behind the panels. It pauses in background tabs, shows a still frame with reduced motion, and can be switched off in Settings.
* **Type:** IBM Plex Sans for the interface, IBM Plex Mono for small numeric details. Sentence-case headings and buttons.
* **Surfaces:** flat dark panels with a 1px border and a light blur so the scene shows through softly. Shadows only on things that float (menus, modals, toasts).
* **Buttons:** warm-white primary buttons, outlined secondary buttons, 6px corners. Hover changes colour only.
* **Removed clutter:** the boot splash, custom cursor ring, page-wipe transitions, live XP ticker, scroll-triggered reveals, magnetic and tilting elements, floating XP orbs, confetti, the outlined "BOOST YOUR CAREER" hero and numbered section labels.
* **Motion:** besides the particle scene, only short fades (160 to 220 ms) on screen changes, toasts and list re-ordering. Everything respects the OS reduced-motion setting and the "Reduce motion" switch.
* **Tokens** live at the top of `css/style.css` (`--bg`, `--surface`, `--border`, `--text`, `--muted`, `--primary`, `--xp`, status colours, radii).

## Authentication

The app has a complete sign-in experience: **sign in**, **create account**, **forgot password**, **sign out**, inline form validation, success and error messages, and a route guard that keeps every app screen behind sign-in and returns you to the page you asked for after signing in.

**No authentication backend is connected yet.** The UI talks only to `JT.auth`, which forwards to a swappable adapter:

| File | Purpose |
|---|---|
| `js/auth/auth-service.js` | Provider-agnostic service (`signIn`, `signUp`, `signOut`, `requestPasswordReset`, session state). Documents the adapter contract. |
| `js/auth/auth-config.js` | The one place that chooses the adapter. |
| `js/auth/preview-adapter.js` | Local preview adapter used until a provider is chosen. |
| `js/auth/auth-validation.js` | Pure field rules and safe post-login redirects (unit tested). |
| `js/auth/auth-ui.js` | Login, sign-up and reset screens. |

**Preview mode, honestly labelled.** The preview adapter keeps accounts in this browser's storage with a salted PBKDF2 password hash, so the forms behave realistically (wrong password, duplicate email). It is **not** a security boundary: anyone with access to the browser can read or change that data, accounts don't sync across devices, and no reset emails are sent. The sign-in pages and the Settings > Account panel say this, and the forgot-password screen states that no email was sent. Application data is still shared by everyone using the same browser.

**Connecting a real provider** (your own API, Firebase, Supabase, Auth0, Clerk, Cognito and so on):

1. Write an adapter that implements the contract in `auth-service.js` (`init`, `signIn`, `signUp`, `signOut`, `requestPasswordReset`, optional `onChange`) and sets `isProduction: true`.
2. Load it in `index.html` before `auth-config.js`, and register it there with `JT.auth.use(...)`.
3. Return `{ ok: true }` without a session from `signUp` if your provider requires email confirmation; the UI then shows "check your email".
4. Decide whether application data should move to the server per user. Today it stays in localStorage, unchanged.

Nothing else in the app needs to change.

## Statuses and follow-up rules

Statuses: `Interested → Applied → Assessment → Interview → Offer`, plus `Rejected` and `Withdrawn` (closed).

| Follow-up state | Rule |
|---|---|
| Upcoming / Due today | date ≥ today and not completed |
| Overdue | date < today and not completed |
| Completed | the student explicitly marked it complete (logged with a timestamp) |
| Inactive | the application is Rejected/Withdrawn, so it's hidden from active lists by default |

Dates are stored as local `YYYY-MM-DD` strings and compared as calendar days.
This avoids timezone-induced "overdue" errors. The UI also re-checks when the day rolls over.

## Project structure

```
index.html              App shell, navbar, user menu, modals (form, confirm, follow-up, level-up, palette)
css/style.css           Design tokens, components, auth layout, responsive rules
js/utils.js             Date helpers, formatting, validators, ids (crypto.randomUUID + fallback)
js/applications.js      Data model + pure CRUD, record normalisation, demo data
js/form-validation.js   Field-level validation shared by the form, model and import
js/follow-ups.js        Follow-up state rules, complete / schedule / clear
js/filters.js           Search, filter (with sanitising), sort
js/analytics.js         Stats, funnel, activity events, heatmap, contacts (all derived)
js/game.js              XP, levels, ranks, streaks, quests, achievements (derived)
js/storage.js           The only module touching localStorage; safe reads/writes
js/io.js                CSV/JSON export and import (formula-injection safe)
js/fx.js                Optional sound cues, small feedback helpers
js/motion.js            Short native transitions (screen fade, list re-order, toasts); exposes GSAP core to the scene
js/background.js        Cosmos particle scene (morphs per screen, reacts to cursor, clicks and XP)
js/auth/                Authentication service, adapters, validation and screens (see above)
js/views.js             Pure HTML renderers (all user text escaped)
js/app.js               Controller: hash router + auth guard, event delegation, commit() → save → render
data/sample-applications.json   Example records (fictional)
tests/logic.test.js     Unit tests mapped to PRD test cases
tests/auth.test.js      Auth validation, redirect safety, service and preview adapter
scripts/serve.mjs       Zero-dependency dev server
```

Data flows one way: **action → pure function → `commit()` → localStorage → `render()`**.
Every dashboard number is derived from the records.

### localStorage keys

| Key | Purpose |
|---|---|
| `jobtracker_applications` | Application records |
| `jobtracker_settings` | Display preferences |
| `jobtracker_data_version` | Sample-data version |
| `jobtracker_game` | Trophy unlock timestamps + last seen level (for celebrations only) |
| `jobtracker_applications_corrupt_backup` | Raw copy kept if saved data can't be parsed |
| `jobtracker_auth_preview_accounts` | Preview-mode accounts (name, email, salted password hash). Not used once a real provider is connected |
| `jobtracker_auth_preview_session` | Preview-mode session (localStorage, or sessionStorage when "Keep me signed in" is off) |

### Sample record

```json
{
  "id": "APP-1001",
  "company": "Acme Technologies",
  "jobTitle": "Software Development Intern",
  "jobType": "Internship",
  "location": "Bengaluru",
  "priority": "High",
  "jobUrl": "https://example.com/jobs/1001",
  "applicationDate": "2026-10-12",
  "status": "Applied",
  "recruiter": { "name": "Recruiter Example", "email": "recruiter@example.com", "phone": "" },
  "followUpDate": "2026-10-24",
  "followUpNote": "",
  "followUpCompleted": false,
  "notes": "Applied through the company careers page.",
  "statusHistory": [{ "status": "Applied", "at": "2026-10-12T10:00:00.000Z" }],
  "followUpLog": [],
  "notesLog": [],
  "createdAt": "2026-10-12T10:00:00.000Z",
  "updatedAt": "2026-10-12T10:00:00.000Z"
}
```

Demo companies, people and links are fictional.
On first launch the demo data is positioned relative to today, so overdue, due-today and upcoming follow-ups are always visible.

## Robustness

* Malformed JSON in storage → a warning banner appears, the raw data is backed up and the app keeps working.
* Individually invalid records are skipped and you get a "partial" notice. Duplicate IDs are reassigned.
* Write failures (quota or private mode) show the PRD's storage-error message instead of crashing.
* If a view throws, the app shows a friendly error panel. Saved data is untouched.
* CSV export prefixes cells starting with `= + - @` to block spreadsheet formula injection, and import reverses it.

## Accessibility

Semantic landmarks, a skip link, and visible labels on every field.
Errors are linked to their inputs with `aria-describedby` and `aria-invalid`.
Status is never shown by colour alone: each status has an icon and text.
Other details:
* Visible focus rings, and named icon buttons.
* Keyboard-operable dialogs, palette and status picker.
* The Kanban board has a status menu on every card, so you don't need drag-and-drop.
* Reduced-motion support.

## Test results

`npm test` runs 33 passing tests:
* TC-01 to TC-08, TC-10 and TC-11 from the PRD
* Validation, date maths across month ends and DST, filter sanitising and sorting
* Malformed-data recovery and the CSV round-trip
* XP anti-farming, levels/streaks and achievement persistence
* Auth field validation, safe post-login redirects, the auth service and the preview adapter (password hashing, duplicate emails, generic sign-in errors, session storage, honest reset result)

These were checked in the browser: add, edit, delete with confirm, inline status, search, filters, board drag-and-drop, complete follow-up, persistence after refresh (TC-09), corrupted-storage recovery and the command palette.
The sign-in flow was checked end to end: redirect to sign-in with a return path, inline errors, sign-up, sign-out, wrong password, return to the requested page, and forgot password.
At 375 px phone width there was no horizontal overflow on any screen (TC-12), and no console errors at desktop or phone width.

## Known limitations

* Records live only in this browser and don't sync between devices.
* Clearing browser data removes them, so export a backup first.
* Reminders are in-app indicators, not email or push notifications.
* Sign-in is a frontend preview until an authentication provider is connected. It is not secure, and application data is not separated per account.
* There are no cloud backups.
* No job discovery or auto-apply (out of scope per the PRD).

## Future ideas

* Browser notifications for due follow-ups
* Chart.js trend charts
* A dashboard date-range filter
* A React + Vite rebuild
* Connect a real authentication provider and optional cloud sync per account

## Team

Srihitha Golla (PST-26-0267), Nihitha Rajesh (PST-26-0134).
