import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../state/store';
import { categoryLabel } from '../lib/poses';
import { Icon } from './Icon';
import { DisclaimerNotice, openDisclaimer } from './DisclaimerNotice';
import { thumbSrc } from '../api';
import { savedOrientation, saveOrientation, applyOrientation, type OrientationMode } from '../lib/orientation';

const NAV = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/capture', label: 'Capture', icon: 'capture' },
  { to: '/pose', label: 'Pose Studio', icon: 'pose' },
  { to: '/mirror', label: 'Mirror', icon: 'camera' },
  { to: '/physique', label: 'Physique', icon: 'physique' },
  { to: '/compare', label: 'Compare', icon: 'compare' },
  { to: '/timelapse', label: 'Timelapse', icon: 'timelapse' },
  { to: '/guides', label: 'Guides', icon: 'guide' },
  { to: '/athletes', label: 'Athletes', icon: 'athletes' },
  { to: '/backup', label: 'Backup', icon: 'download' },
];

export function Layout() {
  const { athletes, current, selectAthlete, aiEnabled, aiModel, toast } = useApp();
  const navigate = useNavigate();
  const initials = current?.name?.trim()?.[0]?.toUpperCase() ?? '—';

  // The content pane is the scroll container now, so a route change must reset it —
  // the browser only does this for body scrolling.
  const mainRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [pathname]);

  // On phones the sidebar collapses to an icon rail; `navOpen` expands it into a drawer.
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setNavOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navOpen]);

  const [orient, setOrient] = useState<OrientationMode>(() => savedOrientation());
  useEffect(() => {
    applyOrientation(orient); // startup: apply silently; browsers that can't lock just ignore it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function changeOrient(mode: OrientationMode) {
    setOrient(mode);
    saveOrientation(mode);
    const ok = await applyOrientation(mode);
    if (!ok && mode !== 'auto') toast('Saved — this browser can’t lock rotation. It applies in the installed app (Android).');
  }

  return (
    <div className="app-shell">
      {navOpen && <div className="nav-veil" onClick={() => setNavOpen(false)} />}
      <aside className={navOpen ? 'sidebar open' : 'sidebar'}>
        <button
          type="button"
          className="nav-toggle"
          aria-label={navOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={navOpen}
          onClick={() => setNavOpen((o) => !o)}
        >
          {navOpen ? '✕' : '☰'}
        </button>
        <div className="brand">
          Living Sculpture
          <div className="sub">Progress Coach</div>
        </div>

        <div className="athlete-switch">
          <div className="who">
            <div className="avatar">
              {current?.latest_thumb ? <img src={thumbSrc(current.latest_thumb)} alt="" /> : initials}
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {current?.name ?? 'No athlete'}
              </div>
              <div className="cat">{current ? categoryLabel(current.category) : 'select a profile'}</div>
            </div>
          </div>
          {athletes.length > 0 && (
            <select
              style={{ marginTop: 10 }}
              value={current?.id ?? ''}
              onChange={(e) => {
                const id = Number(e.target.value);
                selectAthlete(id);
                setNavOpen(false);
                navigate('/');
              }}
            >
              {athletes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <nav>
          <ul className="nav-links">
            {NAV.map((n) => (
              <li key={n.to}>
                <NavLink
                  to={n.to}
                  end={n.end}
                  title={n.label}
                  className={({ isActive }) => (isActive ? 'active' : '')}
                  onClick={() => setNavOpen(false)}
                >
                  <Icon name={n.icon} className="ic" />
                  <span className="nav-label">{n.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="side-extras" style={{ marginTop: 'auto' }}>
          <label className="field" style={{ marginBottom: 12 }}>
            <span className="lab">Orientation</span>
            <select value={orient} onChange={(e) => changeOrient(e.target.value as OrientationMode)}>
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
              <option value="auto">Auto-rotate</option>
            </select>
          </label>
          <div className="pill" style={{ borderColor: aiEnabled ? 'var(--accent)' : 'var(--line)' }}>
            <Icon name="ai" size={11} /> AI {aiEnabled ? 'on' : 'off'}
          </div>
          {aiEnabled && <div className="tiny muted" style={{ marginTop: 6, fontFamily: 'var(--mono)' }}>{aiModel}</div>}
          <div className="legal-links">
            <button type="button" onClick={openDisclaimer}>
              Disclaimer &amp; privacy
            </button>
          </div>
        </div>
      </aside>

      <main ref={mainRef} className="content">
        <div className="content-inner">
          <Outlet />
        </div>
      </main>

      <DisclaimerNotice />
    </div>
  );
}

export function PageHead({ kicker, title, lede }: { kicker?: string; title: string; lede?: string }) {
  return (
    <header className="page-head">
      {kicker && <p className="kicker" style={{ marginBottom: 12 }}>{kicker}</p>}
      <h1 className="display">{title}</h1>
      {lede && <p className="lede">{lede}</p>}
    </header>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="empty">
      <div className="glyph">
        <Icon name="capture" size={40} />
      </div>
      <h3 className="display" style={{ fontSize: 22, marginBottom: 8 }}>
        {title}
      </h3>
      <p>{children}</p>
    </div>
  );
}
