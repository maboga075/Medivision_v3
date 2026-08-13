/**
 * RetinaSchemaSvg — rendu SVG statique du fond d'œil et des annotations
 * RetinaSketch, pour le compte rendu (impression / PDF / Word — aucune
 * dépendance Konva ici). Projette les annotations (mm, repère fovéal, convention
 * OD) vers un SVG fixe ; l'œil gauche est obtenu par miroir horizontal.
 *
 * Fidélité éditeur (V3) : si une rétinographie réelle a été importée, elle est
 * affichée en fond (clip circulaire + alignement + colorimétrie identiques), et
 * les calques activés/désactivés dans l'éditeur sont reproduits à l'identique.
 */

import { TEMPLATE, mirrorFor } from '../../../features/retinasketch/lib/geometry/template';
import { arcadePolylines } from '../../../features/retinasketch/lib/geometry/engine';
import { getLesion } from '../../../features/retinasketch/lib/ontology/lesions';
import { displayFilterCss, isNeutralTone } from '../../../features/retinasketch/lib/image/filters';
import { ImageFilterDef } from '../../../features/retinasketch/components/RetinaImageFilters';
import type { Annotation } from '../../../features/retinasketch/lib/types';
import type { RetinaBackgroundSnapshot, RetinaLayers } from '../../../types/clinical';

interface Props {
  side: 'OD' | 'OG';
  annotations?: Annotation[];
  background?: RetinaBackgroundSnapshot | null;
  layers?: RetinaLayers;
  /** Opacité globale des annotations (0.2..1). Défaut 1 (rétrocompatible). */
  annotationOpacity?: number;
}

/** Taille de la tête de flèche (mm) — identique à l'éditeur (ARROW_HEAD_MM). */
const ARROW_HEAD_MM = 0.7;

// Champ rétinien circulaire (~50°) : viewBox quasi carré pour exploiter pleinement
// l'espace et agrandir le schéma dans le compte rendu.
const VB_W = 440;
const VB_H = 400;
const CX = 220;
const CY = 200;
const MARGIN = 0.94;
const PX = Math.min(
  (CX * MARGIN) / TEMPLATE.retina.halfWidthMm,
  (CY * MARGIN) / TEMPLATE.retina.halfHeightMm,
);
const FIELD_R = TEMPLATE.retina.halfWidthMm * PX;

const DRAFT = '#94a3b8';

// Calques par défaut du mode « hérité » (rapports d'avant la persistance des
// calques) : on conserve le schéma historique (arcades + papille + macula + labels).
const LEGACY_LAYERS: RetinaLayers = {
  anatomy: true,
  vessels: true,
  quadrants: false,
  fovea: false,
  etdrs: false,
  periphery: false,
};

export default function RetinaSchemaSvg({ side, annotations = [], background = null, layers, annotationOpacity = 1 }: Props) {
  // Convention clinicien : OD → papille à droite (mirror -1), OG → papille à gauche (+1).
  const mirror = mirrorFor(side);
  const toX = (mx: number) => CX + mx * PX * mirror;
  const toY = (my: number) => CY + my * PX;

  // Mode « fidèle » dès qu'une config de calques ou une image est fournie ; sinon
  // mode hérité (schéma complet toujours affiché) pour les anciens rapports.
  const faithful = !!layers || !!background;
  const L = layers ?? LEGACY_LAYERS;

  const arcades = arcadePolylines();
  const validated = annotations.filter((a) => a.status === 'validated' && a.lesionId);

  const discX = toX(TEMPLATE.disc.x);
  const discY = toY(TEMPLATE.disc.y);

  // Étiquettes nasal/temporal : « Nasal » du côté de la papille, « Temporal » à l'opposé.
  const nasalLabelX = toX(TEMPLATE.disc.x);
  const tempLabelX = toX(-TEMPLATE.disc.x);
  const labelTopY = CY - FIELD_R * 0.84;

  // Image de fond (non miroitée, comme dans l'éditeur) : box « cover » + clip
  // circulaire + transform (translate offset mm → px, rotation, échelle) autour du
  // centre du cercle. Colorimétrie appliquée en filtre CSS.
  const bgVisible = background && background.visible && background.src;
  const boxSize = 2 * FIELD_R;
  const clipId = `rsk-clip-${side}`;

  // Tons & netteté (filtre SVG) — id unique par côté ; null si neutre ou absent.
  const tone = background
    ? {
        sharpness: background.sharpness ?? 0,
        highlights: background.highlights ?? 0,
        shadows: background.shadows ?? 0,
        whites: background.whites ?? 0,
        blacks: background.blacks ?? 0,
      }
    : null;
  const filterId = `rsk-adj-${side}`;
  const svgFilterId = tone && !isNeutralTone(tone) ? filterId : null;

  // Transform d'alignement (zoom/pan/rotation de la photo) : dans l'éditeur, les
  // annotations sont rendues SOUS ce même transform (elles suivent l'image). On le
  // reproduit ici pour l'image ET pour les annotations, sinon un zoom/déplacement
  // de la photo décale les lésions à l'impression. Calculé dès qu'un instantané
  // d'image existe (même masqué : les coordonnées des annotations restent
  // exprimées dans le repère aligné). Les anciens CR sans image gardent le repère
  // template pur (transform vide) → rétrocompatibilité.
  let alignTransform = '';
  if (background) {
    const tx = background.offsetXMm * PX;
    const ty = background.offsetYMm * PX;
    alignTransform =
      `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) ` +
      `translate(${CX} ${CY}) rotate(${background.rotationDeg}) scale(${background.scale}) translate(${-CX} ${-CY})`;
  }

  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label={`Schéma rétine ${side}`}>
      <defs>
        <clipPath id={clipId}>
          <circle cx={CX} cy={CY} r={FIELD_R} />
        </clipPath>
        {tone && <ImageFilterDef id={filterId} tone={tone} />}
      </defs>

      {/* Rétinographie réelle importée (fond, sous le schéma et les annotations) */}
      {bgVisible && (
        <g clipPath={`url(#${clipId})`}>
          <image
            href={background!.src}
            x={CX - FIELD_R}
            y={CY - FIELD_R}
            width={boxSize}
            height={boxSize}
            preserveAspectRatio="xMidYMid slice"
            transform={alignTransform}
            opacity={background!.opacity}
            style={{
              filter: displayFilterCss(background!.brightness, background!.contrast, background!.saturation, svgFilterId),
            }}
          />
        </g>
      )}

      {/* Contour rétinien circulaire (champ ~50°) — toujours visible */}
      <circle cx={CX} cy={CY} r={FIELD_R} fill="none" stroke="#11262b" strokeWidth={1.5} />

      {/* Périphérie (calque) */}
      {L.periphery && (
        <circle cx={CX} cy={CY} r={TEMPLATE.posteriorPoleRadiusMm * PX} fill="none" stroke="#c9d3d3" strokeDasharray="3 3" />
      )}

      {/* Distance à la fovéa (calque) */}
      {L.fovea && [1, 3, 6, 12].map((r) => r * PX <= FIELD_R && (
        <circle key={r} cx={CX} cy={CY} r={r * PX} fill="none" stroke="#c9d3d3" strokeDasharray="2 4" />
      ))}

      {/* Quadrants (calque) : croix centrée papille */}
      {L.quadrants && (
        <>
          <line x1={CX - FIELD_R} y1={discY} x2={CX + FIELD_R} y2={discY} stroke="#c9d3d3" strokeDasharray="5 4" />
          <line x1={discX} y1={CY - FIELD_R} x2={discX} y2={CY + FIELD_R} stroke="#c9d3d3" strokeDasharray="5 4" />
        </>
      )}

      {/* Grille ETDRS (calque) */}
      {L.etdrs && [TEMPLATE.etdrs.inner, TEMPLATE.etdrs.middle, TEMPLATE.etdrs.outer].map((r) => (
        <circle key={r} cx={CX} cy={CY} r={r * PX} fill="none" stroke="#9aa6ab" strokeWidth={1} />
      ))}

      {/* Arcades vasculaires (calque « Vaisseaux ») */}
      {L.vessels && arcades.map((line, i) => (
        <polyline
          key={i}
          points={line.map((p) => `${toX(p.x)},${toY(p.y)}`).join(' ')}
          fill="none"
          stroke="#c9d3d3"
          strokeWidth={1.4}
          strokeLinecap="round"
        />
      ))}

      {/* Zones anatomiques (calque) : anneau péripapillaire + papille + macula + fovéa */}
      {L.anatomy && (
        <>
          <circle cx={discX} cy={discY} r={TEMPLATE.peripapillaryRadiusMm * PX} fill="none" stroke="#d8dee0" strokeDasharray="3 4" />
          <circle cx={discX} cy={discY} r={TEMPLATE.discRadiusMm * PX} fill={bgVisible ? 'none' : '#cfd9dd'} stroke="#aebcc1" />
          <circle cx={CX} cy={CY} r={TEMPLATE.maculaRadiusMm * PX} fill="none" stroke="#dcd6cb" strokeDasharray="3 4" />
          <circle cx={CX} cy={CY} r={3.5} fill="#11262b" />
        </>
      )}

      {/* Annotations validées (toujours au-dessus) — clippées au cercle rétinien
          pour qu'aucune lésion ne déborde de l'espace dédié (fix bug OD/OG). Le
          clip reste HORS du transform d'alignement (coords écran fixes), et les
          annotations SUIVENT l'image (zoom/pan/rotation) via `alignTransform` →
          plus de décalage lésions/photo à l'impression après un zoom. */}
      <g clipPath={`url(#${clipId})`}>
       <g transform={alignTransform || undefined} opacity={annotationOpacity}>
        {validated.map((a) => {
          const color = getLesion(a.lesionId)?.color ?? DRAFT;
          if (a.kind === 'point') {
            const r = Math.max(3, (a.radiusMm ?? 0.5) * PX);
            // Remplissage transparent (comme dans l'éditeur) : la rétinographie
            // reste visible sous le spot ; seul le contour est plein.
            return <circle key={a.id} cx={toX(a.points[0])} cy={toY(a.points[1])} r={r} fill={hexToRgba(color, 0.28)} stroke={color} strokeWidth={1.4} />;
          }
          if (a.kind === 'arrow') {
            return renderArrow(a, color, toX, toY, PX);
          }
          let d = '';
          for (let i = 0; i < a.points.length; i += 2) {
            d += `${i === 0 ? 'M' : 'L'}${toX(a.points[i]).toFixed(1)} ${toY(a.points[i + 1]).toFixed(1)} `;
          }
          d += 'Z';
          return <path key={a.id} d={d} fill={hexToRgba(color, 0.28)} stroke={color} strokeWidth={1.6} />;
        })}
       </g>
      </g>

      {/* Étiquettes anatomiques — uniquement en mode hérité (retirées en mode fidèle
          conformément à la demande : la couche « zones anatomiques » n'affiche plus
          les libellés Rétine temporale/nasale, Macula, Papille). */}
      {!faithful && (
        <>
          <text x={nasalLabelX} y={labelTopY} textAnchor="middle" fontSize={11} fill="#9aa6ab">Nasal</text>
          <text x={tempLabelX} y={labelTopY} textAnchor="middle" fontSize={11} fill="#9aa6ab">Temporal</text>
          <text x={discX} y={discY + TEMPLATE.peripapillaryRadiusMm * PX + 14} textAnchor="middle" fontSize={11} fill="#7d8e94">Papille</text>
          <text x={CX} y={CY + TEMPLATE.maculaRadiusMm * PX + 15} textAnchor="middle" fontSize={11} fill="#7d8e94">Macula</text>
        </>
      )}
    </svg>
  );
}

/**
 * Rendu SVG d'une flèche de désignation (trait + tête pleine), couleur de la
 * lésion. `toX/toY` projettent les mm en px ; la tête est dimensionnée en px
 * template (`PX`) puis suit l'échelle via le groupe `alignTransform` parent.
 */
function renderArrow(
  a: Annotation,
  color: string,
  toX: (mx: number) => number,
  toY: (my: number) => number,
  PX: number,
) {
  const x0 = toX(a.points[0]);
  const y0 = toY(a.points[1]);
  const x1 = toX(a.points[2]);
  const y1 = toY(a.points[3]);
  const ang = Math.atan2(y1 - y0, x1 - x0);
  const head = ARROW_HEAD_MM * PX;
  const halfW = head * 0.5;
  // Base de la tête (recul depuis la pointe le long de l'axe), + deux ailerons.
  const bx = x1 - head * Math.cos(ang);
  const by = y1 - head * Math.sin(ang);
  const leftX = bx - halfW * Math.sin(ang);
  const leftY = by + halfW * Math.cos(ang);
  const rightX = bx + halfW * Math.sin(ang);
  const rightY = by - halfW * Math.cos(ang);
  return (
    <g key={a.id}>
      <line x1={x0} y1={y0} x2={bx} y2={by} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <polygon points={`${x1},${y1} ${leftX},${leftY} ${rightX},${rightY}`} fill={color} />
    </g>
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
