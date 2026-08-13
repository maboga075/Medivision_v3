/**
 * ImagerySlotSvg — rendu SVG statique d'une image d'imagerie complémentaire
 * (B-scan rectangulaire, OCT-A / OCT en-face carrés) et de ses annotations, pour
 * la page imagerie du compte rendu OCT multipage (Lot C).
 *
 * Équivalent de RetinaSchemaSvg mais pour un champ rectangulaire/carré : l'image
 * est affichée avec son alignement et sa colorimétrie, et les annotations
 * (flèches/spots/surfaces) sont projetées sous le même transform que dans
 * l'éditeur — aucune anatomie rétinienne (pas de fovéa/papille/ETDRS).
 */

import { useId } from 'react';
import { fieldHalfExtentsMm } from '../../../features/retinasketch/lib/geometry/template';
import { getLesion } from '../../../features/retinasketch/lib/ontology/lesions';
import { displayFilterCss, isNeutralTone } from '../../../features/retinasketch/lib/image/filters';
import { ImageFilterDef } from '../../../features/retinasketch/components/RetinaImageFilters';
import type { Annotation, ImageGeometry } from '../../../features/retinasketch/lib/types';

/**
 * Champ minimal requis pour l'affichage : couvre à la fois l'instantané persisté
 * (RetinaBackgroundSnapshot) et l'état live du store (BackgroundState, src blob).
 */
export interface ImageBackgroundLike {
  src: string | null;
  visible: boolean;
  opacity: number;
  brightness: number;
  contrast: number;
  saturation: number;
  sharpness?: number;
  highlights?: number;
  shadows?: number;
  whites?: number;
  blacks?: number;
  scale: number;
  offsetXMm: number;
  offsetYMm: number;
  rotationDeg: number;
}

interface Props {
  side: 'OD' | 'OG';
  geometry: ImageGeometry;
  background?: ImageBackgroundLike | null;
  annotations?: Annotation[];
  annotationOpacity?: number;
}

const ARROW_HEAD_MM = 0.7;
const DRAFT = '#94a3b8';
const VB_W = 440; // largeur fixe du viewBox ; hauteur déduite du ratio du champ

export default function ImagerySlotSvg({
  side,
  geometry,
  background = null,
  annotations = [],
  annotationOpacity = 1,
}: Props) {
  const uid = useId();
  const { halfW, halfH } = fieldHalfExtentsMm(geometry);
  const VB_H = Math.round((VB_W * halfH) / halfW); // 2:1 (rect) ou 1:1 (carré)
  const CX = VB_W / 2;
  const CY = VB_H / 2;
  const MARGIN = 0.96;
  const PX = Math.min((CX * MARGIN) / halfW, (CY * MARGIN) / halfH);
  const fW = halfW * PX; // demi-largeur du champ (px)
  const fH = halfH * PX; // demi-hauteur du champ (px)

  // Pas de miroir sur l'image (comme dans l'éditeur) ; les annotations suivent
  // la même convention que RetinaSchemaSvg (miroir horizontal selon l'œil).
  const mirror = side === 'OD' ? -1 : 1;
  const toX = (mx: number) => CX + mx * PX * mirror;
  const toY = (my: number) => CY + my * PX;

  const bgVisible = !!(background && background.visible && background.src);
  const validated = annotations.filter((a) => a.status === 'validated' && a.lesionId);

  const clipId = `img-clip-${uid}`;
  const filterId = `img-adj-${uid}`;
  const tone = background
    ? {
        sharpness: background.sharpness ?? 0,
        highlights: background.highlights ?? 0,
        shadows: background.shadows ?? 0,
        whites: background.whites ?? 0,
        blacks: background.blacks ?? 0,
      }
    : null;
  const svgFilterId = tone && !isNeutralTone(tone) ? filterId : null;

  // Transform d'alignement (offset/rotation/échelle de l'image) appliqué à la
  // fois à l'image et aux annotations, comme dans l'éditeur.
  let alignTransform = '';
  if (background) {
    const tx = background.offsetXMm * PX;
    const ty = background.offsetYMm * PX;
    alignTransform =
      `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) ` +
      `translate(${CX} ${CY}) rotate(${background.rotationDeg}) scale(${background.scale}) translate(${-CX} ${-CY})`;
  }

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
      role="img"
      aria-label={`Imagerie ${side}`}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={CX - fW} y={CY - fH} width={2 * fW} height={2 * fH} rx={4} />
        </clipPath>
        {tone && <ImageFilterDef id={filterId} tone={tone} />}
      </defs>

      {/* Image importée (fond) */}
      {bgVisible && (
        <g clipPath={`url(#${clipId})`}>
          <image
            href={background!.src ?? undefined}
            x={CX - fW}
            y={CY - fH}
            width={2 * fW}
            height={2 * fH}
            preserveAspectRatio="xMidYMid slice"
            transform={alignTransform || undefined}
            opacity={background!.opacity}
            style={{
              filter: displayFilterCss(background!.brightness, background!.contrast, background!.saturation, svgFilterId),
            }}
          />
        </g>
      )}

      {/* Contour du champ (rectangle / carré) */}
      <rect
        x={CX - fW}
        y={CY - fH}
        width={2 * fW}
        height={2 * fH}
        rx={4}
        fill={bgVisible ? 'none' : '#0b1b2b'}
        stroke="#11262b"
        strokeWidth={1.5}
      />

      {/* Annotations validées — clippées au champ, sous le même transform que l'image */}
      <g clipPath={`url(#${clipId})`}>
        <g transform={alignTransform || undefined} opacity={annotationOpacity}>
          {validated.map((a) => {
            const color = getLesion(a.lesionId)?.color ?? DRAFT;
            if (a.kind === 'point') {
              const r = Math.max(3, (a.radiusMm ?? 0.5) * PX);
              return (
                <circle
                  key={a.id}
                  cx={toX(a.points[0])}
                  cy={toY(a.points[1])}
                  r={r}
                  fill={hexToRgba(color, 0.28)}
                  stroke={color}
                  strokeWidth={1.4}
                />
              );
            }
            if (a.kind === 'arrow') return renderArrow(a, color, toX, toY, PX);
            let d = '';
            for (let i = 0; i < a.points.length; i += 2) {
              d += `${i === 0 ? 'M' : 'L'}${toX(a.points[i]).toFixed(1)} ${toY(a.points[i + 1]).toFixed(1)} `;
            }
            d += 'Z';
            return <path key={a.id} d={d} fill={hexToRgba(color, 0.28)} stroke={color} strokeWidth={1.6} />;
          })}
        </g>
      </g>
    </svg>
  );
}

/** Flèche de désignation (trait + tête pleine) — cf. RetinaSchemaSvg. */
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
