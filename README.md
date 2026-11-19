# JobTrack: Personal Job Application Tracker

A gamified personal tracker for job and internship applications (PRD **PST_PD_044**).
You record applications, track their status, save recruiter contacts and schedule follow-ups.
While you do that you earn **XP**, level up, complete **daily quests**, keep **streaks** and unlock **trophies**.

Built with the stack the PRD requires: **HTML5, CSS3, Bootstrap 5, vanilla JavaScript and localStorage**.
Motion is powered by **GSAP 3.13** (CDN). There is no backend, no framework and no build step.

---

## Run it

```bash
npm start          # zero-dependency static server → http://localhost:5944
npm test           # 17 unit tests (Node's built-in test runner)
```

You can also serve the folder with any static server (`python3 -m http.server`), or deploy it as-is to GitHub Pages or Vercel.
Opening `index.html` directly from disk also works.

## Features

| Area | What you get |
|---|---|
| **Dashboard** | Player card (level ring, XP bar, streak) and a "next best move" hint. It also has 3 daily quests, 6 metric cards that link to filtered lists, a pipeline map with stage conversion %, a follow-up queue, recently updated applications, an 18-week activity heatmap and a trophy preview |
| **Applications** | Search by company, role or recruiter. Filter by status (chips), type and priority. Sort by updated, applied, company, follow-up or priority. A full table on desktop becomes stacked cards on phones. You can change status inline. **Kanban board** with drag-and-drop between status columns |
| **Add / Edit** | Two-column modal (full-screen on phones), status picker chips, priority segment, quick follow-up dates (+3d/+1w/+2w) and company autocomplete. Inline validation tied to each field with `aria-describedby`. `Ctrl+Enter` saves |
| **Details** | Clickable status stepper, job details, timestamped notes (delete with undo) and a full history timeline. Follow-up panel (complete / +3d / +1w / pick a date / clear). Recruiter contact with mailto/tel links, copy buttons, edit and clear |
| **Follow-ups** | Overdue, due today & upcoming, and completed groups. Month calendar with status dots. Toggle to include rejected/withdrawn applications |
| **Contacts** | Recruiters collected from the applications, linked back to each one |
| **Trophies** | 16 achievements (bronze/silver/gold), XP breakdown by source, XP log, and the XP rules |
| **Settings** | Display name, 3D particle scene on/off, sound effects, reduce motion. CSV export, JSON backup, validated CSV/JSON import, reset demo data, delete all |
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
* **Celebrations:** level-ups, trophies and offers trigger confetti, toasts and optional 8-bit sounds. All of it respects `prefers-reduced-motion` and the in-app "Reduce motion" switch.

### Logo

The mark is an inline SVG that tells the product story. A progress line climbs through three stage checkpoints (applied → assessment → interview) and lands on a gold star (the offer).

* **Boot splash:**
  1. the badge springs in
  2. the line draws itself while the checkpoints pop in sync
  3. the star spins in with a shockwave ring
  4. the wordmark letters spring up
  5. the "loading" label decodes
* **Header:** hovering sends a spark along the path, the nodes pulse, the star twinkles and the letters wave. An idle spark runs every few seconds.
* **Code:** `js/logo.js`. The spark rides a GSAP MotionPath, with SVG `animateMotion` as the fallback.

### Look & feel: Cosmos

A single theme based on a 3D particle-website reference.

**Space and type:**
* black space and warm-white type
* condensed Oswald headlines with an outlined first word ("BOOST / YOUR / CAREER")
* glass panels floating over the scene
* white pill buttons
* gold and ice-blue accents
* no violet

**Background, a 3D particle scene:**
* About 5,000 glowing particles in gold, warm white and ice blue form a sculpture in a parallax starfield, with the odd shooting star.
* It's rendered in real time on canvas with additive blending and needs no WebGL or extra libraries.
* Each screen gets its own shape, and GSAP morphs the particles between them:
  * dashboard: rocket
  * applications: briefcase
  * trophies: trophy
  * every other screen: ringed planet
* It reacts to you:
  * the sculpture turns toward the cursor and the particles part around it
  * clicks burst it
  * XP gains sparkle
  * level-ups and offers explode it and re-form it
* It pauses in background tabs, draws a still frame for reduced motion, and can be switched off in Settings (static stars remain).

**Signature details:**
* live XP feed ticker
* numbered sections
* custom cursor ring ("OPEN" / "DRAG")
* page wipes in deep-space tones
* the animated JobTrack mark: a progress line to a gold star on a dark badge

### Motion: GSAP 3.13

GSAP and its plugins load from the jsDelivr CDN. They have been free for all uses since 3.13.
`js/motion.js` runs everything through GSAP and falls back to the browser's native Web Animations API if the CDN can't be reached.

| Plugin | Used for |
|---|---|
| **SplitText** | Masked character reveals on every screen heading |
| **ScrollTrigger** | Batched reveals as sections scroll in; scrubbed parallax on the hero title |
| **Flip** | Rows glide on sort/filter, Kanban cards glide between columns, toasts restack |
| **MotionPath** | XP orbs curve into the HUD; the logo spark travels its progress line |
| **CustomEase** | House easing curves |
| **Core timelines / quickTo** | Page-wipe transitions, ticker marquee, custom cursor, elastic nav indicator, logo intro, level-up badge |

**Other effects:**
* Magnetic buttons and 3D-tilt cards
* HUD labels that decode from random glyphs
* Count-ups, and bars that tween from their previous value
* Spring modals
* A flash ring on whatever you just changed

**Reduced motion:** everything is skipped when the OS prefers reduced motion or when "Reduce motion" is on in Settings. The particle scene then shows as a still frame.

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
index.html              App shell, navbar, modals (form, confirm, follow-up, level-up, palette)
css/style.css           Cosmos design tokens, components, responsive rules
js/utils.js             Date helpers, formatting, validators, ids (crypto.randomUUID + fallback)
js/applications.js      Data model + pure CRUD, record normalisation, demo data
js/form-validation.js   Field-level validation shared by the form, model and import
js/follow-ups.js        Follow-up state rules, complete / schedule / clear
js/filters.js           Search, filter (with sanitising), sort
js/analytics.js         Stats, funnel, activity events, heatmap, contacts (all derived)
js/game.js              XP, levels, ranks, streaks, quests, achievements (derived)
js/storage.js           The only module touching localStorage; safe reads/writes
js/io.js                CSV/JSON export and import (formula-injection safe)
js/fx.js                Count-ups, floating XP, confetti, WebAudio blips
js/motion.js            GSAP-driven animation engine (native fallback): SplitText, ScrollTrigger, Flip, MotionPath
js/background.js        Cosmos scene: 3D particle sculpture + starfield (morphs per screen, reacts to cursor/clicks/XP)
js/experience.js        Custom cursor, live XP ticker, page-wipe transitions
js/logo.js              Animated SVG logo (intro timeline, idle spark, hover wave)
js/views.js             Pure HTML renderers (all user text escaped)
js/app.js               Controller: hash router, event delegation, commit() → save → render
data/sample-applications.json   Example records (fictional)
tests/logic.test.js     Unit tests mapped to PRD test cases
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

`npm test` runs 17 passing tests:
* TC-01 to TC-08, TC-10 and TC-11 from the PRD
* Validation, date maths across month ends and DST, filter sanitising and sorting
* Malformed-data recovery and the CSV round-trip
* XP anti-farming, levels/streaks and achievement persistence

These were checked in the browser: add, edit, delete with confirm, inline status, search, filters, board drag-and-drop, complete follow-up, persistence after refresh (TC-09), corrupted-storage recovery and the command palette.
At 375 px phone width there was no horizontal overflow on any screen (TC-12).

## Known limitations

* Records live only in this browser and don't sync between devices.
* Clearing browser data removes them, so export a backup first.
* Reminders are in-app indicators, not email or push notifications.
* There are no user accounts or cloud backups. This is a personal tool, not a secure multi-user system.
* No job discovery or auto-apply (out of scope per the PRD).

## Future ideas

* Browser notifications for due follow-ups
* Chart.js trend charts
* A dashboard date-range filter
* A React + Vite rebuild
* Optional cloud sync behind authentication

## Team

Srihitha Golla (PST-26-0267), Nihitha Rajesh (PST-26-0134).
