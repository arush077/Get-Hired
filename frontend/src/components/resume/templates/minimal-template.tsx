import { renderFormattedText, isEmptyResume } from "./template-helpers";
import type { ResumeData } from "../../../hooks/useResume";

interface TemplateProps {
  resume: ResumeData;
  sectionOrder: string[];
}

const SECTION_LABELS: Record<string, string> = {
  education: "Education",
  skills: "Skills",
  experience: "Experience",
  projects: "Projects",
};

export function MinimalTemplate({ resume, sectionOrder }: TemplateProps) {
  const info = resume.personal_info || {};

  if (isEmptyResume(resume)) {
    return (
      <div className="p-8 text-center text-neutral-400 text-sm">
        Start filling in your details to see a preview
      </div>
    );
  }

  return (
    <div className="p-8 bg-white text-neutral-900 text-[13px] leading-relaxed">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-light">{info.fullName || "Your Name"}</h1>
        <div className="mt-1 text-[12px] text-neutral-500 flex flex-wrap gap-x-2 gap-y-0.5">
          {info.email && <span>{info.email}</span>}
          {info.phone && <span>/ {info.phone}</span>}
          {info.linkedin && <span>/ {info.linkedin}</span>}
          {info.github && <span>/ {info.github}</span>}
        </div>
      </div>

      {/* Sections */}
      {sectionOrder.map((key) => {
        if (key === "education" && resume.education?.length > 0) {
          return (
            <div key={key} className="mb-4">
              <h3 className="text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-400 mb-2">
                {SECTION_LABELS[key]}
              </h3>
              {resume.education.map((edu, i) => (
                <div key={i} className="mb-1.5">
                  <div className="flex justify-between items-baseline">
                    <span className="font-medium">{edu.college || "College Name"}</span>
                    <span className="text-[11px] text-neutral-400">
                      {[edu.startYear, edu.endYear].filter(Boolean).join(" - ")}
                    </span>
                  </div>
                  <div className="text-[12px] text-neutral-600">
                    {edu.degree}{edu.cgpa ? `, CGPA: ${edu.cgpa}` : ""}
                  </div>
                </div>
              ))}
            </div>
          );
        }

        if (key === "skills" && resume.skills?.trim()) {
          return (
            <div key={key} className="mb-4">
              <h3 className="text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-400 mb-2">
                {SECTION_LABELS[key]}
              </h3>
              <p className="text-[12px]">{resume.skills}</p>
            </div>
          );
        }

        if (key === "experience" && resume.experience?.length > 0) {
          return (
            <div key={key} className="mb-4">
              <h3 className="text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-400 mb-2">
                {SECTION_LABELS[key]}
              </h3>
              {resume.experience.map((exp, i) => (
                <div key={i} className="mb-1.5">
                  <div className="font-medium">{exp.role || "Role"}{exp.company ? ` at ${exp.company}` : ""}</div>
                  {exp.description && (
                    <div className="text-[12px] mt-0.5 whitespace-pre-line">{renderFormattedText(exp.description)}</div>
                  )}
                </div>
              ))}
            </div>
          );
        }

        if (key === "projects" && resume.projects?.length > 0) {
          return (
            <div key={key} className="mb-4">
              <h3 className="text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-400 mb-2">
                {SECTION_LABELS[key]}
              </h3>
              {resume.projects.map((proj, i) => (
                <div key={i} className="mb-1.5">
                  <div className="font-medium">
                    {proj.name || "Project"}
                    {proj.technologies ? ` (${proj.technologies})` : ""}
                  </div>
                  {proj.description && (
                    <div className="text-[12px] mt-0.5 whitespace-pre-line">{renderFormattedText(proj.description)}</div>
                  )}
                </div>
              ))}
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
