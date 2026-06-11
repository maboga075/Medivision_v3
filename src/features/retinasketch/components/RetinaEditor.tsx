import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { useStore } from "../store/useStore";
import type { Annotation } from "../lib/types";
import FloatingControls from "./FloatingControls";
import InfoPanel from "./InfoPanel";
import DraftBar from "./DraftBar";
import CommandPalette from "./CommandPalette";

// Konva nécessite le DOM : chargement paresseux à l'ouverture de l'éditeur.
const RetinaStage = lazy(() => import("./RetinaStage"));

interface RetinaEditorProps {
  side: "OD" | "OG";
  value: Annotation[];
  onChange: (annotations: Annotation[]) => void;
}

/**
 * Éditeur RetinaSketch contrôlé, destiné à être monté dans une modale par œil.
 * Amorce le store au montage avec `value`, verrouille la latéralité sur `side`,
 * et remonte toute modification via `onChange`.
 */
export default function RetinaEditor({ side, value, onChange }: RetinaEditorProps) {
  const setPaletteOpen = useStore((s) => s.setPaletteOpen);
  const paletteOpen = useStore((s) => s.paletteOpen);
  const annotations = useStore((s) => s.annotations);
  const draftCount = annotations.filter((a) => a.status === "draft").length;

  const stageRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const mounted = useRef(false);

  // Amorçage unique au montage (la modale est remontée à chaque ouverture).
  useEffect(() => {
    useStore.getState().setLaterality(side === "OD" ? "OD" : "OS");
    useStore.getState().loadAnnotations(value);
    mounted.current = true;
    return () => {
      mounted.current = false;
      useStore.getState().resetAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Remontée des modifications vers le parent (après amorçage).
  useEffect(() => {
    if (mounted.current) onChange(annotations);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotations]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    // Mesure initiale synchrone : ne pas dépendre du seul premier tick (async)
    // du ResizeObserver, qui peut tarder à l'ouverture de la modale.
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setSize({ w: Math.floor(rect.width), h: Math.floor(rect.height) });
    }
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ w: Math.floor(width), h: Math.floor(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing =
        e.target instanceof HTMLElement &&
        ["INPUT", "TEXTAREA"].includes(e.target.tagName);
      if (typing) return;
      if ((e.key === "/" || e.key === "Enter") && draftCount > 0) {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (e.key === "Escape" && paletteOpen) {
        e.preventDefault();
        setPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPaletteOpen, paletteOpen, draftCount]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-white text-slate-900">
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-4 py-2 text-xs text-slate-400">
        <span className="rounded bg-slate-900 px-2 py-0.5 font-semibold text-white">
          {side === "OD" ? "Œil droit" : "Œil gauche"}
        </span>
        <span className="hidden sm:inline">
          Clic = spot · clic glissé = surface ·{" "}
          <kbd className="rounded bg-slate-100 px-1">Espace</kbd> = diamètre · re-clic = effacer ·{" "}
          <kbd className="rounded bg-slate-100 px-1">↵</kbd> = identifier
        </span>
      </div>

      <div className="relative min-h-0 flex-1 bg-white">
        <div ref={stageRef} className="absolute inset-0">
          <Suspense
            fallback={
              <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">
                Chargement du schéma…
              </div>
            }
          >
            {size.w > 0 && <RetinaStage width={size.w} height={size.h} />}
          </Suspense>
        </div>

        <FloatingControls hideLaterality />
        <InfoPanel />
        <DraftBar />
      </div>

      <CommandPalette />
    </div>
  );
}
