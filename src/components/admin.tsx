import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icons";

/** Right-hand panel for details (host, order, lead). Esc or the backdrop closes it. */
export function Drawer({ open, onClose, title, subtitle, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-navy/30 backdrop-blur-[1px]" onClick={onClose} />
      <aside className={`kb-drawer absolute inset-y-0 right-0 flex h-[100dvh] w-full flex-col bg-surface shadow-panel ${wide ? "max-w-2xl" : "max-w-lg"}`}>
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div className="min-w-0"><h2 className="truncate font-display text-xl font-semibold text-navy">{title}</h2>{subtitle && <div className="mt-0.5 text-sm text-ink-muted">{subtitle}</div>}</div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-surface-wash" aria-label="Close"><Icon name="x" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">{children}</div>
        {footer && <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>}
      </aside>
    </div>,
    document.body,
  );
}

const TONES = {
  green: "bg-[#e7f6ec] text-[#16693a]", amber: "bg-[#fff4e5] text-[#8a4600]", red: "bg-danger/10 text-danger",
  maroon: "bg-mint text-maroon", navy: "bg-navy text-white", gray: "bg-line text-ink-muted", blue: "bg-[#e8f0fe] text-[#1d4ed8]",
};
export type Tone = keyof typeof TONES;
export const Pill = ({ tone = "gray", children }: { tone?: Tone; children: ReactNode }) =>
  <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONES[tone]}`}>{children}</span>;

export function Kpi({ label, value, sub, icon, onClick, tone }: { label: string; value: ReactNode; sub?: ReactNode; icon: string; onClick?: () => void; tone?: "alert" }) {
  const C = onClick ? "button" : "div";
  return (
    <C onClick={onClick} className={`group flex flex-col rounded-[18px] border bg-surface p-5 text-left transition-colors ${tone === "alert" ? "border-maroon/40" : "border-line"} ${onClick ? "hover:border-line-strong" : ""}`}>
      <div className="flex items-center justify-between text-ink-muted"><span className="text-sm font-medium">{label}</span><Icon name={icon} size={16} /></div>
      <p className="mt-3 font-display text-[2rem] font-semibold leading-none tabular-nums text-navy">{value}</p>
      {sub && <p className="mt-2 text-xs text-ink-muted">{sub}</p>}
    </C>
  );
}

export function PageHead({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="font-display text-[1.75rem] font-semibold leading-tight text-navy">{title}</h1>{subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}</div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, action, children, className = "", pad = true }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`rounded-[18px] border border-line bg-surface ${className}`}>
      {title && <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5"><h2 className="font-display text-base font-semibold text-navy">{title}</h2>{action}</div>}
      <div className={pad ? "p-5" : ""}>{children}</div>
    </section>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: ReactNode; count?: number }[] }) {
  return (
    <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-line" role="tablist">
      {items.map((t) => (
        <button key={t.value} role="tab" aria-selected={value === t.value} onClick={() => onChange(t.value)}
          className={`relative shrink-0 px-3.5 py-2.5 text-sm font-semibold transition-colors ${value === t.value ? "text-navy" : "text-ink-muted hover:text-ink"}`}>
          {t.label}{t.count !== undefined && <span className="ml-1.5 rounded-full bg-surface-wash px-1.5 text-xs tabular-nums">{t.count}</span>}
          {value === t.value && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-maroon" />}
        </button>
      ))}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative w-full sm:w-72">
      <Icon name="search" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder}
        className="h-10 w-full rounded-full border border-line bg-surface pl-9 pr-4 text-sm outline-none focus:border-maroon" />
    </div>
  );
}

export const Th = ({ children, className = "" }: { children?: ReactNode; className?: string }) =>
  <th className={`sticky top-0 z-[1] border-b border-line bg-surface px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-muted ${className}`}>{children}</th>;
export const Td = ({ children, className = "" }: { children?: ReactNode; className?: string }) => <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>;

export function Empty({ icon, title, body, action }: { icon: string; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-wash text-ink-muted"><Icon name={icon} size={20} /></span>
      <p className="mt-4 font-semibold">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-ink-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Skeleton rows while a table loads. */
export function Skeleton({ rows = 6 }: { rows?: number }) {
  return <div className="space-y-2 p-5">{Array.from({ length: rows }, (_, i) => <div key={i} className="h-10 animate-pulse rounded-md bg-surface-wash" />)}</div>;
}

/**
 * Daily counts as columns. Single series (no legend; the title names it). Bars <= 24px,
 * 4px rounded tops, square at the baseline, 2px gaps. Hover shows the day and count; an sr-only table backs it.
 */
export function DailyBars({ data, label }: { data: { day: string; n: number }[]; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = 150, pad = 4;
  const max = Math.max(1, ...data.map((d) => d.n));
  const slot = (W - pad * 2) / Math.max(1, data.length);
  const bw = Math.min(24, slot - 2);
  const fmt = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const total = data.reduce((n, d) => n + d.n, 0);
  return (
    <div>
      <div className="flex items-baseline justify-between"><p className="text-sm text-ink-muted">{label}</p><p className="font-display text-xl font-semibold tabular-nums">{total}</p></div>
      <div className="relative mt-3">
        <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full" role="img" aria-label={`${label}: ${total} in total`} onMouseLeave={() => setHover(null)}>
          <line x1={0} x2={W} y1={H} y2={H} stroke="var(--line)" strokeWidth={1} />
          {data.map((d, i) => {
            const h = d.n ? Math.max(3, (d.n / max) * (H - 12)) : 0;
            const x = pad + i * slot + (slot - bw) / 2;
            const r = Math.min(4, h / 2, bw / 2);
            const y = H - h;
            const path = h ? `M${x},${H} V${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${H} Z` : "";
            return (
              <g key={d.day} onMouseEnter={() => setHover(i)}>
                <rect x={pad + i * slot} y={0} width={slot} height={H} fill="transparent" />
                {h > 0 && <path d={path} fill="#a3324a" opacity={hover === null || hover === i ? 1 : 0.45} />}
              </g>
            );
          })}
          {[0, data.length - 1].map((i) => data[i] && <text key={i} x={pad + i * slot + slot / 2} y={H + 15} fontSize="11" fill="var(--ink-muted)" textAnchor={i ? "end" : "start"}>{fmt(data[i].day)}</text>)}
        </svg>
        {hover !== null && data[hover] && (
          <div className="pointer-events-none absolute -top-2 rounded-md bg-navy px-2.5 py-1.5 text-xs text-white shadow-panel" style={{ left: `${((pad + hover * slot + slot / 2) / W) * 100}%`, transform: "translate(-50%, -100%)" }}>
            <b className="tabular-nums">{data[hover].n}</b> on {fmt(data[hover].day)}
          </div>
        )}
      </div>
      <table className="sr-only"><caption>{label}</caption><tbody>{data.map((d) => <tr key={d.day}><th>{d.day}</th><td>{d.n}</td></tr>)}</tbody></table>
    </div>
  );
}
