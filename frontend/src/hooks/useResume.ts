import { useState, useEffect, useCallback } from "react";
import { API_BASE, getAuthHeaders } from "../lib/api";

export interface ResumeListItem {
  id: string;
  title: string;
  updated_at: string | null;
}

export interface EducationItem {
  college: string;
  degree: string;
  cgpa: string;
  startYear: string;
  endYear: string;
}

export interface ExperienceItem {
  company: string;
  role: string;
  description: string;
}

export interface ProjectItem {
  name: string;
  technologies: string;
  description: string;
}

export interface ResumeData {
  id: string;
  title: string;
  personal_info: Record<string, string>;
  skills: string;
  template: string;
  section_order: string[];
  education: EducationItem[];
  experience: ExperienceItem[];
  projects: ProjectItem[];
}

export function useResume() {
  const [resumes, setResumes] = useState<ResumeListItem[]>([]);
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

  const getResume = useCallback(async (id: string): Promise<ResumeData | null> => {
    const res = await fetch(`${API_BASE}/resumes/${id}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return null;
    return res.json();
  }, []);

  const createResume = useCallback(async (data: Partial<ResumeData>): Promise<ResumeData | null> => {
    const res = await fetch(`${API_BASE}/resumes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) return null;
    return res.json();
  }, []);

  const updateResume = useCallback(async (id: string, data: Partial<ResumeData>): Promise<ResumeData | null> => {
    const res = await fetch(`${API_BASE}/resumes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify(data),
    });
    if (!res.ok) return null;
    return res.json();
  }, []);

  const deleteResume = useCallback(async (id: string): Promise<boolean> => {
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
