// ─────────────────────────────────────────────────────────────
//  MODULUXE DESIGNER — App Configuration
//  Edit this file to customize the app for different clients
// ─────────────────────────────────────────────────────────────

export const CONFIG = {

  // ── Branding ───────────────────────────────────────────────
  appName:     'Moduluxe Designer',
  company:     'Moduluxe',
  accentColor: '#b48b31',   // Gold — used for buttons, outlines, active states

  // ── Contact ────────────────────────────────────────────────
  // Leave null to hide the phone number in the quote panel
  phone:     '(888) 765-2711',
  phoneHref: '8887652711',

  // ── Catalog ────────────────────────────────────────────────
  // URL to the manifest.json for the product catalog
  manifestUrl: 'https://raw.githubusercontent.com/Abacus-Arturo/booth-planner-library/main/models/manifest.json',

  // ── HubSpot ────────────────────────────────────────────────
  // Leave null to skip HubSpot and just show a confirmation message
  hubspotPortalId: null,
  hubspotFormId:   null,

  // ── Presets ────────────────────────────────────────────────
  // Add preset configs here — blocks are visual thumbnail previews
  presets: [
    {
      id:          'linear-3m',
      name:        'Linear Wall 3m',
      description: 'Clean backdrop with counter',
      blocks:      [{ w:8, h:40 }, { w:8, h:32 }, { w:8, h:40 }],
    },
    {
      id:          'island-6m',
      name:        'Island Display',
      description: '360° visibility, open layout',
      blocks:      [{ w:16, h:36 }, { w:10, h:24 }, { w:16, h:36 }],
    },
    {
      id:          'lshape-4m',
      name:        'L-Shape',
      description: 'Corner booth configuration',
      blocks:      [{ w:8, h:40 }, { w:8, h:28 }, { w:28, h:8 }],
    },
    {
      id:          'premium-island',
      name:        'Premium Island',
      description: 'High-impact double-sided',
      blocks:      [{ w:12, h:40 }, { w:8, h:28 }, { w:12, h:40 }],
    },
  ],

  // ── Video tutorial ─────────────────────────────────────────
  // Leave null to hide the video widget entirely
  youtubeId:    'fQNPDMpov2M', // ← replace with your actual video ID
  videoTitle:   ' NY Toy Fair Trade Show Booth Awards',
  videoDuration: '1:59',

  // ── Floor sizes ────────────────────────────────────────────
  floorSizes: [
    { label: '10×10 ft', w: 3.05, d: 3.05 },
    { label: '10×20 ft', w: 6.10, d: 3.05 },
    { label: '20×20 ft', w: 6.10, d: 6.10 },
    { label: '20×30 ft', w: 9.14, d: 6.10 },
    { label: '30×30 ft', w: 9.14, d: 9.14 },
  ],

  // ── Mode toggle labels ─────────────────────────────────────
  modePlace: 'Place products',
  modeDraw:  'Draw layout',

  // ── Bottom bar ─────────────────────────────────────────────
  barTitle: 'Your build',

  // ── 3D Viewport ────────────────────────────────────────────
  outline: {
    color:       '#ffffff',
    thickness:   0.004,
    xrayOpacity: 0.4,
  },

};
