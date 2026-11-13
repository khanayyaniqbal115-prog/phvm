/* PHvm accent picker (v21.55): applied before first paint, remembered per browser. */
(function () {
  var P = {
    platinum: ['#e6e6ea', '#a9a9b3', '#ffffff', '#ffffff'],
    indigo: ['#5f6df5', '#8b6cf5', '#9aa4ff', '#7482ff'],
    emerald: ['#18b88a', '#2dd4bf', '#5ee9b5', '#34d3a0'],
    rose: ['#ec4f8b', '#f97316', '#ff8fb8', '#f4679e'],
    amber: ['#e8a017', '#f97316', '#fbbf24', '#f2b13a'],
    cyan: ['#22a6e8', '#6366f1', '#7dd3fc', '#41b7f0'],
    violet: ['#8b5cf6', '#d946ef', '#c4b5fd', '#9d78f8'],
    crimson: ['#ff2a4d', '#ff6a00', '#ff7a8f', '#ff4d6a'],
    toxic: ['#39ff88', '#00d9a5', '#9dffc4', '#5bff9f'],
    plasma: ['#b026ff', '#ff2bd6', '#d99bff', '#c14dff'],
    ice: ['#00e5ff', '#3b82f6', '#8cf3ff', '#33ecff']
  };
  function apply(n) {
    if (!document.documentElement.classList.contains('danger')) return;
    var c = P[n] || P[DEF], st = document.getElementById('accentStyle');
    if (!st) { st = document.createElement('style'); st.id = 'accentStyle'; document.head.appendChild(st); }
    var h = c[0].replace('#', ''), rgb = [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16); }).join(',');
    st.textContent = 'html,html body,html body.theme-light{--v-accent:' + c[0] + ';--v-accent-2:' + c[1] + ';--v-accent-text:' + c[2] + ';--accent:' + c[0] + ';--accent-hover:' + c[3] + ';--accent-dim:rgba(' + rgb + ',.18);--v-ring:rgba(' + rgb + ',.35);--accent2:' + c[1] + ';--d-on:' + (n === 'platinum' ? '#0b0b0d' : '#fff') + ';--d-mix:' + (n === 'platinum' ? '78%' : '55%') + ';--d-ts:' + (n === 'platinum' ? 'none' : '0 1px 8px rgba(0,0,0,.6)') + ';}';
    var m = document.querySelector('meta[name=theme-color]'); if (m) m.setAttribute('content', c[0]);
    document.querySelectorAll('.acc-dot').forEach(function (b) { b.classList.toggle('on', b.dataset.a === n); });
  }
  var DEF = 'platinum', cur = DEF; try { cur = localStorage.getItem('phvm_accent_v3') || DEF; } catch (e) {}
  apply(cur);
  window.phvmAccent = function (n) { try { localStorage.setItem('phvm_accent_v3', n); } catch (e) {} apply(n); };
  document.addEventListener('DOMContentLoaded', function () { document.querySelectorAll('.acc-row').forEach(function (r) { r.hidden = !document.documentElement.classList.contains('danger'); }); apply(cur = (function () { try { return localStorage.getItem('phvm_accent_v3') || DEF; } catch (e) { return DEF; } })()); });
})();

window.phvmToggleStyle = function () {
  var on = document.documentElement.classList.contains('danger');
  try { localStorage.setItem('phvm_style', on ? 'classic' : 'danger'); } catch (e) {}
  location.reload();
};
document.addEventListener('DOMContentLoaded', function () { var l = document.getElementById('styleLabel'); if (l) l.textContent = 'Style: ' + (document.documentElement.classList.contains('danger') ? 'Danger' : 'Platinum'); });
