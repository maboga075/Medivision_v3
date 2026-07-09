
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/features/retinasketch/store/useStore";
import { TEMPLATE, createViewport, mirrorFor } from "@/features/retinasketch/lib/geometry/template";
import { solveAlignment, type Landmarks } from "@/features/retinasketch/lib/geometry/align";

interface Props {
  width: number;
  height: number;
}

/**
 * Pointage manuel des repères : le clinicien clique la fovéa puis la papille
 * sur la photo ; on en déduit l'alignement exact (similitude à 2 points).
 * Filet de secours du calage automatique heuristique.
 */
export default function AlignOverlay({ width, height }: Props) {
  const pointing = useStore((s) => s.pointing);
  const setPointing = useStore((s) => s.setPointing);
  const laterality = useStore((s) => s.laterality);
  const bg = useStore((s) => s.backgrounds[s.laterality]);
  const updateBackground = useStore((s) => s.updateBackground);
  const view = useStore((s) => s.views[s.laterality]);

  const ref = useRef<HTMLDivElement>(null);
  const [fovea, setFovea] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!pointing) setFovea(null);
  }, [pointing]);

  useEffect(() => {
    if (!pointing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPointing(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pointing, setPointing]);

  if (!pointing || !bg.src || !bg.natW || !bg.natH) return null;

  const mirror = mirrorFor(laterality);
  const vp = createViewport(width, height, mirror);
  const boxW = 2 * TEMPLATE.retina.halfWidthMm * vp.pxPerMm;
  const boxH = 2 * TEMPLATE.retina.halfHeightMm * vp.pxPerMm;
  const k = Math.max(boxW / bg.natW, boxH / bg.natH); // « cover » : px écran / px source (base)
  const tx = bg.offsetXMm * vp.pxPerMm;
  const ty = bg.offsetYMm * vp.pxPerMm;
  const theta = (bg.rotationDeg * Math.PI) / 180;
  const s = bg.scale || 1;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);

  // Écran → pixel source : on défait d'abord la vue (zoom/pan) puis le transform
  // de l'image appliqué par BackgroundImage.
  const screenToImage = (sx: number, sy: number) => {
    const dvx = (sx - view.x) / view.scale;
    const dvy = (sy - view.y) / view.scale;
    const ux = dvx - vp.cx - tx;
    const uy = dvy - vp.cy - ty;
    const dx = (cos * ux + sin * uy) / s; // (1/s)·Rot(-θ)
    const dy = (-sin * ux + cos * uy) / s;
    return { x: bg.natW / 2 + dx / k, y: bg.natH / 2 + dy / k };
  };

  // Pixel source → écran (pour afficher le marqueur de la fovéa pointée).
  const imageToScreen = (p: { x: number; y: number }) => {
    const rx = (p.x - bg.natW / 2) * k;
    const ry = (p.y - bg.natH / 2) * k;
    const dx = vp.cx + s * (cos * rx - sin * ry) + tx;
    const dy = vp.cy + s * (sin * rx + cos * ry) + ty;
    return { x: view.x + view.scale * dx, y: view.y + view.scale * dy };
  };

  const onClick = (e: React.MouseEvent) => {
    const rect = ref.current!.getBoundingClientRect();
    const p = screenToImage(e.clientX - rect.left, e.clientY - rect.top);
    if (!fovea) {
      setFovea(p);
      return;
    }
    const marks: Landmarks = { foveaPx: fovea, discPx: p };
    updateBackground({ ...solveAlignment(marks, bg.natW, bg.natH, mirror) });
    setPointing(false);
  };

  const foveaScreen = fovea ? imageToScreen(fovea) : null;

  return (
    <div ref={ref} onClick={onClick} className="absolute inset-0 z-[25] cursor-crosshair">
      {/* Marqueur de la fovéa déjà pointée */}
      {foveaScreen && (
        <span
          className="pointer-events-none absolute -ml-2 -mt-2 h-4 w-4 rounded-full border-2 border-amber-400 bg-amber-400/30"
          style={{ left: foveaScreen.x, top: foveaScreen.y }}
        />
      )}

      {/* Bandeau de consigne */}
      <div className="pointer-events-none absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-3 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-xl">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/15 text-xs">
          {fovea ? "2" : "1"}
        </span>
        {fovea
          ? "Cliquez la papille (centre du nerf optique)"
          : "Cliquez la fovéa (centre de la macula)"}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setPointing(false);
          }}
          className="pointer-events-auto ml-1 rounded-full bg-white/15 px-2 py-0.5 text-xs hover:bg-white/25"
        >
          Annuler · Échap
        </button>
      </div>
    </div>
  );
}
