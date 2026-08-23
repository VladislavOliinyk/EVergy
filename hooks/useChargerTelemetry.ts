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

import {
  buildStartCommand,
  buildStopCommand,
} from "../providers/electros/commands";

import {
  finishLocalSession,
  getActiveSession,
  getCurrentSessionDurationSeconds,
  getLastCompletedSession,
  startLocalSession,
  touchLocalSession,
} from "../lib/sessionStorage";

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

export function useChargerTelemetry(
  deviceId: string = DEFAULT_DEVICE_ID,
) {
  const [telemetry, setTelemetry] =
    useState<ChargerTelemetry>(
      EMPTY_TELEMETRY,
    );

  const [lastError, setLastError] =
    useState<Error | null>(null);

  const [
    sessionDurationSeconds,
    setSessionDurationSeconds,
  ] = useState(0);

  const [
    sessionStartedAt,
    setSessionStartedAt,
  ] = useState<number | null>(null);

  const [
    lastCompletedSession,
    setLastCompletedSession,
  ] = useState<
    ReturnType<
      typeof getLastCompletedSession
    >
  >(null);

  const clientRef =
    useRef<ElectroSWebSocket | null>(null);

  /*
   * Prevents WebSocket telemetry from being processed
   * before the persisted local session has been restored.
   */
  const sessionInitializedRef =
    useRef(false);

  /*
   * Remembers whether the previous meaningful telemetry
   * state was charging.
   */
  const wasChargingRef =
    useRef(false);

  /*
   * --------------------------------------------------------------
   * RESTORE LOCAL SESSION
   * --------------------------------------------------------------
   */
  useEffect(() => {
    try {
      const activeSession =
        getActiveSession();

      if (activeSession) {
        setSessionStartedAt(
          activeSession.startedAt,
        );

        setSessionDurationSeconds(
          getCurrentSessionDurationSeconds(),
        );

        console.log(
          "[EVergy] Restored active charging session",
          {
            startedAt:
              activeSession.startedAt,
            durationSeconds:
              getCurrentSessionDurationSeconds(),
          },
        );
      } else {
        setSessionStartedAt(null);
        setSessionDurationSeconds(0);
      }

      setLastCompletedSession(
        getLastCompletedSession(),
      );
    } catch (error) {
      console.error(
        "[EVergy] Failed to restore local charging session",
        error,
      );

      setSessionStartedAt(null);
      setSessionDurationSeconds(0);
      setLastCompletedSession(null);
    }

    sessionInitializedRef.current = true;
  }, [deviceId]);

  /*
   * --------------------------------------------------------------
   * LIVE SESSION TIMER
   * --------------------------------------------------------------
   */
  useEffect(() => {
    if (sessionStartedAt === null) {
      return;
    }

    const updateDuration = () => {
      const elapsed = Math.max(
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
   * --------------------------------------------------------------
   * ELECTROS WEBSOCKET
   * --------------------------------------------------------------
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
       * ------------------------------------------------------------
       * WEBSOCKET CONNECTION STATE
       * ------------------------------------------------------------
       */
      if (event.type === "state") {
        setTelemetry((current) => ({
          ...current,
          connectionState: event.state,
        }));

        return;
      }

      /*
       * ------------------------------------------------------------
       * TELEMETRY PACKET
       * ------------------------------------------------------------
       */
      if (event.type === "message") {
        try {
          const parsedTelemetry =
            parseElectrosPacket(
              event.data,
            );

          /*
           * --------------------------------------------------------
           * UPDATE LIVE TELEMETRY
           * --------------------------------------------------------
           */
          setTelemetry((current) => ({
            ...current,
            ...parsedTelemetry,

            connectionState:
              "connected",

            monthlyEnergy:
              parsedTelemetry.monthlyEnergy ??
              current.monthlyEnergy,

            chargingHistory:
              parsedTelemetry
                .chargingHistory
                ?.length
                ? parsedTelemetry
                    .chargingHistory
                : current.chargingHistory,
          }));

          /*
           * --------------------------------------------------------
           * LOCAL SESSION TRACKING
           * --------------------------------------------------------
           */
          if (
            sessionInitializedRef.current
          ) {
            const operationState =
              parsedTelemetry.operationState;

            const currentlyCharging =
              operationState ===
              "charging";

            /*
             * ------------------------------------------------------
             * CHARGING
             * ------------------------------------------------------
             */
            if (currentlyCharging) {
              const activeSession =
                getActiveSession();

              /*
               * Existing session survives:
               *
               * - page refresh
               * - React remount
               * - WebSocket reconnect
               */
              const session =
                activeSession ??
                startLocalSession();

              touchLocalSession();

              setSessionStartedAt(
                session.startedAt,
              );

              setSessionDurationSeconds(
                getCurrentSessionDurationSeconds(),
              );

              wasChargingRef.current =
                true;

              console.log(
                "[EVergy] Charging session active",
                {
                  startedAt:
                    session.startedAt,
                  durationSeconds:
                    getCurrentSessionDurationSeconds(),
                  electroSTimestamp:
                    parsedTelemetry.timestamp,
                },
              );
            }

            /*
             * ------------------------------------------------------
             * NOT CHARGING
             * ------------------------------------------------------
             */
            else {
              const definiteStopStates =
                new Set([
                  "waiting_for_vehicle",
                  "connected_no_charge",
                  "charging_error",
                  "charging_forbidden",
                  "low_voltage",
                  "communication_error",
                  "leakage_detected",
                  "overcurrent",
                  "station_offline",
                ]);

              const shouldFinishSession =
                wasChargingRef.current &&
                definiteStopStates.has(
                  operationState,
                );

              if (shouldFinishSession) {
                const activeSession =
                  getActiveSession();

                if (activeSession) {
                  const finishedDuration =
                    Math.max(
                      0,
                      Math.round(
                        (Date.now() -
                          activeSession.startedAt) /
                          1000,
                      ),
                    );

                  const finishedSession =
                    finishLocalSession({
                      energyKwh:
                        parsedTelemetry.energyKwh,
                    });

                  setLastCompletedSession(
                    finishedSession,
                  );

                  console.log(
                    "[EVergy] Charging session finished",
                    {
                      startedAt:
                        activeSession.startedAt,
                      durationSeconds:
                        finishedDuration,
                      energyKwh:
                        finishedSession?.energyKwh ??
                        parsedTelemetry.energyKwh,
                      electroSTimestamp:
                        parsedTelemetry.timestamp,
                    },
                  );
                }

                setSessionStartedAt(
                  null,
                );

                setSessionDurationSeconds(
                  0,
                );

                wasChargingRef.current =
                  false;
              }
            }
          }

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
       * ------------------------------------------------------------
       * WEBSOCKET ERROR
       * ------------------------------------------------------------
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

  /*
   * --------------------------------------------------------------
   * START CHARGING
   * --------------------------------------------------------------
   */
  const startCharging = (
    currentAmps: number,
  ) => {
    const client =
      clientRef.current;

    if (!client) {
      throw new Error(
        "ElectroS WebSocket client is not initialized.",
      );
    }

    const command =
      buildStartCommand(
        currentAmps,
      );

    console.log(
      "[EVergy] Sending START command",
      {
        currentAmps,
        command,
      },
    );

    client.send(command);
  };

  /*
   * --------------------------------------------------------------
   * STOP CHARGING
   * --------------------------------------------------------------
   */
  const stopCharging = () => {
    const client =
      clientRef.current;

    if (!client) {
      throw new Error(
        "ElectroS WebSocket client is not initialized.",
      );
    }

    const command =
      buildStopCommand();

    console.log(
      "[EVergy] Sending STOP command",
    );

    client.send(command);
  };

  /*
   * --------------------------------------------------------------
   * PUBLIC API
   * --------------------------------------------------------------
   */
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

    sessionDurationSeconds,

    sessionStartedAt,

    lastCompletedSession,

    startCharging,

    stopCharging,
  };
}