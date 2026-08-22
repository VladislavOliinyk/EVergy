"use client";

import { useEffect, useRef, useState } from "react";

import type {
  ChargerConnectionState,
  ChargerTelemetry,
} from "../domain/telemetry";

import { parseElectrosPacket } from "../providers/electros/parser";

import {
  ElectroSWebSocket,
  type ElectroSWebSocketEvent,
} from "../providers/electros/websocket";

const DEFAULT_DEVICE_ID = "b8349";

const EMPTY_TELEMETRY: ChargerTelemetry = {
  connectionState: "disconnected",
  operationState: "unknown",

  statusCode: null,

  voltageVolts: null,
  currentAmps: null,
  powerKw: null,
  energyKwh: null,

  neutralVoltageVolts: null,

  voltageMinVolts: null,
  voltageMaxVolts: null,
  voltageAverageVolts: null,

  neutralVoltageMinVolts: null,
  neutralVoltageMaxVolts: null,
  neutralVoltageAverageVolts: null,

  chargingCurrentTargetAmps: null,
  minimumVoltageThresholdVolts: null,

  monthlyEnergy: null,
  chargingHistory: [],

  timestamp: null,
};

function getSessionStorageKey(
  deviceId: string,
) {
  return `evergy-session-${deviceId}`;
}

type StoredSession = {
  startedAt: number | null;
  lastDurationSeconds: number;
};

const EMPTY_SESSION: StoredSession = {
  startedAt: null,
  lastDurationSeconds: 0,
};

export function useChargerTelemetry(
  deviceId: string = DEFAULT_DEVICE_ID,
) {
  const [telemetry, setTelemetry] =
    useState<ChargerTelemetry>(
      EMPTY_TELEMETRY,
    );

  const [lastError, setLastError] =
    useState<Error | null>(null);

  const [sessionStartedAt, setSessionStartedAt] =
    useState<number | null>(null);

  const [sessionDurationSeconds, setSessionDurationSeconds] =
    useState(0);

  const clientRef =
    useRef<ElectroSWebSocket | null>(null);

  const sessionRef =
    useRef<StoredSession>(
      EMPTY_SESSION,
    );

  const previousChargingRef =
    useRef(false);

  const sessionReadyRef =
    useRef(false);

  /*
   * ------------------------------------------------------------------------
   * Session persistence
   * ------------------------------------------------------------------------
   *
   * We store only the session start timestamp and the last completed
   * duration.
   *
   * ElectroS remains the source of truth for the current charging state.
   * localStorage is only persistence so a browser refresh does not destroy
   * the current session.
   */
  useEffect(() => {
    const storageKey =
      getSessionStorageKey(deviceId);

    try {
      const saved =
        window.localStorage.getItem(
          storageKey,
        );

      if (!saved) {
        sessionRef.current = {
          ...EMPTY_SESSION,
        };

        setSessionStartedAt(null);
        setSessionDurationSeconds(0);

        sessionReadyRef.current = true;

        return;
      }

      const parsed =
        JSON.parse(saved) as Partial<StoredSession>;

      const startedAt =
        typeof parsed.startedAt === "number" &&
        Number.isFinite(parsed.startedAt)
          ? parsed.startedAt
          : null;

      const lastDurationSeconds =
        typeof parsed.lastDurationSeconds ===
          "number" &&
        Number.isFinite(
          parsed.lastDurationSeconds,
        )
          ? Math.max(
              0,
              Math.floor(
                parsed.lastDurationSeconds,
              ),
            )
          : 0;

      sessionRef.current = {
        startedAt,
        lastDurationSeconds,
      };

      setSessionStartedAt(startedAt);

      setSessionDurationSeconds(
        startedAt !== null
          ? Math.max(
              0,
              Math.floor(
                (Date.now() - startedAt) /
                  1000,
              ),
            )
          : lastDurationSeconds,
      );

      sessionReadyRef.current = true;
    } catch (error) {
      console.error(
        "[EVergy] Failed to restore charging session",
        error,
      );

      sessionRef.current = {
        ...EMPTY_SESSION,
      };

      setSessionStartedAt(null);
      setSessionDurationSeconds(0);

      sessionReadyRef.current = true;
    }
  }, [deviceId]);

  /*
   * Save session state.
   */
  const persistSession = (
    session: StoredSession,
  ) => {
    sessionRef.current = session;

    try {
      window.localStorage.setItem(
        getSessionStorageKey(deviceId),
        JSON.stringify(session),
      );
    } catch (error) {
      console.error(
        "[EVergy] Failed to persist charging session",
        error,
      );
    }
  };

  /*
   * ------------------------------------------------------------------------
   * Live session timer
   * ------------------------------------------------------------------------
   *
   * The timer uses the locally persisted start timestamp.
   *
   * It does NOT create a new start timestamp every time the page renders.
   */
  useEffect(() => {
    if (sessionStartedAt === null) {
      return;
    }

    const updateDuration = () => {
      const elapsed =
        Math.max(
          0,
          Math.floor(
            (Date.now() -
              sessionStartedAt) /
              1000,
          ),
        );

      setSessionDurationSeconds(
        elapsed,
      );
    };

    updateDuration();

    const interval =
      window.setInterval(
        updateDuration,
        1000,
      );

    return () => {
      window.clearInterval(interval);
    };
  }, [sessionStartedAt]);

  /*
   * ------------------------------------------------------------------------
   * ElectroS WebSocket
   * ------------------------------------------------------------------------
   */
  useEffect(() => {
    let mounted = true;

    const handleEvent = (
      event: ElectroSWebSocketEvent,
    ) => {
      if (!mounted) {
        return;
      }

      /*
       * WebSocket connection state.
       */
      if (event.type === "state") {
        setTelemetry((current) => ({
          ...current,
          connectionState: event.state,
        }));

        return;
      }

      /*
       * Incoming ElectroS telemetry packet.
       */
      if (event.type === "message") {
        try {
          const parsedTelemetry =
            parseElectrosPacket(
              event.data,
            );

          setTelemetry((current) => {
            /*
             * Live telemetry is replaced every second.
             *
             * Historical information is preserved when
             * the incoming packet does not contain it.
             */
            const nextTelemetry: ChargerTelemetry = {
              ...current,
              ...parsedTelemetry,

              connectionState: "connected",

              monthlyEnergy:
                parsedTelemetry.monthlyEnergy ??
                current.monthlyEnergy,

              chargingHistory:
                parsedTelemetry.chargingHistory
                  ?.length
                  ? parsedTelemetry.chargingHistory
                  : current.chargingHistory,
            };

            const charging =
              nextTelemetry.operationState ===
              "charging";

            const wasCharging =
              previousChargingRef.current;

            /*
             * --------------------------------------------------------------
             * SESSION START
             * --------------------------------------------------------------
             *
             * ElectroS says charging has started.
             *
             * If we already have a persisted active session, keep it.
             * This is what makes F5/reconnect work correctly.
             *
             * If there is no active session, create one now.
             */
            if (
              charging &&
              sessionReadyRef.current
            ) {
              const existingStart =
                sessionRef.current.startedAt;

              if (existingStart === null) {
                const startedAt =
                  Date.now();

                persistSession({
                  startedAt,
                  lastDurationSeconds:
                    sessionRef.current
                      .lastDurationSeconds,
                });

                setSessionStartedAt(
                  startedAt,
                );

                setSessionDurationSeconds(
                  0,
                );

                console.log(
                  "[EVergy] Charging session started",
                  {
                    startedAt,
                    electroSTimestamp:
                      nextTelemetry.timestamp,
                  },
                );
              } else {
                /*
                 * Existing session restored from localStorage.
                 */
                setSessionStartedAt(
                  existingStart,
                );
              }
            }

            /*
             * --------------------------------------------------------------
             * SESSION END
             * --------------------------------------------------------------
             *
             * ElectroS was charging and now reports another state.
             *
             * Save the final duration before clearing the active start.
             */
            if (
              wasCharging &&
              !charging &&
              sessionReadyRef.current
            ) {
              const startedAt =
                sessionRef.current.startedAt;

              if (startedAt !== null) {
                const finalDuration =
                  Math.max(
                    0,
                    Math.floor(
                      (Date.now() -
                        startedAt) /
                        1000,
                    ),
                  );

                persistSession({
                  startedAt: null,
                  lastDurationSeconds:
                    finalDuration,
                });

                setSessionStartedAt(
                  null,
                );

                setSessionDurationSeconds(
                  finalDuration,
                );

                console.log(
                  "[EVergy] Charging session finished",
                  {
                    durationSeconds:
                      finalDuration,
                    electroSTimestamp:
                      nextTelemetry.timestamp,
                  },
                );
              }
            }

            previousChargingRef.current =
              charging;

            console.log(
              "[EVergy] Telemetry updated",
              {
                timestamp:
                  nextTelemetry.timestamp,
                voltage:
                  nextTelemetry.voltageVolts,
                current:
                  nextTelemetry.currentAmps,
                power:
                  nextTelemetry.powerKw,
                energy:
                  nextTelemetry.energyKwh,
                target:
                  nextTelemetry.chargingCurrentTargetAmps,
                status:
                  nextTelemetry.operationState,
                monthlyEnergy:
                  nextTelemetry.monthlyEnergy,
                historyEntries:
                  nextTelemetry.chargingHistory
                    .length,
                sessionStartedAt:
                  sessionRef.current
                    .startedAt,
sessionDurationSeconds:
  sessionRef.current.startedAt !== null
    ? Math.max(
        0,
        Math.floor(
          (Date.now() -
            sessionRef.current.startedAt) /
            1000,
        ),
      )
    : sessionRef.current
        .lastDurationSeconds,
              },
            );

            return nextTelemetry;
          });

          setLastError(null);
        } catch (error) {
          const normalizedError =
            error instanceof Error
              ? error
              : new Error(
                  "Failed to parse ElectroS telemetry packet.",
                );

          console.error(
            "[EVergy] Failed to parse ElectroS telemetry",
            normalizedError,
          );

          setLastError(
            normalizedError,
          );
        }

        return;
      }

      /*
       * WebSocket error.
       */
      if (event.type === "error") {
        const error = new Error(
          "ElectroS WebSocket error.",
        );

        console.error(
          "[EVergy] ElectroS WebSocket error",
          event.error,
        );

        setLastError(error);
      }
    };

    const client =
      new ElectroSWebSocket(
        handleEvent,
      );

    clientRef.current = client;

    client.connect(deviceId);

    return () => {
      mounted = false;

      client.disconnect();

      clientRef.current = null;
    };
  }, [deviceId]);

  return {
    telemetry,

    connectionState:
      telemetry.connectionState as ChargerConnectionState,

    lastError,

    isConnected:
      telemetry.connectionState ===
      "connected",

    isCharging:
      telemetry.operationState ===
      "charging",

    /*
     * Current session duration in seconds.
     *
     * While charging:
     *   Date.now() - startedAt
     *
     * After charging:
     *   final stored duration
     */
    sessionDurationSeconds,

    /*
     * Timestamp of the locally persisted active session.
     *
     * null = no active charging session.
     */
    sessionStartedAt,
  };
}