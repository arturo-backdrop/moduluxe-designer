// ── Deploy Configuration Template ─────────────────────────────
// Copy this file to deploy.config.js and fill in your values.
// deploy.config.js is in .gitignore — it will never be committed.

export const DEPLOY = {

  // ── Base URL ────────────────────────────────────────────────
  // The path where the app is served from.
  // GitHub Pages:       '/moduluxe-designer/'
  // Root domain:        '/'
  // Custom path:        '/static/designer/distrib/'
  base: '/moduluxe-designer/',

  // ── Model Library ───────────────────────────────────────────
  // URL to the manifest.json of the 3D model library.
  // GitHub (default):   'https://raw.githubusercontent.com/...'
  // Private server:     'https://yourserver.com/api/manifest'
  manifestUrl: 'https://raw.githubusercontent.com/arturo-backdrop/Backdrop-3D-Library/main/models/manifest-client.json',

  // ── Presets URL ─────────────────────────────────────────────
  // Optional separate endpoint for presets.
  // Leave null to load presets from the manifest instead.
  presetsUrl: null,

  // ── Build Output ─────────────────────────────────────────────
  // Optional: custom assets directory in the build output.
  // Leave null for Vite default ('assets').
  // Production example: 'app-bundle'
  assetsDir: null,

  // ── App Info ─────────────────────────────────────────────────
  appName: 'Moduluxe Designer',
  version: '0.0.8',
};
