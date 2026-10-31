import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Bold,
  Check,
  ChevronDown,
  Copy,
  Download,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Italic,
  Layers,
  Lock,
  Maximize2,
  Minus,
  MousePointerSquareDashed,
  Plus,
  Redo2,
  RotateCw,
  Save,
  Square,
  Trash2,
  Undo2,
  Unlock,
  Type,
  X,
  Circle,
  AlignHorizontalJustifyCenter,
} from 'lucide-react';
import { useEditor, createTextLayer, createShapeLayer, createImageLayer } from '../state/editor';
import { useI18n } from '../i18n';
import { useUi } from '../state/ui';
import { storeCanvasAsAsset } from '../state/library';
import { renderScene, DEFAULT_EXPORT, type ExportOptions } from '../lib/render';
import { canvasToBlob, downloadBlob, formatBytes, makeThumbnail } from '../lib/image';
import { loadImageElement } from '../lib/render';
import { Modal, Slider, ColorField, Toggle, Segmented, Spinner } from '../components/ui';
import { cx } from '../lib/cx';
import type { Layer } from '../types';

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rot' | null;

interface DragState {
  mode: 'move' | 'resize' | 'rotate' | 'marquee';
  startX: number;
  startY: number;
  layerId?: string;
  handle?: Handle;
  origin: { x: number; y: number; width: number; height: number; rotation: number };
  rotateStart?: number;
}

export function EditorPage() {
  const { t } = useI18n();
  const editor = useEditor();
  const { navigate, toast } = useUi();
  const [exportOpen, setExportOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportOptions>(DEFAULT_EXPORT);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportSize, setExportSize] = useState<number | null>(null);
  const [clipboard, setClipboard] = useState<Layer | null>(null);
  const stageWrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const { width, height } = editor.settings;
  const selected = editor.layers.find((l) => l.id === editor.selectedId) ?? null;

  // fit-to-screen zoom on mount and when canvas size changes
  const fit = useCallback(() => {
    const wrap = stageWrapRef.current;
    if (!wrap) return;
    const pad = window.innerWidth < 640 ? 24 : 96;
    const scale = Math.min((wrap.clientWidth - pad) / width, (wrap.clientHeight - pad) / height, 1.6);
    const zoom = Math.max(0.08, Number(scale.toFixed(3)));
    useEditor.getState().setView(zoom, 0, 0);
  }, [width, height]);

  useEffect(() => {
    const timer = setTimeout(fit, 60);
    window.addEventListener('resize', fit);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', fit);
    };
  }, [fit]);

  const performSave = useCallback(
    async (silent = false) => {
      const state = useEditor.getState();
      if (!state.projectId) {
        toast(t('This editor has no project id. Start from Create first.'), 'error');
        return;
      }
      try {
        const canvas = await renderScene(state.layers, state.settings, { transparent: true });
        await state.save(canvas);
        if (!silent) toast(t('Project saved to this device.'), 'success');
      } catch (error) {
        toast(t('Saving failed'), 'error', error instanceof Error ? error.message : String(error));
      }
    },
    [t, toast],
  );

  // autosave
  useEffect(() => {
    if (!editor.projectId) return;
    const interval = setInterval(() => {
      const state = useEditor.getState();
      if (state.dirty && !state.saving && state.projectId) void performSave(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [editor.projectId, performSave]);

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      const meta = e.ctrlKey || e.metaKey;
      if (meta && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void performSave();
        return;
      }
      if (inField) return;
      if (meta && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        editor.undo();
      } else if (meta && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault();
        editor.redo();
      } else if (meta && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        if (editor.selectedId) editor.duplicateLayer(editor.selectedId);
      } else if (meta && e.key.toLowerCase() === 'c') {
        if (selected) setClipboard(selected);
      } else if (meta && e.key.toLowerCase() === 'v') {
        if (clipboard) {
          const state = useEditor.getState();
          state.addLayer({
            ...clipboard,
            id: state.createLayerId(),
            name: `${clipboard.name} copy`,
            x: clipboard.x + 28,
            y: clipboard.y + 28,
            text: clipboard.text ? { ...clipboard.text } : undefined,
            shape: clipboard.shape ? { ...clipboard.shape } : undefined,
            image: clipboard.image ? { ...clipboard.image } : undefined,
          });
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (editor.selectedId) editor.removeLayer(editor.selectedId);
      } else if (e.key === 'Escape') {
        editor.select(null);
      } else if (e.key === '+' || e.key === '=') {
        editor.setView(Math.min(4, editor.zoom * 1.15), editor.panX, editor.panY);
      } else if (e.key === '-') {
        editor.setView(Math.max(0.08, editor.zoom / 1.15), editor.panX, editor.panY);
      } else if (e.key === ' ') {
        e.preventDefault();
        setShortcutsOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editor, performSave, selected, clipboard]);

  function beginMove(e: React.PointerEvent, layer: Layer) {
    if (layer.locked) return;
    e.stopPropagation();
    editor.select(layer.id);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDrag({
      mode: 'move',
      startX: e.clientX,
      startY: e.clientY,
      layerId: layer.id,
      origin: { x: layer.x, y: layer.y, width: layer.width, height: layer.height, rotation: layer.rotation },
    });
  }

  function beginHandle(e: React.PointerEvent, layer: Layer, handle: Handle) {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDrag({
      mode: handle === 'rot' ? 'rotate' : 'resize',
      startX: e.clientX,
      startY: e.clientY,
      layerId: layer.id,
      handle,
      origin: { x: layer.x, y: layer.y, width: layer.width, height: layer.height, rotation: layer.rotation },
    });
  }

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const state = useEditor.getState();
      const layer = drag.layerId ? state.layers.find((l) => l.id === drag.layerId) : null;
      const dx = (e.clientX - drag.startX) / editor.zoom;
      const dy = (e.clientY - drag.startY) / editor.zoom;
      if (!layer) return;
      if (drag.mode === 'move') {
        let x = Math.round(drag.origin.x + dx);
        let y = Math.round(drag.origin.y + dy);
        if (state.settings.snap) {
          const threshold = 6 / editor.zoom;
          const centerX = state.settings.width / 2 - layer.width / 2;
          const centerY = state.settings.height / 2 - layer.height / 2;
          if (Math.abs(x - centerX) < threshold) x = Math.round(centerX);
          if (Math.abs(y - centerY) < threshold) y = Math.round(centerY);
          if (Math.abs(x) < threshold) x = 0;
          if (Math.abs(y) < threshold) y = 0;
        }
        state.updateLayer(layer.id, { x, y });
      } else if (drag.mode === 'resize' && drag.handle) {
        const h = drag.handle;
        let { x, y, width: w, height: ht } = drag.origin;
        const minSize = 8;
        if (h.includes('e')) w = Math.max(minSize, drag.origin.width + dx);
        if (h.includes('s')) ht = Math.max(minSize, drag.origin.height + dy);
        if (h.includes('w')) {
          w = Math.max(minSize, drag.origin.width - dx);
          x = drag.origin.x + (drag.origin.width - w);
        }
        if (h.includes('n')) {
          ht = Math.max(minSize, drag.origin.height - dy);
          y = drag.origin.y + (drag.origin.height - ht);
        }
        if (e.shiftKey && drag.origin.width && drag.origin.height) {
          const ratio = drag.origin.width / drag.origin.height;
          if (h === 'se' || h === 'nw' || h === 'ne' || h === 'sw') {
            ht = Math.round(w / ratio);
            if (h === 'nw') {
              x = drag.origin.x + (drag.origin.width - w);
              y = drag.origin.y + (drag.origin.height - ht);
            }
            if (h === 'ne') y = drag.origin.y + (drag.origin.height - ht);
            if (h === 'sw') x = drag.origin.x + (drag.origin.width - w);
          }
        }
        state.updateLayer(layer.id, { x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(ht) });
      } else if (drag.mode === 'rotate') {
        const stage = stageRef.current;
        if (!stage) return;
        const rect = stage.getBoundingClientRect();
        const cx = rect.left + (layer.x + layer.width / 2) * editor.zoom;
        const cy = rect.top + (layer.y + layer.height / 2) * editor.zoom;
        const angle = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI + 90;
        const snapped = e.shiftKey ? Math.round(angle / 15) * 15 : Math.round(angle);
        state.updateLayer(layer.id, { rotation: snapped });
      }
    };
    const onUp = () => setDrag(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [drag, editor.zoom]);

  async function addTextLayer() {
    const state = useEditor.getState();
    const layer = createTextLayer({
      content: 'YOUR TEXT',
      x: 80,
      y: state.settings.height / 2 - 60,
      width: state.settings.width - 160,
      fontSize: Math.round(Math.min(state.settings.width, state.settings.height) * 0.09),
    });
    state.addLayer(layer);
    setTimeout(() => textAreaRef.current?.focus(), 30);
  }

  function addShape(kind: 'rect' | 'ellipse') {
    const state = useEditor.getState();
    const size = Math.round(Math.min(state.settings.width, state.settings.height) * 0.35);
    state.addLayer(
      createShapeLayer({
        kind,
        x: Math.round(state.settings.width / 2 - size / 2),
        y: Math.round(state.settings.height / 2 - size / 2),
        width: size,
        height: size,
      }),
    );
  }

  async function addImageFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast(t('That file is not an image.'), 'error');
      return;
    }
    try {
      const url = URL.createObjectURL(file);
      const img = await loadImageElement(url);
      const state = useEditor.getState();
      const maxW = state.settings.width * 0.6;
      const maxH = state.settings.height * 0.6;
      const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const asset = await storeCanvasAsAsset(
        await (async () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          canvas.getContext('2d')?.drawImage(img, 0, 0);
          return canvas;
        })(),
        file.name,
        'original',
        { source: 'editor upload' },
      );
      state.addLayer(
        createImageLayer({
          src: url,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          assetId: asset.id,
          x: Math.round((state.settings.width - w) / 2),
          y: Math.round((state.settings.height - h) / 2),
          width: w,
          height: h,
          name: file.name,
        }),
      );
      toast(t('Image added as a layer.'), 'success');
    } catch (error) {
      toast(t('Could not add that image'), 'error', error instanceof Error ? error.message : String(error));
    }
  }

  async function openExport() {
    setExportOpen(true);
    setExportSize(null);
    try {
      const canvas = await renderScene(editor.layers, editor.settings, {
        transparent: exportOptions.transparent,
        scale: exportOptions.scale,
        background: exportOptions.background,
      });
      const blob = await canvasToBlob(
        canvas,
        exportOptions.format === 'jpeg' ? 'image/jpeg' : exportOptions.format === 'webp' ? 'image/webp' : 'image/png',
        exportOptions.format === 'png' ? undefined : 0.92,
      );
      setExportSize(blob.size);
    } catch (error) {
      toast(t('Preview failed'), 'error', error instanceof Error ? error.message : String(error));
    }
  }

  async function doExport() {
    setExportBusy(true);
    try {
      const canvas = await renderScene(editor.layers, editor.settings, {
        transparent: exportOptions.transparent,
        scale: exportOptions.scale,
        background: exportOptions.background,
      });
      const mime =
        exportOptions.format === 'jpeg' ? 'image/jpeg' : exportOptions.format === 'webp' ? 'image/webp' : 'image/png';
      const blob = await canvasToBlob(canvas, mime, exportOptions.format === 'png' ? undefined : 0.92);
      const ext = exportOptions.format === 'jpeg' ? 'jpg' : exportOptions.format;
      downloadBlob(blob, `${(editor.projectName || 'meme').replace(/\s+/g, '-').toLowerCase()}.${ext}`);
      toast(t('Exported {w}×{h} {format} · {size}', { w: canvas.width, h: canvas.height, format: exportOptions.format.toUpperCase(), size: formatBytes(blob.size) }), 'success');
      setExportOpen(false);
    } catch (error) {
      toast(t('Export failed'), 'error', error instanceof Error ? error.message : String(error));
    } finally {
      setExportBusy(false);
    }
  }

  async function exportLayer() {
    if (!selected) return;
    const { renderSingleLayer } = await import('../lib/render');
    const canvas = await renderSingleLayer(selected, editor.settings);
    const blob = await canvasToBlob(canvas, 'image/png');
    downloadBlob(blob, `${selected.name.replace(/\s+/g, '-').toLowerCase()}.png`);
    toast(t('Layer exported with transparency.'), 'success');
  }

  // wheel zoom / pinch
  useEffect(() => {
    const wrap = stageWrapRef.current;
    if (!wrap) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey && Math.abs(e.deltaY) < 40) return;
      e.preventDefault();
      const state = useEditor.getState();
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      state.setView(Math.min(4, Math.max(0.08, state.zoom * factor)), state.panX, state.panY);
    };
    wrap.addEventListener('wheel', onWheel, { passive: false });
    return () => wrap.removeEventListener('wheel', onWheel);
  }, []);

  if (!editor.projectId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-lg font-semibold">{t('No project open')}</h1>
        <p className="mt-2 text-[12px] text-[var(--text-dim)]">
          {t('The editor needs a project. Create one from an image, a blank canvas or a cutout first.')}
        </p>
        <button type="button" className="btn-primary mt-4" onClick={() => navigate('create')}>
          {t('Go to Create')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] min-h-0 flex-col lg:h-[calc(100dvh-5.75rem)]">
      {/* toolbar */}
      <div className="flex shrink-0 items-center gap-1 border-b border-[var(--line)] px-2 py-1.5 sm:px-3">
        <input
          className="w-32 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-[13px] font-medium outline-none hover:border-[var(--line)] focus:border-[var(--accent)] sm:w-48"
          value={editor.projectName}
          onChange={(e) => editor.rename(e.target.value)}
          aria-label={t('Project name')}
        />
        <span className="mx-1 hidden h-4 w-px bg-[var(--line)] sm:block" />
        <button type="button" className="icon-btn" onClick={editor.undo} disabled={!editor.history.length} aria-label={t('Undo')} title={t('Undo (Ctrl+Z)')}>
          <Undo2 size={15} />
        </button>
        <button type="button" className="icon-btn" onClick={editor.redo} disabled={!editor.future.length} aria-label={t('Redo')} title={t('Redo (Ctrl+Shift+Z)')}>
          <Redo2 size={15} />
        </button>
        <span className="mx-1 hidden h-4 w-px bg-[var(--line)] sm:block" />
        <button type="button" className="icon-btn" onClick={() => void addTextLayer()} aria-label={t('Add text')} title={t('Add text layer')} data-testid="add-text-layer">
          <Type size={15} />
        </button>
        <button type="button" className="icon-btn" onClick={() => addShape('rect')} aria-label={t('Add rectangle')} title={t('Add rectangle')} data-testid="add-rect-layer">
          <Square size={15} />
        </button>
        <button type="button" className="icon-btn" onClick={() => addShape('ellipse')} aria-label={t('Add ellipse')} title={t('Add ellipse')} data-testid="add-ellipse-layer">
          <Circle size={15} />
        </button>
        <label className="icon-btn cursor-pointer" title={t('Add image layer')} aria-label={t('Add image layer')}>
          <ImageIcon size={15} />
          <input type="file" accept="image/*" className="hidden" onChange={(e) => void addImageFile(e.target.files?.[0] ?? null)} />
        </label>

        <div className="ml-auto flex items-center gap-1">
          <div className="hidden items-center gap-1 rounded-lg border border-[var(--line)] px-1 sm:flex">
            <button type="button" className="icon-btn h-7 w-7" onClick={() => editor.setView(Math.max(0.08, editor.zoom / 1.15), editor.panX, editor.panY)} aria-label={t('Zoom out')}>
              <Minus size={13} />
            </button>
            <span className="w-10 text-center font-mono text-[11px] text-[var(--text-dim)]">{Math.round(editor.zoom * 100)}%</span>
            <button type="button" className="icon-btn h-7 w-7" onClick={() => editor.setView(Math.min(4, editor.zoom * 1.15), editor.panX, editor.panY)} aria-label={t('Zoom in')}>
              <Plus size={13} />
            </button>
          </div>
          <button type="button" className="icon-btn" onClick={fit} aria-label={t('Fit to screen')} title={t('Fit')}>
            <Maximize2 size={15} />
          </button>
          <button type="button" className="btn h-8 px-2.5 text-[12px]" onClick={() => void performSave()} disabled={editor.saving} data-testid="editor-save">
            {editor.saving ? <Spinner size={13} /> : <Save size={13} />}
            <span className="hidden sm:inline">{t('Save')}</span>
          </button>
          <button type="button" className="btn-primary h-8 px-2.5 text-[12px]" onClick={() => void openExport()} data-testid="editor-export">
            <Download size={13} />
            <span className="hidden sm:inline">{t('Export')}</span>
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* left rail: layers */}
        <aside className="hidden w-[210px] shrink-0 flex-col border-r border-[var(--line)] bg-[var(--bg-soft)] md:flex">
          <div className="flex items-center justify-between px-2.5 py-2">
            <span className="section-title">{t('Layers')}</span>
            <span className="font-mono text-[10px] text-[var(--text-faint)]">{editor.layers.length}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
            {[...editor.layers].reverse().map((layer) => (
              <LayerRow key={layer.id} layer={layer} active={layer.id === editor.selectedId} />
            ))}
            {editor.layers.length === 0 ? (
              <p className="px-2 py-6 text-center text-[11px] leading-relaxed text-[var(--text-faint)]">
                {t('No layers yet. Add text, shapes, or send a sticker from Create.')}
              </p>
            ) : null}
          </div>
          <div className="border-t border-[var(--line)] p-1.5">
            <div className="grid grid-cols-1 gap-1">
              <button type="button" className="btn-ghost justify-start text-[11px]" onClick={() => void exportLayer()} disabled={!selected}>
                <Download size={12} /> {t('Export selected layer')}
              </button>
            </div>
          </div>
        </aside>

        {/* stage */}
        <div
          ref={stageWrapRef}
          className="relative min-h-0 flex-1 overflow-hidden bg-[var(--bg)]"
          style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--panel) 60%, transparent), transparent 70%)' }}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) editor.select(null);
          }}
        >
          <div className="grid h-full w-full place-items-center p-3 sm:p-6">
            <div
              className="relative"
              style={{
                width: width * editor.zoom,
                height: height * editor.zoom,
                boxShadow: 'var(--shadow)',
              }}
            >
              <div
                ref={stageRef}
                className="absolute left-0 top-0 origin-top-left"
                style={{
                  width,
                  height,
                  transform: `scale(${editor.zoom})`,
                  background: editor.settings.background ?? 'transparent',
                }}
                onPointerDown={(e) => {
                  if (e.target === e.currentTarget) editor.select(null);
                }}
              >
                {!editor.settings.background ? <div className="checker pointer-events-none absolute inset-0" aria-hidden /> : null}
                {editor.settings.grid ? (
                  <div
                    className="pointer-events-none absolute inset-0 opacity-60"
                    style={{
                      backgroundImage:
                        'linear-gradient(to right, rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.12) 1px, transparent 1px)',
                      backgroundSize: '48px 48px',
                    }}
                    aria-hidden
                  />
                ) : null}

                {editor.layers.map((layer) => (
                  <LayerView
                    key={layer.id}
                    layer={layer}
                    selected={layer.id === editor.selectedId}
                    onPointerDown={(e) => beginMove(e, layer)}
                    onHandle={(e, handle) => beginHandle(e, layer, handle)}
                  />
                ))}

                {/* alignment guides */}
                {selected && drag?.mode === 'move' ? (
                  <>
                    <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-[var(--accent)]/40" aria-hidden />
                    <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-[var(--accent)]/40" aria-hidden />
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-3 left-3 hidden items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--panel)]/90 px-2 py-1 text-[10px] text-[var(--text-faint)] backdrop-blur sm:flex">
            <MousePointerSquareDashed size={11} />
            {t('{w}×{h} · {count} layers · {pct}%', { w: width, h: height, count: editor.layers.length, pct: Math.round(editor.zoom * 100) })}
          </div>
          <button
            type="button"
            className="absolute bottom-3 right-3 rounded-lg border border-[var(--line)] bg-[var(--panel)]/90 px-2 py-1 text-[10px] text-[var(--text-faint)] backdrop-blur hover:text-[var(--text)]"
            onClick={() => setShortcutsOpen(true)}
          >
            {t('Shortcuts')}
          </button>
        </div>

        {/* inspector */}
        <aside className="hidden w-[286px] shrink-0 overflow-y-auto border-l border-[var(--line)] bg-[var(--bg-soft)] lg:block">
          <Inspector layer={selected} />
        </aside>
      </div>

      {/* mobile inspector sheet */}
      {selected ? (
        <div className="border-t border-[var(--line)] bg-[var(--bg-soft)] lg:hidden">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-[12px] font-medium">
              <span className="flex items-center gap-1.5">
                <ChevronDown size={13} className="transition-transform group-open:rotate-180" />
                {selected.name}
              </span>
              <span className="text-[10px] text-[var(--text-faint)]">{t('Properties')}</span>
            </summary>
            <div className="max-h-[42vh] overflow-y-auto px-3 pb-3">
              <Inspector layer={selected} compact />
            </div>
          </details>
        </div>
      ) : null}

      <Modal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title={t('Export canvas')}
        footer={
          <>
            <button type="button" className="btn text-[12px]" onClick={() => setExportOpen(false)}>
              {t('Cancel')}
            </button>
            <button type="button" className="btn-primary text-[12px]" onClick={() => void doExport()} disabled={exportBusy}>
              {exportBusy ? <Spinner size={13} /> : <Download size={13} />} {t('Export')}
            </button>
          </>
        }
      >
        <div className="space-y-2">
          <div>
            <span className="label">{t('Format')}</span>
            <Segmented
              value={exportOptions.format}
              onChange={(format) => setExportOptions({ ...exportOptions, format })}
              options={[
                { value: 'png', label: t('PNG · alpha') },
                { value: 'jpeg', label: 'JPEG' },
                { value: 'webp', label: 'WebP' },
              ]}
            />
          </div>
          <div>
            <span className="label">{t('Scale')}</span>
            <Segmented
              value={String(exportOptions.scale)}
              onChange={(value) => setExportOptions({ ...exportOptions, scale: Number(value) })}
              options={[
                { value: '1', label: '1x' },
                { value: '2', label: '2x' },
                { value: '3', label: '3x' },
              ]}
            />
          </div>
          {exportOptions.format !== 'png' ? (
            <>
              <Toggle
                checked={exportOptions.transparent}
                onChange={(transparent) => setExportOptions({ ...exportOptions, transparent })}
                label={t('Transparent background')}
                hint={t('JPEG has no alpha channel; WebP does.')}
              />
              {!exportOptions.transparent ? (
                <ColorField
                  label={t('Background')}
                  value={exportOptions.background}
                  onChange={(background) => setExportOptions({ ...exportOptions, background })}
                />
              ) : null}
            </>
          ) : null}
          <div className="rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-3 py-2 text-[11px] text-[var(--text-dim)]">
            <p>
              {t('Output: {w} × {h} px', { w: width * exportOptions.scale, h: height * exportOptions.scale })}
            </p>
            <p className="mt-0.5">
              {t('Estimated size: {size}', { size: exportSize === null ? t('calculating') : formatBytes(exportSize) })}
            </p>
            <p className="mt-1 text-[10px] text-[var(--text-faint)]">
              {t('PNG keeps true alpha — the checkerboard you see on the stage is never baked in.')}
            </p>
          </div>
        </div>
      </Modal>

      <Modal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} title={t('Keyboard shortcuts')}>
        <ul className="space-y-1.5 text-[12px]">
          {[
            ['Ctrl / ⌘ + Z', 'Undo'],
            ['Ctrl / ⌘ + Shift + Z', 'Redo'],
            ['Ctrl / ⌘ + D', 'Duplicate layer'],
            ['Ctrl / ⌘ + C / V', 'Copy / paste layer'],
            ['Delete', 'Remove selected layer'],
            ['Ctrl / ⌘ + S', 'Save project'],
            ['+ / −', 'Zoom in / out'],
            ['Shift + drag corner', 'Keep aspect ratio'],
            ['Shift + rotate', 'Snap to 15°'],
            ['Space', 'Toggle this panel'],
          ].map(([key, action]) => (
            <li key={key} className="flex items-center justify-between gap-3 border-b border-[var(--line)] pb-1.5">
              <span className="kbd font-mono">{key}</span>
              <span className="text-[var(--text-dim)]">{t(action)}</span>
            </li>
          ))}
        </ul>
      </Modal>

      <CanvasSettingsPanel />
    </div>
  );
}

function LayerView({
  layer,
  selected,
  onPointerDown,
  onHandle,
}: {
  layer: Layer;
  selected: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onHandle: (e: React.PointerEvent, handle: Handle) => void;
}) {
  const { t } = useI18n();
  const style: React.CSSProperties = {
    position: 'absolute',
    left: layer.x,
    top: layer.y,
    width: layer.width,
    height: layer.height,
    transform: `rotate(${layer.rotation}deg)`,
    opacity: layer.opacity,
    display: layer.visible ? 'block' : 'none',
    cursor: layer.locked ? 'not-allowed' : 'move',
    userSelect: 'none',
    touchAction: 'none',
  };

  const handles: { id: Handle; x: string; y: string; cursor: string }[] = [
    { id: 'nw', x: '0%', y: '0%', cursor: 'nwse-resize' },
    { id: 'n', x: '50%', y: '0%', cursor: 'ns-resize' },
    { id: 'ne', x: '100%', y: '0%', cursor: 'nesw-resize' },
    { id: 'e', x: '100%', y: '50%', cursor: 'ew-resize' },
    { id: 'se', x: '100%', y: '100%', cursor: 'nwse-resize' },
    { id: 's', x: '50%', y: '100%', cursor: 'ns-resize' },
    { id: 'sw', x: '0%', y: '100%', cursor: 'nesw-resize' },
    { id: 'w', x: '0%', y: '50%', cursor: 'ew-resize' },
  ];

  return (
    <div style={style} onPointerDown={onPointerDown} data-layer-id={layer.id}>
      {layer.type === 'image' && layer.image ? (
        <img
          src={layer.image.src}
          alt={layer.name}
          draggable={false}
          style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }}
        />
      ) : null}
      {layer.type === 'text' && layer.text ? <TextRender layer={layer} /> : null}
      {layer.type === 'shape' && layer.shape ? <ShapeRender layer={layer} /> : null}

      {selected ? (
        <>
          <div
            className="pointer-events-none absolute -inset-0.5 border-2"
            style={{ borderColor: 'var(--accent)', boxShadow: '0 0 0 1px rgba(0,0,0,0.35)' }}
          />
          {handles.map((h) => (
            <button
              key={h.id}
              type="button"
              aria-label={t('Resize {dir}', { dir: h.id ?? '' })}
              className="absolute z-10 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-[2px] border border-black/40 bg-[var(--accent)]"
              style={{ left: h.x, top: h.y, cursor: h.cursor }}
              onPointerDown={(e) => onHandle(e, h.id)}
            />
          ))}
          <button
            type="button"
            aria-label={t('Rotate layer')}
            className="absolute left-1/2 z-10 grid h-6 w-6 -translate-x-1/2 place-items-center rounded-full border border-black/40 bg-[var(--accent)] text-[var(--accent-ink)]"
            style={{ top: -30 }}
            onPointerDown={(e) => onHandle(e, 'rot')}
          >
            <RotateCw size={11} />
          </button>
        </>
      ) : null}
    </div>
  );
}

function TextRender({ layer }: { layer: Layer }) {
  const t = layer.text;
  if (!t) return null;
  const lines = (t.uppercase ? t.content.toUpperCase() : t.content).split('\n');
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: t.align === 'left' ? 'flex-start' : t.align === 'right' ? 'flex-end' : 'center',
        fontFamily: t.fontFamily,
        fontWeight: t.bold ? 700 : 400,
        fontStyle: t.italic ? 'italic' : 'normal',
        fontSize: t.fontSize,
        lineHeight: t.lineHeight,
        letterSpacing: t.letterSpacing,
        color: t.color,
        textAlign: t.align,
        whiteSpace: 'pre-wrap',
        overflow: 'hidden',
        WebkitTextStroke: t.strokeWidth > 0 ? `${t.strokeWidth}px ${t.strokeColor}` : undefined,
        paintOrder: 'stroke fill',
      }}
    >
      {lines.map((line, i) => (
        <div key={i} style={{ width: '100%', textAlign: t.align }}>
          {line || '\u00A0'}
        </div>
      ))}
    </div>
  );
}

function ShapeRender({ layer }: { layer: Layer }) {
  const s = layer.shape;
  if (!s) return null;
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: s.fill,
        borderRadius: s.kind === 'ellipse' ? '50%' : s.radius,
      }}
    />
  );
}

function LayerRow({ layer, active }: { layer: Layer; active: boolean }) {
  const { t } = useI18n();
  const editor = useEditor();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(layer.name);
  const Icon = layer.type === 'text' ? Type : layer.type === 'shape' ? Square : ImageIcon;
  return (
    <div
      className={cx(
        'group flex items-center gap-1 rounded-md px-1 py-1 text-[11px]',
        active ? 'bg-[var(--panel-3)]' : 'hover:bg-[var(--panel-2)]',
      )}
      style={active ? { boxShadow: 'inset 2px 0 0 var(--accent)' } : undefined}
    >
      <button type="button" className="icon-btn h-6 w-6 shrink-0" onClick={() => editor.toggleVisible(layer.id)} aria-label={layer.visible ? t('Hide layer') : t('Show layer')}>
        {layer.visible ? <Eye size={11} /> : <EyeOff size={11} />}
      </button>
      <button type="button" className="icon-btn h-6 w-6 shrink-0" onClick={() => editor.toggleLocked(layer.id)} aria-label={layer.locked ? t('Unlock layer') : t('Lock layer')}>
        {layer.locked ? <Lock size={11} /> : <Unlock size={11} />}
      </button>
      <button type="button" className="flex min-w-0 flex-1 items-center gap-1 text-left" onClick={() => editor.select(layer.id)} onDoubleClick={() => setRenaming(true)}>
        <Icon size={11} className="shrink-0 text-[var(--text-faint)]" />
        {renaming ? (
          <input
            className="w-full rounded border border-[var(--accent)] bg-[var(--panel)] px-1 py-0.5 text-[11px]"
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              editor.renameLayer(layer.id, draft.trim() || layer.name);
              setRenaming(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') setRenaming(false);
            }}
          />
        ) : (
          <span className="truncate">{layer.name}</span>
        )}
      </button>
      <button type="button" className="icon-btn h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => editor.moveUp(layer.id)} aria-label={t('Move layer up')}>
        <ArrowUp size={11} />
      </button>
      <button type="button" className="icon-btn h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => editor.moveDown(layer.id)} aria-label={t('Move layer down')}>
        <ArrowDown size={11} />
      </button>
      <button type="button" className="icon-btn h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => editor.duplicateLayer(layer.id)} aria-label={t('Duplicate layer')}>
        <Copy size={11} />
      </button>
      <button type="button" className="icon-btn h-6 w-6 text-[var(--danger)] opacity-0 group-hover:opacity-100" onClick={() => editor.removeLayer(layer.id)} aria-label={t('Delete layer')}>
        <Trash2 size={11} />
      </button>
    </div>
  );
}

function Inspector({ layer, compact }: { layer: Layer | null; compact?: boolean }) {
  const { t } = useI18n();
  const editor = useEditor();
  if (!layer) {
    return (
      <div className="px-3 py-6 text-center text-[11px] leading-relaxed text-[var(--text-faint)]">
        {t('Select a layer to edit its properties.')}
      </div>
    );
  }
  return (
    <div className={compact ? '' : 'p-3'}>
      {!compact ? <p className="section-title mb-2">{t('Properties')}</p> : null}
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="X" value={layer.x} onChange={(x) => editor.updateLayer(layer.id, { x })} />
        <NumberField label="Y" value={layer.y} onChange={(y) => editor.updateLayer(layer.id, { y })} />
        <NumberField label="W" value={layer.width} onChange={(width) => editor.updateLayer(layer.id, { width: Math.max(4, width) })} />
        <NumberField label="H" value={layer.height} onChange={(height) => editor.updateLayer(layer.id, { height: Math.max(4, height) })} />
      </div>
      <Slider label={t('Rotation')} value={Math.round(layer.rotation)} min={-180} max={180} unit="°" onChange={(rotation) => editor.updateLayer(layer.id, { rotation })} />
      <Slider label={t('Opacity')} value={Math.round(layer.opacity * 100)} min={0} max={100} unit="%" onChange={(v) => editor.updateLayer(layer.id, { opacity: v / 100 })} />

      {layer.type === 'text' && layer.text ? (
        <div className="mt-2 border-t border-[var(--line)] pt-2">
          <p className="section-title mb-1.5">{t('Text')}</p>
          <textarea
            className="field min-h-[64px] resize-y font-mono text-[12px]"
            value={layer.text.content}
            onChange={(e) => editor.updateLayerData(layer.id, { text: { content: e.target.value } as never })}
            aria-label={t('Text content')}
            data-testid="text-layer-content"
          />
          <div className="mt-2 flex gap-1">
            <button
              type="button"
              className={cx('icon-btn h-8 w-8 border', layer.text.bold ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--line)]')}
              onClick={() => editor.updateLayerData(layer.id, { text: { bold: !layer.text?.bold } as never })}
              aria-label={t('Bold')}
            >
              <Bold size={13} />
            </button>
            <button
              type="button"
              className={cx('icon-btn h-8 w-8 border', layer.text.italic ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-[var(--line)]')}
              onClick={() => editor.updateLayerData(layer.id, { text: { italic: !layer.text?.italic } as never })}
              aria-label={t('Italic')}
            >
              <Italic size={13} />
            </button>
            <div className="ml-auto">
              <Segmented
                size="sm"
                value={layer.text.align}
                onChange={(align) => editor.updateLayerData(layer.id, { text: { align } as never })}
                options={[
                  { value: 'left', label: 'L' },
                  { value: 'center', label: 'C' },
                  { value: 'right', label: 'R' },
                ]}
              />
            </div>
          </div>
          <Slider
            label={t('Font size')}
            value={layer.text.fontSize}
            min={8}
            max={320}
            onChange={(fontSize) => editor.updateLayerData(layer.id, { text: { fontSize } as never })}
          />
          <Slider
            label={t('Line height')}
            value={Number(layer.text.lineHeight.toFixed(2))}
            min={0.8}
            max={2.4}
            step={0.05}
            onChange={(lineHeight) => editor.updateLayerData(layer.id, { text: { lineHeight } as never })}
          />
          <Slider
            label={t('Letter spacing')}
            value={layer.text.letterSpacing}
            min={-10}
            max={40}
            onChange={(letterSpacing) => editor.updateLayerData(layer.id, { text: { letterSpacing } as never })}
          />
          <ColorField
            label={t('Fill')}
            value={layer.text.color}
            onChange={(color) => editor.updateLayerData(layer.id, { text: { color } as never })}
          />
          <Slider
            label={t('Stroke width')}
            value={layer.text.strokeWidth}
            min={0}
            max={32}
            onChange={(strokeWidth) => editor.updateLayerData(layer.id, { text: { strokeWidth } as never })}
          />
          <ColorField
            label={t('Stroke color')}
            value={layer.text.strokeColor}
            onChange={(strokeColor) => editor.updateLayerData(layer.id, { text: { strokeColor } as never })}
          />
          <Toggle
            checked={layer.text.uppercase}
            onChange={(uppercase) => editor.updateLayerData(layer.id, { text: { uppercase } as never })}
            label={t('Uppercase')}
          />
        </div>
      ) : null}

      {layer.type === 'shape' && layer.shape ? (
        <div className="mt-2 border-t border-[var(--line)] pt-2">
          <p className="section-title mb-1.5">{t('Shape')}</p>
          <ColorField label={t('Fill')} value={layer.shape.fill} onChange={(fill) => editor.updateLayerData(layer.id, { shape: { fill } as never })} />
          {layer.shape.kind === 'rect' ? (
            <Slider
              label={t('Corner radius')}
              value={layer.shape.radius}
              min={0}
              max={320}
              onChange={(radius) => editor.updateLayerData(layer.id, { shape: { radius } as never })}
            />
          ) : null}
        </div>
      ) : null}

      <div className="mt-2 border-t border-[var(--line)] pt-2">
        <div className="grid grid-cols-2 gap-1.5">
          <button type="button" className="btn h-8 text-[11px]" onClick={() => editor.moveUp(layer.id)}>
            <ArrowUp size={12} /> {t('Forward')}
          </button>
          <button type="button" className="btn h-8 text-[11px]" onClick={() => editor.moveDown(layer.id)}>
            <ArrowDown size={12} /> {t('Back')}
          </button>
          <button
            type="button"
            className="btn h-8 text-[11px]"
            onClick={() => {
              editor.updateLayer(layer.id, { x: Math.round((editor.settings.width - layer.width) / 2) });
            }}
          >
            <AlignHorizontalJustifyCenter size={12} /> {t('Center X')}
          </button>
          <button
            type="button"
            className="btn h-8 text-[11px]"
            onClick={() => {
              editor.updateLayer(layer.id, { y: Math.round((editor.settings.height - layer.height) / 2) });
            }}
          >
            <AlignHorizontalJustifyCenter size={12} className="rotate-90" /> {t('Center Y')}
          </button>
        </div>
        <button
          type="button"
          className="btn-danger mt-1.5 h-8 w-full justify-center text-[11px]"
          onClick={() => editor.removeLayer(layer.id)}
        >
          <Trash2 size={12} /> {t('Delete layer')}
        </button>
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="label mb-1">{label}</span>
      <input
        type="number"
        className="field px-2 py-1 text-[12px]"
        value={Math.round(value)}
        onChange={(e) => {
          const parsed = Number(e.target.value);
          if (Number.isFinite(parsed)) onChange(parsed);
        }}
        aria-label={label}
      />
    </label>
  );
}

function CanvasSettingsPanel() {
  const { t } = useI18n();
  const editor = useEditor();
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="flex items-center gap-2 border-t border-[var(--line)] px-2 py-1 lg:hidden">
        <button type="button" className="btn-ghost text-[11px]" onClick={() => setOpen((o) => !o)}>
          <Layers size={12} /> {t('Canvas')}
        </button>
        <span className="text-[10px] text-[var(--text-faint)]">
          {editor.settings.width}×{editor.settings.height}
        </span>
        <div className="ml-auto flex gap-1">
          {[...editor.layers].reverse().slice(0, 4).map((layer) => (
            <button
              key={layer.id}
              type="button"
              className="chip text-[10px]"
              onClick={() => editor.select(layer.id)}
              style={layer.id === editor.selectedId ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined}
            >
              {layer.name.slice(0, 10)}
            </button>
          ))}
        </div>
      </div>
      {open ? (
        <div className="border-t border-[var(--line)] bg-[var(--bg-soft)] px-3 py-2 lg:hidden">
          <CanvasFields />
        </div>
      ) : null}
      <div className="hidden">
        <CanvasFields />
      </div>
      <button type="button" className="hidden" onClick={() => setOpen(false)} aria-hidden />
    </>
  );
}

function CanvasFields() {
  const { t } = useI18n();
  const editor = useEditor();
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <NumberField label={t('Canvas W')} value={editor.settings.width} onChange={(width) => editor.setSettings({ width: Math.max(32, width) })} />
        <NumberField label={t('Canvas H')} value={editor.settings.height} onChange={(height) => editor.setSettings({ height: Math.max(32, height) })} />
      </div>
      <Toggle
        checked={editor.settings.grid}
        onChange={(grid) => editor.setSettings({ grid })}
        label={t('Grid overlay')}
      />
      <Toggle
        checked={editor.settings.snap}
        onChange={(snap) => editor.setSettings({ snap })}
        label={t('Snap to center')}
        hint={t('Snaps layers to the canvas center guides while dragging.')}
      />
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="text-sm">{t('Background')}</span>
        <span className="flex items-center gap-1.5">
          <button
            type="button"
            className={cx('chip', !editor.settings.background && 'chip-active')}
            onClick={() => editor.setSettings({ background: null })}
          >
            {t('Transparent')}
          </button>
          <input
            type="color"
            className="h-8 w-9"
            value={editor.settings.background ?? '#0b0d12'}
            onChange={(e) => editor.setSettings({ background: e.target.value })}
            aria-label={t('Canvas background color')}
          />
        </span>
      </div>
    </div>
  );
}

export function useProjectMeta() {
  const editor = useEditor();
  return useMemo(
    () => ({
      id: editor.projectId,
      name: editor.projectName,
      layers: editor.layers,
      width: editor.settings.width,
      height: editor.settings.height,
    }),
    [editor.projectId, editor.projectName, editor.layers, editor.settings.width, editor.settings.height],
  );
}

export { makeThumbnail, Check, X };
