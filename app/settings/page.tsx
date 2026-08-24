"use client";
import { useEffect, useState } from "react";
import { BottomNav } from "../../components/BottomNav";
import { getChargers, getActiveChargerId, saveActiveChargerId, saveChargers, getCarProfile, saveCarProfile, type ChargerConfig, type CarProfile } from "../../lib/appStorage";
import { getLanguage, saveLanguage, translations, type Language } from "../../lib/i18n";

type Theme = "dark" | "light";

export default function SettingsPage() {
  const [chargers, setChargers] = useState<ChargerConfig[]>([]);
  const [active, setActive] = useState("");
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [language, setLanguage] = useState<Language>("en");
  const [theme, setTheme] = useState<Theme>("dark");
  const [car, setCar] = useState<CarProfile>(getCarProfile);
  const t = translations[language];
  const dark = theme === "dark";

  useEffect(() => {
    setChargers(getChargers());
    setActive(getActiveChargerId() ?? "");
    setLanguage(getLanguage());
    setTheme((localStorage.getItem("evergy-theme") as Theme) || "dark");
    const sync = () => { setLanguage(getLanguage()); setTheme((localStorage.getItem("evergy-theme") as Theme) || "dark"); };
    window.addEventListener("evergy:language-change", sync);
    window.addEventListener("evergy:theme-change", sync);
    return () => { window.removeEventListener("evergy:language-change", sync); window.removeEventListener("evergy:theme-change", sync); };
  }, []);

  const updateCar = <K extends keyof CarProfile>(key: K, value: CarProfile[K]) => setCar(current => ({ ...current, [key]: value }));
  const addCharger = () => { const clean = id.trim(); if (!/^[a-z0-9_-]{3,32}$/i.test(clean)) return; const next = [...chargers.filter(c => c.id !== clean), { id: clean, name: name.trim() || clean }]; setChargers(next); saveChargers(next); saveActiveChargerId(clean); setActive(clean); setId(""); setName(""); };
  const removeCharger = (target: string) => { if (!window.confirm(language === "uk" ? "Видалити цю зарядку?" : "Remove this charger?")) return; const next = chargers.filter(c => c.id !== target); setChargers(next); saveChargers(next); };
  const field = (key: keyof CarProfile, label: string, type = "text") => <label className="block min-w-0"><span className="text-xs text-zinc-500">{label}</span><input type={type} value={String(car[key] ?? "")} onChange={e => updateCar(key, type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) as CarProfile[typeof key] : e.target.value as CarProfile[typeof key])} className={`mt-1 block min-w-0 w-full max-w-full rounded-xl border px-3 py-3 ${dark ? "border-white/10 bg-white/5" : "border-black/10 bg-white"}`} /></label>;
  const card = dark ? "border-white/[.08] bg-white/[.025]" : "border-black/[.07] bg-white/75";
  const muted = dark ? "text-zinc-500" : "text-zinc-500";
  const voltage = car.minimumChargingVoltage ?? 180;

  return <main className={`${dark ? "bg-[#070a0c] text-white" : "bg-[#f4f6f7] text-[#111517]"} min-h-screen`}>
    <div className="mx-auto max-w-[760px] px-5 pb-32 pt-7">
      <header><div className={`text-[10px] tracking-[.25em] ${muted}`}>{t.settings}</div><h1 className="mt-1 text-3xl font-semibold">{t.settingsTitle}</h1><p className={`mt-2 text-sm ${muted}`}>{language === "uk" ? "Керуйте зарядками, безпекою та виглядом застосунку." : "Manage chargers, safety and app preferences."}</p></header>

      <section className="mt-8"><SectionTitle title={language === "uk" ? "ЗАРЯДКИ" : "CHARGERS"} description={language === "uk" ? "Оберіть зарядку, якою керує EVergy." : "Choose the charger controlled by EVergy."} dark={dark} /><div className={`mt-3 overflow-hidden rounded-3xl border ${card}`}>
        {chargers.length === 0 ? <p className={`p-5 text-sm ${muted}`}>{language === "uk" ? "Зарядки ще не додані." : "No chargers added yet."}</p> : chargers.map(charger => <div key={charger.id} className={`flex items-center gap-3 p-4 ${charger.id !== chargers[chargers.length - 1].id ? dark ? "border-b border-white/[.06]" : "border-b border-black/[.06]" : ""}`}><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-400">⚡</div><div className="min-w-0 flex-1"><input value={charger.name} onChange={e => { const next = chargers.map(item => item.id === charger.id ? { ...item, name: e.target.value } : item); setChargers(next); saveChargers(next); }} className="w-full bg-transparent font-medium outline-none"/><div className={`mt-1 text-xs ${muted}`}>{charger.id}</div></div><button onClick={() => { setActive(charger.id); saveActiveChargerId(charger.id); }} className={`rounded-full px-3 py-1.5 text-xs ${active === charger.id ? "bg-cyan-400 text-black" : "bg-white/10 text-zinc-400"}`}>{active === charger.id ? t.active : t.use}</button><button onClick={() => removeCharger(charger.id)} aria-label="Remove charger" className="px-1 text-xl text-red-400">×</button></div>)}</div></section>

      <section className="mt-8"><SectionTitle title={language === "uk" ? "ДОДАТИ ЗАРЯДКУ" : "ADD CHARGER"} description={language === "uk" ? "Додайте ще одну зарядку для швидкого перемикання." : "Add another charger for quick switching."} dark={dark} /><div className={`mt-3 grid gap-3 rounded-3xl border p-5 sm:grid-cols-2 ${card}`}><input value={id} onChange={e => setId(e.target.value)} placeholder={t.chargerId} className={`rounded-xl border px-4 py-3 ${dark ? "border-white/10 bg-white/5" : "border-black/10 bg-white"}`} /><input value={name} onChange={e => setName(e.target.value)} placeholder={t.chargerName} className={`rounded-xl border px-4 py-3 ${dark ? "border-white/10 bg-white/5" : "border-black/10 bg-white"}`} /><button onClick={addCharger} className="rounded-xl bg-cyan-400 px-4 py-3 font-semibold text-black sm:col-span-2">{t.addCharger}</button></div></section>

      <section className="mt-8"><SectionTitle title={language === "uk" ? "ЗАХИСТ І БЕЗПЕКА" : "SAFETY & PROTECTION"} description={language === "uk" ? "Параметри, які захищають зарядку під час роботи." : "Parameters that protect charging while active."} dark={dark} /><div className={`mt-3 grid gap-5 rounded-3xl border p-5 ${card}`}><label className="block"><span className="text-sm">{t.leakage}</span><select value={car.leakageProtection} onChange={e => { const value = e.target.value as CarProfile["leakageProtection"]; updateCar("leakageProtection", value); updateCar("groundingControl", value !== "off"); }} className={`mt-2 w-full rounded-xl border px-4 py-3 ${dark ? "border-white/10 bg-[#10171b] text-white" : "border-black/10 bg-white text-black"}`}><option value="30mA">✓ {t.on} 30mA</option><option value="100mA">{t.on} 100mA</option><option value="off">{t.off}</option></select></label><label><div className="flex justify-between text-sm"><span>{t.minVoltage}</span><b className="text-cyan-400">{voltage} V</b></div><input type="range" min="150" max="210" value={voltage} onChange={e => updateCar("minimumChargingVoltage", Number(e.target.value))} className="mt-3 w-full accent-blue-500" /><div className="flex justify-between text-xs text-zinc-500"><span>150 V</span><span>210 V</span></div></label></div></section>

      <section className="mt-8"><SectionTitle title={language === "uk" ? "ГРАФІК ЗАРЯДЖАННЯ" : "CHARGING SCHEDULE"} description={language === "uk" ? "Автоматичне вікно, у якому дозволено заряджання." : "The automatic window when charging is allowed."} dark={dark} /><div className={`mt-3 grid gap-4 rounded-3xl border p-5 ${card}`}><label className="flex items-center justify-between text-sm"><span>{t.schedule}</span><input type="checkbox" checked={car.scheduleEnabled} onChange={e => updateCar("scheduleEnabled", e.target.checked)} /></label><div className="grid min-w-0 grid-cols-2 gap-3">{field("scheduleStart", t.on, "time")}{field("scheduleEnd", t.off, "time")}</div><button onClick={() => saveCarProfile(car)} className="rounded-xl bg-cyan-400 px-4 py-3 font-semibold text-black">{t.saveParameters}</button></div></section>

      <section className="mt-8"><SectionTitle title={language === "uk" ? "ЗАСТОСУНОК" : "APPLICATION"} description={language === "uk" ? "Мова та вигляд інтерфейсу." : "Language and interface appearance."} dark={dark} /><div className={`mt-3 rounded-3xl border p-5 ${card}`}><label className="text-sm">{t.language}</label><select value={language} onChange={e => { const next = e.target.value as Language; setLanguage(next); saveLanguage(next); }} className={`mt-2 w-full rounded-xl border px-4 py-3 ${dark ? "border-white/10 bg-[#10171b] text-white" : "border-black/10 bg-white text-black"}`}><option value="uk">Українська</option><option value="en">English</option></select></div></section>
    </div><BottomNav dark={dark} />
  </main>;
}

function SectionTitle({ title, description, dark }: { title: string; description: string; dark: boolean }) { return <div><h2 className={`text-xs font-semibold tracking-[.2em] ${dark ? "text-cyan-300" : "text-cyan-700"}`}>{title}</h2><p className={`mt-1 text-sm ${dark ? "text-zinc-500" : "text-zinc-500"}`}>{description}</p></div>; }
