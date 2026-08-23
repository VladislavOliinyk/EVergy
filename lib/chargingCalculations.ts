import type { CarProfile } from "./appStorage";
export function sessionCost(energy: number | null, profile: CarProfile, endedAt: number | null = Date.now()) {
  if (energy === null) return null;
  const hour = new Date(endedAt ?? Date.now()).getHours() * 60 + new Date(endedAt ?? Date.now()).getMinutes();
  const start = Number(profile.nightStart.split(":")[0]) * 60 + Number(profile.nightStart.split(":")[1]);
  const end = Number(profile.nightEnd.split(":")[0]) * 60 + Number(profile.nightEnd.split(":")[1]);
  const night = start < end ? hour >= start && hour < end : hour >= start || hour < end;
  const rate = profile.splitTariff ? (night ? profile.nightRate : profile.dayRate) : profile.dayRate ?? profile.nightRate;
  return rate === null ? null : energy * rate;
}
export function estimatedRange(energy: number | null, profile: CarProfile) { return energy !== null && profile.consumptionKwhPer100Km ? energy / profile.consumptionKwhPer100Km * 100 : null; }
export function batteryAddedPercent(energy: number | null, profile: CarProfile) { return energy !== null && profile.batteryKwh ? energy / profile.batteryKwh * 100 : null; }
