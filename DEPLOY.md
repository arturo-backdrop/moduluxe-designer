# Deployment Guide

## Moving to a new host

Only two files need to change:

### 1. `deploy.config.js` (root of project)

```js
export const DEPLOY = {
  // Change this to '/' for root domains (Cloudflare, Vercel, Netlify)
  // Keep as '/moduluxe-designer/' for GitHub Pages subdirectory
  base: '/',

  // URL to the model library manifest
  manifestUrl: 'https://your-domain.com/library/manifest.json',
};
```

### 2. `.github/workflows/deploy.yml` (only for GitHub Pages)

If moving away from GitHub Pages, you can delete this file entirely.
Cloudflare Pages / Vercel / Netlify handle CI/CD automatically.

---

## Host-specific instructions

### Cloudflare Pages (recommended)
1. Connect repo to Cloudflare Pages
2. Build command: `npm run build`
3. Output directory: `dist`
4. In `deploy.config.js`: set `base: '/'`

### Vercel
1. Import repo on vercel.com
2. Framework preset: Vite
3. In `deploy.config.js`: set `base: '/'`

### Netlify
1. Connect repo on netlify.com
2. Build command: `npm run build`
3. Publish directory: `dist`
4. In `deploy.config.js`: set `base: '/'`

### GitHub Pages (current)
- No changes needed
- Deploy via GitHub Actions on push to `main`

---

## Changing the model library

The model library URL is set in `deploy.config.js`:

```js
manifestUrl: 'https://raw.githubusercontent.com/.../manifest.json',
```

The manifest format:
```json
{
  "id": "model_id",
  "name": "Display Name",
  "category": "Category",
  "file": "https://your-host.com/models/model.glb",
  "w": 3, "d": 0.2, "h": 2.4,
  "color": "#3a6ea5",
  "price": 1500
}
```
