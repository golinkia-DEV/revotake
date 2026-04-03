"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { useState, useEffect } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8002/api/v1";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30000, retry: 1 } }
  }));
  const [googleClientId, setGoogleClientId] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/auth/config`)
      .then((r) => r.json())
      .then((d) => { if (d.google_client_id) setGoogleClientId(d.google_client_id); })
      .catch(() => {});
  }, []);

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </GoogleOAuthProvider>
  );
}
