// joins the uploaded pieces into one APK, puts it on the release list ("Send"), and removes the pieces
import { put, del } from '@vercel/blob';
import { readApkInfo } from './_apk.js';
import { authed, readReleases, writeReleases, sweepTemp, VERSION_RE } from './_lib.js';

const bad = (m) => Object.assign(new Error(m), { status: 400 });
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
  if (!Array.isArray(parts) || !parts.length || parts.length > 5000) return res.status(400).json({ error: 'Potongan APK tidak ada' });
  if (!parts.every((p) => p && isBlobUrl(p.url) && p.url.includes('/tmp/'))) return res.status(400).json({ error: 'Potongan tidak valid' });

  try {
    // pieces are fetched 8 at a time (order kept), so thousands of small pieces still join in seconds
    const buffers = new Array(parts.length);
    for (let i = 0; i < parts.length; i += 8) {
      await Promise.all(parts.slice(i, i + 8).map(async (p, k) => {
        const b = await getPart(p.url);
        if (Number(p.size) && b.length !== Number(p.size)) throw new Error('Potongan rusak, upload ulang');
        buffers[i + k] = b;
      }));
    }
    const apk = Buffer.concat(buffers);
    if (apk.length < 1024 || apk[0] !== 0x50 || apk[1] !== 0x4b) throw bad('File bukan APK yang valid');

    // the version that ends up on the phone is the one inside the APK, not the one typed in the form
    const info = readApkInfo(apk);
    const all = await readReleases();
    if (info) {
      const nums = (t) => { const n = (String(t).match(/\d+/g) || []).slice(0, 3).map(Number); while (n.length < 3) n.push(0); return n.join('.'); };
      if (nums(info.versionName) !== nums(v)) {
        throw bad(`APK ini sebenarnya versi ${info.versionName} (versionCode ${info.versionCode}), bukan ${v}. Kalau dikirim, HP tetap di versi ${info.versionName} dan terus minta update. Ganti kolom Version jadi ${info.versionName}, atau ubah versionName di build.gradle.kts jadi ${v} lalu build ulang.`);
      }
      const before = all.filter((r) => r.version !== v);
      const top = before.reduce((m, r) => Math.max(m, Number(r.versionCode) || 0), 0);
      if (top && info.versionCode <= top) {
        throw bad(`versionCode APK (${info.versionCode}) harus lebih besar dari rilis sebelumnya (${top}), kalau tidak Android menolak update. Naikkan angka di signing/version-code-base.txt lalu build ulang.`);
      }
      const pkg = before.find((r) => r.packageName)?.packageName;
      if (pkg && info.packageName !== pkg) throw bad(`Package APK (${info.packageName}) berbeda dari rilis sebelumnya (${pkg}), ini akan terpasang sebagai app lain.`);
    }

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
      versionCode: info?.versionCode,
      packageName: info?.packageName,
      createdAt: new Date().toISOString(),
    };
    const old = all.find((r) => r.version === v);
    await writeReleases([release, ...all.filter((r) => r.version !== v)].slice(0, 50));

    await del(parts.map((p) => p.url)).catch(() => {});
    await sweepTemp();
    if (old && isBlobUrl(old.apkUrl)) await del(old.apkUrl).catch(() => {});
    res.status(200).json({ ok: true, release });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message || 'Gagal merakit APK' });
  }
}
