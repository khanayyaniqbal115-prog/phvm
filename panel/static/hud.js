/* PHvm HUD (v21.59): status bar (ping, clock), grid, cursor reticle, one-time boot flash. Only shown in the Danger style. */
(function () {
  var root = document.documentElement;
  function ready(f) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', f); else f(); }
  ready(function () {
    if (!root.classList.contains('danger')) return;
    var b = document.body, ver = b.dataset.ver || '', user = b.dataset.user || '';
    var sb = document.querySelector('.sidebar-brand');
    if (sb && sb.parentNode && !document.querySelector('.side-hud')) {
      var sh = document.createElement('div'); sh.className = 'side-hud';
      sh.innerHTML = '<span>Link <b>secure</b></span><span class="sig"><i></i><i></i><i></i><i></i></span>';
      sb.parentNode.insertBefore(sh, sb.nextSibling);
    }
    var g = document.createElement('div'); g.className = 'hud-grid'; b.insertBefore(g, b.firstChild);
    var h = document.createElement('div'); h.id = 'hud';
    h.innerHTML = '<span><span class="dot"></span><b class="st">ONLINE</b></span><span class="hide-m">PING <b class="ping">--</b></span><span class="opt">' + (user ? 'USER <b></b>' : '') + '</span><span class="hide-m clk"></span><span class="sp"><span class="hide-m">PHVM ' + ver + '</span> &nbsp; <kbd>CTRL</kbd>+<kbd>K</kbd></span>';
    var u = h.querySelector('.opt b'); if (u) u.textContent = user;
    b.appendChild(h);
    var st = h.querySelector('.st'), dot = h.querySelector('.dot'), pg = h.querySelector('.ping'), clk = h.querySelector('.clk');
    function tick() { var d = new Date(); clk.textContent = d.toLocaleTimeString([], { hour12: false }) + ' · ' + d.toLocaleDateString([], { day: '2-digit', month: 'short' }); }
    tick(); setInterval(tick, 1000);
    function ping() {
      if (document.hidden) return;
      var t0 = performance.now();
      fetch('/manifest.webmanifest?_=' + Date.now(), { cache: 'no-store' }).then(function () {
        var ms = Math.round(performance.now() - t0); pg.textContent = ms + ' ms'; pg.className = 'ping ' + (ms < 150 ? 'ok' : ms < 500 ? 'mid' : 'bad');
        st.textContent = 'ONLINE'; dot.classList.remove('off');
      }).catch(function () { pg.textContent = '--'; st.textContent = 'OFFLINE'; dot.classList.add('off'); });
    }
    ping(); setInterval(ping, 15000);
    window.addEventListener('offline', function () { st.textContent = 'OFFLINE'; dot.classList.add('off'); });
    window.addEventListener('online', ping);
    // reticle that follows the mouse (desktop only)
    if (window.matchMedia && matchMedia('(hover: hover) and (min-width: 901px)').matches) {
      var r = document.createElement('div'); r.id = 'hudRet'; b.appendChild(r); var x = 0, y = 0, tx = 0, ty = 0, run = false;
      function loop() { x += (tx - x) * 0.28; y += (ty - y) * 0.28; r.style.transform = 'translate(' + x + 'px,' + y + 'px)'; if (Math.abs(tx - x) + Math.abs(ty - y) > 0.3) requestAnimationFrame(loop); else run = false; }
      document.addEventListener('mousemove', function (e) { tx = e.clientX; ty = e.clientY; r.classList.add('on'); if (!run) { run = true; requestAnimationFrame(loop); } }, { passive: true });
      document.addEventListener('mouseleave', function () { r.classList.remove('on'); });
      document.addEventListener('mouseover', function (e) { r.classList.toggle('hot', !!(e.target.closest && e.target.closest('a, button, .btn, .nav-item, [onclick]'))); }, { passive: true });
    }
    // boot flash once per browser session
    var seen = false; try { seen = sessionStorage.getItem('phvm_boot') === '1'; sessionStorage.setItem('phvm_boot', '1'); } catch (e) {}
    if (!seen && root.classList.contains('danger') && !root.classList.contains('no-anim') && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) {
      var bt = document.createElement('div'); bt.id = 'hudBoot'; bt.innerHTML = '<div class="t">PHVM</div><div class="bar"><i></i></div><div class="s"></div>'; b.appendChild(bt);
      var lines = ['initialising core', 'linking nodes', 'systems online'], i = 0, s = bt.querySelector('.s');
      (function nx() { if (i < lines.length) { s.textContent = lines[i++]; setTimeout(nx, 330); } })();
      setTimeout(function () { if (bt.parentNode) bt.parentNode.removeChild(bt); }, 1800);
    }
  });
})();
