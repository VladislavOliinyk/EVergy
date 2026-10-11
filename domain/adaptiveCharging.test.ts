import assert from "node:assert/strict";
import { AdaptiveChargingController } from "./adaptiveCharging";

const config = { stopVoltage: 180, targetVoltage: 200, minCurrent: 6, maxCurrent: 32, step: 2, tolerance: 2, cooldownMs: 12_000 };

const stopped = new AdaptiveChargingController(config).evaluate({ voltage: 180, measuredCurrent: 12, targetCurrent: 12, now: 1 });
assert.equal(stopped.decision, "STOP");
assert.equal(stopped.stopCharging, true);

const controller = new AdaptiveChargingController(config);
const increased = controller.evaluate({ voltage: 202, measuredCurrent: 12, targetCurrent: 12, now: 13_001 });
assert.equal(increased.decision, "RECOVER");
assert.equal(increased.targetCurrent, 14);

const held = controller.evaluate({ voltage: 198, measuredCurrent: 14, targetCurrent: 14, now: 26_002 });
assert.equal(held.decision, "HOLD");

const reduced = controller.evaluate({ voltage: 197, measuredCurrent: 14, targetCurrent: 14, now: 39_003 });
assert.equal(reduced.decision, "REDUCE");
assert.equal(reduced.targetCurrent, 12);

console.log("Adaptive controller tests passed");
