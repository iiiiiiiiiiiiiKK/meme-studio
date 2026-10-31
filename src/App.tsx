import { useEffect } from 'react';
import { useUi, type Route } from './state/ui';
import { useLibrary } from './state/library';
import { TopBar, SideNav, MobileNav, BottomNav } from './components/navigation';
import { HomePage } from './pages/home';
import { DiscoverPage, PublicationPage } from './pages/discover';
import { CreatePage } from './pages/create';
import { EditorPage } from './pages/editor';
import { BatchPage } from './pages/batch';
import { LibraryPage } from './pages/library';
import { TemplatesPage } from './pages/templates';
import { SettingsPage } from './pages/settings';
import { ToastStack } from './components/ui';

const ROUTES: Route[] = ['home', 'discover', 'create', 'editor', 'batch', 'library', 'templates', 'settings', 'publication'];

export function App() {
  const { route, toasts, dismissToast, toast, publicationId, navigate, theme } = useUi();
  const load = useLibrary((s) => s.load);

  // initial load + hash routing
  useEffect(() => {
    load().catch((error: unknown) => {
      toast(
        'Local storage is unavailable',
        'error',
        `Your browser blocked IndexedDB, so nothing can be saved. Private windows and some extensions cause this. (${
          error instanceof Error ? error.message : String(error)
        })`,
      );
    });
  }, [load, toast]);

  useEffect(() => {
    const applyHash = () => {
      const hash = window.location.hash.replace(/^#\/?/, '');
      const [head, tail] = hash.split('/');
      if (!head) return;
      if (head === 'publication' && tail) {
        useUi.setState({ route: 'publication', publicationId: tail });
        return;
      }
      if (ROUTES.includes(head as Route) && head !== 'publication') {
        useUi.setState({ route: head as Route, publicationId: null });
      }
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--bg)]">
      <TopBar onSearch={(value) => useUi.getState().setSearch(value)} />
      <MobileNav />
      <div className="flex min-h-0 flex-1">
        <SideNav />
        <main className="min-w-0 flex-1 pb-[64px] lg:pb-0" data-testid="main">
          {route === 'home' ? <HomePage /> : null}
          {route === 'discover' ? <DiscoverPage /> : null}
          {route === 'create' ? <CreatePage /> : null}
          {route === 'editor' ? <EditorPage /> : null}
          {route === 'batch' ? <BatchPage /> : null}
          {route === 'library' ? <LibraryPage /> : null}
          {route === 'templates' ? <TemplatesPage /> : null}
          {route === 'settings' ? <SettingsPage /> : null}
          {route === 'publication' ? <PublicationPage id={publicationId ?? ''} /> : null}
        </main>
      </div>
      <BottomNav />
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <footer className="hidden border-t border-[var(--line)] px-4 py-3 text-[10px] text-[var(--text-faint)] lg:block">
        <div className="mx-auto flex max-w-[1180px] items-center gap-2">
          <span>Meme Studio · local-first meme asset factory</span>
          <span className="ml-auto">
            Built with React, TensorFlow.js (RVM + FaceMesh) and Canvas. MIT licensed.
          </span>
          <button type="button" className="underline-offset-2 hover:underline" onClick={() => navigate('settings')}>
            Privacy
          </button>
        </div>
      </footer>
    </div>
  );
}
