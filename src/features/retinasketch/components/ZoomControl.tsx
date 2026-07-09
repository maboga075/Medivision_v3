
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/features/retinasketch/store/useStore";

/**
 * Indicateur de zoom de l'IMAGE de fond + réinitialisation. La molette zoome la
 * rétinographie À L'INTÉRIEUR du cercle (le schéma et les annotations restent
 * fixes) ; ce bouton apparaît dès que l'image de l'œil actif est zoomée,
 * déplacée ou pivotée, et remet sa position d'origine (rétinographie à 50°).
 */
export default function ZoomControl() {
  const laterality = useStore((s) => s.laterality);
  const bg = useStore((s) => s.backgrounds[s.laterality]);
  const resetTransform = useStore((s) => s.resetBackgroundTransform);

  const transformed =
    !!bg.src &&
    (Math.abs(bg.scale - 1) > 0.001 ||
      bg.offsetXMm !== 0 ||
      bg.offsetYMm !== 0 ||
      bg.rotationDeg !== 0);

  return (
    <div className="pointer-events-none absolute bottom-6 right-4 z-20">
      <AnimatePresence>
        {transformed && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.14 }}
            onClick={() => resetTransform(laterality)}
            className="pointer-events-auto flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-lg shadow-slate-900/5 backdrop-blur transition hover:text-slate-900"
            title="Replacer l’image (vue de départ à 50°)"
          >
            <span className="rounded bg-slate-100 px-1 text-[10px] font-semibold text-slate-500">
              {laterality === "OD" ? "OD" : "OG"}
            </span>
            <span className="tabular-nums">{Math.round((bg.scale || 1) * 100)}%</span>
            <span className="text-slate-300">·</span>
            <span>Replacer l’image</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
