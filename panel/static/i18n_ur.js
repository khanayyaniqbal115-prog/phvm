/* PHvm: English <-> Urdu text switch. Untranslated text stays English. */
(function () {
  var D = {
    'Dashboard':'ڈیش بورڈ','My Virtual Machines':'میری ورچوئل مشینیں','Shop':'دکان','Reseller':'ری سیلر',
    'Invite friends':'دوستوں کو بلائیں','Receipts':'رسیدیں','Support':'سپورٹ','Web Hosting':'ویب ہوسٹنگ',
    'My Profile':'میری پروفائل','Wallet':'والٹ','My Activity':'میری سرگرمی','Logout':'لاگ آؤٹ','Users':'صارفین',
    'Settings':'ترتیبات','Plans':'پلانز','Create VM':'وی ایم بنائیں','Create Bot':'بوٹ بنائیں',
    'Create Minecraft':'مائن کرافٹ بنائیں','Create Web Site':'ویب سائٹ بنائیں','Docker servers':'ڈاکر سرورز',
    'Domains':'ڈومینز','Domain orders':'ڈومین آرڈرز','Revenue':'آمدنی','Tickets':'ٹکٹس','Status page':'اسٹیٹس پیج',
    'Update panel':'پینل اپڈیٹ','Web plans':'ویب پلانز','Nodes':'نوڈز','License':'لائسنس','Icons':'آئیکنز',
    'Quick Actions':'فوری کام','System Info':'سسٹم کی معلومات','Back to User Panel':'یوزر پینل پر واپس',
    'Login':'لاگ ان','Sign in':'سائن ان','Register':'رجسٹر','Username':'یوزر نیم','Password':'پاسورڈ','Email':'ای میل',
    'Forgot password?':'پاسورڈ بھول گئے؟','Save':'محفوظ کریں','Save changes':'تبدیلیاں محفوظ کریں','Cancel':'منسوخ',
    'Delete':'حذف کریں','Edit':'ترمیم','Create':'بنائیں','Start':'شروع','Stop':'بند','Restart':'ری اسٹارٹ',
    'Status':'حالت','Name':'نام','Actions':'کام','Running':'چل رہا ہے','Stopped':'بند ہے','Online':'آن لائن','Offline':'آف لائن',
    'Expires':'ختم ہوگا','Created':'بنایا گیا','Balance':'بیلنس','Buy':'خریدیں','Renew':'تجدید','Upgrade':'اپگریڈ',
    'Search':'تلاش','Send':'بھیجیں','Open':'کھولیں','Close':'بند کریں','Back':'واپس','Next':'اگلا','Yes':'ہاں','No':'نہیں',
    'Files':'فائلیں','Backups':'بیک اپس','Console':'کنسول','Domain':'ڈومین','Traffic':'ٹریفک','Customers':'کسٹمرز',
    'New customer':'نیا کسٹمر','Create customer':'کسٹمر بنائیں','Create website':'ویب سائٹ بنائیں','Plan':'پلان',
    'Customer':'کسٹمر','Joined':'شامل ہوا','Date':'تاریخ','Amount':'رقم','Description':'تفصیل','Role':'کردار',
    'Wallet balance':'والٹ بیلنس','Top up':'ٹاپ اپ','Coupon':'کوپن','Total':'کل','Paid':'ادا شدہ','Pending':'زیر التواء',
    'Welcome':'خوش آمدید','Notifications':'اطلاعات','Language':'زبان','Open a ticket':'ٹکٹ کھولیں','Subject':'موضوع','Message':'پیغام',
    'No customers yet.':'ابھی کوئی کسٹمر نہیں۔','No sites yet.':'ابھی کوئی سائٹ نہیں۔','Site name':'سائٹ کا نام','Scan':'اسکین',
    'Clear cache':'کیشے صاف کریں','Speed boost':'اسپیڈ بوسٹ','Get a domain':'ڈومین حاصل کریں','Renew an existing site with this plan':'اس پلان سے موجودہ سائٹ کی تجدید',
    'Upgrade an existing site to this plan':'اس پلان پر موجودہ سائٹ اپگریڈ کریں','Receipt':'رسید','Print':'پرنٹ'
  };
  var SKIP = {SCRIPT:1, STYLE:1, TEXTAREA:1, INPUT:1, CODE:1, PRE:1};
  var lang = 'en';
  try { lang = localStorage.getItem('phvm_lang') || 'en'; } catch (e) {}
  var orig = new WeakMap();
  function tr(n) {
    if (n.nodeType === 3) {
      var p = n.parentNode; if (!p || SKIP[p.nodeName]) return;
      var raw = orig.has(n) ? orig.get(n) : n.nodeValue, key = raw.trim();
      if (lang === 'ur') {
        if (D[key]) { if (!orig.has(n)) orig.set(n, raw); var v = raw.replace(key, D[key]); if (n.nodeValue !== v) n.nodeValue = v; }
      } else if (orig.has(n)) { n.nodeValue = orig.get(n); orig.delete(n); }
    } else if (n.nodeType === 1 && !SKIP[n.nodeName]) {
      for (var c = n.firstChild; c; c = c.nextSibling) tr(c);
    }
  }
  function apply() {
    var h = document.documentElement;
    h.setAttribute('lang', lang === 'ur' ? 'ur' : 'en');
    h.setAttribute('dir', lang === 'ur' ? 'rtl' : 'ltr');
    tr(document.body);
  }
  window.phvmToggleLang = function () {
    lang = lang === 'ur' ? 'en' : 'ur';
    try { localStorage.setItem('phvm_lang', lang); } catch (e) {}
    apply();
  };
  function init() {
    apply();
    var busy = false;
    new MutationObserver(function (ms) {
      if (busy || lang !== 'ur') return; busy = true;
      ms.forEach(function (m) { m.addedNodes.forEach(tr); if (m.type === 'characterData') tr(m.target); });
      busy = false;
    }).observe(document.body, {childList: true, subtree: true, characterData: true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
