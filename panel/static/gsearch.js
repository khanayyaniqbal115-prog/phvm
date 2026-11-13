/* PHvm global search (v21.66): top-bar search also finds servers, users and tickets anywhere in the panel. */
(function () {
  var inp, box, timer, seq = 0, items = [], sel = -1;
  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }
  function hide() { if (box) box.hidden = true; sel = -1; }
  function render(res) {
    items = res;
    if (!res.length) { box.innerHTML = '<div class="gs-empty">No servers, users or tickets match.</div>'; box.hidden = false; return; }
    var html = '', last = '';
    res.forEach(function (r, i) {
      if (r.g !== last) { html += '<div class="gs-g">' + esc(r.g) + '</div>'; last = r.g; }
      html += '<a class="gs-i" href="' + esc(r.href) + '" data-i="' + i + '"><i class="fas fa-' + esc(r.i || 'circle') + '"></i><span><b>' + esc(r.t) + '</b><em>' + esc(r.sub) + '</em></span></a>';
    });
    box.innerHTML = html; box.hidden = false; sel = -1;
  }
  function mark() { box.querySelectorAll('.gs-i').forEach(function (a, i) { a.classList.toggle('on', i === sel); }); }
  function run() {
    var q = inp.value.trim();
    if (q.length < 2) { hide(); return; }
    var my = ++seq;
    fetch('/api/search?q=' + encodeURIComponent(q), { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (d) {
      if (my !== seq || !d.success) return; render(d.results || []);
    }).catch(function () {});
  }
  function init() {
    inp = document.getElementById('globalSearch'); if (!inp) return;
    var wrap = inp.closest('.search-box') || inp.parentNode; wrap.style.position = 'relative';
    box = document.createElement('div'); box.className = 'gs-box'; box.hidden = true; wrap.appendChild(box);
    inp.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(run, 220); });
    inp.addEventListener('keydown', function (e) {
      var n = box.querySelectorAll('.gs-i').length;
      if (e.key === 'ArrowDown' && n) { sel = (sel + 1) % n; mark(); e.preventDefault(); }
      else if (e.key === 'ArrowUp' && n) { sel = (sel - 1 + n) % n; mark(); e.preventDefault(); }
      else if (e.key === 'Enter' && sel >= 0) { var a = box.querySelectorAll('.gs-i')[sel]; if (a) location.href = a.getAttribute('href'); }
      else if (e.key === 'Escape') { hide(); inp.blur(); }
    });
    document.addEventListener('click', function (e) { if (!wrap.contains(e.target)) hide(); });
    inp.addEventListener('focus', function () { if (items.length && inp.value.trim().length >= 2) box.hidden = false; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
