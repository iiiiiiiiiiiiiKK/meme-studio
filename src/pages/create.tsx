import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardPaste,
  Cpu,
  Download,
  ImagePlus,
  Layers,
  Link2,
  Loader2,
  RotateCcw,
  Save,
  Split,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import { useUi } from '../state/ui';
import { useLibrary } from '../state/library';
import { useEditor, createImageLayer } from '../state/editor';
import { CUT_MODES, DEFAULT_OUTLINE, MODE_LABEL, type CutMode, type OutlineSettings } from '../types';
import { detectAll, personAlpha, getEngine, getEngineInfo, type FaceDetection, type ProgressEvent } from '../lib/ai';
import { runCutout, maskPreviewCanvas, type CutoutResult } from '../lib/cutout';
import {
  canvasToBlob,
  createCanvas,
  ctx2d,
  decodeToCanvas,
  downloadBlob,
  drawCheckerboard,
  formatBytes,
  makeThumbnail,
  urlToImage,
} from '../lib/image';
import { blurMask, extractAlpha } from '../lib/mask';
import { Segmented, Slider, ColorField, Toggle, Spinner, StatusPill, Modal } from '../components/ui';
import { cx } from '../lib/cx';

type PreviewTab = 'result' | 'source' | 'mask';
type BrushMode = 'erase' | 'restore';

interface AnalyzeState {
  status: 'idle' | 'running' | 'done' | 'error';
  message: string;
  progress: number;
  faces: FaceDetection[];
  personAlpha: Uint8ClampedArray | null;
  matteSource: 'rvm' | 'fallback' | null;
  elapsed: number;
  error?: string;
  warnings: string[];
}

const EMPTY_ANALYZE: AnalyzeState = {
  status: 'idle',
  message: 'Import an image to begin.',
  progress: 0,
  faces: [],
  personAlpha: null,
  matteSource: null,
  elapsed: 0,
  warnings: [],
};

export function CreatePage() {
  const { navigate, toast, setEngine } = useUi();
  const [source, setSource] = useState<HTMLCanvasElement | null>(null);
  const [sourceName, setSourceName] = useState('image');
  const [analyze, setAnalyze] = useState<AnalyzeState>(EMPTY_ANALYZE);
  const [mode, setMode] = useState<CutMode>('head');
  const [faceIndex, setFaceIndex] = useState(0);
  const [feather, setFeather] = useState(0.6);
  const [expand, setExpand] = useState(0);
  const [edgeSmooth, setEdgeSmooth] = useState(0.4);
  const [outline, setOutline] = useState<OutlineSettings>(DEFAULT_OUTLINE);
  const [tab, setTab] = useState<PreviewTab>('result');
  const [result, setResult] = useState<CutoutResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [brushMode, setBrushMode] = useState<BrushMode>('erase');
  const [brushSize, setBrushSize] = useState(28);
  const [manualAlpha, setManualAlpha] = useState<Uint8ClampedArray | null>(null);
  const [urlOpen, setUrlOpen] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const [urlBusy, setUrlBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const maskRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const painting = useRef(false);

  const engineInfo = getEngineInfo();

  const effectiveAlpha = manualAlpha ?? analyze.personAlpha;

  const recompute = useCallback(async () => {
    if (!source || !effectiveAlpha) return;
    setBusy(true);
    // Let the browser paint the "working" state before blocking on the CPU.
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    try {
      const next = runCutout({
        source,
        personAlpha: effectiveAlpha,
        faces: analyze.faces,
        options: { mode, faceIndex, feather, expand, edgeSmooth, outline },
      });
      setResult(next);
      if (next.warnings.length) {
        next.warnings.forEach((warning) => toast(warning, 'info'));
      }
    } catch (error) {
      toast('Cutout failed', 'error', error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }, [source, effectiveAlpha, analyze.faces, mode, faceIndex, feather, expand, edgeSmooth, outline, toast]);

  useEffect(() => {
    void recompute();
  }, [recompute]);

  // paint the result preview
  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas) return;
    const ctx = ctx2d(canvas);
    if (tab === 'source' && source) {
      canvas.width = Math.min(760, source.width);
      canvas.height = Math.round((canvas.width / source.width) * source.height);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
      return;
    }
    if (tab === 'mask' && effectiveAlpha) {
      const w = source?.width ?? 512;
      const h = source?.height ?? 512;
      const maskCanvas = maskPreviewCanvas(effectiveAlpha, w, h);
      canvas.width = Math.min(760, w);
      canvas.height = Math.round((canvas.width / w) * h);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(maskCanvas, 0, 0, canvas.width, canvas.height);
      return;
    }
    if (result) {
      canvas.width = Math.min(760, result.width);
      canvas.height = Math.round((canvas.width / result.width) * result.height);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawCheckerboard(ctx, 0, 0, canvas.width, canvas.height, Math.max(8, Math.round(canvas.width / 40)));
      ctx.drawImage(result.canvas, 0, 0, canvas.width, canvas.height);
      return;
    }
    canvas.width = 320;
    canvas.height = 320;
    ctx.clearRect(0, 0, 320, 320);
  }, [result, source, tab, effectiveAlpha]);

  // mask canvas for the brush editor in "mask" tab
  useEffect(() => {
    const canvas = maskRef.current;
    if (!canvas || !source || !effectiveAlpha || tab !== 'mask') return;
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = ctx2d(canvas);
    const maskCanvas = maskPreviewCanvas(effectiveAlpha, source.width, source.height);
    ctx.drawImage(maskCanvas, 0, 0);
  }, [tab, source, effectiveAlpha]);

  async function loadFile(file: File | null): Promise<void> {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast('That file is not an image.', 'error');
      return;
    }
    try {
      const canvas = await decodeToCanvas(file, 2048);
      setSource(canvas);
      setSourceName(file.name);
      setAnalyze(EMPTY_ANALYZE);
      setManualAlpha(null);
      setResult(null);
      setTab('source');
      toast(`Loaded ${file.name} · ${canvas.width}×${canvas.height}`, 'success');
    } catch (error) {
      toast('Could not read that image', 'error', error instanceof Error ? error.message : String(error));
    }
  }

  async function loadFromUrl(): Promise<void> {
    if (!urlValue.trim()) return;
    setUrlBusy(true);
    try {
      if (!/^https?:\/\//i.test(urlValue.trim())) throw new Error('Only http(s) URLs are supported.');
      const img = await urlToImage(urlValue.trim(), true);
      const canvas = createCanvas(img.naturalWidth, img.naturalHeight);
      ctx2d(canvas).drawImage(img, 0, 0);
      setSource(canvas);
      setSourceName(urlValue.split('/').pop()?.split('?')[0] || 'remote-image');
      setAnalyze(EMPTY_ANALYZE);
      setManualAlpha(null);
      setResult(null);
      setTab('source');
      setUrlOpen(false);
      toast('Remote image loaded locally. Nothing was uploaded.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast(
        'Could not load that URL',
        'error',
        `${message} — most sites block cross-origin reads. Download the image and drop it here instead.`,
      );
    } finally {
      setUrlBusy(false);
    }
  }

  async function pasteFromClipboard(): Promise<void> {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith('image/'));
        if (type) {
          const blob = await item.getType(type);
          const file = new File([blob], 'clipboard.png', { type });
          await loadFile(file);
          return;
        }
      }
      toast('No image found on the clipboard. Copy an image first.', 'info');
    } catch (error) {
      toast(
        'Clipboard access was blocked',
        'error',
        `${error instanceof Error ? error.message : String(error)} — use the file picker or drag & drop instead.`,
      );
    }
  }

  async function runAnalysis(): Promise<void> {
    if (!source) return;
    setAnalyze({ ...EMPTY_ANALYZE, status: 'running', message: 'Starting local engine…', progress: 0.05 });
    setEngine('loading', 'Loading local models…');
    try {
      const onProgress = (event: ProgressEvent) => {
        setAnalyze((prev) => ({ ...prev, message: event.message, progress: event.stage === 'ready' ? 0.45 : prev.progress + 0.1 }));
      };
      await getEngine(onProgress);
      onProgress({ stage: 'detecting', message: 'Detecting faces…' });
      const detect = await detectAll(source, onProgress);
      onProgress({ stage: 'matting', message: 'Building the person matte…' });
      const matte = await personAlpha(source, onProgress);
      setEngine('ready', `Ready · ${engineInfo?.backend ?? detect.backend}`);
      const warnings: string[] = [];
      if (matte.source === 'fallback') {
        warnings.push(
          `The neural matte did not run (${matte.note ?? 'unknown reason'}). A colour-based fallback was used instead — results are approximate.`,
        );
      }
      if (detect.faces.length === 0) {
        warnings.push('No face was detected in this image. Background and Full person modes will still work.');
      }
      setAnalyze({
        status: 'done',
        message: `${detect.faces.length} face${detect.faces.length === 1 ? '' : 's'} · ${matte.source === 'rvm' ? 'RVM matte' : 'fallback matte'} · ${detect.elapsedMs + matte.elapsedMs}ms`,
        progress: 1,
        faces: detect.faces,
        personAlpha: matte.alpha,
        matteSource: matte.source,
        elapsed: detect.elapsedMs + matte.elapsedMs,
        warnings,
      });
      setManualAlpha(null);
      setFaceIndex(0);
      if (detect.faces.length === 0 && mode !== 'background' && mode !== 'full') setMode('background');
      setTab('result');
      warnings.forEach((w) => toast(w, 'info'));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setAnalyze({ ...EMPTY_ANALYZE, status: 'error', message, error: message });
      setEngine('error', message);
      toast('Local engine failed', 'error', message);
    }
  }

  function resetEdits(): void {
    setManualAlpha(null);
    setFeather(0.6);
    setExpand(0);
    setEdgeSmooth(0.4);
    setOutline(DEFAULT_OUTLINE);
    toast('Adjustments reset.', 'info');
  }

  // brush painting on the mask
  function paintAt(clientX: number, clientY: number): void {
    const canvas = maskRef.current;
    if (!canvas || !source || !effectiveAlpha) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.round(((clientX - rect.left) / rect.width) * source.width);
    const y = Math.round(((clientY - rect.top) / rect.height) * source.height);
    const template = createCanvas(source.width, source.height);
    const tctx = ctx2d(template);
    tctx.fillStyle = '#ffffff';
    tctx.beginPath();
    tctx.arc(x, y, brushSize, 0, Math.PI * 2);
    tctx.fill();
    const stamp = blurMask(extractAlpha(template), source.width, source.height, Math.max(1, brushSize * 0.18));
    const next = new Uint8ClampedArray(effectiveAlpha);
    for (let i = 0; i < next.length; i++) {
      if (brushMode === 'erase') next[i] = Math.min(next[i], 255 - stamp[i]);
      else next[i] = Math.max(next[i], stamp[i]);
    }
    setManualAlpha(next);
    const ctx = ctx2d(canvas);
    const preview = maskPreviewCanvas(next, source.width, source.height);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(preview, 0, 0);
  }

  async function sendToEditor(): Promise<void> {
    if (!result) return;
    try {
      const blob = await canvasToBlob(result.canvas, 'image/png');
      const thumb = await makeThumbnail(result.canvas, 420);
      const asset = await useLibrary.getState().addAsset({
        blob,
        name: `${sourceName.replace(/\.[^.]+$/, '')} ${MODE_LABEL[mode].toLowerCase()}`,
        kind: 'sticker',
        width: result.width,
        height: result.height,
        tags: ['cutout', mode],
        source: 'create studio',
        mode,
        hasAlpha: true,
      });
      void thumb;
      const url = URL.createObjectURL(blob);
      const editor = useEditor.getState();
      const id = crypto.randomUUID ? crypto.randomUUID() : `p_${Date.now()}`;
      const projectName = `${sourceName.replace(/\.[^.]+$/, '')} meme`;
      const settings = {
        width: Math.max(800, Math.round(result.width * 1.35)),
        height: Math.max(800, Math.round(result.height * 1.35)),
        background: null,
        grid: false,
        snap: true,
      };
      editor.setProject({
        id,
        name: projectName,
        layers: [
          {
            ...createImageLayer({
              src: url,
              naturalWidth: result.width,
              naturalHeight: result.height,
              assetId: asset.id,
              x: Math.round((settings.width - result.width) / 2),
              y: Math.round((settings.height - result.height) / 2),
              width: result.width,
              height: result.height,
              name: asset.name,
            }),
          },
        ],
        settings,
      });
      await editor.save();
      navigate('editor');
      toast('Sticker sent to the editor and saved to My Space.', 'success');
    } catch (error) {
      toast('Could not open the editor', 'error', error instanceof Error ? error.message : String(error));
    }
  }

  async function saveToLibrary(): Promise<void> {
    if (!result) return;
    try {
      const blob = await canvasToBlob(result.canvas, 'image/png');
      await useLibrary.getState().addAsset({
        blob,
        name: `${sourceName.replace(/\.[^.]+$/, '')} ${MODE_LABEL[mode].toLowerCase()}`,
        kind: 'sticker',
        width: result.width,
        height: result.height,
        tags: ['cutout', mode],
        source: 'create studio',
        mode,
        hasAlpha: true,
      });
      toast('Saved to My Space on this device.', 'success');
    } catch (error) {
      toast('Saving failed', 'error', error instanceof Error ? error.message : String(error));
    }
  }

  async function downloadResult(): Promise<void> {
    if (!result) return;
    const blob = await canvasToBlob(result.canvas, 'image/png');
    downloadBlob(blob, `${sourceName.replace(/\.[^.]+$/, '')}-${mode}.png`);
    toast(`Downloaded transparent PNG · ${formatBytes(blob.size)}`, 'success');
  }

  // paste support
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'));
      if (item) {
        const file = item.getAsFile();
        if (file) void loadFile(file);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  const canCut = Boolean(source && analyze.personAlpha);
  const faceOptions = useMemo(
    () =>
      analyze.faces.map((face, index) => ({
        index,
        label: `Person ${index + 1}`,
        detail: `${Math.round(face.box[2])}×${Math.round(face.box[3])}px · ${(face.score * 100).toFixed(0)}%`,
      })),
    [analyze.faces],
  );

  return (
    <div className="mx-auto w-full max-w-[1280px] px-3 pb-24 pt-4 sm:px-6 sm:pb-10 sm:pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Create</h1>
          <p className="mt-1 text-[12px] text-[var(--text-dim)]">
            Local cutout studio — FaceMesh finds the person, the RVM matte shapes the silhouette, and the outline is
            derived from the real alpha channel.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {analyze.matteSource ? (
            <StatusPill tone={analyze.matteSource === 'rvm' ? 'ok' : 'warn'}>
              {analyze.matteSource === 'rvm' ? 'RVM neural matte' : 'Colour fallback matte'}
            </StatusPill>
          ) : (
            <StatusPill tone="neutral">Engine idle</StatusPill>
          )}
          {engineInfo ? <StatusPill tone="ok">{engineInfo.backend}</StatusPill> : null}
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* main column */}
        <div className="min-w-0 space-y-3">
          {!source ? (
            <div
              className={cx(
                'flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors',
                dragging ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_6%,transparent)]' : 'border-[var(--line)]',
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) void loadFile(file);
              }}
              data-testid="create-dropzone"
            >
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--panel-2)] text-[var(--accent)]">
                <ImagePlus size={22} />
              </span>
              <h2 className="mt-3 text-sm font-medium">Drop an image, paste, or choose a file</h2>
              <p className="mt-1 max-w-sm text-[11px] leading-relaxed text-[var(--text-faint)]">
                JPG, PNG, WebP or GIF. Everything is decoded in this tab — no upload, no API key, and it keeps working
                when you go offline.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button type="button" className="btn-primary text-[12px]" onClick={() => fileRef.current?.click()}>
                  <Upload size={14} /> Choose file
                </button>
                <button type="button" className="btn text-[12px]" onClick={() => void pasteFromClipboard()}>
                  <ClipboardPaste size={14} /> Paste
                </button>
                <button type="button" className="btn text-[12px]" onClick={() => setUrlOpen(true)}>
                  <Link2 size={14} /> From URL
                </button>
              </div>
              <p className="mt-3 text-[10px] text-[var(--text-faint)]">
                Tip: Ctrl/⌘+V anywhere on this page also works.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)]">
                <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] px-3 py-2">
                  <span className="truncate text-[12px] font-medium">{sourceName}</span>
                  <span className="font-mono text-[10px] text-[var(--text-faint)]">
                    {source.width}×{source.height}
                  </span>
                  <div className="ml-auto flex items-center gap-1">
                    <Segmented
                      size="sm"
                      value={tab}
                      onChange={(value) => setTab(value as PreviewTab)}
                      options={[
                        { value: 'result', label: 'Result' },
                        { value: 'source', label: 'Original' },
                        { value: 'mask', label: 'Mask' },
                      ]}
                    />
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => {
                        setSource(null);
                        setResult(null);
                        setAnalyze(EMPTY_ANALYZE);
                        setManualAlpha(null);
                      }}
                      aria-label="Remove image"
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>
                <div className="relative flex min-h-[280px] items-center justify-center p-3 sm:min-h-[400px]">
                  {tab !== 'mask' ? (
                    <canvas ref={previewRef} className="max-h-[58vh] w-auto max-w-full" aria-label="Cutout preview" />
                  ) : (
                    <div className="relative max-h-[58vh]">
                      <canvas
                        ref={maskRef}
                        className="max-h-[58vh] w-auto max-w-full cursor-crosshair touch-none rounded border border-[var(--line)]"
                        aria-label="Mask editor"
                        onPointerDown={(e) => {
                          painting.current = true;
                          (e.target as HTMLElement).setPointerCapture(e.pointerId);
                          paintAt(e.clientX, e.clientY);
                        }}
                        onPointerMove={(e) => {
                          if (painting.current) paintAt(e.clientX, e.clientY);
                        }}
                        onPointerUp={() => {
                          painting.current = false;
                        }}
                        onPointerCancel={() => {
                          painting.current = false;
                        }}
                      />
                      <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-[10px] text-white">
                        {brushMode === 'erase' ? 'Erase' : 'Restore'} · {brushSize}px
                      </span>
                    </div>
                  )}

                  {busy ? (
                    <div className="absolute inset-0 grid place-items-center bg-black/30">
                      <span className="flex items-center gap-2 rounded-lg bg-[var(--panel)] px-3 py-2 text-[11px] shadow-lg">
                        <Spinner size={13} /> Recomputing cutout…
                      </span>
                    </div>
                  ) : null}

                  {!analyze.personAlpha && tab === 'result' ? (
                    <div className="absolute inset-0 grid place-items-center bg-[var(--panel)]/70">
                      <div className="text-center">
                        <p className="text-[12px] text-[var(--text-dim)]">Analysis has not run yet.</p>
                        <button
                          type="button"
                          className="btn-primary mt-2 text-[12px]"
                          onClick={() => void runAnalysis()}
                          disabled={analyze.status === 'running'}
                        >
                          {analyze.status === 'running' ? <Spinner size={13} /> : <Cpu size={13} />}
                          Run local AI
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>

                {analyze.status === 'running' ? (
                  <div className="border-t border-[var(--line)] px-3 py-2">
                    <div className="h-1 w-full overflow-hidden rounded bg-[var(--panel-3)]">
                      <div
                        className="h-full bg-[var(--accent)] transition-all"
                        style={{ width: `${Math.round(analyze.progress * 100)}%` }}
                      />
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 text-[10px] text-[var(--text-faint)]">
                      <Loader2 size={10} className="spin" /> {analyze.message}
                    </p>
                  </div>
                ) : null}
              </div>

              {result ? (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2">
                  <span className="text-[11px] text-[var(--text-faint)]">
                    {result.width}×{result.height} · alpha kept
                  </span>
                  <div className="ml-auto flex flex-wrap gap-1.5">
                    <button type="button" className="btn h-8 text-[11px]" onClick={() => void downloadResult()}>
                      <Download size={12} /> PNG
                    </button>
                    <button type="button" className="btn h-8 text-[11px]" onClick={() => void saveToLibrary()}>
                      <Save size={12} /> Save to My Space
                    </button>
                    <button type="button" className="btn-primary h-8 text-[11px]" onClick={() => void sendToEditor()} data-testid="send-to-editor">
                      <Layers size={12} /> Open in editor <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>

        {/* controls */}
        <aside className="space-y-3">
          <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
            <p className="section-title mb-2">1 · Import</p>
            <div className="grid grid-cols-3 gap-1.5">
              <button type="button" className="btn h-9 text-[11px]" onClick={() => fileRef.current?.click()}>
                <Upload size={13} /> File
              </button>
              <button type="button" className="btn h-9 text-[11px]" onClick={() => void pasteFromClipboard()}>
                <ClipboardPaste size={13} /> Paste
              </button>
              <button type="button" className="btn h-9 text-[11px]" onClick={() => setUrlOpen(true)}>
                <Link2 size={13} /> URL
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
            <p className="section-title mb-2">2 · Local AI</p>
            <button
              type="button"
              className="btn-primary h-9 w-full text-[12px]"
              onClick={() => void runAnalysis()}
              disabled={!source || analyze.status === 'running'}
              data-testid="run-analysis"
            >
              {analyze.status === 'running' ? <Spinner size={13} /> : <Wand2 size={13} />}
              {analyze.personAlpha ? 'Re-run analysis' : 'Analyse image'}
            </button>
            {analyze.status === 'done' ? (
              <div className="mt-2 space-y-1 text-[10px] leading-relaxed text-[var(--text-faint)]">
                <p className="flex items-center gap-1">
                  <CheckCircle2 size={10} style={{ color: 'var(--ok)' }} /> {analyze.message}
                </p>
                {analyze.matteSource === 'fallback' ? (
                  <p className="flex items-start gap-1" style={{ color: 'var(--warn)' }}>
                    <AlertTriangle size={10} className="mt-0.5 shrink-0" /> Neural matte unavailable — the colour fallback is approximate.
                  </p>
                ) : null}
              </div>
            ) : null}
            {analyze.status === 'error' ? (
              <p className="mt-2 flex items-start gap-1 text-[10px] leading-relaxed" style={{ color: 'var(--danger)' }}>
                <AlertTriangle size={10} className="mt-0.5 shrink-0" /> {analyze.error}
              </p>
            ) : null}
            <p className="mt-2 text-[10px] leading-relaxed text-[var(--text-faint)]">
              Models are served from this site (RVM 3.7 MB + FaceMesh 1.5 MB) and cached by the browser after the first run.
            </p>
          </div>

          <div className={cx('rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3', !canCut && 'opacity-60')}>
            <p className="section-title mb-2">3 · Cut mode</p>
            <div className="grid grid-cols-2 gap-1.5">
              {CUT_MODES.map((item) => {
                const disabled = !canCut || ((mode !== 'background' && mode !== 'full') && analyze.faces.length === 0);
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => setMode(item.id)}
                    className={cx(
                      'rounded-lg border px-2 py-1.5 text-left text-[11px] transition-colors',
                      mode === item.id
                        ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]'
                        : 'border-[var(--line)] hover:bg-[var(--panel-2)]',
                      disabled && 'cursor-not-allowed opacity-40',
                    )}
                    title={item.hint}
                  >
                    <span className="block font-medium">{item.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--text-faint)]">
              {CUT_MODES.find((m) => m.id === mode)?.hint}
            </p>

            {faceOptions.length > 1 ? (
              <div className="mt-2">
                <span className="label">Target person</span>
                <div className="flex flex-wrap gap-1">
                  {faceOptions.map((face) => (
                    <button
                      key={face.index}
                      type="button"
                      className={cx('chip', faceIndex === face.index && 'chip-active')}
                      onClick={() => setFaceIndex(face.index)}
                      title={face.detail}
                    >
                      <Split size={10} /> {face.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {analyze.faces.length === 0 && analyze.status === 'done' ? (
              <p className="mt-2 text-[10px] leading-relaxed" style={{ color: 'var(--warn)' }}>
                No face detected — only Background and Full person modes are available for this image.
              </p>
            ) : null}
          </div>

          <div className={cx('rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3', !canCut && 'opacity-60')}>
            <div className="mb-1 flex items-center justify-between">
              <p className="section-title">4 · Edge & outline</p>
              <button type="button" className="btn-ghost h-6 px-1.5 text-[10px]" onClick={resetEdits}>
                <RotateCcw size={10} /> Reset
              </button>
            </div>
            <Slider label="Feather" value={feather} min={0} max={4} step={0.1} unit="px" onChange={setFeather} />
            <Slider label="Expand / contract" value={expand} min={-12} max={12} unit="px" onChange={setExpand} />
            <Slider label="Edge smooth" value={edgeSmooth} min={0} max={3} step={0.1} unit="px" onChange={setEdgeSmooth} />

            <div className="mt-2 border-t border-[var(--line)] pt-2">
              <Toggle checked={outline.enabled} onChange={(enabled) => setOutline({ ...outline, enabled })} label="Outline" />
              {outline.enabled ? (
                <>
                  <Slider label="Thickness" value={outline.thickness} min={0} max={60} unit="px" onChange={(thickness) => setOutline({ ...outline, thickness })} />
                  <ColorField label="Color" value={outline.color} onChange={(color) => setOutline({ ...outline, color })} />
                  <Slider
                    label="Second outline"
                    value={outline.layers === 2 ? outline.secondThickness : 0}
                    min={0}
                    max={40}
                    unit="px"
                    onChange={(v) => setOutline({ ...outline, layers: v > 0 ? 2 : 1, secondThickness: v })}
                  />
                  {outline.layers === 2 ? (
                    <ColorField label="Outer color" value={outline.secondColor} onChange={(secondColor) => setOutline({ ...outline, secondColor })} />
                  ) : null}
                  <Slider label="Inner stroke" value={outline.inner} min={0} max={16} unit="px" onChange={(inner) => setOutline({ ...outline, inner })} />
                  <Toggle checked={outline.shadow} onChange={(shadow) => setOutline({ ...outline, shadow })} label="Drop shadow" />
                  {outline.shadow ? (
                    <>
                      <Slider label="Shadow blur" value={outline.shadowBlur} min={0} max={60} unit="px" onChange={(shadowBlur) => setOutline({ ...outline, shadowBlur })} />
                      <Slider
                        label="Shadow opacity"
                        value={Math.round(outline.shadowOpacity * 100)}
                        min={0}
                        max={100}
                        unit="%"
                        onChange={(v) => setOutline({ ...outline, shadowOpacity: v / 100 })}
                      />
                      <ColorField label="Shadow color" value={outline.shadowColor} onChange={(shadowColor) => setOutline({ ...outline, shadowColor })} />
                    </>
                  ) : null}
                  <Toggle checked={outline.glow} onChange={(glow) => setOutline({ ...outline, glow })} label="Glow" />
                  {outline.glow ? <ColorField label="Glow color" value={outline.glowColor} onChange={(glowColor) => setOutline({ ...outline, glowColor })} /> : null}
                </>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
            <p className="section-title mb-2">5 · Touch up</p>
            <Segmented
              size="sm"
              value={brushMode}
              onChange={(value) => {
                setBrushMode(value as BrushMode);
                setTab('mask');
              }}
              options={[
                { value: 'erase', label: 'Erase' },
                { value: 'restore', label: 'Restore' },
              ]}
            />
            <Slider label="Brush size" value={brushSize} min={4} max={120} unit="px" onChange={setBrushSize} />
            <p className="text-[10px] leading-relaxed text-[var(--text-faint)]">
              Switch to the Mask tab and paint to fix hair, ears or a stray shoulder. Undo with Ctrl/⌘+Z inside the
              canvas history, or press Reset to drop manual edits.
            </p>
            {manualAlpha ? (
              <button type="button" className="btn mt-1.5 h-7 w-full text-[10px]" onClick={() => setManualAlpha(null)}>
                <RotateCcw size={10} /> Discard brush edits
              </button>
            ) : null}
          </div>
        </aside>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void loadFile(e.target.files?.[0] ?? null)}
        data-testid="create-file-input"
      />

      <Modal
        open={urlOpen}
        onClose={() => setUrlOpen(false)}
        title="Import from a URL"
        footer={
          <>
            <button type="button" className="btn text-[12px]" onClick={() => setUrlOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn-primary text-[12px]" onClick={() => void loadFromUrl()} disabled={urlBusy}>
              {urlBusy ? <Spinner size={13} /> : <Link2 size={13} />} Import
            </button>
          </>
        }
      >
        <label className="label">Image URL</label>
        <input
          className="field"
          placeholder="https://example.com/meme.png"
          value={urlValue}
          onChange={(e) => setUrlValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void loadFromUrl();
          }}
          aria-label="Image URL"
        />
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-faint)]">
          The image is fetched by your browser and decoded locally. Sites that block cross-origin requests will fail —
          in that case download the file and drop it on the canvas instead.
        </p>
      </Modal>
    </div>
  );
}
