import { useEffect, useMemo, useState } from 'react';
import {
  Layers,
  Images,
  Sparkles,
  Menu,
  X,
  Search,
  Plus,
  Sun,
  Moon,
  Github,
  Zap,
  LayoutGrid,
  SlidersHorizontal,
  Home,
} from 'lucide-react';
import { useUi, type Route } from '../state/ui';
import { AUTHOR_X_HANDLE, AUTHOR_X_URL } from '../state/ui';
import { useI18n } from '../i18n';
import { XIcon, GithubIcon } from './brand';
import { useEditor } from '../state/editor';
import { cx } from '../lib/cx';

const PRIMARY: { route: Route; label: string; icon: typeof Home }[] = [
  { route: 'home', label: 'Home', icon: Home },
  { route: 'discover', label: 'Discover', icon: LayoutGrid },
  { route: 'create', label: 'Create', icon: Sparkles },
  { route: 'batch', label: 'Batch Studio', icon: Zap },
  { route: 'library', label: 'My Space', icon: Images },
  { route: 'templates', label: 'Templates', icon: Layers },
  { route: 'settings', label: 'Settings', icon: SlidersHorizontal },
];

export function TopBar({ onSearch }: { onSearch: (value: string) => void }) {
  const { t } = useI18n();
  const { route, navigate, theme, setTheme, search, setSearch, setMobileNav, mobileNavOpen } = useUi();
  const { projectName, dirty } = useEditor();
  const [localSearch, setLocalSearch] = useState(search);

  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] backdrop-blur">
      <div className="flex h-14 items-center gap-2 px-3 sm:gap-3 sm:px-5">
        <button
          type="button"
          className="icon-btn lg:hidden"
          onClick={() => setMobileNav(!mobileNavOpen)}
          aria-label={t('Toggle navigation')}
          aria-expanded={mobileNavOpen}
        >
          {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
        </button>

        <button
          type="button"
          onClick={() => navigate('home')}
          className="flex items-center gap-2.5"
          aria-label={t('Meme Studio home')}
        >
          <span
            className="grid h-8 w-8 place-items-center rounded-[9px] text-[13px] font-black"
            style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
          >
            MS
          </span>
          <span className="hidden flex-col leading-none sm:flex">
            <span className="text-[13px] font-semibold tracking-tight">Meme Studio</span>
            <span className="mt-0.5 text-[10px] text-[var(--text-faint)]">{t('Local-first asset factory')}</span>
          </span>
        </button>

        <div className="mx-auto hidden w-full max-w-md items-center sm:flex">
          <form
            className="relative w-full"
            onSubmit={(e) => {
              e.preventDefault();
              onSearch(localSearch.trim());
              navigate('discover');
            }}
          >
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
            <input
              className="field pl-8 pr-16"
              placeholder={t('Search starter assets, tags, creators…')}
              value={localSearch}
              onChange={(e) => {
                setLocalSearch(e.target.value);
                setSearch(e.target.value);
              }}
              aria-label={t('Search')}
            />
            <span className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 sm:block">
              <span className="kbd">↵</span>
            </span>
          </form>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <a
            href={AUTHOR_X_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--line)] px-2.5 text-[12px] font-medium text-[var(--text-dim)] transition-colors hover:border-[var(--text-faint)] hover:text-[var(--text)]"
            aria-label={t('Author on X: {handle}', { handle: AUTHOR_X_HANDLE })}
            title={t('Author on X: {handle}', { handle: AUTHOR_X_HANDLE })}
            data-testid="author-x-link"
          >
            <XIcon size={13} />
            <span className="hidden xs:inline">{t('Author')}</span>
          </a>

          <button
            type="button"
            className="icon-btn"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? t('Switch to light theme') : t('Switch to dark theme')}
            title={theme === 'dark' ? t('Light theme') : t('Dark theme')}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <button
            type="button"
            className="btn-primary hidden px-3 text-[13px] sm:inline-flex"
            onClick={() => navigate(route === 'editor' ? 'create' : 'create')}
          >
            <Plus size={15} />
            {t('New')}
          </button>

          <a
            href="https://github.com/iiiiiiiiiiiiiKK/meme-studio"
            target="_blank"
            rel="noopener noreferrer"
            className="icon-btn hidden sm:inline-flex"
            aria-label={t('GitHub repository')}
            title={t('GitHub repository')}
          >
            <GithubIcon size={16} />
          </a>
        </div>
      </div>

      {route === 'editor' ? (
        <div className="flex h-9 items-center gap-2 border-t border-[var(--line)] px-3 text-[12px] sm:px-5">
          <span className="truncate font-medium">{projectName || t('Untitled meme')}</span>
          <span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', dirty ? 'bg-[var(--warn)]' : 'bg-[var(--ok)]')} />
          <span className="faint text-[11px]">{dirty ? t('Unsaved changes') : t('Saved to this device')}</span>
          <span className="ml-auto hidden items-center gap-2 text-[11px] text-[var(--text-faint)] sm:flex">
            <Layers size={12} />
            {t('Canvas editor')}
          </span>
        </div>
      ) : null}
    </header>
  );
}

export function SideNav() {
  const { t } = useI18n();
  const { route, navigate, engineStatus } = useUi();
  const projects = useEditor((s) => s.layers.length);
  void projects;

  return (
    <aside className="hidden w-[208px] shrink-0 flex-col border-r border-[var(--line)] bg-[var(--bg-soft)] px-2.5 py-3 lg:flex">
      <nav className="flex flex-col gap-0.5" aria-label={t('Main navigation')}>
        {PRIMARY.map((item) => {
          const Icon = item.icon;
          const active = route === item.route || (route === 'editor' && item.route === 'create') || (route === 'publication' && item.route === 'discover');
          return (
            <button
              key={item.route}
              type="button"
              className={cx('nav-item', active && 'nav-item-active')}
              onClick={() => navigate(item.route)}
              aria-current={active ? 'page' : undefined}
              data-testid={`nav-${item.route}`}
            >
              <Icon size={15} />
              <span>{t(item.label)}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
        <p className="section-title">{t('Local AI')}</p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--text-dim)]">
          {engineStatus === 'ready'
            ? t('RVM matting + FaceMesh running in your browser.')
            : engineStatus === 'loading'
              ? t('Loading models from this site…')
              : engineStatus === 'error'
                ? t('Engine unavailable — see Settings.')
                : t('Models load on first cutout. Nothing is uploaded.')}
        </p>
        <div className="mt-2.5 flex items-center gap-1.5 text-[10px] text-[var(--text-faint)]">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{
              background:
                engineStatus === 'ready' ? 'var(--ok)' : engineStatus === 'error' ? 'var(--danger)' : 'var(--text-faint)',
            }}
          />
          {engineStatus === 'ready' ? t('Ready') : engineStatus === 'loading' ? t('Loading') : engineStatus === 'error' ? t('Error') : t('Idle')}
        </div>
      </div>

      <div className="mt-auto pt-3">
        <a
          href={AUTHOR_X_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 text-[12px] transition-colors hover:border-[var(--text-faint)]"
        >
          <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--panel-3)]">
            <XIcon size={12} />
          </span>
          <span className="min-w-0">
            <span className="block text-[10px] uppercase tracking-wide text-[var(--text-faint)]">{t('Follow the author')}</span>
            <span className="block truncate font-medium">{AUTHOR_X_HANDLE}</span>
          </span>
        </a>
        <a
          href="https://github.com/iiiiiiiiiiiiiKK/meme-studio"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 flex items-center gap-2 px-1 text-[11px] text-[var(--text-faint)] hover:text-[var(--text)]"
        >
          <Github size={12} />
          {t('Open source · MIT')}
        </a>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const { t } = useI18n();
  const { route, navigate, mobileNavOpen, setMobileNav } = useUi();
  if (!mobileNavOpen) return null;
  return (
    <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label={t('Navigation')}>
      <div className="absolute inset-0 bg-black/60" onClick={() => setMobileNav(false)} aria-hidden />
      <div className="fade-in absolute left-0 top-0 h-full w-[264px] border-r border-[var(--line)] bg-[var(--bg-soft)] p-3">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold">Meme Studio</span>
          <button type="button" className="icon-btn" onClick={() => setMobileNav(false)} aria-label={t('Close navigation')}>
            <X size={16} />
          </button>
        </div>
        <nav className="flex flex-col gap-0.5">
          {PRIMARY.map((item) => {
            const Icon = item.icon;
            const active = route === item.route;
            return (
              <button
                key={item.route}
                type="button"
                className={cx('nav-item', active && 'nav-item-active')}
                onClick={() => navigate(item.route)}
              >
                <Icon size={15} />
                <span>{t(item.label)}</span>
              </button>
            );
          })}
        </nav>
        <a
          href={AUTHOR_X_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 text-[12px]"
        >
          <XIcon size={12} />
          {t('Author · {handle}', { handle: AUTHOR_X_HANDLE })}
        </a>
      </div>
    </div>
  );
}

const MOBILE_TABS: { route: Route; label: string; icon: typeof Home }[] = [
  { route: 'home', label: 'Home', icon: Home },
  { route: 'discover', label: 'Discover', icon: LayoutGrid },
  { route: 'create', label: 'Create', icon: Sparkles },
  { route: 'batch', label: 'Batch', icon: Zap },
  { route: 'library', label: 'Space', icon: Images },
];

export function BottomNav() {
  const { t } = useI18n();
  const { route, navigate } = useUi();
  const items = useMemo(() => MOBILE_TABS, []);
  return (
    <nav
      className="safe-bottom fixed bottom-0 left-0 right-0 z-30 grid grid-cols-5 border-t border-[var(--line)] bg-[color-mix(in_srgb,var(--bg)_94%,transparent)] backdrop-blur lg:hidden"
      aria-label={t('Mobile navigation')}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = route === item.route || (route === 'editor' && item.route === 'create');
        return (
          <button
            key={item.route}
            type="button"
            onClick={() => navigate(item.route)}
            className="flex flex-col items-center gap-1 py-2.5"
            style={{ color: active ? 'var(--accent)' : 'var(--text-faint)' }}
            aria-current={active ? 'page' : undefined}
          >
            <Icon size={18} />
            <span className="text-[10px] font-medium">{t(item.label)}</span>
          </button>
        );
      })}
    </nav>
  );
}
