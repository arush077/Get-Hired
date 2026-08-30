import { renderFormattedText, isEmptyResume } from "./template-helpers";
import type { ResumeData } from "../../../hooks/useResume";

interface TemplateProps {
  resume: ResumeData;
  sectionOrder: string[];
}

export function ProfessionalTemplate({ resume, sectionOrder }: TemplateProps) {
  const info = resume.personal_info || {};

  if (isEmptyResume(resume)) {
    return (
      <div className="p-8 text-center text-neutral-400 text-sm">
        Start filling in your details to see a preview
      </div>
    );
  }

  return (
    <div className="flex bg-white text-neutral-900 text-[13px] leading-relaxed min-h-[500px]">
      {/* Sidebar */}
      <div className="w-[30%] bg-neutral-50 p-6 border-r border-neutral-200">
        <h1 className="text-lg font-bold mb-3">{info.fullName || "Your Name"}</h1>
        <div className="text-[11px] text-neutral-600 space-y-1">
          {info.email && <div>{info.email}</div>}
          {info.phone && <div>{info.phone}</div>}
          {info.linkedin && <div className="truncate">{info.linkedin}</div>}
          {info.github && <div className="truncate">{info.github}</div>}
        </div>

        {resume.skills?.trim() && (
          <div className="mt-5">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-500 mb-2 border-b border-neutral-200 pb-1">
              Skills
            </h3>
            <div className="flex flex-wrap gap-1">
              {resume.skills.split(",").map((s: string, i: number) => (
                <span key={i} className="text-[10px] bg-neutral-200 text-neutral-700 px-2 py-0.5 rounded">
                  {s.trim()}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main */}
      <div className="flex-[70%] p-6">
        {sectionOrder.filter(k => k !== "skills").map((key) => {
          if (key === "education" && resume.education?.length > 0) {
            return (
              <div key={key} className="mb-4">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-neutral-800 border-b border-neutral-200 pb-1 mb-3">
                  Education
                </h3>
                {resume.education.map((edu, i) => (
                  <div key={i} className="mb-2">
                    <div className="flex justify-between items-baseline">
                      <span className="font-semibold">{edu.college || "College Name"}</span>
                      <span className="text-[11px] text-neutral-500">
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

          if (key === "experience" && resume.experience?.length > 0) {
            return (
              <div key={key} className="mb-4">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-neutral-800 border-b border-neutral-200 pb-1 mb-3">
                  Experience
                </h3>
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
                <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-neutral-800 border-b border-neutral-200 pb-1 mb-3">
                  Projects
                </h3>
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
    </div>
  );
}
