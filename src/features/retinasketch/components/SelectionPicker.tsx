
import { useStore } from "@/features/retinasketch/store/useStore";
import type { Laterality } from "@/features/retinasketch/lib/types";
import { anatomicalLabel } from "@/features/retinasketch/lib/types";
import { getLesion } from "@/features/retinasketch/lib/ontology/lesions";

interface Props {
  eye: Laterality;
}

/**
 * Choix d'une lésion parmi plusieurs SUPERPOSÉES sous le clic (mode Sélection).
 * Rendu dans le panneau de l'œil concerné, à la position du clic.
 */
export default function SelectionPicker({ eye }: Props) {
  const pick = useStore((s) => s.overlapPick);
  const annotations = useStore((s) => s.annotations);
  const selectAnnotation = useStore((s) => s.selectAnnotation);
  const setOverlapPick = useStore((s) => s.setOverlapPick);

  if (!pick || pick.eye !== eye) return null;

  const items = pick.ids
    .map((id) => annotations.find((a) => a.id === id))
    .filter((a): a is NonNullable<typeof a> => !!a);
  if (items.length === 0) return null;

  return (
    <>
      {/* Voile de fermeture (clic en dehors) */}
      <div
        className="absolute inset-0 z-40"
        onMouseDown={() => setOverlapPick(null)}
      />
      <div
        className="absolute z-50 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white/95 shadow-xl shadow-slate-900/15 backdrop-blur"
        style={{
          left: Math.min(pick.x + 8, 9999),
          top: pick.y + 8,
          transform: "translateZ(0)",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          {items.length} lésions superposées
        </div>
        <ul className="max-h-64 overflow-y-auto p-1">
          {items.map((a) => {
            const lesion = getLesion(a.lesionId);
            return (
              <li key={a.id}>
                <button
                  onClick={() => selectAnnotation(a.id)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-slate-50"
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/5"
                    style={{ backgroundColor: lesion ? lesion.color : "#94a3b8" }}
                  />
                  <span className="flex-1 truncate text-sm text-slate-700">
                    {lesion ? lesion.name : "Brouillon"}
                  </span>
                  <span className="shrink-0 text-[10px] text-slate-400">
                    {a.kind === "point" ? "spot" : a.kind === "arrow" ? "flèche" : "surface"} · {anatomicalLabel(a.attrs)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
