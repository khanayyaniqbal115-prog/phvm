(function () {
  window.phvmPush = {
    supported: function () { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; },
    async state() {
      if (!this.supported()) return 'unsupported';
      if (Notification.permission === 'denied') return 'denied';
      try { var reg = await navigator.serviceWorker.getRegistration(); var s = reg && await reg.pushManager.getSubscription(); return s ? 'on' : 'off'; } catch (e) { return 'off'; }
    },
    async enable() {
      var tok = window.PHVM_CSRF || '', H = {'Content-Type': 'application/json', 'X-CSRF-Token': tok};
      var k = await (await fetch('/push/key')).json(); if (!k.success) throw new Error(k.message || 'Push is not available');
      var perm = await Notification.requestPermission(); if (perm !== 'granted') throw new Error('Notifications were blocked in the browser.');
      var reg = await navigator.serviceWorker.register('/sw.js'); await navigator.serviceWorker.ready;
      var b = k.key.replace(/-/g, '+').replace(/_/g, '/'); var raw = atob(b + '==='.slice((b.length + 3) % 4)); var arr = new Uint8Array(raw.length); for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
      var sub = await reg.pushManager.subscribe({userVisibleOnly: true, applicationServerKey: arr});
      var r = await (await fetch('/push/subscribe', {method: 'POST', headers: H, body: JSON.stringify(sub.toJSON())})).json(); if (!r.success) throw new Error(r.message);
      return r.message;
    },
    async disable() {
      var tok = window.PHVM_CSRF || '', H = {'Content-Type': 'application/json', 'X-CSRF-Token': tok};
      var reg = await navigator.serviceWorker.getRegistration(); var s = reg && await reg.pushManager.getSubscription();
      if (s) { await fetch('/push/unsubscribe', {method: 'POST', headers: H, body: JSON.stringify({endpoint: s.endpoint})}); await s.unsubscribe(); }
      return 'Alerts are off for this device.';
    }
  };
})();
