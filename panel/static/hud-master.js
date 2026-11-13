// PHvm v21 HUD: theme switch (Cyber-HUD <-> Classic Black+Platinum). Ctrl+K palette, live VM filter and language switch already live in palette.js / vmfilter.js / lang.js.
(function () {
  function on() { return document.documentElement.classList.contains('hud'); }
  function paint() { var b = document.getElementById('hudToggle'); if (b) var s = b.querySelector('span'); if (s) s.textContent = on() ? 'Look: Cyber-HUD (tap for Classic)' : 'Look: Classic (tap for HUD)'; }
  window.phvmToggleHud = function () {
    var h = document.documentElement.classList;
    h.toggle('hud');
    try { localStorage.setItem('phvm_hud', on() ? '1' : '0'); } catch (e) {}
    paint();
  };
  document.addEventListener('DOMContentLoaded', paint);
})();
