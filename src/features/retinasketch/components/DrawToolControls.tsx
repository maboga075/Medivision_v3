
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  useStore,
  ANNOTATION_OPACITY_MIN,
  ANNOTATION_OPACITY_MAX,
} from "@/features/retinasketch/store/useStore";

/**
 * Contrôles d'annotation dans la barre du haut :
 * - Sélecteur d'outil de tracé : « Lésion » (clic = spot, glissé = surface) ou
 *   « Flèche » (glissé = flèche de désignation, couleur de la lésion).
 * - Opacité globale des annotations (spots, surfaces, flèches) à l'écran et à
 *   l'impression.
 * Masqué en mode Sélection (le tracé y est désactivé).
 */
export default function DrawToolControls() {
  const drawTool = useStore((s) => s.drawTool);
  const setDrawTool = useStore((s) => s.setDrawTool);
  const selectMode = useStore((s) => s.selectMode);
  const opacity = useStore((s) => s.annotationOpacity);
  const setOpacity = useStore((s) => s.setAnnotationOpacity);

  const [opacityOpen, setOpacityOpen] = useState(false);
  const opacityRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (
        opacityOpen &&
        opacityRef.current &&
        !opacityRef.current.contains(e.target as Node)
      )
        setOpacityOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [opacityOpen]);

  if (selectMode) return null;

  return (
    <div className="flex items-center gap-2">
      {/* Outil de tracé — segmenté */}
      <div className="flex rounded-lg border border-slate-200 p-0.5">
        <button
          onClick={() => setDrawTool("lesion")}
          className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition ${
            drawTool === "lesion"
              ? "bg-slate-900 text-white"
              : "text-slate-500 hover:text-slate-900"
          }`}
          title="Lésion : clic = spot, clic glissé = surface"
        >
          <SpotIcon />
          Lésion
        </button>
        <button
          onClick={() => setDrawTool("arrow")}
          className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition ${
            drawTool === "arrow"
              ? "bg-slate-900 text-white"
              : "text-slate-500 hover:text-slate-900"
          }`}
          title="Flèche : clic glissé = flèche de désignation (couleur de la lésion)"
        >
          <ArrowIcon />
          Flèche
        </button>
      </div>

      {/* Opacité des annotations — bouton + popover */}
      <div ref={opacityRef} className="relative">
        <button
          onClick={() => setOpacityOpen((o) => !o)}
          className={`flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium transition ${
            opacityOpen ? "text-slate-900" : "text-slate-600 hover:text-slate-900"
          }`}
          title="Opacité des annotations"
        >
          <OpacityIcon />
          <span className="tabular-nums">{Math.round(opacity * 100)}%</span>
        </button>

        <AnimatePresence>
          {opacityOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.12 }}
              className="absolute left-0 top-full z-40 mt-1.5 w-56 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-xl shadow-slate-900/10 backdrop-blur"
            >
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-xs font-medium text-slate-600">
                  Opacité des annotations
                </span>
                <span className="text-[11px] tabular-nums text-slate-400">
                  {Math.round(opacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={ANNOTATION_OPACITY_MIN}
                max={ANNOTATION_OPACITY_MAX}
                step={0.01}
                value={opacity}
                onChange={(e) => setOpacity(parseFloat(e.target.value))}
                className="h-1 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-blue-500"
              />
              <p className="mt-1.5 text-[11px] leading-snug text-slate-400">
                S'applique aux spots, surfaces et flèches — à l'écran et à
                l'impression.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

const SpotIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="12" r="6" />
  </svg>
);

const ArrowIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 17L17 7M9 7h8v8" />
  </svg>
);

const OpacityIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v18a6 6 0 0 0 0-12 6 6 0 0 1 0-6z" />
    <circle cx="12" cy="12" r="9" />
  </svg>
);
