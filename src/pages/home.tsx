import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ImagePlus,
  Sparkles,
  Zap,
  FolderOpen,
  ShieldCheck,
  Cpu,
  Wand2,
  Layers as LayersIcon,
  MousePointerClick,
} from 'lucide-react';
import { useUi } from '../state/ui';
import { translate, timeAgo, useI18n } from '../i18n';
import { useLibrary } from '../state/library';
import { STARTER_ITEMS, type StarterItem } from '../lib/starter';
import { formatBytes } from '../lib/image';
import { EmptyState, SectionHeader } from '../components/ui';
import { assetUrl, useAssetUrl } from '../components/useAssetUrl';
import type { StoredAsset } from '../lib/db';

export function StarterThumb({ item, className }: { item: StarterItem; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    item.draw(ctx, canvas.width);
  }, [item]);
  return <canvas ref={ref} width={360} height={360} className={className} aria-label={item.title} />;
}

export function HomePage() {
  const { t } = useI18n();
  const { navigate } = useUi();
  const { assets, projects } = useLibrary();
  const recentProjects = useMemo(() => projects.slice(0, 4), [projects]);
  const stickers = useMemo(
    () => assets.filter((a) => !a.deleted && (a.kind === 'sticker' || a.kind === 'cutout')).slice(0, 8),
    [assets],
  );
  const totalSize = useMemo(() => assets.reduce((sum, a) => sum + a.size, 0), [assets]);

  return (
    <div className="mx-auto w-full max-w-[1180px] px-3 pb-24 pt-4 sm:px-6 sm:pb-10 sm:pt-8">
      <section className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
        <div className="hero-grid absolute inset-0 opacity-70" aria-hidden />
        <div className="relative grid gap-6 p-5 sm:p-8 lg:grid-cols-[1.15fr_0.85fr] lg:p-10">
          <div className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="chip chip-active">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                {t('Local-first')}
              </span>
              <span className="chip">{t('No API key')}</span>
              <span className="chip">{t('No upload')}</span>
              <span className="chip">{t('Works offline')}</span>
            </div>
            <h1 className="text-[30px] font-semibold leading-[1.08] tracking-tight sm:text-[42px]">
              {t('Your personal')}
              <br />
              {t('meme asset factory.')}
            </h1>
            <p className="mt-3 max-w-lg text-[13px] leading-relaxed text-[var(--text-dim)] sm:text-sm">
              {t('Cut a head out of any photo, wrap it in a real alpha outline, compose it on an infinite canvas with captions and stickers, then batch the whole set. Everything runs in this browser tab — your images never leave the device.')}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" className="btn-primary" onClick={() => navigate('create')} data-testid="hero-create">
                <Sparkles size={15} />
                {t('Create a meme')}
              </button>
              <button type="button" className="btn" onClick={() => navigate('batch')}>
                <Zap size={15} />
                {t('Batch process')}
              </button>
              <button type="button" className="btn" onClick={() => navigate('discover')}>
                <LayersIcon size={15} />
                {t('Browse discovery')}
              </button>
            </div>
            <dl className="mt-6 grid max-w-md grid-cols-3 gap-2">
              {[
                { label: 'Assets on device', value: assets.filter((a) => !a.deleted).length },
                { label: 'Saved projects', value: projects.length },
                { label: 'Local storage', value: formatBytes(totalSize) },
              ].map((stat) => (
                <div key={stat.label} className="rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-2.5 py-2">
                  <dt className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">{t(stat.label)}</dt>
                  <dd className="mt-0.5 font-mono text-sm">{stat.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative min-w-0">
            <div className="grid grid-cols-2 gap-2.5">
              {STARTER_ITEMS.slice(0, 4).map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate('discover')}
                  className="group relative overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel-2)] p-2 transition-transform hover:-translate-y-0.5"
                  style={{ transform: `rotate(${i % 2 === 0 ? -1.2 : 1.2}deg)` }}
                  aria-label={t('Open {name}', { name: item.title })}
                >
                  <span className="checker flex aspect-square items-center justify-center rounded-lg">
                    <StarterThumb item={item} className="h-full w-full object-contain p-1" />
                  </span>
                  <span className="mt-1.5 block truncate text-[11px] text-[var(--text-dim)]">{item.title}</span>
                </button>
              ))}
            </div>
            <p className="mt-2.5 text-center text-[10px] text-[var(--text-faint)]">
              {t('12 starter stickers generated locally · free to remix')}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <SectionHeader
          title={t('Start here')}
          hint={t('Every entry point below is wired to a working flow, not a mock.')}
        />
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          <QuickAction
            icon={<ImagePlus size={16} />}
            title={t('Open an image')}
            body={t('Drop a photo, paste from the clipboard or pick a file. Nothing is uploaded.')}
            onClick={() => navigate('create')}
          />
          <QuickAction
            icon={<Wand2 size={16} />}
            title={t('Extract a head')}
            body={t('FaceMesh picks the person; the RVM matte shapes hair and ears.')}
            onClick={() => navigate('create')}
          />
          <QuickAction
            icon={<Zap size={16} />}
            title={t('Batch a folder')}
            body={t('Queue dozens of images, retry failures, export a single ZIP.')}
            onClick={() => navigate('batch')}
          />
          <QuickAction
            icon={<LayersIcon size={16} />}
            title={t('Compose on canvas')}
            body={t('Layers, outlines, text, stickers and true transparent PNG export.')}
            onClick={() => navigate('create')}
          />
          <QuickAction
            icon={<FolderOpen size={16} />}
            title={t('My Space')}
            body={t('Your local asset library with folders, tags, favorites and trash.')}
            onClick={() => navigate('library')}
          />
          <QuickAction
            icon={<Cpu size={16} />}
            title={t('Templates')}
            body={t('Reusable presets for outlines, extraction modes and batch runs.')}
            onClick={() => navigate('templates')}
          />
        </div>
      </section>

      <section className="mt-7 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <SectionHeader
            title={t('Recent projects')}
            hint={t('Saved in IndexedDB on this device.')}
            action={
              projects.length ? (
                <button type="button" className="btn-ghost text-[11px]" onClick={() => navigate('library')}>
                  {t('Open My Space')} <ArrowRight size={13} />
                </button>
              ) : null
            }
          />
          {recentProjects.length === 0 ? (
            <EmptyState
              icon={<LayersIcon size={22} />}
              title={t('No projects yet')}
              body={t('Create one from an image or start from a blank canvas — it will be saved locally and appear here.')}
              action={
                <button type="button" className="btn-primary" onClick={() => navigate('create')}>
                  <Sparkles size={15} /> {t('Start a project')}
                </button>
              }
            />
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {recentProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}
        </div>

        <div>
          <SectionHeader title={t('On this device')} hint={t('Latest cutouts and stickers.')} />
          {stickers.length === 0 ? (
            <EmptyState
              icon={<ShieldCheck size={22} />}
              title={t('Nothing cut out yet')}
              body={t('Your first head sticker will show up here. It stays on this device until you export it.')}
            />
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {stickers.map((asset) => (
                <AssetTile key={asset.id} asset={asset} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mt-7">
        <SectionHeader title={t('How it works')} hint={t('Four steps, zero uploads.')} />
        <ol className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: <MousePointerClick size={15} />, title: 'Drop an image', body: 'File, drag, paste or URL.' },
            { icon: <Cpu size={15} />, title: 'Run local AI', body: 'FaceMesh + RVM in this tab.' },
            { icon: <Sparkles size={15} />, title: 'Style the sticker', body: 'Outline, shadow, glow, feather.' },
            { icon: <LayersIcon size={15} />, title: 'Compose & export', body: 'Canvas layers → transparent PNG.' },
          ].map((step, index) => (
            <li key={step.title} className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
              <div className="flex items-center gap-2 text-[var(--accent)]">
                {step.icon}
                <span className="font-mono text-[10px] text-[var(--text-faint)]">0{index + 1}</span>
              </div>
              <p className="mt-2 text-sm font-medium">{t(step.title)}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-faint)]">{t(step.body)}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function QuickAction({
  icon,
  title,
  body,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3.5 text-left transition-colors hover:border-[color-mix(in_srgb,var(--accent)_45%,var(--line))] hover:bg-[var(--panel-2)]"
    >
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--panel-3)] text-[var(--accent)]">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">{title}</span>
          <ArrowRight size={14} className="shrink-0 text-[var(--text-faint)] transition-transform group-hover:translate-x-0.5" />
        </span>
        <span className="mt-0.5 block text-[11px] leading-relaxed text-[var(--text-faint)]">{body}</span>
      </span>
    </button>
  );
}

export function ProjectCard({ project }: { project: { id: string; name: string; thumb: Blob | null; updatedAt: number; width: number; height: number } }) {
  const { locale } = useI18n();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!project.thumb) {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(project.thumb);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [project.thumb]);

  return (
    <button
      type="button"
      onClick={() => void openProject(project.id)}
      data-testid={`project-${project.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--panel)] text-left transition-colors hover:border-[var(--text-faint)]"
    >
      <div className="checker-sm flex aspect-[4/3] items-center justify-center overflow-hidden">
        {url ? (
          <img src={url} alt={project.name} className="h-full w-full object-contain" loading="lazy" />
        ) : (
          <LayersIcon size={18} className="text-[var(--text-faint)]" />
        )}
      </div>
      <div className="flex items-center justify-between gap-2 px-2.5 py-2">
        <span className="min-w-0">
          <span className="block truncate text-[12px] font-medium">{project.name}</span>
          <span className="block text-[10px] text-[var(--text-faint)]">
            {project.width}×{project.height} · {timeAgo(locale, project.updatedAt)}
          </span>
        </span>
        <ArrowRight size={13} className="shrink-0 text-[var(--text-faint)]" />
      </div>
    </button>
  );
}

export function AssetTile({ asset, onOpen }: { asset: StoredAsset; onOpen?: () => void }) {
  const url = useAssetUrl(asset);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative block overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel-2)]"
      title={asset.name}
      disabled={!onOpen}
    >
      <span className="checker-sm flex aspect-square items-center justify-center">
        {url ? <img src={url} alt={asset.name} className="h-full w-full object-contain" loading="lazy" /> : null}
      </span>
      <span className="block truncate px-1.5 py-1 text-[10px] text-[var(--text-dim)]">{asset.name}</span>
    </button>
  );
}

export async function openProject(id: string): Promise<void> {
  const { getProject } = await import('../lib/db');
  const { useEditor } = await import('../state/editor');
  const { useUi } = await import('../state/ui');
  const { hydrateProjectLayers } = await import('../lib/hydrate');
  const project = await getProject(id);
  if (!project) {
    const { locale } = useUi.getState();
    useUi.getState().toast(translate(locale, 'That project no longer exists on this device.'), 'error');
    return;
  }
  // Object URLs are scoped to the document that created them, so every saved
  // image layer is rebuilt from its IndexedDB blob before the project opens.
  const hydrated = await hydrateProjectLayers(project.layers);
  useEditor.getState().setProject({
    id: project.id,
    name: project.name,
    layers: hydrated.layers,
    settings: {
      width: project.width,
      height: project.height,
      background: project.background,
      grid: project.grid,
      snap: project.snap,
    },
  });
  if (hydrated.missing.length) {
    const { locale } = useUi.getState();
    useUi.getState().toast(
      translate(locale, '{count} layer image(s) could not be restored.', { count: hydrated.missing.length }),
      'error',
      hydrated.missing.join(', '),
    );
  }
  useUi.getState().navigate('editor');
}

export { assetUrl };
