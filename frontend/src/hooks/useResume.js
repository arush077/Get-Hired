import { useState, useEffect, useCallback } from "react";
import { API_BASE, getAuthHeaders } from "../lib/api";

export function useResume() {
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchResumes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/resumes`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setResumes(data.resumes || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const getResume = useCallback(async (id) => {
    const res = await fetch(`${API_BASE}/resumes/${id}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return null;
    return res.json();
  }, []);

  const createResume = useCallback(async (data) => {
    const res = await fetch(`${API_BASE}/resumes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) return null;
    return res.json();
  }, []);

  const updateResume = useCallback(async (id, data) => {
    const res = await fetch(`${API_BASE}/resumes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) return null;
    return res.json();
  }, []);

  const deleteResume = useCallback(async (id) => {
    const res = await fetch(`${API_BASE}/resumes/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      setResumes((prev) => prev.filter((r) => r.id !== id));
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    fetchResumes();
  }, [fetchResumes]);

  return { resumes, loading, fetchResumes, getResume, createResume, updateResume, deleteResume };
}
