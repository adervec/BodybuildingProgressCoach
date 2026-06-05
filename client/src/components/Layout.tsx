import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useApp } from '../state/store';
import { categoryLabel } from '../lib/poses';
import { Icon } from './Icon';
import { DisclaimerNotice, openDisclaimer } from './DisclaimerNotice';

const NAV = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/capture', label: 'Capture', icon: 'capture' },
  { to: '/pose', label: 'Pose Studio', icon: 'pose' },
  { to: '/physique', label: 'Physique', icon: 'physique' },
  { to: '/compare', label: 'Compare', icon: 'compare' },
  { to: '/timelapse', label: 'Timelapse', icon: 'timelapse' },
  { to: '/guides', label: 'Guides', icon: 'guide' },
  { to: '/athletes', label: 'Athletes', icon: 'athletes' },
];

export function Layout() {
  const { athletes, current, selectAthlete, aiEnabled, aiModel } = useApp();
  const navigate = useNavigate();
  const initials = current?.name?.trim()?.[0]?.toUpperCase() ?? '—';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          Living Sculpture
          <div className="sub">Progress Coach</div>
        </div>

        <div className="athlete-switch">
          <div className="who">
            <div className="avatar">
              {current?.latest_thumb ? <img src={`/thumbs/${current.latest_thumb}`} alt="" /> : initials}
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
                <NavLink to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'active' : '')}>
                  <Icon name={n.icon} className="ic" />
                  {n.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div style={{ marginTop: 'auto' }}>
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

      <main className="content">
        <Outlet />
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
