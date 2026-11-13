/* PHvm animation helpers (v21.51): stagger, scroll reveal, count-up, button ripple, top progress bar, on/off switch. */
(function () {
  'use strict';
  var root = document.documentElement, off = false;
  try { off = localStorage.getItem('phvm_anim') === 'off'; } catch (e) {}
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (off) root.classList.add('no-anim');
  function label() { var l = document.getElementById('animLabel'); if (l) l.textContent = 'Animations: ' + (root.classList.contains('no-anim') ? 'Off' : 'On'); }
  window.phvmToggleAnim = function () {
    root.classList.toggle('no-anim');
    try { localStorage.setItem('phvm_anim', root.classList.contains('no-anim') ? 'off' : 'on'); } catch (e) {}
    label();
  };
  function ready(fn) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn(); }
  ready(function () {
    label();
    if (off || reduce) return;
    var vh = window.innerHeight || 800;
    // 1. stagger index for blocks and table rows
    var n = 0;
    document.querySelectorAll('.page-header, .card, .stat-card, .action-card, .plan-card, .product-card').forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < vh) { el.style.setProperty('--i', Math.min(n++, 14)); }
      else if ('IntersectionObserver' in window && !el.closest('.pane:not(.active)') && !el.closest('.dd-menu')) { el.classList.add('rv-wait'); io.observe(el); }
    });
    document.querySelectorAll('.data-table tbody').forEach(function (tb) {
      Array.prototype.slice.call(tb.rows, 0, 16).forEach(function (tr, i) { tr.style.setProperty('--i', i); });
    });
    // 2. sidebar items slide in once per browser session
    var seen = false; try { seen = sessionStorage.getItem('phvm_intro') === '1'; sessionStorage.setItem('phvm_intro', '1'); } catch (e) {}
    if (!seen) {
      root.classList.add('nav-intro');
      document.querySelectorAll('.sidebar-nav .nav-item').forEach(function (el, i) { el.style.setProperty('--i', Math.min(i, 16)); });
      setTimeout(function () { root.classList.remove('nav-intro'); }, 1800);
    }
  });
  var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('rv-in'); e.target.classList.remove('rv-wait'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 }) : null;
  // 4. button ripple
  document.addEventListener('click', function (ev) {
    if (root.classList.contains('no-anim') || reduce) return;
    var b = ev.target.closest && ev.target.closest('.btn');
    if (!b || b.disabled) return;
    var r = b.getBoundingClientRect(), s = document.createElement('span');
    s.className = 'ripple'; s.style.left = (ev.clientX - r.left) + 'px'; s.style.top = (ev.clientY - r.top) + 'px';
    b.appendChild(s); setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 650);
    var ti = ev.target.closest && ev.target.closest('#themeToggle');
    if (ti) { var ic = document.getElementById('themeIcon'); if (ic) { ic.classList.remove('spin'); void ic.offsetWidth; ic.classList.add('spin'); } }
  }, true);
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest && ev.target.closest('#themeToggle'), ic = document.getElementById('themeIcon');
    if (t && ic && !root.classList.contains('no-anim')) { ic.classList.remove('spin'); void ic.offsetWidth; ic.classList.add('spin'); }
  });
  // 5. thin progress bar while the next page loads
  var bar = null, timer = null;
  function start() {
    if (root.classList.contains('no-anim') || reduce) return;
    if (!bar) { bar = document.createElement('div'); bar.id = 'phvmBar'; document.body.appendChild(bar); }
    bar.style.opacity = '1'; bar.style.width = '18%';
    clearInterval(timer); var w = 18; timer = setInterval(function () { w += (88 - w) * 0.12; bar.style.width = w + '%'; }, 220);
  }
  window.addEventListener('beforeunload', start);
  window.addEventListener('pageshow', function () { if (bar) { clearInterval(timer); bar.style.width = '0'; bar.style.opacity = '0'; } });
})();
