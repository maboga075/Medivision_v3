
import { useEffect, useRef } from "react";
import { useStore } from "@/features/retinasketch/store/useStore";
import { mirrorFor } from "@/features/retinasketch/lib/geometry/template";
import { designViewport, screenToImagePx, imagePxToScreen } from "@/features/retinasketch/lib/geometry/project";
import { ellipseToPolygon } from "@/features/retinasketch/lib/vision/anatomy";

interface Props {
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
export default function AnatomyOverlay({ width, height }: Props) {
  const anatomyEdit = useStore((s) => s.anatomyEdit);
  const setAnatomyEdit = useStore((s) => s.setAnatomyEdit);
  // Les poignées apparaissent aussi quand la couche « Zones anatomiques » est
  // active : correction dynamique du centre papille/macula sans passer par
  // « Ajuster » (demande praticien).
  const layerAnatomy = useStore((s) => s.layers.anatomy);
  const laterality = useStore((s) => s.laterality);
  const bg = useStore((s) => s.backgrounds[s.laterality]);
  const anatomy = useStore((s) => s.anatomy[s.laterality]);
  const view = useStore((s) => s.views[s.laterality]);
  const patchDisc = useStore((s) => s.patchAnatomyDisc);
  const patchMacula = useStore((s) => s.patchAnatomyMacula);
  const setDiscPolygon = useStore((s) => s.setDiscPolygon);

  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<Handle | null>(null);
  // Édition de FORME : index du sommet en cours de glissement (-1 = aucun) et
  // copie de travail du contour (créée au démarrage du glissement).
  const vDrag = useRef<number>(-1);
  const polyRef = useRef<number[]>([]);

  // Actif si l'édition explicite est demandée, OU si la couche anatomie est
  // affichée (poignées de correction dynamique).
  const active = anatomyEdit || layerAnatomy;

  useEffect(() => {
    if (!anatomyEdit) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAnatomyEdit(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [anatomyEdit, setAnatomyEdit]);

  if (!active || !bg.src || !anatomy) return null;

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
      setDiscPolygon(laterality, poly.slice());
      return;
    }
    if (!drag.current) return;
    const p = imgPt(e);
    if (drag.current === "disc") {
      patchDisc(laterality, { cx: p.x, cy: p.y });
    } else if (drag.current === "discR") {
      if (!disc) return;
      // Redimensionnement proportionnel : on préserve le rapport d'axes mesuré.
      const oldRx = disc.rx || 4;
      const newRx = Math.max(4, Math.hypot(p.x - disc.cx, p.y - disc.cy));
      const k = newRx / oldRx;
      patchDisc(laterality, { rx: newRx, ry: Math.max(2, disc.ry * k) });
    } else if (drag.current === "maculaR") {
      if (!macula) return;
      // Rayon de la macula = distance au centre (borné pour rester exploitable).
      patchMacula(laterality, { r: Math.max(4, Math.hypot(p.x - macula.cx, p.y - macula.cy)) });
    } else {
      patchMacula(laterality, { cx: p.x, cy: p.y });
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

      {/* Bandeau de consigne */}
      <div className="pointer-events-none absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-3 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-xl">
        <span className="text-xs text-white/80">
          Papille <b className="text-emerald-300">P</b> (déplacer) · points verts = forme · Macula <b className="text-violet-300">M</b> — glissez pour ajuster
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
