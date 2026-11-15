// Chhota sa zip reader (sirf Node ke zlib se) — natives aur Java runtime extract karne ke liye.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function readEntries(buf) {
  // End Of Central Directory dhoondo
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Zip file kharab hai (EOCD nahi mila)');
  const total = buf.readUInt16LE(eocd + 10);
  let ptr = buf.readUInt32LE(eocd + 16);
  const entries = [];
  for (let n = 0; n < total; n++) {
    if (buf.readUInt32LE(ptr) !== 0x02014b50) throw new Error('Zip central directory kharab hai');
    const method = buf.readUInt16LE(ptr + 10);
    const compSize = buf.readUInt32LE(ptr + 20);
    const size = buf.readUInt32LE(ptr + 24);
    const nameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const localOffset = buf.readUInt32LE(ptr + 42);
    const name = buf.toString('utf8', ptr + 46, ptr + 46 + nameLen);
    entries.push({ name, method, compSize, size, localOffset });
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function entryData(buf, e) {
  const p = e.localOffset;
  if (buf.readUInt32LE(p) !== 0x04034b50) throw new Error('Zip local header kharab hai');
  const nameLen = buf.readUInt16LE(p + 26);
  const extraLen = buf.readUInt16LE(p + 28);
  const start = p + 30 + nameLen + extraLen;
  const raw = buf.subarray(start, start + e.compSize);
  if (e.method === 0) return raw;
  if (e.method === 8) return zlib.inflateRawSync(raw);
  throw new Error('Zip compression method support nahi: ' + e.method);
}

/**
 * zipPath ko destDir mein extract karo.
 * opts.exclude: prefixes jinko skip karna hai (META-INF/ wagera)
 * opts.stripTop: pehla folder hata do (JRE zip ke liye)
 */
function extractZip(zipPath, destDir, opts = {}) {
  const buf = fs.readFileSync(zipPath);
  const entries = readEntries(buf);
  const root = path.resolve(destDir);
  for (const e of entries) {
    let name = e.name.replace(/\\/g, '/');
    if (opts.prefix) {
      if (!name.startsWith(opts.prefix)) continue;
      name = name.slice(opts.prefix.length);
    }
    if (opts.stripTop) {
      const idx = name.indexOf('/');
      if (idx < 0) continue;
      name = name.slice(idx + 1);
    }
    if (!name) continue;
    if (opts.exclude && opts.exclude.some((ex) => name.startsWith(ex))) continue;
    const target = path.resolve(root, name);
    // Zip-slip se bachao
    if (target !== root && !target.startsWith(root + path.sep)) continue;
    if (name.endsWith('/')) {
      fs.mkdirSync(target, { recursive: true });
      continue;
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, entryData(buf, e));
  }
}

function readZipEntry(zipPath, entryName) {
  const buf = fs.readFileSync(zipPath);
  const e = readEntries(buf).find((x) => x.name === entryName);
  return e ? entryData(buf, e) : null;
}

module.exports = { extractZip, readZipEntry };
