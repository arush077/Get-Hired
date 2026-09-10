import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getUser, setToken, setUser, clearAuth } from "../lib/auth";
import { API_BASE } from "../lib/api";

export function useAuth() {
  const [user, setUserState] = useState(getUser());
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const login = useCallback(async (email, password) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || "Login failed");
      }
      const data = await res.json();
      setToken(data.token);
      setUser(data.user);
      setUserState(data.user);
      navigate("/");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const register = useCallback(async (name, email, password) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || "Registration failed");
      }
      const data = await res.json();
      setToken(data.token);
      setUser(data.user);
      setUserState(data.user);
      navigate("/");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const logout = useCallback(() => {
    clearAuth();
    setUserState(null);
    navigate("/login");
  }, [navigate]);

  return { user, loading, login, register, logout, isAuthenticated: !!user };
}
