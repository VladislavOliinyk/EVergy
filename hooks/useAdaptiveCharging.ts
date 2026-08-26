"use client";

import { useEffect, useRef, useState } from "react";
import { AdaptiveChargingController, type AdaptiveDecision } from "../domain/adaptiveCharging";
import type { TuyaTelemetry } from "../domain/telemetryProvider";

export function useAdaptiveCharging(targetCurrent: number | null, minVoltage = 180, lowVoltage = 200, minCurrent = 6, step = 2, rules: { belowVoltage: number; current: number }[] = [], enabled = false, charging = false, onSetCurrent?: (amps: number) => void, onStop?: () => void) {
  const [telemetry, setTelemetry] = useState<TuyaTelemetry | null>(null);
  const [decision, setDecision] = useState<AdaptiveDecision | null>(null);
  const [lastAction, setLastAction] = useState<AdaptiveDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AdaptiveChargingController | null>(null);
  const actionRef = useRef<string | null>(null);
  const callbackRef = useRef({ onSetCurrent, onStop });
  const rulesKey = JSON.stringify(rules);

  useEffect(() => { callbackRef.current = { onSetCurrent, onStop }; }, [onSetCurrent, onStop]);
  useEffect(() => { controllerRef.current = new AdaptiveChargingController({ minVoltage, lowVoltage, minCurrent, maxCurrent: 32, step, hysteresis: 3, recoveryVoltage: lowVoltage + 15, cooldownMs: 12_000, rules: JSON.parse(rulesKey) }); actionRef.current = null; }, [minVoltage, lowVoltage, minCurrent, step, rulesKey]);
  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const response = await fetch("/api/tuya/status", { cache: "no-store" });
        const body = await response.json() as TuyaTelemetry & { error?: string };
        if (!response.ok) throw new Error(body.error ?? `Tuya request failed (${response.status})`);
        if (!active) return;
        setTelemetry(body); setError(null);
        if (!enabled || !charging) { actionRef.current = null; setDecision(null); return; }
        if (body.onlineState !== "online" || body.fault !== 0 || typeof body.voltage !== "number" || typeof body.current !== "number" || targetCurrent === null || !controllerRef.current) return;
        const result = controllerRef.current.evaluate({ voltage: body.voltage, measuredCurrent: body.current, targetCurrent });
        setDecision(result);
        const action = `${result.decision}:${result.targetCurrent}`;
        if (result.decision !== "HOLD") setLastAction(result);
        if (action !== actionRef.current) {
          if (result.decision === "STOP" && result.stopCharging) { callbackRef.current.onStop?.(); actionRef.current = action; }
          else if ((result.decision === "REDUCE" || result.decision === "RECOVER") && result.targetCurrent !== targetCurrent) { callbackRef.current.onSetCurrent?.(result.targetCurrent); actionRef.current = action; }
        }
      } catch (caught) { if (active) setError(caught instanceof Error ? caught.message : "Tuya telemetry unavailable"); }
    };
    poll(); const timer = window.setInterval(poll, 3000);
    return () => { active = false; window.clearInterval(timer); };
  }, [targetCurrent, enabled, charging]);

  return { telemetry, decision, lastAction, error };
}
