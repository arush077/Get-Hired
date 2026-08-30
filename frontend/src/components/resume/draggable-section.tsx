import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ReactNode } from "react";

interface DraggableSectionProps {
  id: string;
  children: ReactNode;
}

export function DraggableSection({ id, children }: DraggableSectionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-2">
      <button
        ref={setActivatorNodeRef}
        {...listeners}
        {...attributes}
        className="mt-6 cursor-grab active:cursor-grabbing text-gray-500 hover:text-gray-300 select-none text-lg leading-none p-1 rounded hover:bg-white/5 transition-all"
        title="Drag to reorder"
        aria-label="Drag to reorder"
      >
        ⠿
      </button>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}