
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore, type LayerKey } from "@/features/retinasketch/store/useStore";

const LAYER_LABELS: { key: LayerKey; label: string }[] = [
  { key: "anatomy", label: "Zones anatomiques" },
  { key: "quadrants", label: "Quadrants" },
  { key: "fovea", label: "Distance à la fovéa" },
  { key: "etdrs", label: "Grille ETDRS" },
  { key: "periphery", label: "Périphérie" },
  { key: "vessels", label: "Vaisseaux" },
];

/**
 * Contrôles d'en-tête : latéralité (OD/OG) + couches activables.
 * Rendus dans la barre du haut (`Workspace`), le menu Couches s'ouvre en
 * déroulant sous le bouton.
 */
export default function FloatingControls() {
  const laterality = useStore((s) => s.laterality);
  const setLaterality = useStore((s) => s.setLaterality);
  const layers = useStore((s) => s.layers);
  const toggleLayer = useStore((s) => s.toggleLayer);
  const [layersOpen, setLayersOpen] = useState(false);
  const layersRef = useRef<HTMLDivElement>(null);

  const activeCount = Object.values(layers).filter(Boolean).length;

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (
        layersOpen &&
        layersRef.current &&
        !layersRef.current.contains(e.target as Node)
      )
        setLayersOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [layersOpen]);

  return (
    <>
      {/* Latéralité — segmenté */}
      <div className="flex rounded-lg border border-slate-200 p-0.5">
        {(["OD", "OS"] as const).map((l) => (
          <button
            key={l}
            onClick={() => setLaterality(l)}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
              laterality === l
                ? "bg-slate-900 text-white"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            {l === "OD" ? "OD" : "OG"}
          </button>
        ))}
      </div>

      {/* Couches — bouton + menu déroulant */}
      <div ref={layersRef} className="relative">
        <button
          onClick={() => setLayersOpen((o) => !o)}
          className={`flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium transition ${
            layersOpen ? "text-slate-900" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Layers />
          Couches
          {activeCount > 0 && (
            <span className="rounded-full bg-blue-100 px-1.5 text-[10px] font-semibold text-blue-700">
              {activeCount}
            </span>
          )}
        </button>

        <AnimatePresence>
          {layersOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.12 }}
              className="absolute left-0 top-full z-40 mt-1.5 w-60 rounded-xl border border-slate-200 bg-white/95 p-1.5 shadow-xl shadow-slate-900/10 backdrop-blur"
            >
              {LAYER_LABELS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => toggleLayer(key)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm text-slate-600 transition hover:bg-slate-50"
                >
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded border transition ${
                      layers[key]
                        ? "border-blue-500 bg-blue-500 text-white"
                        : "border-slate-300 bg-white"
                    }`}
                  >
                    {layers[key] && (
                      <svg width="10" height="10" viewBox="0 0 12 12">
                        <path
                          d="M2.5 6.5l2.5 2.5 4.5-5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>
                  {label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

const Layers = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
    <path d="M12 2l9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 17l9 5 9-5" />
  </svg>
);
