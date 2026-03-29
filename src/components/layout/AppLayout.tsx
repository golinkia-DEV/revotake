"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { getStoreId } from "@/lib/store";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

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
    <div className="min-h-screen bg-surface">
      <Sidebar />
      <div className="ml-64 flex min-h-screen flex-col">
        <TopBar />
        <main className="flex-1 overflow-auto p-8">{children}</main>
      </div>
    </div>
  );
}
