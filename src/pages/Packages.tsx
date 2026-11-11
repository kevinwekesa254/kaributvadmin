import { useEffect, useState } from "react";
import { supabase, errorMessage } from "@/lib/supabase";
import { useToast } from "@/lib/toast";
import { fmtDate, kes } from "@/lib/format";
import { Button, Field, Input, Modal, Toggle } from "@/components/ui";
import { Empty, PageHead, Panel, Pill, Td, Th } from "@/components/admin";

interface Pkg { key: string; name: string; intro_price_kes: number; standard_price_kes: number; intro_price_usd: number; standard_price_usd: number; intro_months: number; bulk_min_tvs: number; bulk_percent: number; trial_days: number; max_properties: number; updated_at: string }
interface Coupon { code: string; percent_off: number; max_redemptions: number | null; redemptions: number; expires_at: string | null; active: boolean; note: string; created_at: string }

function quote(p: Pkg, tvs: number, month: number) {
  const unit = month <= p.intro_months ? p.intro_price_kes : p.standard_price_kes;
  const sub = unit * tvs;
  const off = tvs >= p.bulk_min_tvs ? Math.round((sub * p.bulk_percent) / 100) : 0;
  return sub - off;
}

export default function Packages() {
  const toast = useToast();
  const [p, setP] = useState<Pkg | null>(null);
  const [saved, setSaved] = useState<Pkg | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [busy, setBusy] = useState(false);
  const [newC, setNewC] = useState(false);
  const [c, setC] = useState({ code: "", percent_off: "20", max: "", expires: "", note: "" });
  const load = () => {
    supabase.from("packages").select("*").eq("key", "pro").single().then(({ data }) => { setP(data as Pkg); setSaved(data as Pkg); });
    supabase.from("coupons").select("*").order("created_at", { ascending: false }).then(({ data }) => setCoupons((data as Coupon[]) || []));
  };
  useEffect(load, []);
  if (!p || !saved) return null;
  const dirty = JSON.stringify(p) !== JSON.stringify(saved);
  const num = (k: keyof Pkg) => (e: { target: { value: string } }) => setP({ ...p, [k]: Number(e.target.value) });
  const save = async () => {
    setBusy(true);
    const { key: _k, updated_at: _u, ...patch } = p;
    const { error } = await supabase.from("packages").update(patch).eq("key", "pro");
    setBusy(false);
    if (error) toast(errorMessage(error), "error"); else { toast("Package saved. New prices apply from now; it's logged in the audit log."); load(); }
  };
  const addCoupon = async () => {
    const { error } = await supabase.from("coupons").insert({ code: c.code.trim().toUpperCase(), percent_off: Number(c.percent_off), max_redemptions: c.max ? Number(c.max) : null, expires_at: c.expires ? new Date(c.expires).toISOString() : null, note: c.note.trim() });
    if (error) toast(errorMessage(error).includes("check") ? "Codes are 3-24 letters, numbers, - or _." : errorMessage(error), "error"); else { toast("Coupon created."); setNewC(false); setC({ code: "", percent_off: "20", max: "", expires: "", note: "" }); load(); }
  };
  const toggle = async (code: string, active: boolean) => { await supabase.from("coupons").update({ active }).eq("code", code); load(); };
  return (
    <div>
      <PageHead title="Packages & coupons" subtitle="Change prices and offers. The app, billing and the payment check all read from here." />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Panel title="Pro package" action={<span className="text-xs text-ink-muted">Updated {fmtDate(p.updated_at)}</span>}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Intro price (KES / TV / month)">{(id) => <Input id={id} type="number" min={0} value={p.intro_price_kes} onChange={num("intro_price_kes")} />}</Field>
            <Field label="Standard price (KES / TV / month)">{(id) => <Input id={id} type="number" min={0} value={p.standard_price_kes} onChange={num("standard_price_kes")} />}</Field>
            <Field label="Intro price (USD)">{(id) => <Input id={id} type="number" step="0.01" min={0} value={p.intro_price_usd} onChange={num("intro_price_usd")} />}</Field>
            <Field label="Standard price (USD)">{(id) => <Input id={id} type="number" step="0.01" min={0} value={p.standard_price_usd} onChange={num("standard_price_usd")} />}</Field>
            <Field label="Intro months">{(id) => <Input id={id} type="number" min={0} max={24} value={p.intro_months} onChange={num("intro_months")} />}</Field>
            <Field label="Free trial days for new hosts">{(id) => <Input id={id} type="number" min={0} max={365} value={p.trial_days} onChange={num("trial_days")} />}</Field>
            <Field label="Multi-TV discount from (TVs)">{(id) => <Input id={id} type="number" min={2} value={p.bulk_min_tvs} onChange={num("bulk_min_tvs")} />}</Field>
            <Field label="Multi-TV discount (%)">{(id) => <Input id={id} type="number" min={0} max={90} value={p.bulk_percent} onChange={num("bulk_percent")} />}</Field>
          </div>
          <div className="mt-5 flex items-center justify-between gap-3">
            <p className="text-xs text-ink-muted">Payments already recorded keep the price they were recorded at.</p>
            <Button loading={busy} disabled={!dirty} onClick={save}>Save package</Button>
          </div>
        </Panel>
        <Panel title="What hosts pay">
          <table className="w-full text-sm">
            <thead><tr><Th>TVs</Th><Th>Months 1-{p.intro_months}</Th><Th>After</Th></tr></thead>
            <tbody>{[1, 2, 3, p.bulk_min_tvs, 10, 20].filter((v, i, a) => a.indexOf(v) === i).map((n) => (
              <tr key={n} className="border-b border-line last:border-0"><Td className="font-semibold">{n}{n >= p.bulk_min_tvs && <Pill tone="maroon">-{p.bulk_percent}%</Pill>}</Td><Td className="tabular-nums">{kes(quote(p, n, 1))}</Td><Td className="tabular-nums">{kes(quote(p, n, p.intro_months + 1))}</Td></tr>
            ))}</tbody>
          </table>
          <p className="mt-3 text-xs text-ink-muted">Per month, before coupons. Preview of unsaved changes.</p>
        </Panel>
      </div>
      <Panel title="Coupons" className="mt-6" pad={false} action={<Button size="sm" icon="plus" onClick={() => setNewC(true)}>New coupon</Button>}>
        {!coupons.length ? <Empty icon="crown" title="No coupons yet" body="Create a code to give a percentage off when you record a payment." /> : (
          <table className="w-full text-sm">
            <thead><tr><Th>Code</Th><Th>Off</Th><Th>Used</Th><Th>Expires</Th><Th>Note</Th><Th>Active</Th></tr></thead>
            <tbody>{coupons.map((x) => (
              <tr key={x.code} className="border-b border-line last:border-0">
                <Td className="font-mono font-semibold">{x.code}</Td><Td>{x.percent_off}%</Td>
                <Td className="tabular-nums">{x.redemptions}{x.max_redemptions ? ` / ${x.max_redemptions}` : ""}</Td>
                <Td>{x.expires_at ? fmtDate(x.expires_at) : "Never"}</Td><Td className="text-ink-muted">{x.note || "-"}</Td>
                <Td><Toggle checked={x.active} onChange={(v) => toggle(x.code, v)} label={<span className="sr-only">Active</span>} /></Td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Panel>
      <Modal open={newC} onClose={() => setNewC(false)} title="New coupon"
        footer={<><Button variant="ghost" onClick={() => setNewC(false)}>Cancel</Button><Button disabled={c.code.trim().length < 3} onClick={addCoupon}>Create</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Code">{(id) => <Input id={id} value={c.code} onChange={(e) => setC({ ...c, code: e.target.value.toUpperCase() })} placeholder="DIANI20" />}</Field>
          <Field label="Percent off">{(id) => <Input id={id} type="number" min={1} max={100} value={c.percent_off} onChange={(e) => setC({ ...c, percent_off: e.target.value })} />}</Field>
          <Field label="Max uses" optional>{(id) => <Input id={id} type="number" min={1} value={c.max} onChange={(e) => setC({ ...c, max: e.target.value })} />}</Field>
          <Field label="Expires" optional>{(id) => <Input id={id} type="date" value={c.expires} onChange={(e) => setC({ ...c, expires: e.target.value })} />}</Field>
          <Field label="Note" optional className="sm:col-span-2">{(id) => <Input id={id} value={c.note} onChange={(e) => setC({ ...c, note: e.target.value })} placeholder="e.g. Diani host meetup" />}</Field>
        </div>
      </Modal>
    </div>
  );
}
