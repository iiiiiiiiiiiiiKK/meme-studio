import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, Check, Info, Loader2, X } from 'lucide-react';

export function Spinner({ size = 16 }: { size?: number }) {
  return <Loader2 size={size} className="spin" aria-hidden />;
}

export function SectionHeader({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-[var(--text-dim)]">{title}</h2>
        {hint ? <p className="mt-1 text-xs text-[var(--text-faint)]">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 py-1.5">
      <span className="min-w-0">
        <span className="block text-sm text-[var(--text)]">{label}</span>
        {hint ? <span className="mt-0.5 block text-[11px] leading-snug text-[var(--text-faint)]">{hint}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full border transition-colors"
        style={{
          background: checked ? 'var(--accent)' : 'var(--panel-3)',
          borderColor: checked ? 'var(--accent)' : 'var(--line)',
          opacity: disabled ? 0.4 : 1,
        }}
      >
        <span
          className="absolute top-0.5 h-3.5 w-3.5 rounded-full bg-[var(--panel)] transition-all"
          style={{ left: checked ? 18 : 3, background: checked ? 'var(--accent-ink)' : 'var(--text-faint)' }}
        />
      </button>
    </label>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="py-1.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm text-[var(--text)]">{label}</span>
        <span className="font-mono text-[11px] text-[var(--text-dim)]">
          {value}
          {unit ?? ''}
        </span>
      </div>
      <input
        type="range"
        className="w-full"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-[var(--text)]">{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="text"
          className="field w-20 px-2 py-1 text-center font-mono text-[11px] uppercase"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label} hex value`}
        />
        <input
          type="color"
          className="h-8 w-9"
          value={value}
          aria-label={label}
          onChange={(e) => onChange(e.target.value)}
        />
      </span>
    </label>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = 460,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={ref}
        className="fade-in relative w-full rounded-t-2xl border border-[var(--line)] bg-[var(--panel)] shadow-2xl sm:rounded-2xl"
        style={{ maxWidth: width, maxHeight: '90vh', overflow: 'auto' }}
      >
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="px-4 py-3">{children}</div>
        {footer ? <div className="flex justify-end gap-2 border-t border-[var(--line)] px-4 py-3">{footer}</div> : null}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--line)] px-6 py-14 text-center">
      {icon ? <div className="text-[var(--text-faint)]">{icon}</div> : null}
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-[var(--text-faint)]">{body}</p>
      </div>
      {action}
    </div>
  );
}

export function StatusPill({
  tone,
  children,
}: {
  tone: 'ok' | 'warn' | 'error' | 'neutral';
  children: ReactNode;
}) {
  const color =
    tone === 'ok' ? 'var(--ok)' : tone === 'warn' ? 'var(--warn)' : tone === 'error' ? 'var(--danger)' : 'var(--text-faint)';
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium"
      style={{ color, borderColor: `color-mix(in srgb, ${color} 40%, transparent)`, background: `color-mix(in srgb, ${color} 10%, transparent)` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {children}
    </span>
  );
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  return (
    <div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--panel-3)]">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(100, Math.max(0, value * 100))}%`, background: 'var(--accent)' }}
        />
      </div>
      {label ? <p className="mt-1 text-[11px] text-[var(--text-faint)]">{label}</p> : null}
    </div>
  );
}

export function Toasts() {
  const [items, setItems] = useState<{ id: string; message: string; kind: string; detail?: string }[]>([]);
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as { id: string; message: string; kind: string; detail?: string };
      setItems((prev) => [...prev, detail]);
    };
    window.addEventListener('meme-studio:toast', handler);
    return () => window.removeEventListener('meme-studio:toast', handler);
  }, []);
  return null;
  void items;
  void setItems;
}

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: { id: string; message: string; kind: 'info' | 'success' | 'error'; detail?: string }[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="pointer-events-none fixed bottom-20 left-1/2 z-[60] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2 sm:bottom-6 sm:left-auto sm:right-6 sm:translate-x-0">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="fade-in pointer-events-auto flex items-start gap-2.5 rounded-xl border border-[var(--line)] bg-[var(--panel-2)]/95 px-3 py-2.5 shadow-xl backdrop-blur"
          role="status"
        >
          <span className="mt-0.5">
            {t.kind === 'success' ? (
              <Check size={15} style={{ color: 'var(--ok)' }} />
            ) : t.kind === 'error' ? (
              <AlertTriangle size={15} style={{ color: 'var(--danger)' }} />
            ) : (
              <Info size={15} style={{ color: 'var(--text-dim)' }} />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] leading-snug">{t.message}</p>
            {t.detail ? <p className="mt-0.5 break-words text-[11px] text-[var(--text-faint)]">{t.detail}</p> : null}
          </div>
          <button type="button" className="icon-btn h-6 w-6" onClick={() => onDismiss(t.id)} aria-label="Dismiss">
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
}) {
  return (
    <div className="inline-flex rounded-lg border border-[var(--line)] bg-[var(--panel-2)] p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className="rounded-md font-medium transition-colors"
          style={{
            padding: size === 'sm' ? '4px 9px' : '6px 12px',
            fontSize: size === 'sm' ? 11 : 12,
            background: value === option.value ? 'var(--panel-3)' : 'transparent',
            color: value === option.value ? 'var(--text)' : 'var(--text-faint)',
            boxShadow: value === option.value ? 'inset 0 0 0 1px var(--line)' : 'none',
          }}
          aria-pressed={value === option.value}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
