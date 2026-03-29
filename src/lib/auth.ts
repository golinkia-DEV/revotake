import api from "./api";
import { clearStoreId } from "./store";

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export async function login(email: string, password: string): Promise<User> {
  const form = new FormData();
  form.append("username", email);
  form.append("password", password);
  const res = await api.post("/auth/login", form, { headers: { "Content-Type": "multipart/form-data" } });
  localStorage.setItem("revotake_token", res.data.access_token);
  localStorage.setItem("revotake_user", JSON.stringify(res.data.user));
  return res.data.user;
}

export function logout() {
  localStorage.removeItem("revotake_token");
  localStorage.removeItem("revotake_user");
  clearStoreId();
}

export function getUser(): User | null {
  if (typeof window === "undefined") return null;
  const u = localStorage.getItem("revotake_user");
  return u ? JSON.parse(u) : null;
}

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem("revotake_token");
}
