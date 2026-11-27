// Reads package / versionName / versionCode out of an APK (a zip whose AndroidManifest.xml is Android's binary XML),
// so the site can refuse an APK whose real version is not the one typed in the form.
// Returns null when anything looks unfamiliar: the caller then skips the check instead of blocking a good upload.
import zlib from 'node:zlib';

function zipEntry(buf, name) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a zip');
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error('bad central directory');
    const method = buf.readUInt16LE(off + 10), csize = buf.readUInt32LE(off + 20);
    const nlen = buf.readUInt16LE(off + 28), elen = buf.readUInt16LE(off + 30), clen = buf.readUInt16LE(off + 32);
    const lho = buf.readUInt32LE(off + 42);
    if (buf.toString('utf8', off + 46, off + 46 + nlen) === name) {
      const start = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28);
      const data = buf.subarray(start, start + csize);
      return method === 0 ? data : zlib.inflateRawSync(data);
    }
    off += 46 + nlen + elen + clen;
  }
  return null;
}

function readPool(x, pos) {
  const count = x.readUInt32LE(pos + 8), flags = x.readUInt32LE(pos + 16);
  const stringsStart = x.readUInt32LE(pos + 20), hsize = x.readUInt16LE(pos + 2);
  const utf8 = (flags & 0x100) !== 0, out = [];
  for (let i = 0; i < count; i++) {
    let p = pos + stringsStart + x.readUInt32LE(pos + hsize + i * 4);
    if (utf8) {
      let l = x.readUInt8(p++); if (l & 0x80) l = ((l & 0x7f) << 8) | x.readUInt8(p++);   // length in utf-16 units (skipped)
      let b = x.readUInt8(p++); if (b & 0x80) b = ((b & 0x7f) << 8) | x.readUInt8(p++);   // length in bytes
      out.push(x.toString('utf8', p, p + b));
    } else {
      let l = x.readUInt16LE(p); p += 2; if (l & 0x8000) { l = ((l & 0x7fff) << 16) | x.readUInt16LE(p); p += 2; }
      out.push(x.toString('utf16le', p, p + l * 2));
    }
  }
  return out;
}

function manifestInfo(x) {
  if (x.readUInt16LE(0) !== 0x0003) throw new Error('not binary xml');
  let pos = x.readUInt16LE(2), strings = [];
  while (pos + 8 <= x.length) {
    const type = x.readUInt16LE(pos), size = x.readUInt32LE(pos + 4);
    if (type === 0x0001) strings = readPool(x, pos);
    if (type === 0x0102) {
      const ext = pos + 16;
      if (strings[x.readInt32LE(ext + 4)] === 'manifest') {
        const aStart = x.readUInt16LE(ext + 8), aSize = x.readUInt16LE(ext + 10), aCount = x.readUInt16LE(ext + 12);
        const info = {};
        for (let i = 0; i < aCount; i++) {
          const a = ext + aStart + i * aSize;
          const name = strings[x.readInt32LE(a + 4)], raw = x.readInt32LE(a + 8), dtype = x.readUInt8(a + 15), data = x.readUInt32LE(a + 16);
          const str = raw >= 0 ? strings[raw] : dtype === 0x03 ? strings[data] : undefined;
          if (name === 'versionCode') info.versionCode = dtype === 0x10 ? data : Number(str);
          if (name === 'versionName') info.versionName = str;
          if (name === 'package') info.packageName = str;
        }
        return info;
      }
    }
    if (size < 8) break;
    pos += size;
  }
  throw new Error('manifest element not found');
}

export function readApkInfo(buf) {
  try {
    const xml = zipEntry(buf, 'AndroidManifest.xml');
    if (!xml) return null;
    const info = manifestInfo(xml);
    return info.versionName && Number.isFinite(info.versionCode) ? info : null;
  } catch { return null; }
}
