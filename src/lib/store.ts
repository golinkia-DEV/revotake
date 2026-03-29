export const STORE_ID_KEY = "revotake_store_id";

export function getStoreId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORE_ID_KEY);
}

export function setStoreId(id: string) {
  localStorage.setItem(STORE_ID_KEY, id);
}

export function clearStoreId() {
  localStorage.removeItem(STORE_ID_KEY);
}
