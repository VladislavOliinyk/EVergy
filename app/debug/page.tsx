"use client";

import { useEffect, useRef, useState } from "react";
import { parseElectrosPacket } from "../../providers/electros/parser";
import {
  ElectroSWebSocket,
  type ElectroSWebSocketEvent,
} from "../../providers/electros/websocket";
import type {
  ChargerConnectionState,
  ChargerTelemetry,
} from "../../domain/telemetry";

const DEFAULT_DEVICE_ID = "b8349";

export default function DebugPage() {
  const clientRef = useRef<ElectroSWebSocket | null>(null);

  const [deviceId, setDeviceId] = useState(DEFAULT_DEVICE_ID);
  const [connectionState, setConnectionState] =
    useState<ChargerConnectionState>("disconnected");

  const [rawPacket, setRawPacket] = useState("");
  const [telemetry, setTelemetry] =
    useState<ChargerTelemetry | null>(null);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const client = new ElectroSWebSocket(
      handleWebSocketEvent,
    );

    clientRef.current = client;

    return () => {
      client.disconnect();
      clientRef.current = null;
    };
  }, []);

  function handleWebSocketEvent(
    event: ElectroSWebSocketEvent,
  ) {
    switch (event.type) {
      case "state":
        setConnectionState(event.state);
        break;

      case "message": {
console.log(
  "[ElectroS] telemetry packet received:",
  new Date().toISOString(),
);
        setRawPacket(event.data);

        try {
          const parsed = parseElectrosPacket(event.data);

          setTelemetry(parsed);
          setError(null);
        } catch (parseError) {
          console.error(
            "ElectroS parser error:",
            parseError,
          );

          setError("Failed to parse ElectroS packet.");
        }

        break;
      }

      case "error":
        console.error(
          "ElectroS WebSocket error:",
          event.error,
        );

        setError(
          "WebSocket error. Check the browser console.",
        );

        break;
    }
  }

  function connect() {
    const client = clientRef.current;

    if (!client) {
      return;
    }

    setError(null);
    setRawPacket("");
    setTelemetry(null);

    try {
      client.connect(deviceId);
    } catch (connectError) {
      setError(
        connectError instanceof Error
          ? connectError.message
          : "Unable to connect.",
      );
    }
  }

  function disconnect() {
    clientRef.current?.disconnect();
  }

  const statusLabel =
    connectionState === "connected"
      ? "CONNECTED"
      : connectionState.toUpperCase();

  return (
    <main className="min-h-screen bg-[#070a0c] px-5 py-8 text-white">
      <div className="mx-auto max-w-3xl">
        <header>
          <div className="text-3xl font-semibold">
            EV
            <span className="text-cyan-400">
              ergy
            </span>
          </div>

          <div className="mt-1 text-xs tracking-[0.25em] text-zinc-500">
            ELECTROS DEBUG
          </div>
        </header>

        {/* Connection */}
        <section className="mt-8 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
          <div className="text-xs tracking-[0.2em] text-zinc-500">
            DEVICE
          </div>

          <input
            value={deviceId}
            onChange={(event) =>
              setDeviceId(event.target.value)
            }
            className="mt-3 w-full rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 font-mono text-sm outline-none transition focus:border-cyan-400/50"
            placeholder="ElectroS device ID"
          />

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={connect}
              disabled={
                connectionState === "connected" ||
                connectionState === "connecting"
              }
              className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-[#061013] disabled:cursor-not-allowed disabled:opacity-40"
            >
              CONNECT
            </button>

            <button
              type="button"
              onClick={disconnect}
              disabled={
                connectionState === "disconnected"
              }
              className="rounded-xl border border-white/10 px-5 py-3 text-sm text-zinc-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              DISCONNECT
            </button>
          </div>

          <div className="mt-5 flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                connectionState === "connected"
                  ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]"
                  : connectionState ===
                      "connecting" ||
                    connectionState ===
                      "reconnecting"
                    ? "bg-amber-400"
                    : "bg-zinc-600"
              }`}
            />

            <span className="text-xs tracking-[0.16em] text-zinc-400">
              {statusLabel}
            </span>
          </div>
        </section>

        {/* Error */}
        {error && (
          <section className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/[0.05] p-4 text-sm text-red-300">
            {error}
          </section>
        )}

        {/* Telemetry */}
        <section className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
          <div className="text-xs tracking-[0.2em] text-zinc-500">
            PARSED TELEMETRY
          </div>

          {telemetry ? (
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <TelemetryCard
                label="VOLTAGE"
                value={formatValue(
                  telemetry.voltageVolts,
                  "V",
                )}
              />

              <TelemetryCard
                label="CURRENT"
                value={formatValue(
                  telemetry.currentAmps,
                  "A",
                )}
              />

              <TelemetryCard
                label="POWER"
                value={formatValue(
                  telemetry.powerKw,
                  "kW",
              )}
              />

              <TelemetryCard
                label="ENERGY"
                value={formatValue(
                  telemetry.energyKwh,
                  "kWh",
                )}
              />

              <TelemetryCard
                label="TARGET"
                value={formatValue(
                  telemetry.chargingCurrentTargetAmps,
                  "A",
                )}
              />

              <TelemetryCard
                label="STATUS"
                value={telemetry.operationState}
              />

              <TelemetryCard
                label="STATUS CODE"
                value={
                  telemetry.statusCode?.toString() ?? "—"
                }
              />

              <TelemetryCard
                label="TIMESTAMP"
                value={telemetry.timestamp ?? "—"}
              />
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-white/[0.08] px-4 py-8 text-center text-sm text-zinc-600">
              Waiting for telemetry…
            </div>
          )}
        </section>

        {/* Raw packet */}
        <section className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5">
          <div className="text-xs tracking-[0.2em] text-zinc-500">
            RAW PACKET
          </div>

          <pre className="mt-4 max-h-[400px] overflow-auto rounded-xl bg-black/30 p-4 font-mono text-xs leading-6 text-zinc-400">
            {rawPacket || "Waiting for packet…"}
          </pre>
        </section>
      </div>
    </main>
  );
}

function TelemetryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/10 p-3">
      <div className="text-[9px] tracking-[0.16em] text-zinc-600">
        {label}
      </div>

      <div className="mt-2 break-words text-sm font-medium text-zinc-200">
        {value}
      </div>
    </div>
  );
}

function formatValue(
  value: number | null,
  unit: string,
) {
  if (value === null) {
    return `— ${unit}`;
  }

  return `${value} ${unit}`;
}