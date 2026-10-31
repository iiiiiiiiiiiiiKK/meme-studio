import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Heart,
  Image as ImageIcon,
  Layers,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Tag,
  Trash2,
  Undo2,
  X,
  ArrowUpDown,
} from 'lucide-react';
import { useUi } from '../state/ui';
import { useLibrary, type LibraryFilter, type LibrarySort } from '../state/library';
import { useAssetUrl } from '../components/useAssetUrl';
import { EmptyState, Modal, Spinner, StatusPill } from '../components/ui';
import { formatBytes, timestampSlug } from '../lib/image';
import { cx } from '../lib/cx';
import { openProject, timeAgo } from './home';
import { downloadBlob as saveBlob } from '../lib/image';
import type { StoredAsset } from '../lib/db';

const FILTERS: { id: LibraryFilter; label: string }[] = [
  { id: 'all', label: 'All assets' },
  { id: 'original', label: 'Originals' },
  { id: 'cutout', label: 'Cutouts' },
  { id: 'sticker', label: 'Stickers' },
  { id: 'meme', label: 'Memes' },
  { id: 'starter', label: 'Starter pack' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'trash', label: 'Trash' },
];

export function LibraryPage() {
  const library = useLibrary();
  const { toast, navigate } = useUi();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<LibrarySort>('newest');
  const [detail, setDetail] = useState<StoredAsset | null>(null);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    let items = library.assets.filter((asset) => {
      if (library.filter === 'trash') return asset.deleted;
      if (asset.deleted) return false;
      if (library.filter === 'favorites') return asset.favorite;
      if (library.filter === 'all') return true;
      return asset.kind === library.filter;
    });
    if (q) {
      items = items.filter(
        (asset) =>
          asset.name.toLowerCase().includes(q) ||
          asset.tags.some((tag) => tag.toLowerCase().includes(q)),
      );
    }
    return [...items].sort((a, b) => {
      if (sort === 'oldest') return a.createdAt - b.createdAt;
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'size') return b.size - a.size;
      return b.createdAt - a.createdAt;
    });
  }, [library.assets, library.filter, query, sort]);

  const projects = useMemo(
    () => library.projects.filter((project) => !query || project.name.toLowerCase().includes(query.toLowerCase())),
    [library.projects, query],
  );

  return (
    <div className="mx-auto w-full max-w-[1180px] px-3 pb-24 pt-4 sm:px-6 sm:pb-10 sm:pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">My Space</h1>
          <p className="mt-1 max-w-xl text-[12px] text-[var(--text-dim)]">
            Everything here is stored in IndexedDB on this device. Nothing is synced unless you export it.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <StatusPill tone="neutral">
            {formatBytes(library.usage.usage)} used
            {library.usage.quota ? ` of ${formatBytes(library.usage.quota)}` : ''}
          </StatusPill>
          <button type="button" className="btn text-[11px]" onClick={() => navigate('create')}>
            <Plus size={12} /> New asset
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 lg:flex-row lg:items-center">
        <div className="relative lg:w-72">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
          <input
            className="field pl-8"
            placeholder="Search assets and projects…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search library"
            data-testid="library-search"
          />
        </div>
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
          {FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={cx('chip shrink-0', library.filter === filter.id && 'chip-active')}
              onClick={() => library.setFilter(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <ArrowUpDown size={12} className="text-[var(--text-faint)]" />
          <select
            className="field h-8 py-0 text-[11px]"
            value={sort}
            onChange={(e) => setSort(e.target.value as LibrarySort)}
            aria-label="Sort assets"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="name">Name</option>
            <option value="size">Size</option>
          </select>
        </div>
      </div>

      {library.selection.length ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] px-3 py-2 text-[11px]">
          <span>{library.selection.length} selected</span>
          <div className="ml-auto flex flex-wrap gap-1.5">
            <button
              type="button"
              className="btn h-7 text-[10px]"
              onClick={async () => {
                for (const id of library.selection) {
                  const asset = library.assets.find((a) => a.id === id);
                  if (asset) saveBlob(asset.blob, asset.name.endsWith('.png') ? asset.name : `${asset.name}.png`);
                }
                toast('Download started.', 'success');
              }}
            >
              <Download size={11} /> Download
            </button>
            <button
              type="button"
              className="btn h-7 text-[10px]"
              onClick={async () => {
                for (const id of library.selection) await library.remove(id);
                library.clearSelection();
                toast('Moved to trash.', 'info');
              }}
            >
              <Trash2 size={11} /> Trash
            </button>
            <button
              type="button"
              className="btn h-7 text-[10px]"
              onClick={async () => {
                for (const id of library.selection) await library.purge(id);
                library.clearSelection();
                toast('Deleted permanently.', 'info');
              }}
            >
              <X size={11} /> Delete forever
            </button>
            <button type="button" className="btn-ghost h-7 text-[10px]" onClick={library.clearSelection}>
              Clear
            </button>
          </div>
        </div>
      ) : null}

      {library.loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-[12px] text-[var(--text-faint)]">
          <Spinner size={14} /> Reading local storage…
        </div>
      ) : (
        <>
          <section className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">
                Assets · {list.length}
              </h2>
              {library.filter === 'trash' ? (
                <span className="text-[10px] text-[var(--text-faint)]">Items in trash stay on disk until purged</span>
              ) : null}
            </div>
            {list.length === 0 ? (
              <EmptyState
                icon={<ImageIcon size={22} />}
                title={library.filter === 'trash' ? 'Trash is empty' : 'No assets here yet'}
                body={
                  library.filter === 'trash'
                    ? 'Deleted assets are kept here until you purge them.'
                    : 'Cut a sticker in Create, import the starter pack from Discover, or batch-process a folder.'
                }
                action={
                  <div className="flex gap-2">
                    <button type="button" className="btn-primary text-[12px]" onClick={() => navigate('create')}>
                      <Sparkles size={13} /> Create
                    </button>
                    <button type="button" className="btn text-[12px]" onClick={() => navigate('discover')}>
                      Browse starter pack
                    </button>
                  </div>
                }
              />
            ) : (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-5">
                {list.map((asset) => (
                  <AssetCard
                    key={asset.id}
                    asset={asset}
                    selected={library.selection.includes(asset.id)}
                    onToggle={() => library.toggleSelect(asset.id)}
                    onOpen={() => setDetail(asset)}
                  />
                ))}
              </div>
            )}
          </section>

          {library.projects.length ? (
            <section className="mt-6">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">
                  Projects · {projects.length}
                </h2>
                <button type="button" className="btn-ghost text-[10px]" onClick={() => navigate('create')}>
                  <Layers size={11} /> New project
                </button>
              </div>
              {projects.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[var(--line)] px-3 py-6 text-center text-[11px] text-[var(--text-faint)]">
                  No projects match that search.
                </p>
              ) : (
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {projects.map((project) => (
                    <ProjectTile
                      key={project.id}
                      project={project}
                      onDelete={async () => {
                        const ok = window.confirm(`Delete the project “${project.name}”? This cannot be undone.`);
                        if (!ok) return;
                        await library.removeProject(project.id);
                        toast('Project deleted.', 'info');
                      }}
                    />
                  ))}
                </div>
              )}
            </section>
          ) : null}
        </>
      )}

      <AssetDetail
        asset={detail}
        onClose={() => setDetail(null)}
        onDeleted={() => setDetail(null)}
        onOpenEditor={async (asset) => {
          const canvas = document.createElement('canvas');
          canvas.width = asset.width;
          canvas.height = asset.height;
          const ctx = canvas.getContext('2d');
          const img = new Image();
          img.src = useLibrary.getState().urlFor(asset);
          await img.decode().catch(() => undefined);
          ctx?.drawImage(img, 0, 0);
          if (!ctx) return;
          await openStickerInEditor(canvas, asset.name, asset.id);
          setDetail(null);
        }}
      />
    </div>
  );
}

function AssetCard({
  asset,
  selected,
  onToggle,
  onOpen,
}: {
  asset: StoredAsset;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const url = useAssetUrl(asset);
  return (
    <div
      className={cx(
        'group relative overflow-hidden rounded-lg border bg-[var(--panel)]',
        selected ? 'border-[var(--accent)]' : 'border-[var(--line)]',
      )}
    >
      <button type="button" className="checker-sm relative flex aspect-square w-full items-center justify-center" onClick={onOpen} aria-label={`Open ${asset.name}`}>
        {url ? <img src={url} alt={asset.name} className="h-full w-full object-contain p-1" loading="lazy" /> : null}
        {asset.deleted ? (
          <span className="absolute inset-0 grid place-items-center bg-black/50 text-[10px] text-white">In trash</span>
        ) : null}
      </button>
      <button
        type="button"
        onClick={onToggle}
        aria-label={selected ? `Deselect ${asset.name}` : `Select ${asset.name}`}
        className="absolute left-1.5 top-1.5 grid h-5 w-5 place-items-center rounded border"
        style={{
          borderColor: selected ? 'var(--accent)' : 'rgba(255,255,255,0.35)',
          background: selected ? 'var(--accent)' : 'rgba(0,0,0,0.5)',
          color: selected ? 'var(--accent-ink)' : 'transparent',
        }}
      >
        <Check size={11} />
      </button>
      {asset.favorite ? (
        <span className="absolute right-1.5 top-1.5 text-[var(--danger)]">
          <Heart size={11} fill="currentColor" />
        </span>
      ) : null}
      <div className="px-1.5 py-1">
        <p className="truncate text-[10px] font-medium" title={asset.name}>
          {asset.name}
        </p>
        <p className="text-[9px] text-[var(--text-faint)]">
          {asset.kind} · {asset.width}×{asset.height}
        </p>
      </div>
    </div>
  );
}

function ProjectTile({
  project,
  onDelete,
}: {
  project: { id: string; name: string; thumb: Blob | null; updatedAt: number; width: number; height: number; layers: unknown[] };
  onDelete: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!project.thumb) return;
    const objectUrl = URL.createObjectURL(project.thumb);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [project.thumb]);
  return (
    <div className="group overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)]">
      <button type="button" className="checker-sm flex aspect-[4/3] w-full items-center justify-center" onClick={() => void openProject(project.id)}>
        {url ? <img src={url} alt={project.name} className="h-full w-full object-contain" loading="lazy" /> : <Layers size={18} className="text-[var(--text-faint)]" />}
      </button>
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => void openProject(project.id)}>
          <p className="truncate text-[11px] font-medium">{project.name}</p>
          <p className="text-[9px] text-[var(--text-faint)]">
            {project.width}×{project.height} · {project.layers.length} layers · {timeAgo(project.updatedAt)}
          </p>
        </button>
        <button type="button" className="icon-btn h-6 w-6 text-[var(--danger)] opacity-0 group-hover:opacity-100" onClick={onDelete} aria-label={`Delete ${project.name}`}>
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}

function AssetDetail({
  asset: selectedAsset,
  onClose,
  onDeleted,
  onOpenEditor,
}: {
  asset: StoredAsset | null;
  onClose: () => void;
  onDeleted: () => void;
  onOpenEditor: (asset: StoredAsset) => Promise<void>;
}) {
  const library = useLibrary();
  const { toast } = useUi();
  // Always render the live record from the store so edits (tags, favourite,
  // rename) are reflected immediately in the open dialog.
  const liveAsset = selectedAsset ? library.assets.find((a) => a.id === selectedAsset.id) ?? selectedAsset : null;
  const url = useAssetUrl(liveAsset);
  const [renameOpen, setRenameOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [tagDraft, setTagDraft] = useState('');

  useEffect(() => {
    setDraft(liveAsset?.name ?? '');
    setTagDraft('');
  }, [liveAsset?.id, liveAsset?.name]);

  if (!liveAsset) return null;
  const asset = liveAsset;

  return (
    <>
      <Modal
        open={Boolean(asset)}
        onClose={onClose}
        title={asset.name}
        width={620}
        footer={
          <>
            <button
              type="button"
              className="btn-danger text-[12px]"
              onClick={async () => {
                await library.purge(asset.id);
                toast('Asset deleted permanently.', 'info');
                onDeleted();
              }}
            >
              <Trash2 size={12} /> Delete
            </button>
            <span className="flex-1" />
            {asset.deleted ? (
              <button
                type="button"
                className="btn text-[12px]"
                onClick={async () => {
                  await library.restore(asset.id);
                  toast('Restored from trash.', 'success');
                  onDeleted();
                }}
              >
                <Undo2 size={12} /> Restore
              </button>
            ) : (
              <button
                type="button"
                className="btn text-[12px]"
                onClick={async () => {
                  await library.remove(asset.id);
                  toast('Moved to trash.', 'info');
                  onDeleted();
                }}
              >
                <Trash2 size={12} /> Move to trash
              </button>
            )}
            <button
              type="button"
              className="btn-primary text-[12px]"
              onClick={() => {
                saveBlob(asset.blob, `${asset.name.replace(/[^\w.-]+/g, '-')}-${timestampSlug()}.png`);
                toast('Downloaded.', 'success');
              }}
            >
              <Download size={12} /> Download
            </button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
          <div className="checker flex aspect-square items-center justify-center rounded-lg border border-[var(--line)] p-2">
            {url ? <img src={url} alt={asset.name} className="max-h-full max-w-full object-contain" /> : null}
          </div>
          <div className="space-y-2 text-[11px]">
            <div className="grid grid-cols-2 gap-1.5">
              <Info label="Kind" value={asset.kind} />
              <Info label="Dimensions" value={`${asset.width} × ${asset.height}`} />
              <Info label="File size" value={formatBytes(asset.size)} />
              <Info label="Alpha" value={asset.hasAlpha ? 'Yes' : 'No'} />
              <Info label="Source" value={asset.source} />
              <Info label="Created" value={new Date(asset.createdAt).toLocaleString()} />
              {asset.mode ? <Info label="Cut mode" value={asset.mode} /> : null}
              <Info label="Favorite" value={asset.favorite ? 'Yes' : 'No'} />
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              <button
                type="button"
                className={cx('btn h-7 text-[10px]', asset.favorite && 'text-[var(--danger)]')}
                onClick={() => void library.toggleFavorite(asset.id)}
              >
                <Heart size={11} fill={asset.favorite ? 'currentColor' : 'none'} /> {asset.favorite ? 'Favorited' : 'Favorite'}
              </button>
              <button type="button" className="btn h-7 text-[10px]" onClick={() => setRenameOpen(true)}>
                <Pencil size={11} /> Rename
              </button>
              <button
                type="button"
                className="btn h-7 text-[10px]"
                onClick={async () => {
                  await onOpenEditor(asset);
                  toast('Opened in the editor.', 'success');
                }}
              >
                <Layers size={11} /> Open in editor
              </button>
              <button
                type="button"
                className="btn h-7 text-[10px]"
                onClick={() => {
                  saveBlob(asset.blob, `${asset.name.replace(/[^\w.-]+/g, '-')}.png`);
                  toast('Copy saved as a second download — use the share sheet to copy to the clipboard.', 'info');
                }}
              >
                <Copy size={11} /> Export copy
              </button>
            </div>

            <div className="border-t border-[var(--line)] pt-2">
              <p className="label">Tags</p>
              <div className="flex flex-wrap gap-1">
                {asset.tags.map((tag) => (
                  <span key={tag} className="chip">
                    #{tag}
                    <button
                      type="button"
                      onClick={() => void library.setTags(asset.id, asset.tags.filter((t) => t !== tag))}
                      aria-label={`Remove tag ${tag}`}
                      className="text-[var(--text-faint)] hover:text-[var(--danger)]"
                    >
                      <X size={9} />
                    </button>
                  </span>
                ))}
                {asset.tags.length === 0 ? <span className="text-[10px] text-[var(--text-faint)]">No tags yet.</span> : null}
              </div>
              <form
                className="mt-1.5 flex gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  const tag = tagDraft.trim().toLowerCase();
                  if (!tag) return;
                  if (asset.tags.includes(tag)) {
                    toast('That tag already exists.', 'info');
                    return;
                  }
                  void library.setTags(asset.id, [...asset.tags, tag]);
                  setTagDraft('');
                }}
              >
                <input
                  className="field h-7 flex-1 px-2 text-[11px]"
                  placeholder="Add a tag…"
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  aria-label="New tag"
                />
                <button type="submit" className="btn h-7 px-2 text-[10px]">
                  <Tag size={11} /> Add
                </button>
              </form>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        title="Rename asset"
        footer={
          <>
            <button type="button" className="btn text-[12px]" onClick={() => setRenameOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary text-[12px]"
              onClick={async () => {
                const name = draft.trim();
                if (!name) return;
                await library.rename(asset.id, name);
                setRenameOpen(false);
                toast('Renamed.', 'success');
              }}
            >
              Save
            </button>
          </>
        }
      >
        <label className="label">Asset name</label>
        <input className="field" value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
      </Modal>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-[var(--line)] bg-[var(--panel-2)] px-2 py-1">
      <p className="text-[9px] uppercase tracking-wide text-[var(--text-faint)]">{label}</p>
      <p className="truncate font-medium" title={value}>
        {value}
      </p>
    </div>
  );
}

async function openStickerInEditor(canvas: HTMLCanvasElement, name: string, assetId: string): Promise<void> {
  const { useEditor, createImageLayer } = await import('../state/editor');
  const editor = useEditor.getState();
  const width = Math.max(800, canvas.width * 2);
  const height = Math.max(800, canvas.height * 2);
  const projectId = crypto.randomUUID ? crypto.randomUUID() : `p_${Date.now()}`;
  const url = canvas.toDataURL('image/png');
  editor.setProject({
    id: projectId,
    name: `${name} meme`,
    layers: [
      createImageLayer({
        src: url,
        naturalWidth: canvas.width,
        naturalHeight: canvas.height,
        assetId,
        x: Math.round((width - canvas.width) / 2),
        y: Math.round((height - canvas.height) / 2),
        width: canvas.width,
        height: canvas.height,
        name,
      }),
    ],
    settings: { width, height, background: null, grid: false, snap: true },
  });
  await editor.save();
  useUi.getState().navigate('editor');
}
