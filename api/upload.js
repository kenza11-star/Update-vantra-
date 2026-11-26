// gives the browser a one-time token so the APK goes straight to Blob storage (it is far bigger than a function body may be)
import { handleUpload } from '@vercel/blob/client';
import { authed } from './_lib.js';

export default async function handler(req, res) {
  // quick self-check the page runs before uploading, so a missing setting shows as a clear message
  if (req.method === 'GET') {
    return res.status(200).json({
      blob: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
      password: Boolean(process.env.ADMIN_PASSWORD),
    });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const json = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        if (!authed(clientPayload)) throw new Error('Password salah');
        return {
          allowedContentTypes: ['application/vnd.android.package-archive', 'application/octet-stream'],
          maximumSizeInBytes: 600 * 1024 * 1024,
          addRandomSuffix: true,
          // the default token lives only 30 s: a slow phone upload outlasts it, fails at the very end and starts over
          validUntil: Date.now() + 60 * 60 * 1000,
        };
      },
      onUploadCompleted: async () => {},
    });
    res.status(200).json(json);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}
