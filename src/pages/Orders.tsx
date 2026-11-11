import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase, errorMessage, HOST_APP } from "@/lib/supabase";
import { useToast } from "@/lib/toast";
import { fmtDateTime, kes, timeAgo, waUrl } from "@/lib/format";
import { Icon, WhatsAppIcon } from "@/components/Icons";
import { Button, Field, Input, Textarea } from "@/components/ui";
import { Drawer, Empty, Kpi, PageHead, Pill, SearchInput, Skeleton, Tabs, Td, Th, type Tone } from "@/components/admin";

interface Order {
  id: string; number: number; name: string; phone: string; email: string; zone_name: string; address: string;
  fulfilment: "delivery" | "delivery_setup"; payment_method: "mpesa_till" | "cod" | "whatsapp"; mpesa_code: string;
  items: { name: string; qty: number; price_kes: number; image: string }[]; subtotal_kes: number; delivery_kes: number; setup_kes: number; total_kes: number;
  status: Status; note: string; admin_note: string; created_at: string; updated_at: string;
}
type Status = "new" | "awaiting_payment" | "paid" | "packed" | "dispatched" | "delivered" | "cancelled";
const LABEL: Record<Status, string> = { new: "New", awaiting_payment: "Awaiting payment", paid: "Paid", packed: "Packed", dispatched: "Out for delivery", delivered: "Delivered", cancelled: "Cancelled" };
const TONE: Record<Status, Tone> = { new: "blue", awaiting_payment: "amber", paid: "maroon", packed: "maroon", dispatched: "navy", delivered: "green", cancelled: "gray" };
const NEXT: Partial<Record<Status, Status>> = { new: "paid", awaiting_payment: "paid", paid: "packed", packed: "dispatched", dispatched: "delivered" };
const PAY: Record<Order["payment_method"], string> = { mpesa_till: "M-Pesa till", cod: "Pay on delivery", whatsapp: "WhatsApp" };

function OrderDrawer({ o, onClose, onChanged }: { o: Order; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [note, setNote] = useState(o.admin_note);
  const [code, setCode] = useState(o.mpesa_code);
  const [busy, setBusy] = useState("");
  const setStatus = async (s: Status) => {
    setBusy(s);
    if (code !== o.mpesa_code) await supabase.from("orders").update({ mpesa_code: code.trim().toUpperCase() }).eq("id", o.id);
    const { error } = await supabase.rpc("admin_order_status", { p_order: o.id, p_status: s, p_note: note });
    setBusy("");
    if (error) toast(errorMessage(error), "error"); else { toast(s === "cancelled" ? "Order cancelled; stock returned." : `Marked ${LABEL[s].toLowerCase()}.`); onChanged(); }
  };
  const next = NEXT[o.status];
  const msg = `Hi ${o.name.split(" ")[0]}, this is Karibu TV about your order #${o.number}.`;
  return (
    <Drawer open onClose={onClose} title={`Order #${o.number}`} subtitle={<span className="flex items-center gap-2"><Pill tone={TONE[o.status]}>{LABEL[o.status]}</Pill>{fmtDateTime(o.created_at)}</span>}
      footer={<>
        {o.status !== "cancelled" && o.status !== "delivered" && <Button variant="ghost" loading={busy === "cancelled"} onClick={() => setStatus("cancelled")}>Cancel order</Button>}
        <Button variant="secondary" loading={busy === "save"} onClick={async () => { setBusy("save"); await supabase.from("orders").update({ admin_note: note, mpesa_code: code.trim().toUpperCase() }).eq("id", o.id); setBusy(""); toast("Saved."); onChanged(); }}>Save note</Button>
        {next && <Button loading={busy === next} onClick={() => setStatus(next)}>Mark {LABEL[next].toLowerCase()}</Button>}
      </>}>
      <div className="space-y-6">
        <ol className="flex items-center gap-1" aria-label="Progress">
          {(["new", "paid", "packed", "dispatched", "delivered"] as Status[]).map((s, i, arr) => {
            const idx = arr.indexOf(o.status === "awaiting_payment" ? "new" : o.status);
            return <li key={s} className="flex-1"><span className={`block h-1.5 rounded-full ${o.status !== "cancelled" && i <= idx ? "bg-maroon" : "bg-line"}`} /><span className="mt-1 block text-[10px] font-semibold text-ink-muted">{LABEL[s]}</span></li>;
          })}
        </ol>
        <section>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Customer</p>
          <p className="mt-1 font-semibold">{o.name}</p>
          <p className="text-sm">{o.phone}{o.email ? ` · ${o.email}` : ""}</p>
          <div className="mt-2 flex gap-2">
            <a className="kb-btn kb-btn--secondary kb-btn--sm" href={`tel:${o.phone}`}><Icon name="phone" size={14} />Call</a>
            <a className="kb-btn kb-btn--secondary kb-btn--sm" href={waUrl(o.phone, msg)} target="_blank" rel="noreferrer"><WhatsAppIcon size={14} />WhatsApp</a>
          </div>
        </section>
        <section>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{o.fulfilment === "delivery_setup" ? "Delivery and setup visit" : "Delivery"}</p>
          <p className="mt-1 text-sm"><b>{o.zone_name}</b><br />{o.address}</p>
          {o.note && <p className="mt-2 rounded-md bg-surface-wash p-2 text-sm">“{o.note}”</p>}
        </section>
        <section>
          <ul className="space-y-2">{o.items.map((it) => <li key={it.name} className="flex items-center gap-3 text-sm"><img src={it.image.startsWith("/") ? `${HOST_APP}${it.image}` : it.image} alt="" className="h-10 w-10 rounded bg-surface-wash object-contain p-1" /><span className="flex-1">{it.qty} × {it.name}</span><span className="tabular-nums">{kes(it.price_kes * it.qty)}</span></li>)}</ul>
          <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
            <div className="flex justify-between"><dt className="text-ink-muted">Delivery</dt><dd>{kes(o.delivery_kes)}</dd></div>
            {o.setup_kes > 0 && <div className="flex justify-between"><dt className="text-ink-muted">Setup visit</dt><dd>{kes(o.setup_kes)}</dd></div>}
            <div className="flex justify-between font-semibold"><dt>Total</dt><dd>{kes(o.total_kes)}</dd></div>
          </dl>
        </section>
        <section className="grid gap-4 sm:grid-cols-2">
          <div><p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Payment</p><p className="mt-1 font-semibold">{PAY[o.payment_method]}</p></div>
          <Field label="M-Pesa code" optional>{(id) => <Input id={id} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Check it in your M-Pesa statement" />}</Field>
        </section>
        <Field label="Team note">{(id) => <Textarea id={id} value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Rider, delivery time, setup notes…" />}</Field>
      </div>
    </Drawer>
  );
}

export default function Orders() {
  const [params, setParams] = useSearchParams();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [tab, setTab] = useState<"todo" | "transit" | "done" | "all">("todo");
  const [q, setQ] = useState(params.get("q") || "");
  const load = () => supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(500).then(({ data }) => setOrders((data as Order[]) || []));
  useEffect(() => {
    load();
    const ch = supabase.channel("adm-orders").on("postgres_changes", { event: "*", schema: "public", table: "orders" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);
  const open = (orders || []).find((o) => o.id === params.get("open"));
  const list = useMemo(() => (orders || []).filter((o) => {
    if (q.trim() && !`${o.number} ${o.name} ${o.phone} ${o.mpesa_code}`.toLowerCase().includes(q.trim().toLowerCase())) return false;
    if (tab === "todo") return ["new", "awaiting_payment", "paid", "packed"].includes(o.status);
    if (tab === "transit") return o.status === "dispatched";
    if (tab === "done") return ["delivered", "cancelled"].includes(o.status);
    return true;
  }), [orders, tab, q]);
  const sold = (orders || []).filter((o) => ["paid", "packed", "dispatched", "delivered"].includes(o.status));
  const month = sold.filter((o) => Date.now() - Date.parse(o.created_at) < 30 * 864e5);
  return (
    <div>
      <PageHead title="Orders" subtitle="Shop orders from the website. Mark each step as it happens." actions={<SearchInput value={q} onChange={setQ} placeholder="Order #, name, phone, M-Pesa code" />} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Kpi label="Sales, last 30 days" value={kes(month.reduce((n, o) => n + o.total_kes, 0))} sub={`${month.length} orders`} icon="bag" />
        <Kpi label="To pack and send" value={(orders || []).filter((o) => ["paid", "new"].includes(o.status)).length} icon="box" />
        <Kpi label="Awaiting M-Pesa" value={(orders || []).filter((o) => o.status === "awaiting_payment").length} sub="Check your till statement" icon="card" />
      </div>
      <div className="overflow-hidden rounded-[18px] border border-line bg-surface">
        <div className="px-3"><Tabs value={tab} onChange={setTab} items={[{ value: "todo", label: "To do" }, { value: "transit", label: "Out for delivery" }, { value: "done", label: "Done" }, { value: "all", label: "All" }]} /></div>
        {orders === null ? <Skeleton /> : !list.length ? <Empty icon="bag" title="No orders here" /> : (
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead><tr><Th>Order</Th><Th>Customer</Th><Th>Items</Th><Th>Total</Th><Th>Payment</Th><Th>Delivery</Th><Th>Status</Th></tr></thead>
              <tbody>{list.map((o) => (
                <tr key={o.id} onClick={() => setParams({ open: o.id })} className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-wash">
                  <Td><p className="font-semibold">#{o.number}</p><p className="text-xs text-ink-muted">{timeAgo(o.created_at)}</p></Td>
                  <Td><p className="font-medium">{o.name}</p><p className="text-xs text-ink-muted">{o.phone}</p></Td>
                  <Td className="max-w-[16rem] truncate">{o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</Td>
                  <Td className="font-semibold tabular-nums">{kes(o.total_kes)}</Td>
                  <Td>{PAY[o.payment_method]}{o.mpesa_code && <p className="font-mono text-xs text-ink-muted">{o.mpesa_code}</p>}</Td>
                  <Td>{o.zone_name}{o.fulfilment === "delivery_setup" && <Pill tone="maroon">+ setup</Pill>}</Td>
                  <Td><Pill tone={TONE[o.status]}>{LABEL[o.status]}</Pill></Td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
      {open && <OrderDrawer key={open.id + open.updated_at} o={open} onClose={() => setParams({})} onChanged={load} />}
    </div>
  );
}
