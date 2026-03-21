/**
 * guard.js — Notiv instant auth guard
 * Add as the FIRST script in <head> on every protected page:
 * <script src="guard.js"></script>   ← no defer, no async
 *
 * Reads the Supabase session from localStorage synchronously.
 * Redirects to login instantly — before the page renders — so
 * there's no flash and the back button can't bypass it.
 */
(function () {
  // Pages that never need a guard
  var page = location.pathname.split('/').pop() || '';
  var pub = ['login.html', 'onboarding.html', 'landing.html', 'index.html', ''];
  if (pub.indexOf(page) !== -1) return;

  // Supabase stores the session under this key pattern
  var PROJECT_REF = 'uorlszhcjrblrbmhgyqb';
  var KEY = 'sb-' + PROJECT_REF + '-auth-token';

  var raw = null;
  try { raw = localStorage.getItem(KEY); } catch (e) { return; }

  if (!raw) {
    // No session — redirect immediately
    var redirect = encodeURIComponent(location.href);
    location.replace('https://sn8k3.github.io/tools/login.html?redirect=' + redirect);
    return;
  }

  // Token exists — check it's not expired
  try {
    var token = JSON.parse(raw);
    var exp = token.expires_at || (token.access_token && JSON.parse(atob(token.access_token.split('.')[1])).exp);
    if (exp && Math.floor(Date.now() / 1000) > exp) {
      // Expired — redirect
      var redirect = encodeURIComponent(location.href);
      location.replace('https://sn8k3.github.io/tools/login.html?redirect=' + redirect);
    }
    // Valid session — allow page to load normally
  } catch (e) {
    // Can't parse token — redirect to be safe
    var redirect = encodeURIComponent(location.href);
    location.replace('https://sn8k3.github.io/tools/login.html?redirect=' + redirect);
  }
})();
