import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Crown,
  Download,
  Filter,
  Heart,
  Search,
  Star,
  ArrowUpDown,
  X,
  Sparkles,
} from 'lucide-react';
import { useUi } from '../state/ui';
import { useI18n } from '../i18n';
import { useLibrary } from '../state/library';
import { STARTER_ITEMS, type StarterItem } from '../lib/starter';
import { generateStarter } from '../lib/starter';
import { downloadBlob, formatBytes } from '../lib/image';
import { EmptyState, SectionHeader, Segmented } from '../components/ui';
import { StarterThumb } from './home';
import { ctx2d, canvasToBlob } from '../lib/image';

type SortKey = 'trending' | 'latest' | 'downloads' | 'favorites';
type Category = 'All' | StarterItem['category'];

const CATEGORIES: Category[] = ['All', 'Sticker', 'Reaction', 'Crypto', 'Object', 'Template'];

interface CommunityItem {
  id: string;
  title: string;
  description: string;
  tags: string[];
  category: StarterItem['category'];
  author: string;
  downloads: number;
  favorites: number;
  createdAt: number;
  starter?: StarterItem;
}

function buildCatalog(): CommunityItem[] {
  const now = Date.now();
  return STARTER_ITEMS.map((item, index) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    tags: item.tags,
    category: item.category,
    author: item.author,
    downloads: 0,
    favorites: 0,
    createdAt: now - index * 36e5,
    starter: item,
  }));
}

export function DiscoverPage() {
  const { t } = useI18n();
  const { search, setSearch, toast, navigate } = useUi();
  const { assets } = useLibrary();
  const [sort, setSort] = useState<SortKey>('trending');
  const [category, setCategory] = useState<Category>('All');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const catalog = useMemo(buildCatalog, []);

  const localCount = assets.filter((a) => !a.deleted).length;

  const items = useMemo(() => {
    const query = search.trim().toLowerCase();
    let list = catalog.filter((item) => {
      if (category !== 'All' && item.category !== category) return false;
      if (activeTag && !item.tags.includes(activeTag)) return false;
      if (!query) return true;
      return (
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.tags.some((tag) => tag.includes(query))
      );
    });
    list = [...list].sort((a, b) => {
      if (sort === 'latest') return b.createdAt - a.createdAt;
      if (sort === 'favorites') return b.favorites - a.favorites;
      if (sort === 'downloads') return b.downloads - a.downloads;
      const rank = (i: CommunityItem) => (i.category === 'Sticker' ? 3 : i.category === 'Reaction' ? 2 : 1);
      return rank(b) - rank(a);
    });
    return list;
  }, [catalog, category, activeTag, search, sort]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    catalog.forEach((item) => item.tags.forEach((tag) => set.add(tag)));
    return [...set].sort();
  }, [catalog]);

  return (
    <div className="mx-auto w-full max-w-[1180px] px-3 pb-24 pt-4 sm:px-6 sm:pb-10 sm:pt-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t('Discover')}</h1>
          <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-[var(--text-dim)]">
            {t(
              'The bundled starter collection — {count} stickers generated locally by the studio’s own renderer. Import any of them into My Space, remix them, or download the PNG.',
              { count: catalog.length },
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Segmented
            value={sort}
            onChange={(value) => setSort(value as SortKey)}
            options={[
              { value: 'trending', label: t('Trending') },
              { value: 'latest', label: t('Latest') },
              { value: 'downloads', label: t('Downloads') },
              { value: 'favorites', label: t('Favorites') },
            ]}
            size="sm"
          />
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
            <input
              className="field pl-8"
              placeholder={t('Search the starter pack by name or tag…')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={t('Search discovery')}
              data-testid="discover-search"
            />
            {search ? (
              <button type="button" className="icon-btn absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2" onClick={() => setSearch('')} aria-label={t('Clear search')}>
                <X size={13} />
              </button>
            ) : null}
          </div>
          <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
            {CATEGORIES.map((item) => (
              <button
                key={item}
                type="button"
                className={`chip shrink-0 ${category === item ? 'chip-active' : ''}`}
                onClick={() => setCategory(item)}
              >
                {t(item)}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-1">
          <span className="flex shrink-0 items-center gap-1 text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
            <Filter size={11} /> {t('Tags')}
          </span>
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`chip shrink-0 ${activeTag === tag ? 'chip-active' : ''}`}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
            >
              #{tag}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-[11px] text-[var(--text-faint)]">
          {t('{count} items · your device holds {local} assets', { count: items.length, local: localCount })}
        </p>
        <span className="hidden items-center gap-1.5 text-[10px] text-[var(--text-faint)] sm:flex">
          <ArrowUpDown size={11} /> {sort}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            title={t('Nothing matches that filter')}
            body={t('Try clearing the search or picking a different category.')}
            action={
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setSearch('');
                  setActiveTag(null);
                  setCategory('All');
                }}
              >
                {t('Reset filters')}
              </button>
            }
          />
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <CommunityCard key={item.id} item={item} onOpen={() => navigate('create')} />
          ))}
        </div>
      )}

      <div className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
        <SectionHeader title={t('About this collection')} hint={t('Honest labelling matters more than a big number.')} />
        <p className="text-[12px] leading-relaxed text-[var(--text-dim)]">
          {t('This build ships a')} <strong className="text-[var(--text)]">{t('starter pack')}</strong>{' '}
          {t('instead of a hosted community database. The stickers are rendered on demand by')}{' '}
          <code className="font-mono text-[11px]">src/lib/starter.ts</code>{' '}
          {t('with the same Canvas pipeline used for your own cutouts, then stored locally when you import them. There is no fake download counter and no mock author. A real multi-user gallery needs a backend, which this local-first release does not ship — see the README for the roadmap.')}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn text-[12px]" onClick={() => void importAllStarters()}>
            <Download size={13} /> {t('Import all {count} starters', { count: catalog.length })}
          </button>
          <button type="button" className="btn text-[12px]" onClick={() => navigate('create')}>
            <Sparkles size={13} /> {t('Make your own instead')}
          </button>
        </div>
      </div>
    </div>
  );

  async function importAllStarters(): Promise<void> {
    toast(t('Generating the starter pack…'), 'info');
    let done = 0;
    for (const item of STARTER_ITEMS) {
      try {
        const generated = await generateStarter(item);
        await useLibrary.getState().addAsset({
          blob: generated.blob,
          name: item.title,
          kind: 'starter',
          width: item.width,
          height: item.height,
          tags: item.tags,
          source: 'starter pack',
          hasAlpha: true,
        });
        done++;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        toast(t('Could not import {name}', { name: item.title }), 'error', message);
      }
    }
    if (done) toast(t('{count} starter assets imported to My Space.', { count: done }), 'success');
  }
}

function CommunityCard({ item, onOpen }: { item: CommunityItem; onOpen: () => void }) {
  const { t } = useI18n();
  const { toast } = useUi();
  const [imported, setImported] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function importToLibrary(): Promise<void> {
    if (!item.starter) return;
    setBusy(true);
    try {
      const generated = await generateStarter(item.starter);
      await useLibrary.getState().addAsset({
        blob: generated.blob,
        name: item.starter.title,
        kind: 'starter',
        width: item.starter.width,
        height: item.starter.height,
        tags: item.starter.tags,
        source: 'starter pack',
        hasAlpha: true,
      });
      setImported(true);
      toast(t('{name} added to My Space.', { name: item.title }), 'success');
    } catch (error) {
      toast(t('Import failed'), 'error', error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function saveDownload(): Promise<void> {
    if (!item.starter) return;
    setBusy(true);
    try {
      const generated = await generateStarter(item.starter);
      downloadBlob(generated.blob, `${item.id}.png`);
      setSaved(true);
      toast(t('PNG downloaded.'), 'success');
    } catch (error) {
      toast(t('Download failed'), 'error', error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
      <button type="button" onClick={onOpen} className="checker-sm relative block aspect-square" aria-label={t('Open {name} in Create', { name: item.title })}>
        {item.starter ? (
          <StarterThumb item={item.starter} className="h-full w-full object-contain p-2" />
        ) : (
          <span className="grid h-full place-items-center text-[var(--text-faint)]">
            <Sparkles size={18} />
          </span>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
          {t(item.category)}
        </span>
      </button>
      <div className="flex flex-1 flex-col p-2.5">
        <p className="truncate text-[12px] font-medium">{item.title}</p>
        <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-[var(--text-faint)]">{item.description}</p>
        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-[var(--text-faint)]">
          <Crown size={10} />
          {item.author}
        </div>
        <div className="mt-2 flex items-center gap-1">
          <button
            type="button"
            className="btn h-8 flex-1 px-2 text-[11px]"
            onClick={() => void importToLibrary()}
            disabled={busy || imported}
            aria-label={t('Import {name} to My Space', { name: item.title })}
          >
            {imported ? <Check size={12} /> : <Download size={12} />}
            {imported ? t('Added') : t('Import')}
          </button>
          <button
            type="button"
            className="icon-btn h-8 w-8"
            onClick={() => void saveDownload()}
            disabled={busy}
            aria-label={t('Download {name}', { name: item.title })}
            title={t('Download PNG')}
          >
            <Download size={13} />
          </button>
          <button
            type="button"
            className="icon-btn h-8 w-8"
            onClick={() => {
              setSaved((s) => !s);
              toast(saved ? t('Removed from favorites') : t('Added to favorites (this session)'), 'info');
            }}
            aria-label={t('Favorite')}
            aria-pressed={saved}
          >
            <Heart size={13} style={{ color: saved ? 'var(--danger)' : undefined }} fill={saved ? 'var(--danger)' : 'none'} />
          </button>
        </div>
      </div>
    </article>
  );
}

export function PublicationPage({ id }: { id: string }) {
  const { t } = useI18n();
  const { navigate, toast } = useUi();
  const item = STARTER_ITEMS.find((s) => s.id === id);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !item) return;
    const ctx = ctx2d(canvas);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    item.draw(ctx, canvas.width);
    void canvasToBlob(canvas, 'image/png').then((blob) => setSize(blob.size));
  }, [item]);

  if (!item) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState
          title={t('That publication is not in this build')}
          body={t('This release ships the local starter collection only, so links to other publications will not resolve.')}
          action={
            <button type="button" className="btn-primary" onClick={() => navigate('discover')}>
              {t('Back to Discover')}
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1100px] px-3 pb-24 pt-4 sm:px-6 sm:pb-10">
      <button type="button" className="btn-ghost mb-3 text-[12px]" onClick={() => navigate('discover')}>
        ← {t('Discover')}
      </button>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="overflow-hidden rounded-xl border border-[var(--line)]">
          <div className="checker flex items-center justify-center p-4">
            <canvas ref={canvasRef} width={item.width} height={item.height} className="max-h-[62vh] w-auto max-w-full" />
          </div>
        </div>
        <div className="panel p-4">
          <span className="chip">{t(item.category)}</span>
          <h1 className="mt-2 text-lg font-semibold">{item.title}</h1>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-dim)]">{item.description}</p>
          <dl className="mt-3 space-y-1.5 text-[11px]">
            <Row label={t('Author')} value={item.author} />
            <Row label={t('Dimensions')} value={`${item.width} × ${item.height}`} />
            <Row label={t('Format')} value={t('PNG · transparent')} />
            <Row label={t('File size')} value={size ? formatBytes(size) : '—'} />
            <Row label={t('License')} value={t('CC0 · free to remix')} />
            <Row label={t('Source')} value={t('Rendered locally')} />
          </dl>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <span key={tag} className="chip">
                #{tag}
              </span>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary text-[12px]"
              onClick={() => {
                const canvas = canvasRef.current;
                if (!canvas) return;
                void canvasToBlob(canvas, 'image/png').then((blob) => {
                  downloadBlob(blob, `${item.id}.png`);
                  toast(t('Downloaded.'), 'success');
                });
              }}
            >
              <Download size={13} /> {t('Download PNG')}
            </button>
            <button
              type="button"
              className="btn text-[12px]"
              onClick={async () => {
                const generated = await generateStarter(item);
                await useLibrary.getState().addAsset({
                  blob: generated.blob,
                  name: item.title,
                  kind: 'starter',
                  width: item.width,
                  height: item.height,
                  tags: item.tags,
                  source: 'starter pack',
                  hasAlpha: true,
                });
                toast(t('Added to My Space.'), 'success');
              }}
            >
              <Star size={13} /> {t('Add to library')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[var(--line)] pb-1.5">
      <dt className="text-[var(--text-faint)]">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
