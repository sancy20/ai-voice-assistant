import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { API_URL as API } from "../config/api";

const AuthContext = createContext(null);

function parseJwt(token) {
  try { return JSON.parse(atob(token.split(".")[1])); }
  catch { return null; }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("auth_token"));
  const [loading, setLoading] = useState(true);
  const [sessionWarning, setSessionWarning] = useState(false); // < 30 min left
  const refreshTimerRef = useRef(null);

  const logout = useCallback(() => {
    localStorage.removeItem("auth_token");
    setToken(null);
    setUser(null);
    setSessionWarning(false);
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
  }, []);

  const applyToken = useCallback((newToken) => {
    localStorage.setItem("auth_token", newToken);
    setToken(newToken);

    const payload = parseJwt(newToken);
    if (!payload) return;

    const expiresInMs = payload.exp * 1000 - Date.now();
    const warnAt = expiresInMs - 30 * 60 * 1000; // warn 30 min before expiry
    const refreshAt = expiresInMs - 60 * 60 * 1000; // auto-refresh 1 h before expiry

    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    if (refreshAt > 0) {
      refreshTimerRef.current = setTimeout(async () => {
        try {
          const res = await fetch(`${API}/auth/refresh`, {
            method: "POST",
            headers: { Authorization: `Bearer ${newToken}` },
          });
          if (res.ok) {
            const { access_token } = await res.json();
            applyToken(access_token);
          } else {
            logout();
          }
        } catch {
          logout();
        }
      }, refreshAt);
    }
    if (warnAt > 0) {
      setTimeout(() => setSessionWarning(true), warnAt);
    } else {
      setSessionWarning(true);
    }
  }, [logout]);

  useEffect(() => {
    if (!token) { setLoading(false); return; }

    const payload = parseJwt(token);
    if (!payload || payload.exp * 1000 < Date.now()) { logout(); setLoading(false); return; }

    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(u => { setUser(u); applyToken(token); })
      .catch(logout)
      .finally(() => setLoading(false));
  }, []); 

  const login = async (email, password) => {
    const res = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.detail || "Login failed"); }
    const { access_token } = await res.json();
    applyToken(access_token);
    const me = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${access_token}` } }).then(r => r.json());
    setUser(me);
  };

  const register = async (email, username, password) => {
    const res = await fetch(`${API}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, username, password }),
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.detail || "Registration failed"); }
    await login(email, password);
  };

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const u = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
      setUser(u);
    } catch {}
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, register, sessionWarning, refreshUser }}>
      {sessionWarning && user && (
        <div className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between gap-3 bg-amber-500/90 backdrop-blur px-5 py-2.5 text-xs font-medium text-black">
          <span>Your session expires soon. Save your work.</span>
          <button
            onClick={async () => {
              try {
                const res = await fetch(`${API}/auth/refresh`, {
                  method: "POST", headers: { Authorization: `Bearer ${token}` },
                });
                if (res.ok) { const { access_token } = await res.json(); applyToken(access_token); setSessionWarning(false); }
              } catch { /* ignore */ }
            }}
            className="rounded-lg bg-black/15 hover:bg-black/25 px-3 py-1 transition font-semibold"
          >
            Extend session
          </button>
        </div>
      )}
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
