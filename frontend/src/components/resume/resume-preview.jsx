import { ClassicTemplate } from "./templates/classic-template";
import { ModernTemplate } from "./templates/modern-template";
import { MinimalTemplate } from "./templates/minimal-template";
import { ProfessionalTemplate } from "./templates/professional-template";

const TEMPLATES = {
  classic: ClassicTemplate,
  modern: ModernTemplate,
  minimal: MinimalTemplate,
  professional: ProfessionalTemplate,
};

export function ResumePreview({ resume, sectionOrder }) {
  const Template = TEMPLATES[resume.template || "classic"] || ClassicTemplate;
  return <Template resume={resume} sectionOrder={sectionOrder} />;
}
