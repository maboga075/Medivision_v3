
import { useMemo } from "react";
import { useStore } from "@/features/retinasketch/store/useStore";
import { getLesion } from "@/features/retinasketch/lib/ontology/lesions";

export default function LesionPanel() {
  const annotations = useStore((s) => s.annotations);
  const hidden = useStore((s) => s.hiddenLesionIds);
  const toggleVis = useStore((s) => s.toggleLesionVisibility);
  const deleteGroup = useStore((s) => s.deleteLesionGroup);

  const groups = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of annotations)
      if (a.status === "validated" && a.lesionId)
        map.set(a.lesionId, (map.get(a.lesionId) ?? 0) + 1);
    return [...map.entries()].map(([id, count]) => ({
      lesion: getLesion(id)!,
      count,
    }));
  }, [annotations]);

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-700">Lésions</h2>
        <span className="text-xs text-slate-400">{groups.length} type(s)</span>
      </div>

      <ul className="flex flex-col px-1.5 pb-2">
        {groups.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-slate-400">
            Dessinez puis identifiez vos lésions.
          </li>
        )}
        {groups.map(({ lesion, count }) => {
          const isHidden = hidden.includes(lesion.id);
          return (
            <li
              key={lesion.id}
              className="group flex items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-slate-50"
            >
              <span
                className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-black/5"
                style={{ backgroundColor: lesion.color }}
              />
              <span
                className={`flex-1 truncate text-sm ${isHidden ? "text-slate-300 line-through" : "text-slate-700"}`}
              >
                {lesion.name}
              </span>
              <span className="rounded-md bg-slate-100 px-1.5 text-xs font-medium tabular-nums text-slate-500">
                {count}
              </span>
              <button
                onClick={() => toggleVis(lesion.id)}
                title="Afficher / masquer"
                className="text-slate-300 transition hover:text-slate-600"
              >
                {isHidden ? <EyeOff /> : <Eye />}
              </button>
              <button
                onClick={() => deleteGroup(lesion.id)}
                title="Supprimer"
                className="text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-red-500"
              >
                <Trash />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const Eye = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const EyeOff = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 3l18 18M10.6 10.6a3 3 0 004.2 4.2M9.9 4.8A10 10 0 0122 12a18 18 0 01-3 3.6M6.6 6.6A18 18 0 002 12s3.5 7 10 7a10 10 0 003.4-.6" />
  </svg>
);
const Trash = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" strokeLinecap="round" />
  </svg>
);
