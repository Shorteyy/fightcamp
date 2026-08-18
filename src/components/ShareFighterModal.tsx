import { useState } from 'react';

export function ShareFighterModal({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const link = window.location.origin + '/signup';

  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" style={{ width: 420 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div className="heading" style={{ fontSize: 24 }}>ADD A FIGHTER</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--muted-2)', fontSize: 20 }}>✕</button>
        </div>
        <p style={{ fontSize: 14, color: 'var(--muted-1)', lineHeight: 1.5, marginBottom: 16 }}>
          There's no separate "create fighter" step — new fighters create their own login on the sign-up page.
          Once they sign up, they'll appear on this roster automatically.
        </p>
        <p style={{ fontSize: 13, color: 'var(--muted-2)', lineHeight: 1.5, marginBottom: 16 }}>
          Share this link with them:
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" readOnly value={link} />
          <button className="btn-primary" style={{ width: 90 }} onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted-3)', lineHeight: 1.5, marginTop: 18 }}>
          After they join, open their card on this roster to set their goal weight and deadline for them if they haven't yet.
        </p>
      </div>
    </div>
  );
}
