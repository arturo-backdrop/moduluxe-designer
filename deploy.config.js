// ── Deploy Configuration ──────────────────────────────────────
// Edit this file when moving to a new host.
// Then run: npm run build

export const DEPLOY = {

  // ── Base URL ────────────────────────────────────────────────
  // The path where the app is served from.
  // GitHub Pages subdirectory:  '/moduluxe-designer/'
  // Root domain (Cloudflare, Vercel, Netlify): '/'
  // Custom subdirectory: '/my-app/'
  base: '/moduluxe-designer/',

  // ── Model Library ───────────────────────────────────────────
  // URL to the manifest.json of the 3D model library.
  // Current: GitHub raw (public repo)
  // Private host: 'https://your-domain.com/library/manifest.json'
  manifestUrl: 'https://raw.githubusercontent.com/arturo-backdrop/Backdrop-3D-Library/main/models/manifest-client.json',

  // ── App Info ─────────────────────────────────────────────────
  appName: 'Moduluxe Designer',
  version: '0.0.8',
};

