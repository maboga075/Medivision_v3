
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/features/retinasketch/store/useStore";
import { createViewport } from "@/features/retinasketch/lib/geometry/template";

interface Props {
  width: number;
  height: number;
}

const IMG_MIN_SCALE = 0.1;
const IMG_MAX_SCALE = 10;
/** Sensibilité du zoom image à la molette (plus petit = plus doux). */
const IMG_ZOOM_SENSITIVITY = 0.0012;
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Contrôle direct de la rétinographie à la souris (remplace les sliders X/Y/zoom) :
 *   - glisser            → déplacer l'image
 *   - molette            → zoom de l'image, centré sur le curseur
 *   - Maj + glisser      → rotation autour du centre de l'image
 * Le calage auto et le pointage des repères restent disponibles par ailleurs.
 */
export default function AdjustImageOverlay({ width, height }: Props) {
  const adjustImage = useStore((s) => s.adjustImage);
  const setAdjustImage = useStore((s) => s.setAdjustImage);
  const bg = useStore((s) => s.backgrounds[s.laterality]);
  const updateBackground = useStore((s) => s.updateBackground);
  const view = useStore((s) => s.views[s.laterality]);

  const ref = useRef<HTMLDivElement>(null);
  // Outil courant : déplacer ou pivoter (le drag suit ce mode ; Maj force « pivoter »).
  const [tool, setTool] = useState<"move" | "rotate">("move");
  const drag = useRef<{
    active: boolean;
    mode: "move" | "rotate";
    sx: number;
    sy: number;
    ox: number;
    oy: number;
    rot: number;
    startAngle: number;
  } | null>(null);

  useEffect(() => {
    if (!adjustImage) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAdjustImage(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [adjustImage, setAdjustImage]);

  if (!adjustImage || !bg.src) return null;

  const { pxPerMm } = createViewport(width, height, 1);
  const cx = width / 2;
  const cy = height / 2;

  const angleFromCenter = (clientX: number, clientY: number) => {
    const rect = ref.current!.getBoundingClientRect();
    const dvx = (clientX - rect.left - view.x) / view.scale;
    const dvy = (clientY - rect.top - view.y) / view.scale;
    const centerX = cx + bg.offsetXMm * pxPerMm;
    const centerY = cy + bg.offsetYMm * pxPerMm;
    return (Math.atan2(dvy - centerY, dvx - centerX) * 180) / Math.PI;
  };

  const onMouseDown = (e: React.MouseEvent) => {
    drag.current = {
      active: true,
      mode: e.shiftKey || tool === "rotate" ? "rotate" : "move",
      sx: e.clientX,
      sy: e.clientY,
      ox: bg.offsetXMm,
      oy: bg.offsetYMm,
      rot: bg.rotationDeg,
      startAngle: angleFromCenter(e.clientX, e.clientY),
    };
  };

  const onMouseMove = (e: React.MouseEvent) => {
    const d = drag.current;
    if (!d?.active) return;
    if (d.mode === "move") {
      const ddx = (e.clientX - d.sx) / view.scale / pxPerMm;
      const ddy = (e.clientY - d.sy) / view.scale / pxPerMm;
      updateBackground({ offsetXMm: d.ox + ddx, offsetYMm: d.oy + ddy });
    } else {
      const a = angleFromCenter(e.clientX, e.clientY);
      updateBackground({ rotationDeg: d.rot + (a - d.startAngle) });
    }
  };

  const endDrag = () => {
    if (drag.current) drag.current.active = false;
  };

  // Molette → zoom de l'image en gardant fixe le point sous le curseur.
  const onWheel = (e: React.WheelEvent) => {
    const rect = ref.current!.getBoundingClientRect();
    const mx = (e.clientX - rect.left - view.x) / view.scale; // design px
    const my = (e.clientY - rect.top - view.y) / view.scale;
    const sOld = bg.scale || 1;
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    const dy = Math.max(-60, Math.min(60, e.deltaY * unit));
    const sNew = clamp(sOld * Math.exp(-dy * IMG_ZOOM_SENSITIVITY), IMG_MIN_SCALE, IMG_MAX_SCALE);
    const tx = bg.offsetXMm * pxPerMm;
    const ty = bg.offsetYMm * pxPerMm;
    const r = sNew / sOld;
    const txNew = mx - cx - r * (mx - cx - tx);
    const tyNew = my - cy - r * (my - cy - ty);
    updateBackground({
      scale: sNew,
      offsetXMm: txNew / pxPerMm,
      offsetYMm: tyNew / pxPerMm,
    });
  };

  return (
    <div
      ref={ref}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
      onWheel={onWheel}
      className={`absolute inset-0 z-[25] ${tool === "rotate" ? "cursor-grab" : "cursor-move"}`}
    >
      <div className="pointer-events-none absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-xl">
        {/* Sélecteur d'outil : déplacer / pivoter */}
        <div className="pointer-events-auto flex rounded-full bg-white/10 p-0.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setTool("move");
            }}
            className={`rounded-full px-2.5 py-0.5 text-xs transition ${
              tool === "move" ? "bg-white text-slate-900" : "text-white/80 hover:text-white"
            }`}
          >
            Déplacer
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setTool("rotate");
            }}
            className={`rounded-full px-2.5 py-0.5 text-xs transition ${
              tool === "rotate" ? "bg-white text-slate-900" : "text-white/80 hover:text-white"
            }`}
          >
            Pivoter
          </button>
        </div>
        <span className="text-xs text-white/70">molette = zoom</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setAdjustImage(false);
          }}
          className="pointer-events-auto ml-1 rounded-full bg-white/15 px-2 py-0.5 text-xs hover:bg-white/25"
        >
          Terminer · Échap
        </button>
      </div>
    </div>
  );
}
