// ── Notiv AI Assistant ──
// Add to any page: <script src="ai-assistant.js" defer></script>
// Requires auth.js to already be included

(function() {
  const WORKER_URL = 'https://tiny-hat-80bd.charlieweis6.workers.dev';

  // Don't inject on login/onboarding
  if (window.location.pathname.includes('login') || window.location.pathname.includes('onboarding')) return;

  // Inject styles
  const style = document.createElement('style');
  style.textContent = `
    #notiv-ai-btn {
      position: fixed; bottom: 24px; right: 24px; z-index: 8000;
      width: 48px; height: 48px; border-radius: 50%;
      background: #c8f05e; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      font-size: 20px; box-shadow: 0 4px 20px rgba(200,240,94,0.3);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    #notiv-ai-btn:hover { transform: scale(1.08); box-shadow: 0 6px 28px rgba(200,240,94,0.4); }
    #notiv-ai-btn.open { background: #1e1e24; box-shadow: 0 4px 20px rgba(0,0,0,0.4); }

    #notiv-ai-panel {
      position: fixed; bottom: 84px; right: 24px; z-index: 8000;
      width: 360px; max-height: 520px;
      background: #0f0f12; border: 1px solid #2e2e38;
      border-radius: 16px; display: none; flex-direction: column;
      overflow: hidden; box-shadow: 0 16px 48px rgba(0,0,0,0.6);
      animation: ai-slide-up 0.2s ease;
    }
    #notiv-ai-panel.open { display: flex; }
    @keyframes ai-slide-up { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }

    #ai-header {
      padding: 14px 16px; border-bottom: 1px solid #22222a;
      display: flex; align-items: center; gap: 10px;
    }
    .ai-avatar {
      width: 28px; height: 28px; border-radius: 50%;
      background: rgba(200,240,94,0.12); border: 1px solid rgba(200,240,94,0.25);
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; flex-shrink: 0;
    }
    .ai-header-text { flex: 1; }
    .ai-name { font-size: 13px; font-weight: 500; color: #f0ede8; font-family: 'Instrument Sans', sans-serif; }
    .ai-status { font-size: 11px; color: #5a5855; font-family: 'DM Mono', monospace; }
    .ai-close {
      background: none; border: none; color: #5a5855; cursor: pointer;
      font-size: 16px; padding: 2px 6px; border-radius: 5px;
      transition: color 0.12s;
    }
    .ai-close:hover { color: #f0ede8; }

    #ai-messages {
      flex: 1; overflow-y: auto; padding: 12px;
      display: flex; flex-direction: column; gap: 10px;
    }
    #ai-messages::-webkit-scrollbar { width: 4px; }
    #ai-messages::-webkit-scrollbar-track { background: transparent; }
    #ai-messages::-webkit-scrollbar-thumb { background: #22222a; border-radius: 2px; }

    .ai-msg { display: flex; gap: 8px; align-items: flex-start; }
    .ai-msg.user { flex-direction: row-reverse; }
    .ai-msg-bubble {
      max-width: 260px; padding: 9px 13px; border-radius: 12px;
      font-size: 13px; line-height: 1.55; font-family: 'Instrument Sans', sans-serif;
    }
    .ai-msg.assistant .ai-msg-bubble {
      background: #16161a; border: 1px solid #22222a; color: #9b9893;
      border-radius: 12px 12px 12px 4px;
    }
    .ai-msg.user .ai-msg-bubble {
      background: rgba(200,240,94,0.10); border: 1px solid rgba(200,240,94,0.2);
      color: #c8f05e; border-radius: 12px 12px 4px 12px;
    }
    .ai-msg-bubble strong { color: #c8f05e; }
    .ai-msg-bubble code { font-family: 'DM Mono', monospace; font-size: 11px; background: #1e1e24; padding: 1px 4px; border-radius: 3px; color: #a07ee8; }

    .ai-typing { display: flex; gap: 4px; align-items: center; padding: 9px 13px; }
    .ai-typing span { width: 6px; height: 6px; border-radius: 50%; background: #5a5855; animation: ai-bounce 1.2s ease infinite; }
    .ai-typing span:nth-child(2) { animation-delay: 0.2s; }
    .ai-typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes ai-bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }

    #ai-suggestions {
      display: flex; gap: 5px; padding: 0 12px 8px; flex-wrap: wrap;
    }
    .ai-suggestion {
      font-size: 11px; padding: 4px 10px; border-radius: 20px;
      border: 1px solid #22222a; background: #16161a; color: #5a5855;
      cursor: pointer; transition: all 0.12s; font-family: 'Instrument Sans', sans-serif;
      white-space: nowrap;
    }
    .ai-suggestion:hover { border-color: rgba(200,240,94,0.2); color: #c8f05e; background: rgba(200,240,94,0.06); }

    #ai-input-row {
      padding: 10px 12px; border-top: 1px solid #22222a;
      display: flex; gap: 8px;
    }
    #ai-input {
      flex: 1; background: #16161a; border: 1px solid #22222a;
      border-radius: 10px; padding: 8px 12px;
      font-family: 'Instrument Sans', sans-serif; font-size: 13px;
      color: #f0ede8; outline: none; transition: border-color 0.15s;
      resize: none; height: 36px; line-height: 20px;
    }
    #ai-input:focus { border-color: rgba(200,240,94,0.25); }
    #ai-input::placeholder { color: #383634; }
    #ai-send {
      width: 36px; height: 36px; border-radius: 10px;
      background: #c8f05e; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; transition: background 0.15s; flex-shrink: 0;
      color: #080809;
    }
    #ai-send:hover { background: #d8ff74; }
    #ai-send:disabled { opacity: 0.5; cursor: not-allowed; }
  `;
  document.head.appendChild(style);

  // Inject HTML
  const btn = document.createElement('button');
  btn.id = 'notiv-ai-btn';
  btn.innerHTML = '✦';
  btn.title = 'Ask Notiv AI';
  btn.onclick = togglePanel;
  document.body.appendChild(btn);

  const panel = document.createElement('div');
  panel.id = 'notiv-ai-panel';
  panel.innerHTML = `
    <div id="ai-header">
      <div class="ai-avatar">✦</div>
      <div class="ai-header-text">
        <div class="ai-name">Notiv AI</div>
        <div class="ai-status" id="ai-status">Ready to help</div>
      </div>
      <button class="ai-close" onclick="document.getElementById('notiv-ai-panel').classList.remove('open');document.getElementById('notiv-ai-btn').classList.remove('open');">✕</button>
    </div>
    <div id="ai-messages"></div>
    <div id="ai-suggestions"></div>
    <div id="ai-input-row">
      <input id="ai-input" placeholder="Ask anything about studying…" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();window._notivAISend();}">
      <button id="ai-send" onclick="window._notivAISend()">→</button>
    </div>
  `;
  document.body.appendChild(panel);

  // Message history
  let messages = [];
  let isTyping = false;
  const PAGE_CONTEXT = getPageContext();

  // Welcome message
  addMessage('assistant', `Hi! I'm your Notiv study assistant. I can help you with **study tips**, **explain concepts**, **create practice questions**, or answer questions about your **${PAGE_CONTEXT.page}**. What do you need?`);
  showSuggestions(PAGE_CONTEXT.suggestions);

  function getPageContext() {
    const path = window.location.pathname;
    if (path.includes('notes')) return { page: 'Notes Library', suggestions: ['How do I get better notes?', 'Tips for studying from PDFs', 'What makes a good summary?'] };
    if (path.includes('essay')) return { page: 'Essay Editor', suggestions: ['How to improve my essay structure?', 'Tips for a strong introduction', 'How to cite sources correctly?'] };
    if (path.includes('flashcards')) return { page: 'Flashcards', suggestions: ['Best spaced repetition tips', 'How many cards per session?', 'Active recall techniques'] };
    if (path.includes('planner')) return { page: 'Study Planner', suggestions: ['How to study for an exam in a week?', 'Best time of day to study', 'How to avoid burnout?'] };
    if (path.includes('quiz')) return { page: 'Quiz', suggestions: ['How to retain what I learn?', 'Test anxiety tips', 'How to improve recall speed?'] };
    if (path.includes('dashboard')) return { page: 'Dashboard', suggestions: ['How to build a study streak?', 'Study tips for today', 'Improve my XP fast'] };
    return { page: 'Notiv', suggestions: ['Study tips for exams', 'How to take better notes?', 'Best study techniques'] };
  }

  function togglePanel() {
    const p = document.getElementById('notiv-ai-panel');
    const b = document.getElementById('notiv-ai-btn');
    const isOpen = p.classList.contains('open');
    p.classList.toggle('open', !isOpen);
    b.classList.toggle('open', !isOpen);
    b.innerHTML = isOpen ? '✦' : '✕';
    if (!isOpen) document.getElementById('ai-input').focus();
  }

  function addMessage(role, text) {
    messages.push({ role, content: text });
    const container = document.getElementById('ai-messages');
    const msg = document.createElement('div');
    msg.className = 'ai-msg ' + role;
    const bubble = document.createElement('div');
    bubble.className = 'ai-msg-bubble';
    bubble.innerHTML = formatText(text);
    msg.appendChild(bubble);
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
    return bubble;
  }

  function formatText(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  function showTyping() {
    const container = document.getElementById('ai-messages');
    const el = document.createElement('div');
    el.className = 'ai-msg assistant';
    el.id = 'ai-typing-indicator';
    el.innerHTML = `<div class="ai-msg-bubble ai-typing"><span></span><span></span><span></span></div>`;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  }

  function removeTyping() {
    const el = document.getElementById('ai-typing-indicator');
    if (el) el.remove();
  }

  function showSuggestions(suggs) {
    const el = document.getElementById('ai-suggestions');
    el.innerHTML = '';
    suggs.forEach(s => {
      const chip = document.createElement('button');
      chip.className = 'ai-suggestion';
      chip.textContent = s;
      chip.onclick = () => { document.getElementById('ai-input').value = s; window._notivAISend(); };
      el.appendChild(chip);
    });
  }

  window._notivAISend = async function() {
    const input = document.getElementById('ai-input');
    const text = input.value.trim();
    if (!text || isTyping) return;
    input.value = '';
    document.getElementById('ai-suggestions').innerHTML = '';
    addMessage('user', text);
    isTyping = true;
    document.getElementById('ai-send').disabled = true;
    document.getElementById('ai-status').textContent = 'Thinking…';
    showTyping();

    // Build context from page data
    const notes = JSON.parse(localStorage.getItem('studyai-notes') || '[]');
    const essays = JSON.parse(localStorage.getItem('studyai-essay-history') || '[]');
    const decks = JSON.parse(localStorage.getItem('studyai-decks') || '[]');
    const contextSummary = `User has ${notes.length} notes (${notes.filter(n=>n.polishedText).length} polished), ${essays.length} essays analysed, ${decks.length} flashcard decks.`;

    const systemPrompt = `You are Notiv AI, a friendly and knowledgeable study assistant built into the Notiv study app. You're currently on the ${PAGE_CONTEXT.page} page.

Context about this user: ${contextSummary}

Your role:
- Help students study more effectively
- Explain concepts clearly and concisely
- Give practical, actionable study tips
- Answer questions about the app's features
- Keep responses focused and not too long (2-4 sentences usually)
- Use **bold** for key terms
- Be encouraging and supportive

Don't make up information about the user's specific notes content — only use what's in the context.`;

    try {
      const apiMessages = [
        ...messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
      ];
      // Remove the message we just added (it's already in messages[])
      apiMessages[apiMessages.length - 1] = { role: 'user', content: text };

      const res = await fetch(WORKER_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514', max_tokens: 400,
          system: systemPrompt,
          messages: apiMessages,
        }),
      });
      removeTyping();
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      const reply = data.content.map(b => b.text || '').join('');
      addMessage('assistant', reply);
      document.getElementById('ai-status').textContent = 'Ready to help';
    } catch (err) {
      removeTyping();
      addMessage('assistant', 'Sorry, I couldn\'t connect right now. Try again in a moment.');
      document.getElementById('ai-status').textContent = 'Offline';
    } finally {
      isTyping = false;
      document.getElementById('ai-send').disabled = false;
    }
  };
})();
