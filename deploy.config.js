// ── Deploy Configuration ──────────────────────────────────────
// Edit this file when moving to a new host.
// Then run: npm run build
//
// NOTE: This file is in .gitignore — it stays on your machine only.
// Copy deploy.config.template.js to deploy.config.js and fill in your values.

export const DEPLOY = {

  // ── Base URL ────────────────────────────────────────────────
  // The path where the app is served from.
  // GitHub Pages subdirectory:  '/moduluxe-designer/'
  // Root domain (Cloudflare, Vercel, Netlify): '/'
  // Custom subdirectory: '/my-app/'
  base: '/moduluxe-designer/',

  // ── Model Library ───────────────────────────────────────────
  // URL to the manifest.json of the 3D model library.
  manifestUrl: 'https://raw.githubusercontent.com/arturo-backdrop/Backdrop-3D-Library/main/models/manifest-client.json',

  // ── Presets URL ─────────────────────────────────────────────
  // Optional separate endpoint for presets.
  // Leave null to load presets from the manifest instead.
  presetsUrl: null,

  // ── Build Output ─────────────────────────────────────────────
  // Optional: custom assets directory in the build output.
  // Leave null for Vite default ('assets').
  assetsDir: null,

  // ── Video Widget ─────────────────────────────────────────────
  // YouTube video shown in the bottom right panel.
  // Leave null to hide the video widget entirely.
  youtubeId:     'fQNPDMpov2M',
  videoTitle:    'NY Toy Fair TSB Awards',
  videoDuration: '1:59',

  // ── App Info ─────────────────────────────────────────────────
  appName: 'Moduluxe Designer',
  version: '0.0.8',
};
