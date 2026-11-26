import { del } from '@vercel/blob';
import { authed, readReleases, writeReleases } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { password, version } = req.body ?? {};
  if (!authed(password)) return res.status(401).json({ error: 'Password salah' });
  const all = await readReleases();
  const hit = all.find((r) => r.version === version);
  if (!hit) return res.status(404).json({ error: 'Versi tidak ada' });
  await writeReleases(all.filter((r) => r.version !== version));
  if (hit.apkUrl) await del(hit.apkUrl).catch(() => {});
  res.status(200).json({ ok: true });
}
