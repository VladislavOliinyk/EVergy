import assert from "node:assert/strict";
import test from "node:test";

import {
  finishLocalSession,
  getLastCompletedSession,
  startLocalSession,
} from "./sessionStorage";

type StorageLike = Record<string, string>;

const makeStorage = () => {
  const store: StorageLike = {};

  return {
    getItem: (key: string) =>
      Object.prototype.hasOwnProperty.call(store, key)
        ? store[key]
        : null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
  } as Storage;
};

test("keeps the latest finished session available for the home screen", () => {
  const storage = makeStorage();

  Object.defineProperty(globalThis, "window", {
    value: { localStorage: storage },
    configurable: true,
    writable: true,
  });

  const firstSession = startLocalSession(1_000);
  assert.ok(firstSession);

  const firstFinished = finishLocalSession({
    now: 1_000 + 60_000,
    energyKwh: 2.4,
  });

  assert.ok(firstFinished);
  assert.equal(firstFinished.durationSeconds, 60);

  const secondSession = startLocalSession(2_000);
  assert.ok(secondSession);

  const secondFinished = finishLocalSession({
    now: 2_000 + 180_000,
    energyKwh: 4.2,
  });

  assert.ok(secondFinished);
  assert.equal(secondSession.startedAt, 2_000);

  const lastSession = getLastCompletedSession();
  assert.ok(lastSession);
  assert.equal(lastSession.durationSeconds, 180);
  assert.equal(lastSession.energyKwh, 4.2);
});
