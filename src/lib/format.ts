export const kes = (n: number | null | undefined) => `KES ${Math.round(Number(n) || 0).toLocaleString("en-KE")}`;
export function timeAgo(iso?: string | null) {
  if (!iso) return "never";
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
export const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "-");
export const fmtDateTime = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "-");
export const isOnline = (iso?: string | null) => !!iso && Date.now() - Date.parse(iso) < 10 * 60_000;
export const waUrl = (phone: string, text?: string) => `https://wa.me/${phone.replace(/\D/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
