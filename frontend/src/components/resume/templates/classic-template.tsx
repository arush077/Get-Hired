import { renderFormattedText, SectionTitle, isEmptyResume } from "./template-helpers";
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

export function ClassicTemplate({ resume, sectionOrder }: TemplateProps) {
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
      <div className="text-center mb-4">
        <h1 className="text-xl font-bold">{info.fullName || "Your Name"}</h1>
        <div className="mt-1 text-[12px] text-neutral-600 flex flex-wrap justify-center gap-x-2 gap-y-0.5">
          {info.email && <span>{info.email}</span>}
          {info.email && info.phone && <span>|</span>}
          {info.phone && <span>{info.phone}</span>}
          {(info.email || info.phone) && info.linkedin && <span>|</span>}
          {info.linkedin && <span>{info.linkedin}</span>}
          {info.linkedin && info.github && <span>|</span>}
          {info.github && <span>{info.github}</span>}
        </div>
      </div>

      <hr className="border-neutral-300 mb-4" />

      {/* Sections */}
      {sectionOrder.map((key) => {
        if (key === "education" && resume.education?.length > 0) {
          return (
            <div key={key} className="mb-4">
              <SectionTitle>{SECTION_LABELS[key]}</SectionTitle>
              {resume.education.map((edu, i) => (
                <div key={i} className="mb-2">
                  <div className="flex justify-between items-baseline">
                    <span className="font-semibold">{edu.college || "College Name"}</span>
                    <span className="text-[11px] text-neutral-500">
                      {[edu.startYear, edu.endYear].filter(Boolean).join(" - ")}
                    </span>
                  </div>
                  <div className="text-[12px] text-neutral-700">
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
              <SectionTitle>{SECTION_LABELS[key]}</SectionTitle>
              <p className="text-[12px]">{resume.skills}</p>
            </div>
          );
        }

        if (key === "experience" && resume.experience?.length > 0) {
          return (
            <div key={key} className="mb-4">
              <SectionTitle>{SECTION_LABELS[key]}</SectionTitle>
              {resume.experience.map((exp, i) => (
                <div key={i} className="mb-2">
                  <div className="font-semibold">{exp.role || "Role"}{exp.company ? ` at ${exp.company}` : ""}</div>
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
              <SectionTitle>{SECTION_LABELS[key]}</SectionTitle>
              {resume.projects.map((proj, i) => (
                <div key={i} className="mb-2">
                  <div className="font-semibold">
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
