// ── Notiv Auth & Sync Module v2 ──
const SUPABASE_URL = 'https://uorlszhcjrblrbmhgyqb.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvcmxzemhjanJibHJibWhneXFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0OTg3OTMsImV4cCI6MjA4OTA3NDc5M30.zeDHQMKzlw-fKkulYlBUJOhniYiN30WZK12sZTgLElg';

let _sb = null;

function getSB() {
  if (_sb) return _sb;
  if (window.supabase) {
    _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
    return _sb;
  }
  return null;
}

// Wait up to 5 seconds for window.supabase to be available
async function getSBAsync() {
  if (_sb) return _sb;
  for (let i = 0; i < 50; i++) {
    if (window.supabase) {
      _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
      return _sb;
    }
    await new Promise(r => setTimeout(r, 100));
  }
  console.error('Notiv: Supabase SDK never loaded');
  return null;
}

let currentUser = null;
let currentProfile = null;

// ── requireAuth — call before any AI action ──
// Usage: if (!await requireAuth()) return;
async function requireAuth() {
  const sb = await getSBAsync();
  if (!sb) {
    alert('Could not connect to auth service. Please reload the page.');
    return false;
  }
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session) return true;
  } catch (e) {
    console.error('requireAuth error:', e);
  }
  showAuthModal();
  return false;
}
// ── Auth modal ──
function showAuthModal() {
  if (document.getElementById('notiv-auth-modal')) {
    document.getElementById('notiv-auth-modal').classList.add('visible');
    return;
  }
  const style = document.createElement('style');
  style.textContent = `
    #notiv-auth-modal { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.75); z-index:9999; align-items:center; justify-content:center; padding:20px; }
    #notiv-auth-modal.visible { display:flex; }
    .nam-card { background:#0f0f12; border:1px solid #2e2e38; border-radius:20px; padding:36px 32px; max-width:380px; width:100%; display:flex; flex-direction:column; align-items:center; gap:14px; text-align:center; position:relative; animation:nam-pop 0.25s cubic-bezier(0.4,0,0.2,1); }
    @keyframes nam-pop { from { opacity:0; transform:scale(0.94); } to { opacity:1; transform:scale(1); } }
    .nam-icon { font-size:40px; }
    .nam-title { font-family:'Playfair Display',serif; font-size:22px; color:#f0ede8; }
    .nam-sub { font-size:13px; color:#5a5855; line-height:1.6; }
    .nam-btns { display:flex; gap:8px; width:100%; margin-top:4px; }
    .nam-btn-primary { flex:1; padding:10px; border-radius:9px; border:none; background:#c8f05e; color:#080809; font-family:'Instrument Sans',sans-serif; font-size:14px; font-weight:600; cursor:pointer; text-decoration:none; display:flex; align-items:center; justify-content:center; transition:background 0.15s; }
    .nam-btn-primary:hover { background:#d8ff74; }
    .nam-btn-secondary { flex:1; padding:10px; border-radius:9px; border:1px solid #2e2e38; background:none; color:#9b9893; font-family:'Instrument Sans',sans-serif; font-size:14px; cursor:pointer; text-decoration:none; display:flex; align-items:center; justify-content:center; transition:all 0.15s; }
    .nam-btn-secondary:hover { border-color:#3c3c48; color:#f0ede8; }
    .nam-close { position:absolute; top:14px; right:16px; background:none; border:none; color:#5a5855; font-size:18px; cursor:pointer; }
  `;
  document.head.appendChild(style);
  const modal = document.createElement('div');
  modal.id = 'notiv-auth-modal';
  const redirect = encodeURIComponent(window.location.href);
  modal.innerHTML = `
    <div class="nam-card">
      <button class="nam-close" onclick="document.getElementById('notiv-auth-modal').classList.remove('visible')">✕</button>
      <div class="nam-icon">✦</div>
      <div class="nam-title">Sign in to continue</div>
      <div class="nam-sub">Create a free account to use Notiv's AI tools — notes, essays, flashcards, quizzes and more.</div>
      <div class="nam-btns">
        <a class="nam-btn-primary" href="login.html?redirect=${redirect}">Sign in</a>
        <a class="nam-btn-secondary" href="login.html?tab=signup&redirect=${redirect}">Create account</a>
      </div>
    </div>
  `;
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('visible'); });
  document.body.appendChild(modal);
  modal.classList.add('visible');
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
    const { error } = await sb.from('user_data').upsert({ user_id: currentUser.id, feature, data, updated_at: new Date().toISOString() }, { onConflict: 'user_id,feature' });
    if (error) throw error;
    return true;
  } catch { return false; }
}

async function loadFromCloud(feature) {
  const sb = getSB();
  if (!currentUser || !sb) return null;
  try {
    const { data, error } = await sb.from('user_data').select('data').eq('user_id', currentUser.id).eq('feature', feature).single();
    if (error && error.code !== 'PGRST116') throw error;
    return data?.data || null;
  } catch { return null; }
}

function getUser() { return currentUser; }
function getProfile() { return currentProfile; }

// ── Topbar auth injection ──
function injectTopbarAuth() {
  if (window.location.pathname.includes('login') || window.location.pathname.includes('onboarding')) return;
  const topbar = document.querySelector('.topbar') || document.querySelector('nav');
  if (!topbar) return;
  if (!document.getElementById('notiv-auth-styles')) {
    const style = document.createElement('style');
    style.id = 'notiv-auth-styles';
    style.textContent = `
      #notiv-auth-widget { margin-left:auto; display:flex; align-items:center; gap:10px; flex-shrink:0; }
      #notiv-auth-widget .auth-signin-btn { display:flex; align-items:center; gap:6px; padding:6px 14px; border-radius:8px; border:1px solid rgba(200,240,94,0.3); background:rgba(200,240,94,0.10); color:#c8f05e; font-family:inherit; font-size:13px; font-weight:500; cursor:pointer; transition:background 0.15s; text-decoration:none; white-space:nowrap; }
      #notiv-auth-widget .auth-signin-btn:hover { background:rgba(200,240,94,0.18); }
      #notiv-auth-widget .auth-profile-btn { display:flex; align-items:center; gap:8px; padding:4px 12px 4px 4px; border-radius:40px; border:1px solid #2a2a30; background:#1f1f24; cursor:pointer; transition:border-color 0.15s; font-family:inherit; font-size:13px; color:#9b9899; text-decoration:none; }
      #notiv-auth-widget .auth-profile-btn:hover { border-color:#38383f; color:#eeecea; }
      #notiv-auth-widget .auth-avatar { width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600; flex-shrink:0; background:rgba(200,240,94,0.12); color:#c8f05e; border:1px solid rgba(200,240,94,0.3); }
      #notiv-auth-widget .auth-username { max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#eeecea; font-size:13px; }
    `;
    document.head.appendChild(style);
  }
  const pill = topbar.querySelector('.nav-pill'); if (pill) pill.remove();
  const right = topbar.querySelector('.topbar-right'); if (right) right.remove();
  const widget = document.createElement('div');
  widget.id = 'notiv-auth-widget';
  topbar.appendChild(widget);
  updateTopbarAuth();
}

function updateTopbarAuth() {
  const widget = document.getElementById('notiv-auth-widget');
  if (!widget) return;
  if (currentUser) {
    const displayName = currentProfile?.username || currentUser.email?.split('@')[0] || 'User';
    const avatarEmoji = currentProfile?.avatar_emoji || null;
    widget.innerHTML = `<a class="auth-profile-btn" href="profile.html"><div class="auth-avatar">${avatarEmoji ? `<span style="font-size:16px">${avatarEmoji}</span>` : displayName.slice(0,2).toUpperCase()}</div><span class="auth-username">${escH(displayName)}</span></a>`;
  } else {
    widget.innerHTML = `<a class="auth-signin-btn" href="login.html?redirect=${encodeURIComponent(window.location.href)}">Sign in</a>`;
  }
}

function escH(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ── Auto-init ──
document.addEventListener('DOMContentLoaded', () => {
  injectTopbarAuth();
  initAuth(() => updateTopbarAuth());
});
