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
    showOutOfCreditsModal();
    return null;
  }

  if (!res.ok) {
    const msg = data?.error?.message || `Request failed (${res.status})`;
    showCreditToast(msg, 'error');
    return null;
  }

  if (typeof data.credits_remaining === 'number') {
    updateCreditIndicator(data.credits_remaining);
  }

  return data;
}

function showOutOfCreditsModal() {
  if (document.getElementById('notiv-credits-modal')) {
    document.getElementById('notiv-credits-modal').classList.add('visible');
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
      <div class="ncm-sub">You've used all your free AI credits. Pricing plans are coming soon — check back shortly!</div>
      <div class="ncm-btns">
        <button class="ncm-btn-secondary" onclick="document.getElementById('notiv-credits-modal').classList.remove('visible')">Close</button>
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

function updateCreditIndicator(balance) {
  document.querySelectorAll('.credit-indicator').forEach(el => {
    el.textContent = `${balance} credit${balance === 1 ? '' : 's'}`;
    el.classList.toggle('low', balance <= 1);
  });
}

async function fetchCreditBalance() {
  const user = getUser();
  if (!user) return null;
  try {
    const sb = await getSBAsync();
    const { data, error } = await sb.from('user_credits').select('balance').eq('user_id', user.id).maybeSingle();
    if (error || !data) return null;
    updateCreditIndicator(data.balance);
    return data.balance;
  } catch {
    return null;
  }
}
