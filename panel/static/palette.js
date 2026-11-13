/* PHvm command palette (v21.58): Ctrl+K or "/" → jump to any page or server. Built from the links already on the page. */
(function () {
  var box, input, list, items = [], sel = 0, open = false;
  function collect() {
    var seen = {}, out = [];
    function add(a, group) {
      var href = a.getAttribute('href') || '', t = (a.textContent || '').replace(/\s+/g, ' ').trim();
      if (!href || href[0] === '#' || href.indexOf('javascript') === 0 || !t || t.length > 60 || seen[href]) return;
      seen[href] = 1; out.push({ t: t, href: href, g: group });
    }
    document.querySelectorAll('.sidebar a[href]').forEach(function (a) { add(a, 'Go to'); });
    document.querySelectorAll('.content a[href^="/vm/"], .content a[href^="/admin/"]').forEach(function (a) { if (!a.classList.contains('btn') || a.textContent.trim().length > 3) add(a, 'On this page'); });
    return out;
  }
  function build() {
    box = document.createElement('div'); box.id = 'cmdk'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Command palette');
    box.innerHTML = '<div class="cmdk-bg"></div><div class="cmdk-box"><input class="cmdk-in" placeholder="Jump to… (type a page or server name)" autocomplete="off" spellcheck="false"><div class="cmdk-list"></div><div class="cmdk-foot"><span>↑↓ move</span><span>Enter open</span><span>Esc close</span></div></div>';
    document.body.appendChild(box); input = box.querySelector('.cmdk-in'); list = box.querySelector('.cmdk-list');
    box.querySelector('.cmdk-bg').addEventListener('click', close);
    input.addEventListener('input', render);
    input.addEventListener('keydown', function (e) {
      var n = list.children.length;
      if (e.key === 'ArrowDown') { sel = (sel + 1) % Math.max(n, 1); mark(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { sel = (sel - 1 + n) % Math.max(n, 1); mark(); e.preventDefault(); }
      else if (e.key === 'Enter') { var el = list.children[sel]; if (el && el.dataset.href) { location.href = el.dataset.href; } }
      else if (e.key === 'Escape') close();
    });
  }
  function score(q, t) {
    t = t.toLowerCase(); if (!q) return 1;
    var i = t.indexOf(q); if (i >= 0) return 100 - i;
    var j = 0; for (var k = 0; k < t.length && j < q.length; k++) if (t[k] === q[j]) j++;
    return j === q.length ? 10 : 0;
  }
  function render() {
    var q = input.value.trim().toLowerCase(), r = items.map(function (x) { return [score(q, x.t), x]; }).filter(function (p) { return p[0] > 0; });
    r.sort(function (a, b) { return b[0] - a[0]; }); list.textContent = ''; sel = 0;
    r.slice(0, 40).forEach(function (p) {
      var d = document.createElement('div'); d.className = 'cmdk-item'; d.dataset.href = p[1].href;
      var s = document.createElement('span'); s.textContent = p[1].t; var g = document.createElement('em'); g.textContent = p[1].g;
      d.append(s, g); d.addEventListener('click', function () { location.href = d.dataset.href; }); d.addEventListener('mousemove', function () { sel = Array.prototype.indexOf.call(list.children, d); mark(); });
      list.appendChild(d);
    });
    if (!list.children.length) { var e = document.createElement('div'); e.className = 'cmdk-empty'; e.textContent = 'Nothing matches “' + input.value + '”'; list.appendChild(e); }
    mark();
  }
  function mark() { Array.prototype.forEach.call(list.children, function (c, i) { c.classList.toggle('on', i === sel); if (i === sel && c.scrollIntoView) c.scrollIntoView({ block: 'nearest' }); }); }
  function openIt() { if (!box) build(); items = collect(); box.classList.add('show'); open = true; input.value = ''; render(); setTimeout(function () { input.focus(); }, 20); }
  function close() { if (box) box.classList.remove('show'); open = false; }
  window.phvmPalette = openIt;
  document.addEventListener('keydown', function (e) {
    var tag = (e.target.tagName || '').toLowerCase(), typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); open ? close() : openIt(); }
    else if (e.key === '/' && !typing && !open) { e.preventDefault(); openIt(); }
    else if (e.key === 'Escape' && open) close();
  });
})();
