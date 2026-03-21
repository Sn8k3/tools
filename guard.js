/**
 * guard.js — Notiv instant auth guard
 * Add as the FIRST script in <head> on every protected page (no defer/async).
 * Reads Supabase session from localStorage synchronously.
 */
(function () {
  var page = location.pathname.split('/').pop() || '';
  var pub = ['login.html', 'onboarding.html', 'landing.html', 'index.html', ''];
  if (pub.indexOf(page) !== -1) return;

  var PROJECT_REF = 'uorlszhcjrblrbmhgyqb';
  var KEY = 'sb-' + PROJECT_REF + '-auth-token';

  var raw = null;
  try { raw = localStorage.getItem(KEY); } catch (e) { return; }

  if (!raw) {
    location.replace('https://sn8k3.github.io/tools/login.html?redirect=' + encodeURIComponent(location.href));
    return;
  }

  try {
    var data = JSON.parse(raw);
    // Supabase may nest session data — handle both formats
    var token = data;
    if (data.access_token === undefined && data.session) token = data.session;
    if (data.access_token === undefined && data.currentSession) token = data.currentSession;

    // Try to get expiry from expires_at, or decode the JWT
    var exp = token.expires_at;
    if (!exp && token.access_token) {
      try {
        var parts = token.access_token.split('.');
        if (parts.length === 3) {
          var payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
          exp = payload.exp;
        }
      } catch (e) {}
    }

    // If we have an expiry and it's in the past, redirect
    if (exp && Math.floor(Date.now() / 1000) > Number(exp)) {
      location.replace('https://sn8k3.github.io/tools/login.html?redirect=' + encodeURIComponent(location.href));
      return;
    }

    // If we couldn't find an access_token at all, still let them through
    // auth.js will do a proper session check and show the modal if needed
  } catch (e) {
    // Can't parse — redirect to login
    location.replace('https://sn8k3.github.io/tools/login.html?redirect=' + encodeURIComponent(location.href));
  }
})();
