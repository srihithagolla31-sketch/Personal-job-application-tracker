# Onward — Viva & Demo Day Guide

Read this out loud a few times. The goal is that every answer you give is **specific and shown on screen**, not "it's user-friendly and has a good UI."

---

## 1. The 30-second pitch

> "Students applying in placement season lose track of who they applied to, forget to follow up, and get discouraged by rejections. Spreadsheets only *store* that information.
> **Onward tells you what to do next.** When you open it, it ranks what needs you today: an overdue follow-up, an interview tomorrow, a deadline in two days. Then it helps you act, for example by drafting the follow-up email for you.
> It needs no sign-up, your data never leaves your browser, and it's built around how Indian students actually apply: campus drives, Internshala, Naukri, referrals."

---

## 2. "Why would someone use this instead of existing products?"

This is the question you're worried about. Answer in **three layers**: who it's for, what it does that others don't, and proof.

### Layer 1: Know the competition (shows you did research)
- **Spreadsheets / Notion** are what most students actually use. They're free and flexible, but passive. They never tell you anything.
- **Huntr** and **Teal** are popular trackers with Chrome extensions and resume tools. Both need an account and store your data on their servers. Reviews in 2026 report that Huntr's free plan caps you at 100 tracked jobs, with Pro at about $40/month. Teal's free tracker is unlimited, but its AI features sit behind the paid Teal+ plan. They're built for a general (mostly US) audience.
  *(Pricing changes often. Check their websites the day before your viva and update these numbers.)*

### Layer 2: What Onward does differently. Say each one and SHOW it.

| Say this | Show this |
|---|---|
| "Other tools are a **record**. Onward is a **coach**. It ranks what needs you today." | Dashboard → **Your next steps** |
| "Students don't skip follow-ups because they forget. They skip them because they don't know what to write. Onward **writes it for them**, personalised and free." | Select **Write message** → the composer |
| "Adding an application takes about **20 seconds**. Paste a link and we fill in the company and source." | Press **N** and paste `https://careers.zoho.com/jobs/1` |
| "It shows you **which source works for you**: referrals, campus drives or LinkedIn. You can't get that from a spreadsheet without formulas." | Dashboard → **What's working** |
| "Job hunting is demoralising, so we **celebrate effort**, not just offers: weekly effort, streaks, confetti on an offer, kind words on a rejection." | Effort panel, streak, then select Offer or Rejected |
| "**No sign-up, nothing to set up, private.** Data never leaves your browser. For a student who just wants to get organised in 10 seconds, that matters." | Footer message, Settings → About |

### Layer 3: Be honest about the trade-off (this impresses evaluators)
> "We're not trying to beat Huntr at resume builders or browser extensions. We focus on one moment: **a first-time applicant opening the app and immediately knowing their next step.** For that user, a simple, private, free tool that coaches them is better than a powerful tool they need an account for."

**If they push: "But Teal also has reminders."**
> "Reminders tell you *when*. Onward also tells you *why* and *what*: it ranks across all your applications, explains each step, and gives you a one-click action like a drafted email or 'I've applied'. Plus, it doesn't need an account."

---

## 3. Demo script (5–7 minutes)

**Before you start:** go to Settings → **Reset demo data**, set your name in Settings, and use light mode.

1. **The story (30 s).** "Meet Ananya. She has applied to 12 places in 6 weeks. She opens Onward…"
2. **Dashboard (1 min).** Point at the greeting, then **Your next steps**: "an interview tomorrow, a follow-up that's 2 days overdue, a deadline in 2 days."
3. **Act on a step (1 min).** On Northwind, select **Write message**. Show that it's addressed to Priya, mentions the role and date, and is signed with your name. Select **Copy message**, then **Mark follow-up as done**. The step disappears and the effort panel goes up.
4. **Quick add (45 s).** Press **N**, paste `https://careers.zoho.com/jobs/1`. "It knew the company was Zoho." Type a job title and save. The total goes from 12 to 13.
5. **Applications (45 s).** Search "zoho". Select the **Offer** chip. Change the sort. "Every filter happens instantly, in the browser."
6. **Details (1 min).** Open Bluepeak. Show the next-step callout, the journey timeline and the recruiter contact. Select **Offer** and enjoy the confetti. "Then if it's a rejection…" select **Rejected** to show the kind message, then switch it back.
7. **Follow-ups (30 s).** Show the overdue, due today, upcoming and completed groups, and use **Reschedule → In 1 week**.
8. **Proof it's real (30 s).** Refresh the page and everything stays. Turn on dark mode. Press F12, switch to phone view, and show the cards and the + button.
9. **Close (15 s).** "Onward turns a list of applications into a daily plan, so students spend energy applying, not organising."

---

## 4. How it works, in plain words

**The whole app is one array of objects saved in localStorage.**

```
Page loads → loadApplications() → apps array
User clicks → a logic function returns a NEW array (e.g. updateApplicationStatus)
           → commit(newApps): save to localStorage → redraw navbar + page
```

- **One record** = one object: `{ id, company, jobTitle, status, applicationDate, followUpDate, followUpCompleted, recruiter: {name, email, phone}, statusHistory: [...], followUpHistory: [...], ... }`. See `data/sample-applications.json`.
- **Logic files don't touch the page.** `applications.js`, `follow-ups.js`, `coach.js`, `analytics.js` and `filters.js` only work with data. Page files (`js/pages/*.js`) only draw HTML. This is the "separate data, logic and UI" learning outcome.
- **Nothing is stored twice.** Dashboard numbers are calculated every time with `.filter().length`, so they can never go out of sync with the records (PRD 10.3).
- **IDs, not array positions.** Each record has a stable `id` (e.g. `APP-1001`). Pages are opened with `details.html?id=APP-1001` and read using `URLSearchParams`.

### File map — who does what
| File | One-line job |
|---|---|
| `storage.js` | Data model lists, load/save, cleans bad records (`normalizeApplication`) |
| `sample-data.js` | 12 demo records with dates relative to today |
| `applications.js` | validate, create, update, delete, change status, complete/reschedule follow-up, smart paste |
| `follow-ups.js` | Overdue, today, upcoming, completed rules |
| `coach.js` | ★ `getNextAction()` rules + `buildMessage()` templates |
| `analytics.js` | Stats, momentum, streak, source insights, pipeline |
| `filters.js` | Search, filter, sort (without changing the original array) |
| `ui.js` | Navbar, badges, toasts, confirm dialog, quick add, composer, `commit()` |
| `pages/*.js` | One script per page that draws it |

---

## 5. Code you must be able to explain (open these during practice)

1. **`commit()` in `ui.js`.** The single path for every change: save, then (only if saving worked) update `apps` and redraw. If saving fails, show the PRD's storage error message.
2. **`getNextAction()` in `coach.js`.** Plain `if` rules checked in priority order: interview within 3 days → overdue follow-up → follow-up today → deadline within 5 days → offer waiting → no reply in 10+ days. Each returns a title, a reason and buttons, with a `score` for sorting. **"It's not AI. It's transparent rules, so it's predictable and explainable."**
3. **Date handling in `utils.js`.** Dates are `"YYYY-MM-DD"` strings from the **local** calendar. Explain the bug: `new Date().toISOString()` is UTC, so in India before 5:30 AM it returns yesterday, which would mark follow-ups overdue a day early. Same-format strings can be compared with `<`. `daysBetween` uses `Date.UTC` so daylight saving can't break it.
4. **`escapeHtml()`.** Anything the user types is escaped before going into `innerHTML`. Otherwise a company name like `<img src=x onerror=alert(1)>` would run code (an XSS attack). There's a tested example.
5. **`normalizeApplication()` + `loadApplications()`.** JSON parsing is wrapped in `try/catch`. Each record is checked, valid ones are kept, broken ones are skipped, and a warning is shown. The app never crashes on bad data.
6. **Event delegation.** One `click` listener on `document` handles every `data-action="..."` button. That's why buttons still work after a re-render.
7. **`sortApplications()`.** It copies the array first (`[...apps]`) because `.sort()` changes the array in place.

**Practise a live change.** Evaluators sometimes say "change X". Try these:
- Change `NO_REPLY_DAYS` in `coach.js` from 10 to 5. More "no reply" steps appear.
- Change `--primary` in `style.css`. The whole app recolours.
- Add a new tip to `TIPS` in `pages/dashboard.js`.

---

## 6. Likely viva questions, with answers

**Product**
- *Who is the user?* Students applying for internships and jobs, especially first-timers in placement season, managing 5–30 applications at once.
- *What problem does it solve?* Scattered information and forgotten follow-ups. Our promise is: record an application in under 30 seconds and instantly see which ones need a follow-up.
- *How did you decide on features?* From the PRD's user journeys, plus talking to classmates. *(Add your real survey quotes here.)*
- *What would you build next?* Browser notifications for follow-ups due today, a calendar view, interview prep checklists per round, and optional cloud sync with sign-in as a separate phase.
- *How would you measure success?* Time to add an application (target under 30 s), the percentage of follow-ups completed vs. overdue, and weekly active use during placement season.

**Technical**
- *Why localStorage and not a database?* The PRD scope is a frontend MVP with no backend. localStorage needs no server, works offline, and keeps data private. The trade-offs: no sync between devices, data is lost if browser data is cleared (we added backup/restore to reduce this), and a limit of about 5 MB, which is plenty for text records.
- *Why vanilla JS and not React?* The PRD's core stack is HTML, CSS, JS and Bootstrap. For 6 pages, plain functions that return HTML strings are simple and easy to explain. React would help if the app grew.
- *How do you make sure dashboard numbers are correct?* They're never stored, only calculated from the records every render, and tested by comparing pipeline counts with the stored data.
- *How does search work?* `filterApplications()` lowercases the query and checks whether the company, job title or recruiter name `includes()` it, then applies the status, type and priority filters.
- *What happens if localStorage is full or blocked?* `saveApplications()` returns `false` inside `try/catch`, and we show "We couldn't save your changes…" without changing what's on screen.
- *How do you create unique IDs?* `crypto.randomUUID()`, with a fallback using time plus a random number for older browsers.
- *What's the difference between `map`, `filter` and `find`?* `map` transforms every item into a new array, `filter` keeps the matching items, and `find` returns the first match.
- *Why `JSON.stringify`?* localStorage stores only strings, so we turn the array into text to save it and `JSON.parse` it back when loading.

**Design and accessibility**
- *Why these colours?* A warm "sunrise" palette (violet to coral) to feel hopeful, not corporate. Status colours were checked for 4.5:1 contrast.
- *How is it accessible?* Semantic landmarks, a skip link, labels on every field, errors linked with `aria-describedby`, visible focus rings, keyboard shortcuts, status shown as **icon + text** (not colour alone), and reduced motion respected (confetti and animations turn off).
- *How is it responsive?* The Bootstrap grid and breakpoints: a table on ≥768 px and cards on phones, collapsible navigation, a floating add button, and no horizontal overflow at 375 px (tested).

**Testing**
- *How did you test it?* All 12 PRD test cases plus the critical path, 60 automated checks in total, including damaged data, XSS and phone widths. See `docs/TESTING.md`.

**Teamwork** *(fill in honestly)*
- *Who did what?* Point to the README team table and your commits.

---

## 7. Final checklist before demo day
- [ ] Deployed on GitHub Pages, and the link is in the README
- [ ] Reset demo data on the demo laptop
- [ ] Your name set in Settings
- [ ] Competitor pricing re-checked
- [ ] Survey quotes added (section 6)
- [ ] Both members can explain `commit()`, `getNextAction()` and the date bug
- [ ] Practised one live code change
