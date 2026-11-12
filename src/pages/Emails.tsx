import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase, errorMessage } from "@/lib/supabase";
import { useAdmin } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { fmtDateTime, timeAgo } from "@/lib/format";
import { Button, Input, Modal } from "@/components/ui";
import { Drawer, Empty, Kpi, PageHead, Pill, SearchInput, Skeleton, Tabs, Td, Th, type Tone } from "@/components/admin";

interface Email {
  id: string; template: string; to_email: string; to_name: string; user_id: string | null; data: Record<string, unknown>;
  kind: "account" | "reminder" | "marketing" | "team"; status: Status; attempts: number; error: string; provider_id: string;
  send_after: string; created_at: string; sent_at: string | null;
}
type Status = "queued" | "sending" | "sent" | "failed" | "skipped";
interface Stats { sent_today: number; queued: number; failed_7d: number; sent_30d: number; newsletter: number; reminders_off: number }

const CAP = 300;
const NAMES: Record<string, string> = {
  welcome: "Welcome", trial_ending: "Trial ends in 3 days", trial_ended: "Trial ended", renew_reminder: "Renewal reminder", plan_expired: "Pro plan ended",
  payment_receipt: "Payment receipt", ticket_reply: "Support reply", ticket_solved: "Ticket solved", tv_offline: "TV offline",
  order_confirmed: "Order confirmed", order_paid: "Order paid", order_dispatched: "Order on its way", order_delivered: "Order delivered", order_cancelled: "Order cancelled",
  team_new_ticket: "Team: new ticket", team_ticket_reply: "Team: host replied", team_new_order: "Team: new order", team_new_lead: "Team: new lead",
  test: "Test email", _contact_sync: "Newsletter list update",
};
const TONE: Record<Status, Tone> = { queued: "blue", sending: "blue", sent: "green", failed: "red", skipped: "gray" };
const LABEL: Record<Status, string> = { queued: "Queued", sending: "Sending", sent: "Sent", failed: "Failed", skipped: "Not sent" };

function Detail({ e, onClose, onRetried }: { e: Email; onClose: () => void; onRetried: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const canRetry = (e.status === "failed" || e.status === "skipped") && !e.to_email.endsWith("@example.com");
  const retry = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("admin_email_retry", { p_id: e.id });
    setBusy(false);
    if (error) toast(errorMessage(error), "error"); else { toast("Queued again. It goes out within a minute."); onRetried(); onClose(); }
  };
  return (
    <Drawer open onClose={onClose} title={NAMES[e.template] || e.template} subtitle={<span className="flex items-center gap-2"><Pill tone={TONE[e.status]}>{LABEL[e.status]}</Pill>{fmtDateTime(e.created_at)}</span>}
      footer={canRetry ? <Button loading={busy} icon="refresh" onClick={retry}>Send again</Button> : undefined}>
      <dl className="space-y-4 text-sm">
        <div><dt className="text-xs font-semibold uppercase tracking-wider text-ink-muted">To</dt><dd className="mt-1 font-semibold">{e.to_name ? `${e.to_name} · ` : ""}{e.to_email}</dd>
          {e.user_id && <Link to={`/hosts/${e.user_id}`} className="text-maroon hover:underline">Open host</Link>}</div>
        <div className="grid grid-cols-2 gap-4">
          <div><dt className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Type</dt><dd className="mt-1 capitalize">{e.kind}</dd></div>
          <div><dt className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Attempts</dt><dd className="mt-1">{e.attempts}</dd></div>
          <div><dt className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Sent</dt><dd className="mt-1">{e.sent_at ? fmtDateTime(e.sent_at) : "-"}</dd></div>
          <div><dt className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Brevo ID</dt><dd className="mt-1 break-all font-mono text-xs">{e.provider_id || "-"}</dd></div>
        </div>
        {e.error && <div><dt className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Why</dt><dd className="mt-1 rounded-md bg-danger/10 p-3 text-danger">{e.error}</dd></div>}
        <div><dt className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Details</dt>
          <dd className="mt-1"><pre className="max-h-80 overflow-auto rounded-md bg-surface-wash p-3 text-xs">{JSON.stringify(e.data, null, 2)}</pre></dd></div>
      </dl>
    </Drawer>
  );
}

export default function Emails() {
  const toast = useToast();
  const { me } = useAdmin();
  const [rows, setRows] = useState<Email[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [tab, setTab] = useState<"all" | "problems" | "queued" | "team">("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Email | null>(null);
  const [test, setTest] = useState(false);
  const [to, setTo] = useState("");
  const load = () => {
    supabase.from("email_outbox").select("*").order("created_at", { ascending: false }).limit(500).then(({ data }) => setRows((data as Email[]) || []));
    supabase.rpc("admin_email_stats").then(({ data }) => setStats(data as Stats));
  };
  useEffect(() => {
    load();
    const t = window.setInterval(load, 20_000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => { if (test && !to) setTo(me?.email || ""); }, [test, me, to]);
  const list = useMemo(() => (rows || []).filter((e) => {
    if (tab === "problems" && e.status !== "failed") return false;
    if (tab === "queued" && !["queued", "sending"].includes(e.status)) return false;
    if (tab === "team" && e.kind !== "team") return false;
    if (tab === "all" && e.template === "_contact_sync") return false;
    const s = q.trim().toLowerCase();
    return !s || `${e.to_email} ${e.to_name} ${NAMES[e.template] || e.template}`.toLowerCase().includes(s);
  }), [rows, tab, q]);
  const sendTest = async (ev: FormEvent) => {
    ev.preventDefault();
    const { error } = await supabase.rpc("admin_email_test", { p_to: to.trim() });
    if (error) toast(errorMessage(error), "error"); else { toast("Test email queued. Check the inbox in a minute."); setTest(false); load(); }
  };
  const failed = (rows || []).filter((e) => e.status === "failed").length;
  return (
    <div>
      <PageHead title="Emails" subtitle="Every automatic email: welcome, reminders, receipts, support replies and shop updates. Sent through Brevo."
        actions={<><SearchInput value={q} onChange={setQ} placeholder="Email, name or type" /><Button variant="secondary" icon="mail" onClick={() => setTest(true)}>Send test</Button></>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Sent today" value={stats ? `${stats.sent_today} / ${CAP}` : "…"} sub="Brevo free plan: 300 a day" icon="mail" tone={stats && stats.sent_today > CAP * 0.8 ? "alert" : undefined} />
        <Kpi label="Waiting to send" value={stats?.queued ?? "…"} sub="Goes out within a minute" icon="clock" />
        <Kpi label="Failed, last 7 days" value={stats?.failed_7d ?? "…"} sub={failed ? "Open one to see why and send again" : "All good"} icon="info" tone={stats?.failed_7d ? "alert" : undefined} onClick={() => setTab("problems")} />
        <Kpi label="Newsletter subscribers" value={stats?.newsletter ?? "…"} sub={stats ? `${stats.reminders_off} hosts turned reminders off` : ""} icon="users" />
      </div>
      <div className="overflow-hidden rounded-[18px] border border-line bg-surface">
        <div className="px-3"><Tabs value={tab} onChange={setTab} items={[
          { value: "all", label: "All" }, { value: "problems", label: "Failed", count: failed || undefined },
          { value: "queued", label: "Waiting" }, { value: "team", label: "Team alerts" },
        ]} /></div>
        {rows === null ? <Skeleton /> : !list.length ? <Empty icon="mail" title="No emails here yet" body="Emails appear here as soon as something triggers one, like a sign-up, an order or a support reply." /> : (
          <div className="max-h-[62vh] overflow-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead><tr><Th>Email</Th><Th>To</Th><Th>Status</Th><Th>When</Th></tr></thead>
              <tbody>{list.map((e) => (
                <tr key={e.id} onClick={() => setOpen(e)} className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-wash">
                  <Td><p className="font-semibold">{NAMES[e.template] || e.template}</p><p className="text-xs capitalize text-ink-muted">{e.kind}</p></Td>
                  <Td><p>{e.to_name || e.to_email}</p>{e.to_name && <p className="text-xs text-ink-muted">{e.to_email}</p>}</Td>
                  <Td><Pill tone={TONE[e.status]}>{LABEL[e.status]}</Pill>{e.error && e.status !== "sent" && <p className="mt-1 max-w-[16rem] truncate text-xs text-ink-muted" title={e.error}>{e.error}</p>}</Td>
                  <Td className="whitespace-nowrap text-ink-muted">{timeAgo(e.sent_at || e.created_at)}</Td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
      {open && <Detail e={open} onClose={() => setOpen(null)} onRetried={load} />}
      <Modal open={test} onClose={() => setTest(false)} title="Send a test email"
        footer={<><Button variant="ghost" onClick={() => setTest(false)}>Cancel</Button><Button type="submit" form="test-email" disabled={!to.includes("@")}>Send test</Button></>}>
        <form id="test-email" onSubmit={sendTest} className="space-y-3">
          <p className="text-sm text-ink-muted">Checks that Brevo is connected. It arrives from Karibu TV &lt;hello@mrserengeti.com&gt;.</p>
          <Input type="email" value={to} onChange={(ev) => setTo(ev.target.value)} aria-label="Send to" placeholder="you@example.com" />
        </form>
      </Modal>
    </div>
  );
}
