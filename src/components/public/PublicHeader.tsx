"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Bell, BookOpen, Heart, LogOut, Menu, Scissors, User, X } from "lucide-react";
import { usePublicAuth } from "@/contexts/PublicAuthContext";

const navItems = [
  { href: "/explorar", label: "Explorar", icon: Scissors },
  { href: "/siguiendo", label: "Siguiendo", icon: Heart },
  { href: "/mi-historial", label: "Mi Historial", icon: BookOpen },
  { href: "/notificaciones", label: "Notificaciones", icon: Bell },
];

export default function PublicHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = usePublicAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push("/explorar");
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/explorar" className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
            <Scissors className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-gray-900 text-lg leading-none">
            Revo<span className="text-violet-600">Take</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                pathname.startsWith(href)
                  ? "bg-violet-50 text-violet-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2 shrink-0">
          {user ? (
            <>
              <Link
                href="/mi-perfil"
                className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-violet-600" />
                </div>
                {user.name.split(" ")[0]}
              </Link>
              <button
                onClick={handleLogout}
                className="hidden md:flex items-center gap-1 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <div className="hidden md:flex items-center gap-2">
              <Link
                href="/auth/ingresar"
                className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Ingresar
              </Link>
              <Link
                href="/auth/registro"
                className="px-3 py-1.5 text-sm font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
              >
                Registrarse
              </Link>
            </div>
          )}

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 py-3 flex flex-col gap-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                pathname.startsWith(href)
                  ? "bg-violet-50 text-violet-700"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
          <div className="border-t border-gray-100 mt-2 pt-2">
            {user ? (
              <>
                <Link
                  href="/mi-perfil"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <User className="w-4 h-4" />
                  Mi Perfil
                </Link>
                <button
                  onClick={() => { handleLogout(); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  <LogOut className="w-4 h-4" />
                  Cerrar sesión
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/auth/ingresar"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Ingresar
                </Link>
                <Link
                  href="/auth/registro"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold text-violet-600 hover:bg-violet-50"
                >
                  Registrarse
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
