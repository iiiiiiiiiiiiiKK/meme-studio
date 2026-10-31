import { create } from 'zustand';

export type Route =
  | 'home'
  | 'discover'
  | 'create'
  | 'editor'
  | 'batch'
  | 'library'
  | 'templates'
  | 'settings'
  | 'publication';

export interface Toast {
  id: string;
  message: string;
  kind: 'info' | 'success' | 'error';
  detail?: string;
}

export interface UiState {
  route: Route;
  theme: 'dark' | 'light';
  toasts: Toast[];
  engineStatus: 'idle' | 'loading' | 'ready' | 'error';
  engineMessage: string;
  mobileNavOpen: boolean;
  search: string;
  publicationId: string | null;
  navigate: (route: Route, opts?: { publicationId?: string }) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  toast: (message: string, kind?: Toast['kind'], detail?: string) => void;
  dismissToast: (id: string) => void;
  setEngine: (status: UiState['engineStatus'], message?: string) => void;
  setSearch: (value: string) => void;
  setMobileNav: (open: boolean) => void;
}

const THEME_KEY = 'meme-studio:theme';

function readTheme(): 'dark' | 'light' {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    /* private mode */
  }
  return 'dark';
}

export function applyTheme(theme: 'dark' | 'light'): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0c0e13' : '#f4f5f7');
}

export const useUi = create<UiState>((set, get) => ({
  route: 'home',
  theme: readTheme(),
  toasts: [],
  engineStatus: 'idle',
  engineMessage: 'Local models load on first use.',
  mobileNavOpen: false,
  search: '',
  publicationId: null,
  navigate: (route, opts) => {
    set({ route, publicationId: opts?.publicationId ?? null, mobileNavOpen: false });
    if (typeof window !== 'undefined') {
      const hash = route === 'publication' && opts?.publicationId ? `#/publication/${opts.publicationId}` : `#/${route}`;
      if (window.location.hash !== hash) window.location.hash = hash;
      window.scrollTo({ top: 0 });
    }
  },
  setTheme: (theme) => {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
    applyTheme(theme);
    set({ theme });
  },
  toast: (message, kind = 'info', detail) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    set({ toasts: [...get().toasts, { id, message, kind, detail }] });
    const ttl = kind === 'error' ? 8000 : 4000;
    setTimeout(() => {
      set({ toasts: get().toasts.filter((t) => t.id !== id) });
    }, ttl);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  setEngine: (engineStatus, message) =>
    set({ engineStatus, engineMessage: message ?? get().engineMessage }),
  setSearch: (search) => set({ search }),
  setMobileNav: (mobileNavOpen) => set({ mobileNavOpen }),
}));

export const AUTHOR_X_URL = 'https://x.com/0xkillcoin';
export const AUTHOR_X_HANDLE = '@0xkillcoin';
