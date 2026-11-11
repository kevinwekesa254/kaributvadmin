import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAdmin } from "@/lib/auth";
import { kes, timeAgo } from "@/lib/format";
import { useHosts } from "@/lib/data";
import { Icon } from "@/components/Icons";
import { DailyBars, Kpi, PageHead, Panel, Pill, Skeleton } from "@/components/admin";

interface Stats {
  hosts: number; hosts_7d: number; pro: number; trials: number; trials_ending_7d: number; paused: number; properties: number;
  tvs: number; tvs_online: number; leads_open: number; leads_7d: number; tickets_open: number; tickets_pending: number;
  orders_open: number; orders_today: number; revenue_30d: number; shop_30d: number; mrr: number; guide_scans_7d: number;
  signups_30d: { day: string; n: number }[];
}
interface Ticket { id: string; number: number; subject: string; host: string; status: string; priority: string; last_message_at: string; last_author: string }
interface Order { id: string; number: number; name: string; total_kes: number; status: string; created_at: string }
interface Audit { id: number; action: string; target: string; created_at: string }

export default function Home() {
  const { me } = useAdmin();
  const nav = useNavigate();
  const [s, setS] = useState<Stats | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const { hosts } = useHosts();
  useEffect(() => {
    supabase.rpc("admin_stats").then(({ data }) => setS(data as Stats));
    supabase.rpc("admin_tickets").then(({ data }) => setTickets(((data as Ticket[]) || []).filter((t) => t.status === "open").slice(0, 5)));
    supabase.from("orders").select("id, number, name, total_kes, status, created_at").in("status", ["new", "awaiting_payment", "paid"]).order("created_at").limit(5).then(({ data }) => setOrders((data as Order[]) || []));
    supabase.from("audit_log").select("id, action, target, created_at").order("created_at", { ascending: false }).limit(8).then(({ data }) => setAudit((data as Audit[]) || []));
  }, []);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const ending = (hosts || []).filter((h) => h.trial && h.plan_until && Date.parse(h.plan_until) - Date.now() < 7 * 864e5 && Date.parse(h.plan_until) > Date.now()).slice(0, 5);
  const offline = (hosts || []).filter((h) => h.tvs > 0 && h.tvs_online < h.tvs).slice(0, 5);

  return (
    <div>
      <PageHead title={`${greet}, ${(me?.name || "there").split(" ")[0]}`} subtitle="Karibu TV across East Africa, right now." />
      {!s ? <Skeleton rows={4} /> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Monthly recurring revenue" value={kes(s.mrr)} sub={`${s.pro} paying host${s.pro === 1 ? "" : "s"} · ${kes(s.revenue_30d)} collected in 30 days`} icon="card" onClick={() => nav("/billing")} />
            <Kpi label="Hosts" value={s.hosts} sub={`+${s.hosts_7d} this week · ${s.trials} on trial${s.paused ? ` · ${s.paused} paused` : ""}`} icon="users" onClick={() => nav("/hosts")} />
            <Kpi label="TVs online" value={`${s.tvs_online}/${s.tvs}`} sub={`${s.properties} properties · ${s.guide_scans_7d} guide scans this week`} icon="tv-signal" onClick={() => nav("/fleet")} />
            <Kpi label="Shop, last 30 days" value={kes(s.shop_30d)} sub={`${s.orders_open} open order${s.orders_open === 1 ? "" : "s"} · ${s.orders_today} today`} icon="bag" onClick={() => nav("/orders")} />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Kpi label="Tickets waiting for us" value={s.tickets_open} sub={`${s.tickets_pending} waiting for the host`} icon="help" tone={s.tickets_open ? "alert" : undefined} onClick={() => nav("/tickets")} />
            <Kpi label="Open leads" value={s.leads_open} sub={`+${s.leads_7d} this week`} icon="chart" onClick={() => nav("/pipeline")} />
            <Kpi label="Trials ending in 7 days" value={s.trials_ending_7d} sub="Good moment to follow up" icon="clock" onClick={() => nav("/hosts?filter=trial")} />
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <Panel title="New hosts, last 30 days"><DailyBars data={s.signups_30d} label="Sign-ups per day" /></Panel>
            <Panel title="Needs attention" pad={false}>
              <ul className="divide-y divide-line">
                {tickets.map((t) => (
                  <li key={t.id}><Link to={`/tickets/${t.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-wash">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-mint text-maroon"><Icon name="help" size={14} /></span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">#{t.number} {t.subject}</span><span className="block text-xs text-ink-muted">{t.host} · {timeAgo(t.last_message_at)}</span></span>
                    {t.priority === "urgent" || t.priority === "high" ? <Pill tone="red">{t.priority}</Pill> : null}
                  </Link></li>
                ))}
                {orders.map((o) => (
                  <li key={o.id}><Link to={`/orders?open=${o.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-wash">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e8f0fe] text-[#1d4ed8]"><Icon name="bag" size={14} /></span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">Order #{o.number} · {o.name}</span><span className="block text-xs text-ink-muted">{kes(o.total_kes)} · {timeAgo(o.created_at)}</span></span>
                    <Pill tone={o.status === "awaiting_payment" ? "amber" : "blue"}>{o.status.replace("_", " ")}</Pill>
                  </Link></li>
                ))}
                {ending.map((h) => (
                  <li key={h.id}><Link to={`/hosts/${h.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-wash">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fff4e5] text-[#8a4600]"><Icon name="clock" size={14} /></span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{h.name || h.email}: trial ends {timeAgo(h.plan_until).replace(" ago", "")}</span><span className="block text-xs text-ink-muted">{h.tvs} TVs · {h.properties} properties</span></span>
                  </Link></li>
                ))}
                {offline.map((h) => (
                  <li key={`o${h.id}`}><Link to={`/hosts/${h.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-wash">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-danger/10 text-danger"><Icon name="offline" size={14} /></span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{h.name || h.email}: {h.tvs - h.tvs_online} TV offline</span><span className="block text-xs text-ink-muted">{h.tvs_online}/{h.tvs} online</span></span>
                  </Link></li>
                ))}
                {!tickets.length && !orders.length && !ending.length && !offline.length && <li className="px-5 py-10 text-center text-sm text-ink-muted">All clear. Nothing needs you right now.</li>}
              </ul>
            </Panel>
          </div>
          <Panel title="Recent admin activity" className="mt-6" pad={false} action={<Link to="/audit" className="text-sm font-semibold text-maroon">Audit log</Link>}>
            <ul className="divide-y divide-line">
              {audit.map((a) => <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm"><span><b className="font-semibold">{a.action.replace(/_/g, " ")}</b> <span className="text-ink-muted">{a.target}</span></span><span className="text-xs text-ink-muted">{timeAgo(a.created_at)}</span></li>)}
              {!audit.length && <li className="px-5 py-6 text-sm text-ink-muted">No admin actions yet.</li>}
            </ul>
          </Panel>
        </>
      )}
    </div>
  );
}
