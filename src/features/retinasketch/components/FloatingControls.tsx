import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore, type LayerKey } from "../store/useStore";

const LAYER_LABELS: { key: LayerKey; label: string }[] = [
  { key: "anatomy", label: "Zones anatomiques" },
  { key: "quadrants", label: "Quadrants" },
  { key: "fovea", label: "Distance à la fovéa" },
  { key: "etdrs", label: "Grille ETDRS" },
  { key: "periphery", label: "Périphérie" },
  { key: "vessels", label: "Vaisseaux" },
];

interface Props {
  /** En contexte Consultation, l'œil est imposé : on masque le sélecteur OD/OG. */
  hideLaterality?: boolean;
}

export default function FloatingControls({ hideLaterality }: Props) {
  const laterality = useStore((s) => s.laterality);
  const setLaterality = useStore((s) => s.setLaterality);
  const layers = useStore((s) => s.layers);
  const toggleLayer = useStore((s) => s.toggleLayer);
  const [layersOpen, setLayersOpen] = useState(false);

  const activeCount = Object.values(layers).filter(Boolean).length;

  return (
    <div className="pointer-events-none absolute left-4 top-4 z-20 flex flex-col gap-2">
      {/* Latéralité — bouton volant */}
      {!hideLaterality && (
        <div className="pointer-events-auto flex rounded-xl border border-slate-200 bg-white/90 p-1 shadow-lg shadow-slate-900/5 backdrop-blur">
          {(["OD", "OS"] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLaterality(l)}
              className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition ${
                laterality === l
                  ? "bg-slate-900 text-white"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {l === "OD" ? "OD" : "OG"}
            </button>
          ))}
        </div>
      )}

      {/* Couches — widget volant */}
      <div className="pointer-events-auto">
        <button
          onClick={() => setLayersOpen((o) => !o)}
          className={`flex items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm font-medium shadow-lg shadow-slate-900/5 backdrop-blur transition ${
            layersOpen ? "text-slate-900" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Layers />
          Couches
          {activeCount > 0 && (
            <span className="rounded-full bg-blue-100 px-1.5 text-xs font-semibold text-blue-700">
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
              className="mt-2 w-60 rounded-xl border border-slate-200 bg-white/95 p-1.5 shadow-xl shadow-slate-900/10 backdrop-blur"
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
    </div>
  );
}

const Layers = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
    <path d="M12 2l9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 17l9 5 9-5" />
  </svg>
);
