import { list, put, del } from '@vercel/blob';
import crypto from 'node:crypto';

const META = 'vantra/releases.json';

export function authed(password) {
  const a = Buffer.from(String(password ?? ''));
  const b = Buffer.from(process.env.ADMIN_PASSWORD ?? '');
  return b.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function readReleases() {
  const { blobs } = await list({ prefix: META, limit: 5 });
  const meta = blobs.find((b) => b.pathname === META);
  if (!meta) return [];
  const res = await fetch(`${meta.url}?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) return [];
  const data = await res.json().catch(() => []);
  return Array.isArray(data) ? data : [];
}

export async function writeReleases(releases) {
  await put(META, JSON.stringify(releases), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 60,
  });
}

export const VERSION_RE = /^\d+\.\d+(\.\d+)?( ?\(\d+\))?$/;

// pieces of an upload that was started but never sent (tab closed, phone locked) would sit in storage forever
export async function sweepTemp(maxAgeMs = 2 * 60 * 60 * 1000) {
  try {
    const old = [];
    let cursor;
    do {
      const r = await list({ prefix: 'tmp/', limit: 1000, cursor });
      for (const b of r.blobs) if (Date.now() - new Date(b.uploadedAt).getTime() > maxAgeMs) old.push(b.url);
      cursor = r.hasMore ? r.cursor : undefined;
    } while (cursor);
    if (old.length) await del(old);
  } catch {}
}
