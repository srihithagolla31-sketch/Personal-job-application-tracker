/**
 * auth-ui.js: sign-in, sign-up and forgot-password screens.
 * Renders markup for the router, validates fields inline and calls JT.auth.
 * It knows nothing about the provider behind JT.auth.
 */
(function (JT) {
  'use strict';

  const esc = (s) => JT.utils.escapeHtml(s);
  const $ = (sel, root = document) => root.querySelector(sel);
  const V = () => JT.authValidation;

  const ROUTES = {
    login: { title: 'Sign in' },
    signup: { title: 'Create account' },
    'forgot-password': { title: 'Reset password' },
  };

  const NOTICES = {
    'signed-out': { tone: 'success', icon: 'bi-check-circle', text: 'You have been signed out.' },
    'session-ended': { tone: 'info', icon: 'bi-info-circle', text: 'Your session ended. Sign in again to continue.' },
    created: { tone: 'success', icon: 'bi-check-circle', text: 'Account created. Check your email to confirm it, then sign in.' },
  };

  let opts = { toast: () => {} };
  let busy = false;

  const isAuthRoute = (name) => Object.prototype.hasOwnProperty.call(ROUTES, name);
  const titleFor = (name) => (ROUTES[name] ? ROUTES[name].title : '');

  /* ---------- Markup ---------- */

  const logo = `<svg class="logo-svg" viewBox="0 0 40 40" width="32" height="32" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="38" height="38" rx="11" fill="#0b0d16" stroke="rgba(255,255,255,.28)"/>
      <path d="M7.5 32.5 H32.5" stroke="#fff" stroke-opacity=".35" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M9 28 L16.5 20.5 L23 24 L29.5 14" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="9" cy="28" r="2.7" fill="#fff"/><circle cx="16.5" cy="20.5" r="2.7" fill="#fff"/><circle cx="23" cy="24" r="2.7" fill="#fff"/>
      <g transform="translate(29.5 12)"><path d="M0 -5.6 L1.44 -1.98 L5.33 -1.73 L2.33 0.76 L3.29 4.53 L0 2.45 L-3.29 4.53 L-2.33 0.76 L-5.33 -1.73 L-1.44 -1.98Z" fill="#f2b544" stroke="#1e40af" stroke-width=".6" stroke-linejoin="round"/></g>
    </svg>`;

  function alertBox({ tone, icon, text, html = false }) {
    return `<div class="alert alert-${tone} d-flex gap-2 align-items-start mb-3" role="${tone === 'danger' ? 'alert' : 'status'}">
      <i class="bi ${icon}" aria-hidden="true"></i><div>${html ? text : esc(text)}</div></div>`;
  }

  function field({ id, name, label, type = 'text', autocomplete, hint = '', extraLabel = '', inputmode = '' }) {
    const describedBy = [`${id}-error`, hint ? `${id}-hint` : ''].filter(Boolean).join(' ');
    const input = `<input id="${id}" name="${name}" type="${type}" class="form-control" autocomplete="${autocomplete}"
        ${inputmode ? `inputmode="${inputmode}"` : ''} aria-describedby="${describedBy}" spellcheck="false" required>`;
    const control = type === 'password'
      ? `<div class="pw-field">${input}<button type="button" class="pw-toggle" data-auth-action="toggle-password" data-target="${id}" aria-label="Show password" aria-pressed="false"><i class="bi bi-eye" aria-hidden="true"></i></button></div>`
      : input;
    return `<div class="mb-3">
      <label class="form-label" for="${id}"><span>${esc(label)}</span>${extraLabel}</label>
      ${control}
      ${hint ? `<div class="form-text" id="${id}-hint">${esc(hint)}</div>` : ''}
      <div class="invalid-feedback" id="${id}-error"></div>
    </div>`;
  }

  function previewNote() {
    if (JT.auth.isProduction()) return '';
    return `<p class="auth-note"><i class="bi bi-info-circle" aria-hidden="true"></i>
      <span><b>Preview mode.</b> No authentication server is connected yet. Accounts are stored only in this browser and do not provide real security.</span></p>`;
  }

  function shell({ title, sub, body, footer }) {
    return `<div class="auth-wrap">
      <a class="auth-brand" href="#/login" aria-label="JobTrack">${logo}<span class="wordmark">Job<b>Track</b></span></a>
      <h1 class="auth-title">${esc(title)}</h1>
      <p class="auth-sub">${esc(sub)}</p>
      <div class="panel auth-panel">${body}</div>
      ${footer}
      ${previewNote()}
    </div>`;
  }

  function loginView(query) {
    const notice = NOTICES[query.get('notice')];
    const next = V().safeNext(query.get('next') || '');
    return shell({
      title: 'Sign in',
      sub: 'Use your JobTrack account to continue.',
      body: `<form data-auth-form="login" novalidate data-next="${esc(next)}">
        <div data-auth-status>${notice ? alertBox(notice) : ''}</div>
        ${field({ id: 'auth-email', name: 'email', label: 'Email', type: 'email', autocomplete: 'email', inputmode: 'email' })}
        ${field({ id: 'auth-password', name: 'password', label: 'Password', type: 'password', autocomplete: 'current-password', extraLabel: '<a href="#/forgot-password">Forgot password?</a>' })}
        <div class="form-check mb-3">
          <input class="form-check-input" type="checkbox" id="auth-remember" name="remember" checked>
          <label class="form-check-label small" for="auth-remember">Keep me signed in on this device</label>
        </div>
        <button type="submit" class="btn btn-primary" data-label="Sign in" data-busy-label="Signing in">Sign in</button>
      </form>`,
      footer: '<p class="auth-switch">New to JobTrack? <a href="#/signup">Create an account</a></p>',
    });
  }

  function signupView() {
    return shell({
      title: 'Create your account',
      sub: 'Track applications, follow-ups and recruiter contacts in one place.',
      body: `<form data-auth-form="signup" novalidate>
        <div data-auth-status></div>
        ${field({ id: 'auth-name', name: 'name', label: 'Full name', autocomplete: 'name' })}
        ${field({ id: 'auth-email', name: 'email', label: 'Email', type: 'email', autocomplete: 'email', inputmode: 'email' })}
        ${field({ id: 'auth-password', name: 'password', label: 'Password', type: 'password', autocomplete: 'new-password', hint: 'At least 8 characters, including a letter and a number.' })}
        ${field({ id: 'auth-confirm', name: 'confirm', label: 'Confirm password', type: 'password', autocomplete: 'new-password' })}
        <button type="submit" class="btn btn-primary" data-label="Create account" data-busy-label="Creating account">Create account</button>
      </form>`,
      footer: '<p class="auth-switch">Already have an account? <a href="#/login">Sign in</a></p>',
    });
  }

  function forgotView() {
    return shell({
      title: 'Reset your password',
      sub: 'Enter the email you signed up with and we will send you a link to reset your password.',
      body: `<form data-auth-form="forgot" novalidate>
        <div data-auth-status></div>
        ${field({ id: 'auth-email', name: 'email', label: 'Email', type: 'email', autocomplete: 'email', inputmode: 'email' })}
        <button type="submit" class="btn btn-primary" data-label="Send reset link" data-busy-label="Sending">Send reset link</button>
      </form>`,
      footer: '<p class="auth-switch"><a href="#/login"><i class="bi bi-arrow-left" aria-hidden="true"></i> Back to sign in</a></p>',
    });
  }

  function render(name, query = new URLSearchParams()) {
    if (name === 'signup') return signupView();
    if (name === 'forgot-password') return forgotView();
    return loginView(query);
  }

  /** Called by the router after the auth screen is in the DOM. */
  function afterRender(root) {
    busy = false;
    const first = root.querySelector('[data-auth-form] input:not([type="checkbox"])');
    if (first) first.focus({ preventScroll: true });
  }

  /* ---------- Validation display ---------- */

  const FIELD_IDS = { name: 'auth-name', email: 'auth-email', password: 'auth-password', confirm: 'auth-confirm' };

  function readForm(form) {
    const get = (n) => (form.elements[n] ? form.elements[n].value : '');
    return {
      name: get('name'), email: get('email'), password: get('password'), confirm: get('confirm'),
      remember: form.elements.remember ? form.elements.remember.checked : true,
    };
  }

  function validatorFor(kind) {
    if (kind === 'signup') return V().validateSignUp;
    if (kind === 'forgot') return V().validateReset;
    return V().validateSignIn;
  }

  function setFieldError(name, msg) {
    const input = document.getElementById(FIELD_IDS[name]);
    const fb = document.getElementById(`${FIELD_IDS[name]}-error`);
    if (!input || !fb) return;
    fb.innerHTML = msg || '';
    input.classList.toggle('is-invalid', Boolean(msg));
    if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
  }

  function showErrors(form, errors) {
    Object.keys(FIELD_IDS).forEach((k) => { if (form.elements[k]) setFieldError(k, errors[k] ? esc(errors[k]) : ''); });
  }

  function setStatus(form, html) {
    const box = form.querySelector('[data-auth-status]');
    if (box) box.innerHTML = html;
  }

  function setBusy(form, on) {
    busy = on;
    const btn = form.querySelector('button[type="submit"]');
    form.setAttribute('aria-busy', String(on));
    if (!btn) return;
    btn.disabled = on;
    btn.innerHTML = on
      ? `<span class="spinner-border" role="status" aria-hidden="true"></span><span>${esc(btn.dataset.busyLabel)}…</span>`
      : esc(btn.dataset.label);
  }

  function errorAlert(error) {
    return alertBox({ tone: 'danger', icon: 'bi-exclamation-circle', text: error.message });
  }

  /* ---------- Submit handlers ---------- */

  async function submitLogin(form, data) {
    const res = await JT.auth.signIn({ email: data.email.trim(), password: data.password, remember: data.remember });
    if (!document.body.contains(form)) return;
    if (!res.ok) {
      setBusy(form, false);
      setStatus(form, errorAlert(res.error));
      if (res.error.code === 'invalid-credentials') {
        form.elements.password.value = '';
        form.elements.password.focus();
      }
      return;
    }
    opts.toast(`Signed in as ${res.session.user.name || res.session.user.email}.`, 'success');
    window.location.hash = V().safeNext(form.dataset.next);
  }

  async function submitSignup(form, data) {
    const res = await JT.auth.signUp({ name: data.name.trim(), email: data.email.trim(), password: data.password });
    if (!document.body.contains(form)) return;
    if (!res.ok) {
      setBusy(form, false);
      if (res.error.code === 'email-in-use') {
        setFieldError('email', `${esc(res.error.message)} <a href="#/login">Go to sign in</a>`);
        form.elements.email.focus();
        setStatus(form, '');
      } else if (res.error.code === 'weak-password') {
        setFieldError('password', esc(res.error.message));
        form.elements.password.focus();
      } else {
        setStatus(form, errorAlert(res.error));
      }
      return;
    }
    if (typeof opts.onSignedUp === 'function') opts.onSignedUp(res.session ? res.session.user : { name: data.name.trim() });
    if (res.session) {
      opts.toast(`Account created. Welcome, ${res.session.user.name}.`, 'success');
      window.location.hash = '#/dashboard';
    } else {
      // Providers that require email confirmation return no session yet.
      window.location.hash = '#/login?notice=created';
    }
  }

  async function submitForgot(form, data) {
    const email = data.email.trim();
    const res = await JT.auth.requestPasswordReset({ email });
    if (!document.body.contains(form)) return;
    setBusy(form, false);
    if (!res.ok) { setStatus(form, errorAlert(res.error)); return; }
    const body = res.delivered === false
      ? alertBox({ tone: 'info', icon: 'bi-info-circle', html: true, text: '<b>No email was sent.</b> Password reset needs a connected authentication server, which this app does not have yet. In preview mode you can create a new account instead.' })
      : alertBox({ tone: 'success', icon: 'bi-envelope-check', html: true, text: `If an account exists for <b>${esc(email)}</b>, a password reset link is on its way. Check your inbox and spam folder.` });
    form.innerHTML = `${body}<a class="btn btn-outline-secondary w-100" href="#/login">Back to sign in</a>`;
    const link = form.querySelector('a.btn');
    if (link) link.focus();
  }

  async function onSubmit(e) {
    const form = e.target.closest('[data-auth-form]');
    if (!form) return;
    e.preventDefault();
    if (busy) return;
    const kind = form.dataset.authForm;
    const data = readForm(form);
    const errors = validatorFor(kind)(data);
    showErrors(form, errors);
    setStatus(form, '');
    const firstBad = Object.keys(FIELD_IDS).find((k) => errors[k] && form.elements[k]);
    if (firstBad) {
      form.elements[firstBad].focus();
      JT.fx.shake(form.closest('.auth-panel'));
      return;
    }
    setBusy(form, true);
    try {
      if (kind === 'login') await submitLogin(form, data);
      else if (kind === 'signup') await submitSignup(form, data);
      else await submitForgot(form, data);
    } catch (err) {
      console.error(err);
      setBusy(form, false);
      setStatus(form, errorAlert({ message: JT.auth.FALLBACK_MESSAGES.unknown }));
    }
  }

  /** Re-check a field when the user leaves it, and clear an error as soon as it is fixed. */
  function revalidate(e, { onlyIfInvalid }) {
    const input = e.target;
    const form = input.closest && input.closest('[data-auth-form]');
    if (!form || !input.name || !FIELD_IDS[input.name]) return;
    if (onlyIfInvalid && !input.classList.contains('is-invalid')) return;
    if (!onlyIfInvalid && !input.value && !input.classList.contains('is-invalid')) return;
    const errors = validatorFor(form.dataset.authForm)(readForm(form));
    setFieldError(input.name, errors[input.name] ? esc(errors[input.name]) : '');
    // Keep "confirm password" in step with the password field.
    if (input.name === 'password' && form.elements.confirm && form.elements.confirm.value) {
      setFieldError('confirm', errors.confirm ? esc(errors.confirm) : '');
    }
  }

  function onClick(e) {
    const btn = e.target.closest('[data-auth-action="toggle-password"]');
    if (!btn) return;
    const input = document.getElementById(btn.dataset.target);
    if (!input) return;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.setAttribute('aria-pressed', String(show));
    btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    btn.innerHTML = `<i class="bi ${show ? 'bi-eye-slash' : 'bi-eye'}" aria-hidden="true"></i>`;
  }

  function init(options = {}) {
    opts = { ...opts, ...options };
    document.addEventListener('submit', onSubmit);
    document.addEventListener('click', onClick);
    document.addEventListener('focusout', (e) => revalidate(e, { onlyIfInvalid: false }));
    document.addEventListener('input', (e) => revalidate(e, { onlyIfInvalid: true }));
  }

  JT.authUI = { init, render, afterRender, isAuthRoute, titleFor, logo };
})(globalThis.JT = globalThis.JT || {});
