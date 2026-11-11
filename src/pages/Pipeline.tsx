import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase, adminApi, errorMessage } from "@/lib/supabase";
import { useToast } from "@/lib/toast";
import { kes, timeAgo, fmtDate, waUrl } from "@/lib/format";
import { Icon, WhatsAppIcon } from "@/components/Icons";
import { Button, Field, Input, Textarea } from "@/components/ui";
import { Drawer, PageHead, Pill, SearchInput, Skeleton } from "@/components/admin";

export interface Lead {
  id: string; name: string; email: string; whatsapp: string; city: string; country: string; tv_brand: string; tv_count: number; message: string; source: string;
  status: Stage; notes: string; follow_up_at: string | null; host_id: string | null; value_kes: number; created_at: string; updated_at: string;
}
type Stage = "new" | "contacted" | "demo" | "trial" | "won" | "lost";
const STAGES: { key: Stage; label: string; hint: string }[] = [
  { key: "new", label: "New", hint: "From the website" },
  { key: "contacted", label: "Contacted", hint: "We reached out" },
  { key: "demo", label: "Demo", hint: "Shown it / setup call" },
  { key: "trial", label: "Trial", hint: "Has an account" },
  { key: "won", label: "Won", hint: "Paying" },
  { key: "lost", label: "Lost", hint: "Not now" },
];

function LeadDrawer({ lead, onClose, onSaved }: { lead: Lead | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<Lead | null>(lead);
  const [busy, setBusy] = useState("");
  useEffect(() => setF(lead), [lead]);
  if (!f) return null;
  const isNew = !f.id;
  const save = async () => {
    setBusy("save");
    const patch = { name: f.name.trim(), email: f.email.trim(), whatsapp: f.whatsapp.trim(), city: f.city.trim(), tv_count: Number(f.tv_count) || 0,
      status: f.status, notes: f.notes, follow_up_at: f.follow_up_at || null, value_kes: Number(f.value_kes) || 0, updated_at: new Date().toISOString() };
    const { error } = isNew ? await supabase.from("leads").insert({ ...patch, source: "admin" }) : await supabase.from("leads").update(patch).eq("id", f.id);
    setBusy("");
    if (error) toast(errorMessage(error), "error"); else { toast(isNew ? "Lead added." : "Saved."); onSaved(); onClose(); }
  };
  const convert = async () => {
    if (!f.email) { toast("Add their email first, so we can send the invite.", "error"); return; }
    setBusy("convert");
    try {
      const r = await adminApi<{ user_id: string }>("create_host", { email: f.email, name: f.name, whatsapp: f.whatsapp, trial_days: 30 });
      await supabase.from("leads").update({ host_id: r.user_id, status: "trial", updated_at: new Date().toISOString() }).eq("id", f.id);
      toast("Host account created and invite emailed. 30-day trial started."); onSaved(); onClose();
    } catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(""); }
  };
  const set = <K extends keyof Lead>(k: K, v: Lead[K]) => setF({ ...f, [k]: v });
  return (
    <Drawer open onClose={onClose} title={isNew ? "New lead" : f.name} subtitle={isNew ? "Add someone you met or spoke to" : `${f.city || "No town"} · added ${timeAgo(f.created_at)}`}
      footer={<>
        {!isNew && !f.host_id && <Button variant="secondary" icon="user" loading={busy === "convert"} onClick={convert}>Create host account</Button>}
        <Button loading={busy === "save"} onClick={save} disabled={f.name.trim().length < 1}>Save</Button>
      </>}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Stage">
          {STAGES.map((s) => <button key={s.key} role="radio" aria-checked={f.status === s.key} onClick={() => set("status", s.key)} className={`rounded-full border px-3 py-1 text-sm font-semibold ${f.status === s.key ? "border-navy bg-navy text-white" : "border-line"}`}>{s.label}</button>)}
        </div>
        {f.host_id && <Link to={`/hosts/${f.host_id}`} className="flex items-center gap-2 rounded-md bg-mint-soft p-3 text-sm font-semibold text-maroon"><Icon name="user" size={15} />Open their host account</Link>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">{(id) => <Input id={id} value={f.name} onChange={(e) => set("name", e.target.value)} />}</Field>
          <Field label="Town">{(id) => <Input id={id} value={f.city} onChange={(e) => set("city", e.target.value)} />}</Field>
          <Field label="WhatsApp">{(id) => <Input id={id} value={f.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="+254…" />}</Field>
          <Field label="Email">{(id) => <Input id={id} type="email" value={f.email} onChange={(e) => set("email", e.target.value)} />}</Field>
          <Field label="TVs">{(id) => <Input id={id} type="number" min={0} value={f.tv_count} onChange={(e) => set("tv_count", Number(e.target.value))} />}</Field>
          <Field label="Deal value (KES / month)">{(id) => <Input id={id} type="number" min={0} value={f.value_kes} onChange={(e) => set("value_kes", Number(e.target.value))} />}</Field>
          <Field label="Follow up on" className="sm:col-span-2">{(id) => <Input id={id} type="date" value={(f.follow_up_at || "").slice(0, 10)} onChange={(e) => set("follow_up_at", e.target.value ? new Date(e.target.value).toISOString() : null)} />}</Field>
        </div>
        {f.message && <div className="rounded-md bg-surface-wash p-3 text-sm"><p className="text-xs font-semibold text-ink-muted">Their message</p><p className="mt-1 whitespace-pre-wrap">{f.message}</p></div>}
        <Field label="Notes">{(id) => <Textarea id={id} value={f.notes} onChange={(e) => set("notes", e.target.value)} rows={5} placeholder="Calls, objections, what they need…" />}</Field>
        {f.whatsapp && <a className="kb-btn kb-btn--secondary kb-btn--sm" href={waUrl(f.whatsapp, `Hi ${f.name.split(" ")[0]}, this is Karibu TV.`)} target="_blank" rel="noreferrer"><WhatsAppIcon size={15} />WhatsApp {f.name.split(" ")[0]}</a>}
      </div>
    </Drawer>
  );
}

export default function Pipeline() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Lead | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const toast = useToast();
  const load = () => supabase.from("leads").select("*").order("created_at", { ascending: false }).then(({ data }) => setLeads((data as Lead[]) || []));
  useEffect(() => { load(); }, []);
  const list = useMemo(() => (leads || []).filter((l) => !q.trim() || `${l.name} ${l.city} ${l.email} ${l.whatsapp}`.toLowerCase().includes(q.trim().toLowerCase())), [leads, q]);
  const move = async (id: string, status: Stage) => {
    setLeads((ls) => ls && ls.map((l) => (l.id === id ? { ...l, status } : l)));
    const { error } = await supabase.from("leads").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast(errorMessage(error), "error"); load(); }
  };
  const blank: Lead = { id: "", name: "", email: "", whatsapp: "", city: "", country: "", tv_brand: "", tv_count: 1, message: "", source: "admin", status: "new", notes: "", follow_up_at: null, host_id: null, value_kes: 0, created_at: new Date().toISOString(), updated_at: "" };
  const open$ = (leads || []).filter((l) => !["won", "lost"].includes(l.status));
  return (
    <div>
      <PageHead title="Pipeline" subtitle={`${open$.length} open leads · ${kes(open$.reduce((n, l) => n + (l.value_kes || 0), 0))} a month in play`}
        actions={<><SearchInput value={q} onChange={setQ} placeholder="Search leads" /><Button icon="plus" onClick={() => setOpen(blank)}>Add lead</Button></>} />
      {leads === null ? <Skeleton /> : (
        <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-4 sm:-mx-8 sm:px-8">
          {STAGES.map((s) => {
            const col = list.filter((l) => l.status === s.key);
            return (
              <div key={s.key} className="flex w-72 shrink-0 flex-col rounded-[18px] bg-surface-wash/70 p-2"
                onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag) move(drag, s.key); setDrag(null); }}>
                <div className="flex items-center justify-between px-2 pb-2 pt-1">
                  <div><p className="text-sm font-semibold">{s.label} <span className="text-ink-muted tabular-nums">{col.length}</span></p><p className="text-xs text-ink-muted">{s.hint}</p></div>
                </div>
                <div className="space-y-2">
                  {col.map((l) => {
                    const due = l.follow_up_at && Date.parse(l.follow_up_at) < Date.now() + 864e5 && !["won", "lost"].includes(l.status);
                    return (
                      <button key={l.id} draggable onDragStart={() => setDrag(l.id)} onClick={() => setOpen(l)}
                        className="w-full rounded-[14px] border border-line bg-surface p-3.5 text-left shadow-card transition-shadow hover:shadow-panel">
                        <div className="flex items-start justify-between gap-2"><p className="font-semibold leading-snug">{l.name}</p>{l.value_kes > 0 && <span className="text-xs font-semibold tabular-nums text-maroon">{kes(l.value_kes)}</span>}</div>
                        <p className="mt-0.5 text-xs text-ink-muted">{[l.city, l.tv_count ? `${l.tv_count} TV${l.tv_count > 1 ? "s" : ""}` : "", l.source === "admin" ? "added by team" : "website"].filter(Boolean).join(" · ")}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {due && <Pill tone="amber"><Icon name="clock" size={11} />Follow up {fmtDate(l.follow_up_at)}</Pill>}
                          {l.host_id && <Pill tone="maroon">Has account</Pill>}
                          <span className="ml-auto text-[11px] text-ink-muted">{timeAgo(l.updated_at || l.created_at)}</span>
                        </div>
                      </button>
                    );
                  })}
                  {!col.length && <p className="px-2 py-6 text-center text-xs text-ink-muted">Drag leads here</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <LeadDrawer lead={open} onClose={() => setOpen(null)} onSaved={load} />
    </div>
  );
}
