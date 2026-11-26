import { list, put } from '@vercel/blob';
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
