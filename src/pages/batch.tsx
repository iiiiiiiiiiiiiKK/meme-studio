import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import {
  AlertTriangle,
  Download,
  FileArchive,
  FolderOpen,
  Layers,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Square,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useUi } from '../state/ui';
import { useLibrary } from '../state/library';
import { CUT_MODES, DEFAULT_OUTLINE, type BatchItem, type CutMode, type OutlineSettings } from '../types';
import { detectAll, personAlpha } from '../lib/ai';
import { runCutout } from '../lib/cutout';
import { canvasToBlob, decodeToCanvas, downloadBlob, formatBytes, makeThumbnail, sanitizeFilename, timestampSlug } from '../lib/image';
import { ColorField, Segmented, Slider, Toggle, Spinner, EmptyState, ProgressBar } from '../components/ui';

type RunState = 'idle' | 'running' | 'paused' | 'cancelled' | 'done';

export function BatchPage() {
  const { toast } = useUi();
  const [items, setItems] = useState<BatchItem[]>([]);
  const [runState, setRunState] = useState<RunState>('idle');
  const [mode, setMode] = useState<CutMode>('head');
  const [outline, setOutline] = useState<OutlineSettings>({ ...DEFAULT_OUTLINE, thickness: 12 });
  const [size, setSize] = useState(0);
  const [format, setFormat] = useState<'png' | 'jpeg'>('png');
  const [naming, setNaming] = useState('{name}-{mode}');
  const [autoSave, setAutoSave] = useState(false);
  const [concurrency, setConcurrency] = useState(1);
  const cancelRef = useRef(false);
  const pauseRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  const pending = items.filter((i) => i.status === 'queued');
  const done = items.filter((i) => i.status === 'done');
  const failed = items.filter((i) => i.status === 'failed');
  const progress = items.length ? (done.length + failed.length) / items.length : 0;

  const addFiles = useCallback(
    (files: FileList | File[] | null) => {
      if (!files) return;
      const list = [...files].filter((file) => file.type.startsWith('image/'));
      if (!list.length) {
        toast('No images in that selection.', 'info');
        return;
      }
      const next: BatchItem[] = list.map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        name: file.name,
        status: 'queued',
      }));
      setItems((prev) => [...prev, ...next]);
      toast(`${list.length} image${list.length === 1 ? '' : 's'} queued.`, 'success');
    },
    [toast],
  );

  const processOne = useCallback(
    async (item: BatchItem): Promise<void> => {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: 'working', error: undefined } : i)));
      try {
        const canvas = await decodeToCanvas(item.file, 1600);
        let faces: Awaited<ReturnType<typeof detectAll>>['faces'] = [];
        let alpha: Uint8ClampedArray;
        const needsFace = mode !== 'background' && mode !== 'full';
        if (needsFace) {
          const detect = await detectAll(canvas);
          faces = detect.faces;
        }
        const matte = await personAlpha(canvas);
        alpha = matte.alpha;

        const cut = runCutout({
          source: canvas,
          personAlpha: alpha,
          faces,
          options: { mode, faceIndex: 0, feather: 0.6, expand: 0, edgeSmooth: 0.4, outline },
        });

        let output = cut.canvas;
        if (size > 0) {
          const maxSide = size;
          const scale = Math.min(1, maxSide / Math.max(output.width, output.height));
          const scaled = document.createElement('canvas');
          scaled.width = Math.max(1, Math.round(output.width * scale));
          scaled.height = Math.max(1, Math.round(output.height * scale));
          const ctx = scaled.getContext('2d');
          if (ctx) {
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(output, 0, 0, scaled.width, scaled.height);
            output = scaled;
          }
        }

        const mime = format === 'png' ? 'image/png' : 'image/jpeg';
        const blob = await canvasToBlob(
          output,
          mime,
          format === 'png' ? undefined : 0.92,
        );
        const thumb = await makeThumbnail(output, 320);
        const previewUrl = URL.createObjectURL(thumb);

        if (autoSave) {
          await useLibrary.getState().addAsset({
            blob,
            name: renderName(item.name, mode),
            kind: 'cutout',
            width: output.width,
            height: output.height,
            tags: ['batch', mode],
            source: 'batch studio',
            mode,
            hasAlpha: format === 'png',
          });
        }

        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  status: 'done',
                  result: { blob, width: output.width, height: output.height, thumb },
                  previewUrl,
                }
              : i,
          ),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: 'failed', error: message } : i)));
      }
    },
    [autoSave, format, mode, outline, size],
  );

  const runQueue = useCallback(async () => {
    if (runState === 'running') return;
    cancelRef.current = false;
    pauseRef.current = false;
    setRunState('running');
    const queue = items.filter((i) => i.status === 'queued' || i.status === 'failed');
    if (!queue.length) {
      setRunState('idle');
      toast('Nothing queued. Add images first.', 'info');
      return;
    }
    const workers = Math.max(1, Math.min(concurrency, 4));
    let cursor = 0;
    const next = async (): Promise<void> => {
      while (cursor < queue.length) {
        if (cancelRef.current) return;
        while (pauseRef.current) {
          await new Promise((r) => setTimeout(r, 250));
          if (cancelRef.current) return;
        }
        const item = queue[cursor++];
        await processOne(item);
      }
    };
    await Promise.all(Array.from({ length: workers }, () => next()));
    if (cancelRef.current) setRunState('cancelled');
    else {
      setRunState('done');
      toast('Batch finished. Check the failed items if any.', 'success');
    }
  }, [concurrency, items, processOne, runState, toast]);

  function pause() {
    pauseRef.current = true;
    setRunState('paused');
  }

  function resume() {
    pauseRef.current = false;
    setRunState('running');
  }

  function cancel() {
    cancelRef.current = true;
    pauseRef.current = false;
    setRunState('cancelled');
  }

  function retryFailed() {
    setItems((prev) => prev.map((i) => (i.status === 'failed' ? { ...i, status: 'queued', error: undefined } : i)));
    setTimeout(() => void runQueue(), 50);
  }

  async function exportAll(selectedOnly: boolean): Promise<void> {
    const list = items.filter((i) => i.result && i.status === 'done');
    const selection = list;
    if (!selection.length) {
      toast('Nothing has been processed yet.', 'info');
      return;
    }
    void selectedOnly;
    const zip = new JSZip();
    for (const item of selection) {
      if (!item.result) continue;
      const ext = format === 'png' ? 'png' : 'jpg';
      zip.file(`${sanitizeFilename(renderName(item.name, mode))}.${ext}`, item.result.blob);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(blob, `meme-studio-batch-${timestampSlug()}.zip`);
    toast(`ZIP exported · ${formatBytes(blob.size)} · ${selection.length} files`, 'success');
  }

  function renderName(name: string, cutMode: CutMode): string {
    return naming
      .replace('{name}', name.replace(/\.[^.]+$/, ''))
      .replace('{mode}', cutMode)
      .replace('{date}', timestampSlug());
  }

  useEffect(() => {
    return () => {
      items.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, [items]);

  const stats = useMemo(
    () => ({
      total: items.length,
      queued: items.filter((i) => i.status === 'queued').length,
      working: items.filter((i) => i.status === 'working').length,
      done: done.length,
      failed: failed.length,
    }),
    [items, done.length, failed.length],
  );

  return (
    <div className="mx-auto w-full max-w-[1180px] px-3 pb-24 pt-4 sm:px-6 sm:pb-10 sm:pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Batch Studio</h1>
          <p className="mt-1 max-w-2xl text-[12px] text-[var(--text-dim)]">
            Queue dozens of photos, apply the same cut mode and outline, then export everything as one ZIP. A single
            failure never stops the batch.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="chip">{stats.total} files</span>
          {stats.working > 0 ? <span className="chip chip-active">{stats.working} working</span> : null}
          {stats.failed > 0 ? (
            <span className="chip" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>
              {stats.failed} failed
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-3">
          <div
            className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--panel)] px-4 py-5"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              addFiles(e.dataTransfer.files);
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--panel-2)] text-[var(--accent)]">
                  <Upload size={16} />
                </span>
                <div>
                  <p className="text-[12px] font-medium">Drop images here</p>
                  <p className="text-[10px] text-[var(--text-faint)]">Multi-file and folder import · processed one by one</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" className="btn h-8 text-[11px]" onClick={() => inputRef.current?.click()}>
                  <Plus size={12} /> Files
                </button>
                <button type="button" className="btn h-8 text-[11px]" onClick={() => folderRef.current?.click()}>
                  <FolderOpen size={12} /> Folder
                </button>
                <button type="button" className="btn h-8 text-[11px]" onClick={() => { setItems([]); setRunState('idle'); }} disabled={!items.length}>
                  <Trash2 size={12} /> Clear
                </button>
              </div>
            </div>
          </div>

          {items.length === 0 ? (
            <EmptyState
              icon={<Layers size={22} />}
              title="No images queued"
              body="Add a folder of photos and each one will be cut, outlined and exported with the same settings."
            />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2">
                <div className="flex gap-1">
                  {runState === 'running' ? (
                    <>
                      <button type="button" className="btn h-8 text-[11px]" onClick={pause}>
                        <Pause size={12} /> Pause
                      </button>
                      <button type="button" className="btn-danger h-8 text-[11px]" onClick={cancel}>
                        <Square size={12} /> Cancel
                      </button>
                    </>
                  ) : runState === 'paused' ? (
                    <>
                      <button type="button" className="btn-primary h-8 text-[11px]" onClick={resume}>
                        <Play size={12} /> Resume
                      </button>
                      <button type="button" className="btn-danger h-8 text-[11px]" onClick={cancel}>
                        <Square size={12} /> Cancel
                      </button>
                    </>
                  ) : (
                    <button type="button" className="btn-primary h-8 text-[11px]" onClick={() => void runQueue()} disabled={!pending.length && !failed.length}>
                      <Play size={12} /> Start
                    </button>
                  )}
                  {failed.length ? (
                    <button type="button" className="btn h-8 text-[11px]" onClick={retryFailed}>
                      <RefreshCw size={12} /> Retry failed
                    </button>
                  ) : null}
                </div>
                <div className="ml-auto flex gap-1.5">
                  <button type="button" className="btn h-8 text-[11px]" onClick={() => void exportAll(false)} disabled={!done.length}>
                    <FileArchive size={12} /> Export ZIP
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
                <ProgressBar
                  value={progress}
                  label={`${done.length} done · ${stats.working} working · ${stats.queued} queued · ${stats.failed} failed`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                {items.map((item) => (
                  <div key={item.id} className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--panel)]">
                    <div className="checker-sm relative flex aspect-square items-center justify-center">
                      {item.previewUrl ? (
                        <img src={item.previewUrl} alt={item.name} className="h-full w-full object-contain" loading="lazy" />
                      ) : (
                        <span className="text-[10px] text-[var(--text-faint)]">
                          {item.status === 'working' ? <Spinner size={16} /> : item.status === 'failed' ? <AlertTriangle size={16} style={{ color: 'var(--danger)' }} /> : 'Queued'}
                        </span>
                      )}
                      <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[9px] capitalize text-white">
                        {item.status}
                      </span>
                    </div>
                    <div className="p-1.5">
                      <p className="truncate text-[10px]" title={item.name}>
                        {item.name}
                      </p>
                      {item.error ? (
                        <p className="mt-0.5 line-clamp-2 text-[9px]" style={{ color: 'var(--danger)' }} title={item.error}>
                          {item.error}
                        </p>
                      ) : null}
                      {item.result ? (
                        <div className="mt-1 flex items-center gap-1">
                          <button
                            type="button"
                            className="btn h-7 flex-1 px-1 text-[10px]"
                            onClick={() => downloadBlob(item.result!.blob, `${renderName(item.name, mode)}.${format === 'png' ? 'png' : 'jpg'}`)}
                          >
                            <Download size={10} /> Save
                          </button>
                          <button
                            type="button"
                            className="icon-btn h-7 w-7"
                            onClick={() => {
                              setItems((prev) => prev.filter((i) => i.id !== item.id));
                              if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
                            }}
                            aria-label="Remove from queue"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="mt-1 flex w-full items-center justify-center gap-1 text-[9px] text-[var(--text-faint)] hover:text-[var(--danger)]"
                          onClick={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}
                        >
                          <Trash2 size={9} /> Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <aside className="space-y-3">
          <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
            <p className="section-title mb-2">Cut mode</p>
            <select
              className="field text-[12px]"
              value={mode}
              onChange={(e) => setMode(e.target.value as CutMode)}
              aria-label="Batch cut mode"
            >
              {CUT_MODES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--text-faint)]">
              Head modes use the detected face; images without a face fall back to the full person silhouette and the
              item is marked as processed with a warning.
            </p>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
            <p className="section-title mb-1">Outline</p>
            <Toggle checked={outline.enabled} onChange={(enabled) => setOutline({ ...outline, enabled })} label="Apply outline" />
            {outline.enabled ? (
              <>
                <Slider label="Thickness" value={outline.thickness} min={0} max={48} unit="px" onChange={(thickness) => setOutline({ ...outline, thickness })} />
                <ColorField label="Color" value={outline.color} onChange={(color) => setOutline({ ...outline, color })} />
                <Slider
                  label="Second outline"
                  value={outline.layers === 2 ? outline.secondThickness : 0}
                  min={0}
                  max={32}
                  unit="px"
                  onChange={(v) => setOutline({ ...outline, layers: v > 0 ? 2 : 1, secondThickness: v })}
                />
                {outline.layers === 2 ? <ColorField label="Outer" value={outline.secondColor} onChange={(secondColor) => setOutline({ ...outline, secondColor })} /> : null}
                <Toggle checked={outline.shadow} onChange={(shadow) => setOutline({ ...outline, shadow })} label="Shadow" />
              </>
            ) : null}
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
            <p className="section-title mb-2">Output</p>
            <div className="mb-2">
              <span className="label">Format</span>
              <Segmented
                size="sm"
                value={format}
                onChange={(value) => setFormat(value as 'png' | 'jpeg')}
                options={[
                  { value: 'png', label: 'PNG (alpha)' },
                  { value: 'jpeg', label: 'JPEG' },
                ]}
              />
            </div>
            <Segmented
              size="sm"
              value={String(size)}
              onChange={(value) => setSize(Number(value))}
              options={[
                { value: '0', label: 'Original' },
                { value: '512', label: '512' },
                { value: '1024', label: '1024' },
              ]}
            />
            <div className="mt-2">
              <span className="label">File naming</span>
              <input
                className="field text-[12px]"
                value={naming}
                onChange={(e) => setNaming(e.target.value)}
                aria-label="File naming pattern"
              />
              <p className="mt-1 text-[10px] text-[var(--text-faint)]">
                Tokens: <code className="font-mono">{'{name}'}</code> <code className="font-mono">{'{mode}'}</code>{' '}
                <code className="font-mono">{'{date}'}</code>
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
            <p className="section-title mb-1">Local resources</p>
            <Slider label="Parallel workers" value={concurrency} min={1} max={4} onChange={setConcurrency} />
            <p className="text-[10px] leading-relaxed text-[var(--text-faint)]">
              Each worker holds a decoded frame plus the matte. On low-memory phones keep this at 1.
            </p>
            <div className="mt-1 border-t border-[var(--line)] pt-1">
              <Toggle
                checked={autoSave}
                onChange={setAutoSave}
                label="Also save to My Space"
                hint="Stores every successful output locally."
              />
            </div>
          </div>
        </aside>
      </div>

      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
      <input
        ref={folderRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => addFiles(e.target.files)}
        {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
      />
    </div>
  );
}
