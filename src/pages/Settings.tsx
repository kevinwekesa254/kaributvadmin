import { useEffect, useState } from "react";
import { supabase, errorMessage } from "@/lib/supabase";
import { useToast } from "@/lib/toast";
import { Button, Field, Input } from "@/components/ui";
import { PageHead, Panel } from "@/components/admin";

interface Shop { mpesa_till: string; mpesa_name: string; whatsapp: string; pickup_note?: string }
interface Support { whatsapp: string; email: string; hours: string }

export default function Settings() {
  const toast = useToast();
  const [shop, setShop] = useState<Shop>({ mpesa_till: "", mpesa_name: "", whatsapp: "" });
  const [support, setSupport] = useState<Support>({ whatsapp: "", email: "", hours: "" });
  useEffect(() => {
    supabase.from("app_settings").select("key, value").in("key", ["shop", "support"]).then(({ data }) => {
      for (const r of (data as { key: string; value: Shop & Support }[]) || []) { if (r.key === "shop") setShop(r.value); if (r.key === "support") setSupport(r.value); }
    });
  }, []);
  const save = async (key: string, value: object) => {
    const { error } = await supabase.from("app_settings").upsert({ key, value, public: true, updated_at: new Date().toISOString() });
    if (error) toast(errorMessage(error), "error"); else toast("Saved.");
  };
  return (
    <div className="max-w-3xl">
      <PageHead title="Settings" subtitle="Details shown to hosts and shoppers." />
      <div className="space-y-6">
        <Panel title="Shop payments">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="M-Pesa till number (Buy Goods)" hint="Shown at checkout and on the order page.">{(id) => <Input id={id} value={shop.mpesa_till} onChange={(e) => setShop({ ...shop, mpesa_till: e.target.value.replace(/\D/g, "") })} inputMode="numeric" />}</Field>
            <Field label="Till name">{(id) => <Input id={id} value={shop.mpesa_name} onChange={(e) => setShop({ ...shop, mpesa_name: e.target.value })} />}</Field>
            <Field label="Shop WhatsApp" className="sm:col-span-2">{(id) => <Input id={id} value={shop.whatsapp} onChange={(e) => setShop({ ...shop, whatsapp: e.target.value })} placeholder="+254…" />}</Field>
          </div>
          <Button className="mt-4" onClick={() => save("shop", shop)}>Save shop settings</Button>
        </Panel>
        <Panel title="Support contacts">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Support WhatsApp">{(id) => <Input id={id} value={support.whatsapp} onChange={(e) => setSupport({ ...support, whatsapp: e.target.value })} />}</Field>
            <Field label="Support email">{(id) => <Input id={id} type="email" value={support.email} onChange={(e) => setSupport({ ...support, email: e.target.value })} />}</Field>
            <Field label="Hours" className="sm:col-span-2">{(id) => <Input id={id} value={support.hours} onChange={(e) => setSupport({ ...support, hours: e.target.value })} placeholder="Mon-Sat, 8am-8pm EAT" />}</Field>
          </div>
          <Button className="mt-4" onClick={() => save("support", support)}>Save support contacts</Button>
        </Panel>
        <Panel title="Security">
          <ul className="space-y-2 text-sm">
            <li>Every admin signs in with a password and a code from an authenticator app. The database refuses admin data without both.</li>
            <li>Every admin action is written to the audit log, which nobody can edit.</li>
            <li>Account changes that need Supabase's master key (create, reset, pause, delete) run in the admin-api server function, never in the browser.</li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}
