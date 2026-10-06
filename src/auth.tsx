import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { store, type Profile } from "./lib/store";

type Mode = "instructor" | "student";
type Ctx = { user: Profile | null; loading: boolean; refresh: () => Promise<void>; toast: (m: string) => void; mode: Mode; setMode: (m: Mode) => void };
const AuthCtx = createContext<Ctx>({ user: null, loading: true, refresh: async () => {}, toast: () => {}, mode: "student", setMode: () => {} });
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [mode, setModeState] = useState<Mode>(() => { try { return (localStorage.getItem("portal-mode") as Mode) || "instructor"; } catch { return "instructor"; } });
  const setMode = useCallback((m: Mode) => { setModeState(m); try { localStorage.setItem("portal-mode", m); } catch { /* ignore */ } }, []);
  const refresh = useCallback(async () => { setUser(await store.currentUser()); setLoading(false); }, []);
  useEffect(() => { refresh(); return store.onAuthChange(refresh); }, [refresh]);
  const toast = useCallback((m: string) => { setMsg(m); setTimeout(() => setMsg(null), 2200); }, []);
  return (
    <AuthCtx.Provider value={{ user, loading, refresh, toast, mode: user?.role === "instructor" ? mode : "student", setMode }}>
      {children}
      {msg && <div className="toast" role="status">{msg}</div>}
    </AuthCtx.Provider>
  );
}
