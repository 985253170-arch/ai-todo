export const RECOVERY_MARKER_KEY = "qingxing.auth.recovery.v1";
export const RECOVERY_TAB_ID_KEY = "qingxing.auth.tab-id.v1";
export const RECOVERY_MARKER_VERSION = 1;
export const RECOVERY_MARKER_TTL_MS = 15 * 60 * 1000;
export const RECOVERY_EVIDENCE_TIMEOUT_MS = 12 * 1000;
export const RECOVERY_VERIFY_REQUEST_TIMEOUT_MS = 30 * 1000;
export const RECOVERY_UPDATE_TIMEOUT_MS = 30 * 1000;
export const RECOVERY_SIGN_OUT_TIMEOUT_MS = 15 * 1000;
export const RECOVERY_CLOCK_ROLLBACK_THRESHOLD_MS = 60_000;

export type RecoveryMarkerPhase =
  | "verifying"
  | "password-required"
  | "updating"
  | "signing-out";

export interface RecoveryMarkerV1 {
  version: 1;
  flowId: string;
  ownerTabId: string;
  phase: RecoveryMarkerPhase;
  createdAt: number;
  expiresAt: number;
}

export type RecoveryMarkerParseFailureReason =
  | "not-object"
  | "schema-mismatch"
  | "invalid-version"
  | "invalid-id"
  | "invalid-phase"
  | "invalid-timestamp"
  | "invalid-ttl"
  | "expired"
  | "clock-rollback";

export type RecoveryMarkerParseResult =
  | { ok: true; marker: RecoveryMarkerV1; serialized: string }
  | { ok: false; reason: RecoveryMarkerParseFailureReason };

export type RecoveryStorageFailure = "storage-unavailable";
export type RecoveryMarkerReadResult =
  | { status: "absent" }
  | { status: "valid"; marker: RecoveryMarkerV1; serialized: string }
  | { status: "invalid"; reason: RecoveryMarkerParseFailureReason; raw: string }
  | { status: RecoveryStorageFailure; operation: "get" };

export type RecoveryMarkerRemoveResult =
  | { status: "removed" }
  | { status: "absent" }
  | { status: "conflict" }
  | { status: RecoveryStorageFailure; operation: "get" | "remove" };

export type RecoveryMarkerClaimResult =
  | { status: "owner"; marker: RecoveryMarkerV1; serialized: string; writeCount: number }
  | { status: "blocked"; reason: "existing-marker" | "foreign-winner" | "terminal-conflict" | "storage-unavailable" | "invalid-marker"; writeCount: number };

type RecoveryStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type RecoveryCrypto = Pick<Crypto, "randomUUID">;

const markerFields = ["version", "flowId", "ownerTabId", "phase", "createdAt", "expiresAt"] as const;
const phases = new Set<RecoveryMarkerPhase>(["verifying", "password-required", "updating", "signing-out"]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const defaultDefer = () => new Promise<void>((resolve) => queueMicrotask(resolve));

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

function hasExactMarkerFields(value: Record<string, unknown>) {
  const keys = Object.keys(value);
  return keys.length === markerFields.length && markerFields.every((field) => Object.prototype.hasOwnProperty.call(value, field));
}

export function serializeRecoveryMarker(marker: RecoveryMarkerV1): string {
  return JSON.stringify({
    version: RECOVERY_MARKER_VERSION,
    flowId: marker.flowId,
    ownerTabId: marker.ownerTabId,
    phase: marker.phase,
    createdAt: marker.createdAt,
    expiresAt: marker.expiresAt,
  });
}

export function createRecoveryMarker(input: {
  flowId: string;
  ownerTabId: string;
  phase?: RecoveryMarkerPhase;
  now: number;
}): RecoveryMarkerV1 {
  return {
    version: RECOVERY_MARKER_VERSION,
    flowId: input.flowId,
    ownerTabId: input.ownerTabId,
    phase: input.phase ?? "verifying",
    createdAt: input.now,
    expiresAt: input.now + RECOVERY_MARKER_TTL_MS,
  };
}

export function parseRecoveryMarker(raw: string | null, now: number): RecoveryMarkerParseResult {
  if (raw === null) return { ok: false, reason: "not-object" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "not-object" };
  }

  if (!isPlainObject(parsed)) return { ok: false, reason: "not-object" };
  if (!hasExactMarkerFields(parsed)) return { ok: false, reason: "schema-mismatch" };
  if (parsed.version !== RECOVERY_MARKER_VERSION) return { ok: false, reason: "invalid-version" };
  if (!isUuid(parsed.flowId) || !isUuid(parsed.ownerTabId)) return { ok: false, reason: "invalid-id" };
  if (typeof parsed.phase !== "string" || !phases.has(parsed.phase as RecoveryMarkerPhase)) return { ok: false, reason: "invalid-phase" };
  if (typeof parsed.createdAt !== "number" || typeof parsed.expiresAt !== "number") return { ok: false, reason: "invalid-timestamp" };
  if (!Number.isFinite(parsed.createdAt) || !Number.isFinite(parsed.expiresAt) || !Number.isFinite(now)) return { ok: false, reason: "invalid-timestamp" };
  if (parsed.expiresAt <= parsed.createdAt) return { ok: false, reason: "invalid-timestamp" };
  if (parsed.expiresAt !== parsed.createdAt + RECOVERY_MARKER_TTL_MS) return { ok: false, reason: "invalid-ttl" };
  if (now >= parsed.expiresAt) return { ok: false, reason: "expired" };
  if (now + RECOVERY_CLOCK_ROLLBACK_THRESHOLD_MS < parsed.createdAt) return { ok: false, reason: "clock-rollback" };

  const marker: RecoveryMarkerV1 = {
    version: RECOVERY_MARKER_VERSION,
    flowId: parsed.flowId,
    ownerTabId: parsed.ownerTabId,
    phase: parsed.phase as RecoveryMarkerPhase,
    createdAt: parsed.createdAt,
    expiresAt: parsed.expiresAt,
  };

  return { ok: true, marker, serialized: serializeRecoveryMarker(marker) };
}

export function readRecoveryMarker(storage: RecoveryStorage, now: number): RecoveryMarkerReadResult {
  let raw: string | null;
  try {
    raw = storage.getItem(RECOVERY_MARKER_KEY);
  } catch {
    return { status: "storage-unavailable", operation: "get" };
  }

  if (raw === null) return { status: "absent" };

  const parsed = parseRecoveryMarker(raw, now);
  return parsed.ok
    ? { status: "valid", marker: parsed.marker, serialized: raw }
    : { status: "invalid", reason: parsed.reason, raw };
}

export function getOrCreateRecoveryTabId(storage: RecoveryStorage, cryptoSource: RecoveryCrypto = crypto): { ok: true; tabId: string } | { ok: false; reason: RecoveryStorageFailure } {
  let existing: string | null;
  try {
    existing = storage.getItem(RECOVERY_TAB_ID_KEY);
  } catch {
    return { ok: false, reason: "storage-unavailable" };
  }

  if (isUuid(existing)) return { ok: true, tabId: existing };

  const tabId = cryptoSource.randomUUID();
  try {
    storage.setItem(RECOVERY_TAB_ID_KEY, tabId);
  } catch {
    return { ok: false, reason: "storage-unavailable" };
  }

  return { ok: true, tabId };
}

export function writeRecoveryMarker(storage: RecoveryStorage, marker: RecoveryMarkerV1): { ok: true; serialized: string } | { ok: false; reason: RecoveryStorageFailure } {
  const serialized = serializeRecoveryMarker(marker);
  try {
    storage.setItem(RECOVERY_MARKER_KEY, serialized);
  } catch {
    return { ok: false, reason: "storage-unavailable" };
  }
  return { ok: true, serialized };
}

export function removeRecoveryMarkerIfUnchanged(storage: RecoveryStorage, expectedSerialized: string): RecoveryMarkerRemoveResult {
  let current: string | null;
  try {
    current = storage.getItem(RECOVERY_MARKER_KEY);
  } catch {
    return { status: "storage-unavailable", operation: "get" };
  }

  if (current === null) return { status: "absent" };
  if (current !== expectedSerialized) return { status: "conflict" };

  try {
    storage.removeItem(RECOVERY_MARKER_KEY);
  } catch {
    return { status: "storage-unavailable", operation: "remove" };
  }

  return { status: "removed" };
}

export async function claimRecoveryMarker(storage: RecoveryStorage, marker: RecoveryMarkerV1, options: {
  now?: number;
  defer?: () => Promise<void>;
} = {}): Promise<RecoveryMarkerClaimResult> {
  const now = options.now ?? Date.now();
  const defer = options.defer ?? defaultDefer;
  const ownSerialized = serializeRecoveryMarker(marker);
  let writeCount = 0;

  const initial = readRecoveryMarker(storage, now);
  if (initial.status === "storage-unavailable") return { status: "blocked", reason: "storage-unavailable", writeCount };
  if (initial.status === "invalid") return { status: "blocked", reason: "invalid-marker", writeCount };
  if (initial.status === "valid") return { status: "blocked", reason: "existing-marker", writeCount };

  const initialWrite = writeRecoveryMarker(storage, marker);
  if (!initialWrite.ok) return { status: "blocked", reason: "storage-unavailable", writeCount };
  writeCount += 1;

  await defer();
  const firstRead = readRecoveryMarker(storage, now);
  if (firstRead.status === "storage-unavailable") return { status: "blocked", reason: "storage-unavailable", writeCount };
  if (firstRead.status === "invalid" || firstRead.status === "absent") return { status: "blocked", reason: "terminal-conflict", writeCount };
  if (firstRead.serialized === ownSerialized) return stableOwnerRead(storage, marker, ownSerialized, now, defer, writeCount);

  if (firstRead.marker.flowId > marker.flowId) {
    const guarded = guardedOverwrite(storage, firstRead.serialized, ownSerialized);
    if (guarded === "storage-unavailable") return { status: "blocked", reason: "storage-unavailable", writeCount };
    if (guarded === "conflict") return { status: "blocked", reason: "terminal-conflict", writeCount };
    writeCount += 1;

    await defer();
    const afterOverwrite = readRecoveryMarker(storage, now);
    if (afterOverwrite.status === "storage-unavailable") return { status: "blocked", reason: "storage-unavailable", writeCount };
    if (afterOverwrite.status !== "valid") return { status: "blocked", reason: "terminal-conflict", writeCount };
    if (afterOverwrite.serialized === ownSerialized) return stableOwnerRead(storage, marker, ownSerialized, now, defer, writeCount);
    if (afterOverwrite.marker.flowId < marker.flowId) return { status: "blocked", reason: "foreign-winner", writeCount };
    return { status: "blocked", reason: "terminal-conflict", writeCount };
  }

  return { status: "blocked", reason: "foreign-winner", writeCount };
}

async function stableOwnerRead(
  storage: RecoveryStorage,
  marker: RecoveryMarkerV1,
  ownSerialized: string,
  now: number,
  defer: () => Promise<void>,
  writeCount: number,
): Promise<RecoveryMarkerClaimResult> {
  await defer();
  const secondRead = readRecoveryMarker(storage, now);
  if (secondRead.status === "storage-unavailable") return { status: "blocked", reason: "storage-unavailable", writeCount };
  if (secondRead.status === "valid" && secondRead.serialized === ownSerialized) return { status: "owner", marker, serialized: ownSerialized, writeCount };
  return { status: "blocked", reason: "terminal-conflict", writeCount };
}

function guardedOverwrite(storage: RecoveryStorage, expectedSerialized: string, ownSerialized: string): "written" | "conflict" | RecoveryStorageFailure {
  let current: string | null;
  try {
    current = storage.getItem(RECOVERY_MARKER_KEY);
  } catch {
    return "storage-unavailable";
  }

  if (current !== expectedSerialized) return "conflict";

  try {
    storage.setItem(RECOVERY_MARKER_KEY, ownSerialized);
  } catch {
    return "storage-unavailable";
  }

  return "written";
}
