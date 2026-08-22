import assert from "node:assert/strict";
import { parseElectrosPacket } from "./parser";

const packet = [
  "MyWiFi",                         // k=0
  "password",                       // k=1
  "unused",                         // k=2
  "unused",                         // k=3
  "192.168.0.100",                  // k=4
  "8080",                           // k=5
  "0",                              // k=6
  "16",                             // k=7 target current
  "2",                              // k=8 charging
  "158",                            // k=9 actual current = 15.8 A
  "215",                            // k=10 voltage
  "24800000",                       // k=11 energy = 24.8 kWh
  "34400",                          // k=12 power = 3.44 kW
  "215",                            // k=13 neutral voltage
  "",                               // k=14
  "2026-08-20T15:30:00",            // k=15 timestamp
  "230",                            // k=16 max voltage
  "205",                            // k=17 min voltage
  "220",                            // k=18 max neutral voltage
  "205",                            // k=19 min neutral voltage
  "218",                            // k=20 average voltage
  "216",                            // k=21 average neutral voltage
  "1",                              // k=22 voltage coefficient
  "1",                              // k=23 current coefficient
  "200",                            // k=24 minimum charging voltage
  "0",                              // k=25 leakage mode
  "00:00",                          // k=26 start time
  "23:59",                          // k=27 stop time
  "EVergy Test",                    // k=28 device name
  "device-password",                // k=29 device password
  "",                               // k=30 messages
  "8 0 0 0 0 0 0 0 0 0 0 84.2",    // k=31 monthly stats
  "18.08 13:21:09 52000000 18.08 02:33:27 14000000 17.08 20:14:05 7200000", // k=32
].join("\n");

const telemetry = parseElectrosPacket(packet);

//
// LIVE TELEMETRY
//

assert.equal(telemetry.statusCode, 2);
assert.equal(telemetry.operationState, "charging");

assert.equal(telemetry.voltageVolts, 215);
assert.equal(telemetry.currentAmps, 15.8);
assert.equal(telemetry.powerKw, 3.44);
assert.equal(telemetry.energyKwh, 24.8);

assert.equal(
  telemetry.chargingCurrentTargetAmps,
  16,
);

assert.equal(
  telemetry.neutralVoltageVolts,
  215,
);

assert.equal(
  telemetry.voltageMaxVolts,
  230,
);

assert.equal(
  telemetry.voltageMinVolts,
  205,
);

assert.equal(
  telemetry.voltageAverageVolts,
  218,
);

assert.equal(
  telemetry.timestamp,
  "2026-08-20T15:30:00",
);

//
// MONTHLY ENERGY — k=31
//

assert.ok(telemetry.monthlyEnergy);

assert.equal(
  telemetry.monthlyEnergy?.currentMonth,
  8,
);

assert.equal(
  telemetry.monthlyEnergy?.energyKwh.length,
  12,
);

assert.equal(
  telemetry.monthlyEnergy?.energyKwh[11],
  0.0842,
);

//
// CHARGING HISTORY — k=32
//

assert.equal(
  telemetry.chargingHistory.length,
  3,
);

assert.deepEqual(
  telemetry.chargingHistory[0],
  {
    date: "18.08",
    time: "13:21:09",
    energyKwh: 52,
  },
);

assert.deepEqual(
  telemetry.chargingHistory[1],
  {
    date: "18.08",
    time: "02:33:27",
    energyKwh: 14,
  },
);

assert.deepEqual(
  telemetry.chargingHistory[2],
  {
    date: "17.08",
    time: "20:14:05",
    energyKwh: 7.2,
  },
);

//
// RAW DATA
//

assert.equal(
  telemetry.raw?.packet,
  packet,
);

assert.equal(
  telemetry.raw?.fields.length,
  33,
);

console.log("✅ ElectroS parser test passed");
console.log("");

console.log(
  `Status:   ${telemetry.operationState}`,
);

console.log(
  `Voltage:  ${telemetry.voltageVolts} V`,
);

console.log(
  `Current:  ${telemetry.currentAmps} A`,
);

console.log(
  `Power:    ${telemetry.powerKw} kW`,
);

console.log(
  `Energy:   ${telemetry.energyKwh} kWh`,
);

console.log(
  `Target:   ${telemetry.chargingCurrentTargetAmps} A`,
);

console.log(
  `History:  ${telemetry.chargingHistory.length} entries`,
);

console.log(
  `Monthly:  ${telemetry.monthlyEnergy?.energyKwh.join(", ")} kWh`,
);