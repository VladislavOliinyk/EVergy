"use client";

import { useEffect, useRef, useState } from "react";
import { AdaptiveChargingController, type AdaptiveDecision } from "../domain/adaptiveCharging";
import type { TuyaTelemetry } from "../domain/telemetryProvider";
import { addAdaptiveHistory, getAdaptiveHistory, type AdaptiveHistoryEntry } from "../lib/adaptiveHistory";

export function useAdaptiveCharging(targetCurrent: number | null, minVoltage = 180, lowVoltage = 200, minCurrent = 6, step = 2, rules: { belowVoltage: number; current: number }[] = [], enabled = false, charging = false, onSetCurrent?: (amps: number) => void, onStop?: () => void) {
  const [telemetry, setTelemetry] = useState<TuyaTelemetry | null>(null);
  const [decision, setDecision] = useState<AdaptiveDecision | null>(null);
  const [lastAction, setLastAction] = useState<AdaptiveDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [history, setHistory] = useState<AdaptiveHistoryEntry[]>([]);
  const controllerRef = useRef<AdaptiveChargingController | null>(null);
  const actionRef = useRef<string | null>(null);
  const callbackRef = useRef({ onSetCurrent, onStop });
  const rulesKey = JSON.stringify(rules);

  useEffect(() => { callbackRef.current = { onSetCurrent, onStop }; }, [onSetCurrent, onStop]);
  useEffect(() => { setHistory(getAdaptiveHistory()); }, []);
  useEffect(() => { controllerRef.current = new AdaptiveChargingController({ minVoltage, lowVoltage, minCurrent, maxCurrent: 32, step, hysteresis: 3, recoveryVoltage: lowVoltage + 15, cooldownMs: 12_000, rules: JSON.parse(rulesKey) }); actionRef.current = null; }, [minVoltage, lowVoltage, minCurrent, step, rulesKey]);
  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        console.info("[Adaptive] Requesting Tuya telemetry", new Date().toISOString());
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 8000);
        const response = await fetch(`/api/tuya/status?t=${Date.now()}`, { cache: "no-store", signal: controller.signal, headers: { "cache-control": "no-cache" } });
        window.clearTimeout(timeout);
        const body = await response.json() as TuyaTelemetry & { error?: string };
        console.info("[Adaptive] Tuya response", { ok: response.ok, status: response.status, voltage: body.voltage, current: body.current, error: body.error });
        if (!response.ok) throw new Error(body.error ?? `Tuya request failed (${response.status})`);
        if (!active) return;
        setTelemetry(body); setError(null); setLastUpdated(new Date().toISOString());
        if (!enabled || !charging) { actionRef.current = null; setDecision(null); return; }
        const faultFree = body.fault === null || body.fault === 0 || body.fault === "0";
        const online = body.onlineState === "online" || body.onlineState === "true" || body.onlineState === "1";
        if (!online || !faultFree || typeof body.voltage !== "number" || typeof body.current !== "number" || targetCurrent === null || !controllerRef.current) return;
        const result = controllerRef.current.evaluate({ voltage: body.voltage, measuredCurrent: body.current, targetCurrent });
        setDecision(result);
        const action = `${result.decision}:${result.targetCurrent}`;
        if (result.decision !== "HOLD") setLastAction(result);
        if (action !== actionRef.current) {
          if (result.decision === "STOP" && result.stopCharging) { callbackRef.current.onStop?.(); setHistory(addAdaptiveHistory({ timestamp: Date.now(), voltage: body.voltage, previousCurrent: targetCurrent, appliedCurrent: null, action: "STOP", reason: result.reason })); actionRef.current = action; }
          else if ((result.decision === "REDUCE" || result.decision === "RECOVER") && result.targetCurrent !== targetCurrent) { callbackRef.current.onSetCurrent?.(result.targetCurrent); setHistory(addAdaptiveHistory({ timestamp: Date.now(), voltage: body.voltage, previousCurrent: targetCurrent, appliedCurrent: result.targetCurrent, action: result.decision, reason: result.reason })); actionRef.current = action; }
        }
      } catch (caught) { console.error("[Adaptive] Tuya polling failed", caught); if (active) setError(caught instanceof DOMException && caught.name === "AbortError" ? "Tuya request timed out" : caught instanceof Error ? caught.message : "Tuya telemetry unavailable"); }
    };
    poll(); const timer = window.setInterval(poll, 3000);
    return () => { active = false; window.clearInterval(timer); };
  }, [targetCurrent, enabled, charging]);

  return { telemetry, decision, lastAction, error, lastUpdated, history };
}
