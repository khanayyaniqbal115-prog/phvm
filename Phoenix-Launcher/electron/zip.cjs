// Small zip reader (Node zlib only) used to extract natives and the Java runtime.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function readEntries(buf) {
  // find the End Of Central Directory record
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Zip file is corrupt (EOCD not found)');
  let total = buf.readUInt16LE(eocd + 10);
  let ptr = buf.readUInt32LE(eocd + 16);
  // ZIP64: big worlds (more than 65535 files or over 4 GB) store these values in a second record
  if ((total === 0xffff || ptr === 0xffffffff) && eocd >= 20 && buf.readUInt32LE(eocd - 20) === 0x07064b50) {
    const z64 = Number(buf.readBigUInt64LE(eocd - 20 + 8));
    if (buf.readUInt32LE(z64) === 0x06064b50) {
      total = Number(buf.readBigUInt64LE(z64 + 32));
      ptr = Number(buf.readBigUInt64LE(z64 + 48));
    }
  }
  const entries = [];
  for (let n = 0; n < total; n++) {
    if (buf.readUInt32LE(ptr) !== 0x02014b50) throw new Error('Zip central directory is corrupt');
    const method = buf.readUInt16LE(ptr + 10);
    let compSize = buf.readUInt32LE(ptr + 20);
    let size = buf.readUInt32LE(ptr + 24);
    const nameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    let localOffset = buf.readUInt32LE(ptr + 42);
    const name = buf.toString('utf8', ptr + 46, ptr + 46 + nameLen);
    if (size === 0xffffffff || compSize === 0xffffffff || localOffset === 0xffffffff) {
      let ep = ptr + 46 + nameLen;
      const end = ep + extraLen;
      while (ep + 4 <= end) {
        const id = buf.readUInt16LE(ep);
        const len = buf.readUInt16LE(ep + 2);
        if (id === 0x0001) {
          let q = ep + 4;
          if (size === 0xffffffff) {
            size = Number(buf.readBigUInt64LE(q));
            q += 8;
          }
          if (compSize === 0xffffffff) {
            compSize = Number(buf.readBigUInt64LE(q));
            q += 8;
          }
          if (localOffset === 0xffffffff) localOffset = Number(buf.readBigUInt64LE(q));
          break;
        }
        ep += 4 + len;
      }
    }
    entries.push({ name, method, compSize, size, localOffset });
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function entryData(buf, e) {
  const p = e.localOffset;
  if (buf.readUInt32LE(p) !== 0x04034b50) throw new Error('Zip local header is corrupt');
  const nameLen = buf.readUInt16LE(p + 26);
  const extraLen = buf.readUInt16LE(p + 28);
  const start = p + 30 + nameLen + extraLen;
  const raw = buf.subarray(start, start + e.compSize);
  if (e.method === 0) return raw;
  if (e.method === 8) return zlib.inflateRawSync(raw);
  throw new Error('This zip uses a compression method Phoenix cannot read (' + e.method + '). Re-zip it with the normal Windows "Send to > Compressed folder" or 7-Zip with Deflate.');
}

/**
 * Extract zipPath into destDir.
 * opts.exclude: path prefixes to skip (META-INF/ etc.)
 * opts.stripTop: drop the first folder (for JRE zips)
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
