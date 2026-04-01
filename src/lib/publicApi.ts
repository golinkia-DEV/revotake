import axios from "axios";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://revotake.golinkia.com/api/v1";

const publicApi = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

const PUBLIC_TOKEN_KEY = "public_revotake_token";

publicApi.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem(PUBLIC_TOKEN_KEY);
    if (token) {
      config.headers = config.headers || {};
      config.headers["Authorization"] = `Bearer ${token}`;
    }
  }
  return config;
});

export function getPublicToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(PUBLIC_TOKEN_KEY);
}

export function setPublicToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(PUBLIC_TOKEN_KEY, token);
  }
}

export function removePublicToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(PUBLIC_TOKEN_KEY);
  }
}

export default publicApi;
