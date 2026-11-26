// the page calls this first, so a missing setting shows up as a clear message
export default function handler(_req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    blob: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    password: Boolean(process.env.ADMIN_PASSWORD),
    prod: process.env.VERCEL_PROJECT_PRODUCTION_URL || '',
  });
}
