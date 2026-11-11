import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const supabaseConfigured = !!(url && key);
export const supabase = createClient(url || "https://placeholder.supabase.co", key || "placeholder", {
  auth: { storageKey: "karibu-admin-auth", persistSession: true, autoRefreshToken: true },
});
export const HOST_APP = (import.meta.env.VITE_HOST_APP_URL as string | undefined) || "https://tv.mrserengeti.com";

interface PgLikeError { message?: string; context?: { json?: () => Promise<unknown> } }
export function errorMessage(err: unknown, fallback = "Something went wrong. Try again.") {
  const m = (err as PgLikeError)?.message || "";
  if (!m) return fallback;
  if (/forbidden|42501|permission denied/i.test(m)) return "You don't have permission for that.";
  return m.replace(/^(plan_limit|pro_required|rate_limited|account_paused):\s*/, "");
}

/** Calls the admin-api Edge Function (service-role actions, audited server-side). */
export async function adminApi<T = { ok: boolean }>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke("admin-api", { body: { action, ...payload } });
  if (error) {
    const ctx = (error as PgLikeError).context;
    let msg = error.message;
    try { const b = (await ctx?.json?.()) as { error?: string } | undefined; if (b?.error) msg = b.error; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return data as T;
}

export const mediaUrl = (path: string) => (!path ? "" : /^(https?:)?\//.test(path) ? path : supabase.storage.from("property-media").getPublicUrl(path).data.publicUrl);
