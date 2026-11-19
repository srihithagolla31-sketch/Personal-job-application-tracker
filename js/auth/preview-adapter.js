/**
 * preview-adapter.js: a LOCAL PREVIEW auth adapter for use until a real
 * authentication backend is connected.
 *
 * What it does:
 *   - keeps accounts and the current session in this browser's storage
 *   - stores a salted PBKDF2 hash of the password (never the password itself)
 *     so the sign-in form can show realistic "wrong password" errors
 *
 * What it does NOT do (and must not be presented as doing):
 *   - it is not a security boundary: anyone with access to this browser or its
 *     developer tools can read or change the stored data
 *   - it does not sync accounts between browsers or devices
 *   - it does not send password-reset emails
 *
 * Replace it with a real adapter before treating accounts as secure.
 * See js/auth/auth-service.js for the adapter contract.
 */
(function (JT) {
  'use strict';

  const KEYS = { accounts: 'jobtracker_auth_preview_accounts', session: 'jobtracker_auth_preview_session' };
  const ITERATIONS = 120000;

  const fail = (code, message) => ({ ok: false, error: { code, message } });

  const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const fromHex = (hex) => new Uint8Array(hex.match(/.{2}/g).map((h) => parseInt(h, 16)));

  function createPreviewAdapter({
    local = globalThis.localStorage,
    session: sessionStore = globalThis.sessionStorage,
    cryptoImpl = globalThis.crypto,
    now = () => new Date(),
  } = {}) {
    const V = JT.authValidation;

    const read = (store, key) => {
      try { return JSON.parse(store.getItem(key)); } catch (_) { return null; }
    };
    const write = (store, key, value) => {
      try { store.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; }
    };
    const remove = (store, key) => { try { store.removeItem(key); } catch (_) { /* ignore */ } };

    const accounts = () => {
      const a = read(local, KEYS.accounts);
      return a && typeof a === 'object' && !Array.isArray(a) ? a : {};
    };

    const subtle = cryptoImpl && cryptoImpl.subtle;

    async function hashPassword(password, saltHex) {
      const enc = new TextEncoder();
      const key = await subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
      const bits = await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations: ITERATIONS }, key, 256);
      return toHex(bits);
    }

    /** Constant-time comparison of two hex strings of equal length. */
    function sameHash(a, b) {
      if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
      let diff = 0;
      for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
      return diff === 0;
    }

    function makeSession(account) {
      return { user: { id: account.id, name: account.name, email: account.email }, issuedAt: now().toISOString() };
    }

    function persistSession(s, remember) {
      remove(local, KEYS.session);
      remove(sessionStore, KEYS.session);
      return write(remember ? local : sessionStore, KEYS.session, s);
    }

    function unsupported() {
      return fail('unavailable', 'Preview sign-in needs a secure page (https:// or http://localhost). Open the app through a local server, for example with npm start.');
    }

    return {
      id: 'preview',
      isProduction: false,

      async init() {
        const s = read(sessionStore, KEYS.session) || read(local, KEYS.session);
        if (!s || !s.user || !s.user.email) return null;
        // Drop sessions whose account no longer exists in this browser.
        return accounts()[V.normalizeEmail(s.user.email)] ? s : null;
      },

      async signUp({ name, email, password } = {}) {
        if (!subtle) return unsupported();
        const errors = V.validateSignUp({ name, email, password, confirm: password });
        if (errors.name || errors.email) return fail('unknown', errors.name || errors.email);
        if (errors.password) return fail('weak-password', errors.password);
        const key = V.normalizeEmail(email);
        const all = accounts();
        if (all[key]) return fail('email-in-use');
        const salt = toHex(cryptoImpl.getRandomValues(new Uint8Array(16)));
        const account = {
          id: `usr_${toHex(cryptoImpl.getRandomValues(new Uint8Array(8)))}`,
          name: String(name).trim(),
          email: key,
          salt,
          hash: await hashPassword(password, salt),
          createdAt: now().toISOString(),
        };
        all[key] = account;
        if (!write(local, KEYS.accounts, all)) return fail('unavailable', 'This browser blocked saving the account. Check that site storage is allowed.');
        const s = makeSession(account);
        persistSession(s, true);
        return { ok: true, session: s };
      },

      async signIn({ email, password, remember = true } = {}) {
        if (!subtle) return unsupported();
        const account = accounts()[V.normalizeEmail(email)];
        // Hash even when the account is missing so both failures take similar time.
        const salt = account ? account.salt : '00'.repeat(16);
        const hash = await hashPassword(String(password || ''), salt);
        if (!account || !sameHash(hash, account.hash)) return fail('invalid-credentials');
        const s = makeSession(account);
        persistSession(s, remember);
        return { ok: true, session: s };
      },

      async signOut() {
        remove(local, KEYS.session);
        remove(sessionStore, KEYS.session);
        return { ok: true };
      },

      /** Follow sign-in and sign-out from other tabs of this browser. */
      onChange(callback) {
        if (typeof window === 'undefined') return;
        window.addEventListener('storage', (e) => {
          if (e.key !== KEYS.session && e.key !== KEYS.accounts && e.key !== null) return;
          this.init().then(callback);
        });
      },

      async requestPasswordReset() {
        // No email service exists in preview mode. Report honestly that nothing was sent.
        return { ok: true, delivered: false };
      },
    };
  }

  JT.createPreviewAdapter = createPreviewAdapter;
  JT.PREVIEW_AUTH_KEYS = KEYS;
})(globalThis.JT = globalThis.JT || {});
