import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Database,
  Github,
  Globe,
  Info,
  Languages,
  Monitor,
  Shield,
  Smartphone,
  Trash2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useUi, AUTHOR_X_HANDLE, AUTHOR_X_URL } from '../state/ui';
import { useLibrary } from '../state/library';
import { clearAllData, storageEstimate } from '../lib/db';
import { formatBytes } from '../lib/image';
import { getEngine, getEngineInfo, resetEngine } from '../lib/ai';
import { Segmented, Spinner, StatusPill, Toggle } from '../components/ui';
import { XIcon, GithubIcon } from '../components/brand';

export function SettingsPage() {
  const { theme, setTheme, toast, engineStatus, engineMessage, setEngine } = useUi();
  const library = useLibrary();
  const [usage, setUsage] = useState(library.usage);
  const [info, setInfo] = useState(getEngineInfo());
  const [testing, setTesting] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [language, setLanguage] = useState<'en' | 'zh'>('en');

  useEffect(() => {
    void storageEstimate().then(setUsage);
  }, [library.assets.length]);

  useEffect(() => {
    setInfo(getEngineInfo());
  }, [engineStatus]);

  async function testEngine(): Promise<void> {
    setTesting(true);
    setEngine('loading', 'Downloading and warming up the local models…');
    try {
      const started = performance.now();
      const human = await getEngine();
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const gradient = ctx.createLinearGradient(0, 0, 256, 256);
        gradient.addColorStop(0, '#3a4152');
        gradient.addColorStop(1, '#0c0e13');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 256, 256);
      }
      await human.detect(canvas);
      const infoNow = getEngineInfo();
      setInfo(infoNow);
      const elapsed = Math.round(performance.now() - started);
      setEngine('ready', `Ready · ${infoNow?.backend ?? 'unknown'} · warm-up ${elapsed}ms`);
      toast(`Local engine is ready (${infoNow?.backend ?? 'backend'}) in ${elapsed}ms.`, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setEngine('error', message);
      toast('Engine test failed', 'error', message);
    } finally {
      setTesting(false);
    }
  }

  async function wipe(): Promise<void> {
    await clearAllData();
    await library.load();
    setConfirmWipe(false);
    toast('All local data was deleted from this device.', 'success');
  }

  return (
    <div className="mx-auto w-full max-w-[900px] px-3 pb-24 pt-4 sm:px-6 sm:pb-10 sm:pt-6">
      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Settings</h1>
      <p className="mt-1 text-[12px] text-[var(--text-dim)]">
        Everything on this page affects only this browser profile. There is no account and no server.
      </p>

      <div className="mt-4 space-y-3">
        <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--panel-3)] text-[var(--accent)]">
                <Cpu size={15} />
              </span>
              <div>
                <h2 className="text-[13px] font-semibold">Local AI engine</h2>
                <p className="text-[10px] text-[var(--text-faint)]">RVM matting + FaceMesh, served from this site</p>
              </div>
            </div>
            <StatusPill tone={engineStatus === 'ready' ? 'ok' : engineStatus === 'error' ? 'error' : engineStatus === 'loading' ? 'warn' : 'neutral'}>
              {engineStatus === 'ready' ? 'Ready' : engineStatus === 'loading' ? 'Loading' : engineStatus === 'error' ? 'Error' : 'Not loaded'}
            </StatusPill>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-2.5 py-2">
              <p className="text-[9px] uppercase tracking-wide text-[var(--text-faint)]">Backend</p>
              <p className="font-mono text-[11px]">{info?.backend ?? '—'}</p>
            </div>
            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-2.5 py-2">
              <p className="text-[9px] uppercase tracking-wide text-[var(--text-faint)]">Matte model</p>
              <p className="truncate font-mono text-[11px]" title={info?.segModel ?? ''}>
                {info?.segModel ?? 'RVM · 3.7 MB · MIT'}
              </p>
            </div>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-dim)]">{engineMessage}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <button type="button" className="btn text-[11px]" onClick={() => void testEngine()} disabled={testing}>
              {testing ? <Spinner size={12} /> : <RefreshCw size={12} />} Test engine
            </button>
            <button
              type="button"
              className="btn text-[11px]"
              onClick={() => {
                resetEngine();
                setInfo(null);
                setEngine('idle', 'Engine unloaded. Models remain cached by the browser.');
                toast('Engine state cleared.', 'info');
              }}
            >
              Unload engine
            </button>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-[var(--text-faint)]">
            No API key is required and no image is uploaded. If your browser blocks WebGL, the engine falls back to the
            WASM backend; if both fail, the colour matte is used and clearly labelled in Create.
          </p>
        </section>

        <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--panel-3)] text-[var(--accent)]">
              <Monitor size={15} />
            </span>
            <div>
              <h2 className="text-[13px] font-semibold">Appearance & language</h2>
              <p className="text-[10px] text-[var(--text-faint)]">Dark by default, saved per browser</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[12px]">Theme</span>
            <Segmented
              size="sm"
              value={theme}
              onChange={(value) => setTheme(value as 'dark' | 'light')}
              options={[
                { value: 'dark', label: 'Dark' },
                { value: 'light', label: 'Light' },
              ]}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[12px]">
              <Languages size={12} /> Interface language
            </span>
            <Segmented
              size="sm"
              value={language}
              onChange={(value) => {
                setLanguage(value as 'en' | 'zh');
                toast('This build ships English UI strings only; the switch is stored for the upcoming i18n release.', 'info');
              }}
              options={[
                { value: 'en', label: 'English' },
                { value: 'zh', label: '中文' },
              ]}
            />
          </div>
        </section>

        <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--panel-3)] text-[var(--accent)]">
              <Database size={15} />
            </span>
            <div>
              <h2 className="text-[13px] font-semibold">Local storage</h2>
              <p className="text-[10px] text-[var(--text-faint)]">IndexedDB · this browser only</p>
            </div>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: 'Assets', value: String(library.assets.filter((a) => !a.deleted).length) },
              { label: 'Projects', value: String(library.projects.length) },
              { label: 'Presets', value: String(library.presetsLoaded) },
              { label: 'Used', value: formatBytes(usage.usage) },
            ].map((row) => (
              <div key={row.label} className="rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-2.5 py-2">
                <dt className="text-[9px] uppercase tracking-wide text-[var(--text-faint)]">{row.label}</dt>
                <dd className="font-mono text-[12px]">{row.value}</dd>
              </div>
            ))}
          </dl>
          {usage.quota ? (
            <div className="mt-2">
              <div className="h-1.5 w-full overflow-hidden rounded bg-[var(--panel-3)]">
                <div className="h-full bg-[var(--accent)]" style={{ width: `${Math.min(100, (usage.usage / usage.quota) * 100)}%` }} />
              </div>
              <p className="mt-1 text-[10px] text-[var(--text-faint)]">
                {formatBytes(usage.usage)} of {formatBytes(usage.quota)} browser quota
              </p>
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-1.5">
            <button
              type="button"
              className="btn text-[11px]"
              onClick={async () => {
                const { exportBackup } = await import('../lib/db');
                const summary = await exportBackup();
                toast(
                  `Local data summary: ${summary.assets} assets, ${summary.projects} projects, ${summary.presets} presets.`,
                  'info',
                );
              }}
            >
              <Info size={12} /> Storage report
            </button>
            <button type="button" className="btn-danger text-[11px]" onClick={() => setConfirmWipe(true)}>
              <Trash2 size={12} /> Delete all local data
            </button>
          </div>
          {confirmWipe ? (
            <div className="mt-2 rounded-lg border p-2.5" style={{ borderColor: 'var(--danger)' }}>
              <p className="flex items-start gap-1.5 text-[11px]" style={{ color: 'var(--danger)' }}>
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                This permanently deletes every asset and project stored by Meme Studio in this browser. Export anything
                you want to keep first.
              </p>
              <div className="mt-2 flex gap-1.5">
                <button type="button" className="btn-danger text-[11px]" onClick={() => void wipe()}>
                  Yes, delete everything
                </button>
                <button type="button" className="btn text-[11px]" onClick={() => setConfirmWipe(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--panel-3)] text-[var(--accent)]">
              <Shield size={15} />
            </span>
            <div>
              <h2 className="text-[13px] font-semibold">Privacy & security</h2>
              <p className="text-[10px] text-[var(--text-faint)]">What leaves this device</p>
            </div>
          </div>
          <ul className="mt-3 space-y-1.5 text-[11px] leading-relaxed text-[var(--text-dim)]">
            <li className="flex gap-1.5">
              <CheckCircle2 size={12} className="mt-0.5 shrink-0" style={{ color: 'var(--ok)' }} />
              Images are decoded, cut and exported in this tab. No image bytes are sent anywhere.
            </li>
            <li className="flex gap-1.5">
              <CheckCircle2 size={12} className="mt-0.5 shrink-0" style={{ color: 'var(--ok)' }} />
              There is no analytics script, no tracking pixel and no third-party font request.
            </li>
            <li className="flex gap-1.5">
              <CheckCircle2 size={12} className="mt-0.5 shrink-0" style={{ color: 'var(--ok)' }} />
              The only network requests are for the static app shell and the two model files served by this site.
            </li>
            <li className="flex gap-1.5">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" style={{ color: 'var(--warn)' }} />
              “From URL” import fetches an image directly from your browser — that site will see your IP, exactly like
              opening it in a tab.
            </li>
            <li className="flex gap-1.5">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" style={{ color: 'var(--warn)' }} />
              Clearing site data in your browser settings deletes your library. There is no cloud backup.
            </li>
          </ul>
        </section>

        <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--panel-3)] text-[var(--accent)]">
              <Sparkles size={15} />
            </span>
            <div>
              <h2 className="text-[13px] font-semibold">About</h2>
              <p className="text-[10px] text-[var(--text-faint)]">Meme Studio v1.0.0 · MIT</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <a href={AUTHOR_X_URL} target="_blank" rel="noopener noreferrer" className="btn text-[11px]" data-testid="settings-x-link">
              <XIcon size={12} /> {AUTHOR_X_HANDLE}
            </a>
            <a href="https://github.com/iiiiiiiiiiiiiKK/meme-studio" target="_blank" rel="noopener noreferrer" className="btn text-[11px]">
              <GithubIcon size={12} /> Source
            </a>
            <a
              href="https://github.com/iiiiiiiiiiiiiKK/meme-studio/blob/main/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
              className="btn text-[11px]"
            >
              <Globe size={12} /> License
            </a>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-[var(--text-faint)]">
            Built as a local-first web app: React + Vite + TypeScript, TensorFlow.js with RVM and FaceMesh, IndexedDB via
            idb, and Canvas 2D for compositing. No backend, no database server, no account system.
          </p>
        </section>

        <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:hidden">
          <div className="flex items-center gap-2.5">
            <Smartphone size={15} className="text-[var(--accent)]" />
            <p className="text-[12px] font-medium">Mobile tips</p>
          </div>
          <ul className="mt-2 space-y-1 text-[11px] text-[var(--text-dim)]">
            <li>• Add to home screen for a full-screen, offline-capable app.</li>
            <li>• Batch processing is heavier on phones — keep workers at 1.</li>
            <li>• Long-press an exported PNG to save it to Photos.</li>
          </ul>
        </section>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-[var(--text-faint)]">
        <Github size={11} /> Open source · <XIcon size={9} /> {AUTHOR_X_HANDLE}
      </div>
    </div>
  );
}

export { Github, Toggle };
