/**
 * RetinaSchemaSvg — rendu SVG statique du fond d'œil et des annotations
 * RetinaSketch, pour le compte rendu (impression / PDF / Word — aucune
 * dépendance Konva ici). Projette les annotations (mm, repère fovéal, convention
 * OD) vers un SVG fixe ; l'œil gauche est obtenu par miroir horizontal.
 */

import { TEMPLATE } from '../../../features/retinasketch/lib/geometry/template';
import { arcadePolylines } from '../../../features/retinasketch/lib/geometry/engine';
import { getLesion } from '../../../features/retinasketch/lib/ontology/lesions';
import type { Annotation } from '../../../features/retinasketch/lib/types';

interface Props {
  side: 'OD' | 'OG';
  annotations?: Annotation[];
}

const VB_W = 600;
const VB_H = 380;
const CX = 300;
const CY = 190;
const MARGIN = 0.9;
const PX = Math.min(
  (CX * MARGIN) / TEMPLATE.retina.halfWidthMm,
  (CY * MARGIN) / TEMPLATE.retina.halfHeightMm,
);

const DRAFT = '#94a3b8';

export default function RetinaSchemaSvg({ side, annotations = [] }: Props) {
  const mirror = side === 'OG' ? -1 : 1;
  const toX = (mx: number) => CX + mx * PX * mirror;
  const toY = (my: number) => CY + my * PX;

  const arcades = arcadePolylines();
  const validated = annotations.filter((a) => a.status === 'validated' && a.lesionId);

  const discX = toX(TEMPLATE.disc.x);
  const discY = toY(TEMPLATE.disc.y);

  // Étiquettes nasal/temporal selon l'œil (la papille est nasale).
  const nasalLabelX = toX(TEMPLATE.disc.x - 4);
  const tempLabelX = toX(9);

  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label={`Schéma rétine ${side}`}>
      {/* Contour rétinien */}
      <ellipse cx={CX} cy={CY} rx={TEMPLATE.retina.halfWidthMm * PX} ry={TEMPLATE.retina.halfHeightMm * PX} fill="none" stroke="#11262b" strokeWidth={1.4} />

      {/* Arcades vasculaires */}
      {arcades.map((line, i) => (
        <polyline
          key={i}
          points={line.map((p) => `${toX(p.x)},${toY(p.y)}`).join(' ')}
          fill="none"
          stroke="#c9d3d3"
          strokeWidth={1.3}
          strokeLinecap="round"
        />
      ))}

      {/* Anneau péripapillaire + papille */}
      <circle cx={discX} cy={discY} r={TEMPLATE.peripapillaryRadiusMm * PX} fill="none" stroke="#d8dee0" strokeDasharray="3 4" />
      <circle cx={discX} cy={discY} r={TEMPLATE.discRadiusMm * PX} fill="#cfd9dd" stroke="#aebcc1" />

      {/* Macula + fovéa */}
      <circle cx={CX} cy={CY} r={TEMPLATE.maculaRadiusMm * PX} fill="none" stroke="#dcd6cb" strokeDasharray="3 4" />
      <circle cx={CX} cy={CY} r={3} fill="#11262b" />

      {/* Annotations validées */}
      {validated.map((a) => {
        const color = getLesion(a.lesionId)?.color ?? DRAFT;
        if (a.kind === 'point') {
          const r = Math.max(3, (a.radiusMm ?? 0.5) * PX);
          return <circle key={a.id} cx={toX(a.points[0])} cy={toY(a.points[1])} r={r} fill={color} fillOpacity={0.85} stroke={color} strokeWidth={1.2} />;
        }
        let d = '';
        for (let i = 0; i < a.points.length; i += 2) {
          d += `${i === 0 ? 'M' : 'L'}${toX(a.points[i]).toFixed(1)} ${toY(a.points[i + 1]).toFixed(1)} `;
        }
        d += 'Z';
        return <path key={a.id} d={d} fill={hexToRgba(color, 0.28)} stroke={color} strokeWidth={1.6} />;
      })}

      {/* Étiquettes anatomiques */}
      <text x={nasalLabelX} y={CY - 4} textAnchor="middle" fontSize={11} fill="#9aa6ab">Rétine nasale</text>
      <text x={tempLabelX} y={CY - 4} textAnchor="middle" fontSize={11} fill="#9aa6ab">Rétine temporale</text>
      <text x={discX} y={discY + TEMPLATE.peripapillaryRadiusMm * PX + 14} textAnchor="middle" fontSize={11} fill="#7d8e94">Papille</text>
      <text x={CX} y={CY + TEMPLATE.maculaRadiusMm * PX + 14} textAnchor="middle" fontSize={11} fill="#7d8e94">Macula</text>
    </svg>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  if (h.length < 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Liste dédupliquée des lésions présentes (pour la légende). */
export function lesionLegend(annotations: Annotation[] = []): { id: string; name: string; color: string }[] {
  const seen = new Map<string, { id: string; name: string; color: string }>();
  for (const a of annotations) {
    if (a.status !== 'validated' || !a.lesionId) continue;
    const l = getLesion(a.lesionId);
    if (l && !seen.has(l.id)) seen.set(l.id, { id: l.id, name: l.name, color: l.color });
  }
  return [...seen.values()];
}
