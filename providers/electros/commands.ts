const ELECTROS_CURRENT_OPTIONS = [
  32,
  30,
  28,
  26,
  24,
  22,
  20,
  18,
  16,
  14,
  12,
  10,
  8,
  6,
] as const;

export function getElectroSCurrentIndex(
  currentAmps: number,
): number {
  const index =
    ELECTROS_CURRENT_OPTIONS.indexOf(
      currentAmps as (typeof ELECTROS_CURRENT_OPTIONS)[number],
    );

  if (index === -1) {
    throw new Error(
      `Unsupported ElectroS current: ${currentAmps} A`,
    );
  }

  return index;
}

export function buildStartCommand(
  currentAmps: number,
): string {
  const currentIndex =
    getElectroSCurrentIndex(
      currentAmps,
    );

  return [
    "start",
    String(currentIndex),
    "0",
  ].join("\n");
}

export function buildStopCommand(): string {
  return "stop";
}