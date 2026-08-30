const TEMPLATES = [
  { key: "classic", name: "Classic" },
  { key: "modern", name: "Modern" },
  { key: "minimal", name: "Minimal" },
  { key: "professional", name: "Professional" },
];

export function TemplateSelector({ selected, onSelect }: { selected: string; onSelect: (key: string) => void }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {TEMPLATES.map((t) => (
        <button
          key={t.key}
          onClick={() => onSelect(t.key)}
          className={`rounded-xl border px-3 py-2 text-xs font-medium transition-all ${
            selected === t.key
              ? "border-[#d9c59a] bg-[#d9c59a]/10 text-[#d9c59a]"
              : "border-white/[0.06] bg-white/[0.03] text-gray-400 hover:border-white/[0.15] hover:text-gray-200"
          }`}
        >
          {t.name}
        </button>
      ))}
    </div>
  );
}