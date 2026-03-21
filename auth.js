// ── Notiv Auth & Sync Module v2 ──
// Include on every page after Supabase CDN:
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
// <script src="auth.js" defer></script>

const SUPABASE_URL = 'https://uorlszhcjrblrbmhgyqb.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvcmxzemhjanJibHJibWhneXFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0OTg3OTMsImV4cCI6MjA4OTA3NDc5M30.zeDHQMKzlw-fKkulYlBUJOhniYiN30WZK12sZTgLElg';

// ── Pages that DON'T require login ──
const PUBLIC_PAGES = ['login.html', 'onboarding.html', 'landing.html', 'index.html'];

let _sb = null;
function getSB() {
  if (_sb) return _sb;
  if (window.supabase) { _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON); return _sb; }
  return null;
}

let currentUser = null;
let currentProfile = null;

// ── Auth gate — runs immediately on every protected page ──
async function authGate() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  const isPublic = PUBLIC_PAGES.some(p => page === p || page === '');
  if (isPublic) return; // no check needed

  const sb = getSB();
  if (!sb) return;

  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    // Not logged in — redirect to login, preserve intended destination
    const redirect = encodeURIComponent(window.location.href);
    window.location.href = `https://sn8k3.github.io/tools/login.html?redirect=${redirect}`;
  }
}

// ── Auth helpers ──
async function initAuth(cb) {
  const sb = getSB(); if (!sb) return;
  const { data: { session } } = await sb.auth.getSession();
  currentUser = session?.user || null;
  if (currentUser) currentProfile = await fetchProfile(currentUser.id);
  if (cb) cb(currentUser, currentProfile);
  sb.auth.onAuthStateChange(async (_e, session) => {
    currentUser = session?.user || null;
    if (currentUser) currentProfile = await fetchProfile(currentUser.id);
    else currentProfile = null;
    if (cb) cb(currentUser, currentProfile);
    updateTopbarAuth();
  });
}

async function fetchProfile(userId) {
  const sb = getSB(); if (!sb) return null;
  const { data } = await sb.from('profiles').select('*').eq('id', userId).single();
  return data || null;
}

async function saveToCloud(feature, data) {
  const sb = getSB();
  if (!currentUser || !sb) return false;
  try {
    const { error } = await sb.from('user_data').upsert({
      user_id: currentUser.id, feature, data,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,feature' });
    if (error) throw error;
    return true;
  } catch { return false; }
}

async function loadFromCloud(feature) {
  const sb = getSB();
  if (!currentUser || !sb) return null;
  try {
    const { data, error } = await sb.from('user_data').select('data')
      .eq('user_id', currentUser.id).eq('feature', feature).single();
    if (error && error.code !== 'PGRST116') throw error;
    return data?.data || null;
  } catch { return null; }
}

function getUser() { return currentUser; }
function getProfile() { return currentProfile; }

// ── Topbar auth injection ──
function injectTopbarAuth() {
  if (window.location.pathname.includes('login') ||
      window.location.pathname.includes('onboarding')) return;

  const topbar = document.querySelector('.topbar') || document.querySelector('nav');
  if (!topbar) return;

  if (!document.getElementById('notiv-auth-styles')) {
    const style = document.createElement('style');
    style.id = 'notiv-auth-styles';
    style.textContent = `
      #notiv-auth-widget {
        margin-left: auto;
        display: flex;
        align-items: center;
        gap: 10px;
        flex-shrink: 0;
      }
      #notiv-auth-widget .auth-signin-btn {
        display: flex; align-items: center; gap: 6px;
        padding: 6px 14px; border-radius: 8px;
        border: 1px solid rgba(200,240,94,0.3);
        background: rgba(200,240,94,0.10);
        color: #c8f05e; font-family: inherit; font-size: 13px;
        font-weight: 500; cursor: pointer;
        transition: background 0.15s;
        text-decoration: none;
        white-space: nowrap;
      }
      #notiv-auth-widget .auth-signin-btn:hover { background: rgba(200,240,94,0.18); }
      #notiv-auth-widget .auth-profile-btn {
        display: flex; align-items: center; gap: 8px;
        padding: 4px 12px 4px 4px; border-radius: 40px;
        border: 1px solid #2a2a30; background: #1f1f24;
        cursor: pointer; transition: border-color 0.15s;
        font-family: inherit; font-size: 13px; color: #9b9899;
        text-decoration: none;
      }
      #notiv-auth-widget .auth-profile-btn:hover { border-color: #38383f; color: #eeecea; }
      #notiv-auth-widget .auth-avatar {
        width: 28px; height: 28px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 13px; font-weight: 600; flex-shrink: 0;
        background: rgba(200,240,94,0.12); color: #c8f05e;
        border: 1px solid rgba(200,240,94,0.3);
      }
      #notiv-auth-widget .auth-username {
        max-width: 120px; overflow: hidden;
        text-overflow: ellipsis; white-space: nowrap;
        color: #eeecea; font-size: 13px;
      }
    `;
    document.head.appendChild(style);
  }

  // Remove any existing nav-pill or topbar-right that would conflict
  const pill = topbar.querySelector('.nav-pill');
  if (pill) pill.remove();
  const right = topbar.querySelector('.topbar-right');
  if (right) right.remove();

  const widget = document.createElement('div');
  widget.id = 'notiv-auth-widget';
  topbar.appendChild(widget);
  updateTopbarAuth();
}

function updateTopbarAuth() {
  const widget = document.getElementById('notiv-auth-widget');
  if (!widget) return;

  if (currentUser) {
    const profile = currentProfile;
    const displayName = profile?.username || currentUser.email?.split('@')[0] || 'User';
    const initials = displayName.slice(0, 2).toUpperCase();
    const avatarEmoji = profile?.avatar_emoji || null;
    widget.innerHTML = `
      <a class="auth-profile-btn" href="profile.html">
        <div class="auth-avatar">${avatarEmoji ? `<span style="font-size:16px">${avatarEmoji}</span>` : initials}</div>
        <span class="auth-username">${escH(displayName)}</span>
      </a>
    `;
  } else {
    widget.innerHTML = `
      <a class="auth-signin-btn" href="login.html?redirect=${encodeURIComponent(window.location.href)}">
        Sign in
      </a>
    `;
  }
}

function escH(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ── Auto-init ──
document.addEventListener('DOMContentLoaded', () => {
  authGate();          // redirect if not logged in
  injectTopbarAuth();
  initAuth(() => updateTopbarAuth());
});
