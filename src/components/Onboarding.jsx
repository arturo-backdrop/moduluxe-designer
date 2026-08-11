import React, { useState, useEffect } from 'react';
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

// ── Preset thumbnail ──────────────────────────────────────────
function PresetThumb({ blocks, selected, thumbnail }) {
  return (
    <div className={`${styles.presetThumbInner} ${selected ? styles.presetThumbSelected : ''}`}>
      {blocks.map((b, i) => (
        <div key={i} className={styles.presetBlock}
          style={{ width: b.w, height: b.h }} />
      ))}
    </div>
  );
}

// ── Step indicator ────────────────────────────────────────────
function StepIndicator({ step }) {
  return (
    <div className={styles.stepIndicator}>
      <div className={`${styles.stepDot} ${step === 1 ? styles.stepDotActive : styles.stepDotDone}`} />
      <div className={`${styles.stepDot} ${step === 2 ? styles.stepDotActive : ''}`} />
    </div>
  );
}

// ── Main Onboarding component ─────────────────────────────────
export default function Onboarding({ config, presets: manifestPresets = [], onComplete }) {
  const [step,           setStep]           = useState(1);
  const [selectedFloor,  setSelectedFloor]  = useState(null);
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [exiting,        setExiting]        = useState(false);

  const floorSizes = config.floorSizes;
  const presets    = manifestPresets.length > 0 ? manifestPresets : (config.presets || []);

  function goToStep2() {
    setExiting(true);
    setTimeout(() => {
      setExiting(false);
      setStep(2);
    }, 220);
  }

  function handleComplete(preset) {
    onComplete({
      floorSize: floorSizes[selectedFloor],
      preset:    preset || null,
    });
  }

  return (
    <div className={styles.overlay}>
      <div className={`${styles.modal} ${exiting ? styles.modalExit : ''}`}>

        {step === 1 && (
          <>
            <StepIndicator step={1} />
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
              onClick={goToStep2}
            >
              Start my design
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <StepIndicator step={2} />
            <div className={styles.title}>Start with a preset</div>
            <div className={styles.subtitle}>Pick a layout to get started, or begin from scratch</div>

            {presets.length > 0 ? (
              <div className={styles.presetGrid}>
                {presets.map((preset) => (
                  <div
                    key={preset.id}
                    className={`${styles.presetCard} ${selectedPreset === preset.id ? styles.presetCardSelected : ''}`}
                    onClick={() => setSelectedPreset(preset.id)}
                  >
                    <div className={styles.presetThumb}>
                      {preset.thumbnail
                        ? <img src={preset.thumbnail} alt={preset.name} style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:8 }} />
                        : <PresetThumb blocks={preset.blocks || []} selected={selectedPreset === preset.id} />
                      }
                      {selectedPreset === preset.id && (
                        <div className={styles.presetBadge}>Selected</div>
                      )}
                    </div>
                    <div className={styles.presetInfo}>
                      <div className={styles.presetName}>{preset.name}</div>
                      <div className={styles.presetDesc}>{preset.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.noPresets}>No presets available yet.</div>
            )}

            <button
              className={styles.btnPrimary}
              disabled={selectedPreset === null}
              onClick={() => handleComplete(presets.find(p => p.id === selectedPreset))}
            >
              Use this preset
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>

            <button
              className={styles.btnSkip}
              onClick={() => handleComplete(null)}
            >
              Skip, start with empty floor
            </button>
          </>
        )}
      </div>
    </div>
  );
}

