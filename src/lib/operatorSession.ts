export type CashOperatorSession = {
  operatorId: string;
  operatorName: string;
  username: string;
};

const STORAGE_KEY = "horti_cash_operator_session";

export function saveOperatorSession(session: CashOperatorSession) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function getOperatorSession(): CashOperatorSession | null {
  if (typeof window === "undefined") return null;

  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as CashOperatorSession;
  } catch {
    return null;
  }
}

export function clearOperatorSession() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}