import assert from "node:assert/strict";
import { AdaptiveChargingController } from "./adaptiveCharging";

const config = {
  minVoltage: 180,
  lowVoltage: 200,
  minCurrent: 6,
  maxCurrent: 32,
  step: 2,
  hysteresis: 3,
  recoveryVoltage: 215,
  cooldownMs: 12_000,
  rules: [
    { belowVoltage: 200, current: 6 },
    { belowVoltage: 205, current: 8 },
    { belowVoltage: 210, current: 10 },
  ],
};

const stopped = new AdaptiveChargingController(config).evaluate({ voltage: 180, measuredCurrent: 12, targetCurrent: 12, now: 1 });
assert.equal(stopped.decision, "STOP");
assert.equal(stopped.stopCharging, true);

const controller = new AdaptiveChargingController(config);
controller.evaluate({ voltage: 212, measuredCurrent: 12, targetCurrent: 12, now: 1 });
const reduced = controller.evaluate({ voltage: 204, measuredCurrent: 12, targetCurrent: 12, now: 13_001 });
assert.equal(reduced.decision, "REDUCE");
assert.equal(reduced.targetCurrent, 8);

const recovered = new AdaptiveChargingController(config).evaluate({ voltage: 220, measuredCurrent: 32, targetCurrent: 32, now: 13_001 });
assert.equal(recovered.targetCurrent, 32);
assert.equal(recovered.decision, "HOLD");

console.log("Adaptive controller tests passed");
