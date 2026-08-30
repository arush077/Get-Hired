import { ClassicTemplate } from "./templates/classic-template";
import { ModernTemplate } from "./templates/modern-template";
import { MinimalTemplate } from "./templates/minimal-template";
import { ProfessionalTemplate } from "./templates/professional-template";
import type { ResumeData } from "../../hooks/useResume";

interface ResumePreviewProps {
  resume: ResumeData;
  sectionOrder: string[];
}

const TEMPLATES: Record<string, React.ComponentType<ResumePreviewProps>> = {
  classic: ClassicTemplate,
  modern: ModernTemplate,
  minimal: MinimalTemplate,
  professional: ProfessionalTemplate,
};

export function ResumePreview({ resume, sectionOrder }: ResumePreviewProps) {
  const Template = TEMPLATES[resume.template || "classic"] || ClassicTemplate;
  return <Template resume={resume} sectionOrder={sectionOrder} />;
}
