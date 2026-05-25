import { useState, useRef, useEffect } from "react";
import { useFetcher } from "react-router";
import { clearPermissionCache } from "~/shared/stores/permissionStore";

interface LogoutButtonProps {
  children?: React.ReactNode;
}

export default function LogoutButton({ children }: LogoutButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const confirmRef = useRef<HTMLDivElement>(null);

  /**
   * El logout es server-side: la `action` de la ruta `/logout` emite los
   * Set-Cookie que invalidan la sesión (httpOnly + legacy) y redirige a
   * `/login`. Aquí solo limpiamos la cache de permisos en sessionStorage.
   */
  const fetcher = useFetcher();
  const submitting = fetcher.state !== "idle";

  const handleLogout = () => {
    clearPermissionCache();
    fetcher.submit(null, { method: "post", action: "/logout" });
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (confirmRef.current && !confirmRef.current.contains(event.target as Node)) {
        setShowConfirm(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block" ref={confirmRef}>
      <button
        onClick={() => setShowConfirm(!showConfirm)}
        className="bg-primary-300 rounded-lg p-2.5 h-10 w-10 flex justify-center items-center cursor-pointer transition-colors duration-200 hover:bg-primary-50"
      >
        {children}
      </button>

      {showConfirm && (
        <div className="absolute top-full right-0 mt-2 w-56 bg-white shadow-xl rounded-lg p-4 z-100 border border-gray-200">
          <p className="text-gray-800 mb-4 text-sm">¿Estás seguro de que deseas cerrar sesión?</p>
          <div className="flex gap-2">
            <button
              onClick={handleLogout}
              disabled={submitting}
              className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition-colors font-semibold disabled:opacity-60"
            >
              {submitting ? "Cerrando…" : "Cerrar Sesión"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
