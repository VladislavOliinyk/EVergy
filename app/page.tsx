"use client";

import { useEffect, useRef, useState } from "react";

import { useChargerTelemetry } from "../hooks/useChargerTelemetry";
import { BottomNav } from "../components/BottomNav";
import { SetupModal } from "../components/SetupModal";
import { getActiveChargerId } from "../lib/appStorage";
import { getLanguage, translations, type Language } from "../lib/i18n";

type Theme = "dark" | "light";
type ApplyState = "idle" | "applying";

const CURRENT_OPTIONS = [
  6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32,
];

export default function Home() {
const {
  telemetry,
  isConnected,
  isCharging,
  lastError,
  sessionDurationSeconds,
  sessionStartedAt,
  lastCompletedSession,
  startCharging,
  stopCharging,
} = useChargerTelemetry();

  const [selectedCurrent, setSelectedCurrent] =
    useState<number | null>(null);

  const [currentPickerOpen, setCurrentPickerOpen] =
    useState(false);

  const [applyState, setApplyState] =
    useState<ApplyState>("idle");

  const [stopState, setStopState] =
    useState<"idle" | "stopping">("idle");

  const [theme, setTheme] =
    useState<Theme>(() => typeof window !== "undefined" && window.localStorage.getItem("evergy-theme") === "light" ? "light" : "dark");

  const [themeReady, setThemeReady] =
    useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [language, setLanguage] = useState<Language>("en");
  const t = translations[language];

  const isDark = theme === "dark";

  /*
   * ElectroS target current.
   *
   * This is always taken from live telemetry.
   */
  const currentLimit =
    telemetry.chargingCurrentTargetAmps;

  /*
   * Actual charging current from telemetry.
   *
   * Used to determine if charging is actually happening.
   */
  const actualCurrent =
    telemetry.currentAmps;

  /*
   * Determine if we should show START or STOP button.
   *
   * If actual current > 0, show STOP button.
   * If actual current === 0 or null, show START button.
   */
  const shouldShowStop =
    isConnected &&
    telemetry.operationState !== "station_offline" &&
    actualCurrent !== null &&
    actualCurrent > 0;

  const displayedActualCurrent =
    isConnected &&
    telemetry.operationState !== "station_offline"
      ? actualCurrent
      : null;

  /* ---------------------------------------------------------------------- */
  /* Theme                                                                  */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    setSetupRequired(!getActiveChargerId());
    setLanguage(getLanguage());
    const syncLanguage = () => setLanguage(getLanguage());
    window.addEventListener("evergy:language-change", syncLanguage);
    return () => window.removeEventListener("evergy:language-change", syncLanguage);
  }, []);

  useEffect(() => {
    const savedTheme =
      window.localStorage.getItem(
        "evergy-theme",
      );

    if (
      savedTheme === "light" ||
      savedTheme === "dark"
    ) {
      setTheme(savedTheme);
    }

    setThemeReady(true);
  }, []);

  useEffect(() => {
    if (!themeReady) {
      return;
    }

    window.localStorage.setItem(
      "evergy-theme",
      theme,
    );
    window.dispatchEvent(new Event("evergy:theme-change"));
  }, [theme, themeReady]);

  /* ---------------------------------------------------------------------- */
  /* Status - Real telemetry based                                          */
  /* ---------------------------------------------------------------------- */

  const status =
    getHomeStatus(
      telemetry.operationState,
      isConnected,
      actualCurrent,
    );

  const statusConfig = {
    online: {
      label: t.online,
      dot: "bg-emerald-400",
      text: isDark
        ? "text-emerald-300"
        : "text-emerald-600",
    },

    charging: {
      label: t.charging,
      dot: "bg-cyan-400",
      text: isDark
        ? "text-cyan-300"
        : "text-cyan-600",
    },

    waiting: {
      label: t.waiting,
      dot: "bg-yellow-400",
      text: isDark
        ? "text-yellow-300"
        : "text-yellow-600",
    },

    error: {
      label: t.error,
      dot: "bg-red-500",
      text: "text-red-500",
    },

    offline: {
      label: t.offline,
      dot: "bg-zinc-500",
      text: isDark
        ? "text-zinc-400"
        : "text-zinc-500",
    },
  }[status];

  /* ---------------------------------------------------------------------- */
  /* Current control                                                        */
  /* ---------------------------------------------------------------------- */

  function openCurrentPicker() {
    if (applyState === "applying") {
      return;
    }

    if (currentLimit !== null) {
      setSelectedCurrent(currentLimit);
    } else {
      setSelectedCurrent(16);
    }

    setCurrentPickerOpen(true);
  }

  function closeCurrentPicker() {
    if (applyState === "applying") {
      return;
    }

    setSelectedCurrent(currentLimit);
    setCurrentPickerOpen(false);
  }

function applyCurrent() {
  if (
    applyState === "applying" ||
    selectedCurrent === null
  ) {
    return;
  }

  setApplyState("applying");

  try {
    startCharging(selectedCurrent);

    console.log(
      "[EVergy] START command sent",
      selectedCurrent,
      "A",
    );

    setCurrentPickerOpen(false);
    setApplyState("idle");
  } catch (error) {
    console.error(
      "[EVergy] Failed to start charging",
      error,
    );

    setApplyState("idle");
  }
}

  /* ---------------------------------------------------------------------- */
  /* Stop charging                                                          */
  /* ---------------------------------------------------------------------- */

  function handleStopCharging() {
    if (stopState === "stopping") {
      return;
    }

    setStopState("stopping");

    try {
      stopCharging();

      console.log(
        "[EVergy] STOP command sent",
      );
    } catch (error) {
      console.error(
        "[EVergy] Failed to stop charging",
        error,
      );

      setStopState("idle");
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Formatting                                                             */
  /* ---------------------------------------------------------------------- */

  const voltage =
    telemetry.voltageVolts !== null
      ? Math.round(
          telemetry.voltageVolts,
        ).toString()
      : "—";

  const power =
    telemetry.powerKw !== null
      ? telemetry.powerKw.toFixed(2)
      : "—";

  /*
   * Main energy value.
   *
   * This comes directly from ElectroS telemetry.
   */
  const energy =
    telemetry.energyKwh !== null
      ? telemetry.energyKwh.toFixed(2)
      : "—";

  /*
   * Session value.
   *
   * For now this intentionally uses the same authoritative
   * ElectroS energy counter instead of a locally calculated
   * timer/session value.
   *
   * This means a browser refresh does NOT reset it.
   */
  const sessionEnergy =
    telemetry.energyKwh !== null
      ? telemetry.energyKwh.toFixed(2)
      : "—";

  const actualCurrentFormatted =
    displayedActualCurrent !== null
      ? displayedActualCurrent.toFixed(1)
      : "—";

  const targetCurrent =
    currentLimit !== null
      ? currentLimit.toString()
      : "—";

       const session =
    formatDuration(
      sessionDurationSeconds,
    );

  const sessionSince =
    formatSessionStart(
      sessionStartedAt,
    );

  const lastSessionDuration =
    lastCompletedSession?.durationSeconds ??
    null;

  const lastSessionDisplay =
    isCharging
      ? session
      : lastSessionDuration !== null &&
          lastSessionDuration > 0
        ? formatDuration(
            lastSessionDuration,
          )
        : "—";

  return (
    <main
      className={`min-h-screen transition-colors duration-500 ${
        isDark
          ? "bg-[#070a0c] text-white"
          : "bg-[#f4f6f7] text-[#111517]"
      }`}
    >
      {setupRequired && <SetupModal onSaved={() => window.location.reload()} />}
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 pb-24 pt-5 sm:px-8 sm:pt-7">

        {/* ================================================================== */}
        {/* HEADER                                                             */}
        {/* ================================================================== */}

        <header className="flex items-center justify-between">
          <div>
            <div className="text-[25px] font-semibold tracking-[-0.04em]">
              EV
              <span
                className={
                  isDark
                    ? "text-cyan-400"
                    : "text-cyan-600"
                }
              >
                ergy
              </span>
            </div>

            <div
              className={`mt-0.5 text-[9px] font-medium tracking-[0.25em] ${
                isDark
                  ? "text-zinc-600"
                  : "text-zinc-400"
              }`}
            >
              {language === "uk" ? "МЕНЕДЖЕР ЕНЕРГІЇ" : "ENERGY MANAGER"}
            </div>
          </div>

          <div className="flex items-center gap-2.5">

            {/* STATUS INDICATOR - Real telemetry based */}

            <div
              className={`flex items-center gap-2 rounded-full border px-3.5 py-2 ${
                isDark
                  ? "border-white/[0.08] bg-white/[0.025]"
                  : "border-black/[0.06] bg-white/80"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${statusConfig.dot} ${
                  status === "charging" || status === "online"
                    ? "animate-pulse shadow-lg"
                    : ""
                } transition-all`}
                style={
                  status === "charging" || status === "online"
                    ? {
                        boxShadow: `0 0 8px ${
                          status === "charging"
                            ? "rgba(34, 211, 238, 0.7)"
                            : "rgba(16, 185, 129, 0.7)"
                        }`,
                      }
                    : {}
                }
              />

              <span
                className={`text-[9px] font-medium tracking-[0.2em] ${
                  statusConfig.text
                }`}
              >
                {statusConfig.label}
              </span>
            </div>

            {/* THEME */}

            <button
              type="button"
              onClick={() =>
                setTheme(
                  isDark
                    ? "light"
                    : "dark",
                )
              }
              aria-label="Toggle theme"
              className={`flex h-10 w-10 items-center justify-center rounded-full border text-base transition-all ${
                isDark
                  ? "border-white/[0.08] bg-white/[0.025] text-zinc-400 hover:bg-white/[0.06]"
                  : "border-black/[0.06] bg-white text-zinc-500 hover:bg-zinc-100"
              }`}
            >
              {isDark ? "☀" : "☾"}
            </button>
          </div>
        </header>

        {/* ================================================================== */}
        {/* MAIN ENERGY SCENE                                                  */}
        {/* ================================================================== */}

        <section className="relative flex flex-1 items-center justify-center py-0 sm:py-1">
          <div className="relative -translate-y-7 h-[460px] w-full max-w-[480px] sm:-translate-y-9 sm:h-[520px] sm:max-w-[520px]">

            <EnergyNetwork
              dark={isDark}
              charging={isCharging}
            />

            {/* VOLTAGE */}

            <CornerMetric
              position="top-left"
              label={t.voltage}
              value={voltage}
              unit="V"
              dark={isDark}
            />

            {/* POWER */}
<CornerMetric
  position="top-right"
  label={t.power}
  value={power}
  unit="kW"
  dark={isDark}
/>

{/* SESSION */}
<CornerMetric
  position="bottom-right"
  label={isCharging ? t.session : t.lastSession}
  value={lastSessionDisplay}
  dark={isDark}
/>

            {/* CURRENT */}

            <button
              type="button"
              onClick={openCurrentPicker}
              disabled={
                applyState === "applying"
              }
              aria-label="Change charging current"
              className={`group absolute bottom-8 left-0 z-20 w-[145px] rounded-2xl border p-3.5 text-left transition-all duration-300 sm:w-[165px] sm:p-4 ${
                applyState === "applying"
                  ? "cursor-wait opacity-70"
                  : "cursor-pointer"
              } ${
                isDark
                  ? "border-cyan-400/25 bg-cyan-400/[0.035] hover:border-cyan-400/45 hover:bg-cyan-400/[0.06]"
                  : "border-cyan-600/20 bg-white/75 hover:border-cyan-600/35 hover:bg-white"
              }`}
            >

              {/* Interactive indicator */}

              <div
                className={`absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border transition-all ${
                  isDark
                    ? "border-cyan-400/20 bg-cyan-400/[0.06] text-cyan-300"
                    : "border-cyan-600/15 bg-cyan-500/[0.05] text-cyan-600"
                } group-hover:scale-105`}
              >
                <span className="text-base">
                  ›
                </span>
              </div>

              {/* Lightning */}

              <div
                className={`mb-2 flex h-7 w-7 items-center justify-center rounded-full border ${
                  isDark
                    ? "border-cyan-400/30 bg-cyan-400/[0.06] text-cyan-300"
                    : "border-cyan-600/20 bg-cyan-500/[0.06] text-cyan-600"
                }`}
              >
                <span className="text-sm">
                  ⚡
                </span>
              </div>

              <div
                className={`text-[9px] font-medium tracking-[0.18em] ${
                  isDark
                    ? "text-zinc-500"
                    : "text-zinc-500"
                }`}
              >
                CURRENT
              </div>

              <div className="mt-1 text-2xl font-semibold tracking-tight">
                {applyState === "applying"
                  ? "…"
                  : targetCurrent}

                <span
                  className={`ml-1 text-sm font-normal ${
                    isDark
                      ? "text-cyan-400"
                      : "text-cyan-600"
                  }`}
                >
                  A
                </span>
              </div>

              <div
                className={`mt-1 text-[9px] ${
                  isDark
                    ? "text-zinc-600"
                    : "text-zinc-400"
                }`}
              >
                actual{" "}
                <span
                  className={
                    isDark
                      ? "text-zinc-400"
                      : "text-zinc-500"
                  }
                >
                  {actualCurrentFormatted} A
                </span>
              </div>

              <div
                className={`mt-2 text-[8px] tracking-[0.12em] ${
                  isDark
                    ? "text-cyan-400/40"
                    : "text-cyan-600/50"
                }`}
              >
                TAP TO ADJUST
              </div>
            </button>

            {/* ================================================================= */}
            {/* CENTRAL ENERGY CORE                                               */}
            {/* ================================================================= */}

            <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center">

              {/* Soft charging glow */}

              <div
                className={`absolute h-56 w-56 rounded-full blur-3xl transition-all duration-1000 sm:h-64 sm:w-64 ${
                  isCharging
                    ? isDark
                      ? "bg-cyan-400/[0.07]"
                      : "bg-cyan-400/[0.10]"
                    : "bg-transparent"
                }`}
              />

              {/* Outer ring */}

              <div
                className={`absolute h-56 w-56 rounded-full border transition-all duration-700 sm:h-64 sm:w-64 ${
                  isCharging
                    ? isDark
                      ? "border-cyan-400/20"
                      : "border-cyan-600/20"
                    : isDark
                      ? "border-white/10"
                      : "border-black/[0.08]"
                }`}
              />

              {/* Energy arc */}

              <div
                className={`absolute h-52 w-52 rounded-full border-[2px] border-transparent transition-all duration-700 sm:h-60 sm:w-60 ${
                  isCharging
                    ? isDark
                      ? "border-t-cyan-400/60 border-r-cyan-400/20"
                      : "border-t-cyan-600/55 border-r-cyan-600/15"
                    : ""
                }`}
              />

              {/* Core */}

              <div
                className={`relative flex h-40 w-40 flex-col items-center justify-center rounded-full border transition-all duration-500 sm:h-44 sm:w-44 ${
                  isDark
                    ? "border-white/[0.08] bg-[#0b1013]"
                    : "border-black/[0.07] bg-white shadow-[0_15px_55px_rgba(15,23,42,0.09)]"
                }`}
              >
                <div
                  className={`mb-1.5 text-2xl ${
                    isCharging
                      ? isDark
                        ? "text-cyan-300"
                        : "text-cyan-600"
                      : "text-zinc-500"
                  }`}
                >
                  ⚡
                </div>

                <div className="text-[34px] font-semibold leading-none tracking-tight sm:text-4xl">
                  {energy}
                </div>

                <div
                  className={`mt-1 text-sm ${
                    isDark
                      ? "text-zinc-500"
                      : "text-zinc-400"
                  }`}
                >
                  kWh
                </div>

                <div
                  className={`mt-2 text-[9px] font-medium tracking-[0.28em] ${statusConfig.text}`}
                >
                  {statusConfig.label}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================== */}
        {/* START / STOP BUTTON (BELOW CURRENT SELECTOR)                       */}
        {/* ================================================================== */}

        <div className="flex justify-center mt-6">
          {shouldShowStop ? (
            /* STOP BUTTON - Red */
            <button
              type="button"
              onClick={handleStopCharging}
              disabled={stopState === "stopping"}
              aria-label="Stop charging"
              className={`flex items-center gap-3 px-8 py-3.5 rounded-full font-semibold tracking-[0.12em] text-sm transition-all duration-300 ${
                stopState === "stopping"
                  ? "cursor-wait opacity-60"
                  : "cursor-pointer hover:scale-110 active:scale-95"
              } ${
                isDark
                  ? "bg-red-600/40 border border-red-500/70 text-red-300 hover:bg-red-600/50 hover:border-red-500/90 shadow-[0_0_25px_rgba(220,38,38,0.3)]"
                  : "bg-red-600/30 border border-red-600/60 text-red-600 hover:bg-red-600/40 hover:border-red-600/80 shadow-[0_0_20px_rgba(220,38,38,0.25)]"
              }`}
            >
              <span className="text-lg">
                ■
              </span>
              <span>
                {stopState === "stopping"
                  ? "STOPPING…"
                  : t.stop}
              </span>
            </button>
          ) : (
            /* START BUTTON - Cyan (Energy flowing) */
            <button
              type="button"
              onClick={openCurrentPicker}
              disabled={applyState === "applying"}
              aria-label="Start charging"
              className={`flex items-center gap-3 px-8 py-3.5 rounded-full font-semibold tracking-[0.12em] text-sm transition-all duration-300 ${
                applyState === "applying"
                  ? "cursor-wait opacity-60"
                  : "cursor-pointer hover:scale-110 active:scale-95"
              } ${
                isDark
                  ? "bg-cyan-500/40 border border-cyan-400/70 text-cyan-300 hover:bg-cyan-500/50 hover:border-cyan-400/90 shadow-[0_0_25px_rgba(34,211,238,0.3)]"
                  : "bg-cyan-500/30 border border-cyan-600/60 text-cyan-600 hover:bg-cyan-500/40 hover:border-cyan-600/80 shadow-[0_0_20px_rgba(34,211,238,0.25)]"
              }`}
            >
              <span className="text-lg">
                ▶
              </span>
              <span>
                {applyState === "applying"
                  ? "STARTING…"
                  : t.start}
              </span>
            </button>
          )}
        </div>

        {/* ================================================================== */}
        {/* ERROR                                                               */}
        {/* ================================================================== */}

        {lastError && (
          <div
            className={`mt-4 rounded-xl border px-4 py-2 text-center text-[9px] ${
              isDark
                ? "border-red-400/15 bg-red-400/[0.04] text-red-300/70"
                : "border-red-500/15 bg-red-500/[0.04] text-red-600/70"
            }`}
          >
            {language === "uk" ? "Помилка з’єднання" : "Connection error"}
          </div>
        )}
      </div>

      <BottomNav dark={isDark} />

      {/* CURRENT PICKER */}

      {currentPickerOpen && (
        <CurrentPicker
          selectedCurrent={
            selectedCurrent ??
            currentLimit ??
            16
          }
          setSelectedCurrent={
            setSelectedCurrent
          }
          applyState={applyState}
          setApplyState={setApplyState}
          onApply={applyCurrent}
          onClose={closeCurrentPicker}
          language={language}
          dark={isDark}
          actualCurrent={
            displayedActualCurrent
          }
        />
      )}
    </main>
  );
}

/* ==========================================================================
   STATUS - Real telemetry based
   ========================================================================== */

function getHomeStatus(
  operationState:
    | "waiting_for_vehicle"
    | "connected_no_charge"
    | "charging"
    | "charging_error"
    | "charging_forbidden"
    | "low_voltage"
    | "communication_error"
    | "leakage_detected"
    | "overcurrent"
    | "station_offline"
    | "unknown",
  connected: boolean,
  actualCurrent: number | null,
): "online" | "charging" | "waiting" | "error" | "offline" {
  /*
   * If not connected - always offline
   */
  if (!connected) {
    return "offline";
  }

  if (operationState === "station_offline") {
    return "offline";
  }

  /*
   * Real charging current has priority over a stale or noisy status code.
   */
  if (actualCurrent !== null && actualCurrent > 0) {
    return "charging";
  }

  /*
   * When the charger is online but idle, the device is effectively waiting
   * for the user to start charging, even if a vendor status code is a bit noisy.
   */
  if (
    operationState === "charging" ||
    operationState === "waiting_for_vehicle" ||
    operationState === "connected_no_charge" ||
    operationState === "unknown"
  ) {
    return "waiting";
  }

  if (
    operationState === "charging_forbidden"
  ) {
    return "waiting";
  }

  /*
   * Any actual fault state should stay error.
   */
  const errorStates = new Set([
    "charging_error",
    "low_voltage",
    "communication_error",
    "leakage_detected",
    "overcurrent",
    "station_offline",
  ]);

  if (errorStates.has(operationState)) {
    return "error";
  }

  return "waiting";
}

/* ==========================================================================
   FORMATTING
   ========================================================================== */

function formatDuration(
  totalSeconds: number,
) {
  const hours = Math.floor(
    totalSeconds / 3600,
  );

  const minutes = Math.floor(
    (totalSeconds % 3600) / 60,
  );

  const seconds =
    totalSeconds % 60;

  if (hours > 0) {
    return `${hours
      .toString()
      .padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }

  return `${minutes
    .toString()
    .padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
}

function formatSessionStart(
  timestamp: number | null,
) {
  if (timestamp === null) {
    return null;
  }

  const date = new Date(timestamp);

  return date.toLocaleTimeString(
    "uk-UA",
    {
      hour: "2-digit",
      minute: "2-digit",
    },
  );
}

/* ==========================================================================
   CURRENT PICKER
   ========================================================================== */

function CurrentPicker({
  selectedCurrent,
  setSelectedCurrent,
  applyState,
  setApplyState,
  onApply,
  onClose,
  dark,
  actualCurrent,
  language,
}: {
  selectedCurrent: number;
  setSelectedCurrent: (
    value: number,
  ) => void;
  applyState: ApplyState;
  setApplyState: (
    value: ApplyState,
  ) => void;
  onApply: () => void;
  onClose: () => void;
  dark: boolean;
  actualCurrent: number | null;
  language: Language;
}) {
  const t = translations[language];
  const listRef =
    useRef<HTMLDivElement>(null);

  const ITEM_HEIGHT = 54;

  useEffect(() => {
    const index =
      CURRENT_OPTIONS.indexOf(
        selectedCurrent,
      );

    if (
      index < 0 ||
      !listRef.current
    ) {
      return;
    }

    listRef.current.scrollTo({
      top:
        index * ITEM_HEIGHT,
      behavior: "smooth",
    });
  }, [selectedCurrent]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={language === "uk" ? "Струм заряджання" : "Charging current"}
    >
      {/* Backdrop */}

      <button
        type="button"
        aria-label={language === "uk" ? "Закрити вибір струму" : "Close current selector"}
        onClick={onClose}
        disabled={
          applyState === "applying"
        }
        className={`absolute inset-0 ${
          dark
            ? "bg-black/65"
            : "bg-black/25"
        }`}
      />

      {/* Sheet */}

      <div
        className={`relative w-full max-w-md rounded-t-[2rem] border px-6 pb-7 pt-5 shadow-2xl sm:rounded-[2rem] ${
          dark
            ? "border-white/[0.08] bg-[#0b1013]"
            : "border-black/[0.07] bg-white"
        }`}
      >

        {/* Handle */}

        <div
          className={`mx-auto h-1 w-10 rounded-full ${
            dark
              ? "bg-white/10"
              : "bg-black/10"
          }`}
        />

        <div className="mt-6 text-center">
          <div
            className={`text-xs font-medium tracking-[0.22em] ${
              dark
                ? "text-zinc-400"
                : "text-zinc-500"
            }`}
          >
            {language === "uk" ? "СТРУМ ЗАРЯДЖАННЯ" : "CHARGING CURRENT"}
          </div>

          <div
            className={`mt-1 text-[9px] tracking-[0.14em] ${
              dark
                ? "text-zinc-600"
                : "text-zinc-400"
            }`}
          >
            {language === "uk" ? "ОБЕРІТЬ ОБМЕЖЕННЯ СТРУМУ" : "SELECT CURRENT LIMIT"}
          </div>
        </div>

        {/* Wheel */}

        <div className="relative mx-auto mt-5 w-full max-w-[230px]">

          {/* Top fade */}

          <div
            className={`pointer-events-none absolute left-0 right-0 top-0 z-30 h-20 bg-gradient-to-b ${
              dark
                ? "from-[#0b1013] to-transparent"
                : "from-white to-transparent"
            }`}
          />

          {/* Bottom fade */}

          <div
            className={`pointer-events-none absolute bottom-0 left-0 right-0 z-30 h-20 bg-gradient-to-t ${
              dark
                ? "from-[#0b1013] to-transparent"
                : "from-white to-transparent"
            }`}
          />

          {/* Selected frame */}

          <div
            className={`pointer-events-none absolute left-0 right-0 top-1/2 z-20 h-[54px] -translate-y-1/2 rounded-2xl border ${
              dark
                ? "border-cyan-400/30 bg-cyan-400/[0.045]"
                : "border-cyan-600/20 bg-cyan-500/[0.035]"
            }`}
          />

          <div
            ref={listRef}
            className="relative h-[270px] overflow-y-auto snap-y snap-mandatory [scrollbar-width:none]"
            style={{
              paddingTop:
                `${ITEM_HEIGHT * 2}px`,
              paddingBottom:
                `${ITEM_HEIGHT * 2}px`,
            }}
          >
            {CURRENT_OPTIONS.map(
              (value) => {
                const selected =
                  value ===
                  selectedCurrent;

                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setSelectedCurrent(
                        value,
                      )
                    }
                    className={`flex h-[54px] w-full snap-center items-center justify-center transition-all duration-200 ${
                      selected
                        ? dark
                          ? "text-cyan-300"
                          : "text-cyan-700"
                        : dark
                          ? "text-zinc-600"
                          : "text-zinc-400"
                    }`}
                  >
                    <span
                      className={`font-medium transition-all ${
                        selected
                          ? "text-[30px]"
                          : "text-[18px]"
                      }`}
                    >
                      {value}
                    </span>

                    <span
                      className={`ml-1 ${
                        selected
                          ? "text-sm"
                          : "text-[11px] opacity-70"
                      }`}
                    >
                      A
                    </span>
                  </button>
                );
              },
            )}
          </div>
        </div>

        {/* Selected value */}

        <div className="mt-2 text-center">
          <span className="text-4xl font-semibold">
            {selectedCurrent}
          </span>

          <span
            className={`ml-1 text-lg ${
              dark
                ? "text-zinc-500"
                : "text-zinc-400"
            }`}
          >
            A
          </span>
        </div>

        {/* Apply */}

        <button
          type="button"
          onClick={onApply}
          disabled={
            applyState === "applying"
          }
          className={`mt-6 h-14 w-full rounded-2xl text-[11px] font-semibold tracking-[0.2em] transition-all ${
            applyState === "applying"
              ? dark
                ? "bg-cyan-400/20 text-cyan-300"
                : "bg-cyan-500/15 text-cyan-700"
              : dark
                ? "bg-cyan-400 text-[#061013] hover:bg-cyan-300"
                : "bg-cyan-600 text-white hover:bg-cyan-700"
          }`}
        >
          {applyState ===
          "applying"
            ? (language === "uk" ? "ЗАСТОСУВАННЯ…" : "APPLYING…")
            : t.apply}
        </button>

        {/* Actual telemetry */}

        <div
          className={`mt-4 text-center text-[9px] tracking-[0.12em] ${
            dark
              ? "text-zinc-600"
              : "text-zinc-400"
          }`}
        >
          {language === "uk" ? "ФАКТИЧНИЙ СТРУМ" : "ACTUAL CURRENT"}{" "}
          <span
            className={
              dark
                ? "text-zinc-400"
                : "text-zinc-500"
            }
          >
            {actualCurrent !== null
              ? `${actualCurrent.toFixed(1)} A`
              : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   ENERGY NETWORK
   ========================================================================== */

function EnergyNetwork({
  dark,
  charging,
}: {
  dark: boolean;
  charging: boolean;
}) {
  const lineColor = dark
    ? "rgba(34,211,238,0.16)"
    : "rgba(8,145,178,0.16)";

  const pointColor = dark
    ? "rgba(34,211,238,0.45)"
    : "rgba(8,145,178,0.35)";

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      viewBox="0 0 500 500"
      fill="none"
      aria-hidden="true"
    >
      {/* Top left */}

      <path
        d="M90 125 C150 140 170 180 195 215"
        stroke={lineColor}
        strokeWidth="1"
        className={
          charging
            ? "animate-pulse"
            : ""
        }
      />

      {/* Top right */}

      <path
        d="M410 125 C350 140 330 180 305 215"
        stroke={lineColor}
        strokeWidth="1"
        className={
          charging
            ? "animate-pulse"
            : ""
        }
      />

      {/* Bottom left */}

      <path
        d="M90 375 C150 360 170 320 195 285"
        stroke={lineColor}
        strokeWidth="1"
        className={
          charging
            ? "animate-pulse"
            : ""
        }
      />

      {/* Bottom right */}

      <path
        d="M410 375 C350 360 330 320 305 285"
        stroke={lineColor}
        strokeWidth="1"
        className={
          charging
            ? "animate-pulse"
            : ""
        }
      />

      <circle
        cx="90"
        cy="125"
        r="2"
        fill={pointColor}
      />

      <circle
        cx="410"
        cy="125"
        r="2"
        fill={pointColor}
      />

      <circle
        cx="90"
        cy="375"
        r="2"
        fill={pointColor}
      />

      <circle
        cx="410"
        cy="375"
        r="2"
        fill={pointColor}
      />
    </svg>
  );
}

/* ==========================================================================
   CORNER METRIC
   ========================================================================== */

function CornerMetric({
  position,
  label,
  value,
  unit,
  dark,
}: {
  position:
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right";
  label: string;
  value: string;
  unit?: string;
  dark: boolean;
}) {
  const positionClass = {
    "top-left":
      "left-5 top-8 items-start text-left sm:left-6",

    "top-right":
      "right-5 top-8 items-end text-right sm:right-6",

    "bottom-left":
      "left-0 bottom-8 items-start text-left",

    "bottom-right":
      "right-5 bottom-8 items-end text-right sm:right-6",
  }[position];

  return (
    <div
      className={`absolute flex flex-col ${positionClass}`}
    >
      <div
        className={`text-[10px] font-medium tracking-[0.18em] ${
          dark
            ? "text-zinc-500"
            : "text-zinc-500"
        }`}
      >
        {label}
      </div>

      <div className="mt-1 text-2xl font-semibold tracking-tight sm:text-[26px]">
        {value}

        {unit && (
          <span
            className={`ml-1 text-sm font-normal ${
              dark
                ? "text-cyan-400/80"
                : "text-cyan-600"
            }`}
          >
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}
