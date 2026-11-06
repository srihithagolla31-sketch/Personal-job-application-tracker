# Test results

**Date tested:** 1 November 2026
**How:** automated browser tests (Playwright, Chromium) that click through the real pages exactly like a user, plus manual checks of the screenshots.
**Result:** 60/60 checks passed. All 12 PRD test cases pass.

## PRD test cases (section 17.3)

| ID | Test | Result |
|---|---|---|
| TC-01 | Add a valid application | ✅ Pass |
| TC-02 | Submit without a company name | ✅ Pass |
| TC-03 | Change status Applied → Interview | ✅ Pass |
| TC-04 | Search for a company name | ✅ Pass |
| TC-05 | Filter by Offer | ✅ Pass |
| TC-06 | Past follow-up date, incomplete | ✅ Pass |
| TC-07 | Future follow-up date | ✅ Pass |
| TC-08 | Mark a follow-up complete | ✅ Pass |
| TC-09 | Refresh after creating | ✅ Pass |
| TC-10 | Delete an application | ✅ Pass |
| TC-11 | Unmatched query / clear filters | ✅ Pass |
| TC-12 | Phone width | ✅ Pass |

## Critical-path checklist (section 17.2)

| Step | Result |
|---|---|
| Open the dashboard and review the sample metrics | ✅ |
| Add a new application with valid details | ✅ |
| Verify it appears in the application list | ✅ |
| Edit the company, role or status and verify | ✅ |
| Search by company or job title | ✅ |
| Filter by status | ✅ |
| Add a recruiter contact and verify it's displayed | ✅ |
| Set a follow-up date and verify upcoming / overdue | ✅ |
| Mark a follow-up as complete | ✅ |
| Refresh and verify records remain | ✅ |
| Delete an application and confirm it's removed | ✅ |
| Dashboard statistics update after changes | ✅ |
| Required-field validation | ✅ |
| Laptop and phone-width layouts | ✅ (1280px and 375px, no horizontal overflow) |
| Deployed demo and README | ⬜ Check after deploying to GitHub Pages |

## Every check that was run

| Area | Check | Result |
|---|---|---|
| INIT | Sample data loads on first launch | ✅ Pass |
| INIT | Dashboard total matches records | ✅ Pass |
| DIFF | Smart paste fills company + source from link | ✅ Pass |
| TC-01 | Add a valid application | ✅ Pass |
| DIFF | Quick add auto-schedules follow-up (+7 days) | ✅ Pass |
| TC-01 | Dashboard total updates after add | ✅ Pass |
| TC-01 | New application appears in list | ✅ Pass |
| TC-02 | Missing company shows validation, no record created | ✅ Pass |
| VAL | Invalid email is rejected | ✅ Pass |
| VAL | Invalid URL is rejected | ✅ Pass |
| VAL | Follow-up before application date is rejected | ✅ Pass |
| TC-05b | Full form saves recruiter contact and shows it on details | ✅ Pass |
| TC-03 | Status change Applied→Interview saved and shown | ✅ Pass |
| DIFF | Status history records the change | ✅ Pass |
| TC-03 | Dashboard interviews count updates | ✅ Pass |
| TC-04 | Search by company returns only matches | ✅ Pass |
| TC-04 | Search by recruiter name works | ✅ Pass |
| TC-04 | Search by job title works | ✅ Pass |
| TC-11 | Unmatched query shows helpful empty state | ✅ Pass |
| TC-11 | Clear filters restores all records | ✅ Pass |
| TC-05 | Filter by Offer shows only offers | ✅ Pass |
| FLT | Priority filter correct | ✅ Pass |
| SORT | Sort by company A–Z | ✅ Pass |
| SORT | Sort preference remembered after refresh | ✅ Pass |
| FLT | Dashboard link ?status=Rejected pre-filters list | ✅ Pass |
| TC-06 | Past follow-up date is marked overdue | ✅ Pass |
| TC-07 | Future follow-up appears in Upcoming | ✅ Pass |
| RULE | Rejected applications hidden from active follow-ups | ✅ Pass |
| TC-08 | Completed follow-up leaves upcoming/overdue and shows in Completed | ✅ Pass |
| FU | Reschedule +3 days works | ✅ Pass |
| DIFF | Composer drafts personalised message | ✅ Pass |
| DIFF | Copy message puts it on the clipboard | ✅ Pass |
| DIFF | Open in email app link is built | ✅ Pass |
| DIFF | "I've applied" moves Interested → Applied and schedules follow-up | ✅ Pass |
| DIFF | Offer triggers celebration | ✅ Pass |
| DIFF | Rejection shows a supportive message | ✅ Pass |
| CONTACT | Contact can be cleared | ✅ Pass |
| TC-10 | Cancel delete keeps record | ✅ Pass |
| TC-10 | Delete with confirmation removes record | ✅ Pass |
| TC-10 | Dashboard total updates after delete | ✅ Pass |
| UI | Deleted record URL shows not-found state | ✅ Pass |
| TC-09 | Records remain after refresh / new tab | ✅ Pass |
| METRIC | Pipeline counts match records | ✅ Pass |
| EXPORT | CSV export has header + one row per application | ✅ Pass |
| SET | Greeting uses name | ✅ Pass |
| ERR | Corrupted data shows warning instead of crashing | ✅ Pass |
| ERR | Partially invalid data: valid records kept, warning shown | ✅ Pass |
| IMPORT | Backup restore brings records back | ✅ Pass |
| UI | Empty dashboard shows first-application prompt | ✅ Pass |
| UI | Empty follow-ups state shown | ✅ Pass |
| SEC | Typed HTML is shown as text, never run | ✅ Pass |
| SET | Reset demo data restores 12 samples | ✅ Pass |
| TC-12 | No horizontal overflow at 375px: index.html | ✅ Pass |
| TC-12 | No horizontal overflow at 375px: applications.html | ✅ Pass |
| TC-12 | No horizontal overflow at 375px: details.html?id=APP-1002 | ✅ Pass |
| TC-12 | No horizontal overflow at 375px: form.html | ✅ Pass |
| TC-12 | No horizontal overflow at 375px: follow-ups.html | ✅ Pass |
| TC-12 | No horizontal overflow at 375px: settings.html | ✅ Pass |
| TC-12 | Phone shows cards instead of table | ✅ Pass |
| JS | No JavaScript errors during the whole run | ✅ Pass |

**Area codes:** TC = PRD test case · DIFF = Onward's differentiating features · VAL = validation · FLT/SORT = filters and sorting · RULE/FU = follow-up rules · ERR = damaged data handling · SEC = security · METRIC = dashboard accuracy · SET = settings · UI = empty/not-found states

## Manual test steps (to repeat before the demo)

1. Open **Settings → Reset demo data** so the dates are fresh.
2. Press <kbd>N</kbd>, paste `https://careers.zoho.com/jobs/1`, and type a job title. The company should become "Zoho". Save it.
3. Open **Applications**, search "zoho", and check it's there.
4. Open Northwind Labs and select **Interview**. The status, the timeline and the dashboard count all change.
5. On the **Dashboard**, select **Write message** on an overdue follow-up, then **Copy message**, then **Mark follow-up as done**.
6. Select **Offer** on any application. You should see confetti.
7. Refresh the page (F5). Everything is still there.
8. Delete an application. The confirmation appears, and the dashboard total goes down.
9. Press F12, turn on device mode, choose iPhone, and check every page.
