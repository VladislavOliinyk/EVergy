import type {
  ChargerOperationState,
  ChargerTelemetry,
  ChargingHistoryEntry,
  MonthlyEnergyStats,
} from "../../domain/telemetry";

const ELECTROS_STATUS_MAP: Record<number, ChargerOperationState> = {
  0: "waiting_for_vehicle",
  1: "connected_no_charge",
  2: "charging",
  3: "charging_error",
  4: "charging_forbidden",
  5: "low_voltage",
  6: "communication_error",
  7: "station_offline",
  16: "leakage_detected",
  32: "overcurrent",
  77: "station_offline",
};

function parseNumber(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") {
    return undefined;
  }

  const parsed = Number(value.trim());

  return Number.isFinite(parsed) ? parsed : undefined;
}

function getOperationState(
  statusCode: number | undefined,
): ChargerOperationState {
  if (statusCode === undefined) {
    return "unknown";
  }

  return ELECTROS_STATUS_MAP[statusCode] ?? "unknown";
}

/**
 * ElectroS k=31
 *
 * Vendor format:
 *
 * currentMonth month1 month2 ... month12
 *
 * Monthly values are transmitted multiplied by 1000.
 */
function parseMonthlyEnergy(
  value: string | undefined,
): MonthlyEnergyStats | null {
  if (!value || value.trim() === "") {
    return null;
  }

  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length < 13) {
    return null;
  }

  const currentMonth = parseNumber(parts[0]);

  const energyKwh = parts
    .slice(1, 13)
    .map((part) => {
      const value = parseNumber(part);

      return value !== undefined
        ? value / 1000
        : 0;
    });

  return {
    currentMonth:
      currentMonth !== undefined
        ? currentMonth
        : null,
    energyKwh,
  };
}

/**
 * ElectroS k=32
 *
 * Vendor format:
 *
 * date time energy
 * date time energy
 * date time energy
 * ...
 *
 * Energy is transmitted in Wh-like micro units and
 * converted to kWh by dividing by 1,000,000.
 */
function parseChargingHistory(
  value: string | undefined,
): ChargingHistoryEntry[] {
  if (!value || value.trim() === "") {
    return [];
  }

  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const history: ChargingHistoryEntry[] = [];

  for (let i = 0; i + 2 < parts.length; i += 3) {
    const date = parts[i];
    const time = parts[i + 1];
    const rawEnergy = parseNumber(parts[i + 2]);

    if (
      !date ||
      !time ||
      rawEnergy === undefined
    ) {
      continue;
    }

    history.push({
      date,
      time,
      energyKwh: rawEnergy / 1_000_000,
    });
  }

  return history;
}

export function parseElectrosPacket(
  packet: string,
): ChargerTelemetry {
  const fields = packet
    .split("\n")
    .map((field) => field.trim());

  /*
   * ElectroS sends telemetry as a positional multiline payload.
   *
   * Known fields are normalized below.
   * Unknown fields remain available through raw.fields.
   */

  const statusCode = parseNumber(fields[8]);

  const currentRaw = parseNumber(fields[9]);
  const voltage = parseNumber(fields[10]);
  const energyRaw = parseNumber(fields[11]);
  const powerRaw = parseNumber(fields[12]);

  const neutralVoltage = parseNumber(fields[13]);

  const voltageMax = parseNumber(fields[16]);
  const voltageMin = parseNumber(fields[17]);

  const neutralVoltageMax = parseNumber(fields[18]);
  const neutralVoltageMin = parseNumber(fields[19]);

  const voltageAverage = parseNumber(fields[20]);
  const neutralVoltageAverage = parseNumber(fields[21]);

  const chargingCurrentTarget = parseNumber(fields[7]);
  const minimumVoltageThreshold = parseNumber(fields[24]);

  /*
   * k=31 — monthly energy statistics.
   */
  const monthlyEnergy = parseMonthlyEnergy(fields[31]);

  /*
   * k=32 — charging history.
   */
  const chargingHistory = parseChargingHistory(fields[32]);

  return {
    connectionState: "connected",

    operationState: getOperationState(statusCode),

    statusCode: statusCode ?? null,

    /*
     * k=9:
     * measured current / 10
     */
    currentAmps:
      currentRaw !== undefined
        ? currentRaw / 10
        : null,

    /*
     * k=10:
     * grid voltage directly in volts
     */
    voltageVolts: voltage ?? null,

    /*
     * k=11:
     * consumed energy / 1,000,000
     */
    energyKwh:
      energyRaw !== undefined
        ? energyRaw / 1_000_000
        : null,

    /*
     * k=12:
     * power / 10,000
     */
    powerKw:
      powerRaw !== undefined
        ? powerRaw / 10_000
        : null,

    neutralVoltageVolts:
      neutralVoltage ?? null,

    voltageMinVolts:
      voltageMin ?? null,

    voltageMaxVolts:
      voltageMax ?? null,

    voltageAverageVolts:
      voltageAverage ?? null,

    neutralVoltageMinVolts:
      neutralVoltageMin ?? null,

    neutralVoltageMaxVolts:
      neutralVoltageMax ?? null,

    neutralVoltageAverageVolts:
      neutralVoltageAverage ?? null,

    /*
     * k=7:
     * configured charging current.
     */
    chargingCurrentTargetAmps:
      chargingCurrentTarget ?? null,

    minimumVoltageThresholdVolts:
      minimumVoltageThreshold ?? null,

    timestamp:
      fields[15] || null,

    monthlyEnergy,

    chargingHistory,

    raw: {
      packet,
      fields,
    },
  };
}