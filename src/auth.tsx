import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { store, type Profile } from "./lib/store";

type Ctx = { user: Profile | null; loading: boolean; refresh: () => Promise<void>; toast: (m: string) => void };
const AuthCtx = createContext<Ctx>({ user: null, loading: true, refresh: async () => {}, toast: () => {} });
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const refresh = useCallback(async () => { setUser(await store.currentUser()); setLoading(false); }, []);
  useEffect(() => { refresh(); return store.onAuthChange(refresh); }, [refresh]);
  const toast = useCallback((m: string) => { setMsg(m); setTimeout(() => setMsg(null), 2200); }, []);
  return (
    <AuthCtx.Provider value={{ user, loading, refresh, toast }}>
      {children}
      {msg && <div className="toast" role="status">{msg}</div>}
    </AuthCtx.Provider>
  );
}
