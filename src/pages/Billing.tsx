import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase, errorMessage } from "@/lib/supabase";
import { useToast } from "@/lib/toast";
import { fmtDate, kes } from "@/lib/format";
import { useHosts } from "@/lib/data";
import { Button, Field, Input, Modal, Select } from "@/components/ui";
import { Empty, Kpi, PageHead, Pill, SearchInput, Skeleton, Td, Th } from "@/components/admin";

interface Payment { id: string; user_id: string; amount: number; currency: string; tvs: number; months: number; provider: string; provider_ref: string; coupon_code: string | null; status: string; created_at: string }

/** Record an M-Pesa or card payment. The amount is calculated by the database from the package and coupon. */
export function RecordPayment({ open, onClose, onSaved, hostId, defaultTvs = 1 }: { open: boolean; onClose: () => void; onSaved: () => void; hostId?: string; defaultTvs?: number }) {
  const toast = useToast();
  const { hosts } = useHosts();
  const [f, setF] = useState({ host: hostId || "", tvs: String(defaultTvs), months: "1", ref: "", coupon: "", provider: "mpesa" });
  const [preview, setPreview] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setF((x) => ({ ...x, host: hostId || x.host, tvs: String(defaultTvs) })); }, [open, hostId, defaultTvs]);
  useEffect(() => {
    if (!open) return;
    const tvs = Math.max(1, Number(f.tvs) || 1), months = Math.max(1, Number(f.months) || 1);
    Promise.all(Array.from({ length: months }, (_, i) => supabase.rpc("price_quote", { p_tvs: tvs, p_month: i + 1, p_currency: "KES" })))
      .then((rs) => setPreview(rs.reduce((n, r) => n + Number((r.data as { total: number })?.total || 0), 0)));
  }, [open, f.tvs, f.months]);
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("admin_record_payment", { p_user: f.host, p_tvs: Number(f.tvs), p_months: Number(f.months), p_reference: f.ref.trim().toUpperCase(), p_coupon: f.coupon.trim().toUpperCase() || null, p_provider: f.provider });
    setBusy(false);
    if (error) toast(errorMessage(error), "error"); else { toast("Payment recorded. Their Pro plan is extended."); onSaved(); onClose(); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Record a payment"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy} disabled={!f.host || !f.ref.trim()} onClick={save}>Record payment</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        {!hostId && <Field label="Host" className="sm:col-span-2">{(id) => <Select id={id} value={f.host} onChange={(e) => setF({ ...f, host: e.target.value })}><option value="">Choose a host…</option>{(hosts || []).filter((h) => h.role !== "admin").map((h) => <option key={h.id} value={h.id}>{h.name || h.email} ({h.email})</option>)}</Select>}</Field>}
        <Field label="TVs">{(id) => <Input id={id} type="number" min={1} max={500} value={f.tvs} onChange={(e) => setF({ ...f, tvs: e.target.value })} />}</Field>
        <Field label="Months">{(id) => <Select id={id} value={f.months} onChange={(e) => setF({ ...f, months: e.target.value })}>{[1, 2, 3, 6, 12].map((m) => <option key={m} value={m}>{m}</option>)}</Select>}</Field>
        <Field label="Method">{(id) => <Select id={id} value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value })}><option value="mpesa">M-Pesa</option><option value="card">Card</option></Select>}</Field>
        <Field label="M-Pesa code / reference">{(id) => <Input id={id} value={f.ref} onChange={(e) => setF({ ...f, ref: e.target.value })} placeholder="QK12AB34CD" />}</Field>
        <Field label="Coupon" optional className="sm:col-span-2">{(id) => <Input id={id} value={f.coupon} onChange={(e) => setF({ ...f, coupon: e.target.value })} placeholder="e.g. DIANI20" />}</Field>
      </div>
      <div className="mt-5 rounded-md bg-mint-soft p-4 text-sm">
        <p>Amount due{f.coupon ? " (before coupon)" : ""}: <b className="font-display text-lg">{preview === null ? "…" : kes(preview)}</b></p>
        <p className="mt-1 text-xs text-ink-muted">Worked out from the Pro package for a new subscriber. The database applies their real subscription month and any coupon, and rejects amounts that don't match.</p>
      </div>
    </Modal>
  );
}

export default function Billing() {
  const { hosts } = useHosts();
  const [pays, setPays] = useState<Payment[] | null>(null);
  const [q, setQ] = useState("");
  const [rec, setRec] = useState(false);
  const load = () => supabase.from("payments").select("*").order("created_at", { ascending: false }).limit(500).then(({ data }) => setPays((data as Payment[]) || []));
  useEffect(() => { load(); }, []);
  const byId = useMemo(() => new Map((hosts || []).map((h) => [h.id, h])), [hosts]);
  const paid = (pays || []).filter((p) => p.status === "paid" && p.currency === "KES");
  const sum = (days: number) => paid.filter((p) => Date.now() - Date.parse(p.created_at) < days * 864e5).reduce((n, p) => n + Number(p.amount), 0);
  const list = (pays || []).filter((p) => { const h = byId.get(p.user_id); return !q.trim() || `${h?.name} ${h?.email} ${p.provider_ref}`.toLowerCase().includes(q.trim().toLowerCase()); });
  return (
    <div>
      <PageHead title="Billing" subtitle="Every payment, recorded and checked against the price rules." actions={<><SearchInput value={q} onChange={setQ} placeholder="Host or M-Pesa code" /><Button icon="plus" onClick={() => setRec(true)}>Record payment</Button></>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Kpi label="Last 30 days" value={kes(sum(30))} icon="card" />
        <Kpi label="Last 90 days" value={kes(sum(90))} icon="chart" />
        <Kpi label="All time" value={kes(paid.reduce((n, p) => n + Number(p.amount), 0))} sub={`${paid.length} payments`} icon="crown" />
      </div>
      <div className="overflow-hidden rounded-[18px] border border-line bg-surface">
        {pays === null ? <Skeleton /> : !list.length ? <Empty icon="card" title="No payments yet" body="Record M-Pesa payments here until automatic payments are switched on." /> : (
          <div className="max-h-[65vh] overflow-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead><tr><Th>Date</Th><Th>Host</Th><Th>Amount</Th><Th>For</Th><Th>Method</Th><Th>Reference</Th><Th>Status</Th></tr></thead>
              <tbody>{list.map((p) => { const h = byId.get(p.user_id); return (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <Td>{fmtDate(p.created_at)}</Td>
                  <Td>{h ? <Link to={`/hosts/${h.id}`} className="font-semibold hover:text-maroon">{h.name || h.email}</Link> : <span className="text-ink-muted">Deleted host</span>}</Td>
                  <Td className="font-semibold tabular-nums">{p.currency} {Number(p.amount).toLocaleString()}</Td>
                  <Td>{p.tvs} TV{p.tvs > 1 ? "s" : ""} × {p.months} mo{p.coupon_code && <Pill tone="maroon">{p.coupon_code}</Pill>}</Td>
                  <Td className="capitalize">{p.provider}</Td>
                  <Td className="font-mono text-xs">{p.provider_ref || "-"}</Td>
                  <Td><Pill tone={p.status === "paid" ? "green" : p.status === "failed" ? "red" : "gray"}>{p.status}</Pill></Td>
                </tr>
              ); })}</tbody>
            </table>
          </div>
        )}
      </div>
      <RecordPayment open={rec} onClose={() => setRec(false)} onSaved={load} />
    </div>
  );
}
