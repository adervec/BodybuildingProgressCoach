import { useEffect } from 'react';
import { renderPoseSVG, POSE_FIG_CSS } from '../lib/poseDiagram';
import { t } from '../lib/i18n';

let injected = false;
function ensureCss() {
  if (injected || typeof document === 'undefined') return;
  const style = document.createElement('style');
  style.id = 'pose-fig-css';
  style.textContent = POSE_FIG_CSS;
  document.head.appendChild(style);
  injected = true;
}

/** Renders the guide's ideal anatomical figure for a pose id. */
export function PoseDiagram({ poseId, maxWidth = 200 }: { poseId: string; maxWidth?: number }) {
  useEffect(ensureCss, []);
  const svg = renderPoseSVG(poseId);
  if (!svg) {
    return (
      <div className="pose-fig" style={{ maxWidth, opacity: 0.5, fontSize: 12, fontFamily: 'var(--mono)' }}>
        {t('no diagram')}
      </div>
    );
  }
  // Safe: the SVG is generated from built-in pose geometry (numbers and fixed ids), never outside text.
  return <div className="pose-fig" style={{ maxWidth, margin: '0 auto' }} dangerouslySetInnerHTML={{ __html: svg }} />;
}
