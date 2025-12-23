import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiGet } from "../services/api";

const AuthContext = createContext(null);

const LS_KEY = "mantranwebapi_auth";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // { id, nome, login, perfil, ativo }

  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch {
        localStorage.removeItem(LS_KEY);
      }
    }
  }, []);

  const login = async ({ login, senha }) => {
    // PostgREST: /rest/v1/usuario?login=eq.xxx&senha=eq.yyy&ativo=is.true&select=...
    const rows = await apiGet(
      `/rest/v1/usuario?select=id,nome,login,perfil,ativo,meta_semanal` +
        `&login=eq.${encodeURIComponent(login)}` +
        `&senha=eq.${encodeURIComponent(senha)}` +
        `&ativo=is.true` +
        `&limit=1`
    );

    if (!rows || rows.length === 0) {
      throw new Error("Login ou senha inválidos (ou usuário inativo).");
    }

    const u = rows[0];
    setUser(u);
    localStorage.setItem(LS_KEY, JSON.stringify(u));
    return u;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(LS_KEY);
  };

  const value = useMemo(() => ({ user, login, logout }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
