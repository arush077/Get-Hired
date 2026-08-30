import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { DraggableSection } from "./draggable-section";
import { FormattedTextarea } from "./formatted-textarea";
import { API_BASE, getAuthHeaders } from "../../lib/api";
import type { ResumeData } from "../../hooks/useResume";

type ResumeSection = "education" | "experience" | "projects";

interface ResumeFormProps {
  resume: ResumeData;
  onChange: (data: Partial<ResumeData>) => void;
  sectionOrder: string[];
  onReorder: (from: number, to: number) => void;
}

const EMPTY_ITEMS: Record<ResumeSection, Record<string, string>> = {
  education: { college: "", degree: "", cgpa: "", startYear: "", endYear: "" },
  experience: { company: "", role: "", description: "" },
  projects: { name: "", technologies: "", description: "" },
};

function AddIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-3.5 w-3.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-3.5 w-3.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
  );
}

function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-glass block w-full px-3 py-2 text-sm"
      />
    </div>
  );
}

function ItemSection({ heading, sectionKey, onAdd, children }: { heading: string; sectionKey: ResumeSection; onAdd: (section: ResumeSection) => void; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-heading text-base font-semibold text-gray-100">{heading}</h2>
        <button
          onClick={() => onAdd(sectionKey)}
          className="flex items-center gap-1 text-sm font-medium text-gray-300 hover:text-white transition-colors"
        >
          <AddIcon />
          Add
        </button>
      </div>
      {children}
    </section>
  );
}

function ItemCard({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <div className="glass-card rounded-2xl p-4 mb-3">
      <div className="mb-3 flex justify-end">
        <button onClick={onRemove} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors">
          <DeleteIcon />
          Remove
        </button>
      </div>
      <div className="space-y-3">
        {children}
      </div>
    </div>
  );
}

export function ResumeForm({ resume, onChange, sectionOrder, onReorder }: ResumeFormProps) {
  async function generateDescription(type: string, context: Record<string, string>): Promise<string> {
    const res = await fetch(`${API_BASE}/resumes/ai/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ type, ...context }),
    });
    if (!res.ok) throw new Error("Failed to generate description");
    const data = await res.json();
    return data.description;
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sectionOrder.indexOf(active.id as string);
    const newIndex = sectionOrder.indexOf(over.id as string);
    if (oldIndex !== -1 && newIndex !== -1) {
      onReorder(oldIndex, newIndex);
    }
  }

  function updatePersonalInfo(field: string, value: string) {
    onChange({ personal_info: { ...resume.personal_info, [field]: value } });
  }

  function updateArray(section: ResumeSection, index: number, field: string, value: string) {
    const items = [...(resume[section] || [])];
    items[index] = { ...items[index], [field]: value };
    onChange({ [section]: items });
  }

  function addItem(section: ResumeSection) {
    onChange({ [section]: [...(resume[section] || []), EMPTY_ITEMS[section]] });
  }

  function removeItem(section: ResumeSection, index: number) {
    const items = (resume[section] || []).filter((_: unknown, i: number) => i !== index);
    onChange({ [section]: items });
  }

  const sections = {
    education: (
      <ItemSection heading="Education" sectionKey="education" onAdd={addItem}>
        {(resume.education || []).map((edu, i) => (
          <ItemCard key={i} onRemove={() => removeItem("education", i)}>
            <Input label="College" value={edu.college || ""} onChange={(v: string) => updateArray("education", i, "college", v)} />
            <Input label="Degree" value={edu.degree || ""} onChange={(v: string) => updateArray("education", i, "degree", v)} />
            <div className="grid grid-cols-3 gap-3">
              <Input label="CGPA" value={edu.cgpa || ""} onChange={(v: string) => updateArray("education", i, "cgpa", v)} />
              <Input label="Start Year" value={edu.startYear || ""} onChange={(v: string) => updateArray("education", i, "startYear", v)} />
              <Input label="End Year" value={edu.endYear || ""} onChange={(v: string) => updateArray("education", i, "endYear", v)} />
            </div>
          </ItemCard>
        ))}
      </ItemSection>
    ),

    skills: (
      <section>
        <h2 className="font-heading text-base font-semibold text-gray-100 mb-4">Skills</h2>
        <div className="glass-card rounded-2xl p-4">
          <Input
            label="Skills (comma separated)"
            value={resume.skills || ""}
            onChange={(v: string) => onChange({ skills: v })}
          />
        </div>
      </section>
    ),

    experience: (
      <ItemSection heading="Experience" sectionKey="experience" onAdd={addItem}>
        {(resume.experience || []).map((exp, i) => (
          <ItemCard key={i} onRemove={() => removeItem("experience", i)}>
            <Input label="Company" value={exp.company || ""} onChange={(v: string) => updateArray("experience", i, "company", v)} />
            <Input label="Role" value={exp.role || ""} onChange={(v: string) => updateArray("experience", i, "role", v)} />
            <FormattedTextarea
              label="Description"
              value={exp.description || ""}
              onChange={(v: string) => updateArray("experience", i, "description", v)}
              onGenerate={() => generateDescription("experience", { company: exp.company, role: exp.role })}
              generateDisabled={!exp.company || !exp.role}
              placeholder="Describe your responsibilities and achievements..."
            />
          </ItemCard>
        ))}
      </ItemSection>
    ),

    projects: (
      <ItemSection heading="Projects" sectionKey="projects" onAdd={addItem}>
        {(resume.projects || []).map((proj, i) => (
          <ItemCard key={i} onRemove={() => removeItem("projects", i)}>
            <Input label="Project Name" value={proj.name || ""} onChange={(v: string) => updateArray("projects", i, "name", v)} />
            <Input label="Technologies" value={proj.technologies || ""} onChange={(v: string) => updateArray("projects", i, "technologies", v)} />
            <FormattedTextarea
              label="Description"
              value={proj.description || ""}
              onChange={(v: string) => updateArray("projects", i, "description", v)}
              onGenerate={() => generateDescription("projects", { name: proj.name, technologies: proj.technologies })}
              generateDisabled={!proj.name || !proj.technologies}
              placeholder="Describe the project, technologies, and outcomes..."
            />
          </ItemCard>
        ))}
      </ItemSection>
    ),
  };

  return (
    <div className="space-y-6">
      {/* Personal Info - always first, not draggable */}
      <section>
        <h2 className="font-heading text-base font-semibold text-gray-100 mb-4">Personal Information</h2>
        <div className="glass-card rounded-2xl p-4">
          <div className="space-y-3">
            <Input label="Full Name" value={resume.personal_info?.fullName || ""} onChange={(v: string) => updatePersonalInfo("fullName", v)} />
            <Input label="Email" value={resume.personal_info?.email || ""} onChange={(v: string) => updatePersonalInfo("email", v)} type="email" />
            <Input label="Phone" value={resume.personal_info?.phone || ""} onChange={(v: string) => updatePersonalInfo("phone", v)} type="tel" />
            <Input label="LinkedIn URL" value={resume.personal_info?.linkedin || ""} onChange={(v: string) => updatePersonalInfo("linkedin", v)} type="url" />
            <Input label="GitHub URL" value={resume.personal_info?.github || ""} onChange={(v: string) => updatePersonalInfo("github", v)} type="url" />
          </div>
        </div>
      </section>

      {/* Draggable sections */}
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sectionOrder} strategy={verticalListSortingStrategy}>
          {sectionOrder.map((key) => (
            <DraggableSection key={key} id={key}>
              {sections[key as keyof typeof sections]}
            </DraggableSection>
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}