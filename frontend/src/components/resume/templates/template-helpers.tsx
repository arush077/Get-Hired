import type { ReactNode } from "react";

export function renderFormattedText(text: string): ReactNode {
  if (!text) return null;
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-neutral-800 border-b border-neutral-200 pb-1 mb-3">
      {children}
    </h3>
  );
}

export function isEmptyResume(resume: { personal_info?: Record<string, string>; education?: unknown[]; experience?: unknown[]; projects?: unknown[]; skills?: string }): boolean {
  const info = resume.personal_info || {};
  const hasInfo = info.fullName || info.email || info.phone;
  const hasEdu = (resume.education as Array<Record<string, string>>)?.some((e) => e.college || e.degree);
  const hasExp = (resume.experience as Array<Record<string, string>>)?.some((e) => e.company || e.role);
  const hasProj = (resume.projects as Array<Record<string, string>>)?.some((p) => p.name);
  const hasSkills = resume.skills?.trim();
  return !hasInfo && !hasEdu && !hasExp && !hasProj && !hasSkills;
}
