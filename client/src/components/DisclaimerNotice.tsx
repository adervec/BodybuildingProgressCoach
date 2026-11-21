import { useEffect, useState } from 'react';
import { t } from '../lib/i18n';

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
          {t('Please read')}
        </p>
        <h2 id="disclaimer-title" className="display" style={{ fontSize: 26, marginBottom: 14 }}>
          {t('An honest disclaimer')}
        </h2>

        <div className="stack" style={{ gap: 10 }}>
          <p>
            <strong>{t('Living Sculpture is a software tool — not medical, coaching, or legal advice')}</strong>{' '}
            {t("and not a substitute for a doctor, certified coach, or trainer. It's made by a software developer, not a health professional.")}
          </p>
          <p className="muted tiny">
            {t('Scores are reproducible')} <em>{t('geometry')}</em>
            {t(', not a verdict on your health or worth.')}{' '}
            {t('"Reference-form" targets are stylized teaching diagrams, not a real judging panel. The AI judge and coach are automated opinions that can be wrong: they work only through a cowork folder you connect (posing photos go there unless you switch that off) or a self-hosted API key. Posing and training carry a risk of injury; train sensibly and consult a professional. Provided "as is," without warranty.')}
          </p>
          <p className="tiny muted">
            {t('Full')}{' '}
            <a
              href="https://github.com/adervec/BodybuildingProgressCoach/blob/main/DISCLAIMER.md"
              target="_blank"
              rel="noreferrer"
            >
              {t('disclaimer')}
            </a>{' '}
            {t('and')}{' '}
            <a
              href="https://github.com/adervec/BodybuildingProgressCoach/blob/main/PRIVACY.md"
              target="_blank"
              rel="noreferrer"
            >
              {t('privacy notice')}
            </a>
            .
          </p>
          <p className="tiny muted">
            {t('More apps by this maker —')}{' '}
            <a href="https://adervec.github.io" target="_blank" rel="noopener noreferrer">
              adervec.github.io
            </a>
            .
          </p>
        </div>

        <div className="row spread" style={{ marginTop: 20 }}>
          {acked ? (
            <span className="tiny muted">{t("You've already acknowledged this.")}</span>
          ) : (
            <span className="tiny muted">{t('Shown once — reopen anytime from the sidebar.')}</span>
          )}
          <button className="btn primary" onClick={acknowledge} autoFocus>
            {acked ? t('Close') : t('I understand')}
          </button>
        </div>
      </div>
    </div>
  );
}
