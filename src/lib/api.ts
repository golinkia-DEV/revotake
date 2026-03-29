import axios from "axios";
import { clearStoreId, getStoreId } from "./store";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001/api/v1";

const api = axios.create({ baseURL: API_URL });

function needsStoreHeader(url: string, method: string | undefined): boolean {
  const m = (method || "get").toLowerCase();
  const path = (url || "").split("?")[0].replace(/\/+$/, "") || "/";
  if (path.startsWith("/auth")) return false;
  if (path.startsWith("/store-types")) return false;
  if (path === "/stores" && (m === "get" || m === "post")) return false;
  return true;
}

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("revotake_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    if (needsStoreHeader(config.url || "", config.method) && getStoreId()) {
      (config.headers as Record<string, string>)["X-Store-Id"] = getStoreId()!;
    }
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("revotake_token");
      localStorage.removeItem("revotake_user");
      clearStoreId();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
