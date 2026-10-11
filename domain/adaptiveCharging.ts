export type AdaptiveState = "IDLE" | "STABLE" | "REDUCING" | "RECOVERING" | "LIMITED" | "ERROR";
export type AdaptiveDecision = { decision: "HOLD" | "REDUCE" | "RECOVER" | "STOP"; targetCurrent: number; state: AdaptiveState; reason: string; stopCharging?: boolean };
export type AdaptiveConfig = { stopVoltage: number; targetVoltage: number; minCurrent: number; maxCurrent: number; step: number; tolerance: number; cooldownMs: number };
export class AdaptiveChargingController {
  private lastChange = 0; private state: AdaptiveState = "IDLE";
  constructor(private readonly config: AdaptiveConfig = { stopVoltage: 180, targetVoltage: 200, minCurrent: 6, maxCurrent: 32, step: 2, tolerance: 2, cooldownMs: 12_000 }) {}
  evaluate(input: { voltage: number; measuredCurrent: number; targetCurrent: number; now?: number }): AdaptiveDecision {
    const now = input.now ?? Date.now(); const c = this.config; const canChange = now - this.lastChange >= c.cooldownMs; const minimumAllowedVoltage = c.targetVoltage - c.tolerance;
    if (input.voltage <= c.stopVoltage) { this.state = "ERROR"; return { decision: "STOP", targetCurrent: input.targetCurrent, state: this.state, stopCharging: true, reason: "Critical voltage threshold reached" }; }
    if (input.targetCurrent > c.maxCurrent && canChange) { this.lastChange = now; this.state = "REDUCING"; return { decision: "REDUCE", targetCurrent: c.maxCurrent, state: this.state, reason: "Current exceeds the configured upper limit" }; }
    if (input.voltage < minimumAllowedVoltage && canChange && input.targetCurrent > c.minCurrent) { const target = Math.max(c.minCurrent, input.targetCurrent - c.step); this.lastChange = now; this.state = "REDUCING"; return { decision: "REDUCE", targetCurrent: target, state: this.state, reason: "Voltage fell below the target range" }; }
    if (input.voltage >= c.targetVoltage && canChange && input.targetCurrent < c.maxCurrent) { const target = Math.min(c.maxCurrent, input.targetCurrent + c.step); this.lastChange = now; this.state = "RECOVERING"; return { decision: "RECOVER", targetCurrent: target, state: this.state, reason: "Voltage has room for more charging current" }; }
    this.state = input.voltage < minimumAllowedVoltage ? "LIMITED" : "STABLE"; return { decision: "HOLD", targetCurrent: input.targetCurrent, state: this.state, reason: "Voltage is within the target range" };
  }
}
