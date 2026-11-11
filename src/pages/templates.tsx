import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Download,
  Layers,
  Plus,
  Star,
  Trash2,
  Upload,
  Sparkles,
  Palette,
  Type as TypeIcon,
  Image as ImageIcon,
  Zap,
} from 'lucide-react';
import { useUi } from '../state/ui';
import { useEditor } from '../state/editor';
import { formatDate, useI18n } from '../i18n';
import { listPresets, savePreset, deletePreset } from '../lib/db';
import type { PresetKind, PresetRecord } from '../types';
import { DEFAULT_OUTLINE } from '../types';
import { downloadBlob, timestampSlug } from '../lib/image';
import { EmptyState, Modal, Spinner } from '../components/ui';
import { cx } from '../lib/cx';

interface BuiltinTemplate {
  id: string;
  name: string;
  kind: PresetKind;
  description: string;
  icon: typeof Palette;
  payload: Record<string, unknown>;
}

const BUILTINS: BuiltinTemplate[] = [
  {
    id: 'builtin-classic-white',
    name: 'Classic White Sticker',
    kind: 'outline',
    description: '14px pure white outline, the default meme sticker look.',
    icon: Palette,
    payload: { ...DEFAULT_OUTLINE, enabled: true, thickness: 14, color: '#ffffff', layers: 1, shadow: false },
  },
  {
    id: 'builtin-thick-white',
    name: 'Thick White Outline',
    kind: 'outline',
    description: '28px chunky white border for high-contrast stickers.',
    icon: Palette,
    payload: { ...DEFAULT_OUTLINE, thickness: 28, color: '#ffffff', layers: 1 },
  },
  {
    id: 'builtin-black-meme',
    name: 'Black Meme Outline',
    kind: 'outline',
    description: 'Black outline on transparent, reads well over bright photos.',
    icon: Palette,
    payload: { ...DEFAULT_OUTLINE, thickness: 16, color: '#0d0d0d', layers: 1 },
  },
  {
    id: 'builtin-double',
    name: 'Double Outline',
    kind: 'outline',
    description: 'White core with a 6px black outer ring.',
    icon: Palette,
    payload: { ...DEFAULT_OUTLINE, thickness: 18, color: '#ffffff', layers: 2, secondThickness: 8, secondColor: '#111111' },
  },
  {
    id: 'builtin-neon',
    name: 'Neon Sticker',
    kind: 'outline',
    description: 'Lime glow plus thin white outline for crypto stickers.',
    icon: Zap,
    payload: { ...DEFAULT_OUTLINE, thickness: 10, color: '#ffffff', glow: true, glowColor: '#c6f24e', shadow: false },
  },
  {
    id: 'builtin-shadow',
    name: 'Shadow Sticker',
    kind: 'outline',
    description: 'Soft drop shadow with a clean 8px white border.',
    icon: Sparkles,
    payload: { ...DEFAULT_OUTLINE, thickness: 8, color: '#ffffff', shadow: true, shadowBlur: 24, shadowOpacity: 0.5 },
  },
  {
    id: 'builtin-head',
    name: 'Head Extraction',
    kind: 'extract',
    description: 'Head mode with light feathering — good default for portraits.',
    icon: ImageIcon,
    payload: { mode: 'head', feather: 0.6, expand: 0, edgeSmooth: 0.4 },
  },
  {
    id: 'builtin-shoulders',
    name: 'Head + Shoulders',
    kind: 'extract',
    description: 'Bust crop for reaction memes with body language.',
    icon: ImageIcon,
    payload: { mode: 'head-shoulders', feather: 0.8, expand: 2, edgeSmooth: 0.6 },
  },
  {
    id: 'builtin-square',
    name: '1080 Square Canvas',
    kind: 'canvas',
    description: 'Transparent 1080×1080 canvas preset for feed posts.',
    icon: Layers,
    payload: { width: 1080, height: 1080, background: null, grid: false, snap: true },
  },
  {
    id: 'builtin-wide',
    name: '1600×900 Transparent',
    kind: 'canvas',
    description: 'Wide banner canvas for multi-character compositions.',
    icon: Layers,
    payload: { width: 1600, height: 900, background: null, grid: true, snap: true },
  },
  {
    id: 'builtin-png3x',
    name: 'PNG @ 3x',
    kind: 'export',
    description: 'Transparent PNG export at 3× the canvas resolution.',
    icon: Download,
    payload: { format: 'png', scale: 3, transparent: true },
  },
  {
    id: 'builtin-batch-crypto',
    name: 'Crypto Sticker Batch',
    kind: 'batch',
    description: 'Head mode, white outline, 512px PNG output.',
    icon: Zap,
    payload: { mode: 'head', thickness: 14, color: '#ffffff', size: 512, format: 'png', naming: '{name}-{mode}' },
  },
  {
    id: 'builtin-text-caption',
    name: 'Impact Caption',
    kind: 'canvas',
    description: 'Large bold uppercase caption style for classic meme text.',
    icon: TypeIcon,
    payload: { fontSize: 96, bold: true, uppercase: true, color: '#ffffff', strokeColor: '#000000', strokeWidth: 8 },
  },
];

export function TemplatesPage() {
  const { t, locale } = useI18n();
  const { toast, navigate, setPendingPreset } = useUi();
  const [presets, setPresets] = useState<PresetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<PresetKind | 'all'>('all');
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState('');
  const [saveKind, setSaveKind] = useState<PresetKind>('outline');
  const [importBusy, setImportBusy] = useState(false);

  useEffect(() => {
    void refresh();
    async function refresh() {
      try {
        setPresets(await listPresets());
      } finally {
        setLoading(false);
      }
    }
  }, []);

  const filteredBuiltins = useMemo(
    () => (kind === 'all' ? BUILTINS : BUILTINS.filter((b) => b.kind === kind)),
    [kind],
  );
  const filteredCustom = useMemo(
    () => (kind === 'all' ? presets : presets.filter((p) => p.kind === kind)),
    [kind, presets],
  );

  async function applyBuiltin(template: BuiltinTemplate): Promise<void> {
    if (template.kind === 'canvas') {
      const { useEditor } = await import('../state/editor');
      const editor = useEditor.getState();
      if (!editor.projectId) {
        const id = crypto.randomUUID ? crypto.randomUUID() : `p_${Date.now()}`;
        editor.setProject({
          id,
          name: template.name,
          layers: [],
          settings: {
            width: Number(template.payload.width) || 1080,
            height: Number(template.payload.height) || 1080,
            background: (template.payload.background as string | null) ?? null,
            grid: Boolean(template.payload.grid),
            snap: Boolean(template.payload.snap),
          },
        });
        await editor.save();
      } else {
        editor.setSettings({
          width: Number(template.payload.width) || editor.settings.width,
          height: Number(template.payload.height) || editor.settings.height,
          background: (template.payload.background as string | null) ?? editor.settings.background,
          grid: Boolean(template.payload.grid),
          snap: Boolean(template.payload.snap),
        });
      }
      navigate('editor');
      toast(t('Canvas preset “{name}” applied.', { name: t(template.name) }), 'success');
      return;
    }
    if (template.kind === 'export' || template.kind === 'batch') {
      // Hand the payload to the target page, which applies it on mount.
      setPendingPreset({ kind: template.kind, payload: template.payload, id: template.id });
      navigate(template.kind === 'export' ? 'editor' : 'batch');
      toast(
        t('“{name}” applied to the {kind} panel.', {
          name: t(template.name),
          kind: template.kind === 'export' ? t('Export') : t('Batch'),
        }),
        'success',
      );
      return;
    }
    if (template.kind === 'extract' || template.kind === 'outline') {
      setPendingPreset({ kind: template.kind, payload: template.payload, id: template.id });
      navigate('create');
      toast(t('“{name}” is ready in Create.', { name: t(template.name) }), 'success');
      return;
    }
    toast(t('Preset applied.'), 'success');
  }

  async function saveCurrent(): Promise<void> {
    if (!name.trim()) return;
    // Snapshot what the target panel is actually set to, so a saved preset is
    // reusable instead of an empty placeholder.
    const cutout = useUi.getState().cutout;
    let payload: Record<string, unknown> = {};
    if ((saveKind === 'outline' || saveKind === 'extract') && cutout) {
      payload =
        saveKind === 'outline'
          ? { outline: cutout.outline }
          : { mode: cutout.mode, feather: cutout.feather, expand: cutout.expand, edgeSmooth: cutout.edgeSmooth };
    } else if (saveKind === 'canvas') {
      const editor = useEditor.getState();
      payload = {
        width: editor.settings.width,
        height: editor.settings.height,
        background: editor.settings.background,
        grid: editor.settings.grid,
        snap: editor.settings.snap,
      };
    }
    const preset: PresetRecord = {
      id: crypto.randomUUID ? crypto.randomUUID() : `preset_${Date.now()}`,
      name: name.trim(),
      kind: saveKind,
      createdAt: Date.now(),
      payload,
      favorite: false,
    };
    await savePreset(preset);
    setPresets((prev) => [...prev, preset]);
    setName('');
    setSaveOpen(false);
    toast(t('Preset saved locally.'), 'success');
  }

  async function exportPresets(): Promise<void> {
    const data = JSON.stringify({ version: 1, presets: [...BUILTINS.map((b) => ({ ...b, icon: undefined })), ...presets] }, null, 2);
    downloadBlob(new Blob([data], { type: 'application/json' }), `meme-studio-presets-${timestampSlug()}.json`);
    toast(t('Preset bundle exported as JSON.'), 'success');
  }

  async function importPresets(file: File | null): Promise<void> {
    if (!file) return;
    setImportBusy(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { presets?: PresetRecord[] };
      if (!parsed.presets?.length) throw new Error(t('No presets found in that file.'));
      for (const preset of parsed.presets) {
        if (!preset.name || !preset.kind) continue;
        const record: PresetRecord = {
          id: crypto.randomUUID ? crypto.randomUUID() : `preset_${Date.now()}_${Math.random()}`,
          name: preset.name,
          kind: preset.kind,
          createdAt: Date.now(),
          payload: preset.payload ?? {},
          favorite: Boolean(preset.favorite),
        };
        await savePreset(record);
        setPresets((prev) => [...prev, record]);
      }
      toast(t('{count} presets imported.', { count: parsed.presets.length }), 'success');
    } catch (error) {
      toast(t('Import failed'), 'error', error instanceof Error ? error.message : String(error));
    } finally {
      setImportBusy(false);
    }
  }

  const kinds: { id: PresetKind | 'all'; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'outline', label: 'Outline' },
    { id: 'extract', label: 'Extraction' },
    { id: 'canvas', label: 'Canvas' },
    { id: 'export', label: 'Export' },
    { id: 'batch', label: 'Batch' },
  ];

  return (
    <div className="mx-auto w-full max-w-[1180px] px-3 pb-24 pt-4 sm:px-6 sm:pb-10 sm:pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t('Templates')}</h1>
          <p className="mt-1 max-w-xl text-[12px] text-[var(--text-dim)]">
            {t('Parameter presets — not just names. Each one stores the real values used by the cutout, canvas, export and batch panels.')}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className="btn text-[11px]" onClick={() => setSaveOpen(true)}>
            <Plus size={12} /> {t('Save preset')}
          </button>
          <button type="button" className="btn text-[11px]" onClick={() => void exportPresets()}>
            <Download size={12} /> {t('Export')}
          </button>
          <label className="btn cursor-pointer text-[11px]">
            {importBusy ? <Spinner size={12} /> : <Upload size={12} />} {t('Import')}
            <input type="file" accept="application/json" className="hidden" onChange={(e) => void importPresets(e.target.files?.[0] ?? null)} />
          </label>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {kinds.map((k) => (
          <button key={k.id} type="button" className={cx('chip', kind === k.id && 'chip-active')} onClick={() => setKind(k.id)}>
            {t(k.label)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-[12px] text-[var(--text-faint)]">
          <Spinner size={14} /> {t('Loading presets…')}
        </div>
      ) : (
        <>
          <section className="mt-4">
            <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">
              {t('Built-in · {count}', { count: filteredBuiltins.length })}
            </h2>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredBuiltins.map((template) => {
                const Icon = template.icon;
                return (
                  <div
                    key={template.id}
                    className="flex flex-col rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3"
                    data-testid={`preset-${template.id}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--panel-3)] text-[var(--accent)]">
                        <Icon size={15} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-medium">{t(template.name)}</p>
                        <p className="text-[9px] uppercase tracking-wide text-[var(--text-faint)]">{t('{kind} preset', { kind: template.kind })}</p>
                      </div>
                    </div>
                    <p className="mt-2 flex-1 text-[11px] leading-relaxed text-[var(--text-dim)]">{t(template.description)}</p>
                    <pre className="mt-2 max-h-24 overflow-auto rounded border border-[var(--line)] bg-[var(--bg-soft)] p-1.5 font-mono text-[9px] leading-snug text-[var(--text-faint)]">
{JSON.stringify(template.payload, null, 1)}
                    </pre>
                    <button
                      type="button"
                      className="btn mt-2 h-8 text-[11px]"
                      onClick={() => void applyBuiltin(template)}
                      data-testid={`preset-use-${template.id}`}
                    >
                      <Check size={11} /> {t('Use preset')}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="mt-6">
            <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">
              {t('Your presets · {count}', { count: filteredCustom.length })}
            </h2>
            {filteredCustom.length === 0 ? (
              <EmptyState
                icon={<Star size={20} />}
                title={t('No custom presets yet')}
                body={t('Save the settings you keep re-using, then reuse them from any panel. Presets are stored locally and can be exported as JSON.')}
                action={
                  <button type="button" className="btn-primary text-[12px]" onClick={() => setSaveOpen(true)}>
                    <Plus size={12} /> {t('Create a preset')}
                  </button>
                }
              />
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {filteredCustom.map((preset) => (
                  <div key={preset.id} className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-medium">{preset.name}</p>
                        <p className="text-[9px] uppercase tracking-wide text-[var(--text-faint)]">{preset.kind}</p>
                      </div>
                      <button
                        type="button"
                        className="icon-btn h-7 w-7 text-[var(--danger)]"
                        aria-label={t('Delete preset {name}', { name: preset.name })}
                        onClick={async () => {
                          await deletePreset(preset.id);
                          setPresets((prev) => prev.filter((p) => p.id !== preset.id));
                          toast(t('Preset deleted.'), 'info');
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <p className="mt-2 text-[10px] text-[var(--text-faint)]">
                      {t('Created {date}', { date: formatDate(locale, preset.createdAt) })}
                    </p>
                    <button
                      type="button"
                      className="btn mt-2 h-8 w-full text-[11px]"
                      onClick={() => {
                        if (preset.kind === 'canvas') navigate('editor');
                        else if (preset.kind === 'batch') navigate('batch');
                        else navigate('create');
                        toast(t('Opened {kind} panel for “{name}”.', { kind: preset.kind, name: preset.name }), 'info');
                      }}
                    >
                      <Check size={11} /> {t('Use preset')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <div className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
        <p className="section-title">{t('How presets are stored')}</p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--text-dim)]">
          {t('Built-in presets ship with the app and contain the exact parameter objects used by the editor. Custom presets live in IndexedDB next to your assets and projects, and the export button produces a portable JSON bundle that retains every stored value.')}
        </p>
      </div>

      <Modal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        title={t('Save a preset')}
        footer={
          <>
            <button type="button" className="btn text-[12px]" onClick={() => setSaveOpen(false)}>
              {t('Cancel')}
            </button>
            <button type="button" className="btn-primary text-[12px]" onClick={() => void saveCurrent()} disabled={!name.trim()}>
              {t('Save')}
            </button>
          </>
        }
      >
        <label className="label">{t('Preset name')}</label>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('My crypto sticker outline')} autoFocus />
        <label className="label mt-2">{t('Type')}</label>
        <select className="field" value={saveKind} onChange={(e) => setSaveKind(e.target.value as PresetKind)}>
          <option value="outline">{t('Outline')}</option>
          <option value="extract">{t('Extraction')}</option>
          <option value="canvas">{t('Canvas')}</option>
          <option value="export">{t('Export')}</option>
          <option value="batch">{t('Batch')}</option>
        </select>
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-faint)]">
          {t('The preset records its kind and a parameter snapshot. Names are local — nothing is published.')}
        </p>
      </Modal>
    </div>
  );
}
