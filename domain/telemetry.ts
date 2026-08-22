export type ChargerConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "offline";

export type ChargerOperationState =
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
  | "unknown";

export interface ChargingHistoryEntry {
  date: string;
  time: string;
  energyKwh: number;
}

export interface MonthlyEnergyStats {
  currentMonth: number | null;
  energyKwh: number[];
}

export interface ChargerTelemetry {
  connectionState: ChargerConnectionState;
  operationState: ChargerOperationState;

  /**
   * Original ElectroS status code.
   * Kept separately so the UI/domain layer does not depend on it.
   */
  statusCode: number | null;

  voltageVolts: number | null;
  currentAmps: number | null;
  powerKw: number | null;
  energyKwh: number | null;

  neutralVoltageVolts: number | null;

  voltageMinVolts: number | null;
  voltageMaxVolts: number | null;
  voltageAverageVolts: number | null;

  neutralVoltageMinVolts: number | null;
  neutralVoltageMaxVolts: number | null;
  neutralVoltageAverageVolts: number | null;

  /**
   * Currently requested charging current.
   *
   * chargingCurrentTargetAmps = requested/current limit
   * currentAmps = actual measured current
   */
  chargingCurrentTargetAmps: number | null;

  minimumVoltageThresholdVolts: number | null;

  timestamp: string | null;

  /**
   * ElectroS monthly energy statistics (k=31).
   *
   * energyKwh contains 12 monthly values:
   * January -> index 0
   * February -> index 1
   * ...
   * December -> index 11
   */
  monthlyEnergy: MonthlyEnergyStats | null;

  /**
   * ElectroS charging history (k=32).
   *
   * Each entry contains the date, time and energy
   * reported by the vendor.
   */
  chargingHistory: ChargingHistoryEntry[];

  raw?: {
    packet: string;
    fields: string[];
  };
}