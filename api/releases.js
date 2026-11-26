// what the app reads. Same shape as GitHub's releases API, so the app's existing parser takes it as is.
import { readReleases } from './_lib.js';

export default async function handler(_req, res) {
  try {
    const list = await readReleases();
    res.setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=60');
    res.status(200).json(
      list.map((r) => ({
        tag_name: `v${r.version}`,
        name: `Vantra ${r.version}`,
        body: r.notes || '',
        html_url: '',
        draft: false,
        prerelease: false,
        published_at: r.createdAt,
        assets: [{ name: r.apkName, browser_download_url: r.apkUrl, size: r.size }],
      })),
    );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
