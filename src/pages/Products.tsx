import { useEffect, useState } from "react";
import { supabase, errorMessage, HOST_APP } from "@/lib/supabase";
import { useAdmin } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { kes } from "@/lib/format";
import { Icon } from "@/components/Icons";
import { Button, Field, Input, Textarea, Toggle } from "@/components/ui";
import { Drawer, Empty, PageHead, Pill, Skeleton } from "@/components/admin";

interface Product {
  id: string; slug: string; name: string; brand: string; tagline: string; description: string; highlights: string[]; specs: [string, string][];
  in_box: string[]; images: string[]; price_kes: number; compare_at_kes: number | null; stock: number; badge: string; karibu_ready: boolean; active: boolean; sort: number;
}
const imgUrl = (src: string) => (src.startsWith("/") ? `${HOST_APP}${src}` : src);
const blank: Product = { id: "", slug: "", name: "", brand: "", tagline: "", description: "", highlights: [], specs: [], in_box: [], images: [], price_kes: 0, compare_at_kes: null, stock: 0, badge: "", karibu_ready: true, active: false, sort: 99 };

function Editor({ p, onClose, onSaved }: { p: Product; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const { me } = useAdmin();
  const [f, setF] = useState({ ...p, highlightsText: p.highlights.join("\n"), specsText: p.specs.map(([k, v]) => `${k}: ${v}`).join("\n"), boxText: p.in_box.join("\n") });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
  const upload = async (file?: File) => {
    if (!file || !me) return;
    setUploading(true);
    const path = `${me.id}/shop/${Date.now()}-${file.name.replace(/[^\w.]/g, "").slice(-40)}`;
    const { error } = await supabase.storage.from("property-media").upload(path, file, { contentType: file.type });
    setUploading(false);
    if (error) { toast(errorMessage(error), "error"); return; }
    setF((x) => ({ ...x, images: [...x.images, supabase.storage.from("property-media").getPublicUrl(path).data.publicUrl] }));
  };
  const save = async () => {
    setBusy(true);
    const row = {
      slug: f.slug.trim().toLowerCase(), name: f.name.trim(), brand: f.brand.trim(), tagline: f.tagline.trim(), description: f.description.trim(),
      highlights: lines(f.highlightsText), specs: lines(f.specsText).map((l) => { const i = l.indexOf(":"); return i > 0 ? [l.slice(0, i).trim(), l.slice(i + 1).trim()] : [l, ""]; }),
      in_box: lines(f.boxText), images: f.images, price_kes: Number(f.price_kes) || 0, compare_at_kes: f.compare_at_kes ? Number(f.compare_at_kes) : null,
      stock: Math.max(0, Number(f.stock) || 0), badge: f.badge.trim(), karibu_ready: f.karibu_ready, active: f.active, sort: Number(f.sort) || 0, updated_at: new Date().toISOString(),
    };
    const { error } = f.id ? await supabase.from("products").update(row).eq("id", f.id) : await supabase.from("products").insert(row);
    setBusy(false);
    if (error) toast(errorMessage(error).includes("slug") ? "Use a web address of lowercase letters, numbers and dashes." : errorMessage(error), "error"); else { toast("Product saved."); onSaved(); onClose(); }
  };
  const set = (k: string, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Drawer open wide onClose={onClose} title={f.id ? f.name : "New product"} subtitle={f.slug ? `/shop/${f.slug}` : undefined}
      footer={<>{f.slug && f.id && <a className="kb-btn kb-btn--ghost kb-btn--md" href={`${HOST_APP}/shop/${f.slug}`} target="_blank" rel="noreferrer">View in shop</a>}<Button loading={busy} onClick={save} disabled={!f.name.trim() || !f.slug.trim()}>Save product</Button></>}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-6 rounded-md bg-surface-wash p-4">
          <Toggle checked={f.active} onChange={(v) => set("active", v)} label="Visible in the shop" />
          <Toggle checked={f.karibu_ready} onChange={(v) => set("karibu_ready", v)} label="Karibu TV ready" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">{(id) => <Input id={id} value={f.name} onChange={(e) => { set("name", e.target.value); if (!f.id) set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)); }} />}</Field>
          <Field label="Web address" hint="Lowercase, numbers and dashes.">{(id) => <Input id={id} value={f.slug} onChange={(e) => set("slug", e.target.value)} />}</Field>
          <Field label="Brand">{(id) => <Input id={id} value={f.brand} onChange={(e) => set("brand", e.target.value)} />}</Field>
          <Field label="Badge" optional>{(id) => <Input id={id} value={f.badge} onChange={(e) => set("badge", e.target.value)} placeholder="Best seller" maxLength={30} />}</Field>
          <Field label="Price (KES)">{(id) => <Input id={id} type="number" min={0} value={f.price_kes} onChange={(e) => set("price_kes", e.target.value)} />}</Field>
          <Field label="Was price (KES)" optional>{(id) => <Input id={id} type="number" min={0} value={f.compare_at_kes ?? ""} onChange={(e) => set("compare_at_kes", e.target.value)} />}</Field>
          <Field label="In stock">{(id) => <Input id={id} type="number" min={0} value={f.stock} onChange={(e) => set("stock", e.target.value)} />}</Field>
          <Field label="Order in shop">{(id) => <Input id={id} type="number" value={f.sort} onChange={(e) => set("sort", e.target.value)} />}</Field>
        </div>
        <Field label="Tagline">{(id) => <Input id={id} value={f.tagline} onChange={(e) => set("tagline", e.target.value)} maxLength={160} />}</Field>
        <Field label="Description">{(id) => <Textarea id={id} value={f.description} onChange={(e) => set("description", e.target.value)} rows={4} />}</Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Highlights" hint="One per line.">{(id) => <Textarea id={id} value={f.highlightsText} onChange={(e) => set("highlightsText", e.target.value)} rows={5} />}</Field>
          <Field label="In the box" hint="One per line.">{(id) => <Textarea id={id} value={f.boxText} onChange={(e) => set("boxText", e.target.value)} rows={5} />}</Field>
        </div>
        <Field label="Specifications" hint="One per line, as Label: value.">{(id) => <Textarea id={id} value={f.specsText} onChange={(e) => set("specsText", e.target.value)} rows={5} />}</Field>
        <div>
          <p className="kb-label">Images</p>
          <div className="grid grid-cols-4 gap-3">
            {f.images.map((src, i) => (
              <div key={src + i} className="group relative aspect-square overflow-hidden rounded-md border border-line bg-surface-wash">
                <img src={imgUrl(src)} alt="" className="h-full w-full object-contain p-2" />
                {i === 0 && <span className="absolute left-1 top-1 rounded bg-navy px-1.5 text-[10px] font-bold text-white">MAIN</span>}
                <div className="absolute inset-x-1 bottom-1 flex justify-between opacity-0 transition-opacity group-hover:opacity-100">
                  <button onClick={() => set("images", [src, ...f.images.filter((_, j) => j !== i)])} className="rounded bg-white px-1.5 text-[11px] font-semibold shadow" disabled={i === 0}>Main</button>
                  <button onClick={() => set("images", f.images.filter((_, j) => j !== i))} className="rounded bg-white px-1.5 text-[11px] font-semibold text-danger shadow">Remove</button>
                </div>
              </div>
            ))}
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-line text-sm text-ink-muted hover:border-line-strong">
              <Icon name="upload" size={18} />{uploading ? "Uploading…" : "Add image"}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
            </label>
          </div>
        </div>
      </div>
    </Drawer>
  );
}

export default function Products() {
  const [list, setList] = useState<Product[] | null>(null);
  const [edit, setEdit] = useState<Product | null>(null);
  const load = () => supabase.from("products").select("*").order("sort").then(({ data }) => setList((data as Product[]) || []));
  useEffect(() => { load(); }, []);
  return (
    <div>
      <PageHead title="Products" subtitle="What's for sale in the shop. Stock goes down when someone orders and back up if you cancel."
        actions={<><a className="kb-btn kb-btn--secondary kb-btn--md" href={`${HOST_APP}/shop`} target="_blank" rel="noreferrer"><Icon name="globe" size={15} />Open shop</a><Button icon="plus" onClick={() => setEdit(blank)}>Add product</Button></>} />
      {list === null ? <Skeleton /> : !list.length ? <Empty icon="box" title="No products yet" action={<Button onClick={() => setEdit(blank)}>Add product</Button>} /> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => (
            <button key={p.id} onClick={() => setEdit(p)} className="flex gap-4 rounded-[18px] border border-line bg-surface p-4 text-left transition-shadow hover:shadow-panel">
              <img src={imgUrl(p.images[0] || "")} alt="" className="h-24 w-24 shrink-0 rounded-md bg-surface-wash object-contain p-2" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{p.brand}</p>
                <p className="font-semibold leading-snug">{p.name}</p>
                <p className="mt-1 font-semibold tabular-nums">{kes(p.price_kes)}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {!p.active && <Pill tone="gray">Hidden</Pill>}
                  <Pill tone={p.stock <= 0 ? "red" : p.stock <= 3 ? "amber" : "green"}>{p.stock <= 0 ? "Sold out" : `${p.stock} in stock`}</Pill>
                  {p.badge && <Pill tone="maroon">{p.badge}</Pill>}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      {edit && <Editor p={edit} onClose={() => setEdit(null)} onSaved={load} />}
    </div>
  );
}
