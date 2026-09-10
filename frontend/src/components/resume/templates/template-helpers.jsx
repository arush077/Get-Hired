export function renderFormattedText(text) {
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

export function SectionTitle({ children }) {
  return (
    <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-neutral-800 border-b border-neutral-200 pb-1 mb-3">
      {children}
    </h3>
  );
}

export function isEmptyResume(resume) {
  const info = resume.personal_info || {};
  const hasInfo = info.fullName || info.email || info.phone;
  const hasEdu = resume.education?.some((e) => e.college || e.degree);
  const hasExp = resume.experience?.some((e) => e.company || e.role);
  const hasProj = resume.projects?.some((p) => p.name);
  const hasSkills = resume.skills?.trim();
  return !hasInfo && !hasEdu && !hasExp && !hasProj && !hasSkills;
}
