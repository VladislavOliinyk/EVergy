export interface ChargerProvider { getCurrent(): number | null; setCurrent(amps: number): Promise<void>; }
