export type AdaptiveHistoryAction = "REDUCE" | "RECOVER" | "STOP";
export type AdaptiveHistoryEntry = { id: string; timestamp: number; voltage: number; previousCurrent: number; appliedCurrent: number | null; action: AdaptiveHistoryAction; reason: string };
const KEY = "evergy:adaptive-history";
const MAX_ENTRIES = 5;
export function getAdaptiveHistory(): AdaptiveHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try { const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "[]"); if (!Array.isArray(parsed)) return []; return parsed.filter((entry): entry is AdaptiveHistoryEntry => entry && typeof entry.id === "string" && typeof entry.timestamp === "number" && typeof entry.voltage === "number" && typeof entry.previousCurrent === "number" && (typeof entry.appliedCurrent === "number" || entry.appliedCurrent === null) && ["REDUCE", "RECOVER", "STOP"].includes(entry.action) && typeof entry.reason === "string").slice(0, MAX_ENTRIES); } catch { return []; }
}
export function addAdaptiveHistory(entry: Omit<AdaptiveHistoryEntry, "id">): AdaptiveHistoryEntry[] {
  if (typeof window === "undefined") return [];
  const previous = getAdaptiveHistory();
  if (previous.some((item) => item.action === entry.action && Math.round(item.voltage) === Math.round(entry.voltage) && item.appliedCurrent === entry.appliedCurrent)) return previous;
  const next = [{ ...entry, id: `${entry.timestamp}-${Math.random().toString(36).slice(2, 8)}` }, ...previous].slice(0, MAX_ENTRIES);
  try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage is optional */ }
  return next;
}
