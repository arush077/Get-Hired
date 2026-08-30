import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Header } from "../components/header";
import { ResumeForm } from "../components/resume/resume-form";
import { ResumePreview } from "../components/resume/resume-preview";
import { TemplateSelector } from "../components/resume/template-selector";
import { ResumeAnalysisPanel } from "../components/resume/analysis-panel";
import { Spinner } from "../components/ui/spinner";
import { useResume, type ResumeData } from "../hooks/useResume";

const DEFAULT_ORDER = ["education", "skills", "experience", "projects"];
const SECTION_LABELS = {
  education: "Education",
  skills: "Skills",
  experience: "Experience",
  projects: "Projects",
};

function createEmptyResume(title?: string): ResumeData {
  return {
    id: "",
    title: title || "Untitled Resume",
    personal_info: { fullName: "", email: "", phone: "", linkedin: "", github: "" },
    education: [{ college: "", degree: "", cgpa: "", startYear: "", endYear: "" }],
    experience: [{ company: "", role: "", description: "" }],
    projects: [{ name: "", technologies: "", description: "" }],
    skills: "",
    template: "classic",
    section_order: DEFAULT_ORDER,
  };
}

export function Builder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { getResume, createResume, updateResume } = useResume();
  const [resume, setResume] = useState<ResumeData>(
    createEmptyResume(location.state?.title)
  );
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [analysis, setAnalysis] = useState<Record<string, any> | null>(null);
  const [sectionOrder, setSectionOrder] = useState<string[]>(DEFAULT_ORDER);
  const isEditing = Boolean(id);

  useEffect(() => {
    if (!id) return;
    async function load() {
      const data = await getResume(id!);
      if (data) {
        setResume(data);
        setSectionOrder(data.section_order || DEFAULT_ORDER);
      } else {
        navigate("/dashboard");
      }
    }
    load();
  }, [id, navigate, getResume]);

  function updateResumeData(updated: Partial<ResumeData>) {
    setResume((prev) => ({ ...prev, ...updated }));
    setDirty(true);
  }

  const handleReorder = useCallback((dragIndex: number, dropIndex: number) => {
    setSectionOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(dropIndex, 0, moved);
      return next;
    });
    setDirty(true);
  }, []);

  async function handleSave(redirectTo?: string) {
    setSaving(true);
    try {
      const data = { ...resume, section_order: sectionOrder };
      if (isEditing) {
        await updateResume(id!, data);
      } else {
        const result = await createResume(data);
        if (result) {
          navigate(`/builder/${result.id}`, { replace: true });
        }
      }
      setLastSaved(new Date());
      setDirty(false);
      if (redirectTo) navigate(redirectTo);
    } finally {
      setSaving(false);
    }
  }

  function handleDownload() {
    window.print();
  }

  function handleBack() {
    if (dirty) {
      if (window.confirm("You have unsaved changes. Save before leaving?")) {
        handleSave("/dashboard");
      } else {
        setDirty(false);
        navigate("/dashboard");
      }
    } else {
      navigate("/dashboard");
    }
  }

  return (
    <div className="bg-[#0c0c0c] font-body min-h-screen">
      <Header />
      <div className="flex h-[calc(100vh-3.5rem)] pt-[3.5rem]">
        {/* Left: Form */}
        <div className="no-print flex w-1/2 flex-col border-r border-white/[0.04]">
          <div className="flex items-center justify-between border-b border-white/[0.04] px-6 py-3 glass-header">
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
              Back
            </button>
            <div className="flex items-center gap-3">
              {lastSaved && (
                <span className="text-xs text-gray-500">
                  Saved {lastSaved.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              <div className="mb-6">
                <h2 className="font-heading text-lg font-semibold text-gray-100">{resume.title || "Untitled Resume"}</h2>
                <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-500">
                  {sectionOrder.map((key, i) => (
                    <span key={key} className="flex items-center gap-1.5">
                      <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-white/[0.06] text-[10px] font-medium text-gray-300">
                        {i + 1}
                      </span>
                      {SECTION_LABELS[key as keyof typeof SECTION_LABELS]}
                      {i < sectionOrder.length - 1 && (
                        <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-3 w-3 text-gray-600">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                        </svg>
                      )}
                    </span>
                  ))}
                </div>
              </div>
              <ResumeForm
                resume={resume}
                onChange={updateResumeData}
                sectionOrder={sectionOrder}
                onReorder={handleReorder}
              />
            </div>
          </div>
        </div>

        {/* Right: Preview */}
        <div className="flex w-1/2 flex-col">
          <div className="flex items-center justify-between border-b border-white/[0.04] px-6 py-3 glass-header">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{resume.title || "Untitled Resume"}</p>
            {lastSaved && (
              <span className="text-xs text-gray-500">
                Saved {lastSaved.toLocaleTimeString()}
              </span>
            )}
          </div>
          <div className="flex-none px-6 pt-3 pb-2 border-b border-white/[0.04]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-gray-500">Template</span>
            </div>
            <div className="mt-2">
              <TemplateSelector
                selected={resume.template || "classic"}
                onSelect={(t: string) => updateResumeData({ template: t })}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[700px] p-6">
              <div id="print-area" className="rounded-2xl overflow-hidden shadow-2xl shadow-black/40">
                <ResumePreview resume={resume} sectionOrder={sectionOrder} />
              </div>
              <div className="border-t border-white/[0.06] pt-6 mt-6 space-y-3">
                <p className="text-xs text-gray-300 text-center leading-relaxed">
                  Done editing? Get AI-powered feedback on your resume before you submit.
                </p>
                <button
                  onClick={() => setShowAnalysis(true)}
                  className="btn-gold w-full rounded-xl py-3.5 text-sm font-medium"
                >
                  <span className="flex items-center justify-center gap-2">
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
                    </svg>
                    Analyze Resume
                  </span>
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSave()}
                    disabled={saving}
                    className="btn-secondary flex-1 rounded-xl py-2 text-sm font-medium"
                  >
                    {saving ? (
                      <span className="flex items-center justify-center gap-2">
                        <Spinner size="sm" />
                        Saving...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                        Save
                      </span>
                    )}
                  </button>
                  <button
                    onClick={handleDownload}
                    className="btn-secondary flex-1 rounded-xl py-2 text-sm font-medium"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                      Download
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showAnalysis && (
        <ResumeAnalysisPanel
          resume={resume}
          analysis={analysis}
          onAnalysis={setAnalysis}
          onClose={() => setShowAnalysis(false)}
        />
      )}
    </div>
  );
}