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
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Discover</h1>
          <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-[var(--text-dim)]">
            The bundled starter collection — {catalog.length} stickers generated locally by the studio's own renderer.
            Import any of them into My Space, remix them, or download the PNG.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Segmented
            value={sort}
            onChange={(value) => setSort(value as SortKey)}
            options={[
              { value: 'trending', label: 'Trending' },
              { value: 'latest', label: 'Latest' },
              { value: 'downloads', label: 'Downloads' },
              { value: 'favorites', label: 'Favorites' },
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
              placeholder="Search the starter pack by name or tag…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search discovery"
              data-testid="discover-search"
            />
            {search ? (
              <button type="button" className="icon-btn absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2" onClick={() => setSearch('')} aria-label="Clear search">
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
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-1">
          <span className="flex shrink-0 items-center gap-1 text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
            <Filter size={11} /> Tags
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
          {items.length} item{items.length === 1 ? '' : 's'} · your device holds {localCount} asset
          {localCount === 1 ? '' : 's'}
        </p>
        <span className="hidden items-center gap-1.5 text-[10px] text-[var(--text-faint)] sm:flex">
          <ArrowUpDown size={11} /> {sort}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            title="Nothing matches that filter"
            body="Try clearing the search or picking a different category."
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
                Reset filters
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
        <SectionHeader title="About this collection" hint="Honest labelling matters more than a big number." />
        <p className="text-[12px] leading-relaxed text-[var(--text-dim)]">
          This build ships a <strong className="text-[var(--text)]">starter pack</strong> instead of a hosted community
          database. The stickers are rendered on demand by <code className="font-mono text-[11px]">src/lib/starter.ts</code>{' '}
          with the same Canvas pipeline used for your own cutouts, then stored locally when you import them. There is no
          fake download counter and no mock author. A real multi-user gallery needs a backend, which this local-first
          release does not ship — see the README for the roadmap.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn text-[12px]" onClick={() => void importAllStarters()}>
            <Download size={13} /> Import all {catalog.length} starters
          </button>
          <button type="button" className="btn text-[12px]" onClick={() => navigate('create')}>
            <Sparkles size={13} /> Make your own instead
          </button>
        </div>
      </div>
    </div>
  );

  async function importAllStarters(): Promise<void> {
    toast('Generating the starter pack…', 'info');
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
        toast(`Could not import ${item.title}`, 'error', message);
      }
    }
    if (done) toast(`${done} starter asset${done === 1 ? '' : 's'} imported to My Space.`, 'success');
  }
}

function CommunityCard({ item, onOpen }: { item: CommunityItem; onOpen: () => void }) {
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
      toast(`${item.title} added to My Space.`, 'success');
    } catch (error) {
      toast('Import failed', 'error', error instanceof Error ? error.message : String(error));
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
      toast('PNG downloaded.', 'success');
    } catch (error) {
      toast('Download failed', 'error', error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)]">
      <button type="button" onClick={onOpen} className="checker-sm relative block aspect-square" aria-label={`Open ${item.title} in Create`}>
        {item.starter ? (
          <StarterThumb item={item.starter} className="h-full w-full object-contain p-2" />
        ) : (
          <span className="grid h-full place-items-center text-[var(--text-faint)]">
            <Sparkles size={18} />
          </span>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
          {item.category}
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
            aria-label={`Import ${item.title} to My Space`}
          >
            {imported ? <Check size={12} /> : <Download size={12} />}
            {imported ? 'Added' : 'Import'}
          </button>
          <button
            type="button"
            className="icon-btn h-8 w-8"
            onClick={() => void saveDownload()}
            disabled={busy}
            aria-label={`Download ${item.title}`}
            title="Download PNG"
          >
            <Download size={13} />
          </button>
          <button
            type="button"
            className="icon-btn h-8 w-8"
            onClick={() => {
              setSaved((s) => !s);
              toast(saved ? 'Removed from favorites' : 'Added to favorites (this session)', 'info');
            }}
            aria-label="Favorite"
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
          title="That publication is not in this build"
          body="This release ships the local starter collection only, so links to other publications will not resolve."
          action={
            <button type="button" className="btn-primary" onClick={() => navigate('discover')}>
              Back to Discover
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1100px] px-3 pb-24 pt-4 sm:px-6 sm:pb-10">
      <button type="button" className="btn-ghost mb-3 text-[12px]" onClick={() => navigate('discover')}>
        ← Discover
      </button>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="overflow-hidden rounded-xl border border-[var(--line)]">
          <div className="checker flex items-center justify-center p-4">
            <canvas ref={canvasRef} width={item.width} height={item.height} className="max-h-[62vh] w-auto max-w-full" />
          </div>
        </div>
        <div className="panel p-4">
          <span className="chip">{item.category}</span>
          <h1 className="mt-2 text-lg font-semibold">{item.title}</h1>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-dim)]">{item.description}</p>
          <dl className="mt-3 space-y-1.5 text-[11px]">
            <Row label="Author" value={item.author} />
            <Row label="Dimensions" value={`${item.width} × ${item.height}`} />
            <Row label="Format" value="PNG · transparent" />
            <Row label="File size" value={size ? formatBytes(size) : '—'} />
            <Row label="License" value="CC0 · free to remix" />
            <Row label="Source" value="Rendered locally" />
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
                  toast('Downloaded.', 'success');
                });
              }}
            >
              <Download size={13} /> Download PNG
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
                toast('Added to My Space.', 'success');
              }}
            >
              <Star size={13} /> Add to library
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
