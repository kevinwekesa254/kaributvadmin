import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { BrowserRouter, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AdminGate, SetPassword, useAdmin, type Area } from "@/lib/auth";
import { HOST_APP, supabase } from "@/lib/supabase";
import { ToastProvider } from "@/lib/toast";
import { Logo } from "@/components/Logo";
import { Icon } from "@/components/Icons";
import { PageLoader } from "@/components/ui";

const Home = lazy(() => import("@/pages/Home"));
const Pipeline = lazy(() => import("@/pages/Pipeline"));
const Hosts = lazy(() => import("@/pages/Hosts"));
const HostDetail = lazy(() => import("@/pages/HostDetail"));
const Tickets = lazy(() => import("@/pages/Tickets"));
const Billing = lazy(() => import("@/pages/Billing"));
const Packages = lazy(() => import("@/pages/Packages"));
const Orders = lazy(() => import("@/pages/Orders"));
const Products = lazy(() => import("@/pages/Products"));
const Delivery = lazy(() => import("@/pages/Delivery"));
const Fleet = lazy(() => import("@/pages/Fleet"));
const Messages = lazy(() => import("@/pages/Messages"));
const Emails = lazy(() => import("@/pages/Emails"));
const Team = lazy(() => import("@/pages/Team"));
const Audit = lazy(() => import("@/pages/Audit"));
const Settings = lazy(() => import("@/pages/Settings"));

interface NavItem { to: string; label: string; icon: string; area?: Area; end?: boolean; badge?: "tickets" | "orders" | "leads" }
const NAV: { group: string; items: NavItem[] }[] = [
  { group: "", items: [{ to: "/", label: "Home", icon: "home", end: true }] },
  { group: "Customers", items: [
    { to: "/pipeline", label: "Pipeline", icon: "chart", area: "sales", badge: "leads" },
    { to: "/hosts", label: "Hosts", icon: "users", area: "hosts" },
    { to: "/tickets", label: "Support", icon: "help", area: "support", badge: "tickets" },
  ] },
  { group: "Revenue", items: [
    { to: "/billing", label: "Billing", icon: "card", area: "billing" },
    { to: "/packages", label: "Packages & coupons", icon: "crown", area: "billing" },
  ] },
  { group: "Shop", items: [
    { to: "/orders", label: "Orders", icon: "bag", area: "shop", badge: "orders" },
    { to: "/products", label: "Products", icon: "box", area: "shop" },
    { to: "/delivery", label: "Delivery", icon: "truck", area: "shop" },
  ] },
  { group: "Operations", items: [
    { to: "/fleet", label: "TV fleet", icon: "tv-signal", area: "ops" },
    { to: "/messages", label: "Messages", icon: "megaphone", area: "ops" },
    { to: "/emails", label: "Emails", icon: "mail", area: "ops" },
  ] },
  { group: "Admin", items: [
    { to: "/team", label: "Team", icon: "admin", area: "team" },
    { to: "/audit", label: "Audit log", icon: "shield", area: "team" },
    { to: "/settings", label: "Settings", icon: "settings", area: "settings" },
  ] },
];

function useBadges() {
  const [b, setB] = useState<Record<string, number>>({});
  useEffect(() => {
    const load = () => supabase.rpc("admin_stats").then(({ data }) => {
      const s = (data || {}) as Record<string, number>;
      setB({ tickets: s.tickets_open || 0, orders: s.orders_open || 0, leads: s.leads_open || 0 });
    });
    load();
    const ch = supabase.channel("admin-badges")
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, load)
      .subscribe();
    const t = window.setInterval(load, 60_000);
    return () => { supabase.removeChannel(ch); window.clearInterval(t); };
  }, []);
  return b;
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { can, me, signOut } = useAdmin();
  const badges = useBadges();
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-navy/40 lg:hidden" onClick={onClose} />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-navy text-bone transition-transform duration-300 lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="kb-kikoi kb-kikoi--thin" />
        <div className="flex items-center justify-between px-5 py-5"><Logo to="/" light size={28} /><span className="rounded-full bg-maroon px-2 py-0.5 text-[10px] font-bold tracking-[0.14em] text-white">ADMIN</span></div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4" aria-label="Admin">
          {NAV.map((g) => {
            const items = g.items.filter((i) => !i.area || can(i.area));
            if (!items.length) return null;
            return (
              <div key={g.group || "main"}>
                {g.group && <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-bone/40">{g.group}</p>}
                <div className="space-y-0.5">
                  {items.map((n) => (
                    <NavLink key={n.to} to={n.to} end={n.end} onClick={onClose}
                      className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 text-[0.9rem] font-medium transition-colors ${isActive ? "bg-white/[0.12] text-white" : "text-bone/70 hover:bg-white/[0.06] hover:text-bone"}`}>
                      {({ isActive }) => (<>
                        <span className={`flex h-7 w-7 items-center justify-center rounded-md ${isActive ? "bg-maroon text-white" : ""}`}><Icon name={n.icon} size={15} /></span>
                        <span className="flex-1">{n.label}</span>
                        {n.badge && badges[n.badge] > 0 && <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold tabular-nums">{badges[n.badge]}</span>}
                      </>)}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-maroon font-display font-semibold text-white">{(me?.name || me?.email || "A")[0].toUpperCase()}</span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{me?.name || me?.email}</p><p className="text-xs capitalize text-bone/50">{me?.admin_role}</p></div>
            <button onClick={signOut} className="rounded-full p-2 text-bone/60 hover:bg-white/10 hover:text-bone" aria-label="Sign out"><Icon name="logout" size={16} /></button>
          </div>
        </div>
      </aside>
    </>
  );
}

/** ⌘K: jump to any page or find a host, order or ticket by name, email or number. */
function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hosts, setHosts] = useState<{ id: string; name: string; email: string }[]>([]);
  const [idx, setIdx] = useState(0);
  const nav = useNavigate();
  const { can } = useAdmin();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); } if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", k);
    const o = () => setOpen(true);
    window.addEventListener("kb-palette", o);
    return () => { window.removeEventListener("keydown", k); window.removeEventListener("kb-palette", o); };
  }, []);
  useEffect(() => {
    if (!open) return;
    setQ(""); setIdx(0); setTimeout(() => input.current?.focus(), 10);
    if (!hosts.length) supabase.rpc("admin_hosts").then(({ data }) => setHosts(((data as { id: string; name: string; email: string }[]) || [])));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const items = useMemo(() => {
    const t = q.trim().toLowerCase();
    const pages = NAV.flatMap((g) => g.items).filter((i) => !i.area || can(i.area)).map((i) => ({ label: i.label, hint: "Page", icon: i.icon, to: i.to }));
    const hs = hosts.map((h) => ({ label: h.name || h.email, hint: h.email, icon: "user", to: `/hosts/${h.id}` }));
    const num = /^#?\d{4,6}$/.test(t) ? [{ label: `Order #${t.replace("#", "")}`, hint: "Find order", icon: "bag", to: `/orders?q=${t.replace("#", "")}` }, { label: `Ticket #${t.replace("#", "")}`, hint: "Find ticket", icon: "help", to: `/tickets?q=${t.replace("#", "")}` }] : [];
    const all = [...num, ...pages, ...hs];
    return (t ? all.filter((i) => `${i.label} ${i.hint}`.toLowerCase().includes(t) || i.hint.startsWith("Find")) : pages).slice(0, 9);
  }, [q, hosts, can]);
  if (!open) return null;
  const go = (to: string) => { setOpen(false); nav(to); };
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-navy/40 p-4 pt-[12vh]" onClick={() => setOpen(false)}>
      <div className="kb-enter w-full max-w-xl overflow-hidden rounded-[18px] bg-surface shadow-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Search">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Icon name="search" size={16} className="text-ink-muted" />
          <input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); }} placeholder="Search hosts, pages, order or ticket number…"
            onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(items.length - 1, i + 1)); } if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); } if (e.key === "Enter" && items[idx]) go(items[idx].to); }}
            className="h-14 flex-1 bg-transparent text-[0.95rem] outline-none" aria-label="Search" />
          <kbd className="rounded border border-line px-1.5 text-[11px] text-ink-muted">esc</kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto p-2">
          {items.map((i, n) => (
            <li key={`${i.to}${n}`}>
              <button onMouseEnter={() => setIdx(n)} onClick={() => go(i.to)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left ${idx === n ? "bg-surface-wash" : ""}`}>
                <Icon name={i.icon} size={15} className="text-maroon" /><span className="flex-1 truncate font-medium">{i.label}</span><span className="truncate text-xs text-ink-muted">{i.hint}</span>
              </button>
            </li>
          ))}
          {!items.length && <li className="px-3 py-6 text-center text-sm text-ink-muted">Nothing found.</li>}
        </ul>
      </div>
    </div>
  );
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const loc = useLocation();
  const title = NAV.flatMap((g) => g.items).find((i) => (i.end ? loc.pathname === i.to : loc.pathname.startsWith(i.to)))?.label || "Admin";
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-surface-wash/85 px-4 backdrop-blur sm:px-8">
      <button onClick={onMenu} className="rounded-full p-2 lg:hidden" aria-label="Menu"><Icon name="menu" /></button>
      <p className="font-semibold text-ink-muted lg:hidden">{title}</p>
      <button onClick={() => window.dispatchEvent(new Event("kb-palette"))} className="ml-auto flex h-10 w-full max-w-sm items-center gap-3 rounded-full border border-line bg-surface px-4 text-sm text-ink-muted hover:border-line-strong sm:ml-0">
        <Icon name="search" size={15} /><span className="flex-1 text-left">Search hosts, orders, tickets…</span><kbd className="hidden rounded border border-line px-1.5 text-[11px] sm:inline">⌘K</kbd>
      </button>
      <a href={HOST_APP} target="_blank" rel="noreferrer" className="ml-auto hidden items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-ink-muted hover:bg-surface sm:flex"><Icon name="globe" size={15} />Host site</a>
    </header>
  );
}

function Guard({ area, children }: { area: Area; children: JSX.Element }) {
  const { can } = useAdmin();
  return can(area) ? children : <Navigate to="/" replace />;
}

function Shell() {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-[100dvh]">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="lg:pl-64">
        <TopBar onMenu={() => setOpen(true)} />
        <main className="px-4 py-6 sm:px-8 sm:py-8">
          <div className="kb-enter mx-auto max-w-7xl">
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route index element={<Home />} />
                <Route path="pipeline" element={<Guard area="sales"><Pipeline /></Guard>} />
                <Route path="hosts" element={<Guard area="hosts"><Hosts /></Guard>} />
                <Route path="hosts/:id" element={<Guard area="hosts"><HostDetail /></Guard>} />
                <Route path="tickets" element={<Guard area="support"><Tickets /></Guard>} />
                <Route path="tickets/:id" element={<Guard area="support"><Tickets /></Guard>} />
                <Route path="billing" element={<Guard area="billing"><Billing /></Guard>} />
                <Route path="packages" element={<Guard area="billing"><Packages /></Guard>} />
                <Route path="orders" element={<Guard area="shop"><Orders /></Guard>} />
                <Route path="products" element={<Guard area="shop"><Products /></Guard>} />
                <Route path="delivery" element={<Guard area="shop"><Delivery /></Guard>} />
                <Route path="fleet" element={<Guard area="ops"><Fleet /></Guard>} />
                <Route path="messages" element={<Guard area="ops"><Messages /></Guard>} />
                <Route path="emails" element={<Guard area="ops"><Emails /></Guard>} />
                <Route path="team" element={<Guard area="team"><Team /></Guard>} />
                <Route path="audit" element={<Guard area="team"><Audit /></Guard>} />
                <Route path="settings" element={<Guard area="settings"><Settings /></Guard>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </div>
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route path="/set-password" element={<SetPassword />} />
          <Route path="/*" element={<AdminGate><Shell /></AdminGate>} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}
