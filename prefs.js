// prefs.js — reads notiv-prefs and applies them on every page load
(function () {
  const prefs = JSON.parse(localStorage.getItem('notiv-prefs') || '{}');

  // Font size
  const fontSizeMap = { small: '13px', medium: '14px', large: '15px' };
  if (prefs.fontSize) document.documentElement.style.setProperty('font-size', fontSizeMap[prefs.fontSize] || '14px');

  // Reduce motion
  if (prefs.reduceMotion) {
    const s = document.createElement('style');
    s.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}';
    document.head.appendChild(s);
  }

  // Sidebar default — override stored collapse state if pref is set
  document.addEventListener('DOMContentLoaded', function () {
    if (prefs.sidebarDefault) {
      const sidebar = document.getElementById('nav-sidebar');
      const toggleBtn = document.getElementById('sidebar-toggle-btn');
      if (sidebar && toggleBtn) {
        const stored = localStorage.getItem('notiv-sidebar-collapsed');
        // Only override if the user hasn't manually toggled this session
        const shouldCollapse = prefs.sidebarDefault === 'collapsed';
        if (stored === null) { // no manual override yet
          if (shouldCollapse) { sidebar.classList.add('collapsed'); toggleBtn.textContent = '›'; }
          else { sidebar.classList.remove('collapsed'); toggleBtn.textContent = '‹'; }
        }
      }
    }

    // Show display name in any topbar user area if present
    if (prefs.displayName) {
      const nameEl = document.getElementById('user-display-name');
      if (nameEl) nameEl.textContent = prefs.displayName;
    }
  });

  // Expose prefs globally for other scripts to read
  window.notivPrefs = prefs;
})();
