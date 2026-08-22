import type { ChargerConnectionState } from "../../domain/telemetry";

const ELECTROS_WS_URL = "wss://electros.org.ua/ws/";
const ELECTROS_WS_PROTOCOL = "example-protocol";

export type ElectroSWebSocketEvent =
  | {
      type: "state";
      state: ChargerConnectionState;
    }
  | {
      type: "message";
      data: string;
    }
  | {
      type: "error";
      error: Event;
    };

export type ElectroSWebSocketListener = (
  event: ElectroSWebSocketEvent,
) => void;

export class ElectroSWebSocket {
  private socket: WebSocket | null = null;

  private deviceId: string | null = null;

  private listener: ElectroSWebSocketListener | null =
    null;

  private reconnectTimer: ReturnType<typeof setTimeout> | null =
    null;

  private telemetryTimer: ReturnType<typeof setInterval> | null =
    null;

  private reconnectAttempt = 0;

  private manuallyClosed = false;

  constructor(
    listener?: ElectroSWebSocketListener,
  ) {
    this.listener = listener ?? null;
  }

  setListener(
    listener: ElectroSWebSocketListener | null,
  ) {
    this.listener = listener;
  }

  connect(deviceId: string) {
    if (typeof window === "undefined") {
      return;
    }

    if (!deviceId.trim()) {
      throw new Error(
        "ElectroS device ID is required.",
      );
    }

    this.deviceId = deviceId.trim();
    this.manuallyClosed = false;

    this.clearReconnectTimer();
    this.stopTelemetryPolling();
    this.closeSocket();

    this.updateState("connecting");

    console.log(
      "[ElectroS] Connecting...",
      this.deviceId,
    );

    const socket = new WebSocket(
      ELECTROS_WS_URL,
      ELECTROS_WS_PROTOCOL,
    );

    this.socket = socket;

    socket.onopen = () => {
      this.reconnectAttempt = 0;

      console.log(
        "[ElectroS] WebSocket OPEN",
        new Date().toISOString(),
      );

      this.updateState("connected");

      /*
       * ElectroS official client requests
       * the current telemetry snapshot every second
       * using:
       *
       * site <device_id>
       */
      this.startTelemetryPolling();
    };

    socket.onmessage = (event) => {
      console.log(
        "[ElectroS RAW MESSAGE]",
        new Date().toISOString(),
        {
          dataType: typeof event.data,
          length:
            typeof event.data === "string"
              ? event.data.length
              : null,
          data: event.data,
        },
      );

      if (typeof event.data !== "string") {
        return;
      }

      this.listener?.({
        type: "message",
        data: event.data,
      });
    };

    socket.onerror = (error) => {
      console.error(
        "[ElectroS] WebSocket ERROR",
        error,
      );

      this.listener?.({
        type: "error",
        error,
      });
    };

    socket.onclose = (event) => {
      console.log(
        "[ElectroS] WebSocket CLOSED",
        {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        },
      );

      this.stopTelemetryPolling();

      this.socket = null;

      if (this.manuallyClosed) {
        this.updateState("disconnected");
        return;
      }

      this.updateState("reconnecting");

      this.scheduleReconnect();
    };
  }

  disconnect() {
    this.manuallyClosed = true;

    this.clearReconnectTimer();
    this.stopTelemetryPolling();

    this.closeSocket();

    this.updateState("disconnected");
  }

  send(command: string) {
    if (!this.socket) {
      throw new Error(
        "ElectroS WebSocket is not connected.",
      );
    }

    if (
      this.socket.readyState !== WebSocket.OPEN
    ) {
      throw new Error(
        "ElectroS WebSocket is not ready.",
      );
    }

    this.socket.send(
      `site ${this.deviceId}\n${command}`,
    );
  }

  get connectionState(): ChargerConnectionState {
    if (this.manuallyClosed) {
      return "disconnected";
    }

    if (!this.socket) {
      return "disconnected";
    }

    switch (this.socket.readyState) {
      case WebSocket.CONNECTING:
        return "connecting";

      case WebSocket.OPEN:
        return "connected";

      case WebSocket.CLOSING:
      case WebSocket.CLOSED:
        return "reconnecting";

      default:
        return "disconnected";
    }
  }

  /**
   * Requests fresh telemetry from ElectroS.
   *
   * The official ElectroS client sends:
   *
   * site <device_id>
   *
   * every 1000 ms.
   */
  private startTelemetryPolling() {
    this.stopTelemetryPolling();

    if (!this.deviceId) {
      return;
    }

    const requestTelemetry = () => {
      if (
        !this.socket ||
        this.socket.readyState !==
          WebSocket.OPEN ||
        !this.deviceId
      ) {
        return;
      }

      console.log(
        "[ElectroS] Requesting telemetry",
        new Date().toISOString(),
      );

      this.socket.send(
        `site ${this.deviceId}`,
      );
    };

    // Request the first snapshot immediately.
    requestTelemetry();

    // Then request a fresh snapshot every second.
    this.telemetryTimer = setInterval(
      requestTelemetry,
      1000,
    );
  }

  private stopTelemetryPolling() {
    if (!this.telemetryTimer) {
      return;
    }

    clearInterval(this.telemetryTimer);

    this.telemetryTimer = null;
  }

  private scheduleReconnect() {
    if (
      this.manuallyClosed ||
      !this.deviceId
    ) {
      return;
    }

    this.clearReconnectTimer();

    /*
     * Exponential backoff:
     *
     * 2s
     * 4s
     * 8s
     * 16s
     * max 30s
     */
    const delay = Math.min(
      2_000 *
        Math.pow(
          2,
          this.reconnectAttempt,
        ),
      30_000,
    );

    this.reconnectAttempt += 1;

    console.log(
      `[ElectroS] Reconnecting in ${delay}ms`,
    );

    this.reconnectTimer = setTimeout(() => {
      if (
        this.manuallyClosed ||
        !this.deviceId
      ) {
        return;
      }

      this.connect(this.deviceId);
    }, delay);
  }

  private closeSocket() {
    this.stopTelemetryPolling();

    if (!this.socket) {
      return;
    }

    this.socket.onopen = null;
    this.socket.onmessage = null;
    this.socket.onerror = null;
    this.socket.onclose = null;

    if (
      this.socket.readyState ===
        WebSocket.OPEN ||
      this.socket.readyState ===
        WebSocket.CONNECTING
    ) {
      this.socket.close();
    }

    this.socket = null;
  }

  private updateState(
    state: ChargerConnectionState,
  ) {
    this.listener?.({
      type: "state",
      state,
    });
  }

  private clearReconnectTimer() {
    if (!this.reconnectTimer) {
      return;
    }

    clearTimeout(this.reconnectTimer);

    this.reconnectTimer = null;
  }
}