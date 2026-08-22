"use client";

import { useEffect, useMemo, useState } from "react";

import { useChargerTelemetry } from "../../hooks/useChargerTelemetry";


type Theme = "dark" | "light";

const MONTH_NAMES = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

export default function StatsPage() {
  const {
    telemetry,
    isConnected,
  } = useChargerTelemetry();

  const [theme, setTheme] =
    useState<Theme>("dark");

  const [themeReady, setThemeReady] =
    useState(false);

  const isDark =
    theme === "dark";

  /*
   * ------------------------------------------------------------------------
   * THEME
   * ------------------------------------------------------------------------
   */

  useEffect(() => {
    const savedTheme =
      window.localStorage.getItem(
        "evergy-theme",
      );

    if (
      savedTheme === "dark" ||
      savedTheme === "light"
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
  }, [theme, themeReady]);

  /*
   * ------------------------------------------------------------------------
   * MONTHLY ENERGY
   * ------------------------------------------------------------------------
   */

  const monthlyValues =
    telemetry.monthlyEnergy?.energyKwh ??
    Array(12).fill(0);

  const currentMonth =
    getCurrentMonthIndex(
      telemetry.monthlyEnergy?.currentMonth,
    );

  const currentMonthEnergy =
    monthlyValues[currentMonth] ?? 0;

  const yearlyEnergy =
    monthlyValues.reduce(
      (sum, value) =>
        sum +
        (Number.isFinite(value)
          ? value
          : 0),
      0,
    );

  const maxMonthlyEnergy =
    Math.max(
      ...monthlyValues,
      0,
    );

 /*
 * ------------------------------------------------------------------------
 * CHARGING HISTORY
 * ------------------------------------------------------------------------
 *
 * ElectroS may report zero-energy records.
 *
 * A record with 0 kWh is not considered a real charging session,
 * so it is excluded from:
 *
 * - session count
 * - average session
 * - recent sessions
 */
const history =
  telemetry.chargingHistory;

const validSessions =
  history.filter(
    (entry) =>
      Number.isFinite(entry.energyKwh) &&
      entry.energyKwh > 0,
  );

const totalSessions =
  validSessions.length;

const historyEnergy =
  validSessions.reduce(
    (sum, entry) =>
      sum + entry.energyKwh,
    0,
  );

const averageSession =
  totalSessions > 0
    ? historyEnergy /
      totalSessions
    : 0;

const recentHistory =
  useMemo(
    () =>
      [...validSessions]
        .reverse()
        .slice(0, 10),
    [validSessions],
  );

  /*
   * ------------------------------------------------------------------------
   * RENDER
   * ------------------------------------------------------------------------
   */

  return (
    <main
      className={`min-h-screen transition-colors duration-500 ${
        isDark
          ? "bg-[#070a0c] text-white"
          : "bg-[#f4f6f7] text-[#111517]"
      }`}
    >
      <div className="mx-auto min-h-screen w-full max-w-[760px] px-5 pb-8 pt-6 sm:px-8">

        {/* ================================================================ */}
        {/* HEADER                                                           */}
        {/* ================================================================ */}

        <header className="flex items-start justify-between">
          <div>
            <div className="text-[28px] font-semibold tracking-[-0.045em]">
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
              ENERGY MANAGER
            </div>
          </div>

          <div className="flex items-center gap-2.5">

            {/* ONLINE */}

            <div
              className={`flex items-center gap-2 rounded-full border px-4 py-2 ${
                isDark
                  ? "border-white/[0.08] bg-white/[0.025]"
                  : "border-black/[0.06] bg-white/80"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isConnected
                    ? "bg-emerald-400"
                    : "bg-red-400"
                }`}
              />

              <span
                className={`text-[9px] font-medium tracking-[0.2em] ${
                  isDark
                    ? "text-zinc-500"
                    : "text-zinc-500"
                }`}
              >
                {isConnected
                  ? "ONLINE"
                  : "OFFLINE"}
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
              {isDark
                ? "☀"
                : "☾"}
            </button>
          </div>
        </header>

        {/* ================================================================ */}
        {/* PAGE TITLE                                                        */}
        {/* ================================================================ */}

        <section className="mt-12">
          <div
            className={`text-[10px] font-medium tracking-[0.25em] ${
              isDark
                ? "text-zinc-600"
                : "text-zinc-400"
            }`}
          >
            ENERGY
          </div>

          <div className="mt-1 flex items-end justify-between">
            <h1 className="text-[30px] font-semibold tracking-tight">
              Statistics
            </h1>

            <div
              className={`text-[8px] font-medium tracking-[0.2em] ${
                isDark
                  ? "text-zinc-700"
                  : "text-zinc-400"
              }`}
            >
              LIVE DATA
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* THIS MONTH                                                        */}
        {/* ================================================================ */}

        <section
          className={`mt-7 overflow-hidden rounded-[2rem] border ${
            isDark
              ? "border-white/[0.07] bg-white/[0.02]"
              : "border-black/[0.06] bg-white/70"
          }`}
        >
          <div className="flex items-start justify-between p-6 sm:p-7">

            <div>
              <div
                className={`text-[9px] font-medium tracking-[0.2em] ${
                  isDark
                    ? "text-zinc-600"
                    : "text-zinc-400"
                }`}
              >
                {MONTH_NAMES[
                  currentMonth
                ]}
              </div>

              <div className="mt-2 text-[42px] font-semibold leading-none tracking-[-0.03em]">
                {currentMonthEnergy.toFixed(
                  2,
                )}

                <span
                  className={`ml-2 text-base font-normal ${
                    isDark
                      ? "text-cyan-400"
                      : "text-cyan-600"
                  }`}
                >
                  kWh
                </span>
              </div>

              <div
                className={`mt-2 text-[9px] tracking-[0.12em] ${
                  isDark
                    ? "text-zinc-600"
                    : "text-zinc-400"
                }`}
              >
                ENERGY CONSUMPTION THIS MONTH
              </div>
            </div>

            <div
              className={`flex h-12 w-12 items-center justify-center rounded-full border text-xl ${
                isDark
                  ? "border-cyan-400/20 bg-cyan-400/[0.05]"
                  : "border-cyan-600/15 bg-cyan-500/[0.05]"
              }`}
            >
              ⚡
            </div>
          </div>

          {/* ============================================================ */}
          {/* YEAR GRAPH                                                    */}
          {/* ============================================================ */}

          <div className="px-5 pb-6 sm:px-7">

            <div className="mb-4 flex items-center justify-between">
              <div
                className={`text-[8px] font-medium tracking-[0.18em] ${
                  isDark
                    ? "text-zinc-600"
                    : "text-zinc-400"
                }`}
              >
                ENERGY THIS YEAR
              </div>

              <div
                className={`text-[8px] ${
                  isDark
                    ? "text-zinc-700"
                    : "text-zinc-400"
                }`}
              >
                kWh
              </div>
            </div>

            <div className="flex h-44 items-end gap-1.5 sm:gap-2.5">
              {monthlyValues.map(
                (value, index) => {
                  const safeValue =
                    Number.isFinite(
                      value,
                    )
                      ? value
                      : 0;

                  const height =
                    maxMonthlyEnergy >
                    0
                      ? Math.max(
                          3,
                          (safeValue /
                            maxMonthlyEnergy) *
                            100,
                        )
                      : 3;

                  const isCurrent =
                    index ===
                    currentMonth;

                  return (
                    <div
                      key={MONTH_NAMES[index]}
                      className="flex h-full flex-1 flex-col justify-end"
                    >
                      <div className="relative flex h-full items-end">
                        <div
                          className={`w-full rounded-t-md transition-all duration-500 ${
                            isCurrent
                              ? isDark
                                ? "bg-cyan-400"
                                : "bg-cyan-600"
                              : isDark
                                ? "bg-cyan-400/15"
                                : "bg-cyan-600/10"
                          }`}
                          style={{
                            height: `${height}%`,
                          }}
                        />
                      </div>

                      <div
                        className={`mt-2 text-center text-[7px] tracking-[0.05em] ${
                          isCurrent
                            ? isDark
                              ? "text-cyan-300"
                              : "text-cyan-700"
                            : isDark
                              ? "text-zinc-700"
                              : "text-zinc-400"
                        }`}
                      >
                        {MONTH_NAMES[index]}
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* SUMMARY                                                          */}
        {/* ================================================================ */}

        <section className="mt-4 grid grid-cols-3 gap-2.5">

          <SummaryCard
            label="YEAR TOTAL"
            value={yearlyEnergy.toFixed(1)}
            unit="kWh"
            dark={isDark}
          />

          <SummaryCard
            label="SESSIONS"
            value={totalSessions.toString()}
            unit=""
            dark={isDark}
          />

          <SummaryCard
            label="AVG SESSION"
            value={averageSession.toFixed(
              2,
            )}
            unit="kWh"
            dark={isDark}
          />

        </section>

        {/* ================================================================ */}
        {/* HISTORY                                                          */}
        {/* ================================================================ */}

        <section className="mt-10">

          <div className="flex items-end justify-between">
            <div>
              <div
                className={`text-[9px] font-medium tracking-[0.2em] ${
                  isDark
                    ? "text-zinc-600"
                    : "text-zinc-400"
                }`}
              >
                CHARGING
              </div>

              <h2 className="mt-1 text-xl font-semibold tracking-tight">
                Recent sessions
              </h2>
            </div>

            <div
              className={`text-[8px] tracking-[0.16em] ${
                isDark
                  ? "text-zinc-700"
                  : "text-zinc-400"
              }`}
            >
              {totalSessions} TOTAL
            </div>
          </div>

          <div
            className={`mt-4 overflow-hidden rounded-[1.5rem] border ${
              isDark
                ? "border-white/[0.07] bg-white/[0.015]"
                : "border-black/[0.06] bg-white/50"
            }`}
          >
            {recentHistory.length ===
            0 ? (
              <div
                className={`px-5 py-12 text-center text-[9px] tracking-[0.18em] ${
                  isDark
                    ? "text-zinc-700"
                    : "text-zinc-400"
                }`}
              >
                NO CHARGING HISTORY
              </div>
            ) : (
              recentHistory.map(
                (entry, index) => (
                  <div
                    key={`${entry.date}-${entry.time}-${index}`}
                    className={`flex items-center justify-between px-5 py-4 ${
                      index <
                      recentHistory.length -
                        1
                        ? isDark
                          ? "border-b border-white/[0.05]"
                          : "border-b border-black/[0.05]"
                        : ""
                    }`}
                  >

                    <div>
                      <div className="text-sm font-medium">
                        {formatDate(
                          entry.date,
                        )}
                      </div>

                      <div
                        className={`mt-1 text-[8px] tracking-[0.15em] ${
                          isDark
                            ? "text-zinc-600"
                            : "text-zinc-400"
                        }`}
                      >
                        {entry.time}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-semibold">
                        {entry.energyKwh.toFixed(
                          2,
                        )}

                        <span
                          className={`ml-1 text-[9px] font-normal ${
                            isDark
                              ? "text-cyan-400"
                              : "text-cyan-600"
                          }`}
                        >
                          kWh
                        </span>
                      </div>

                      <div
                        className={`mt-1 text-[7px] tracking-[0.14em] ${
                          isDark
                            ? "text-zinc-700"
                            : "text-zinc-400"
                        }`}
                      >
                        CHARGING SESSION
                      </div>
                    </div>

                  </div>
                ),
              )
            )}
          </div>
        </section>

        {/* ================================================================ */}
        {/* FOOTER                                                           */}
        {/* ================================================================ */}

        <div
          className={`mt-8 pb-3 text-center text-[7px] tracking-[0.2em] ${
            isDark
              ? "text-zinc-800"
              : "text-zinc-400"
          }`}
        >
          ELECTROS TELEMETRY
        </div>

      </div>
    </main>
  );
}

/* ==========================================================================
   SUMMARY CARD
   ========================================================================== */

function SummaryCard({
  label,
  value,
  unit,
  dark,
}: {
  label: string;
  value: string;
  unit: string;
  dark: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        dark
          ? "border-white/[0.07] bg-white/[0.02]"
          : "border-black/[0.06] bg-white/60"
      }`}
    >
      <div
        className={`text-[7px] font-medium tracking-[0.15em] ${
          dark
            ? "text-zinc-600"
            : "text-zinc-400"
        }`}
      >
        {label}
      </div>

      <div className="mt-2 whitespace-nowrap text-base font-semibold tracking-tight">
        {value}

        {unit && (
          <span
            className={`ml-1 text-[9px] font-normal ${
              dark
                ? "text-cyan-400"
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

/* ==========================================================================
   HELPERS
   ========================================================================== */

function getCurrentMonthIndex(
  currentMonth:
    | number
    | null
    | undefined,
) {
  if (
    typeof currentMonth ===
      "number" &&
    Number.isFinite(
      currentMonth,
    ) &&
    currentMonth >= 1 &&
    currentMonth <= 12
  ) {
    return currentMonth - 1;
  }

  return new Date().getMonth();
}

function formatDate(
  date: string,
) {
  if (!date) {
    return "—";
  }

  return date;
}