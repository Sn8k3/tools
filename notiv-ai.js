// ── Notiv AI Call Wrapper ──
// Wraps every call to the Cloudflare Worker's Anthropic proxy.
// Automatically attaches user_id for credit tracking, and handles
// the "out of credits" (402) response consistently across all pages.
//
// Usage (drop-in replacement for raw fetch(WORKER_URL,...)):
//   const data = await callAI({ model: '...', max_tokens: 2000, messages: [...] });
//   if (!data) return; // call was blocked or failed — error already shown to user
//
// Requires auth.js to be loaded first (for getUser()).

const NOTIV_WORKER_URL = 'https://tiny-hat-80bd.charlieweis6.workers.dev';

async function callAI(payload) {
  const sb = await getSBAsync();
  let user = getUser();

  if (!user && sb) {
    try {
      const { data: { session } } = await sb.auth.getSession();
      user = session?.user || null;
    } catch {}
  }

  if (!user) {
    showAuthModal();
    return null;
  }

  let res, data;
  try {
    res = await fetch(NOTIV_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, user_id: user.id }),
    });
    data = await res.json();
  } catch (err) {
    showCreditToast('Network error — please try again.', 'error');
    return null;
  }

  if (res.status === 402) {
    showOutOfCreditsModal(data.refresh_at);
    return null;
  }

  if (!res.ok) {
    const msg = data?.error?.message || `Request failed (${res.status})`;
    showCreditToast(msg, 'error');
    return null;
  }

  if (typeof data.credits_remaining === 'number') {
    updateCreditIndicator(data.credits_remaining, data.monthly_cap);
  }

  return data;
}

function showOutOfCreditsModal(refreshAt) {
  const sub = refreshAt
    ? `You've used all your credits for this month. They'll refresh automatically on ${formatRefreshDate(refreshAt)}, or upgrade now for more.`
    : `You've used all your free AI credits this month. Upgrade for more credits and higher limits across every tool.`;

  const existing = document.getElementById('notiv-credits-modal');
  if (existing) {
    const subEl = existing.querySelector('.ncm-sub');
    if (subEl) subEl.textContent = sub;
    existing.classList.add('visible');
    return;
  }
  const style = document.createElement('style');
  style.textContent = `
    #notiv-credits-modal { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.75); z-index:9999; align-items:center; justify-content:center; padding:20px; }
    #notiv-credits-modal.visible { display:flex; }
    .ncm-card { background:#0f0f12; border:1px solid #2e2e38; border-radius:20px; padding:36px 32px; max-width:380px; width:100%; display:flex; flex-direction:column; align-items:center; gap:14px; text-align:center; position:relative; animation:ncm-pop 0.25s cubic-bezier(0.4,0,0.2,1); }
    @keyframes ncm-pop { from { opacity:0; transform:scale(0.94); } to { opacity:1; transform:scale(1); } }
    .ncm-icon { font-size:40px; }
    .ncm-title { font-family:'Playfair Display',serif; font-size:22px; color:#f0ede8; }
    .ncm-sub { font-size:13px; color:#9b9893; line-height:1.6; }
    .ncm-btns { display:flex; gap:8px; width:100%; margin-top:4px; }
    .ncm-btn-primary { flex:1; padding:10px; border-radius:9px; border:none; background:#c8f05e; color:#080809; font-family:'Instrument Sans',sans-serif; font-size:14px; font-weight:600; cursor:pointer; text-decoration:none; display:flex; align-items:center; justify-content:center; }
    .ncm-btn-primary:hover { background:#d8ff74; }
    .ncm-btn-secondary { flex:1; padding:10px; border-radius:9px; border:1px solid #2e2e38; background:none; color:#9b9893; font-family:'Instrument Sans',sans-serif; font-size:14px; cursor:pointer; }
    .ncm-close { position:absolute; top:14px; right:16px; background:none; border:none; color:#5a5855; font-size:18px; cursor:pointer; }
  `;
  document.head.appendChild(style);
  const modal = document.createElement('div');
  modal.id = 'notiv-credits-modal';
  modal.innerHTML = `
    <div class="ncm-card">
      <button class="ncm-close" onclick="document.getElementById('notiv-credits-modal').classList.remove('visible')">✕</button>
      <div class="ncm-icon">⚡</div>
      <div class="ncm-title">Out of credits</div>
      <div class="ncm-sub">${sub}</div>
      <div class="ncm-btns">
        <button class="ncm-btn-secondary" onclick="document.getElementById('notiv-credits-modal').classList.remove('visible')">Close</button>
        <a class="ncm-btn-primary" href="pricing.html">Upgrade →</a>
      </div>
    </div>
  `;
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('visible'); });
  document.body.appendChild(modal);
  modal.classList.add('visible');
}

function showCreditToast(msg, type = 'error') {
  let t = document.getElementById('notiv-credit-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'notiv-credit-toast';
    t.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#16161a;border:1px solid #2e2e38;border-radius:10px;padding:10px 14px;font-size:13px;color:#f0ede8;z-index:9999;display:none;align-items:center;gap:8px;font-family:"Instrument Sans",sans-serif;max-width:320px;';
    document.body.appendChild(t);
  }
  t.style.borderColor = type === 'error' ? 'rgba(240,99,90,0.3)' : 'rgba(200,240,94,0.2)';
  t.textContent = (type === 'error' ? '⚠ ' : '✓ ') + msg;
  t.style.display = 'flex';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.display = 'none'; }, 4000);
}

// ── Sidebar credit bar ──
// Updates any element with class "credit-bar-fill" (width %) and
// "credit-bar-label" (text) on the page. Call updateCreditUI(balance, cap)
// directly, or let callAI / fetchCreditBalance do it automatically.

function updateCreditIndicator(balance, cap) {
  // Back-compat: simple text indicators (used by older pages)
  document.querySelectorAll('.credit-indicator').forEach(el => {
    el.textContent = `${balance} credit${balance === 1 ? '' : 's'}`;
    el.classList.toggle('low', balance <= 1);
  });
  updateCreditUI(balance, cap);
}

function updateCreditUI(balance, cap) {
  if (typeof balance !== 'number') return;
  const safeCap = (typeof cap === 'number' && cap > 0) ? cap : Math.max(balance, 5);
  const pct = Math.max(0, Math.min(100, (balance / safeCap) * 100));

  document.querySelectorAll('.credit-bar-fill').forEach(el => {
    el.style.width = pct + '%';
    el.classList.toggle('low', balance <= Math.ceil(safeCap * 0.2));
    el.classList.toggle('empty', balance <= 0);
  });
  document.querySelectorAll('.credit-bar-label').forEach(el => {
    el.textContent = `${balance} / ${safeCap} credits`;
  });
}

function formatRefreshDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Fetch the current balance from the Worker (this also triggers the
// monthly auto-refresh check server-side, so call this on every page load).
async function fetchCreditBalance() {
  const sb = await getSBAsync();
  let user = getUser();
  if (!user && sb) {
    try {
      const { data: { session } } = await sb.auth.getSession();
      user = session?.user || null;
    } catch (err) {
      console.warn('[notiv-ai] Failed to get session:', err);
    }
  }
  if (!user) {
    console.warn('[notiv-ai] fetchCreditBalance: no logged-in user found, skipping.');
    return null;
  }

  try {
    const res = await fetch(`${NOTIV_WORKER_URL}/credits/balance?user_id=${encodeURIComponent(user.id)}`);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`[notiv-ai] /credits/balance returned ${res.status}:`, text);
      return null;
    }
    const data = await res.json();

    if (typeof data.balance !== 'number') {
      console.error('[notiv-ai] /credits/balance response missing balance field:', data);
      return null;
    }

    updateCreditUI(data.balance, data.monthly_cap);

    document.querySelectorAll('.credit-refresh-label').forEach(el => {
      el.textContent = `Refreshes ${formatRefreshDate(data.refresh_at)}`;
    });

    return data;
  } catch (err) {
    console.error('[notiv-ai] fetchCreditBalance network error:', err);
    return null;
  }
}

// NOTE: fetchCreditBalance() is intentionally NOT auto-run from a
// DOMContentLoaded listener here. sidebar.js calls it directly, in sequence,
// immediately after it finishes injecting the credits bar markup into the
// page. That ordering used to be left to chance (two independent
// DOMContentLoaded listeners racing based on script tag order), which caused
// a visible "reset" flash — see the comment above buildCreditsSection() in
// sidebar.js for the full explanation. If a page loads notiv-ai.js WITHOUT
// sidebar.js, the credits bar simply won't exist on that page, so there is
// nothing for this function to update anyway.
