// receives one 4 MB piece of the APK (a function body may be at most 4.5 MB) and keeps it in Blob storage
import { put, del } from '@vercel/blob';
import { authed } from './_lib.js';

export const config = { api: { bodyParser: false } };
const MAX = 4.4 * 1024 * 1024;

async function readBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  const parts = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > MAX) throw new Error('Potongan terlalu besar');
    parts.push(c);
  }
  return Buffer.concat(parts);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  let pw = '';
  try { pw = decodeURIComponent(String(req.headers['x-pw'] ?? '')); } catch {}
  if (!authed(pw)) return res.status(401).json({ error: 'Password salah' });

  // preflight: a tiny write+delete, so a storage problem is reported as plain words before a big upload starts
  if (req.query.test) {
    try {
      const b = await put('tmp/_test', Buffer.from('ok'), { access: 'public', addRandomSuffix: true, contentType: 'text/plain' });
      await del(b.url).catch(() => {});
      return res.status(200).json({ ok: true });
    } catch (e) {
      const m = String(e.message || e);
      const hint = /private/i.test(m) ? ' → Store Blob kamu bertipe PRIVATE. Buat store baru bertipe PUBLIC (Storage → Create → Blob → Public), connect ke project, lalu Redeploy.'
        : /token/i.test(m) ? ' → Token Blob tidak terbaca. Connect store ke project ini lalu Redeploy.' : '';
      return res.status(500).json({ error: 'Storage menolak: ' + m + hint });
    }
  }

  const id = String(req.query.id ?? '').replace(/[^a-z0-9]/gi, '').slice(0, 40);
  const n = Number(req.query.n);
  if (!id || !Number.isInteger(n) || n < 0 || n > 500) return res.status(400).json({ error: 'Permintaan tidak valid' });
  try {
    const body = await readBody(req);
    if (!body.length || body.length > MAX) return res.status(400).json({ error: 'Ukuran potongan tidak valid' });
    const blob = await put(`tmp/${id}/${String(n).padStart(4, '0')}`, body, {
      access: 'public',
      addRandomSuffix: true,
      contentType: 'application/octet-stream',
    });
    res.status(200).json({ url: blob.url, size: body.length });
  } catch (e) {
    res.status(500).json({ error: 'Storage menolak: ' + (e.message || 'gagal menyimpan potongan') });
  }
}
