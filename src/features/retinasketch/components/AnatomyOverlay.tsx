
import { useEffect, useRef } from "react";
import { useStore } from "@/features/retinasketch/store/useStore";
import { mirrorFor } from "@/features/retinasketch/lib/geometry/template";
import { designViewport, screenToImagePx, imagePxToScreen } from "@/features/retinasketch/lib/geometry/project";

interface Props {
  width: number;
  height: number;
}

type Handle = "disc" | "discR" | "macula";

/**
 * ÉDITION de l'anatomie détectée (papille + macula) : poignées à la souris —
 * déplacer la papille, la redimensionner, déplacer la macula. Les corrections
 * sont écrites en pixels image dans le store (source « manual » = sauvegardées).
 * Overlay de précision (vue mono), comme `AlignOverlay`/`AdjustImageOverlay`.
 */
export default function AnatomyOverlay({ width, height }: Props) {
  const anatomyEdit = useStore((s) => s.anatomyEdit);
  const setAnatomyEdit = useStore((s) => s.setAnatomyEdit);
  const laterality = useStore((s) => s.laterality);
  const bg = useStore((s) => s.backgrounds[s.laterality]);
  const anatomy = useStore((s) => s.anatomy[s.laterality]);
  const view = useStore((s) => s.views[s.laterality]);
  const patchDisc = useStore((s) => s.patchAnatomyDisc);
  const patchMacula = useStore((s) => s.patchAnatomyMacula);

  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<Handle | null>(null);

  useEffect(() => {
    if (!anatomyEdit) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAnatomyEdit(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [anatomyEdit, setAnatomyEdit]);

  if (!anatomyEdit || !bg.src || !anatomy) return null;

  const mirror = mirrorFor(laterality);
  const vp = designViewport(width, height, mirror);
  const bgT = {
    natW: anatomy.natW,
    natH: anatomy.natH,
    offsetXMm: bg.offsetXMm,
    offsetYMm: bg.offsetYMm,
    scale: bg.scale,
    rotationDeg: bg.rotationDeg,
  };

  const toScreenPt = (px: number, py: number) => imagePxToScreen(px, py, bgT, vp, view);
  const discC = toScreenPt(anatomy.disc.cx, anatomy.disc.cy);
  const discEdge = toScreenPt(anatomy.disc.cx + anatomy.disc.rx, anatomy.disc.cy);
  const maculaC = toScreenPt(anatomy.macula.cx, anatomy.macula.cy);

  const imgPt = (e: React.MouseEvent) => {
    const rect = ref.current!.getBoundingClientRect();
    return screenToImagePx(e.clientX - rect.left, e.clientY - rect.top, bgT, vp, view);
  };

  const onMove = (e: React.MouseEvent) => {
    if (!drag.current) return;
    const p = imgPt(e);
    if (drag.current === "disc") {
      patchDisc(laterality, { cx: p.x, cy: p.y });
    } else if (drag.current === "discR") {
      // Redimensionnement proportionnel : on préserve le rapport d'axes mesuré.
      const oldRx = anatomy.disc.rx || 4;
      const newRx = Math.max(4, Math.hypot(p.x - anatomy.disc.cx, p.y - anatomy.disc.cy));
      const k = newRx / oldRx;
      patchDisc(laterality, { rx: newRx, ry: Math.max(2, anatomy.disc.ry * k) });
    } else {
      patchMacula(laterality, { cx: p.x, cy: p.y });
    }
  };

  const start = (h: Handle) => (e: React.MouseEvent) => {
    e.stopPropagation();
    drag.current = h;
  };
  const end = () => {
    drag.current = null;
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseUp={end}
      onMouseLeave={end}
      className="absolute inset-0 z-[25]"
    >
      {/* Poignée de redimensionnement de la papille */}
      <Knob x={discEdge.x} y={discEdge.y} color="#16a34a" small onDown={start("discR")} title="Redimensionner la papille" />
      {/* Poignée de déplacement de la papille */}
      <Knob x={discC.x} y={discC.y} color="#16a34a" onDown={start("disc")} title="Déplacer la papille" label="P" />
      {/* Poignée de déplacement de la macula */}
      <Knob x={maculaC.x} y={maculaC.y} color="#a855f7" onDown={start("macula")} title="Déplacer la macula" label="M" />

      {/* Bandeau de consigne */}
      <div className="pointer-events-none absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-3 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-xl">
        <span className="text-xs text-white/80">
          Papille <b className="text-emerald-300">P</b> · Macula <b className="text-violet-300">M</b> — glissez pour ajuster
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setAnatomyEdit(false);
          }}
          className="pointer-events-auto ml-1 rounded-full bg-white/15 px-2 py-0.5 text-xs hover:bg-white/25"
        >
          Terminer · Échap
        </button>
      </div>
    </div>
  );
}

function Knob({
  x,
  y,
  color,
  label,
  small,
  title,
  onDown,
}: {
  x: number;
  y: number;
  color: string;
  label?: string;
  small?: boolean;
  title: string;
  onDown: (e: React.MouseEvent) => void;
}) {
  const s = small ? 14 : 22;
  return (
    <button
      title={title}
      onMouseDown={onDown}
      className="absolute -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 border-white text-[10px] font-bold text-white shadow-md active:cursor-grabbing"
      style={{ left: x, top: y, width: s, height: s, backgroundColor: color }}
    >
      {label}
    </button>
  );
}
