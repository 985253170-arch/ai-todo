import { DEVICE_ID_STORAGE_KEY } from "@/lib/constants";

function createFallbackDeviceId() {
  return `device_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export function getOrCreateDeviceId() {
  if (typeof window === "undefined") {
    return "";
  }

  const savedDeviceId = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);

  if (savedDeviceId) {
    return savedDeviceId;
  }

  const deviceId =
    typeof window.crypto?.randomUUID === "function"
      ? window.crypto.randomUUID()
      : createFallbackDeviceId();

  window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
  return deviceId;
}
