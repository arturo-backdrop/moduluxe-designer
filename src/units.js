// ── Units system ──────────────────────────────────────────────
// All internal values are in METERS.
// Use these functions to convert for display.

export const UNITS = {
  m:    { label: 'm',   factor: 1,           decimals: 2 },
  ft:   { label: 'ft',  factor: 3.28084,      decimals: 1 },
  cm:   { label: 'cm',  factor: 100,           decimals: 0 },
  inch: { label: 'in',  factor: 39.3701,       decimals: 0 },
};

export const UNIT_KEYS = ['m', 'ft', 'cm', 'inch'];

// Convert meters → display value (string with unit)
export function toDisplay(meters, unit, withLabel=true) {
  const u = UNITS[unit] || UNITS.m;
  const val = (meters * u.factor).toFixed(u.decimals);
  return withLabel ? `${val} ${u.label}` : val;
}

// Convert display value → meters
export function fromDisplay(val, unit) {
  const u = UNITS[unit] || UNITS.m;
  return parseFloat(val) / u.factor;
}
