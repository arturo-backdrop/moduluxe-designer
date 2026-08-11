import React, { useState } from 'react';
import styles from './Onboarding.module.css';

// ── Floor size SVG preview ────────────────────────────────────
function FloorPreview({ w, h }) {
  const maxW = 48, maxH = 40;
  const sw = maxW * w, sh = maxH * h;
  const x = (maxW - sw) / 2 + 8, y = (maxH - sh) / 2 + 7;
  return (
    <svg width="64" height="54" viewBox="0 0 64 54" fill="none">
      <rect x={x} y={y} width={sw} height={sh}
        rx="3" fill="#efefef" stroke="#ccc" strokeWidth="1.5" />
    </svg>
  );
}

// ── Preset thumb fallback ─────────────────────────────────────
function PresetThumb({ blocks, selected }) {
  return (
    <div className={`${styles.presetThumbInner} ${selected ? styles.presetThumbSelected : ''}`}>
      {blocks.map((b, i) => (
        <div key={i} className={styles.presetBlock} style={{ width: b.w, height: b.h }} />
      ))}
    </div>
  );
}

// ── Preset grid grouped by sizes ─────────────────────────────
function PresetGrid({ presets, selectedPreset, onSelect }) {
  const NO_SIZE = '__none__';
  const groups = {};
  presets.forEach(p => {
    const sizes = p.sizes?.length ? p.sizes : [NO_SIZE];
    sizes.forEach(sz => {
      if (!groups[sz]) groups[sz] = [];
      if (!groups[sz].find(x => x.id === p.id)) groups[sz].push(p);
    });
  });
  const groupKeys = Object.keys(groups).sort((a, b) =>
    a === NO_SIZE ? 1 : b === NO_SIZE ? -1 : a.localeCompare(b)
  );
  return (
    <div className={styles.presetGrid}>
      {groupKeys.map(sizeKey => (
        <div key={sizeKey} className={styles.presetSizeGroup}>
          {sizeKey !== NO_SIZE && (
            <div className={styles.presetSizeGroupLabel}>{sizeKey}</div>
          )}
          <div className={styles.presetSizeGroupGrid}>
            {groups[sizeKey].map(preset => (
              <div
                key={preset.id}
                className={`${styles.presetCard} ${selectedPreset === preset.id ? styles.presetCardSelected : ''}`}
                onClick={() => onSelect(preset.id)}
              >
                <div className={styles.presetThumb}>
                  {preset.thumbnail
                    ? <img src={preset.thumbnail} alt={preset.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    : <PresetThumb blocks={preset.blocks || []} selected={selectedPreset === preset.id} />
                  }
                  {selectedPreset === preset.id && (
                    <div className={styles.presetBadge}>✓</div>
                  )}
                </div>
                <div className={styles.presetInfo}>
                  <div className={styles.presetName}>{preset.name}</div>
                  {preset.sizes?.length > 0 && (
                    <div className={styles.presetSizes}>{preset.sizes.join(' · ')}</div>
                  )}
                  {preset.description && (
                    <div className={styles.presetDesc}>{preset.description}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Step indicator ────────────────────────────────────────────
function StepIndicator({ step, total = 2 }) {
  return (
    <div className={styles.stepIndicator}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`${styles.stepDot} ${
          i + 1 < step ? styles.stepDotDone :
          i + 1 === step ? styles.stepDotActive : ''
        }`} />
      ))}
    </div>
  );
}

// ── Arrow icon ───────────────────────────────────────────────
function ArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

// ── Main Onboarding component ─────────────────────────────────
export default function Onboarding({ config, presets: manifestPresets = [], onComplete }) {
  // step 1 = choose mode, step 2a = preset picker, step 2b = floor picker
  const [step,           setStep]          = useState(1);
  const [mode,           setMode]          = useState(null); // 'preset' | 'scratch'
  const [selectedFloor,  setSelectedFloor] = useState(null);
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [exiting,        setExiting]       = useState(false);

  const floorSizes = config.floorSizes || [];
  const presets    = manifestPresets.length > 0 ? manifestPresets : (config.presets || []);

  function transition(fn) {
    setExiting(true);
    setTimeout(() => { setExiting(false); fn(); }, 220);
  }

  function chooseMode(m) {
    setMode(m);
    transition(() => setStep(2));
  }

  // Derive floorSize from preset
  function getPresetFloorSize(preset) {
    // Prefer explicit floorSize field on preset
    if (preset.floorSize) return preset.floorSize;
    // Try to match first size string against config.floorSizes labels
    if (preset.sizes?.length) {
      const match = floorSizes.find(f => f.label === preset.sizes[0]);
      if (match) return match;
      // Fallback: use largest floor size
    }
    // Default to first floor size
    return floorSizes[0] || { w: 3.05, d: 3.05, label: '10×10 ft' };
  }

  function handleUsePreset() {
    const preset = presets.find(p => p.id === selectedPreset);
    onComplete({ floorSize: getPresetFloorSize(preset), preset });
  }

  function handleUseScratch() {
    onComplete({ floorSize: floorSizes[selectedFloor], preset: null });
  }

  return (
    <div className={styles.overlay}>
      <div className={`${styles.modal} ${exiting ? styles.modalExit : ''}`}>

        {/* ── Step 1: Choose mode ── */}
        {step === 1 && (
          <>
            <StepIndicator step={1} />
            <div className={styles.title}>How do you want to start?</div>
            <div className={styles.subtitle}>Pick a preset layout or design from scratch</div>

            <div className={styles.modeGrid}>
              <div className={styles.modeCard} onClick={() => chooseMode('preset')}>
                <div className={styles.modeIcon}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#b48b31" strokeWidth="1.5" strokeLinecap="round">
                    <rect x="3" y="3" width="7" height="7" rx="1"/>
                    <rect x="14" y="3" width="7" height="7" rx="1"/>
                    <rect x="3" y="14" width="7" height="7" rx="1"/>
                    <rect x="14" y="14" width="7" height="7" rx="1"/>
                  </svg>
                </div>
                <div className={styles.modeLabel}>Start with a preset</div>
                <div className={styles.modeDesc}>Choose a pre-configured layout ready to customize</div>
              </div>

              <div className={styles.modeCard} onClick={() => chooseMode('scratch')}>
                <div className={styles.modeIcon}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#b48b31" strokeWidth="1.5" strokeLinecap="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <line x1="12" y1="8" x2="12" y2="16"/>
                    <line x1="8" y1="12" x2="16" y2="12"/>
                  </svg>
                </div>
                <div className={styles.modeLabel}>Start from scratch</div>
                <div className={styles.modeDesc}>Set your floor size and build your own layout</div>
              </div>
            </div>
          </>
        )}

        {/* ── Step 2a: Preset picker ── */}
        {step === 2 && mode === 'preset' && (
          <>
            <StepIndicator step={2} />
            <div className={styles.title}>Choose a preset</div>
            <div className={styles.subtitle}>Pick a layout to get started</div>

            {presets.length > 0 ? (
              <PresetGrid
                presets={presets}
                selectedPreset={selectedPreset}
                onSelect={setSelectedPreset}
              />
            ) : (
              <div className={styles.noPresets}>No presets available yet.</div>
            )}

            <button
              className={styles.btnPrimary}
              disabled={selectedPreset === null}
              onClick={handleUsePreset}
            >
              Use this preset <ArrowIcon />
            </button>

            <button className={styles.btnSkip} onClick={() => transition(() => { setMode('scratch'); setStep(2); })}>
              Start from scratch instead
            </button>
          </>
        )}

        {/* ── Step 2b: Floor size picker ── */}
        {step === 2 && mode === 'scratch' && (
          <>
            <StepIndicator step={2} />
            <div className={styles.title}>Set your floor size</div>
            <div className={styles.subtitle}>Choose the size of your exhibition space</div>

            <div className={styles.floorGrid}>
              {floorSizes.map((size, i) => (
                <div
                  key={i}
                  className={`${styles.floorCard} ${selectedFloor === i ? styles.floorCardSelected : ''}`}
                  onClick={() => setSelectedFloor(i)}
                >
                  <FloorPreview
                    w={Math.min(size.w / 10, 1)}
                    h={Math.min(size.d / 10, 1)}
                  />
                  <div className={styles.floorLabel}>{size.label}</div>
                </div>
              ))}
            </div>

            <button
              className={styles.btnPrimary}
              disabled={selectedFloor === null}
              onClick={handleUseScratch}
            >
              Start my design <ArrowIcon />
            </button>

            <button className={styles.btnSkip} onClick={() => transition(() => { setMode('preset'); setStep(2); })}>
              Use a preset instead
            </button>
          </>
        )}

      </div>
    </div>
  );
}
