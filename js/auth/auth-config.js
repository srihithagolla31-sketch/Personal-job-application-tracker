/**
 * auth-config.js: choose which authentication adapter the app uses.
 *
 * Today this registers the local preview adapter, which is clearly labelled in
 * the UI as "no backend connected". When the real provider is decided, add an
 * adapter file (see the contract in auth-service.js), load it in index.html
 * before this file, and register it here instead, for example:
 *
 *   JT.auth.use(JT.createMyApiAdapter({ baseUrl: 'https://api.example.com' }));
 *
 * Nothing else in the app needs to change.
 */
(function (JT) {
  'use strict';

  JT.auth.use(JT.createPreviewAdapter());
})(globalThis.JT = globalThis.JT || {});
