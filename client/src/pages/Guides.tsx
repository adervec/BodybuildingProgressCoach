import { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../state/store';
import { themeFor, poseLabel } from '../lib/poses';
import { PageHead } from '../components/Layout';
import { api } from '../api';
import type { MediaAsset } from '../lib/types';
import { attachDrop } from '../components/DropZone';
import { captureDate } from '../lib/exif';
import { shortDate } from '../lib/format';

// BASE_URL so the guides resolve under a subpath too (the Pages build serves them from public/).
const GUIDES = [
  { key: 'men', label: 'The Sandow Plates (Men)', src: `${import.meta.env.BASE_URL}guides/posing-guide.html` },
  { key: 'women', label: 'The Atalanta Plates (Women)', src: `${import.meta.env.BASE_URL}guides/posing-guide-women.html` },
];

/* Styles for what we inject into the guide document — it has no idea we exist. */
const INJECT_CSS = `
.plate-photo{transition:box-shadow .15s ease}
.plate-photo.ls-drop-over{box-shadow:0 0 0 2px var(--bronze-bright,#e7c47a) inset}
.plate-photo.ls-drop-over .ph{opacity:.25}
.ls-tag{position:absolute;left:0;right:0;bottom:0;z-index:3;padding:7px 11px;
  background:linear-gradient(180deg,transparent,rgba(0,0,0,.78));
  font-family:var(--mono,monospace);font-size:10px;letter-spacing:.16em;
  text-transform:uppercase;color:#f3ecdd}
.ls-shot{z-index:2}
`;

export function Guides() {
  const { current, toast } = useApp();
  const [key, setKey] = useState('men');
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [loads, setLoads] = useState(0); // bumps every time the iframe finishes loading
  const frame = useRef<HTMLIFrameElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const pendingPose = useRef<string | null>(null); // which plate the open file picker belongs to

  useEffect(() => {
    if (current) setKey(themeFor(current.category) === 'marble' ? 'women' : 'men');
  }, [current]);

  const reload = useCallback(() => {
    if (current) api.media.list(current.id).then(setMedia);
    else setMedia([]);
  }, [current]);
  useEffect(reload, [reload]);

  const upload = useCallback(
    async (poseId: string, files: File[]) => {
      if (!current) return toast('Pick an athlete first');
      try {
        for (const f of files) {
          const cd = await captureDate(f);
          await api.media.upload(current.id, f, { captured_at: cd.date, pose_type: poseId, division: current.category });
        }
        toast(`Added to ${poseLabel(poseId)}`);
        reload();
      } catch (err) {
        toast((err as Error).message);
      }
    },
    [current, toast, reload]
  );

  // Fill each plate's empty photo frame with the athlete's own shot of that pose,
  // and make the frame itself a drop target. Same-origin iframe, so we can just reach in.
  useEffect(() => {
    const doc = frame.current?.contentDocument;
    if (!doc) return;

    if (!doc.getElementById('ls-inject')) {
      const style = doc.createElement('style');
      style.id = 'ls-inject';
      style.textContent = INJECT_CSS;
      doc.head.appendChild(style);
    }

    const cleanups: (() => void)[] = [];
    doc.querySelectorAll('article.plate').forEach((plate) => {
      const poseId = plate.querySelector('[data-figure]')?.getAttribute('data-figure');
      const fig = plate.querySelector('figure.plate-photo') as HTMLElement | null;
      if (!poseId || !fig) return;

      fig.querySelectorAll('.ls-shot, .ls-tag').forEach((el) => el.remove());
      // ponytail: newest shot of the pose. Swap to best form_score if "your best" reads better.
      const shot = media
        .filter((m) => m.pose_type === poseId && m.kind === 'photo')
        .sort((a, b) => b.captured_at.localeCompare(a.captured_at))[0];
      if (shot) {
        // The guide's own CSS already absolutely-positions .plate-photo img, so this
        // simply covers the "add a photo" placeholder instead of destroying it.
        const img = doc.createElement('img');
        img.className = 'ls-shot';
        img.src = shot.url;
        img.alt = `Your ${poseLabel(poseId)}, ${shortDate(shot.captured_at)}`;
        const tag = doc.createElement('span');
        tag.className = 'ls-tag';
        tag.textContent = `Your ${poseLabel(poseId)} · ${shortDate(shot.captured_at)}`;
        fig.append(img, tag);
      }
      cleanups.push(attachDrop(fig, (files) => upload(poseId, files)));
      // Tap-to-add: drag & drop doesn't exist on touch, so the frame also opens a file picker.
      const onClick = () => {
        pendingPose.current = poseId;
        fileInput.current?.click();
      };
      fig.addEventListener('click', onClick);
      fig.style.cursor = 'pointer';
      fig.title = `Add a photo of your ${poseLabel(poseId)}`;
      cleanups.push(() => fig.removeEventListener('click', onClick));
    });
    return () => cleanups.forEach((fn) => fn());
  }, [loads, media, upload]);

  const guide = GUIDES.find((g) => g.key === key) ?? GUIDES[0];

  return (
    <div>
      <PageHead
        kicker="Reference"
        title="The Posing Guides"
        lede="The same criteria and ideal forms this app scores against — read in full. Every analysis in the app traces back to these plates."
      />
      <div className="row wrap" style={{ gap: 8, marginBottom: 12 }}>
        {GUIDES.map((g) => (
          <button key={g.key} className={`btn sm ${g.key === key ? 'primary' : ''}`} onClick={() => setKey(g.key)}>
            {g.label}
          </button>
        ))}
        <a className="btn sm" href={guide.src} target="_blank" rel="noreferrer">
          Open in new tab ↗
        </a>
      </div>
      <p className="tiny muted" style={{ marginBottom: 14 }}>
        {current
          ? `Each plate's empty frame is filled with ${current.name}'s most recent shot of that pose — drop a photo onto a frame (or tap it) to add one, tagged automatically.`
          : 'Pick an athlete to see your own photos set into the plates.'}
      </p>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (pendingPose.current && files.length) upload(pendingPose.current, files);
        }}
      />
      <iframe
        ref={frame}
        title={guide.label}
        src={guide.src}
        onLoad={() => setLoads((n) => n + 1)}
        style={{ width: '100%', height: '78vh', border: '1px solid var(--line)', borderRadius: 6, background: '#0c0b08' }}
      />
    </div>
  );
}
