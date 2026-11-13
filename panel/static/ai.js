(function () {
  var hist = [], box, log, inp, busy = false;
  function add(role, text) {
    var d = document.createElement('div'); d.className = 'aiq-m aiq-' + role; d.textContent = text; log.appendChild(d); log.scrollTop = log.scrollHeight; return d;
  }
  function open() { box.style.display = 'flex'; inp.focus(); if (!log.children.length) add('a', 'Hi! Ask me anything about your servers or the panel. I can also check logs and start, stop or restart your server.'); }
  async function send() {
    var q = inp.value.trim(); if (!q || busy) return; inp.value = ''; add('u', q); hist.push({role: 'user', content: q}); busy = true;
    var w = add('a', '…');
    try {
      var r = await (await fetch('/ai/chat', {method: 'POST', headers: {'Content-Type': 'application/json', 'X-CSRF-Token': window.PHVM_CSRF || ''}, body: JSON.stringify({messages: hist})})).json();
      var t = r.success ? r.reply : (r.message || 'Error');
      if (r.success && r.actions && r.actions.length) t += '\n\n✔ ' + r.actions.join(', ');
      w.textContent = t; if (r.success) hist.push({role: 'assistant', content: r.reply});
    } catch (e) { w.textContent = 'Cannot reach the panel.'; }
    busy = false; log.scrollTop = log.scrollHeight;
  }
  function init() {
    if (!window.PHVM_AI) return;
    var st = document.createElement('style');
    st.textContent = '#aiq-b{position:fixed;right:18px;bottom:18px;width:52px;height:52px;border-radius:50%;border:1px solid var(--border);background:linear-gradient(145deg,#f4f4f7,#b9b9c2);color:#0b0b0d;font-size:20px;cursor:pointer;z-index:9998;box-shadow:0 8px 24px rgba(0,0,0,.45)}' +
      '#aiq{position:fixed;right:18px;bottom:80px;width:min(380px,calc(100vw - 36px));height:min(520px,calc(100vh - 120px));display:none;flex-direction:column;background:#101013;border:1px solid var(--border);border-radius:16px;z-index:9999;box-shadow:0 18px 50px rgba(0,0,0,.6);overflow:hidden}' +
      '#aiq header{padding:12px 14px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;font-weight:600}#aiq header button{background:none;border:0;color:inherit;cursor:pointer;font-size:16px}' +
      '#aiq .log{flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:8px}.aiq-m{padding:9px 12px;border-radius:12px;max-width:88%;white-space:pre-wrap;font-size:13.5px;line-height:1.45}.aiq-a{background:#1b1b20;align-self:flex-start}.aiq-u{background:#e9e9ee;color:#0b0b0d;align-self:flex-end}' +
      '#aiq form{display:flex;gap:8px;padding:10px;border-top:1px solid var(--border)}#aiq input{flex:1;background:#0b0b0d;border:1px solid var(--border);border-radius:10px;color:inherit;padding:9px 11px}#aiq form button{border-radius:10px;border:0;background:#e9e9ee;color:#0b0b0d;padding:0 14px;font-weight:600;cursor:pointer}';
    document.head.appendChild(st);
    var b = document.createElement('button'); b.id = 'aiq-b'; b.title = 'Ask the assistant'; b.innerHTML = '<i class="fas fa-robot"></i>'; b.setAttribute('aria-label', 'AI assistant');
    box = document.createElement('div'); box.id = 'aiq';
    box.innerHTML = '<header><span>PHvm Assistant</span><button type="button" aria-label="Close">&times;</button></header><div class="log"></div><form><input placeholder="Ask something…" maxlength="500" autocomplete="off"><button>Send</button></form>';
    document.body.appendChild(b); document.body.appendChild(box);
    log = box.querySelector('.log'); inp = box.querySelector('input');
    b.onclick = function () { box.style.display === 'flex' ? box.style.display = 'none' : open(); };
    box.querySelector('header button').onclick = function () { box.style.display = 'none'; };
    box.querySelector('form').onsubmit = function (e) { e.preventDefault(); send(); };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
