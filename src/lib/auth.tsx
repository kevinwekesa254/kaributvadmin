// Admin access: sign in, then a code from an authenticator app every time (aal2).
// Hosts can't get past this gate, and the database enforces the same rule (public.admin_ok()).
import { createContext, useCallback, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseConfigured, errorMessage } from "./supabase";
import { passwordProblem } from "./password";
import { Logo } from "@/components/Logo";
import { Button, Field, Input, PageLoader } from "@/components/ui";

export interface AdminProfile { id: string; name: string; avatar: string; role: string; admin_role: "owner" | "support" | "sales" | "ops" | null; email: string }
type Gate = "loading" | "signed_out" | "need_code" | "need_setup" | "denied" | "ok";

interface Ctx { me: AdminProfile | null; signOut: () => Promise<void>; can: (area: Area) => boolean }
const AuthCtx = createContext<Ctx>({ me: null, signOut: async () => {}, can: () => false });
export const useAdmin = () => useContext(AuthCtx);

export type Area = "sales" | "hosts" | "support" | "billing" | "shop" | "ops" | "team" | "settings";
const ACCESS: Record<string, Area[]> = {
  owner: ["sales", "hosts", "support", "billing", "shop", "ops", "team", "settings"],
  support: ["hosts", "support", "ops", "shop"],
  sales: ["sales", "hosts", "billing", "shop"],
  ops: ["hosts", "ops", "shop", "support"],
};

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-navy p-4">
      <div aria-hidden className="kb-kitenge-panel pointer-events-none fixed inset-0 opacity-[0.06]" />
      <div className="relative w-full max-w-md overflow-hidden rounded-[22px] bg-surface shadow-[0_40px_90px_-30px_rgba(0,0,0,.6)]">
        <div className="kb-kikoi" />
        <div className="p-7 sm:p-9">
          <div className="flex items-center justify-between"><Logo to="/" /><span className="rounded-full bg-navy px-2.5 py-0.5 text-[10px] font-bold tracking-[0.14em] text-white">ADMIN</span></div>
          <h1 className="mt-7 font-display text-2xl font-semibold text-navy">{title}</h1>
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

function SignIn() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
    if (error) setErr("Wrong email or password."); setBusy(false);
  };
  const reset = async () => {
    if (!email.trim()) { setErr("Type your email first."); return; }
    await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/set-password` });
    setSent(true);
  };
  return (
    <Shell title="Sign in to admin">
      {!supabaseConfigured && <p className="mb-4 rounded-md bg-warning/10 p-3 text-sm text-warning">Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.</p>}
      <form onSubmit={submit} className="space-y-4">
        {err && <p role="alert" className="kb-error !mt-0">{err}</p>}
        {sent && <p className="rounded-md bg-mint-soft p-3 text-sm">If that's an admin account, a reset link is on its way.</p>}
        <Field label="Email">{(id) => <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />}</Field>
        <Field label="Password">{(id) => <Input id={id} type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" />}</Field>
        <Button type="submit" size="lg" className="w-full" loading={busy}>Continue</Button>
        <button type="button" onClick={reset} className="w-full text-center text-sm font-semibold text-ink-muted underline">Forgot password?</button>
      </form>
    </Shell>
  );
}

function Code({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      const f = data?.totp.find((x) => x.status === "verified");
      if (!f) throw new Error("No authenticator app on this account.");
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: f.id, code: code.replace(/\s/g, "") });
      if (error) throw error;
      onDone();
    } catch (e2) { setErr(errorMessage(e2, "That code didn't work.")); } finally { setBusy(false); }
  };
  return (
    <Shell title="Two-step verification">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-ink-muted">Enter the 6-digit code from your authenticator app.</p>
        {err && <p role="alert" className="kb-error">{err}</p>}
        <Input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={7} autoFocus aria-label="6-digit code" className="text-center font-display text-3xl tracking-[0.4em]" />
        <Button type="submit" size="lg" className="w-full" loading={busy} disabled={code.replace(/\s/g, "").length !== 6}>Verify</Button>
        <button type="button" onClick={() => supabase.auth.signOut()} className="w-full text-center text-sm font-semibold text-ink-muted underline">Use another account</button>
      </form>
    </Shell>
  );
}

function SetupTotp({ onDone }: { onDone: () => void }) {
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    (async () => {
      const { data: all } = await supabase.auth.mfa.listFactors();
      for (const f of all?.all || []) if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Karibu Admin ${new Date().toISOString().slice(0, 10)}` });
      if (error) { setErr(errorMessage(error)); return; }
      if (data.type === "totp") setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    })();
  }, []);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); if (!enroll) return; setBusy(true); setErr("");
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enroll.id, code: code.replace(/\s/g, "") });
    setBusy(false);
    if (error) setErr("That code didn't work. Check the time on your phone."); else onDone();
  };
  return (
    <Shell title="Protect admin with two-step">
      <p className="text-ink-muted">Admin needs a code from an authenticator app (Google Authenticator, Authy, 1Password). Scan this once.</p>
      {err && <p role="alert" className="kb-error">{err}</p>}
      {enroll ? (
        <form onSubmit={submit} className="mt-5 space-y-4">
          <div className="flex items-center gap-4">
            <img src={enroll.qr} alt="QR code for your authenticator app" className="h-36 w-36 rounded-md border border-line bg-white p-2" />
            <code className="break-all text-xs text-ink-muted">{enroll.secret}</code>
          </div>
          <Input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={7} aria-label="6-digit code" className="text-center font-display text-2xl tracking-[0.4em]" />
          <Button type="submit" size="lg" className="w-full" loading={busy} disabled={code.replace(/\s/g, "").length !== 6}>Turn on and continue</Button>
        </form>
      ) : <div className="mt-6"><PageLoader /></div>}
    </Shell>
  );
}

/** Landing page for invite and password-reset emails. */
export function SetPassword() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const p = passwordProblem(pw); if (p) { setErr(p); return; }
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) setErr(errorMessage(error)); else { setDone(true); setTimeout(() => window.location.replace("/"), 1200); }
  };
  return (
    <Shell title="Choose your password">
      {done ? <p className="text-ink-muted">Saved. Taking you in…</p> : (
        <form onSubmit={submit} className="space-y-4">
          {err && <p role="alert" className="kb-error">{err}</p>}
          <Field label="New password" hint="10+ characters, letters and numbers.">{(id) => <Input id={id} type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />}</Field>
          <Button type="submit" size="lg" className="w-full">Save password</Button>
        </form>
      )}
    </Shell>
  );
}

export function AdminGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [gate, setGate] = useState<Gate>("loading");
  const [me, setMe] = useState<AdminProfile | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const evaluate = useCallback(async () => {
    if (session === undefined) return;
    if (!session) { setGate("signed_out"); setMe(null); return; }
    const { data: p } = await supabase.from("profiles").select("id, name, avatar, role, admin_role").eq("id", session.user.id).maybeSingle();
    if (!p || p.role !== "admin") { setGate("denied"); return; }
    setMe({ ...(p as Omit<AdminProfile, "email">), email: session.user.email || "" });
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.currentLevel === "aal2") setGate("ok");
    else setGate(aal?.nextLevel === "aal2" ? "need_code" : "need_setup");
  }, [session]);
  useEffect(() => { evaluate(); }, [evaluate]);

  const signOut = async () => { await supabase.auth.signOut(); };
  const can = (area: Area) => !!me?.admin_role && ACCESS[me.admin_role]?.includes(area);

  if (gate === "loading") return <div className="flex min-h-[100dvh] items-center justify-center bg-navy"><PageLoader /></div>;
  if (gate === "signed_out") return <SignIn />;
  if (gate === "denied") return (
    <Shell title="Admins only">
      <p className="text-ink-muted">This account doesn't have admin access. Hosts sign in at the host dashboard.</p>
      <Button className="mt-5 w-full" onClick={signOut}>Sign out</Button>
    </Shell>
  );
  if (gate === "need_code") return <Code onDone={evaluate} />;
  if (gate === "need_setup") return <SetupTotp onDone={evaluate} />;
  return <AuthCtx.Provider value={{ me, signOut, can }}>{children}</AuthCtx.Provider>;
}
