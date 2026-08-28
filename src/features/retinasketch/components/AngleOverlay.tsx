import { useRef, useState } from "react";
import { useStore } from "@/features/retinasketch/store/useStore";
import { computeAngleDeg, shafferFromAngle, type Pt } from "@/features/retinasketch/lib/geometry/angle";

interface Props {
  width: number;
  height: number;
}

/**
 * Outil de mesure de l'angle iridocornéen (template angle IC), en vue mono.
 * L'utilisateur pose 3 points : apex (éperon scléral) puis 2 points le long des
 * parois. L'angle est calculé et la classe de Shaffer proposée (modifiable via
 * le bandeau sous l'image). Les points sont stockés en fractions de la largeur
 * du panneau (redessin robuste au redimensionnement).
 */
export default function AngleOverlay({ width, height }: Props) {
  const laterality = useStore((s) => s.laterality);
  // Actif seulement si le slot affiché est un angle IC.
  const isAngle = useStore((s) => {
    const id = s.activeSlot[laterality];
    return s.slots[laterality].find((sl) => sl.id === id)?.kind === "angle";
  });
  const measure = useStore((s) => s.angleMeasure[laterality]);
  const setAngleMeasure = useStore((s) => s.setAngleMeasure);

  const ref = useRef<HTMLDivElement>(null);
  const [armed, setArmed] = useState(false);
  const [pending, setPending] = useState<Pt[]>([]);

  if (!isAngle || width === 0) return null;

  const toFrac = (p: Pt): Pt => [p[0] / width, p[1] / width];
  const fromFrac = (p: Pt): Pt => [p[0] * width, p[1] * width];

  const onClick = (e: React.MouseEvent) => {
    if (!armed) return;
    const rect = ref.current!.getBoundingClientRect();
    const p: Pt = [e.clientX - rect.left, e.clientY - rect.top];
    const next = [...pending, p];
    if (next.length < 3) {
      setPending(next);
      return;
    }
    const [apex, armA, armB] = next;
    const angleDeg = computeAngleDeg(apex, armA, armB);
    setAngleMeasure({ apex: toFrac(apex), armA: toFrac(armA), armB: toFrac(armB), angleDeg }, laterality);
    setPending([]);
    setArmed(false);
  };

  // Points à dessiner : mesure enregistrée, sinon points en cours de pose.
  const drawn: Pt[] = measure
    ? [fromFrac(measure.apex), fromFrac(measure.armA), fromFrac(measure.armB)]
    : pending;
  const [apex, armA, armB] = drawn;
  const shaffer = measure ? shafferFromAngle(measure.angleDeg) : null;

  const startNew = () => {
    setAngleMeasure(null, laterality);
    setPending([]);
    setArmed(true);
  };

  return (
    <div
      ref={ref}
      onClick={onClick}
      className={`absolute inset-0 z-[26] ${armed ? "cursor-crosshair" : "pointer-events-none"}`}
    >
      <svg width={width} height={height} className="absolute inset-0">
        {apex && armA && (
          <line x1={apex[0]} y1={apex[1]} x2={armA[0]} y2={armA[1]} stroke="#f59e0b" strokeWidth={2} />
        )}
        {apex && armB && (
          <line x1={apex[0]} y1={apex[1]} x2={armB[0]} y2={armB[1]} stroke="#f59e0b" strokeWidth={2} />
        )}
        {drawn.map((p, i) => (
          <circle
            key={i}
            cx={p[0]}
            cy={p[1]}
            r={i === 0 ? 6 : 5}
            fill={i === 0 ? "#dc2626" : "#f59e0b"}
            stroke="#fff"
            strokeWidth={1.5}
          />
        ))}
      </svg>

      {/* Bandeau de contrôle (toujours cliquable) — en bas pour ne pas masquer
          l'étiquette d'œil ni la zone de mesure. */}
      <div className="pointer-events-auto absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-xl">
        {armed ? (
          <span className="text-xs text-amber-200">
            {pending.length === 0 && "Cliquez l'apex (éperon scléral)"}
            {pending.length === 1 && "Cliquez la 1ʳᵉ paroi"}
            {pending.length === 2 && "Cliquez la 2ᵉ paroi"}
          </span>
        ) : measure ? (
          <span className="text-xs">
            Angle <b className="text-amber-300">{measure.angleDeg}°</b>
            {shaffer != null && <> · Shaffer <b className="text-amber-300">{shaffer}</b></>}
          </span>
        ) : (
          <span className="text-xs text-white/80">Aucune mesure</span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            startNew();
          }}
          className="pointer-events-auto rounded-full bg-white/15 px-2 py-0.5 text-xs hover:bg-white/25"
        >
          {measure || pending.length ? "Recommencer" : "Mesurer l'angle"}
        </button>
      </div>
    </div>
  );
}
