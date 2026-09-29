// ── Manifest normalizer ───────────────────────────────────────
// The manifest is authored as three flat tables (Excel-friendly):
//
//   models:      id, name, category, price, color, accessories,
//                width, depth, height (INCHES), model_url, image_url
//   accessories: name, socket, behavior, max, price, model_url, image_url
//   presets:     id, name, size, model_url, image_url
//
// - color empty      → model is not paintable
// - accessories      → comma-separated accessory names ("Lamp, Shelves")
// - socket           → Blender Empty name the accessory attaches to
//
// normalizeManifest() converts it to the internal format the app uses
// (meters, file/thumbnail, nested sockets, presets with type:'preset').
// The legacy flat-array format is passed through unchanged.

const INCH = 0.0254;

function toMeters(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n * INCH : undefined;
}

function splitList(v) {
  if (Array.isArray(v)) return v;
  return String(v || '').split(',').map(s => s.trim()).filter(Boolean);
}

export function normalizeManifest(data) {
  // Legacy format: plain array (or { models: [...] } without accessories/presets)
  if (Array.isArray(data)) return data;
  if (!data || (!data.accessories && !data.presets)) return data?.models || [];

  const accByName = {};
  (data.accessories || []).forEach(a => {
    if (a?.name) accByName[a.name.trim().toLowerCase()] = a;
  });

  const models = (data.models || []).map(m => {
    const sockets = splitList(m.accessories).map(accName => {
      const a = accByName[accName.toLowerCase()];
      if (!a) { console.warn(`[manifest] "${m.name}": unknown accessory "${accName}"`); return null; }
      return {
        name:          a.socket,
        label:         a.name,
        behavior:      a.behavior || 'fixed',
        max:           a.max ?? 4,
        price:         a.price ?? 0,
        accessoryFile: a.model_url,
        thumbnail:     a.image_url || null,
      };
    }).filter(Boolean);

    return {
      id:        m.id,
      name:      m.name,
      category:  m.category,
      price:     m.price ?? 0,
      color:     m.color || '#cccccc',
      paintable: !!m.color,
      w:         toMeters(m.width),
      d:         toMeters(m.depth),
      h:         toMeters(m.height),
      file:      m.model_url,
      thumbnail: m.image_url || null,
      sockets,
    };
  });

  const presets = (data.presets || []).map(p => ({
    id:        p.id,
    name:      p.name,
    type:      'preset',
    sizes:     splitList(p.size),
    file:      p.model_url,
    thumbnail: p.image_url || null,
  }));

  return [...models, ...presets];
}
