import { useState, type FormEvent } from "react";
import { adminApi, errorMessage } from "@/lib/supabase";
import { useAdmin } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { timeAgo } from "@/lib/format";
import { useHosts } from "@/lib/data";
import { Button, Field, Input, Modal, Select } from "@/components/ui";
import { PageHead, Panel, Pill, Skeleton, Td, Th } from "@/components/admin";

const ROLES = [
  { value: "owner", label: "Owner", hint: "Everything, including team, deleting accounts and settings." },
  { value: "support", label: "Support", hint: "Hosts, tickets, TV fleet and shop orders." },
  { value: "sales", label: "Sales", hint: "Pipeline, hosts, billing and shop." },
  { value: "ops", label: "Operations", hint: "Hosts, TV fleet, messages, shop and tickets." },
];

export default function Team() {
  const toast = useToast();
  const { me } = useAdmin();
  const { hosts, reload } = useHosts();
  const [invite, setInvite] = useState(false);
  const [f, setF] = useState({ name: "", email: "", admin_role: "support" });
  const [busy, setBusy] = useState("");
  const team = (hosts || []).filter((h) => h.role === "admin");
  const owner = me?.admin_role === "owner";
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy("invite");
    try { await adminApi("invite_admin", f); toast(`Invite sent to ${f.email}. They set a password, then turn on two-step.`); setInvite(false); setF({ name: "", email: "", admin_role: "support" }); reload(); }
    catch (err) { toast(errorMessage(err), "error"); } finally { setBusy(""); }
  };
  const setRole = async (id: string, role: string | null) => {
    setBusy(id);
    try { await adminApi("set_admin_role", { user_id: id, admin_role: role }); toast(role ? "Role updated." : "Admin access removed."); reload(); }
    catch (err) { toast(errorMessage(err), "error"); } finally { setBusy(""); }
  };
  return (
    <div>
      <PageHead title="Team" subtitle="People who can use this admin. Everyone signs in with two-step verification." actions={owner && <Button icon="plus" onClick={() => setInvite(true)}>Invite teammate</Button>} />
      <Panel pad={false}>
        {hosts === null ? <Skeleton /> : (
          <table className="w-full text-sm">
            <thead><tr><Th>Person</Th><Th>Role</Th><Th>Last sign-in</Th><Th></Th></tr></thead>
            <tbody>{team.map((t) => (
              <tr key={t.id} className="border-b border-line last:border-0">
                <Td><p className="font-semibold">{t.name || t.email}{t.id === me?.id && <span className="ml-2 text-xs text-ink-muted">(you)</span>}</p><p className="text-xs text-ink-muted">{t.email}</p></Td>
                <Td>{owner && t.id !== me?.id ? (
                  <Select value={t.admin_role || "support"} onChange={(e) => setRole(t.id, e.target.value)} aria-label="Role" className="!min-h-[36px] !w-auto !py-1 text-sm" disabled={busy === t.id}>
                    {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </Select>
                ) : <Pill tone="navy">{ROLES.find((r) => r.value === t.admin_role)?.label || "Admin"}</Pill>}</Td>
                <Td className="text-ink-muted">{t.email_confirmed_at ? timeAgo(t.last_sign_in_at) : <Pill tone="gray">Invited</Pill>}</Td>
                <Td className="text-right">{owner && t.id !== me?.id && <Button size="sm" variant="ghost" className="!text-danger" loading={busy === t.id} onClick={() => setRole(t.id, null)}>Remove access</Button>}</Td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Panel>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ROLES.map((r) => <div key={r.value} className="rounded-[16px] border border-line bg-surface p-4"><p className="font-semibold">{r.label}</p><p className="mt-1 text-sm text-ink-muted">{r.hint}</p></div>)}
      </div>
      <Modal open={invite} onClose={() => setInvite(false)} title="Invite a teammate"
        footer={<><Button variant="ghost" onClick={() => setInvite(false)}>Cancel</Button><Button type="submit" form="invite" loading={busy === "invite"} disabled={!f.email.includes("@")}>Send invite</Button></>}>
        <form id="invite" onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">{(id) => <Input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
            <Field label="Email">{(id) => <Input id={id} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />}</Field>
          </div>
          <Field label="Role" hint={ROLES.find((r) => r.value === f.admin_role)?.hint}>{(id) => <Select id={id} value={f.admin_role} onChange={(e) => setF({ ...f, admin_role: e.target.value })}>{ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</Select>}</Field>
        </form>
      </Modal>
    </div>
  );
}
