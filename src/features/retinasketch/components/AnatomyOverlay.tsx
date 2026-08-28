
import { useRef } from "react";
import { useStore } from "@/features/retinasketch/store/useStore";
import type { Laterality } from "@/features/retinasketch/lib/types";
import { mirrorFor } from "@/features/retinasketch/lib/geometry/template";
import { designViewport, screenToImagePx, imagePxToScreen } from "@/features/retinasketch/lib/geometry/project";
import { ellipseToPolygon } from "@/features/retinasketch/lib/vision/anatomy";

interface Props {
  eye: Laterality;
  width: number;
  height: number;
}

type Handle = "disc" | "discR" | "macula" | "maculaR";

/**
 * ÉDITION de l'anatomie détectée (papille + macula) : poignées à la souris —
 * déplacer la papille, la redimensionner, déplacer la macula. Les corrections
 * sont écrites en pixels image dans le store (source « manual » = sauvegardées).
 * Overlay de précision (vue mono), comme `AlignOverlay`/`AdjustImageOverlay`.
 */
export default function AnatomyOverlay({ eye, width, height }: Props) {
  const anatomyEdit = useStore((s) => s.anatomyEdit);
  const setAnatomyEdit = useStore((s) => s.setAnatomyEdit);
  const bg = useStore((s) => s.backgrounds[eye]);
  const anatomy = useStore((s) => s.anatomy[eye]);
  const view = useStore((s) => s.views[eye]);
  const patchDisc = useStore((s) => s.patchAnatomyDisc);
  const patchMacula = useStore((s) => s.patchAnatomyMacula);
  const setDiscPolygon = useStore((s) => s.setDiscPolygon);

  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<Handle | null>(null);
  // Édition de FORME : index du sommet en cours de glissement (-1 = aucun) et
  // copie de travail du contour (créée au démarrage du glissement).
  const vDrag = useRef<number>(-1);
  const polyRef = useRef<number[]>([]);

  // Poignées affichées uniquement en mode ÉDITION (auto-activé après la détection,
  // ou via « Ajuster ») → l'overlay ne bloque jamais le dessin hors édition. Rendu
  // PAR ŒIL : ajustement des deux yeux en vue double, sans passer en mono.
  if (!anatomyEdit || !bg.src || !anatomy) return null;

  const mirror = mirrorFor(eye);
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
  // Papille et macula sont INDÉPENDANTES : on n'affiche les poignées que pour
  // celle(s) réellement détectée(s).
  const disc = anatomy.disc;
  const macula = anatomy.macula;
  const discC = disc ? toScreenPt(disc.cx, disc.cy) : null;
  const discEdge = disc ? toScreenPt(disc.cx + disc.rx, disc.cy) : null;
  const maculaC = macula ? toScreenPt(macula.cx, macula.cy) : null;
  const maculaEdge = macula ? toScreenPt(macula.cx + macula.r, macula.cy) : null;

  // Contour éditable de la papille : polygone IA si présent, sinon polygone dérivé
  // de l'ellipse (repli) → des poignées de FORME sont toujours disponibles.
  const editPoly = disc ? (disc.polygon ?? ellipseToPolygon(disc)) : [];
  const vertScreen: { x: number; y: number }[] = [];
  for (let i = 0; i < editPoly.length; i += 2) {
    vertScreen.push(toScreenPt(editPoly[i], editPoly[i + 1]));
  }

  const imgPt = (e: React.MouseEvent) => {
    const rect = ref.current!.getBoundingClientRect();
    return screenToImagePx(e.clientX - rect.left, e.clientY - rect.top, bgT, vp, view);
  };

  const onMove = (e: React.MouseEvent) => {
    // Édition de forme : glissement d'un sommet du contour.
    if (vDrag.current >= 0) {
      const p = imgPt(e);
      const poly = polyRef.current;
      poly[vDrag.current * 2] = p.x;
      poly[vDrag.current * 2 + 1] = p.y;
      setDiscPolygon(eye, poly.slice());
      return;
    }
    if (!drag.current) return;
    const p = imgPt(e);
    if (drag.current === "disc") {
      patchDisc(eye, { cx: p.x, cy: p.y });
    } else if (drag.current === "discR") {
      if (!disc) return;
      // Redimensionnement proportionnel : on préserve le rapport d'axes mesuré.
      const oldRx = disc.rx || 4;
      const newRx = Math.max(4, Math.hypot(p.x - disc.cx, p.y - disc.cy));
      const k = newRx / oldRx;
      patchDisc(eye, { rx: newRx, ry: Math.max(2, disc.ry * k) });
    } else if (drag.current === "maculaR") {
      if (!macula) return;
      // Rayon de la macula = distance au centre (borné pour rester exploitable).
      patchMacula(eye, { r: Math.max(4, Math.hypot(p.x - macula.cx, p.y - macula.cy)) });
    } else {
      patchMacula(eye, { cx: p.x, cy: p.y });
    }
  };

  const start = (h: Handle) => (e: React.MouseEvent) => {
    e.stopPropagation();
    drag.current = h;
  };
  const startVertex = (i: number) => (e: React.MouseEvent) => {
    e.stopPropagation();
    vDrag.current = i;
    polyRef.current = editPoly.slice(); // copie de travail (crée le contour si repli ellipse)
  };
  const end = () => {
    drag.current = null;
    vDrag.current = -1;
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseUp={end}
      onMouseLeave={end}
      className="absolute inset-0 z-[25]"
    >
      {/* Papille : poignées de FORME (par sommet) + redimensionner + déplacer */}
      {disc && discC && discEdge && (
        <>
          {vertScreen.map((v, i) => (
            <VertexKnob key={i} x={v.x} y={v.y} onDown={startVertex(i)} />
          ))}
          <Knob x={discEdge.x} y={discEdge.y} color="#16a34a" small onDown={start("discR")} title="Redimensionner la papille" />
          <Knob x={discC.x} y={discC.y} color="#16a34a" onDown={start("disc")} title="Déplacer la papille" label="P" />
        </>
      )}
      {/* Macula : poignée de déplacement + poignée de taille (rayon) */}
      {macula && maculaC && (
        <Knob x={maculaC.x} y={maculaC.y} color="#a855f7" onDown={start("macula")} title="Déplacer la macula" label="M" />
      )}
      {macula && maculaEdge && (
        <Knob x={maculaEdge.x} y={maculaEdge.y} color="#a855f7" small onDown={start("maculaR")} title="Redimensionner la macula" />
      )}

      {/* Bandeau de consigne (uniquement en mode édition explicite). */}
      {anatomyEdit && (
        <div className="pointer-events-none absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-900/90 px-3 py-1.5 text-xs font-medium text-white shadow-xl">
          <span className="text-white/80">
            <b className="text-emerald-300">P</b> papille · <b className="text-violet-300">M</b> macula — glissez pour ajuster
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setAnatomyEdit(false);
            }}
            className="pointer-events-auto ml-1 rounded-full bg-white/15 px-2 py-0.5 hover:bg-white/25"
          >
            Terminer · Entrée
          </button>
        </div>
      )}
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

/** Petite poignée de sommet (édition de forme de la papille). */
function VertexKnob({ x, y, onDown }: { x: number; y: number; onDown: (e: React.MouseEvent) => void }) {
  return (
    <button
      title="Déformer le contour de la papille"
      onMouseDown={onDown}
      className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border border-white bg-emerald-500 shadow-sm hover:scale-125 active:cursor-grabbing"
      style={{ left: x, top: y }}
    />
  );
}
