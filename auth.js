// ── Notiv Auth & Sync Module ──
// Include this script on every page: <script src="auth.js"></script>

const SUPABASE_URL = 'https://uorlszhcjrblrbmhgyqb.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvcmxzemhjanJibHJibWhneXFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0OTg3OTMsImV4cCI6MjA4OTA3NDc5M30.zeDHQMKzlw-fKkulYlBUJOhniYiN30WZK12sZTgLElg';

// ── Supabase client (CDN loaded) ──
let _supabase = null;
function getSupabase() {
  if (_supabase) return _supabase;
  if (window.supabase) {
    _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
    return _supabase;
  }
  console.error('Supabase not loaded');
  return null;
}

// ── Auth state ──
let currentUser = null;

async function initAuth(onUserChange) {
  const sb = getSupabase();
  if (!sb) return;

  const { data: { session } } = await sb.auth.getSession();
  currentUser = session?.user || null;
  if (onUserChange) onUserChange(currentUser);

  sb.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user || null;
    if (onUserChange) onUserChange(currentUser);
  });
}

async function signInWithGoogle() {
  const sb = getSupabase();
  await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: 'https://sn8k3.github.io/tools/login.html' },
  });
}

async function signInWithEmail(email, password) {
  const sb = getSupabase();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function signUpWithEmail(email, password) {
  const sb = getSupabase();
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

async function signOut() {
  const sb = getSupabase();
  await sb.auth.signOut();
  currentUser = null;
}

function getUser() { return currentUser; }

// ── Data sync ──
// feature: 'notes' | 'essays' | 'flashcards' | 'planner'
// Data is stored as one JSON blob per feature per user

async function saveToCloud(feature, data) {
  const sb = getSupabase();
  if (!currentUser || !sb) return false;
  try {
    const { error } = await sb.from('user_data').upsert({
      user_id: currentUser.id,
      feature,
      data,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,feature' });
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('saveToCloud error:', err);
    return false;
  }
}

async function loadFromCloud(feature) {
  const sb = getSupabase();
  if (!currentUser || !sb) return null;
  try {
    const { data, error } = await sb
      .from('user_data')
      .select('data')
      .eq('user_id', currentUser.id)
      .eq('feature', feature)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data?.data || null;
  } catch (err) {
    console.error('loadFromCloud error:', err);
    return null;
  }
}

// ── Profile button ──
// Injects a floating profile button into the current page
function injectProfileButton() {
  // Don't inject on the login page itself
  if (window.location.pathname.includes('login')) return;

  const btn = document.createElement('div');
  btn.id = 'notiv-profile-btn';
  btn.style.cssText = `
    position: fixed; bottom: 24px; left: 24px; z-index: 9999;
    display: flex; align-items: center; gap: 8px;
    background: #17171a; border: 1px solid #2a2a30;
    border-radius: 40px; padding: 8px 14px 8px 8px;
    cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s;
    font-family: 'Instrument Sans', sans-serif; font-size: 13px;
    color: #9b9899; box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    user-select: none;
  `;
  btn.innerHTML = `
    <div id="notiv-avatar" style="width:28px;height:28px;border-radius:50%;background:#1f1f24;border:1px solid #38383f;display:flex;align-items:center;justify-content:center;font-size:13px;color:#5c5a5e;flex-shrink:0;">?</div>
    <span id="notiv-user-label">Sign in</span>
  `;
  btn.addEventListener('mouseenter', () => {
    btn.style.borderColor = '#38383f';
    btn.style.boxShadow = '0 6px 24px rgba(0,0,0,0.5)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.borderColor = '#2a2a30';
    btn.style.boxShadow = '0 4px 16px rgba(0,0,0,0.4)';
  });
  btn.addEventListener('click', () => {
    if (currentUser) {
      window.location.href = 'profile.html';
    } else {
      window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.href);
    }
  });
  document.body.appendChild(btn);
  updateProfileButton(currentUser);
}

function updateProfileButton(user) {
  const label = document.getElementById('notiv-user-label');
  const avatar = document.getElementById('notiv-avatar');
  if (!label || !avatar) return;

  if (user) {
    const email = user.email || '';
    const initials = email.slice(0, 2).toUpperCase();
    label.textContent = email.split('@')[0];
    label.style.color = '#eeecea';
    avatar.textContent = initials;
    avatar.style.background = '#c8f05e22';
    avatar.style.color = '#c8f05e';
    avatar.style.borderColor = 'rgba(200,240,94,0.3)';
  } else {
    label.textContent = 'Sign in';
    label.style.color = '#9b9899';
    avatar.textContent = '?';
    avatar.style.background = '#1f1f24';
    avatar.style.color = '#5c5a5e';
    avatar.style.borderColor = '#38383f';
  }
}

// ── Auto-init on every page ──
document.addEventListener('DOMContentLoaded', () => {
  injectProfileButton();
  initAuth((user) => {
    updateProfileButton(user);
  });
});
