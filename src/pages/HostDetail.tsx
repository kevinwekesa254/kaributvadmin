import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase, adminApi, errorMessage, HOST_APP } from "@/lib/supabase";
import { useAdmin } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { countryOf } from "@/lib/countries";
import { fmtDate, fmtDateTime, isOnline, kes, timeAgo, waUrl } from "@/lib/format";
import { isPro, planLabel, planTone, type Host } from "@/lib/data";
import { Icon, WhatsAppIcon } from "@/components/Icons";
import { Flag } from "@/components/PhoneInput";
import { Button, ConfirmModal, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { Empty, Panel, Pill, Skeleton, Tabs, Td, Th } from "@/components/admin";
import { RecordPayment } from "./Billing";

interface Property { id: string; name: string; area: string; layout: string; theme: string; created_at: string }
interface Device { id: string; name: string; property_id: string | null; last_seen: string | null; app_version: string; created_at: string }
interface Payment { id: string; amount: number; currency: string; tvs: number; months: number; provider: string; provider_ref: string; coupon_code: string | null; status: string; created_at: string }
interface Note { id: string; body: string; created_at: string }
interface Audit { id: number; action: string; detail: Record<string, unknown>; created_at: string }
interface TicketRow { id: string; number: number; subject: string; status: string; last_message_at: string; user_id: string }

function PlanModal({ host, open, onClose, onSaved }: { host: Host; open: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [plan, setPlan] = useState<"pro" | "free">(isPro(host) ? "pro" : "free");
  const [days, setDays] = useState("30");
  const [tvs, setTvs] = useState(String(Math.max(1, host.pro_tvs)));
  const [trial, setTrial] = useState(host.trial);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const until = plan === "pro" ? new Date(Math.max(Date.now(), host.plan_until ? Date.parse(host.plan_until) : 0) + Number(days) * 864e5).toISOString() : null;
    const { error } = await supabase.rpc("admin_set_plan", { p_user: host.id, p_plan: plan, p_until: until, p_tvs: plan === "pro" ? Number(tvs) || 1 : 1, p_trial: plan === "pro" && trial });
    setBusy(false);
    if (error) toast(errorMessage(error), "error"); else { toast("Plan updated."); onSaved(); onClose(); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Change plan or extend"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={save}>Save</Button></>}>
      <p className="mb-4 text-sm text-ink-muted">For paid months, use <b>Record payment</b> instead: it works out the price and keeps the books right.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Plan">{(id) => <Select id={id} value={plan} onChange={(e) => setPlan(e.target.value as "pro" | "free")}><option value="pro">Pro</option><option value="free">Free</option></Select>}</Field>
        {plan === "pro" && <>
          <Field label="Add days">{(id) => <Select id={id} value={days} onChange={(e) => setDays(e.target.value)}>{["7", "14", "30", "60", "90", "365"].map((d) => <option key={d} value={d}>{d} days</option>)}</Select>}</Field>
          <Field label="TVs">{(id) => <Input id={id} type="number" min={1} max={500} value={tvs} onChange={(e) => setTvs(e.target.value)} />}</Field>
          <Field label="Type">{(id) => <Select id={id} value={trial ? "trial" : "comp"} onChange={(e) => setTrial(e.target.value === "trial")}><option value="trial">Trial</option><option value="comp">Complimentary Pro</option></Select>}</Field>
        </>}
      </div>
    </Modal>
  );
}

export default function HostDetail() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { me } = useAdmin();
  const [h, setH] = useState<Host | null | undefined>(undefined);
  const [props, setProps] = useState<Property[]>([]);
  const [devs, setDevs] = useState<Device[]>([]);
  const [pays, setPays] = useState<Payment[]>([]);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [tab, setTab] = useState<"overview" | "billing" | "support" | "notes" | "activity">("overview");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [modal, setModal] = useState<"" | "plan" | "pay" | "pause" | "delete">("");
  const [confirmEmail, setConfirmEmail] = useState("");

  const load = useCallback(async () => {
    const [{ data: hs }, { data: p }, { data: d }, { data: y }, { data: t }, { data: n }, { data: a }] = await Promise.all([
      supabase.rpc("admin_hosts"),
      supabase.from("properties").select("id, name, area, layout, theme, created_at").eq("owner_id", id),
      supabase.from("devices").select("id, name, property_id, last_seen, app_version, created_at").eq("owner_id", id),
      supabase.from("payments").select("*").eq("user_id", id).order("created_at", { ascending: false }),
      supabase.rpc("admin_tickets"),
      supabase.from("host_notes").select("id, body, created_at").eq("host_id", id).order("created_at", { ascending: false }),
      supabase.from("audit_log").select("id, action, detail, created_at").eq("target", id).order("created_at", { ascending: false }).limit(50),
    ]);
    setH(((hs as Host[]) || []).find((x) => x.id === id) || null);
    setProps((p as Property[]) || []); setDevs((d as Device[]) || []); setPays((y as Payment[]) || []);
    setTickets(((t as TicketRow[]) || []).filter((x) => x.user_id === id)); setNotes((n as Note[]) || []); setAudit((a as Audit[]) || []);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const act = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try { await fn(); toast(ok); await load(); } catch (e) { toast(errorMessage(e), "error"); } finally { setBusy(""); }
  };
  if (h === undefined) return <Skeleton rows={8} />;
  if (h === null) return <Empty icon="user" title="Host not found" action={<Link to="/hosts" className="kb-btn kb-btn--secondary kb-btn--md">All hosts</Link>} />;

  const first = (h.name || h.email).split(" ")[0];
  return (
    <div>
      <Link to="/hosts" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-ink-muted hover:text-ink"><Icon name="chevron-left" size={13} />Hosts</Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-maroon font-display text-xl font-semibold text-white">{first[0]?.toUpperCase()}</span>
          <div>
            <h1 className="font-display text-[1.75rem] font-semibold leading-tight text-navy">{h.name || "No name yet"}</h1>
            <p className="flex flex-wrap items-center gap-2 text-sm text-ink-muted"><Flag code={countryOf(h.country)?.flag || ""} className="h-3.5 w-5" />{h.email}{h.business_name && <span>· {h.business_name}</span>}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Pill tone={planTone(h)}>{planLabel(h)}</Pill>
              {!h.email_confirmed_at && <Pill tone="gray">Invite not accepted</Pill>}
              <Pill tone="gray">Joined {fmtDate(h.created_at)}</Pill>
              <Pill tone="gray">Last sign-in {timeAgo(h.last_sign_in_at)}</Pill>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon="card" onClick={() => setModal("pay")}>Record payment</Button>
          <Button size="sm" variant="secondary" icon="crown" onClick={() => setModal("plan")}>Plan</Button>
          <Button size="sm" variant="secondary" icon="megaphone" onClick={() => nav(`/messages?to=${h.id}`)}>Message</Button>
          {h.whatsapp && <a className="kb-btn kb-btn--secondary kb-btn--sm" href={waUrl(h.whatsapp, `Hi ${first}, this is Karibu TV.`)} target="_blank" rel="noreferrer"><WhatsAppIcon size={14} />WhatsApp</a>}
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        {[["Properties", h.properties], ["TVs online", `${h.tvs_online}/${h.tvs}`], ["Paid to date", kes(h.paid_kes)], ["Open tickets", h.open_tickets]].map(([k, v]) => (
          <div key={k as string} className="rounded-[16px] border border-line bg-surface p-4"><p className="text-xs text-ink-muted">{k}</p><p className="mt-1 font-display text-2xl font-semibold tabular-nums">{v}</p></div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div className="min-w-0 rounded-[18px] border border-line bg-surface">
          <div className="px-3"><Tabs value={tab} onChange={setTab} items={[
            { value: "overview", label: "Properties & TVs" }, { value: "billing", label: "Billing", count: pays.length },
            { value: "support", label: "Support", count: tickets.length }, { value: "notes", label: "Notes", count: notes.length }, { value: "activity", label: "Activity" },
          ]} /></div>
          <div className="p-5">
            {tab === "overview" && (
              props.length ? <div className="space-y-4">{props.map((p) => {
                const tv = devs.filter((d) => d.property_id === p.id);
                return (
                  <div key={p.id} className="rounded-[14px] border border-line p-4">
                    <div className="flex items-center justify-between"><p className="font-semibold">{p.name}<span className="ml-2 text-sm font-normal text-ink-muted">{p.area}</span></p><span className="text-xs text-ink-muted">{p.layout} · {p.theme}</span></div>
                    <ul className="mt-3 space-y-1.5">{tv.map((d) => <li key={d.id} className="flex items-center gap-2 text-sm"><span className={`h-2 w-2 rounded-full ${isOnline(d.last_seen) ? "bg-[#16a34a]" : "bg-danger"}`} />{d.name}<span className="ml-auto text-xs text-ink-muted">v{d.app_version || "?"} · seen {timeAgo(d.last_seen)}</span></li>)}
                      {!tv.length && <li className="text-sm text-ink-muted">No TV paired yet.</li>}</ul>
                  </div>
                );
              })}</div> : <Empty icon="building" title="No properties yet" body="They haven't finished onboarding." />
            )}
            {tab === "billing" && (pays.length ? (
              <table className="w-full text-sm"><thead><tr><Th>Date</Th><Th>Amount</Th><Th>For</Th><Th>Reference</Th><Th>Status</Th></tr></thead>
                <tbody>{pays.map((p) => <tr key={p.id} className="border-b border-line last:border-0"><Td>{fmtDate(p.created_at)}</Td><Td className="font-semibold tabular-nums">{p.currency} {Number(p.amount).toLocaleString()}</Td><Td>{p.tvs} TVs × {p.months} mo{p.coupon_code ? ` · ${p.coupon_code}` : ""}</Td><Td className="font-mono text-xs">{p.provider_ref || "-"}</Td><Td><Pill tone={p.status === "paid" ? "green" : "gray"}>{p.status}</Pill></Td></tr>)}</tbody></table>
            ) : <Empty icon="card" title="No payments yet" action={<Button size="sm" onClick={() => setModal("pay")}>Record payment</Button>} />)}
            {tab === "support" && (tickets.length ? <ul className="divide-y divide-line">{tickets.map((t) => <li key={t.id}><Link to={`/tickets/${t.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-maroon"><span className="truncate font-medium">#{t.number} {t.subject}</span><span className="flex items-center gap-2 text-xs text-ink-muted"><Pill tone={t.status === "open" ? "amber" : t.status === "pending" ? "maroon" : "green"}>{t.status}</Pill>{timeAgo(t.last_message_at)}</span></Link></li>)}</ul> : <Empty icon="help" title="No tickets" />)}
            {tab === "notes" && (
              <div>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Private note for the team (calls, promises, context)…" aria-label="New note" />
                <Button size="sm" className="mt-2" disabled={!note.trim()} loading={busy === "note"} onClick={() => act("note", async () => { const { error } = await supabase.from("host_notes").insert({ host_id: h.id, body: note.trim() }); if (error) throw error; setNote(""); }, "Note added.")}>Add note</Button>
                <ul className="mt-5 space-y-3">{notes.map((n) => <li key={n.id} className="rounded-md bg-surface-wash p-3 text-sm"><p className="whitespace-pre-wrap">{n.body}</p><p className="mt-1 text-xs text-ink-muted">{fmtDateTime(n.created_at)}</p></li>)}</ul>
              </div>
            )}
            {tab === "activity" && (audit.length ? <ul className="space-y-2 text-sm">{audit.map((a) => <li key={a.id} className="flex justify-between gap-3"><span><b>{a.action.replace(/_/g, " ")}</b> <span className="text-xs text-ink-muted">{JSON.stringify(a.detail)}</span></span><span className="shrink-0 text-xs text-ink-muted">{fmtDateTime(a.created_at)}</span></li>)}</ul> : <Empty icon="shield" title="No admin activity on this account" />)}
          </div>
        </div>

        <div className="space-y-4">
          <Panel title="Account">
            <div className="space-y-2">
              <Button size="sm" variant="secondary" className="w-full" icon="lock" loading={busy === "reset"} onClick={() => act("reset", () => adminApi("send_reset", { user_id: h.id }), "Password reset link sent.")}>Send password reset</Button>
              {!h.email_confirmed_at && <Button size="sm" variant="secondary" className="w-full" icon="mail" loading={busy === "invite"} onClick={() => act("invite", () => adminApi("resend_invite", { user_id: h.id }), "Invite sent again.")}>Resend invite</Button>}
              <a className="kb-btn kb-btn--ghost kb-btn--sm w-full" href={`${HOST_APP}`} target="_blank" rel="noreferrer"><Icon name="globe" size={14} />Open host site</a>
              {h.active
                ? <Button size="sm" variant="danger" className="w-full" icon="ban" onClick={() => setModal("pause")}>Deactivate</Button>
                : <Button size="sm" className="w-full" icon="check" loading={busy === "activate"} onClick={() => act("activate", () => adminApi("set_active", { user_id: h.id, active: true }), "Account active again.")}>Activate</Button>}
            </div>
          </Panel>
          {me?.admin_role === "owner" && <Panel title="Danger zone"><Button size="sm" variant="danger" className="w-full" icon="delete" onClick={() => setModal("delete")}>Delete account</Button><p className="mt-2 text-xs text-ink-muted">Removes their login, properties, bookings and TV links. Can't be undone.</p></Panel>}
        </div>
      </div>

      <PlanModal host={h} open={modal === "plan"} onClose={() => setModal("")} onSaved={load} />
      <RecordPayment open={modal === "pay"} onClose={() => setModal("")} onSaved={load} hostId={h.id} defaultTvs={Math.max(1, h.tvs || h.pro_tvs)} />
      <ConfirmModal open={modal === "pause"} onClose={() => setModal("")} danger confirmLabel="Deactivate" loading={busy === "pause"} title={`Deactivate ${first}?`}
        body="They're signed out and can't sign in. Their TVs show a paused message instead of guest details. You can activate them again at any time."
        onConfirm={() => act("pause", () => adminApi("set_active", { user_id: h.id, active: false }), "Account deactivated.").then(() => setModal(""))} />
      <Modal open={modal === "delete"} onClose={() => { setModal(""); setConfirmEmail(""); }} title="Delete this account?"
        footer={<><Button variant="ghost" onClick={() => setModal("")}>Cancel</Button><Button variant="danger" loading={busy === "delete"} disabled={confirmEmail.trim().toLowerCase() !== h.email}
          onClick={() => act("delete", () => adminApi("delete_host", { user_id: h.id, confirm_email: confirmEmail }), "Account deleted.").then(() => nav("/hosts"))}>Delete forever</Button></>}>
        <p className="text-sm">Type <b>{h.email}</b> to confirm.</p>
        <Input className="mt-3" value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} aria-label="Confirm email" autoComplete="off" />
      </Modal>
    </div>
  );
}
