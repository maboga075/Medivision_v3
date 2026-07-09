
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/features/retinasketch/store/useStore";
import { getLesion } from "@/features/retinasketch/lib/ontology/lesions";

/**
 * Barre d'édition de la lésion SÉLECTIONNÉE (mode Sélection) : ré-identifier
 * (ouvre la palette) ou supprimer la couche. `Suppr` supprime aussi.
 */
export default function SelectionToolbar() {
  const id = useStore((s) => s.selectedAnnotationId);
  const annotation = useStore((s) =>
    s.selectedAnnotationId
      ? s.annotations.find((a) => a.id === s.selectedAnnotationId) ?? null
      : null,
  );
  const setPaletteOpen = useStore((s) => s.setPaletteOpen);
  const deleteAnnotation = useStore((s) => s.deleteAnnotation);
  const selectAnnotation = useStore((s) => s.selectAnnotation);

  const lesion = annotation ? getLesion(annotation.lesionId) : undefined;
  const show = !!id && !!annotation;

  return (
    <div className="pointer-events-none absolute bottom-20 left-1/2 z-30 -translate-x-1/2">
      <AnimatePresence>
        {show && annotation && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.14 }}
            className="pointer-events-auto flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 py-1.5 pl-3 pr-1.5 text-sm shadow-xl shadow-slate-900/10 backdrop-blur"
          >
            <span
              className="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/5"
              style={{ backgroundColor: lesion ? lesion.color : "#94a3b8" }}
            />
            <span className="max-w-[180px] truncate font-medium text-slate-700">
              {lesion ? lesion.name : "Brouillon"}
            </span>
            <span className="text-[11px] text-slate-400">
              {annotation.kind === "point" ? "spot" : "surface"} · {annotation.attrs.anatomicalZone}
            </span>
            <span className="mx-0.5 h-4 w-px bg-slate-200" />
            <button
              onClick={() => setPaletteOpen(true)}
              className="rounded-full px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              Modifier
            </button>
            <button
              onClick={() => deleteAnnotation(annotation.id)}
              className="rounded-full px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
            >
              Supprimer
            </button>
            <button
              onClick={() => selectAnnotation(null)}
              title="Désélectionner · Échap"
              className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
