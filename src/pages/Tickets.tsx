import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase, errorMessage } from "@/lib/supabase";
import { useAdmin } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { fmtDateTime, timeAgo } from "@/lib/format";
import { Icon } from "@/components/Icons";
import { Button, Select, Textarea } from "@/components/ui";
import { Empty, Pill, SearchInput, Skeleton, Tabs, type Tone } from "@/components/admin";

interface Ticket {
  id: string; number: number; user_id: string; subject: string; category: string; priority: "low" | "normal" | "high" | "urgent";
  status: "open" | "pending" | "resolved" | "closed"; assignee_id: string | null; rating: number | null; property: string | null;
  host: string; email: string; last_author: "host" | "admin"; first_reply_at: string | null; last_message_at: string; created_at: string;
}
interface Msg { id: string; author_role: "host" | "admin"; body: string; internal: boolean; attachment: string; created_at: string }
interface Admin { id: string; name: string; email: string }

const STATUS_TONE: Record<Ticket["status"], Tone> = { open: "amber", pending: "maroon", resolved: "green", closed: "gray" };
const STATUS_LABEL: Record<Ticket["status"], string> = { open: "Waiting for us", pending: "Waiting for host", resolved: "Resolved", closed: "Closed" };
const PRIO_TONE: Record<Ticket["priority"], Tone> = { low: "gray", normal: "gray", high: "amber", urgent: "red" };
const SAVED = [
  { label: "Restart the TV", text: "Thanks for letting us know. Please turn the TV off at the wall for 30 seconds, then on again and open Karibu TV. Tell us what you see after that." },
  { label: "Re-pair a TV", text: "Let's re-pair it. On the TV, hold OK on the remote for 3 seconds, choose \"Show pairing code\", then enter the code under TV Devices > Pair new TV." },
  { label: "Payment received", text: "We've received your payment, thank you. Your Pro plan is now active. Let us know if anything looks off." },
  { label: "Closing", text: "Glad that's sorted. I'll mark this as solved, but just reply here if anything else comes up." },
];

function useAdmins() {
  const [a, setA] = useState<Admin[]>([]);
  useEffect(() => { supabase.rpc("admin_hosts").then(({ data }) => setA(((data as (Admin & { role: string })[]) || []).filter((x) => x.role === "admin"))); }, []);
  return a;
}

function Shot({ path }: { path: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => { supabase.storage.from("support-files").createSignedUrl(path, 3600).then(({ data }) => setUrl(data?.signedUrl || "")); }, [path]);
  return url ? <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="Attachment" className="mt-2 max-h-60 rounded-md border border-line" /></a> : null;
}

function Thread({ t, admins, onChanged }: { t: Ticket; admins: Admin[]; onChanged: () => void }) {
  const toast = useToast();
  const { me } = useAdmin();
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const load = useCallback(() => supabase.from("ticket_messages").select("*").eq("ticket_id", t.id).order("created_at").then(({ data }) => setMsgs((data as Msg[]) || [])), [t.id]);
  useEffect(() => {
    load();
    const ch = supabase.channel(`adm-ticket-${t.id}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "ticket_messages", filter: `ticket_id=eq.${t.id}` }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [t.id, load]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs?.length]);
  const update = async (patch: Partial<Ticket>) => {
    const { error } = await supabase.from("tickets").update(patch).eq("id", t.id);
    if (error) toast(errorMessage(error), "error"); else onChanged();
  };
  const send = async (e: FormEvent, resolve = false) => {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("ticket_messages").insert({ ticket_id: t.id, body: body.trim(), author_role: "admin", internal });
    if (error) { toast(errorMessage(error), "error"); setBusy(false); return; }
    if (!t.assignee_id && me) await supabase.from("tickets").update({ assignee_id: me.id }).eq("id", t.id);
    if (resolve) await supabase.from("tickets").update({ status: "resolved" }).eq("id", t.id);
    setBody(""); setInternal(false); setBusy(false); load(); onChanged();
  };
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <p className="text-xs text-ink-muted">#{t.number} · opened {fmtDateTime(t.created_at)}{t.first_reply_at ? ` · first reply in ${Math.max(1, Math.round((Date.parse(t.first_reply_at) - Date.parse(t.created_at)) / 60000))} min` : ""}</p>
          <h2 className="truncate font-display text-lg font-semibold text-navy">{t.subject}</h2>
          <p className="text-sm text-ink-muted"><Link to={`/hosts/${t.user_id}`} className="font-semibold text-maroon hover:underline">{t.host}</Link> · {t.email}{t.property ? ` · ${t.property}` : ""}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={t.status} onChange={(e) => update({ status: e.target.value as Ticket["status"] })} aria-label="Status" className="!min-h-[36px] !w-auto !py-1 text-sm">
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Select value={t.priority} onChange={(e) => update({ priority: e.target.value as Ticket["priority"] })} aria-label="Priority" className="!min-h-[36px] !w-auto !py-1 text-sm">
            {["low", "normal", "high", "urgent"].map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
          </Select>
          <Select value={t.assignee_id || ""} onChange={(e) => update({ assignee_id: e.target.value || null })} aria-label="Assignee" className="!min-h-[36px] !w-auto !py-1 text-sm">
            <option value="">Unassigned</option>{admins.map((a) => <option key={a.id} value={a.id}>{a.name || a.email}</option>)}
          </Select>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-surface-wash/50 px-5 py-5">
        {msgs === null ? <Skeleton rows={3} /> : msgs.map((m) => (
          <div key={m.id} className={`flex ${m.author_role === "admin" ? "justify-end" : ""}`}>
            <div className={`max-w-[80%] rounded-[16px] px-4 py-3 text-[0.9375rem] ${m.internal ? "border border-dashed border-[#d9a400] bg-[#fff8db]" : m.author_role === "admin" ? "bg-navy text-bone" : "border border-line bg-surface"}`}>
              <p className={`text-xs font-semibold ${m.internal ? "text-[#8a6a00]" : m.author_role === "admin" ? "text-bone/60" : "text-maroon"}`}>{m.internal ? "Internal note" : m.author_role === "admin" ? "Karibu TV" : t.host} · {timeAgo(m.created_at)}</p>
              <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
              {m.attachment && <Shot path={m.attachment} />}
            </div>
          </div>
        ))}
        {t.rating && <p className="text-center text-sm text-ink-muted">Host rated this {t.rating}/5</p>}
        <div ref={end} />
      </div>
      <form onSubmit={(e) => send(e)} className={`border-t border-line p-4 ${internal ? "bg-[#fff8db]" : ""}`}>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-line bg-surface p-0.5 text-sm" role="radiogroup" aria-label="Reply type">
            <button type="button" role="radio" aria-checked={!internal} onClick={() => setInternal(false)} className={`rounded-full px-3 py-1 font-semibold ${!internal ? "bg-navy text-white" : ""}`}>Reply to host</button>
            <button type="button" role="radio" aria-checked={internal} onClick={() => setInternal(true)} className={`rounded-full px-3 py-1 font-semibold ${internal ? "bg-[#d9a400] text-white" : ""}`}>Internal note</button>
          </div>
          <Select value="" onChange={(e) => { const s = SAVED.find((x) => x.label === e.target.value); if (s) setBody((b) => (b ? `${b}\n\n${s.text}` : s.text)); }} aria-label="Saved replies" className="!min-h-[34px] !w-auto !py-1 text-sm">
            <option value="">Saved replies…</option>{SAVED.map((s) => <option key={s.label} value={s.label}>{s.label}</option>)}
          </Select>
        </div>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder={internal ? "Only the team sees this…" : `Reply to ${t.host.split(" ")[0]}… (they'll get a notification)`} aria-label="Message"
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") send(e as unknown as FormEvent); }} />
        <div className="mt-2 flex flex-wrap justify-end gap-2">
          {!internal && <Button size="sm" variant="secondary" disabled={!body.trim()} loading={busy} onClick={(e) => send(e as unknown as FormEvent, true)}>Send and resolve</Button>}
          <Button size="sm" type="submit" disabled={!body.trim()} loading={busy}>{internal ? "Add note" : "Send"} <kbd className="ml-1 text-[10px] opacity-60">⌘↵</kbd></Button>
        </div>
      </form>
    </div>
  );
}

export default function Tickets() {
  const { id } = useParams();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { me } = useAdmin();
  const admins = useAdmins();
  const [all, setAll] = useState<Ticket[] | null>(null);
  const [tab, setTab] = useState<"open" | "pending" | "mine" | "done" | "all">("open");
  const [q, setQ] = useState(params.get("q") || "");
  const load = useCallback(() => supabase.rpc("admin_tickets").then(({ data }) => setAll((data as Ticket[]) || [])), []);
  useEffect(() => {
    load();
    const ch = supabase.channel("adm-tickets").on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);
  const list = useMemo(() => (all || []).filter((t) => {
    if (q.trim() && !`${t.number} ${t.subject} ${t.host} ${t.email}`.toLowerCase().includes(q.trim().toLowerCase())) return false;
    if (tab === "open") return t.status === "open";
    if (tab === "pending") return t.status === "pending";
    if (tab === "mine") return t.assignee_id === me?.id && ["open", "pending"].includes(t.status);
    if (tab === "done") return ["resolved", "closed"].includes(t.status);
    return true;
  }), [all, tab, q, me]);
  const current = (all || []).find((t) => t.id === id);
  const count = (f: (t: Ticket) => boolean) => (all || []).filter(f).length;
  return (
    <div className="-my-2">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="font-display text-[1.75rem] font-semibold text-navy">Support</h1><p className="text-sm text-ink-muted">Tickets from hosts. Replies reach them in their dashboard bell.</p></div>
        <SearchInput value={q} onChange={setQ} placeholder="Ticket #, subject or host" />
      </div>
      <div className="grid h-[calc(100dvh-13rem)] min-h-[520px] overflow-hidden rounded-[18px] border border-line bg-surface lg:grid-cols-[22rem_1fr]">
        <div className={`flex min-h-0 flex-col border-line lg:border-r ${id ? "hidden lg:flex" : "flex"}`}>
          <div className="px-2"><Tabs value={tab} onChange={setTab} items={[
            { value: "open", label: "Open", count: count((t) => t.status === "open") }, { value: "pending", label: "Pending", count: count((t) => t.status === "pending") },
            { value: "mine", label: "Mine" }, { value: "done", label: "Done" }, { value: "all", label: "All" },
          ]} /></div>
          <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
            {all === null ? <Skeleton /> : list.map((t) => (
              <li key={t.id}>
                <button onClick={() => nav(`/tickets/${t.id}`)} className={`w-full px-4 py-3 text-left transition-colors ${t.id === id ? "bg-mint-soft" : "hover:bg-surface-wash"}`}>
                  <div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-semibold">{t.host}</p><span className="shrink-0 text-[11px] text-ink-muted">{timeAgo(t.last_message_at)}</span></div>
                  <p className="truncate text-sm">{t.subject}</p>
                  <div className="mt-1.5 flex items-center gap-1.5"><span className="text-[11px] text-ink-muted">#{t.number}</span><Pill tone={STATUS_TONE[t.status]}>{STATUS_LABEL[t.status]}</Pill>{t.priority !== "normal" && <Pill tone={PRIO_TONE[t.priority]}>{t.priority}</Pill>}{t.last_author === "host" && t.status === "open" && <span className="ml-auto h-2 w-2 rounded-full bg-maroon" />}</div>
                </button>
              </li>
            ))}
            {all !== null && !list.length && <li><Empty icon="check" title="Nothing here" body="No tickets in this view." /></li>}
          </ul>
        </div>
        <div className={`min-h-0 ${id ? "flex" : "hidden lg:flex"} flex-col`}>
          {id && <button onClick={() => nav("/tickets")} className="flex items-center gap-1 border-b border-line px-4 py-2 text-sm font-semibold text-ink-muted lg:hidden"><Icon name="chevron-left" size={13} />All tickets</button>}
          {current ? <Thread key={current.id} t={current} admins={admins} onChanged={load} /> : <div className="flex flex-1 items-center justify-center"><Empty icon="help" title="Pick a ticket" body="Open tickets are waiting for a reply from us. Pending ones are waiting for the host." /></div>}
        </div>
      </div>
    </div>
  );
}
