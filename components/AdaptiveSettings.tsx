"use client";

import { useState } from "react";
import type { CarProfile } from "../lib/appStorage";

type Props = { car: CarProfile; update: <K extends keyof CarProfile>(key: K, value: CarProfile[K]) => void; dark: boolean; uk: boolean; onSave?: () => void };

export function AdaptiveSettings({ car, update, dark, uk, onSave }: Props) {
  const [saved, setSaved] = useState(false);

  const field = `w-full min-w-0 rounded-xl border px-3 py-2 ${dark ? "border-white/10 bg-white/5 text-white" : "border-black/10 bg-white text-black"}`;
  const save = () => { onSave?.(); setSaved(true); window.setTimeout(() => setSaved(false), 1800); };

  return <section className="mt-8">
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-xs font-semibold tracking-[.2em] text-cyan-400">{uk ? "АДАПТИВНЕ ЗАРЯДЖАННЯ" : "ADAPTIVE CHARGING"}</h2>
        <p className="mt-1 text-sm text-zinc-500">{uk ? "Тримає найбільший струм без падіння напруги нижче заданої зони." : "Keeps the highest current without dropping below the selected voltage range."}</p>
      </div>
      <input type="checkbox" checked={car.adaptiveEnabled} onChange={e => update("adaptiveEnabled", e.target.checked)} className="h-5 w-5 accent-cyan-400" />
    </div>
    <div className={`mt-3 grid gap-4 rounded-3xl border p-5 ${dark ? "border-cyan-400/20 bg-cyan-400/[.035]" : "border-cyan-600/20 bg-cyan-500/[.04]"}`}>
      <div className="flex justify-between"><span>{uk ? "Адаптивний режим" : "Adaptive mode"}</span><span className="text-xs text-cyan-400">{car.adaptiveEnabled ? (uk ? "УВІМКНЕНО" : "ON") : (uk ? "ВИМКНЕНО" : "OFF")}</span></div>
      <label><span className="text-xs text-zinc-500">{uk ? "Цільова напруга, В" : "Target voltage, V"}</span><input type="number" min="180" max="240" value={car.adaptiveLowVoltage} onChange={e => update("adaptiveLowVoltage", Number(e.target.value))} className={`mt-1 ${field}`} /></label>
      <label><span className="text-xs text-zinc-500">{uk ? "Аварійно зупинити зарядку при, В" : "Emergency stop charging at, V"}</span><input type="number" min="150" max="220" value={car.adaptiveStopVoltage} onChange={e => update("adaptiveStopVoltage", Number(e.target.value))} className={`mt-1 ${field}`} /></label>
      <p className="text-xs text-zinc-500">{uk ? "Робоча зона: від цілі −2 В до цілі. Струм змінюється кроком 2 А в межах 6–32 А." : "Operating range: target −2 V to target. Current changes in 2 A steps between 6 and 32 A."}</p>
      <button type="button" onClick={save} className={`rounded-xl px-4 py-3 font-semibold transition hover:brightness-105 active:scale-[.98] ${saved ? "bg-emerald-400 text-black" : "bg-cyan-400 text-black"}`}>{saved ? (uk ? "✓ Збережено" : "✓ Saved") : (uk ? "Зберегти adaptive налаштування" : "Save adaptive settings")}</button>
    </div>
  </section>;
}
