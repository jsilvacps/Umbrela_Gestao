const STORAGE_KEY = "horti_admin_session";

export function saveAdminSession() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, "true");
}

export function hasAdminSession() {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(STORAGE_KEY) === "true";
}

export function clearAdminSession() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}