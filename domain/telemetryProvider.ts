export type TuyaTelemetry = { voltage: number | null; current: number | null; power: number | null; energy: number | null; fault: number | string | null; onlineState: string | null; timestamp: string; availableCodes?: string[] };
export interface TelemetryProvider { getStatus(): Promise<TuyaTelemetry>; }
