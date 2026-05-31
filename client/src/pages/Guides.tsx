import { useState, useEffect } from 'react';
import { useApp } from '../state/store';
import { themeFor } from '../lib/poses';
import { PageHead } from '../components/Layout';

const GUIDES = [
  { key: 'men', label: 'The Sandow Plates (Men)', src: '/guides/posing-guide.html' },
  { key: 'women', label: 'The Atalanta Plates (Women)', src: '/guides/posing-guide-women.html' },
];

export function Guides() {
  const { current } = useApp();
  const [key, setKey] = useState('men');

  useEffect(() => {
    if (current) setKey(themeFor(current.category) === 'marble' ? 'women' : 'men');
  }, [current]);

  const guide = GUIDES.find((g) => g.key === key) ?? GUIDES[0];

  return (
    <div>
      <PageHead
        kicker="Reference"
        title="The Posing Guides"
        lede="The same criteria and ideal forms this app scores against — read in full. Every analysis in the app traces back to these plates."
      />
      <div className="row wrap" style={{ gap: 8, marginBottom: 18 }}>
        {GUIDES.map((g) => (
          <button key={g.key} className={`btn sm ${g.key === key ? 'primary' : ''}`} onClick={() => setKey(g.key)}>
            {g.label}
          </button>
        ))}
        <a className="btn sm" href={guide.src} target="_blank" rel="noreferrer">
          Open in new tab ↗
        </a>
      </div>
      <iframe
        title={guide.label}
        src={guide.src}
        style={{ width: '100%', height: '78vh', border: '1px solid var(--line)', borderRadius: 6, background: '#0c0b08' }}
      />
    </div>
  );
}
