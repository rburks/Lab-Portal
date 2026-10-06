import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { store, type Profile } from "./lib/store";
import { applyContent } from "./content/course";
import type { SessionContent } from "./content/course";

type Mode = "instructor" | "student";
type Ctx = { user: Profile | null; loading: boolean; refresh: () => Promise<void>; toast: (m: string) => void; mode: Mode; setMode: (m: Mode) => void; reloadContent: () => Promise<void>; contentVersion: number };
const AuthCtx = createContext<Ctx>({ user: null, loading: true, refresh: async () => {}, toast: () => {}, mode: "student", setMode: () => {}, reloadContent: async () => {}, contentVersion: 0 });
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [mode, setModeState] = useState<Mode>(() => { try { return (localStorage.getItem("portal-mode") as Mode) || "instructor"; } catch { return "instructor"; } });
  const setMode = useCallback((m: Mode) => { setModeState(m); try { localStorage.setItem("portal-mode", m); } catch { /* ignore */ } }, []);
  const [contentVersion, setCV] = useState(0);
  const reloadContent = useCallback(async () => { const rows = await store.allContent(); const map: Record<string, SessionContent> = {}; rows.forEach(r => { map[r.session_id] = r.content; }); applyContent(map); setCV(v => v + 1); }, []);
  const refresh = useCallback(async () => { const u = await store.currentUser(); if (u) await reloadContent(); setUser(u); setLoading(false); }, [reloadContent]);
  useEffect(() => { refresh(); return store.onAuthChange(refresh); }, [refresh]);
  const toast = useCallback((m: string) => { setMsg(m); setTimeout(() => setMsg(null), 2200); }, []);
  return (
    <AuthCtx.Provider value={{ user, loading, refresh, toast, mode: user?.role === "instructor" ? mode : "student", setMode, reloadContent, contentVersion }}>
      {children}
      {msg && <div className="toast" role="status">{msg}</div>}
    </AuthCtx.Provider>
  );
}
