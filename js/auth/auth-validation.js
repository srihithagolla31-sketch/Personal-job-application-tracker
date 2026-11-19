/**
 * auth-validation.js: field rules for the sign-in, sign-up and reset forms.
 * Pure functions with no DOM access, shared by the UI and the unit tests.
 * Each validator returns an object of { field: message } for invalid fields.
 */
(function (JT) {
  'use strict';

  const LIMITS = { nameMin: 2, nameMax: 60, emailMax: 254, passwordMin: 8, passwordMax: 128 };

  const MESSAGES = {
    nameRequired: 'Enter your name.',
    nameShort: `Name must be at least ${LIMITS.nameMin} characters.`,
    nameLong: `Name must be ${LIMITS.nameMax} characters or fewer.`,
    emailRequired: 'Enter your email address.',
    emailInvalid: 'Enter a valid email address, like name@example.com.',
    passwordRequired: 'Enter your password.',
    passwordShort: `Use at least ${LIMITS.passwordMin} characters.`,
    passwordLong: `Use ${LIMITS.passwordMax} characters or fewer.`,
    passwordWeak: 'Include at least one letter and one number.',
    confirmRequired: 'Confirm your password.',
    confirmMismatch: 'Passwords do not match.',
  };

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const str = (v) => (typeof v === 'string' ? v : '');
  const normalizeEmail = (email) => str(email).trim().toLowerCase();

  function checkEmail(value) {
    const email = str(value).trim();
    if (!email) return MESSAGES.emailRequired;
    if (email.length > LIMITS.emailMax || !EMAIL_RE.test(email)) return MESSAGES.emailInvalid;
    return '';
  }

  function checkNewPassword(value) {
    const pw = str(value);
    if (!pw) return MESSAGES.passwordRequired;
    if (pw.length < LIMITS.passwordMin) return MESSAGES.passwordShort;
    if (pw.length > LIMITS.passwordMax) return MESSAGES.passwordLong;
    if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return MESSAGES.passwordWeak;
    return '';
  }

  function checkName(value) {
    const name = str(value).trim();
    if (!name) return MESSAGES.nameRequired;
    if (name.length < LIMITS.nameMin) return MESSAGES.nameShort;
    if (name.length > LIMITS.nameMax) return MESSAGES.nameLong;
    return '';
  }

  const collect = (pairs) => Object.fromEntries(pairs.filter(([, msg]) => msg));

  function validateSignIn({ email, password } = {}) {
    return collect([
      ['email', checkEmail(email)],
      ['password', str(password) ? '' : MESSAGES.passwordRequired],
    ]);
  }

  function validateSignUp({ name, email, password, confirm } = {}) {
    let confirmMsg = '';
    if (!str(confirm)) confirmMsg = MESSAGES.confirmRequired;
    else if (str(confirm) !== str(password)) confirmMsg = MESSAGES.confirmMismatch;
    return collect([
      ['name', checkName(name)],
      ['email', checkEmail(email)],
      ['password', checkNewPassword(password)],
      ['confirm', confirmMsg],
    ]);
  }

  function validateReset({ email } = {}) {
    return collect([['email', checkEmail(email)]]);
  }

  /**
   * Only same-app hash routes are allowed as a post-login destination,
   * and never the auth screens themselves.
   */
  function safeNext(next) {
    const value = str(next);
    if (!/^#\/[A-Za-z0-9/_\-%.?=&]*$/.test(value)) return '#/dashboard';
    if (/^#\/(login|signup|forgot-password)\b/.test(value)) return '#/dashboard';
    return value;
  }

  JT.authValidation = {
    LIMITS, MESSAGES, normalizeEmail, checkEmail, checkName, checkNewPassword,
    validateSignIn, validateSignUp, validateReset, safeNext,
  };
})(globalThis.JT = globalThis.JT || {});
