/* v21.82: live filter for the server list (dashboard / My VMs) */
(function () {
  if (!/^\/(dashboard|my-vms)\/?$/.test(location.pathname)) return;
  document.addEventListener('DOMContentLoaded', function () {
    var tb = document.querySelector('table tbody'); if (!tb) return;
    var rows = Array.prototype.slice.call(tb.querySelectorAll(':scope > tr')); if (rows.length < 4) return;
    var host = tb.closest('.card') || tb.closest('table'); var bar = document.createElement('div');
    bar.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:10px 16px;border-bottom:1px solid var(--border);';
    var inp = document.createElement('input'); inp.className = 'form-control'; inp.placeholder = 'Filter servers…'; inp.style.cssText = 'max-width:240px;height:34px;';
    bar.appendChild(inp); var st = 'all';
    [['all', 'All'], ['running', 'Running'], ['stopped', 'Stopped']].forEach(function (x) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-secondary btn-sm'; b.textContent = x[1];
      b.onclick = function () { st = x[0]; apply(); }; bar.appendChild(b); });
    var cnt = document.createElement('span'); cnt.className = 'text-muted'; cnt.style.fontSize = '12px'; bar.appendChild(cnt);
    host.insertBefore(bar, host.querySelector('table') ? host.querySelector('table').parentNode === host ? host.querySelector('table') : host.firstChild.nextSibling : host.firstChild);
    function apply() {
      var q = inp.value.trim().toLowerCase(), n = 0;
      rows.forEach(function (r) { var t = r.textContent.toLowerCase();
        var ok = (!q || t.indexOf(q) >= 0) && (st === 'all' || t.indexOf(st) >= 0 && (st !== 'stopped' || t.indexOf('running') < 0 || t.indexOf('stopped') >= 0));
        r.style.display = ok ? '' : 'none'; if (ok) n++; });
      cnt.textContent = n + ' of ' + rows.length;
    }
    inp.addEventListener('input', apply); apply();
  });
})();
