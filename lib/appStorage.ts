export type ChargerConfig = { id: string; name: string };
export type CarProfile = {
  name: string; batteryKwh: number | null; consumptionKwhPer100Km: number | null;
  reservePercent: number; dayRate: number | null; nightRate: number | null;
  nightStart: string; nightEnd: string; currency: string; splitTariff: boolean;
  groundingControl: boolean; leakageProtection: "30mA" | "100mA" | "off"; minimumChargingVoltage: number | null; scheduleStart: string; scheduleEnd: string; scheduleEnabled: boolean;
};

const CHARGERS_KEY = "evergy-chargers";
const ACTIVE_KEY = "evergy-active-charger";
const CAR_KEY = "evergy-car-profile";

const defaultCar: CarProfile = { name: "Моє авто", batteryKwh: null, consumptionKwhPer100Km: null, reservePercent: 10, dayRate: null, nightRate: null, nightStart: "23:00", nightEnd: "07:00", currency: "UAH", splitTariff: false, groundingControl: true, leakageProtection: "30mA", minimumChargingVoltage: null, scheduleStart: "23:00", scheduleEnd: "07:00", scheduleEnabled: false };
const browser = () => typeof window !== "undefined";
function read<T>(key: string, fallback: T): T { if (!browser()) return fallback; try { const value = JSON.parse(localStorage.getItem(key) ?? "null"); return value ?? fallback; } catch { return fallback; } }
function write<T>(key: string, value: T) { if (browser()) localStorage.setItem(key, JSON.stringify(value)); }

export function getChargers(): ChargerConfig[] { return read<ChargerConfig[]>(CHARGERS_KEY, []); }
export function getActiveChargerId(): string | null {
  if (!browser()) return null;
  return localStorage.getItem(ACTIVE_KEY);
}
export function saveChargers(value: ChargerConfig[]) { write(CHARGERS_KEY, value); }
export function saveActiveChargerId(id: string) { if (browser()) localStorage.setItem(ACTIVE_KEY, id); }
export function getCarProfile(): CarProfile {
  const saved = read<Partial<CarProfile>>(CAR_KEY, {});
  return { ...defaultCar, ...saved, leakageProtection: saved.leakageProtection ?? (saved.groundingControl === false ? "off" : "30mA") };
}
export function saveCarProfile(value: CarProfile) { write(CAR_KEY, value); }
export { defaultCar };
