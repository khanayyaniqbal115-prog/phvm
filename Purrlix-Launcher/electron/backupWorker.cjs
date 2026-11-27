'use strict';
// Runs the world backup off the main thread so zipping a big world never freezes the launcher window.
const { parentPort, workerData } = require('worker_threads');
try {
  const manage = require('./manage.cjs');
  parentPort.postMessage({ ok: true, done: manage.autoBackup(workerData.savesDir, workerData.backupsDir) });
} catch (e) {
  parentPort.postMessage({ ok: false, error: String((e && e.message) || e) });
}
