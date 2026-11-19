/**
 * form-validation.js: field-level validation shared by the form UI,
 * createApplication/updateApplication and CSV/JSON import.
 * Returns a map of { fieldName: friendlyMessage }; empty map = valid.
 */
(function (JT) {
  'use strict';

  const U = JT.utils;
  const str = (v) => (typeof v === 'string' ? v.trim() : '');

  const MESSAGES = {
    summary: 'Please enter the company name, job title, and application date before saving.',
    company: 'Please enter the company name.',
    jobTitle: 'Please enter the job title.',
    applicationDate: 'Please choose the application date.',
    badDate: 'Use a valid date.',
    farFuture: 'That date is more than a year away. Please double-check it.',
    status: 'Choose one of the listed statuses.',
    jobUrl: 'Enter a full link starting with http:// or https://',
    recruiterEmail: 'Enter a valid email, like name@company.com',
    recruiterPhone: 'Use digits, spaces, +, - or brackets (at least 6 digits).',
    followBeforeApplied: 'The follow-up date can’t be before the application date.',
  };

  function validateApplication(data, today = U.todayISO()) {
    const d = data || {};
    const errors = {};

    if (!str(d.company)) errors.company = MESSAGES.company;
    if (!str(d.jobTitle)) errors.jobTitle = MESSAGES.jobTitle;

    const applied = str(d.applicationDate);
    if (!applied) errors.applicationDate = MESSAGES.applicationDate;
    else if (!U.isValidISODate(applied)) errors.applicationDate = MESSAGES.badDate;
    else if (U.diffDays(today, applied) > 365) errors.applicationDate = MESSAGES.farFuture;

    if (!JT.STATUSES.includes(d.status)) errors.status = MESSAGES.status;
    if (str(d.jobUrl) && !U.isValidUrl(d.jobUrl)) errors.jobUrl = MESSAGES.jobUrl;
    if (str(d.recruiterEmail) && !U.isValidEmail(d.recruiterEmail)) errors.recruiterEmail = MESSAGES.recruiterEmail;
    if (str(d.recruiterPhone) && !U.isValidPhone(d.recruiterPhone)) errors.recruiterPhone = MESSAGES.recruiterPhone;

    ['deadline', 'interviewDate', 'followUpDate'].forEach((key) => {
      if (str(d[key]) && !U.isValidISODate(str(d[key]))) errors[key] = MESSAGES.badDate;
    });

    if (!errors.followUpDate && !errors.applicationDate && str(d.followUpDate) && str(d.followUpDate) < applied) {
      errors.followUpDate = MESSAGES.followBeforeApplied;
    }
    return errors;
  }

  function validateFollowUpDate(date) {
    if (!str(date)) return 'Choose a follow-up date.';
    if (!U.isValidISODate(str(date))) return MESSAGES.badDate;
    return '';
  }

  JT.validation = { validateApplication, validateFollowUpDate, MESSAGES };
})(globalThis.JT = globalThis.JT || {});
