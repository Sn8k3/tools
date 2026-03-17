/**
 * sidebar.js — Notiv shared sidebar + XP/streak system
 * Include on every page: <script src="sidebar.js" defer></script>
 */
(function () {
  'use strict';

  // ── Config ──────────────────────────────────────────────
  const PAGES = [
    { label: 'Dashboard',  icon: '📊', href: 'dashboard.html',  section: null },
    { label: 'Notes',      icon: '📚', href: 'notes.html',      section: 'Study' },
    { label: 'Essays',     icon: '✏️',  href: 'essay.html',      section: 'Study' },
    { label: 'Flashcards', icon: '🃏', href: 'flashcards.html', section: 'Study' },
    { label: 'Quiz Me',    icon: '🧠', href: 'quiz.html',       section: 'Study' },
    { label: 'Planner',    icon: '📅', href: 'planner.html',    section: 'Study' },
    { label: 'Explainer',  icon: '💡', href: 'explainer.html',  section: 'Study' },
    { label: 'Games',      icon: '🎮', href: 'games.html',      section: 'Study' },
    { label: 'AI Writer',  icon: '✍️',  href: 'writer.html',    section: 'Study' },
    { label: 'Timer',      icon: '⏱',  href: 'timer.html',     section: 'Study' },
    { label: 'Citations',  icon: '📎', href: 'citations.html', section: 'Research' },
    { label: 'Profile',    icon: '👤', href: 'profile.html',   section: 'Account' },
    { label: 'Settings',   icon: '⚙️',  href: 'settings.html', section: 'Account' },
  ];

  const XP_THRESHOLDS = [0,500,1200,2200,3500,5000,7000,9500,12500,16000,20000];

  // Skip on login/onboarding/landing pages and pages with their own sidebar
  const path = window.location.pathname;
  if (/login|onboarding|landing/.test(path)) return;

  // If the page already has a hand-coded nav-sidebar, skip injection but still wire XP
  const hasOwnSidebar = !!document.getElementById('nav-sidebar');
  if (hasOwnSidebar) {
    // Still expose notivAwardXP for XP toasts on these pages
    document.addEventListener('DOMContentLoaded', function() {
      injectXPToast();
      restoreCollapse();
    });
    return;
  }

  // ── Inject styles ────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    /* Reset body for sidebar layout */
    body { display:flex!important; flex-direction:row!important; min-height:100vh; margin:0; }

    /* ── Sidebar ── */
    #notiv-sidebar {
      width: 220px;
      min-width: 220px;
      background: #0f0f12;
      border-right: 1px solid #22222a;
      height: 100vh;
      position: sticky;
      top: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: width 0.22s cubic-bezier(0.4,0,0.2,1),
                  min-width 0.22s cubic-bezier(0.4,0,0.2,1);
      z-index: 200;
      flex-shrink: 0;
    }
    #notiv-sidebar.collapsed { width: 52px; min-width: 52px; }

    /* Header row */
    .nsb-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 14px;
      border-bottom: 1px solid #22222a;
      flex-shrink: 0;
      gap: 8px;
    }
    .nsb-logo {
      font-family: 'Playfair Display', serif;
      font-size: 19px;
      font-weight: 500;
      color: #f0ede8;
      text-decoration: none;
      white-space: nowrap;
      overflow: hidden;
      transition: opacity 0.15s, width 0.22s;
    }
    .nsb-logo span { color: #c8f05e; }
    #notiv-sidebar.collapsed .nsb-logo { opacity: 0; width: 0; pointer-events: none; }

    .nsb-toggle {
      background: none;
      border: 1px solid #22222a;
      border-radius: 6px;
      color: #383634;
      cursor: pointer;
      width: 24px;
      height: 24px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      transition: all 0.12s;
      padding: 0;
    }
    .nsb-toggle:hover { border-color: #2e2e38; color: #9b9893; }

    /* XP bar in sidebar */
    .nsb-xp {
      padding: 10px 12px 8px;
      border-bottom: 1px solid #22222a;
      flex-shrink: 0;
      overflow: hidden;
      transition: opacity 0.15s;
    }
    #notiv-sidebar.collapsed .nsb-xp { opacity: 0; pointer-events: none; padding: 0; height: 0; border: none; }
    .nsb-xp-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 5px;
    }
    .nsb-xp-label {
      font-size: 9px;
      font-family: 'DM Mono', monospace;
      color: #383634;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
    .nsb-xp-val {
      font-family: 'Playfair Display', serif;
      font-size: 14px;
      color: #c8f05e;
    }
    .nsb-xp-track {
      height: 3px;
      background: #22222a;
      border-radius: 2px;
      overflow: hidden;
    }
    .nsb-xp-fill {
      height: 100%;
      background: #c8f05e;
      border-radius: 2px;
      transition: width 0.8s cubic-bezier(0.4,0,0.2,1);
    }
    .nsb-streak {
      display: flex;
      align-items: center;
      gap: 5px;
      margin-top: 6px;
      font-size: 11px;
      color: #5a5855;
      font-family: 'DM Mono', monospace;
    }
    .nsb-streak-fire { font-size: 13px; }

    /* Nav */
    .nsb-nav {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 8px 6px;
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .nsb-nav::-webkit-scrollbar { width: 3px; }
    .nsb-nav::-webkit-scrollbar-thumb { background: #2e2e38; border-radius: 2px; }

    .nsb-section-label {
      font-size: 9px;
      font-family: 'DM Mono', monospace;
      color: #383634;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      padding: 10px 8px 3px;
      white-space: nowrap;
      overflow: hidden;
      transition: opacity 0.15s, height 0.22s, padding 0.22s;
    }
    #notiv-sidebar.collapsed .nsb-section-label {
      opacity: 0; height: 0; padding: 0; pointer-events: none;
    }

    .nsb-link {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 7px 9px;
      border-radius: 8px;
      font-size: 13px;
      color: #5a5855;
      text-decoration: none;
      transition: all 0.12s;
      position: relative;
      white-space: nowrap;
      overflow: hidden;
      font-family: 'Instrument Sans', sans-serif;
    }
    .nsb-link:hover { background: #16161a; color: #9b9893; }
    .nsb-link.active { background: #16161a; color: #f0ede8; }
    .nsb-link.active::after {
      content: '';
      position: absolute;
      left: 0; top: 50%;
      transform: translateY(-50%);
      width: 2px; height: 14px;
      background: #c8f05e;
      border-radius: 0 2px 2px 0;
    }
    .nsb-icon { font-size: 14px; width: 18px; text-align: center; flex-shrink: 0; }
    .nsb-text {
      overflow: hidden;
      transition: opacity 0.15s;
      white-space: nowrap;
    }
    #notiv-sidebar.collapsed .nsb-text { opacity: 0; width: 0; }
    #notiv-sidebar.collapsed .nsb-link { justify-content: center; padding: 8px; }

    /* Tooltip on collapsed */
    #notiv-sidebar.collapsed .nsb-link { position: relative; }
    #notiv-sidebar.collapsed .nsb-link:hover::before {
      content: attr(data-label);
      position: absolute;
      left: calc(100% + 10px);
      top: 50%;
      transform: translateY(-50%);
      background: #16161a;
      border: 1px solid #2e2e38;
      border-radius: 7px;
      padding: 5px 12px;
      font-size: 12px;
      color: #f0ede8;
      white-space: nowrap;
      pointer-events: none;
      z-index: 9999;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    }

    /* ── XP Toast notification ── */
    #notiv-xp-toast {
      position: fixed;
      bottom: 80px;
      right: 24px;
      background: #0f0f12;
      border: 1px solid rgba(200,240,94,0.3);
      border-radius: 12px;
      padding: 10px 16px;
      display: flex;
      align-items: center;
      gap: 10px;
      font-family: 'Instrument Sans', sans-serif;
      font-size: 13px;
      color: #f0ede8;
      z-index: 9999;
      transform: translateY(20px);
      opacity: 0;
      transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
      pointer-events: none;
    }
    #notiv-xp-toast.show { transform: translateY(0); opacity: 1; }
    .xp-toast-icon { font-size: 20px; }
    .xp-toast-amount { font-family: 'Playfair Display', serif; font-size: 18px; color: #c8f05e; }
    .xp-toast-label { color: #9b9893; font-size: 12px; }

    /* ── Level up overlay ── */
    #notiv-levelup {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s;
    }
    #notiv-levelup.show { opacity: 1; pointer-events: all; }
    .levelup-card {
      background: #0f0f12;
      border: 1px solid rgba(200,240,94,0.3);
      border-radius: 20px;
      padding: 40px 48px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      animation: levelup-pop 0.4s cubic-bezier(0.4,0,0.2,1);
    }
    @keyframes levelup-pop {
      from { transform: scale(0.85); opacity: 0; }
      to   { transform: scale(1);    opacity: 1; }
    }
    .levelup-icon { font-size: 52px; }
    .levelup-title {
      font-family: 'Playfair Display', serif;
      font-size: 28px;
      color: #f0ede8;
    }
    .levelup-num {
      font-family: 'Playfair Display', serif;
      font-size: 64px;
      color: #c8f05e;
      line-height: 1;
    }
    .levelup-sub { font-size: 13px; color: #5a5855; }
    .levelup-btn {
      margin-top: 8px;
      padding: 9px 28px;
      border-radius: 9px;
      border: none;
      background: #c8f05e;
      color: #080809;
      font-family: 'Instrument Sans', sans-serif;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    .levelup-btn:hover { background: #d8ff74; }

    /* ── Main content wrapper ── */
    #notiv-main-wrap {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* ── Mobile ── */
    .nsb-mobile-toggle {
      display: none;
      position: fixed;
      top: 12px;
      left: 12px;
      z-index: 300;
      background: #0f0f12;
      border: 1px solid #22222a;
      border-radius: 8px;
      width: 36px;
      height: 36px;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 16px;
      color: #9b9893;
    }

    #notiv-sidebar-backdrop {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      z-index: 199;
    }

    @media (max-width: 768px) {
      #notiv-sidebar {
        position: fixed !important;
        left: -220px;
        height: 100vh;
        top: 0;
        transition: left 0.25s cubic-bezier(0.4,0,0.2,1),
                    width 0.22s cubic-bezier(0.4,0,0.2,1);
      }
      #notiv-sidebar.mobile-open {
        left: 0 !important;
        width: 220px !important;
        min-width: 220px !important;
      }
      #notiv-sidebar.collapsed { width: 220px; min-width: 220px; }
      #notiv-sidebar.collapsed .nsb-logo { opacity: 1; width: auto; pointer-events: all; }
      #notiv-sidebar.collapsed .nsb-text { opacity: 1; width: auto; }
      #notiv-sidebar.collapsed .nsb-link { justify-content: flex-start; padding: 7px 9px; }
      #notiv-sidebar.collapsed .nsb-section-label { opacity: 1; height: auto; padding: 10px 8px 3px; }
      #notiv-sidebar.collapsed .nsb-xp { opacity: 1; pointer-events: all; padding: 10px 12px 8px; height: auto; border-bottom: 1px solid #22222a; }
      #notiv-sidebar.collapsed .nsb-link:hover::before { display: none; }
      #notiv-main-wrap { margin-left: 0 !important; }
      body { flex-direction: column !important; }
      .nsb-mobile-toggle { display: flex !important; }
      #notiv-sidebar-backdrop.open { display: block; }
    }
  `;
  document.head.appendChild(style);

  // ── Helpers for pages with own sidebar ─────────────────
  function injectXPToast() {
    if (document.getElementById('notiv-xp-toast')) return;

    const toastStyle = document.createElement('style');
    toastStyle.textContent = `
      #notiv-xp-toast{position:fixed;bottom:80px;right:24px;background:#0f0f12;border:1px solid rgba(200,240,94,0.3);border-radius:12px;padding:10px 16px;display:flex;align-items:center;gap:10px;font-family:'Instrument Sans',sans-serif;font-size:13px;color:#f0ede8;z-index:9999;transform:translateY(20px);opacity:0;transition:all 0.3s cubic-bezier(0.4,0,0.2,1);pointer-events:none;}
      #notiv-xp-toast.show{transform:translateY(0);opacity:1;}
      .xp-toast-icon{font-size:20px;}
      .xp-toast-amount{font-family:'Playfair Display',serif;font-size:18px;color:#c8f05e;}
      .xp-toast-label{color:#9b9893;font-size:12px;}
      #notiv-levelup{position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999;opacity:0;pointer-events:none;transition:opacity 0.3s;}
      #notiv-levelup.show{opacity:1;pointer-events:all;}
      .levelup-card{background:#0f0f12;border:1px solid rgba(200,240,94,0.3);border-radius:20px;padding:40px 48px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:12px;animation:levelup-pop 0.4s cubic-bezier(0.4,0,0.2,1);}
      @keyframes levelup-pop{from{transform:scale(0.85);opacity:0;}to{transform:scale(1);opacity:1;}}
      .levelup-icon{font-size:52px;}
      .levelup-title{font-family:'Playfair Display',serif;font-size:28px;color:#f0ede8;}
      .levelup-num{font-family:'Playfair Display',serif;font-size:64px;color:#c8f05e;line-height:1;}
      .levelup-sub{font-size:13px;color:#5a5855;}
      .levelup-btn{margin-top:8px;padding:9px 28px;border-radius:9px;border:none;background:#c8f05e;color:#080809;font-family:'Instrument Sans',sans-serif;font-size:14px;font-weight:600;cursor:pointer;}
      .levelup-btn:hover{background:#d8ff74;}
    `;
    document.head.appendChild(toastStyle);

    const toast = document.createElement('div');
    toast.id = 'notiv-xp-toast';
    toast.innerHTML = `<span class="xp-toast-icon">✦</span><span class="xp-toast-amount" id="xp-toast-amount">+50</span><span class="xp-toast-label">XP</span>`;
    document.body.appendChild(toast);

    const levelup = document.createElement('div');
    levelup.id = 'notiv-levelup';
    levelup.innerHTML = `<div class="levelup-card"><div class="levelup-icon">🏆</div><div class="levelup-title">Level Up!</div><div class="levelup-num" id="levelup-num">2</div><div class="levelup-sub">Keep studying to reach the next level</div><button class="levelup-btn" onclick="document.getElementById('notiv-levelup').classList.remove('show')">Keep going →</button></div>`;
    document.body.appendChild(levelup);

    wireNotivAwardXP();
  }

  function restoreCollapse() {
    const sidebar = document.getElementById('nav-sidebar');
    const btn = document.getElementById('sidebar-toggle-btn');
    if (!sidebar || !btn) return;
    if (localStorage.getItem('notiv-sidebar-collapsed') === '1') {
      sidebar.classList.add('collapsed');
      btn.textContent = '›';
      btn.title = 'Expand sidebar';
    }
    // Wire toggle button if not already wired
    if (!btn._wired) {
      btn._wired = true;
      btn.addEventListener('click', function() {
        const collapsed = sidebar.classList.toggle('collapsed');
        btn.textContent = collapsed ? '›' : '‹';
        btn.title = (collapsed ? 'Expand' : 'Collapse') + ' sidebar';
        localStorage.setItem('notiv-sidebar-collapsed', collapsed ? '1' : '0');
      });
    }
  }

  function wireNotivAwardXP() {
    const prevXP   = calcXP();
    const prevLvl  = calcLevel(prevXP);
    window.notivAwardXP = function(amount) {
      const toast = document.getElementById('notiv-xp-toast');
      if (!toast) return;
      document.getElementById('xp-toast-amount').textContent = '+' + amount;
      toast.classList.add('show');
      clearTimeout(toast._t);
      toast._t = setTimeout(() => toast.classList.remove('show'), 2500);
      const newXP  = calcXP();
      const newLvl = calcLevel(newXP);
      if (newLvl > prevLvl) {
        setTimeout(() => {
          document.getElementById('levelup-num').textContent = newLvl;
          document.getElementById('notiv-levelup').classList.add('show');
        }, 600);
      }
    };
  }

  // ── Helpers for pages with own sidebar ─────────────────
  function getActivePage() {
    const p = window.location.pathname.split('/').pop() || 'dashboard.html';
    return p;
  }

  function buildNav() {
    const active = getActivePage();
    let html = '';
    let lastSection = null;
    PAGES.forEach(page => {
      if (page.section !== lastSection) {
        if (page.section) {
          html += `<div class="nsb-section-label">${page.section}</div>`;
        }
        lastSection = page.section;
      }
      const isActive = active === page.href || active === page.href.replace('.html','');
      html += `<a href="${page.href}" class="nsb-link${isActive?' active':''}" data-label="${page.label}">
        <span class="nsb-icon">${page.icon}</span>
        <span class="nsb-text">${page.label}</span>
      </a>`;
    });
    return html;
  }

  function calcXP() {
    const notes   = tryParse('studyai-notes', []);
    const essays  = tryParse('studyai-essay-history', []);
    const decks   = tryParse('studyai-decks', []);
    const planner = tryParse('studyai-planner', null);
    let xp = notes.length * 50
           + notes.filter(n => n.polishedText).length * 100
           + essays.length * 75
           + decks.length * 60;
    if (planner?.taskStatus) {
      xp += Object.values(planner.taskStatus).filter(Boolean).length * 20;
    }
    return xp;
  }

  function calcLevel(xp) {
    let level = 0;
    for (let i = 0; i < XP_THRESHOLDS.length; i++) {
      if (xp >= XP_THRESHOLDS[i]) level = i + 1;
    }
    return Math.max(1, level);
  }

  function calcXPPct(xp) {
    const level = calcLevel(xp);
    const idx = level - 1;
    const floor = XP_THRESHOLDS[idx] || 0;
    const ceil  = XP_THRESHOLDS[idx + 1] || XP_THRESHOLDS[XP_THRESHOLDS.length - 1];
    return Math.min(100, Math.round((xp - floor) / (ceil - floor) * 100));
  }

  function calcStreak() {
    const notes   = tryParse('studyai-notes', []);
    const essays  = tryParse('studyai-essay-history', []);
    const planner = tryParse('studyai-planner', null);
    const dates = new Set();
    notes.forEach(n => { if (n.date) dates.add(parseDate(n.date)); });
    essays.forEach(e => { if (e.date) dates.add(parseDate(e.date)); });
    if (planner?.taskStatus && Object.values(planner.taskStatus).some(Boolean)) {
      dates.add(todayStr());
    }
    let streak = 0;
    const today = new Date(); today.setHours(0,0,0,0);
    for (let i = 0; i < 365; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      if (dates.has(d.toISOString().split('T')[0])) streak++;
      else if (i > 0) break;
    }
    return streak;
  }

  function buildXPSection(xp, level, pct, streak) {
    return `
      <div class="nsb-xp">
        <div class="nsb-xp-row">
          <span class="nsb-xp-label">Level ${level}</span>
          <span class="nsb-xp-val">${xp.toLocaleString()} XP</span>
        </div>
        <div class="nsb-xp-track">
          <div class="nsb-xp-fill" id="nsb-xp-fill" style="width:0%"></div>
        </div>
        ${streak > 0 ? `<div class="nsb-streak"><span class="nsb-streak-fire">🔥</span>${streak} day streak</div>` : ''}
      </div>`;
  }

  // ── Inject sidebar into page ─────────────────────────────
  function inject() {
    const xp     = calcXP();
    const level  = calcLevel(xp);
    const pct    = calcXPPct(xp);
    const streak = calcStreak();
    const collapsed = localStorage.getItem('notiv-sidebar-collapsed') === '1';

    // Sidebar element
    const sidebar = document.createElement('aside');
    sidebar.id = 'notiv-sidebar';
    if (collapsed) sidebar.classList.add('collapsed');
    sidebar.innerHTML = `
      <div class="nsb-head">
        <a href="index.html" class="nsb-logo">Notiv<span>.</span></a>
        <button class="nsb-toggle" id="nsb-toggle" title="${collapsed?'Expand':'Collapse'} sidebar">${collapsed?'›':'‹'}</button>
      </div>
      ${buildXPSection(xp, level, pct, streak)}
      <nav class="nsb-nav">${buildNav()}</nav>
    `;
    document.body.insertBefore(sidebar, document.body.firstChild);

    // Wrap remaining body content
    const wrap = document.createElement('div');
    wrap.id = 'notiv-main-wrap';
    while (document.body.children.length > 1) {
      wrap.appendChild(document.body.children[1]);
    }
    document.body.appendChild(wrap);

    // Backdrop for mobile
    const backdrop = document.createElement('div');
    backdrop.id = 'notiv-sidebar-backdrop';
    backdrop.onclick = closeMobileSidebar;
    document.body.appendChild(backdrop);

    // Mobile toggle button
    const mobileBtn = document.createElement('button');
    mobileBtn.className = 'nsb-mobile-toggle';
    mobileBtn.innerHTML = '☰';
    mobileBtn.onclick = openMobileSidebar;
    document.body.appendChild(mobileBtn);

    // XP toast + level up overlay
    const toast = document.createElement('div');
    toast.id = 'notiv-xp-toast';
    toast.innerHTML = `<span class="xp-toast-icon">✦</span><span class="xp-toast-amount" id="xp-toast-amount">+50</span><span class="xp-toast-label">XP</span>`;
    document.body.appendChild(toast);

    const levelup = document.createElement('div');
    levelup.id = 'notiv-levelup';
    levelup.innerHTML = `
      <div class="levelup-card">
        <div class="levelup-icon">🏆</div>
        <div class="levelup-title">Level Up!</div>
        <div class="levelup-num" id="levelup-num">2</div>
        <div class="levelup-sub">Keep studying to reach the next level</div>
        <button class="levelup-btn" onclick="document.getElementById('notiv-levelup').classList.remove('show')">Keep going →</button>
      </div>
    `;
    document.body.appendChild(levelup);

    // Animate XP fill after paint
    requestAnimationFrame(() => {
      setTimeout(() => {
        const fill = document.getElementById('nsb-xp-fill');
        if (fill) fill.style.width = pct + '%';
      }, 300);
    });

    // Toggle button
    document.getElementById('nsb-toggle').addEventListener('click', toggleSidebar);
  }

  function toggleSidebar() {
    const sidebar = document.getElementById('notiv-sidebar');
    const btn     = document.getElementById('nsb-toggle');
    const collapsed = sidebar.classList.toggle('collapsed');
    btn.textContent = collapsed ? '›' : '‹';
    btn.title = (collapsed ? 'Expand' : 'Collapse') + ' sidebar';
    localStorage.setItem('notiv-sidebar-collapsed', collapsed ? '1' : '0');
  }

  function openMobileSidebar() {
    document.getElementById('notiv-sidebar').classList.add('mobile-open');
    document.getElementById('notiv-sidebar-backdrop').classList.add('open');
  }

  function closeMobileSidebar() {
    document.getElementById('notiv-sidebar').classList.remove('mobile-open');
    document.getElementById('notiv-sidebar-backdrop').classList.remove('open');
  }

  // ── XP Toast ────────────────────────────────────────────
  let prevXP = calcXP();
  let prevLevel = calcLevel(prevXP);

  window.notivAwardXP = function(amount, reason) {
    const toast = document.getElementById('notiv-xp-toast');
    if (!toast) return;
    document.getElementById('xp-toast-amount').textContent = '+' + amount;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);

    // Check level up
    const newXP    = calcXP();
    const newLevel = calcLevel(newXP);
    if (newLevel > prevLevel) {
      setTimeout(() => {
        document.getElementById('levelup-num').textContent = newLevel;
        document.getElementById('notiv-levelup').classList.add('show');
      }, 600);
      prevLevel = newLevel;
    }
    prevXP = newXP;

    // Refresh XP bar
    refreshXP();
  };

  function refreshXP() {
    const xp    = calcXP();
    const level = calcLevel(xp);
    const pct   = calcXPPct(xp);
    const fill  = document.getElementById('nsb-xp-fill');
    if (fill) fill.style.width = pct + '%';
    const label = document.querySelector('.nsb-xp-label');
    if (label) label.textContent = 'Level ' + level;
    const val = document.querySelector('.nsb-xp-val');
    if (val) val.textContent = xp.toLocaleString() + ' XP';
  }

  // Auto-refresh XP when localStorage changes (cross-tab)
  window.addEventListener('storage', refreshXP);

  // ── Helpers ─────────────────────────────────────────────
  function tryParse(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; }
    catch { return fallback; }
  }

  function todayStr() {
    return new Date().toISOString().split('T')[0];
  }

  function parseDate(str) {
    try { const d = new Date(str); return isNaN(d) ? '' : d.toISOString().split('T')[0]; }
    catch { return ''; }
  }

  // ── Run ──────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { inject(); wireNotivAwardXP(); });
  } else {
    inject(); wireNotivAwardXP();
  }

})();
