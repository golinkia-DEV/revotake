"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { getStoreId } from "@/lib/store";
import Sidebar from "./Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (!isAuthenticated()) router.push("/login");
  }, [router]);
  useEffect(() => {
    if (!isAuthenticated()) return;
    if (pathname === "/login" || pathname?.startsWith("/stores")) return;
    if (!getStoreId()) router.replace("/stores");
  }, [pathname, router]);
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
