/**
 * auth-service.js: the single entry point the app uses for authentication.
 *
 * The app never talks to a provider directly. It calls JT.auth, and JT.auth
 * forwards to whichever adapter is registered. To connect a real backend
 * (your own API, Firebase, Supabase, Auth0, Clerk, Cognito, ...), write an
 * adapter with the methods below and register it in js/auth/auth-config.js.
 *
 * Adapter contract (every method returns a Promise):
 *   id                      string, e.g. 'preview', 'firebase', 'custom-api'
 *   isProduction            boolean, false for anything that is not a real backend
 *   init()                  -> Session | null      restore an existing session
 *   signIn({ email, password, remember })   -> Result
 *   signUp({ name, email, password })        -> Result
 *   signOut()               -> Result
 *   requestPasswordReset({ email })          -> Result & { delivered: boolean }
 *   onChange(callback)      optional; call callback(Session | null) when the
 *                           provider changes the session (expiry, other tab)
 *
 * Session: { user: { id, name, email }, issuedAt }
 * Result:  { ok: true, session? } | { ok: false, error: { code, message } }
 *
 * Error codes the UI understands: invalid-credentials, email-in-use,
 * weak-password, rate-limited, network, unavailable, unknown.
 */
(function (JT) {
  'use strict';

  const FALLBACK_MESSAGES = {
    'invalid-credentials': 'Email or password is incorrect.',
    'email-in-use': 'An account with this email already exists. Sign in instead.',
    'weak-password': 'Choose a stronger password.',
    'rate-limited': 'Too many attempts. Wait a moment and try again.',
    network: 'We could not reach the server. Check your connection and try again.',
    unavailable: 'Sign-in is not available right now.',
    unknown: 'Something went wrong. Please try again.',
  };

  let adapter = null;
  let session = null;
  let ready = false;
  const listeners = new Set();

  function setSession(next) {
    session = next && next.user ? next : null;
    listeners.forEach((fn) => { try { fn(session); } catch (err) { console.error(err); } });
  }

  function normalizeError(err) {
    const code = (err && err.code && FALLBACK_MESSAGES[err.code]) ? err.code : 'unknown';
    return { code, message: (err && err.message) || FALLBACK_MESSAGES[code] };
  }

  /** Wraps every adapter call so a thrown error or a rejected promise becomes a Result. */
  async function call(method, payload) {
    if (!adapter || typeof adapter[method] !== 'function') {
      return { ok: false, error: normalizeError({ code: 'unavailable' }) };
    }
    try {
      const res = await adapter[method](payload);
      if (res && res.ok) return res;
      return { ok: false, error: normalizeError(res && res.error) };
    } catch (err) {
      console.error(`[auth] ${method} failed`, err);
      return { ok: false, error: normalizeError(err && err.code ? err : { code: 'unknown' }) };
    }
  }

  function use(nextAdapter) {
    adapter = nextAdapter;
    ready = false;
    session = null;
  }

  async function init() {
    if (!adapter) { ready = true; return null; }
    try {
      setSession(await adapter.init());
    } catch (err) {
      console.error('[auth] could not restore session', err);
      setSession(null);
    }
    if (typeof adapter.onChange === 'function') adapter.onChange((s) => setSession(s));
    ready = true;
    return session;
  }

  async function signIn(payload) {
    const res = await call('signIn', payload);
    if (res.ok) setSession(res.session);
    return res;
  }

  async function signUp(payload) {
    const res = await call('signUp', payload);
    if (res.ok) setSession(res.session || null);
    return res;
  }

  async function signOut() {
    const res = await call('signOut');
    // Clear the local view of the session even if the provider call failed,
    // so the user is never left looking at protected screens.
    setSession(null);
    return res;
  }

  const requestPasswordReset = (payload) => call('requestPasswordReset', payload);

  JT.auth = {
    use, init, signIn, signUp, signOut, requestPasswordReset,
    getSession: () => session,
    getUser: () => (session ? session.user : null),
    isSignedIn: () => Boolean(session),
    isReady: () => ready,
    mode: () => (adapter ? adapter.id : 'none'),
    isProduction: () => Boolean(adapter && adapter.isProduction),
    onChange: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    FALLBACK_MESSAGES,
  };
})(globalThis.JT = globalThis.JT || {});
