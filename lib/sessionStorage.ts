export type LocalChargingSession = {
  id: string;

  /**
   * Local timestamp when EVergy detected charging.
   */
  startedAt: number;

  /**
   * Local timestamp when EVergy detected charging stopped.
   */
  endedAt: number | null;

  /**
   * Duration in seconds.
   */
  durationSeconds: number | null;

  /**
   * Energy reported by ElectroS when the session ended.
   */
  energyKwh: number | null;
};

type ActiveChargingState = {
  sessionId: string;
  startedAt: number;
  lastSeenChargingAt: number;
};

const ACTIVE_SESSION_KEY =
  "evergy-active-session";

const SESSION_HISTORY_KEY =
  "evergy-session-history";

const MAX_LOCAL_SESSIONS = 100;

function isBrowser() {
  return (
    typeof window !== "undefined"
  );
}

/* -------------------------------------------------------------------------- */
/* ACTIVE SESSION                                                             */
/* -------------------------------------------------------------------------- */

export function getActiveSession():
  | ActiveChargingState
  | null {
  if (!isBrowser()) {
    return null;
  }

  try {
    const raw =
      window.localStorage.getItem(
        ACTIVE_SESSION_KEY,
      );

    if (!raw) {
      return null;
    }

    const parsed =
      JSON.parse(raw);

    if (
      typeof parsed?.sessionId !==
        "string" ||
      typeof parsed?.startedAt !==
        "number" ||
      typeof parsed?.lastSeenChargingAt !==
        "number"
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function saveActiveSession(
  session: ActiveChargingState,
) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(
    ACTIVE_SESSION_KEY,
    JSON.stringify(session),
  );
}

function clearActiveSession() {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(
    ACTIVE_SESSION_KEY,
  );
}

/* -------------------------------------------------------------------------- */
/* SESSION HISTORY                                                            */
/* -------------------------------------------------------------------------- */

export function getLocalSessions():
  LocalChargingSession[] {
  if (!isBrowser()) {
    return [];
  }

  try {
    const raw =
      window.localStorage.getItem(
        SESSION_HISTORY_KEY,
      );

    if (!raw) {
      return [];
    }

    const parsed =
      JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (
        session,
      ): session is LocalChargingSession =>
        typeof session?.id ===
          "string" &&
        typeof session?.startedAt ===
          "number" &&
        (
          typeof session?.endedAt ===
            "number" ||
          session?.endedAt === null
        ) &&
        (
          typeof session?.durationSeconds ===
            "number" ||
          session?.durationSeconds === null
        ) &&
        (
          typeof session?.energyKwh ===
            "number" ||
          session?.energyKwh === null
        ),
    );
  } catch {
    return [];
  }
}

export function getLastCompletedSession():
  LocalChargingSession | null {
  const sessions =
    getLocalSessions();

  if (sessions.length === 0) {
    return null;
  }

  return sessions[
    sessions.length - 1
  ];
}

function saveLocalSessions(
  sessions: LocalChargingSession[],
) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(
    SESSION_HISTORY_KEY,
    JSON.stringify(
      sessions.slice(
        -MAX_LOCAL_SESSIONS,
      ),
    ),
  );
}

/* -------------------------------------------------------------------------- */
/* SESSION LIFECYCLE                                                          */
/* -------------------------------------------------------------------------- */

export function startLocalSession(
  now: number = Date.now(),
) {
  const existing =
    getActiveSession();

  /*
   * IMPORTANT:
   *
   * If the browser was refreshed while charging,
   * keep the original session.
   */
  if (existing) {
    return existing;
  }

  const session: ActiveChargingState = {
    sessionId:
      `session-${now}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,

    startedAt: now,

    lastSeenChargingAt: now,
  };

  saveActiveSession(session);

  return session;
}

export function touchLocalSession(
  now: number = Date.now(),
) {
  const active =
    getActiveSession();

  if (!active) {
    return null;
  }

  const updated: ActiveChargingState = {
    ...active,
    lastSeenChargingAt: now,
  };

  saveActiveSession(updated);

  return updated;
}

export function finishLocalSession({
  now = Date.now(),
  energyKwh = null,
}: {
  now?: number;
  energyKwh?: number | null;
}) {
  const active =
    getActiveSession();

  if (!active) {
    return null;
  }

  /*
   * Protect against a broken clock / invalid duration.
   */
  const durationSeconds =
    Math.max(
      0,
      Math.round(
        (now - active.startedAt) /
          1000,
      ),
    );

  const completedSession:
    LocalChargingSession = {
      id: active.sessionId,

      startedAt:
        active.startedAt,

      endedAt: now,

      durationSeconds,

      energyKwh:
        typeof energyKwh ===
          "number" &&
        Number.isFinite(
          energyKwh,
        )
          ? energyKwh
          : null,
    };

  const existingSessions =
    getLocalSessions();

  saveLocalSessions([
    ...existingSessions,
    completedSession,
  ]);

  clearActiveSession();

  return completedSession;
}

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

export function getCurrentSessionDurationSeconds(
  now: number = Date.now(),
): number {
  const active =
    getActiveSession();

  if (!active) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor(
      (now - active.startedAt) /
        1000,
    ),
  );
}

export function getCurrentSessionStartedAt():
  number | null {
  return (
    getActiveSession()
      ?.startedAt ?? null
  );
}