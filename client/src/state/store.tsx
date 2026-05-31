import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../api';
import type { Athlete } from '../lib/types';
import { themeFor } from '../lib/poses';

interface AppState {
  athletes: Athlete[];
  current: Athlete | null;
  aiEnabled: boolean;
  aiModel: string;
  loading: boolean;
  refreshAthletes: () => Promise<Athlete[]>;
  selectAthlete: (id: number | null) => void;
  toast: (msg: string) => void;
}

const Ctx = createContext<AppState | null>(null);
const STORAGE_KEY = 'bpc.currentAthleteId';

export function AppProvider({ children }: { children: ReactNode }) {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [currentId, setCurrentId] = useState<number | null>(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? Number(raw) : null;
  });
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiModel, setAiModel] = useState('');
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const refreshAthletes = useCallback(async () => {
    const list = await api.athletes.list();
    setAthletes(list);
    return list;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [list, status] = await Promise.all([api.athletes.list(), api.status()]);
        setAthletes(list);
        setAiEnabled(status.ai.enabled);
        setAiModel(status.ai.model);
        setCurrentId((prev) => (prev && list.some((a) => a.id === prev) ? prev : list[0]?.id ?? null));
      } catch {
        /* surfaced by pages */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const current = useMemo(() => athletes.find((a) => a.id === currentId) ?? null, [athletes, currentId]);

  // Theme follows the active athlete's category (ink for men's, marble for women's).
  useEffect(() => {
    const theme = current ? themeFor(current.category) : 'ink';
    document.documentElement.setAttribute('data-theme', theme);
  }, [current]);

  const selectAthlete = useCallback((id: number | null) => {
    setCurrentId(id);
    if (id) localStorage.setItem(STORAGE_KEY, String(id));
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.clearTimeout((toast as unknown as { _t?: number })._t);
    (toast as unknown as { _t?: number })._t = window.setTimeout(() => setToastMsg(null), 3200);
  }, []);

  const value: AppState = { athletes, current, aiEnabled, aiModel, loading, refreshAthletes, selectAthlete, toast };

  return (
    <Ctx.Provider value={value}>
      {children}
      {toastMsg && <div className="toast">{toastMsg}</div>}
    </Ctx.Provider>
  );
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
