
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/features/retinasketch/store/useStore";
import {
  recordCase,
  countCases,
  exportDatasetJSON,
  clearAllCases,
} from "@/features/retinasketch/lib/ai/dataset";
import type { TrainingCase } from "@/features/retinasketch/lib/ai/types";

/**
 * Flywheel d'apprentissage : enregistre chaque consultation validée comme cas
 * d'entraînement local (IndexedDB). Première brique du module IA (P9-0).
 */
async function snapshotImageBlob(src: string | null): Promise<Blob | null> {
  if (!src) return null;
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
  const max = 1280;
  const sc = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * sc);
  const h = Math.round(img.naturalHeight * sc);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d")!.drawImage(img, 0, 0, w, h);
  return new Promise<Blob | null>((res) =>
    c.toBlob((b) => res(b), "image/jpeg", 0.9),
  );
}

export default function LearningPanel() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const validatedCount = useStore(
    (s) => s.annotations.filter((a) => a.status === "validated").length,
  );

  const refresh = () => countCases().then(setCount).catch(() => {});
  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (open && ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  const saveCase = async (thenReset: boolean) => {
    const s = useStore.getState();
    const validated = s.annotations.filter((a) => a.status === "validated");
    if (validated.length === 0) return;
    setSaving(true);
    try {
      const bg = s.backgrounds[s.laterality];
      const imageBlob = await snapshotImageBlob(bg.src);
      const c: TrainingCase = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        laterality: s.laterality,
        imageBlob,
        alignment: bg.src
          ? {
              fileName: bg.fileName,
              natW: bg.natW,
              natH: bg.natH,
              offsetXMm: bg.offsetXMm,
              offsetYMm: bg.offsetYMm,
              scale: bg.scale,
              rotationDeg: bg.rotationDeg,
            }
          : null,
        annotations: validated,
        embedding: null,
      };
      await recordCase(c);
      await refresh();
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1800);
      if (thenReset) {
        s.clearAll();
        s.removeBackground();
      }
    } finally {
      setSaving(false);
    }
  };

  const onExport = async () => {
    const blob = await exportDatasetJSON();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `retinasketch-dataset-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onClear = async () => {
    if (confirm("Vider tout le jeu d'entraînement local ? (irréversible)")) {
      await clearAllCases();
      await refresh();
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:text-slate-900"
        title="Apprentissage IA — jeu de données local"
      >
        <BrainIcon />
        IA
        <span className="rounded-full bg-violet-100 px-1.5 text-[11px] font-semibold text-violet-700">
          {count}
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full z-40 mt-2 w-72 rounded-xl border border-slate-200 bg-white/95 p-3 text-left shadow-xl shadow-slate-900/10 backdrop-blur"
          >
            <p className="mb-1 text-sm font-semibold text-slate-800">
              Apprentissage IA
            </p>
            <p className="mb-3 text-[11px] leading-snug text-slate-500">
              Chaque cas validé est enregistré <b>en local</b> (IndexedDB) pour
              entraîner l'IA. Rien ne quitte votre machine.
            </p>

            <div className="mb-2 flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-2 text-xs">
              <span className="text-slate-500">Cas enregistrés</span>
              <span className="font-semibold tabular-nums text-slate-900">
                {count}
              </span>
            </div>

            <button
              onClick={() => saveCase(false)}
              disabled={saving || validatedCount === 0}
              className="mb-1.5 w-full rounded-lg bg-violet-600 px-2.5 py-2 text-xs font-medium text-white transition hover:bg-violet-700 disabled:opacity-40"
            >
              {saving
                ? "Enregistrement…"
                : justSaved
                  ? "✓ Cas enregistré"
                  : `Enregistrer ce cas (${validatedCount} lésion${validatedCount > 1 ? "s" : ""})`}
            </button>
            <button
              onClick={() => saveCase(true)}
              disabled={saving || validatedCount === 0}
              className="mb-3 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
            >
              Enregistrer + patient suivant
            </button>

            <div className="flex gap-2 border-t border-slate-100 pt-2.5">
              <button
                onClick={onExport}
                disabled={count === 0}
                className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
              >
                Exporter (JSON)
              </button>
              <button
                onClick={onClear}
                disabled={count === 0}
                className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-40"
              >
                Vider
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const BrainIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5a3 3 0 0 0-6 0v.5A2.5 2.5 0 0 0 4 8a2.5 2.5 0 0 0 1 2 2.5 2.5 0 0 0 1 4.5 3 3 0 0 0 6 .5z" />
    <path d="M12 5a3 3 0 0 1 6 0v.5A2.5 2.5 0 0 1 20 8a2.5 2.5 0 0 1-1 2 2.5 2.5 0 0 1-1 4.5 3 3 0 0 1-6 .5z" />
  </svg>
);
