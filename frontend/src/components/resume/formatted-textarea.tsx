import { useRef } from "react";

interface FormattedTextareaProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onGenerate?: () => Promise<string>;
  generateDisabled?: boolean;
  placeholder?: string;
}

export function FormattedTextarea({ label, value, onChange, onGenerate, generateDisabled, placeholder }: FormattedTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function wrapFormat(prefix: string, suffix: string) {
    const ta = textareaRef.current;
    if (!ta) return;

    ta.focus();
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.substring(start, end);
    const before = value.substring(0, start);
    const after = value.substring(end);

    const newText = selected
      ? before + prefix + selected + suffix + after
      : prefix + value + suffix;

    onChange(newText);

    requestAnimationFrame(() => {
      ta.focus();
      if (selected) {
        ta.setSelectionRange(
          start + prefix.length,
          start + prefix.length + selected.length
        );
      } else {
        const pos = prefix.length + value.length + suffix.length;
        ta.setSelectionRange(pos, pos);
      }
    });
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <label className="text-sm font-medium text-gray-300">{label}</label>
        <div className="flex gap-1 ml-auto">
          <button
            type="button"
            onClick={() => wrapFormat("**", "**")}
            className="toolbar-btn rounded-lg px-2 py-0.5 text-xs font-bold"
            title="Bold"
          >
            B
          </button>
          <button
            type="button"
            onClick={() => wrapFormat("*", "*")}
            className="toolbar-btn rounded-lg px-2 py-0.5 text-xs italic"
            title="Italic"
          >
            I
          </button>
          {onGenerate && (
            <button
              type="button"
              onClick={async () => {
                const result = await onGenerate();
                if (result) onChange(result);
              }}
              disabled={generateDisabled}
              className="toolbar-btn rounded-lg px-2 py-0.5 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
              title={generateDisabled ? "Fill in the fields above first" : "Generate with AI"}
            >
              ✨ Generate
            </button>
          )}
        </div>
      </div>
      <textarea
        ref={textareaRef}
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-glass block w-full px-3 py-2 text-sm resize-none"
      />
    </div>
  );
}