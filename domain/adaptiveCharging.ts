export type AdaptiveState = "IDLE" | "STABLE" | "REDUCING" | "RECOVERING" | "LIMITED" | "ERROR";
export type AdaptiveDecision = { decision: "HOLD" | "REDUCE" | "RECOVER" | "STOP"; targetCurrent: number; state: AdaptiveState; reason: string; stopCharging?: boolean };
export type AdaptiveConfig = { minVoltage: number; lowVoltage: number; minCurrent: number; maxCurrent: number; step: number; hysteresis: number; recoveryVoltage: number; cooldownMs: number; rules?: { belowVoltage: number; current: number }[] };
export class AdaptiveChargingController {
  private previousVoltage: number | null = null; private previousCurrent: number | null = null; private lastChange = 0; private state: AdaptiveState = "IDLE";
  constructor(private readonly config: AdaptiveConfig = { minVoltage: 180, lowVoltage: 200, minCurrent: 6, maxCurrent: 32, step: 2, hysteresis: 3, recoveryVoltage: 215, cooldownMs: 12_000 }) {}
  evaluate(input: { voltage: number; measuredCurrent: number; targetCurrent: number; now?: number }): AdaptiveDecision {
    const now = input.now ?? Date.now(); const c = this.config; const previousVoltage = this.previousVoltage; const falling = previousVoltage !== null && input.voltage < previousVoltage - 1; const canChange = now - this.lastChange >= c.cooldownMs;
    this.previousVoltage = input.voltage; this.previousCurrent = input.measuredCurrent;
    if (input.voltage <= c.minVoltage) { this.state = "ERROR"; return { decision: "STOP", targetCurrent: input.targetCurrent, state: this.state, stopCharging: true, reason: "Critical voltage threshold reached" }; }
    const rule = c.rules?.slice().sort((a, b) => a.belowVoltage - b.belowVoltage).find(item => input.voltage < item.belowVoltage);
    if ((rule || input.voltage <= c.lowVoltage) && falling && canChange) { const target = rule ? Math.max(c.minCurrent, Math.min(c.maxCurrent, rule.current)) : Math.max(c.minCurrent, input.targetCurrent - c.step); if (target < input.targetCurrent) { this.lastChange = now; this.state = "REDUCING"; return { decision: "REDUCE", targetCurrent: target, state: this.state, reason: "Voltage is below a configured adaptive threshold" }; } }
    if (input.voltage >= c.recoveryVoltage && canChange && input.targetCurrent < c.maxCurrent) { const target = Math.min(c.maxCurrent, input.targetCurrent + c.step); this.lastChange = now; this.state = "RECOVERING"; return { decision: "RECOVER", targetCurrent: target, state: this.state, reason: "Voltage recovered above the stable zone" }; }
    this.state = input.voltage <= c.minVoltage + c.hysteresis ? "LIMITED" : "STABLE"; return { decision: "HOLD", targetCurrent: input.targetCurrent, state: this.state, reason: "Voltage stable under current load" };
  }
}
