/**
 * filters.js — search, filter and sort (PRD §6.1-F). Pure functions.
 */
(function (JT) {
  'use strict';

  const SORTS = {
    updated: { label: 'Last updated', fn: (a, b) => b.updatedAt.localeCompare(a.updatedAt) },
    'applied-desc': { label: 'Applied (newest)', fn: (a, b) => b.applicationDate.localeCompare(a.applicationDate) || b.updatedAt.localeCompare(a.updatedAt) },
    'applied-asc': { label: 'Applied (oldest)', fn: (a, b) => a.applicationDate.localeCompare(b.applicationDate) },
    company: { label: 'Company (A–Z)', fn: (a, b) => a.company.localeCompare(b.company, undefined, { sensitivity: 'base' }) },
    followup: {
      label: 'Follow-up date',
      fn: (a, b) => {
        if (!a.followUpDate && !b.followUpDate) return 0;
        if (!a.followUpDate) return 1;
        if (!b.followUpDate) return -1;
        return a.followUpDate.localeCompare(b.followUpDate);
      },
    },
    priority: {
      label: 'Priority',
      fn: (a, b) => JT.PRIORITIES.indexOf(a.priority) - JT.PRIORITIES.indexOf(b.priority) || b.updatedAt.localeCompare(a.updatedAt),
    },
  };

  const DEFAULT_FILTERS = { query: '', status: 'all', jobType: 'all', priority: 'all' };

  /** Drops invalid filter values but keeps the valid ones (PRD §11 "partial"). */
  function sanitizeFilters(input = {}) {
    const out = { ...DEFAULT_FILTERS };
    const invalid = [];
    if (typeof input.query === 'string') out.query = input.query.slice(0, 100);
    const check = (key, allowed) => {
      if (input[key] === undefined || input[key] === 'all') return;
      if (allowed.includes(input[key])) out[key] = input[key];
      else invalid.push(key);
    };
    check('status', [...JT.STATUSES, 'active']);
    check('jobType', JT.JOB_TYPES);
    check('priority', JT.PRIORITIES);
    return { filters: out, invalid };
  }

  function searchApplications(apps, query) {
    const terms = String(query || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!terms.length) return apps;
    return apps.filter((a) => {
      const haystack = `${a.company} ${a.jobTitle} ${a.recruiter.name} ${a.location}`.toLowerCase();
      return terms.every((t) => haystack.includes(t));
    });
  }

  function filterApplications(apps, filters = {}) {
    const f = { ...DEFAULT_FILTERS, ...filters };
    let list = searchApplications(apps, f.query);
    if (f.status === 'active') list = list.filter((a) => JT.ACTIVE_STATUSES.includes(a.status));
    else if (f.status !== 'all') list = list.filter((a) => a.status === f.status);
    if (f.jobType !== 'all') list = list.filter((a) => a.jobType === f.jobType);
    if (f.priority !== 'all') list = list.filter((a) => a.priority === f.priority);
    return list;
  }

  function sortApplications(apps, key = 'updated') {
    const sorter = (SORTS[key] || SORTS.updated).fn;
    return [...apps].sort(sorter);
  }

  const hasActiveFilters = (f) => Boolean(f.query) || f.status !== 'all' || f.jobType !== 'all' || f.priority !== 'all';

  JT.filters = { SORTS, DEFAULT_FILTERS, sanitizeFilters, searchApplications, filterApplications, sortApplications, hasActiveFilters };
})(globalThis.JT = globalThis.JT || {});
