// joins the uploaded pieces into one APK, puts it on the release list ("Send"), and removes the pieces
import { put, del } from '@vercel/blob';
import { authed, readReleases, writeReleases, VERSION_RE } from './_lib.js';

const isBlobUrl = (u) => {
  try { const x = new URL(u); return x.protocol === 'https:' && x.hostname.endsWith('.blob.vercel-storage.com'); } catch { return false; }
};

async function getPart(url) {
  let last;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (r.ok) return Buffer.from(await r.arrayBuffer());
      last = new Error(`Potongan tidak terbaca (${r.status})`);
    } catch (e) { last = e; }
  }
  throw last;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { password, version, notes, parts } = req.body ?? {};
  if (!authed(password)) return res.status(401).json({ error: 'Password salah' });

  const v = String(version ?? '').trim();
  if (!VERSION_RE.test(v)) return res.status(400).json({ error: 'Format versi: 8.3.2 atau 8.3.2 (120)' });
  if (!Array.isArray(parts) || !parts.length || parts.length > 500) return res.status(400).json({ error: 'Potongan APK tidak ada' });
  if (!parts.every((p) => p && isBlobUrl(p.url) && p.url.includes('/tmp/'))) return res.status(400).json({ error: 'Potongan tidak valid' });

  try {
    const buffers = [];
    for (const p of parts) {
      const b = await getPart(p.url);
      if (Number(p.size) && b.length !== Number(p.size)) throw new Error('Potongan rusak, upload ulang');
      buffers.push(b);
    }
    const apk = Buffer.concat(buffers);
    if (apk.length < 1024 || apk[0] !== 0x50 || apk[1] !== 0x4b) throw new Error('File bukan APK yang valid');

    const safe = v.replace(/[^\d.]/g, '');
    const blob = await put(`apk/vantra-${safe}.apk`, apk, {
      access: 'public',
      addRandomSuffix: true,
      contentType: 'application/vnd.android.package-archive',
      multipart: true,
    });

    const release = {
      version: v,
      notes: String(notes ?? '').slice(0, 4000),
      apkUrl: blob.url,
      apkName: `vantra-${safe}.apk`,
      size: apk.length,
      pathname: blob.pathname,
      createdAt: new Date().toISOString(),
    };
    const all = await readReleases();
    const old = all.find((r) => r.version === v);
    await writeReleases([release, ...all.filter((r) => r.version !== v)].slice(0, 50));

    await del(parts.map((p) => p.url)).catch(() => {});
    if (old && isBlobUrl(old.apkUrl)) await del(old.apkUrl).catch(() => {});
    res.status(200).json({ ok: true, release });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Gagal merakit APK' });
  }
}
