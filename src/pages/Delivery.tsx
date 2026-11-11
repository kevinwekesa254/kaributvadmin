import { useEffect, useState } from "react";
import { supabase, errorMessage } from "@/lib/supabase";
import { useToast } from "@/lib/toast";
import { Button, Input, Toggle } from "@/components/ui";
import { PageHead, Panel, Skeleton } from "@/components/admin";

interface Zone { id: string; name: string; areas: string; fee_kes: number; eta: string; setup_available: boolean; setup_fee_kes: number; active: boolean; sort: number }

export default function Delivery() {
  const toast = useToast();
  const [zones, setZones] = useState<Zone[] | null>(null);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const load = () => supabase.from("delivery_zones").select("*").order("sort").then(({ data }) => { setZones((data as Zone[]) || []); setDirty(new Set()); });
  useEffect(() => { load(); }, []);
  const set = (id: string, k: keyof Zone, v: unknown) => { setZones((zs) => zs && zs.map((z) => (z.id === id ? { ...z, [k]: v } : z))); setDirty((d) => new Set(d).add(id)); };
  const save = async () => {
    for (const z of (zones || []).filter((x) => dirty.has(x.id))) {
      const { id, ...row } = z;
      const { error } = await supabase.from("delivery_zones").update({ ...row, fee_kes: Number(row.fee_kes), setup_fee_kes: Number(row.setup_fee_kes) }).eq("id", id);
      if (error) { toast(errorMessage(error), "error"); return; }
    }
    toast("Delivery areas saved."); load();
  };
  const add = async () => {
    const { error } = await supabase.from("delivery_zones").insert({ name: `New area ${Date.now() % 1000}`, areas: "", fee_kes: 500, eta: "Next day", setup_available: true, setup_fee_kes: 1500, active: false, sort: (zones?.length || 0) + 1 });
    if (error) toast(errorMessage(error), "error"); else load();
  };
  return (
    <div>
      <PageHead title="Delivery and setup" subtitle="Areas you deliver to, the fees, and whether you offer a setup visit there."
        actions={<><Button variant="secondary" icon="plus" onClick={add}>Add area</Button><Button disabled={!dirty.size} onClick={save}>Save changes</Button></>} />
      {zones === null ? <Skeleton /> : (
        <div className="space-y-4">
          {zones.map((z) => (
            <Panel key={z.id}>
              <div className="grid gap-4 lg:grid-cols-[1.2fr_2fr_auto]">
                <div className="space-y-2">
                  <Input value={z.name} onChange={(e) => set(z.id, "name", e.target.value)} aria-label="Area name" className="font-semibold" />
                  <Input value={z.eta} onChange={(e) => set(z.id, "eta", e.target.value)} aria-label="Delivery time" placeholder="Same day if ordered by 2pm" />
                </div>
                <textarea value={z.areas} onChange={(e) => set(z.id, "areas", e.target.value)} rows={3} aria-label="Neighbourhoods" placeholder="Neighbourhoods, comma separated" className="kb-input" />
                <div className="grid grid-cols-2 gap-3 lg:w-80">
                  <label className="text-sm"><span className="kb-label">Delivery (KES)</span><Input type="number" min={0} value={z.fee_kes} onChange={(e) => set(z.id, "fee_kes", e.target.value)} /></label>
                  <label className="text-sm"><span className="kb-label">Setup visit (KES)</span><Input type="number" min={0} value={z.setup_fee_kes} disabled={!z.setup_available} onChange={(e) => set(z.id, "setup_fee_kes", e.target.value)} /></label>
                  <Toggle checked={z.setup_available} onChange={(v) => set(z.id, "setup_available", v)} label="Setup visits" />
                  <Toggle checked={z.active} onChange={(v) => set(z.id, "active", v)} label="Shown at checkout" />
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
