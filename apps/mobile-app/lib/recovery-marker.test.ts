import assert from "node:assert/strict";
import test from "node:test";
import {
  RECOVERY_CLOCK_ROLLBACK_THRESHOLD_MS,
  RECOVERY_MARKER_KEY,
  RECOVERY_MARKER_TTL_MS,
  RECOVERY_MARKER_VERSION,
  RECOVERY_TAB_ID_KEY,
  claimRecoveryMarker,
  createRecoveryMarker,
  getOrCreateRecoveryTabId,
  parseRecoveryMarker,
  readRecoveryMarker,
  removeRecoveryMarkerIfUnchanged,
  serializeRecoveryMarker,
  writeRecoveryMarker,
  type RecoveryMarkerParseFailureReason,
  type RecoveryMarkerV1,
} from "./recovery-marker.ts";

const now = 1_700_000_000_000;
const flowA = "00000000-0000-4000-8000-000000000001";
const flowB = "00000000-0000-4000-8000-000000000002";
const flowC = "00000000-0000-4000-8000-000000000003";
const tabA = "10000000-0000-4000-8000-000000000001";
const tabB = "10000000-0000-4000-8000-000000000002";

class MemoryStorage implements Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  values = new Map<string, string>();
  reads = 0;
  writes = 0;
  removes = 0;
  operationLog: string[] = [];
  throwOnGetCalls = new Set<number>();
  throwOnSetCalls = new Set<number>();
  throwOnRemoveCalls = new Set<number>();
  onGet: ((key: string, readNumber: number) => void) | null = null;
  onSet: ((key: string, value: string, writeNumber: number) => void) | null = null;
  onRemove: ((key: string, removeNumber: number) => void) | null = null;

  getItem(key: string) {
    this.reads += 1;
    this.operationLog.push(`get:${key}:${this.reads}`);
    if (this.throwOnGetCalls.has(this.reads)) throw new Error("get failed");
    this.onGet?.(key, this.reads);
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.writes += 1;
    this.operationLog.push(`set:${key}:${this.writes}`);
    if (this.throwOnSetCalls.has(this.writes)) throw new Error("set failed");
    this.values.set(key, value);
    this.onSet?.(key, value, this.writes);
  }

  removeItem(key: string) {
    this.removes += 1;
    this.operationLog.push(`remove:${key}:${this.removes}`);
    if (this.throwOnRemoveCalls.has(this.removes)) throw new Error("remove failed");
    this.onRemove?.(key, this.removes);
    this.values.delete(key);
  }
}

function marker(flowId = flowA, ownerTabId = tabA, createdAt = now): RecoveryMarkerV1 {
  return createRecoveryMarker({ flowId, ownerTabId, now: createdAt });
}

function rawMarker(overrides: Partial<Record<keyof RecoveryMarkerV1 | "extra", unknown>>) {
  return JSON.stringify({
    version: RECOVERY_MARKER_VERSION,
    flowId: flowA,
    ownerTabId: tabA,
    phase: "verifying",
    createdAt: now,
    expiresAt: now + RECOVERY_MARKER_TTL_MS,
    ...overrides,
  });
}

function expectParseFailure(raw: string | null, at: number, reason: RecoveryMarkerParseFailureReason) {
  const parsed = parseRecoveryMarker(raw, at);
  assert.equal(parsed.ok, false);
  assert.equal(!parsed.ok && parsed.reason, reason);
}

function makeDeferCounter() {
  let count = 0;
  return {
    defer: async () => {
      count += 1;
    },
    get count() {
      return count;
    },
  };
}

function replaceAfterInitialWrite(storage: MemoryStorage, own: RecoveryMarkerV1, replacement: RecoveryMarkerV1) {
  storage.onSet = (key, value, writeNumber) => {
    if (key === RECOVERY_MARKER_KEY && writeNumber === 1 && value === serializeRecoveryMarker(own)) {
      storage.values.set(RECOVERY_MARKER_KEY, serializeRecoveryMarker(replacement));
    }
  };
}

function replaceAfterGuardedOverwrite(storage: MemoryStorage, own: RecoveryMarkerV1, replacement: string | null) {
  const previous = storage.onSet;
  storage.onSet = (key, value, writeNumber) => {
    previous?.(key, value, writeNumber);
    if (key === RECOVERY_MARKER_KEY && writeNumber === 2 && value === serializeRecoveryMarker(own)) {
      if (replacement === null) storage.values.delete(RECOVERY_MARKER_KEY);
      else storage.values.set(RECOVERY_MARKER_KEY, replacement);
    }
  };
}

test("schema accepts a valid six-field marker", () => {
  const parsed = parseRecoveryMarker(serializeRecoveryMarker(marker()), now);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.ok && Object.keys(parsed.marker), ["version", "flowId", "ownerTabId", "phase", "createdAt", "expiresAt"]);
});

test("parser rejects malformed and non-object values with exact reasons", () => {
  expectParseFailure("{", now, "not-object");
  expectParseFailure("\"text\"", now, "not-object");
  expectParseFailure("[]", now, "not-object");
  expectParseFailure("null", now, "not-object");
  expectParseFailure(null, now, "not-object");
});

test("parser rejects schema shape problems with exact reasons", () => {
  for (const field of ["version", "flowId", "ownerTabId", "phase", "createdAt", "expiresAt"] as const) {
    const value = JSON.parse(serializeRecoveryMarker(marker()));
    delete value[field];
    expectParseFailure(JSON.stringify(value), now, "schema-mismatch");
  }
  expectParseFailure(rawMarker({ extra: "forbidden" }), now, "schema-mismatch");
});

test("parser rejects identity and phase problems with exact reasons", () => {
  expectParseFailure(rawMarker({ version: 2 }), now, "invalid-version");
  expectParseFailure(rawMarker({ flowId: 1 }), now, "invalid-id");
  expectParseFailure(rawMarker({ ownerTabId: 1 }), now, "invalid-id");
  expectParseFailure(rawMarker({ flowId: "not-a-uuid" }), now, "invalid-id");
  expectParseFailure(rawMarker({ ownerTabId: "not-a-uuid" }), now, "invalid-id");
  expectParseFailure(rawMarker({ phase: "complete" }), now, "invalid-phase");
});

test("parser rejects unsafe time values with exact reasons", () => {
  expectParseFailure(rawMarker({ createdAt: "1" }), now, "invalid-timestamp");
  expectParseFailure(rawMarker({ createdAt: Number.NaN }), now, "invalid-timestamp");
  expectParseFailure(rawMarker({ createdAt: Number.POSITIVE_INFINITY }), now, "invalid-timestamp");
  expectParseFailure(serializeRecoveryMarker(marker()), Number.NaN, "invalid-timestamp");
  expectParseFailure(serializeRecoveryMarker(marker()), Number.POSITIVE_INFINITY, "invalid-timestamp");
  expectParseFailure(rawMarker({ expiresAt: now }), now, "invalid-timestamp");
  expectParseFailure(rawMarker({ expiresAt: now - 1 }), now, "invalid-timestamp");
  expectParseFailure(rawMarker({ expiresAt: now + RECOVERY_MARKER_TTL_MS + 1 }), now, "invalid-ttl");
  expectParseFailure(serializeRecoveryMarker(marker()), now + RECOVERY_MARKER_TTL_MS, "expired");
  expectParseFailure(serializeRecoveryMarker(marker(flowA, tabA, now + RECOVERY_CLOCK_ROLLBACK_THRESHOLD_MS + 1)), now, "clock-rollback");

  const boundary = parseRecoveryMarker(serializeRecoveryMarker(marker(flowA, tabA, now + RECOVERY_CLOCK_ROLLBACK_THRESHOLD_MS)), now);
  assert.equal(boundary.ok, true);
});

test("storage failures fail closed and tab ID is stable in sessionStorage", () => {
  const storage = new MemoryStorage();
  assert.equal(readRecoveryMarker(storage, now).status, "absent");

  storage.throwOnGetCalls.add(2);
  assert.equal(readRecoveryMarker(storage, now).status, "storage-unavailable");
  storage.throwOnGetCalls.add(3);
  assert.equal(getOrCreateRecoveryTabId(storage).ok, false);

  const setFailing = new MemoryStorage();
  setFailing.throwOnSetCalls.add(1);
  setFailing.throwOnSetCalls.add(2);
  assert.equal(writeRecoveryMarker(setFailing, marker()).ok, false);
  assert.equal(getOrCreateRecoveryTabId(setFailing).ok, false);

  const stable = new MemoryStorage();
  const cryptoSource = { randomUUID: () => tabA };
  assert.deepEqual(getOrCreateRecoveryTabId(stable, cryptoSource), { ok: true, tabId: tabA });
  assert.deepEqual(getOrCreateRecoveryTabId(stable, { randomUUID: () => tabB }), { ok: true, tabId: tabA });
  assert.equal(stable.getItem(RECOVERY_TAB_ID_KEY), tabA);
});

test("read-before-remove handles absent, get failure, unchanged, changed, and remove failure", () => {
  const absent = new MemoryStorage();
  assert.deepEqual(removeRecoveryMarkerIfUnchanged(absent, serializeRecoveryMarker(marker())), { status: "absent" });
  assert.equal(absent.removes, 0);

  const getFailing = new MemoryStorage();
  getFailing.throwOnGetCalls.add(1);
  assert.deepEqual(removeRecoveryMarkerIfUnchanged(getFailing, serializeRecoveryMarker(marker())), { status: "storage-unavailable", operation: "get" });
  assert.equal(getFailing.removes, 0);

  const storage = new MemoryStorage();
  const own = serializeRecoveryMarker(marker());
  storage.setItem(RECOVERY_MARKER_KEY, own);
  assert.deepEqual(removeRecoveryMarkerIfUnchanged(storage, own), { status: "removed" });
  assert.equal(storage.removes, 1);

  const expected = serializeRecoveryMarker(marker(flowA));
  storage.setItem(RECOVERY_MARKER_KEY, serializeRecoveryMarker(marker(flowB, tabB)));
  assert.deepEqual(removeRecoveryMarkerIfUnchanged(storage, expected), { status: "conflict" });
  assert.equal(storage.removes, 1);

  storage.throwOnRemoveCalls.add(2);
  const current = serializeRecoveryMarker(marker(flowC, tabB));
  storage.setItem(RECOVERY_MARKER_KEY, current);
  assert.deepEqual(removeRecoveryMarkerIfUnchanged(storage, current), { status: "storage-unavailable", operation: "remove" });
});

test("claim exception: first exact re-read get failure blocks without further writes", async () => {
  const storage = new MemoryStorage();
  storage.throwOnGetCalls.add(2);
  const result = await claimRecoveryMarker(storage, marker(), { now });
  assert.deepEqual(result, { status: "blocked", reason: "storage-unavailable", writeCount: 1 });
  assert.equal(storage.writes, 1);
});

test("claim exception: second stable re-read get failure blocks without further writes", async () => {
  const storage = new MemoryStorage();
  storage.throwOnGetCalls.add(3);
  const result = await claimRecoveryMarker(storage, marker(), { now });
  assert.deepEqual(result, { status: "blocked", reason: "storage-unavailable", writeCount: 1 });
  assert.equal(storage.writes, 1);
});

test("claim exception: guarded overwrite pre-read get failure blocks without further writes", async () => {
  const storage = new MemoryStorage();
  const own = marker(flowA, tabA);
  replaceAfterInitialWrite(storage, own, marker(flowB, tabB));
  storage.throwOnGetCalls.add(3);
  const result = await claimRecoveryMarker(storage, own, { now });
  assert.deepEqual(result, { status: "blocked", reason: "storage-unavailable", writeCount: 1 });
  assert.equal(storage.writes, 1);
});

test("claim exception: guarded overwrite set failure blocks without third write", async () => {
  const storage = new MemoryStorage();
  const own = marker(flowA, tabA);
  replaceAfterInitialWrite(storage, own, marker(flowB, tabB));
  storage.throwOnSetCalls.add(2);
  const result = await claimRecoveryMarker(storage, own, { now });
  assert.deepEqual(result, { status: "blocked", reason: "storage-unavailable", writeCount: 1 });
  assert.equal(storage.writes, 2);
});

test("claim exception: after-overwrite first stability read get failure blocks without third write", async () => {
  const storage = new MemoryStorage();
  const own = marker(flowA, tabA);
  replaceAfterInitialWrite(storage, own, marker(flowB, tabB));
  storage.throwOnGetCalls.add(4);
  const result = await claimRecoveryMarker(storage, own, { now });
  assert.deepEqual(result, { status: "blocked", reason: "storage-unavailable", writeCount: 2 });
  assert.equal(storage.writes, 2);
});

test("claim exception: after-overwrite second stability read get failure blocks without third write", async () => {
  const storage = new MemoryStorage();
  const own = marker(flowA, tabA);
  replaceAfterInitialWrite(storage, own, marker(flowB, tabB));
  storage.throwOnGetCalls.add(5);
  const result = await claimRecoveryMarker(storage, own, { now });
  assert.deepEqual(result, { status: "blocked", reason: "storage-unavailable", writeCount: 2 });
  assert.equal(storage.writes, 2);
});

test("bounded non-CAS no competition locks initial write, defer, and re-read order", async () => {
  const storage = new MemoryStorage();
  const defers = makeDeferCounter();
  const result = await claimRecoveryMarker(storage, marker(), { now, defer: defers.defer });
  assert.equal(result.status, "owner");
  assert.equal(result.writeCount, 1);
  assert.equal(storage.writes, 1);
  assert.equal(defers.count, 2);
  assert.equal(storage.reads, 3);
  assert.deepEqual(storage.operationLog, [
    `get:${RECOVERY_MARKER_KEY}:1`,
    `set:${RECOVERY_MARKER_KEY}:1`,
    `get:${RECOVERY_MARKER_KEY}:2`,
    `get:${RECOVERY_MARKER_KEY}:3`,
  ]);
});

test("bounded non-CAS guarded overwrite performs exactly two writes", async () => {
  const storage = new MemoryStorage();
  const own = marker(flowA, tabA);
  replaceAfterInitialWrite(storage, own, marker(flowB, tabB));
  const result = await claimRecoveryMarker(storage, own, { now });
  assert.equal(result.status, "owner");
  assert.equal(result.writeCount, 2);
  assert.equal(storage.writes, 2);
  assert.ok(storage.operationLog.includes(`set:${RECOVERY_MARKER_KEY}:2`));
});

test("bounded non-CAS overwrite followed by lower foreign flow becomes foreign-winner", async () => {
  const storage = new MemoryStorage();
  const own = marker(flowB, tabA);
  replaceAfterInitialWrite(storage, own, marker(flowC, tabB));
  replaceAfterGuardedOverwrite(storage, own, serializeRecoveryMarker(marker(flowA, tabB)));
  const result = await claimRecoveryMarker(storage, own, { now });
  assert.deepEqual(result, { status: "blocked", reason: "foreign-winner", writeCount: 2 });
  assert.equal(storage.writes, 2);
  storage.values.set(RECOVERY_MARKER_KEY, serializeRecoveryMarker(marker(flowC, tabB)));
  await Promise.resolve();
  assert.equal(storage.writes, 2);
});

test("bounded non-CAS overwrite followed by absent marker becomes terminal conflict", async () => {
  const storage = new MemoryStorage();
  const own = marker(flowA, tabA);
  replaceAfterInitialWrite(storage, own, marker(flowB, tabB));
  replaceAfterGuardedOverwrite(storage, own, null);
  const result = await claimRecoveryMarker(storage, own, { now });
  assert.deepEqual(result, { status: "blocked", reason: "terminal-conflict", writeCount: 2 });
  assert.equal(storage.writes, 2);
  storage.values.set(RECOVERY_MARKER_KEY, serializeRecoveryMarker(marker(flowC, tabB)));
  await Promise.resolve();
  assert.equal(storage.writes, 2);
});

test("bounded non-CAS overwrite followed by invalid marker becomes terminal conflict", async () => {
  const storage = new MemoryStorage();
  const own = marker(flowA, tabA);
  replaceAfterInitialWrite(storage, own, marker(flowB, tabB));
  replaceAfterGuardedOverwrite(storage, own, "{");
  const result = await claimRecoveryMarker(storage, own, { now });
  assert.deepEqual(result, { status: "blocked", reason: "terminal-conflict", writeCount: 2 });
  assert.equal(storage.writes, 2);
  storage.values.set(RECOVERY_MARKER_KEY, serializeRecoveryMarker(marker(flowC, tabB)));
  await Promise.resolve();
  assert.equal(storage.writes, 2);
});

test("bounded non-CAS overwrite followed by higher foreign flow becomes terminal conflict", async () => {
  const storage = new MemoryStorage();
  const own = marker(flowA, tabA);
  replaceAfterInitialWrite(storage, own, marker(flowB, tabB));
  replaceAfterGuardedOverwrite(storage, own, serializeRecoveryMarker(marker(flowC, tabB)));
  const result = await claimRecoveryMarker(storage, own, { now });
  assert.deepEqual(result, { status: "blocked", reason: "terminal-conflict", writeCount: 2 });
  assert.equal(storage.writes, 2);
  storage.values.set(RECOVERY_MARKER_KEY, serializeRecoveryMarker(marker(flowB, tabB)));
  await Promise.resolve();
  assert.equal(storage.writes, 2);
});

test("bounded non-CAS blocks existing, invalid, lower foreign, and initial write storage failures", async () => {
  const existing = new MemoryStorage();
  existing.setItem(RECOVERY_MARKER_KEY, serializeRecoveryMarker(marker(flowA, tabA)));
  assert.equal((await claimRecoveryMarker(existing, marker(flowB, tabB), { now })).status, "blocked");

  const invalid = new MemoryStorage();
  invalid.setItem(RECOVERY_MARKER_KEY, "{");
  const invalidResult = await claimRecoveryMarker(invalid, marker(flowB, tabB), { now });
  assert.deepEqual(invalidResult, { status: "blocked", reason: "invalid-marker", writeCount: 0 });

  const lowerForeign = new MemoryStorage();
  replaceAfterInitialWrite(lowerForeign, marker(flowB, tabB), marker(flowA, tabA));
  const lowerResult = await claimRecoveryMarker(lowerForeign, marker(flowB, tabB), { now });
  assert.deepEqual(lowerResult, { status: "blocked", reason: "foreign-winner", writeCount: 1 });
  assert.equal(lowerForeign.writes, 1);

  const failing = new MemoryStorage();
  failing.throwOnSetCalls.add(1);
  assert.deepEqual(await claimRecoveryMarker(failing, marker(), { now }), { status: "blocked", reason: "storage-unavailable", writeCount: 0 });
});
