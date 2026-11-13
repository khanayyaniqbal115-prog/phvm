/* PHvm language menu (v21.64): English, Urdu (built-in dictionary) and every language Google Translate supports. */
(function () {
  var L = [['en', 'English'], ['ur', 'اردو'], ['hi', 'हिन्दी'], ['ar', 'العربية'], ['bn', 'বাংলা'], ['es', 'Español'], ['fr', 'Français'], ['de', 'Deutsch'], ['pt', 'Português'], ['ru', 'Русский'],
    ['zh-CN', '中文 (简体)'], ['ja', '日本語'], ['ko', '한국어'], ['tr', 'Türkçe'], ['id', 'Bahasa Indonesia'], ['fa', 'فارسی'], ['it', 'Italiano'], ['vi', 'Tiếng Việt'], ['th', 'ไทย'],
    ['nl', 'Nederlands'], ['pl', 'Polski'], ['uk', 'Українська'], ['sw', 'Kiswahili'], ['ta', 'தமிழ்'], ['pa', 'ਪੰਜਾਬੀ'], ['ps', 'پښتو'], ['ms', 'Melayu'], ['tl', 'Filipino'], ['he', 'עברית'], ['el', 'Ελληνικά']];
  var NAME = {}; L.forEach(function (x) { NAME[x[0]] = x[1]; });
  function cookie(n) { var m = document.cookie.match('(?:^|; )' + n + '=([^;]*)'); return m ? decodeURIComponent(m[1]) : ''; }
  function setG(code) {
    var host = location.hostname, v = code ? '/en/' + code : '', exp = code ? '' : ';expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = 'googtrans=' + v + ';path=/;max-age=' + (code ? 31536000 : 0) + exp;
    document.cookie = 'googtrans=' + v + ';path=/;domain=' + host + ';max-age=' + (code ? 31536000 : 0) + exp;
  }
  var gCode = (cookie('googtrans').split('/')[2] || ''), saved = 'en';
  try { saved = localStorage.getItem('phvm_lang') || 'en'; } catch (e) {}
  var cur = gCode || (saved === 'ur' ? 'ur' : 'en');
  var loaded = false;
  function loadGT(cb) {
    if (loaded) { cb && cb(); return; } loaded = true;
    window.googleTranslateElementInit = function () {
      try { new google.translate.TranslateElement({ pageLanguage: 'en', autoDisplay: false, layout: google.translate.TranslateElement.InlineLayout.SIMPLE }, 'google_translate_element'); } catch (e) {}
      cb && cb();
    };
    var s = document.createElement('script'); s.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit'; s.async = true;
    s.onerror = function () { loaded = false; }; document.head.appendChild(s);
  }
  function choose(code) {
    try { localStorage.setItem('phvm_lang', code === 'ur' ? 'ur' : 'en'); } catch (e) {}
    setG(code === 'en' || code === 'ur' ? '' : code);
    location.reload();
  }
  function protect() {
    document.querySelectorAll('pre, code, textarea, .mono, .xterm, [id*="console"], [id*="terminal"], .brand-text, .user-chip .name, .cmdk-box').forEach(function (e) { e.setAttribute('translate', 'no'); e.classList.add('notranslate'); });
  }
  function build() {
    var host = document.querySelector('.topbar-right'), old = document.getElementById('langToggle');
    if (!host) return;
    if (old) old.remove();
    var w = document.createElement('div'); w.className = 'lang-wrap'; w.id = 'langWrap';
    var b = document.createElement('button'); b.type = 'button'; b.id = 'langBtn'; b.className = 'btn btn-secondary btn-sm'; b.title = 'Language';
    b.innerHTML = '<i class="fas fa-globe"></i> <span></span>'; b.querySelector('span').textContent = (NAME[cur] || cur).split(' ')[0];
    var m = document.createElement('div'); m.className = 'lang-menu'; m.hidden = true;
    var q = document.createElement('input'); q.className = 'lang-q'; q.placeholder = 'Search language…'; q.setAttribute('translate', 'no'); m.appendChild(q);
    var list = document.createElement('div'); list.className = 'lang-list notranslate'; list.setAttribute('translate', 'no'); m.appendChild(list);
    function fill(f) {
      list.textContent = '';
      L.filter(function (x) { return !f || (x[1] + ' ' + x[0]).toLowerCase().indexOf(f) >= 0; }).forEach(function (x) {
        var a = document.createElement('button'); a.type = 'button'; a.className = 'lang-item' + (x[0] === cur ? ' on' : ''); a.textContent = x[1];
        a.addEventListener('click', function () { choose(x[0]); }); list.appendChild(a);
      });
      var more = document.createElement('button'); more.type = 'button'; more.className = 'lang-item more'; more.textContent = 'More languages (all)…';
      more.addEventListener('click', function () { document.getElementById('google_translate_element').classList.add('show'); loadGT(); m.hidden = true; });
      list.appendChild(more);
    }
    fill(''); q.addEventListener('input', function () { fill(q.value.trim().toLowerCase()); });
    b.addEventListener('click', function (e) { e.stopPropagation(); m.hidden = !m.hidden; if (!m.hidden) { q.value = ''; fill(''); setTimeout(function () { q.focus(); }, 20); } });
    document.addEventListener('click', function (e) { if (!w.contains(e.target)) m.hidden = true; });
    w.append(b, m); host.insertBefore(w, host.firstChild);
    var g = document.createElement('div'); g.id = 'google_translate_element'; document.body.appendChild(g);
    var x = document.createElement('button'); x.type = 'button'; x.className = 'gt-close'; x.textContent = '×'; x.onclick = function () { g.classList.remove('show'); }; g.appendChild(x);
  }
  function ready(f) { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', f); else f(); }
  ready(function () {
    build(); protect();
    if (gCode) {                                   // a Google language is active: load the translator after the page is interactive
      var go = function () { loadGT(); };
      if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 2500 }); else setTimeout(go, 800);
    }
  });
})();
