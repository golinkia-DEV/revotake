"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, BookOpen, Heart, Bell, LogOut, Save } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { usePublicAuth } from "@/contexts/PublicAuthContext";
import publicApi from "@/lib/publicApi";

export default function MiPerfilPage() {
  const { user, logout, isLoading } = usePublicAuth();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "" });
  const [saving, setSaving] = useState(false);

  if (isLoading) {
    return <div className="p-8 text-center text-sm text-gray-400">Cargando...</div>;
  }

  if (!user) {
    router.push("/auth/ingresar");
    return null;
  }

  const startEdit = () => {
    setForm({ name: user.name, phone: user.phone ?? "" });
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await publicApi.put("/public/user/me", {
        name: form.name || undefined,
        phone: form.phone || undefined,
      });
      toast.success("Perfil actualizado");
      setEditing(false);
      // Reload page to refresh user
      window.location.reload();
    } catch {
      toast.error("Error al actualizar perfil");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push("/explorar");
  };

  const links = [
    { href: "/mi-historial", label: "Mi historial de reservas", icon: BookOpen },
    { href: "/siguiendo", label: "Tiendas que sigo", icon: Heart },
    { href: "/notificaciones", label: "Notificaciones y ofertas", icon: Bell },
  ];

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Mi Perfil</h1>

      {/* User card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt={user.name} className="w-full h-full rounded-2xl object-cover" />
            ) : (
              <User className="w-6 h-6 text-violet-500" />
            )}
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">{user.name}</h2>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
        </div>

        {editing ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+56 9 1234 5678"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                {saving ? "Guardando..." : "Guardar"}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {user.phone && (
              <p className="text-sm text-gray-600">📞 {user.phone}</p>
            )}
            <p className="text-xs text-gray-400">
              Cuenta desde {new Date(user.created_at).toLocaleDateString("es-CL", { year: "numeric", month: "long" })}
            </p>
            <button
              onClick={startEdit}
              className="text-sm text-violet-600 font-medium hover:underline"
            >
              Editar perfil
            </button>
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors"
          >
            <Icon className="w-4 h-4 text-violet-500" />
            <span className="text-sm font-medium text-gray-700">{label}</span>
          </Link>
        ))}
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-red-500 border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
      >
        <LogOut className="w-4 h-4" />
        Cerrar sesión
      </button>
    </div>
  );
}
