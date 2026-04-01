"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import publicApi, { getPublicToken, setPublicToken, removePublicToken } from "@/lib/publicApi";

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
}

interface PublicAuthState {
  user: PublicUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, phone: string, password: string) => Promise<void>;
  logout: () => void;
}

const PublicAuthContext = createContext<PublicAuthState>({
  user: null,
  isLoading: true,
  login: async () => {},
  register: async () => {},
  logout: () => {},
});

export function PublicAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = getPublicToken();
    if (!token) {
      setIsLoading(false);
      return;
    }
    publicApi
      .get("/public/user/me")
      .then((res) => setUser(res.data))
      .catch(() => removePublicToken())
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await publicApi.post("/public/user/login", { email, password });
    setPublicToken(res.data.access_token);
    setUser(res.data.user);
  };

  const register = async (name: string, email: string, phone: string, password: string) => {
    const res = await publicApi.post("/public/user/register", { name, email, phone, password });
    setPublicToken(res.data.access_token);
    setUser(res.data.user);
  };

  const logout = () => {
    removePublicToken();
    setUser(null);
  };

  return (
    <PublicAuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </PublicAuthContext.Provider>
  );
}

export function usePublicAuth() {
  return useContext(PublicAuthContext);
}
