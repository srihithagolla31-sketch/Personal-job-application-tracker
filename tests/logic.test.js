/**
 * Unit tests for the pure logic modules. Run with:  npm test
 * (uses Node's built-in test runner, no dependencies).
 * Test IDs map to PRD §17.3 where applicable.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

['utils', 'applications', 'form-validation', 'follow-ups', 'filters', 'analytics', 'game', 'io'].forEach((m) => require(`../js/${m}.js`));
const JT = globalThis.JT;
const { utils: U, applications: A, followUps: FU, filters: F, analytics: AN, game: G, io: IO, validation: VAL } = JT;

const TODAY = '2026-11-16';
const NOW = new Date(2026, 10, 16, 12, 0, 0);
const valid = (over = {}) => ({ company: 'Acme', jobTitle: 'Intern', applicationDate: '2026-11-10', status: 'Applied', ...over });

test('TC-01 add a valid application', () => {
  const rec = A.createApplication(valid({ recruiterName: 'Jane', recruiterEmail: 'jane@example.com' }), NOW);
  assert.match(rec.id, /^APP-/);
  assert.equal(rec.company, 'Acme');
  assert.equal(rec.status, 'Applied');
  assert.deepEqual(rec.recruiter, { name: 'Jane', email: 'jane@example.com', phone: '' });
  assert.equal(rec.statusHistory.length, 1);
  assert.equal(rec.followUpCompleted, false);
});

test('TC-02 submitting without a company name is rejected', () => {
  assert.throws(() => A.createApplication(valid({ company: '   ' })), /company name/);
  const errors = VAL.validateApplication(valid({ company: '', jobTitle: '', applicationDate: '' }), TODAY);
  assert.deepEqual(Object.keys(errors).sort(), ['applicationDate', 'company', 'jobTitle']);
});

test('validation catches bad URL, email, phone and impossible dates', () => {
  const e = VAL.validateApplication(valid({ jobUrl: 'javascript:alert(1)', recruiterEmail: 'nope', recruiterPhone: '12', deadline: '2026-02-30' }), TODAY);
  assert.ok(e.jobUrl && e.recruiterEmail && e.recruiterPhone && e.deadline);
  assert.ok(VAL.validateApplication(valid({ followUpDate: '2026-11-01' }), TODAY).followUpDate, 'follow-up before applied date');
  assert.deepEqual(VAL.validateApplication(valid({ jobUrl: 'https://example.com/j/1', recruiterPhone: '+91 98450 00000' }), TODAY), {});
});

test('TC-03 status change Applied → Interview is saved with history', () => {
  const rec = A.createApplication(valid(), NOW);
  const [next] = A.updateApplicationStatus([rec], rec.id, 'Interview', new Date(2026, 10, 17));
  assert.equal(next.status, 'Interview');
  assert.deepEqual(next.statusHistory.map((h) => h.status), ['Applied', 'Interview']);
  assert.throws(() => A.updateApplicationStatus([rec], rec.id, 'Hired'), /Invalid application status/);
});

test('edit keeps id, records status change, and resets completion when follow-up date changes', () => {
  let apps = [A.createApplication(valid({ followUpDate: '2026-11-12' }), NOW)];
  const id = apps[0].id;
  apps = FU.completeFollowUp(apps, id, NOW);
  assert.equal(apps[0].followUpCompleted, true);
  apps = A.updateApplication(apps, id, { ...A.toFormData(apps[0]), followUpDate: '2026-11-20', status: 'Assessment' }, NOW);
  assert.equal(apps[0].id, id);
  assert.equal(apps[0].followUpCompleted, false);
  assert.equal(apps[0].statusHistory.at(-1).status, 'Assessment');
});

test('TC-04 / TC-05 search and status filter', () => {
  const apps = [
    A.createApplication(valid({ company: 'Nova Systems', jobTitle: 'Frontend Intern', status: 'Offer' })),
    A.createApplication(valid({ company: 'Acme', jobTitle: 'Data Analyst', recruiterName: 'Meera Iyer' })),
  ];
  assert.deepEqual(F.filterApplications(apps, { query: 'nova' }).map((a) => a.company), ['Nova Systems']);
  assert.deepEqual(F.filterApplications(apps, { query: 'meera' }).map((a) => a.company), ['Acme']);
  assert.deepEqual(F.filterApplications(apps, { status: 'Offer' }).map((a) => a.company), ['Nova Systems']);
  assert.equal(F.filterApplications(apps, { query: 'zzz' }).length, 0); // TC-11
});

test('sanitizeFilters keeps valid filters and drops invalid ones', () => {
  const { filters, invalid } = F.sanitizeFilters({ status: 'Offer', jobType: 'Pirate', priority: 'High' });
  assert.equal(filters.status, 'Offer');
  assert.equal(filters.jobType, 'all');
  assert.equal(filters.priority, 'High');
  assert.deepEqual(invalid, ['jobType']);
});

test('sort by follow-up date puts unscheduled last', () => {
  const apps = [
    A.createApplication(valid({ company: 'B', followUpDate: '' })),
    A.createApplication(valid({ company: 'A', followUpDate: '2026-11-20' })),
    A.createApplication(valid({ company: 'C', followUpDate: '2026-11-18' })),
  ];
  assert.deepEqual(F.sortApplications(apps, 'followup').map((a) => a.company), ['C', 'A', 'B']);
  assert.deepEqual(F.sortApplications(apps, 'company').map((a) => a.company), ['A', 'B', 'C']);
});

test('TC-06 / TC-07 / TC-08 follow-up states', () => {
  const past = A.createApplication(valid({ followUpDate: '2026-11-14' }));
  const due = A.createApplication(valid({ followUpDate: TODAY }));
  const future = A.createApplication(valid({ followUpDate: '2026-11-25' }));
  const closed = A.createApplication(valid({ followUpDate: '2026-11-14', status: 'Rejected' }));
  const apps = [past, due, future, closed];
  assert.equal(FU.getFollowUpState(past, TODAY), 'overdue');
  assert.equal(FU.getFollowUpState(due, TODAY), 'today');
  assert.equal(FU.getFollowUpState(future, TODAY), 'upcoming');
  assert.equal(FU.getFollowUpState(closed, TODAY), 'inactive');
  assert.deepEqual(FU.getOverdueFollowUps(apps, TODAY).map((a) => a.id), [past.id]);
  assert.deepEqual(FU.getUpcomingFollowUps(apps, TODAY).map((a) => a.id), [due.id, future.id]);
  assert.equal(FU.getOverdueFollowUps(apps, TODAY, { includeClosed: true }).length, 2);

  const done = FU.completeFollowUp(apps, past.id, NOW);
  assert.equal(FU.getOverdueFollowUps(done, TODAY).length, 0);
  assert.equal(FU.getCompletedFollowUps(done).length, 1);
  assert.throws(() => FU.completeFollowUp(done, past.id, NOW), /already complete/);

  const again = FU.scheduleFollowUp(done, past.id, '2026-11-30', 'second ping', NOW);
  assert.equal(FU.getFollowUpState(again.find((a) => a.id === past.id), TODAY), 'upcoming');
});

test('date helpers are calendar-safe across month ends and DST', () => {
  assert.equal(U.addDays('2026-01-31', 1), '2026-02-01');
  assert.equal(U.addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(U.diffDays('2026-03-07', '2026-03-09'), 2);
  assert.equal(U.diffDays('2026-10-31', '2026-11-02'), 2);
  assert.equal(U.isValidISODate('2026-02-29'), false);
  assert.equal(U.relativeDays('2026-11-15', TODAY), 'yesterday');
});

test('TC-10 delete removes the record and stats update', () => {
  const a = A.createApplication(valid({ status: 'Interview' }));
  const b = A.createApplication(valid({ status: 'Offer' }));
  assert.equal(AN.getApplicationStats([a, b], TODAY).total, 2);
  const left = A.deleteApplication([a, b], a.id);
  const stats = AN.getApplicationStats(left, TODAY);
  assert.equal(stats.total, 1);
  assert.equal(stats.interviews, 0);
  assert.equal(stats.offers, 1);
});

test('dashboard stats match the underlying records', () => {
  const apps = A.buildSampleApplications(NOW);
  const s = AN.getApplicationStats(apps, TODAY);
  assert.equal(s.total, apps.length);
  assert.equal(Object.values(s.byStatus).reduce((x, y) => x + y, 0), apps.length);
  assert.equal(s.overdue, FU.getOverdueFollowUps(apps, TODAY).length);
  assert.ok(s.overdue >= 1 && s.upcoming >= 1, 'demo data shows overdue and upcoming follow-ups');
});

test('normalizeRecord repairs or rejects malformed stored data', () => {
  const { records, invalid } = A.normalizeAll([
    { id: 'X1', company: 'Ok', jobTitle: 'Dev', applicationDate: '2026-10-01', status: 'Applied', recruiterName: 'Legacy Flat', followUpDate: 'garbage' },
    { id: 'X2', company: '', jobTitle: 'Dev', applicationDate: '2026-10-01', status: 'Applied' },
    { id: 'X3', company: 'Bad status', jobTitle: 'Dev', applicationDate: '2026-10-01', status: 'Hired' },
    'not an object',
    null,
    { id: 'X1', company: 'Dup id', jobTitle: 'Dev', applicationDate: '2026-10-01', status: 'Offer' },
  ]);
  assert.equal(records.length, 2);
  assert.equal(invalid, 4);
  assert.equal(records[0].recruiter.name, 'Legacy Flat');
  assert.equal(records[0].followUpDate, '');
  assert.notEqual(records[1].id, 'X1', 'duplicate id is reassigned');
});

test('CSV export → import round-trips and neutralises formulas', () => {
  const apps = [A.createApplication(valid({ company: 'Comma, Inc', notes: 'Line 1\nLine "2"', jobTitle: '=HYPERLINK("x")' }))];
  const csv = IO.toCSV(apps);
  assert.ok(csv.includes("'=HYPERLINK"), 'formula is escaped');
  const { records, invalid } = IO.fromCSV(csv);
  assert.equal(invalid, 0);
  assert.equal(records[0].company, 'Comma, Inc');
  assert.equal(records[0].notes, 'Line 1\nLine "2"');
  assert.equal(records[0].jobTitle, '=HYPERLINK("x")');
  assert.throws(() => IO.fromCSV('foo,bar\n1,2'), /missing required columns/);
});

test('XP is derived and status XP cannot be farmed by toggling', () => {
  let apps = [A.createApplication(valid({ status: 'Applied' }), NOW)];
  const base = G.getPlayer(apps, TODAY).breakdown.progress;
  const id = apps[0].id;
  apps = A.updateApplicationStatus(apps, id, 'Interview', NOW);
  const afterInterview = G.getPlayer(apps, TODAY).breakdown.progress;
  assert.equal(afterInterview - base, G.XP_RULES.status.Interview);
  apps = A.updateApplicationStatus(apps, id, 'Applied', NOW);
  apps = A.updateApplicationStatus(apps, id, 'Interview', NOW);
  assert.equal(G.getPlayer(apps, TODAY).breakdown.progress, afterInterview);
});

test('levels and streaks', () => {
  assert.equal(G.levelFromXp(0), 1);
  assert.equal(G.levelFromXp(99), 1);
  assert.equal(G.levelFromXp(100), 2);
  assert.equal(G.levelFromXp(300), 3);
  assert.equal(G.levelFromXp(599), 3);
  assert.equal(G.xpForLevel(4), 600);
  const s = G.computeStreaks(['2026-11-13', '2026-11-14', '2026-11-15', '2026-11-01'], TODAY);
  assert.equal(s.current, 3, 'streak stays alive until today ends');
  assert.equal(s.activeToday, false);
  assert.equal(G.computeStreaks(['2026-11-12'], TODAY).current, 0);
});

test('achievements stay unlocked once earned', () => {
  const player = G.getPlayer([], TODAY);
  const list = G.evaluateAchievements([], player, { first_step: '2026-11-01T00:00:00.000Z' }, TODAY);
  assert.equal(list.find((a) => a.id === 'first_step').unlocked, true);
  assert.equal(list.find((a) => a.id === 'momentum').unlocked, false);
});
