import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { isOnline, timeAgo } from "@/lib/format";
import { Empty, Kpi, PageHead, Pill, SearchInput, Skeleton, Tabs, Td, Th } from "@/components/admin";

interface Tv { id: string; name: string; app_version: string; last_seen: string | null; opened_at: string | null; property: string; area: string; host_id: string; host: string; screen: string }

export default function Fleet() {
  const [tvs, setTvs] = useState<Tv[] | null>(null);
  const [tab, setTab] = useState<"all" | "offline" | "online">("all");
  const [q, setQ] = useState("");
  useEffect(() => {
    const load = () => supabase.rpc("admin_devices").then(({ data }) => setTvs((data as Tv[]) || []));
    load(); const t = window.setInterval(load, 60_000); return () => window.clearInterval(t);
  }, []);
  const versions = useMemo(() => {
    const m = new Map<string, number>(); for (const t of tvs || []) m.set(t.app_version || "web", (m.get(t.app_version || "web") || 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [tvs]);
  const list = (tvs || []).filter((t) => (tab === "all" || (tab === "online") === isOnline(t.last_seen)) && (!q.trim() || `${t.name} ${t.property} ${t.host} ${t.area}`.toLowerCase().includes(q.trim().toLowerCase())));
  const online = (tvs || []).filter((t) => isOnline(t.last_seen)).length;
  return (
    <div>
      <PageHead title="TV fleet" subtitle="Every paired TV. Online means it checked in during the last 10 minutes." actions={<SearchInput value={q} onChange={setQ} placeholder="TV, property, host, area" />} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Kpi label="Online now" value={`${online}/${tvs?.length ?? 0}`} icon="tv-signal" />
        <Kpi label="Offline" value={(tvs?.length ?? 0) - online} sub="Often a power cut or the TV switched to another input" icon="offline" tone={(tvs?.length ?? 0) - online > 0 ? "alert" : undefined} />
        <Kpi label="App versions" value={versions.length} sub={versions.slice(0, 3).map(([v, n]) => `${v}: ${n}`).join(" · ") || "-"} icon="download" />
      </div>
      <div className="overflow-hidden rounded-[18px] border border-line bg-surface">
        <div className="px-3"><Tabs value={tab} onChange={setTab} items={[{ value: "all", label: "All" }, { value: "offline", label: "Offline" }, { value: "online", label: "Online" }]} /></div>
        {tvs === null ? <Skeleton /> : !list.length ? <Empty icon="tv-signal" title="No TVs here" /> : (
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead><tr><Th>TV</Th><Th>Property</Th><Th>Host</Th><Th>Status</Th><Th>App</Th><Th>Screen</Th><Th>Last opened</Th></tr></thead>
              <tbody>{list.map((t) => (
                <tr key={t.id} className="border-b border-line last:border-0">
                  <Td className="font-semibold">{t.name}</Td><Td>{t.property}<span className="block text-xs text-ink-muted">{t.area}</span></Td>
                  <Td><Link to={`/hosts/${t.host_id}`} className="hover:text-maroon">{t.host}</Link></Td>
                  <Td>{isOnline(t.last_seen) ? <Pill tone="green">Online</Pill> : <Pill tone="red">Offline {timeAgo(t.last_seen)}</Pill>}</Td>
                  <Td className="font-mono text-xs">{t.app_version || "web"}</Td><Td className="text-xs text-ink-muted">{t.screen === "x" ? "-" : t.screen}</Td><Td className="text-ink-muted">{timeAgo(t.opened_at)}</Td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
