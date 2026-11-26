// "Send": puts the uploaded APK on the release list. The app (and its background check) sees it right away.
import { authed, readReleases, writeReleases, VERSION_RE } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { password, version, notes, apkUrl, apkName, size, pathname } = req.body ?? {};
  if (!authed(password)) return res.status(401).json({ error: 'Password salah' });

  const v = String(version ?? '').trim();
  if (!VERSION_RE.test(v)) return res.status(400).json({ error: 'Format versi: 8.3.2 atau 8.3.2 (120)' });
  let url = null;
  try { url = new URL(apkUrl); } catch {}
  if (!url || url.protocol !== 'https:') return res.status(400).json({ error: 'Link APK harus https' });

  const release = {
    version: v,
    notes: String(notes ?? '').slice(0, 4000),
    apkUrl,
    apkName: String(apkName || `vantra-${v}.apk`),
    size: Number(size) || 0,
    pathname: String(pathname ?? ''),
    createdAt: new Date().toISOString(),
  };
  const all = (await readReleases()).filter((r) => r.version !== v);
  await writeReleases([release, ...all].slice(0, 50));
  res.status(200).json({ ok: true, release });
}
