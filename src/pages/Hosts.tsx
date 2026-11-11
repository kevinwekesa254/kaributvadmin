import { useMemo, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { adminApi, errorMessage } from "@/lib/supabase";
import { useToast } from "@/lib/toast";
import { COUNTRIES, countryOf } from "@/lib/countries";
import { kes, timeAgo } from "@/lib/format";
import { isPro, planLabel, planTone, useHosts, type Host } from "@/lib/data";
import type { CountryCode } from "@/lib/types";
import { Flag, PhoneInput } from "@/components/PhoneInput";
import { Button, Field, Input, Modal, Select } from "@/components/ui";
import { Empty, PageHead, Pill, SearchInput, Skeleton, Tabs, Td, Th } from "@/components/admin";

type Filter = "all" | "pro" | "trial" | "free" | "paused";

export function CreateHost({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const toast = useToast();
  const [f, setF] = useState({ name: "", email: "", whatsapp: "", country: "KE" as CountryCode, trial_days: "30" });
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      const r = await adminApi<{ user_id: string }>("create_host", { ...f, trial_days: Number(f.trial_days) });
      toast(`Invite sent to ${f.email}.`); onClose(); onCreated(r.user_id);
    } catch (err) { toast(errorMessage(err), "error"); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Create a host"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="create-host" loading={busy} disabled={!f.email.includes("@") || !f.name.trim()}>Create and send invite</Button></>}>
      <form id="create-host" onSubmit={submit} className="space-y-4">
        <p className="text-sm text-ink-muted">They get an email to choose a password and land in their dashboard.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">{(id) => <Input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
          <Field label="Email">{(id) => <Input id={id} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />}</Field>
          <Field label="Country">{(id) => <Select id={id} value={f.country} onChange={(e) => setF({ ...f, country: e.target.value as CountryCode })}>{COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</Select>}</Field>
          <Field label="Free Pro trial">{(id) => <Select id={id} value={f.trial_days} onChange={(e) => setF({ ...f, trial_days: e.target.value })}><option value="30">30 days</option><option value="14">14 days</option><option value="60">60 days</option><option value="0">No trial (Free plan)</option></Select>}</Field>
        </div>
        <Field label="WhatsApp" optional>{(id) => <PhoneInput id={id} value={f.whatsapp} country={f.country} onChange={(v) => setF((x) => ({ ...x, whatsapp: v }))} />}</Field>
      </form>
    </Modal>
  );
}

export default function Hosts() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { hosts, reload } = useHosts();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>((params.get("filter") as Filter) || "all");
  const [create, setCreate] = useState(false);
  const only = (hosts || []).filter((h) => h.role !== "admin");
  const count = (f: Filter) => only.filter((h) => match(h, f)).length;
  function match(h: Host, f: Filter) {
    if (f === "paused") return !h.active;
    if (f === "pro") return h.active && isPro(h) && !h.trial;
    if (f === "trial") return h.active && isPro(h) && h.trial;
    if (f === "free") return h.active && !isPro(h);
    return true;
  }
  const list = useMemo(() => only.filter((h) => match(h, filter) && (!q.trim() || `${h.name} ${h.email} ${h.business_name} ${h.whatsapp}`.toLowerCase().includes(q.trim().toLowerCase()))), [only, filter, q]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div>
      <PageHead title="Hosts" subtitle={`${only.length} accounts`} actions={<><SearchInput value={q} onChange={setQ} placeholder="Name, email, business, phone" /><Button icon="plus" onClick={() => setCreate(true)}>Create host</Button></>} />
      <div className="rounded-[18px] border border-line bg-surface">
        <div className="px-3"><Tabs value={filter} onChange={setFilter} items={[
          { value: "all", label: "All", count: only.length }, { value: "pro", label: "Paying", count: count("pro") }, { value: "trial", label: "Trial", count: count("trial") },
          { value: "free", label: "Free", count: count("free") }, { value: "paused", label: "Paused", count: count("paused") },
        ]} /></div>
        {hosts === null ? <Skeleton /> : !list.length ? <Empty icon="users" title="No hosts match" /> : (
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead><tr><Th>Host</Th><Th>Plan</Th><Th>Properties</Th><Th>TVs</Th><Th>Paid</Th><Th>Tickets</Th><Th>Last seen</Th><Th>Joined</Th></tr></thead>
              <tbody>
                {list.map((h) => (
                  <tr key={h.id} onClick={() => nav(`/hosts/${h.id}`)} className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-wash">
                    <Td><div className="flex items-center gap-3"><Flag code={countryOf(h.country)?.flag || ""} /><div className="min-w-0"><p className="truncate font-semibold">{h.name || "No name yet"}</p><p className="truncate text-xs text-ink-muted">{h.email}{h.business_name ? ` · ${h.business_name}` : ""}</p></div></div></Td>
                    <Td><Pill tone={planTone(h)}>{planLabel(h)}</Pill>{isPro(h) && <p className="mt-1 text-xs text-ink-muted">{h.pro_tvs} TVs · until {new Date(h.plan_until!).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</p>}</Td>
                    <Td className="tabular-nums">{h.properties}</Td>
                    <Td className="tabular-nums">{h.tvs}{h.tvs > 0 && <span className={`ml-1.5 text-xs ${h.tvs_online < h.tvs ? "text-danger" : "text-[#16693a]"}`}>{h.tvs_online} on</span>}</Td>
                    <Td className="tabular-nums">{h.paid_kes ? kes(h.paid_kes) : "-"}</Td>
                    <Td>{h.open_tickets ? <Pill tone="amber">{h.open_tickets} open</Pill> : <span className="text-ink-muted">-</span>}</Td>
                    <Td className="text-ink-muted">{h.email_confirmed_at ? timeAgo(h.last_sign_in_at) : <Pill tone="gray">Invited</Pill>}</Td>
                    <Td className="text-ink-muted">{timeAgo(h.created_at)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <CreateHost open={create} onClose={() => setCreate(false)} onCreated={(id) => { reload(); nav(`/hosts/${id}`); }} />
    </div>
  );
}
