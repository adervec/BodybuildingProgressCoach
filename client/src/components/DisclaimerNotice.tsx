import { useEffect, useState } from 'react';

const ACK_KEY = 'bpc.disclaimerAck.v1';
const SHOW_EVENT = 'bpc:show-disclaimer';

/** Imperatively (re)open the disclaimer — e.g. from the sidebar footer link. */
export function openDisclaimer(): void {
  window.dispatchEvent(new Event(SHOW_EVENT));
}

/**
 * First-run disclaimer the user acknowledges once (persisted in localStorage),
 * and can reopen anytime. Ties the repo's DISCLAIMER.md / PRIVACY.md to the UI.
 */
export function DisclaimerNotice() {
  const [open, setOpen] = useState(false);
  // Assume acknowledged until storage is read, so we never flash the modal.
  const [acked, setAcked] = useState(true);

  useEffect(() => {
    let stored = false;
    try {
      stored = localStorage.getItem(ACK_KEY) === '1';
    } catch {
      stored = false;
    }
    setAcked(stored);
    if (!stored) setOpen(true);

    const onShow = () => setOpen(true);
    window.addEventListener(SHOW_EVENT, onShow);
    return () => window.removeEventListener(SHOW_EVENT, onShow);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // Escape closes only once acknowledged (first run forces a choice).
      if (e.key === 'Escape' && acked) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, acked]);

  if (!open) return null;

  const acknowledge = () => {
    try {
      localStorage.setItem(ACK_KEY, '1');
    } catch {
      /* storage disabled (private mode) — still dismiss for this session */
    }
    setAcked(true);
    setOpen(false);
  };

  // Backdrop click closes only when already acknowledged.
  const onBackdrop = () => {
    if (acked) setOpen(false);
  };

  return (
    <div
      className="disclaimer-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="disclaimer-title"
      onClick={onBackdrop}
    >
      <div className="disclaimer-modal card solid" onClick={(e) => e.stopPropagation()}>
        <p className="kicker" style={{ marginBottom: 10 }}>
          Please read
        </p>
        <h2 id="disclaimer-title" className="display" style={{ fontSize: 26, marginBottom: 14 }}>
          An honest disclaimer
        </h2>

        <div className="stack" style={{ gap: 10 }}>
          <p>
            <strong>Living Sculpture is a software tool — not medical, coaching, or legal advice</strong>{' '}
            and not a substitute for a doctor, certified coach, or trainer. It's made by a software
            developer, not a health professional.
          </p>
          <p className="muted tiny">
            Scores are reproducible <em>geometry</em>, not a verdict on your health or worth.
            "Reference-form" targets are stylized teaching diagrams, not a real judging panel. The
            optional AI critique is an automated opinion that can be wrong, and only runs — sending the
            analyzed image to Anthropic — if you add your own API key. Posing and training carry a risk
            of injury; train sensibly and consult a professional. Provided "as is," without warranty.
          </p>
          <p className="tiny muted">
            Full{' '}
            <a
              href="https://github.com/adervec/BodybuildingProgressCoach/blob/main/DISCLAIMER.md"
              target="_blank"
              rel="noreferrer"
            >
              disclaimer
            </a>{' '}
            and{' '}
            <a
              href="https://github.com/adervec/BodybuildingProgressCoach/blob/main/PRIVACY.md"
              target="_blank"
              rel="noreferrer"
            >
              privacy notice
            </a>
            .
          </p>
          <p className="tiny muted">
            More apps by this maker —{' '}
            <a href="https://adervec.github.io" target="_blank" rel="noopener noreferrer">
              adervec.github.io
            </a>
            .
          </p>
        </div>

        <div className="row spread" style={{ marginTop: 20 }}>
          {acked ? (
            <span className="tiny muted">You've already acknowledged this.</span>
          ) : (
            <span className="tiny muted">Shown once — reopen anytime from the sidebar.</span>
          )}
          <button className="btn primary" onClick={acknowledge} autoFocus>
            {acked ? 'Close' : 'I understand'}
          </button>
        </div>
      </div>
    </div>
  );
}
