import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "../components/header";
import { useResume } from "../hooks/useResume";

export function Dashboard() {
  const { resumes, loading, deleteResume } = useResume();
  const navigate = useNavigate();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  function handleCreate() {
    const title = newTitle.trim() || "Untitled Resume";
    navigate("/builder", { state: { title } });
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50">
      <Header />
      <main className="max-w-5xl mx-auto px-4 pt-24 pb-16">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-3">
            Build Your Resume
          </h1>
          <p className="text-neutral-400 text-lg mb-6">
            Create a professional resume and practice your interview skills
          </p>
          <button
            onClick={() => setShowCreateDialog(true)}
            className="px-6 py-3 bg-gradient-to-r from-pink-500 to-red-600 text-white font-medium rounded-lg hover:from-pink-600 hover:to-red-700 transition-all"
          >
            Build New Resume
          </button>
        </div>

        {/* Create Dialog */}
        {showCreateDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
              <h2 className="font-semibold text-lg mb-2">New Resume</h2>
              <input
                type="text"
                placeholder="Resume title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full px-4 py-2.5 bg-neutral-800/50 border border-neutral-700 rounded-lg text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 mb-4"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  className="flex-1 py-2.5 bg-gradient-to-r from-pink-500 to-red-600 text-white text-sm font-medium rounded-lg hover:from-pink-600 hover:to-red-700 transition-all"
                >
                  Create
                </button>
                <button
                  onClick={() => setShowCreateDialog(false)}
                  className="px-4 py-2.5 text-sm text-neutral-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Resume List */}
        {loading ? (
          <div className="text-center py-12 text-neutral-500">Loading...</div>
        ) : resumes.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-neutral-500 mb-2">No resumes yet</p>
            <p className="text-neutral-600 text-sm">Create your first resume to get started</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {resumes.map((resume) => (
              <div
                key={resume.id}
                className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-5 flex items-center justify-between"
              >
                <div>
                  <h3 className="font-medium">{resume.title}</h3>
                  {resume.updated_at && (
                    <p className="text-[12px] text-neutral-500 mt-0.5">
                      Updated {new Date(resume.updated_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate(`/builder/${resume.id}`)}
                    className="px-4 py-1.5 text-[13px] font-medium text-neutral-300 bg-neutral-800 border border-neutral-700 rounded-lg hover:bg-neutral-700 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm("Delete this resume?")) {
                        await deleteResume(resume.id);
                      }
                    }}
                    className="px-3 py-1.5 text-[13px] text-neutral-500 hover:text-red-500 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
