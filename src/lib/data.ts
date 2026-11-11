import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";

export interface Host {
  id: string; name: string; email: string; whatsapp: string; country: string; role: string; admin_role: string | null; business_name: string;
  plan: "free" | "pro"; plan_until: string | null; pro_tvs: number; trial: boolean; active: boolean; created_at: string;
  last_sign_in_at: string | null; email_confirmed_at: string | null;
  properties: number; tvs: number; tvs_online: number; open_tickets: number; paid_kes: number;
}
export const isPro = (h: Pick<Host, "plan" | "plan_until">) => h.plan === "pro" && !!h.plan_until && Date.parse(h.plan_until) > Date.now();
export const planLabel = (h: Host) => (!h.active ? "Paused" : isPro(h) ? (h.trial ? "Trial" : "Pro") : "Free");
export const planTone = (h: Host) => (!h.active ? "red" : isPro(h) ? (h.trial ? "amber" : "navy") : "gray") as "red" | "amber" | "navy" | "gray";

export function useHosts() {
  const [hosts, setHosts] = useState<Host[] | null>(null);
  const load = useCallback(() => supabase.rpc("admin_hosts").then(({ data }) => setHosts((data as Host[]) || [])), []);
  useEffect(() => { load(); }, [load]);
  return { hosts, reload: load };
}
