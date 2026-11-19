/**
 * applications.js — the application data model and pure CRUD functions.
 * Every function returns a NEW array; nothing here touches the DOM or storage.
 */
(function (JT) {
  'use strict';

  const U = JT.utils;

  const STATUSES = ['Interested', 'Applied', 'Assessment', 'Interview', 'Offer', 'Rejected', 'Withdrawn'];
  const PIPELINE = ['Interested', 'Applied', 'Assessment', 'Interview', 'Offer'];
  const CLOSED_STATUSES = ['Rejected', 'Withdrawn'];
  const ACTIVE_STATUSES = ['Applied', 'Assessment', 'Interview'];
  const JOB_TYPES = ['Internship', 'Full-time', 'Part-time', 'Other'];
  const PRIORITIES = ['High', 'Medium', 'Low'];

  const STATUS_META = {
    Interested: { tone: 'interested', icon: 'bi-bookmark-star', hint: 'Saved — not applied yet' },
    Applied: { tone: 'applied', icon: 'bi-send', hint: 'Application submitted' },
    Assessment: { tone: 'assessment', icon: 'bi-code-square', hint: 'Test or assignment stage' },
    Interview: { tone: 'interview', icon: 'bi-people', hint: 'Interviewing' },
    Offer: { tone: 'offer', icon: 'bi-trophy', hint: 'Offer received' },
    Rejected: { tone: 'rejected', icon: 'bi-x-octagon', hint: 'Not moving forward' },
    Withdrawn: { tone: 'withdrawn', icon: 'bi-box-arrow-left', hint: 'You withdrew' },
  };

  const PRIORITY_META = {
    High: { icon: 'bi-chevron-double-up', tone: 'high' },
    Medium: { icon: 'bi-chevron-up', tone: 'medium' },
    Low: { icon: 'bi-chevron-down', tone: 'low' },
  };

  const LIMITS = { short: 120, url: 2048, notes: 4000, note: 1000, email: 160, phone: 30 };

  const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

  /** Normalises raw form/import input into the editable fields of a record. */
  function buildFields(input) {
    return {
      company: clean(input.company, LIMITS.short),
      jobTitle: clean(input.jobTitle, LIMITS.short),
      jobType: JOB_TYPES.includes(input.jobType) ? input.jobType : 'Other',
      location: clean(input.location, LIMITS.short),
      priority: PRIORITIES.includes(input.priority) ? input.priority : 'Medium',
      jobUrl: clean(input.jobUrl, LIMITS.url),
      salary: clean(input.salary, LIMITS.short),
      applicationDate: clean(input.applicationDate, 10),
      deadline: clean(input.deadline, 10),
      interviewDate: clean(input.interviewDate, 10),
      status: STATUSES.includes(input.status) ? input.status : 'Interested',
      recruiter: {
        name: clean(input.recruiterName, LIMITS.short),
        email: clean(input.recruiterEmail, LIMITS.email),
        phone: clean(input.recruiterPhone, LIMITS.phone),
      },
      followUpDate: clean(input.followUpDate, 10),
      followUpNote: clean(input.followUpNote, LIMITS.note),
      notes: clean(input.notes, LIMITS.notes),
    };
  }

  function assertValid(input) {
    const errors = JT.validation.validateApplication(input);
    const keys = Object.keys(errors);
    if (keys.length) {
      const err = new Error(errors[keys[0]]);
      err.fields = errors;
      throw err;
    }
  }

  function createApplication(formData, now = new Date()) {
    assertValid(formData);
    const f = buildFields(formData);
    const ts = now.toISOString();
    return {
      id: U.uid('APP'),
      ...f,
      followUpCompleted: false,
      statusHistory: [{ status: f.status, at: ts }],
      followUpLog: [],
      notesLog: [],
      createdAt: ts,
      updatedAt: ts,
    };
  }

  function updateApplication(apps, id, formData, now = new Date()) {
    assertValid(formData);
    const f = buildFields(formData);
    const ts = now.toISOString();
    let found = false;
    const next = apps.map((app) => {
      if (app.id !== id) return app;
      found = true;
      const statusChanged = app.status !== f.status;
      const followUpChanged = app.followUpDate !== f.followUpDate;
      return {
        ...app,
        ...f,
        followUpCompleted: f.followUpDate && !followUpChanged ? app.followUpCompleted : false,
        statusHistory: statusChanged ? [...app.statusHistory, { status: f.status, at: ts }] : app.statusHistory,
        updatedAt: ts,
      };
    });
    if (!found) throw new Error('This application no longer exists.');
    return next;
  }

  function updateApplicationStatus(apps, id, status, now = new Date()) {
    if (!STATUSES.includes(status)) throw new Error('Invalid application status.');
    const ts = now.toISOString();
    return apps.map((app) =>
      app.id === id && app.status !== status
        ? { ...app, status, statusHistory: [...app.statusHistory, { status, at: ts }], updatedAt: ts }
        : app,
    );
  }

  function deleteApplication(apps, id) {
    return apps.filter((app) => app.id !== id);
  }

  function addNote(apps, id, text, now = new Date()) {
    const t = clean(text, LIMITS.note);
    if (!t) throw new Error('Write something before adding a note.');
    const ts = now.toISOString();
    return apps.map((app) =>
      app.id === id ? { ...app, notesLog: [...app.notesLog, { id: U.uid('NOTE'), text: t, at: ts }], updatedAt: ts } : app,
    );
  }

  function deleteNote(apps, id, noteId, now = new Date()) {
    const ts = now.toISOString();
    return apps.map((app) =>
      app.id === id ? { ...app, notesLog: app.notesLog.filter((n) => n.id !== noteId), updatedAt: ts } : app,
    );
  }

  function clearContact(apps, id, now = new Date()) {
    const ts = now.toISOString();
    return apps.map((app) => (app.id === id ? { ...app, recruiter: { name: '', email: '', phone: '' }, updatedAt: ts } : app));
  }

  /** Converts a record back into flat form values (for the edit form and CSV). */
  function toFormData(app) {
    return {
      company: app.company, jobTitle: app.jobTitle, jobType: app.jobType, location: app.location,
      priority: app.priority, jobUrl: app.jobUrl, salary: app.salary, applicationDate: app.applicationDate,
      deadline: app.deadline, interviewDate: app.interviewDate, status: app.status,
      recruiterName: app.recruiter.name, recruiterEmail: app.recruiter.email, recruiterPhone: app.recruiter.phone,
      followUpDate: app.followUpDate, followUpNote: app.followUpNote, notes: app.notes,
    };
  }

  const hasContact = (app) => Boolean(app.recruiter.name || app.recruiter.email || app.recruiter.phone);
  const isClosed = (app) => CLOSED_STATUSES.includes(app.status);
  const hasReached = (app, status) => app.status === status || app.statusHistory.some((h) => h.status === status);
  const getById = (apps, id) => apps.find((a) => a.id === id) || null;

  /**
   * Validates and repairs a record loaded from storage or an import.
   * Returns null when the record is unusable (missing required fields).
   */
  function normalizeRecord(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    let id = null;
    if (typeof raw.id === 'string' && raw.id.trim()) id = raw.id.trim().slice(0, 80);
    else if (typeof raw.id === 'number' && Number.isFinite(raw.id)) id = String(raw.id);
    if (!id) return null;

    const rec = raw.recruiter && typeof raw.recruiter === 'object'
      ? raw.recruiter
      : { name: raw.recruiterName, email: raw.recruiterEmail, phone: raw.recruiterPhone };
    const f = buildFields({ ...raw, recruiterName: rec.name, recruiterEmail: rec.email, recruiterPhone: rec.phone });

    if (!f.company || !f.jobTitle || !U.isValidISODate(f.applicationDate) || !STATUSES.includes(raw.status)) return null;
    ['deadline', 'interviewDate', 'followUpDate'].forEach((k) => {
      if (f[k] && !U.isValidISODate(f[k])) f[k] = '';
    });

    const createdAt = U.validTimestamp(raw.createdAt) || new Date(`${f.applicationDate}T09:00:00`).toISOString();
    const updatedAt = U.validTimestamp(raw.updatedAt) || createdAt;

    const statusHistory = (Array.isArray(raw.statusHistory) ? raw.statusHistory : [])
      .filter((h) => h && STATUSES.includes(h.status) && U.validTimestamp(h.at))
      .map((h) => ({ status: h.status, at: U.validTimestamp(h.at) }))
      .sort((a, b) => a.at.localeCompare(b.at));
    if (!statusHistory.length || statusHistory[statusHistory.length - 1].status !== f.status) {
      statusHistory.push({ status: f.status, at: statusHistory.length ? updatedAt : createdAt });
    }

    const followUpLog = (Array.isArray(raw.followUpLog) ? raw.followUpLog : [])
      .filter((e) => e && U.validTimestamp(e.completedAt))
      .map((e) => ({
        date: U.isValidISODate(e.date) ? e.date : U.localDateOf(e.completedAt),
        completedAt: U.validTimestamp(e.completedAt),
        note: clean(e.note, LIMITS.note),
      }));

    const notesLog = (Array.isArray(raw.notesLog) ? raw.notesLog : [])
      .filter((n) => n && typeof n.text === 'string' && n.text.trim() && U.validTimestamp(n.at))
      .map((n) => ({ id: typeof n.id === 'string' && n.id ? n.id : U.uid('NOTE'), text: clean(n.text, LIMITS.note), at: U.validTimestamp(n.at) }));

    return {
      id,
      ...f,
      followUpCompleted: Boolean(raw.followUpCompleted) && Boolean(f.followUpDate),
      statusHistory,
      followUpLog,
      notesLog,
      createdAt,
      updatedAt,
    };
  }

  /** Normalises a list, dropping invalid records and fixing duplicate ids. */
  function normalizeAll(list) {
    const seen = new Set();
    const records = [];
    let invalid = 0;
    (Array.isArray(list) ? list : []).forEach((raw) => {
      const rec = normalizeRecord(raw);
      if (!rec) { invalid += 1; return; }
      if (seen.has(rec.id)) rec.id = U.uid('APP');
      seen.add(rec.id);
      records.push(rec);
    });
    return { records, invalid };
  }

  /**
   * Illustrative demo data, positioned relative to today so the demo always
   * shows overdue, due-today and upcoming follow-ups. Companies, people and
   * links are fictional.
   */
  function buildSampleApplications(now = new Date()) {
    const today = U.todayISO(now);
    const day = (n) => U.addDays(today, n);
    const at = (n, hour = 10, min = 15) => {
      const d = U.parseISODate(day(n));
      d.setHours(hour, min, 0, 0);
      const cap = now.getTime() - 5 * 60000;
      return new Date(Math.min(d.getTime(), cap)).toISOString();
    };

    const seeds = [
      {
        id: 'APP-1001', company: 'Acme Technologies', jobTitle: 'Software Development Intern', jobType: 'Internship',
        location: 'Bengaluru', priority: 'High', salary: '₹40k / month stipend', applied: -12,
        history: [['Applied', -12, 11]], followUp: -2, followUpNote: 'Ask whether the coding round has been scheduled.',
        recruiter: { name: 'Recruiter Example', email: 'recruiter@example.com', phone: '' },
        notes: 'Applied through the company careers page.', notesLog: [['Referral requested from a senior on LinkedIn.', -1, 18]],
      },
      {
        id: 'APP-1002', company: 'Nova Systems', jobTitle: 'Frontend Developer Intern', jobType: 'Internship',
        location: 'Remote', priority: 'High', salary: '₹35k / month', applied: -18, interviewDate: 3,
        history: [['Applied', -18, 9], ['Assessment', -13, 15], ['Interview', -5, 12]], followUp: 1,
        followUpNote: 'Confirm the panel interview slot.',
        recruiter: { name: 'Meera Iyer', email: 'meera.iyer@example.com', phone: '+91 98450 00000' },
        notes: 'Take-home was a React dashboard. Interview is with the platform team.',
        followUpLog: [[-9, -9, 'Thanked them for the assessment link.']],
        notesLog: [['Revise React hooks + accessibility basics.', -5, 20]],
      },
      {
        id: 'APP-1003', company: 'Blue Harbor Labs', jobTitle: 'Data Analyst', jobType: 'Full-time',
        location: 'Hyderabad', priority: 'Medium', salary: '₹8 LPA', applied: -9,
        history: [['Applied', -9, 14]], followUp: 4,
        recruiter: { name: 'Daniel Brooks', email: 'd.brooks@example.com', phone: '' },
        notes: 'SQL + Power BI heavy role.',
      },
      {
        id: 'APP-1004', company: 'Pinecrest Software', jobTitle: 'Junior Backend Engineer', jobType: 'Full-time',
        location: 'Pune', priority: 'High', salary: '₹12 LPA', applied: -30,
        history: [['Applied', -30, 10], ['Assessment', -24, 16], ['Interview', -16, 11], ['Offer', -3, 17]],
        followUp: -4, followUpDone: true, deadline: 5,
        recruiter: { name: 'Arjun Rao', email: 'arjun.rao@example.com', phone: '+91 90000 11111' },
        notes: 'Offer letter received. Reply by the deadline.',
        followUpLog: [[-20, -20, 'Sent thank-you note after assessment.'], [-4, -4, 'Asked about joining date.']],
        notesLog: [['Compare offer with Nova before accepting.', -3, 19]],
      },
      {
        id: 'APP-1005', company: 'Orbit Analytics', jobTitle: 'ML Research Intern', jobType: 'Internship',
        location: 'Chennai', priority: 'Medium', applied: -25,
        history: [['Applied', -25, 10], ['Rejected', -10, 9]], followUp: -8,
        notes: 'Feedback: strengthen statistics fundamentals.',
      },
      {
        id: 'APP-1006', company: 'Ironclad Security', jobTitle: 'Security Analyst Intern', jobType: 'Internship',
        location: 'Remote', priority: 'Low', applied: -3, deadline: 6,
        history: [['Interested', -3, 21]],
        notes: 'Needs a short cover letter. Deadline coming up.',
      },
      {
        id: 'APP-1007', company: 'Lumen Health Tech', jobTitle: 'QA Automation Intern', jobType: 'Internship',
        location: 'Bengaluru', priority: 'Medium', applied: -15,
        history: [['Applied', -15, 12], ['Assessment', -8, 10]], followUp: -1,
        recruiter: { name: 'Sofia Lind', email: 'sofia.lind@example.com', phone: '' },
        notes: 'Selenium + Playwright assessment submitted.',
      },
      {
        id: 'APP-1008', company: 'Northwind Data', jobTitle: 'Business Analyst', jobType: 'Full-time',
        location: 'Mumbai', priority: 'Low', applied: -40,
        history: [['Applied', -40, 10], ['Withdrawn', -20, 13]],
        notes: 'Withdrew — role required relocation.',
      },
      {
        id: 'APP-1009', company: 'Cobalt Robotics', jobTitle: 'Embedded Systems Intern', jobType: 'Internship',
        location: 'Remote', priority: 'Medium', applied: -6,
        history: [['Applied', -6, 16]], followUp: 0, followUpNote: 'Check application portal status.',
      },
      {
        id: 'APP-1010', company: 'Quantum Leaf', jobTitle: 'UI Engineer', jobType: 'Part-time',
        location: 'Remote', priority: 'Medium', applied: -2,
        history: [['Interested', -4, 19], ['Applied', -2, 11]], followUp: 7,
        recruiter: { name: 'Kabir Shah', email: 'kabir@example.com', phone: '' },
      },
      {
        id: 'APP-1011', company: 'Atlas Fintech', jobTitle: 'Software Engineer Trainee', jobType: 'Full-time',
        location: 'Gurugram', priority: 'High', applied: -22,
        history: [['Applied', -22, 10], ['Assessment', -17, 14], ['Rejected', -11, 18]],
        notes: 'Cleared aptitude, missed the DSA cutoff. Practice graphs.',
      },
      {
        id: 'APP-1012', company: 'Maple Cloud', jobTitle: 'DevOps Intern', jobType: 'Internship',
        location: 'Remote', priority: 'Medium', applied: 0,
        history: [['Applied', 0, 9]], followUp: 5,
      },
    ];

    return seeds.map((s) => {
      const statusHistory = s.history.map(([status, n, h]) => ({ status, at: at(n, h) }));
      const createdAt = statusHistory[0].at;
      const updatedAt = statusHistory[statusHistory.length - 1].at;
      const notesLog = (s.notesLog || []).map(([text, n, h], i) => ({ id: `NOTE-${s.id}-${i}`, text, at: at(n, h) }));
      const lastNote = notesLog.length ? notesLog[notesLog.length - 1].at : updatedAt;
      return {
        id: s.id,
        company: s.company,
        jobTitle: s.jobTitle,
        jobType: s.jobType,
        location: s.location || '',
        priority: s.priority,
        jobUrl: `https://example.com/jobs/${s.id.split('-')[1]}`,
        salary: s.salary || '',
        applicationDate: day(s.applied),
        deadline: s.deadline !== undefined ? day(s.deadline) : '',
        interviewDate: s.interviewDate !== undefined ? day(s.interviewDate) : '',
        status: s.history[s.history.length - 1][0],
        recruiter: s.recruiter || { name: '', email: '', phone: '' },
        followUpDate: s.followUp !== undefined ? day(s.followUp) : '',
        followUpNote: s.followUpNote || '',
        followUpCompleted: Boolean(s.followUpDone),
        notes: s.notes || '',
        statusHistory,
        followUpLog: (s.followUpLog || []).map(([d, c, note]) => ({ date: day(d), completedAt: at(c, 17, 30), note })),
        notesLog,
        createdAt,
        updatedAt: lastNote > updatedAt ? lastNote : updatedAt,
      };
    });
  }

  Object.assign(JT, {
    STATUSES, PIPELINE, CLOSED_STATUSES, ACTIVE_STATUSES, JOB_TYPES, PRIORITIES, STATUS_META, PRIORITY_META,
  });

  JT.applications = {
    buildFields, createApplication, updateApplication, updateApplicationStatus, deleteApplication,
    addNote, deleteNote, clearContact, toFormData, hasContact, isClosed, hasReached, getById,
    normalizeRecord, normalizeAll, buildSampleApplications,
  };
})(globalThis.JT = globalThis.JT || {});
