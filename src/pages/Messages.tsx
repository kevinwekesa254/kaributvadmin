import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase, errorMessage } from "@/lib/supabase";
import { useToast } from "@/lib/toast";
import { timeAgo } from "@/lib/format";
import { COUNTRIES } from "@/lib/countries";
import { isPro, useHosts, type Host } from "@/lib/data";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { PageHead, Panel, Pill } from "@/components/admin";

interface Sent { id: string; user_id: string | null; title: string; body: string; link: string; tone: string; created_at: string }
type Audience = "all" | "one" | "trial_ending" | "trial" | "free" | "pro" | "country";
const AUDIENCES: { value: Audience; label: string }[] = [
  { value: "all", label: "Every host" }, { value: "one", label: "One host" }, { value: "trial_ending", label: "Trial ends within 7 days" },
  { value: "trial", label: "On trial" }, { value: "free", label: "Free plan" }, { value: "pro", label: "Paying Pro" }, { value: "country", label: "Hosts in a country" },
];

export default function Messages() {
  const toast = useToast();
  const [params] = useSearchParams();
  const { hosts } = useHosts();
  const [sent, setSent] = useState<Sent[]>([]);
  const [f, setF] = useState({ audience: (params.get("to") ? "one" : "all") as Audience, to: params.get("to") || "", country: "KE", title: "", body: "", link: "", tone: "info" });
  const [busy, setBusy] = useState(false);
  const loadSent = () => supabase.from("host_notifications").select("*").order("created_at", { ascending: false }).limit(40).then(({ data }) => setSent((data as Sent[]) || []));
  useEffect(() => { loadSent(); }, []);
  const real = (hosts || []).filter((h) => h.role !== "admin" && h.active);
  const recipients: Host[] = useMemo(() => {
    const now = Date.now();
    switch (f.audience) {
      case "one": return real.filter((h) => h.id === f.to);
      case "trial_ending": return real.filter((h) => h.trial && h.plan_until && Date.parse(h.plan_until) > now && Date.parse(h.plan_until) - now < 7 * 864e5);
      case "trial": return real.filter((h) => h.trial && isPro(h));
      case "free": return real.filter((h) => !isPro(h));
      case "pro": return real.filter((h) => isPro(h) && !h.trial);
      case "country": return real.filter((h) => h.country === f.country);
      default: return real;
    }
  }, [real, f.audience, f.to, f.country]);
  const linkOk = !f.link || /^(\/|https:\/\/)/.test(f.link);
  const send = async (e: FormEvent) => {
    e.preventDefault(); if (!f.title.trim() || !linkOk) return;
    setBusy(true);
    try {
      const args = { p_title: f.title.trim(), p_body: f.body.trim(), p_link: f.link.trim(), p_tone: f.tone };
      if (f.audience === "all") { const { error } = await supabase.rpc("admin_notify", { p_user: null, ...args }); if (error) throw error; }
      else for (const h of recipients) { const { error } = await supabase.rpc("admin_notify", { p_user: h.id, ...args }); if (error) throw error; }
      toast(`Sent to ${f.audience === "all" ? "every host" : `${recipients.length} host${recipients.length === 1 ? "" : "s"}`}.`);
      setF({ ...f, title: "", body: "", link: "" }); loadSent();
    } catch (err) { toast(errorMessage(err), "error"); } finally { setBusy(false); }
  };
  const who = (id: string | null) => (id ? (hosts || []).find((h) => h.id === id)?.email || "One host" : "Every host");
  return (
    <div>
      <PageHead title="Messages" subtitle="Announcements land in hosts' notification bell straight away." />
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <Panel title="New message">
          <form onSubmit={send} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Send to">{(id) => <Select id={id} value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value as Audience })}>{AUDIENCES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}</Select>}</Field>
              {f.audience === "one" && <Field label="Host">{(id) => <Select id={id} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })}><option value="">Choose…</option>{real.map((h) => <option key={h.id} value={h.id}>{h.name || h.email}</option>)}</Select>}</Field>}
              {f.audience === "country" && <Field label="Country">{(id) => <Select id={id} value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })}>{COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</Select>}</Field>}
            </div>
            <p className="text-sm text-ink-muted">{f.audience === "all" ? "Every host, including people who sign up later." : `${recipients.length} host${recipients.length === 1 ? "" : "s"} will get this.`}</p>
            <Field label="Title">{(id) => <Input id={id} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={80} placeholder="New: Safari Lodge template" />}</Field>
            <Field label="Message" optional>{(id) => <Textarea id={id} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} maxLength={500} rows={3} />}</Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Link" optional error={linkOk ? "" : "Start with / or https://"} hint="e.g. /app/billing">{(id) => <Input id={id} value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} />}</Field>
              <Field label="Style">{(id) => <Select id={id} value={f.tone} onChange={(e) => setF({ ...f, tone: e.target.value })}><option value="info">Announcement</option><option value="success">Good news</option><option value="warning">Action needed</option></Select>}</Field>
            </div>
            <Button type="submit" icon="megaphone" loading={busy} disabled={!f.title.trim() || !linkOk || (f.audience !== "all" && !recipients.length)}>Send</Button>
          </form>
        </Panel>
        <Panel title="Sent" pad={false}>
          <ul className="max-h-[70vh] divide-y divide-line overflow-y-auto">
            {sent.map((n) => <li key={n.id} className="px-5 py-3"><div className="flex justify-between gap-3"><p className="font-semibold">{n.title}</p><span className="shrink-0 text-xs text-ink-muted">{timeAgo(n.created_at)}</span></div>{n.body && <p className="text-sm text-ink-muted">{n.body}</p>}<div className="mt-1"><Pill tone="maroon">{who(n.user_id)}</Pill></div></li>)}
            {!sent.length && <li className="px-5 py-8 text-center text-sm text-ink-muted">Nothing sent yet.</li>}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
