import React, { useState } from 'react';
import styles from './QuotePanel.module.css';

// ── Configurable copy ─────────────────────────────────────────
const RENT_TEXT = 'Or rent for 1/3 of the price';

// ── Quote Modal ───────────────────────────────────────────────
const WALL_TYPES = new Set(['wall','column','door']);
function QuoteModal({ config, sceneItems, catalog, onClose }) {
  sceneItems = sceneItems.filter(i => !WALL_TYPES.has(i.type) && !i.isArrayClone);
  const [step,    setStep]    = useState(1);
  const [form,    setForm]    = useState({ reseller:'', client:'', eventName:'', eventDate:'', comments:'', privacy:false });
  const [sending, setSending] = useState(false);
  const [sent,    setSent]    = useState(false);

  function handleField(e) {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  }

  function canSubmit() { return form.client.trim() && form.eventName.trim() && form.privacy; }

  async function handleSubmit() {
    setSending(true);
    if (config.hubspotPortalId && config.hubspotFormId) {
      try {
        await fetch(`https://api.hsforms.com/submissions/v3/integration/submit/${config.hubspotPortalId}/${config.hubspotFormId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields: [
            { name: 'company',    value: form.reseller },
            { name: 'firstname',  value: form.client },
            { name: 'event_name', value: form.eventName },
            { name: 'event_date', value: form.eventDate },
            { name: 'message',    value: form.comments },
          ]}),
        });
      } catch(e) { console.warn('HubSpot submit failed:', e); }
    }
    setSending(false);
    setSent(true);
  }

  if (sent) {
    return (
      <div className={styles.modalOverlay} onClick={onClose}>
        <div className={styles.modal} onClick={e => e.stopPropagation()}>
          <div className={styles.successWrap}>
            <div className={styles.successIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div className={styles.successTitle}>Quote sent!</div>
            <div className={styles.successSub}>We'll get back to you shortly.</div>
            <button className={styles.btnPrimary} onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>Request a Quote</div>
          <button className={styles.closeBtn} onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {step === 1 && (
          <>
            <div className={styles.fieldGrid}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Reseller / Company</label>
                <input className={styles.fieldInput} name="reseller" value={form.reseller} onChange={handleField} placeholder="Your company name" />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Client name <span className={styles.req}>*</span></label>
                <input className={styles.fieldInput} name="client" value={form.client} onChange={handleField} placeholder="End client name" />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Event name <span className={styles.req}>*</span></label>
                <input className={styles.fieldInput} name="eventName" value={form.eventName} onChange={handleField} placeholder="e.g. CES 2025" />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Event date</label>
                <input className={styles.fieldInput} name="eventDate" value={form.eventDate} onChange={handleField} type="date" />
              </div>
            </div>
            <div className={styles.field} style={{ marginTop:12 }}>
              <label className={styles.fieldLabel}>Comments</label>
              <textarea className={styles.fieldTextarea} name="comments" value={form.comments} onChange={handleField} placeholder="Any special requirements..." rows={3} />
            </div>
            <button className={styles.btnPrimary} style={{ marginTop:16 }} onClick={() => setStep(2)}>
              Review my quote →
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <div className={styles.itemsList}>
              {sceneItems.map(item => {
                const def = catalog?.[item.modelId];
                const modelPrice = (def?.price || 0) * (item.count || 1);
                // Active accessories
                const activeAccs = [];
                (def?.sockets || []).forEach(s => {
                  const state = item.socketStates?.[s.name];
                  if (!state) return;
                  const accDef = catalog?.__accessories?.[s.accessoryFile];
                  const accPrice = accDef?.price || 0;
                  if (s.behavior === 'fixed' && state.on) {
                    activeAccs.push({ label: s.label, qty: 1, price: accPrice });
                  } else if (s.behavior === 'distribute' && state.count > 0) {
                    activeAccs.push({ label: s.label, qty: state.count, price: accPrice });
                  } else if (s.behavior === 'positions' && state.positionIndex >= 0) {
                    activeAccs.push({ label: s.label, qty: 1, price: accPrice });
                  }
                });
                return (
                  <div key={item.uid || item.modelId} className={styles.quoteItem}>
                    <div style={{flex:1}}>
                      <div style={{display:'flex',justifyContent:'space-between'}}>
                        <span className={styles.quoteItemName}>{def?.name || item.modelId}</span>
                        <span className={styles.quoteItemQty}>
                          x{item.count || 1}
                          {modelPrice > 0 && <span style={{marginLeft:8,color:'#b48b31'}}>${modelPrice.toLocaleString()}</span>}
                        </span>
                      </div>
                      {activeAccs.map((a,i) => (
                        <div key={i} style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#999',paddingLeft:12,marginTop:2}}>
                          <span>↳ {a.label}{a.qty > 1 ? ` x${a.qty}` : ''}</span>
                          {a.price > 0 && <span style={{color:'#b48b31'}}>${(a.price * a.qty).toLocaleString()}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            {(() => {
              const t = sceneItems.reduce((sum, item) => {
                const def = catalog?.[item.modelId];
                let s = (def?.price || 0) * (item.count || 1);
                (def?.sockets || []).forEach(sock => {
                  const state = item.socketStates?.[sock.name];
                  const accDef = catalog?.__accessories?.[sock.accessoryFile];
                  const p = accDef?.price || 0;
                  if (!state || !p) return;
                  if (sock.behavior === 'fixed' && state.on) s += p;
                  else if (sock.behavior === 'distribute') s += p * (state.count || 0);
                  else if (sock.behavior === 'positions' && state.positionIndex >= 0) s += p;
                });
                return sum + s;
              }, 0);
              return (
                <div className={styles.totalRow}>
                  <span>Estimated total</span>
                  <span className={styles.totalAmt}>{t > 0 ? `$${t.toLocaleString()}` : 'Contact for pricing'}</span>
                </div>
              );
            })()}
            <label className={styles.privacyRow}>
              <input type="checkbox" name="privacy" checked={form.privacy} onChange={handleField} className={styles.privacyCheck} />
              <span>I agree to the <a href="#" className={styles.privacyLink}>Privacy Policy</a></span>
            </label>
            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setStep(1)}>← Back</button>
              <button className={styles.btnPrimary} disabled={!canSubmit() || sending} onClick={handleSubmit}>
                {sending ? 'Sending...' : 'Send quote request'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── QuotePanel pill ───────────────────────────────────────────
export default function QuotePanel({ config, sceneItems, catalog }) {
  const [open, setOpen] = useState(false);
  const count = sceneItems.reduce((s, i) => s + i.count, 0);

  const total = sceneItems.reduce((sum, item) => {
    const def = catalog?.[item.modelId];
    let s = (def?.price || 0) * (item.count || 1);
    (def?.sockets || []).forEach(sock => {
      const state = item.socketStates?.[sock.name];
      const accDef = catalog?.__accessories?.[sock.accessoryFile];
      const p = accDef?.price || 0;
      if (!state || !p) return;
      if (sock.behavior === 'fixed' && state.on) s += p;
      else if (sock.behavior === 'distribute') s += p * (state.count || 0);
      else if (sock.behavior === 'positions' && state.positionIndex >= 0) s += p;
    });
    return sum + s;
  }, 0);

  const hasPrice = total > 0;

  function formatPrice(n) {
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  return (
    <>
      <div className={styles.quotePill} style={{ pointerEvents: 'all' }}>

        <div className={styles.itemCount}>{count} item{count !== 1 ? 's' : ''}</div>

        <div className={styles.totalBlock}>
          <div className={styles.totalLabel}>Estimated Total</div>
          <div className={styles.totalValue}>
            {hasPrice ? formatPrice(total) : 'Contact for pricing'}
          </div>
          <div className={styles.rentText}>{RENT_TEXT}</div>
        </div>

        <button
          className={styles.quoteBtn}
          onClick={() => setOpen(true)}
          disabled={count === 0}
        >
          Get a quote
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="5" y1="12" x2="19" y2="12"/>
            <polyline points="12 5 19 12 12 19"/>
          </svg>
        </button>

        {config.phone && (
          <div className={styles.phoneRow}>
            or call us at<br />
            <a href={`tel:${config.phoneHref}`} className={styles.phoneLink}>
              {config.phone}
            </a>
          </div>
        )}

      </div>

      {open && (
        <QuoteModal config={config} sceneItems={sceneItems} catalog={catalog} onClose={() => setOpen(false)} />
      )}
    </>
  );
}


