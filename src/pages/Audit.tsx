import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fmtDateTime } from "@/lib/format";
import { useHosts } from "@/lib/data";
import { Empty, PageHead, Panel, SearchInput, Skeleton, Td, Th } from "@/components/admin";

interface Row { id: number; actor: string | null; action: string; target: string; detail: Record<string, unknown>; created_at: string }

export default function Audit() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");
  const { hosts } = useHosts();
  useEffect(() => { supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(500).then(({ data }) => setRows((data as Row[]) || [])); }, []);
  const name = useMemo(() => new Map((hosts || []).map((h) => [h.id, h.name || h.email])), [hosts]);
  const list = (rows || []).filter((r) => !q.trim() || `${r.action} ${r.target} ${name.get(r.target) || ""} ${name.get(r.actor || "") || ""} ${JSON.stringify(r.detail)}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div>
      <PageHead title="Audit log" subtitle="Every admin action, newest first. Nobody can edit or delete these." actions={<SearchInput value={q} onChange={setQ} placeholder="Action, person, detail" />} />
      <Panel pad={false}>
        {rows === null ? <Skeleton /> : !list.length ? <Empty icon="shield" title="Nothing logged yet" /> : (
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead><tr><Th>When</Th><Th>Who</Th><Th>Action</Th><Th>On</Th><Th>Detail</Th></tr></thead>
              <tbody>{list.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <Td className="whitespace-nowrap text-ink-muted">{fmtDateTime(r.created_at)}</Td>
                  <Td>{name.get(r.actor || "") || "System"}</Td>
                  <Td className="font-semibold">{r.action.replace(/_/g, " ")}</Td>
                  <Td>{name.get(r.target) || <span className="font-mono text-xs">{r.target}</span>}</Td>
                  <Td><code className="break-all text-xs text-ink-muted">{JSON.stringify(r.detail)}</code></Td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
