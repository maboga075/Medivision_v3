/**
 * NeuroRings — anneaux sectoriels RNFL (4 quadrants) et GCL+ (6 secteurs)
 * pour le compte rendu. Lecture seule, colorés depuis les grilles de secteurs.
 * Miroir nasal/temporal selon l'œil.
 */

import {
  RNFL_COLORS,
  GCL_COLORS,
  GCL_SECTOR_ORDER,
  type RnflSectors,
  type GclSectors,
  type GclSectorKey,
  type RnflSectorKey,
} from '../../../utils/rnflGcl';

interface Props {
  side: 'OD' | 'OG';
  rnfl?: RnflSectors;
  gcl?: GclSectors;
}

function polar(r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [+(50 + r * Math.sin(a)).toFixed(2), +(50 - r * Math.cos(a)).toFixed(2)];
}

function sectorPath(rO: number, rI: number, a0: number, a1: number): string {
  const large = ((a1 - a0) % 360) > 180 ? 1 : 0;
  const [ox0, oy0] = polar(rO, a0);
  const [ox1, oy1] = polar(rO, a1);
  const [ix1, iy1] = polar(rI, a1);
  const [ix0, iy0] = polar(rI, a0);
  return `M${ox0} ${oy0} A${rO} ${rO} 0 ${large} 1 ${ox1} ${oy1} L${ix1} ${iy1} A${rI} ${rI} 0 ${large} 0 ${ix0} ${iy0} Z`;
}

export default function NeuroRings({ side, rnfl, gcl }: Props) {
  return (
    <div className="neuro-rings">
      {rnfl && <RnflRing side={side} s={rnfl} />}
      {gcl && <GclRing side={side} s={gcl} />}
    </div>
  );
}

function RnflRing({ side, s }: { side: 'OD' | 'OG'; s: RnflSectors }) {
  const Nside = side === 'OG' ? 270 : 90;
  const Tside = side === 'OG' ? 90 : 270;
  const geom: { k: RnflSectorKey; a0: number; a1: number }[] = [
    { k: 'S', a0: 318, a1: 402 },
    { k: 'I', a0: 138, a1: 222 },
    { k: 'N', a0: Nside - 42, a1: Nside + 42 },
    { k: 'T', a0: Tside - 42, a1: Tside + 42 },
  ];
  return (
    <div className="ring">
      <svg viewBox="0 0 100 100">
        {geom.map(({ k, a0, a1 }) => (
          <path key={k} d={sectorPath(40, 23, a0, a1)} fill={RNFL_COLORS[s[k]]} stroke={s[k] === 3 ? '#9aa6ab' : '#fff'} strokeWidth={1.2} />
        ))}
        <text x={50} y={50} textAnchor="middle" dominantBaseline="middle" fontSize={9.5} fontWeight={600} fontFamily="monospace" fill="#3d5660">RNFL</text>
        <text x={50} y={11} textAnchor="middle" fontSize={7.5} fill="#9aa6ab">S</text>
        <text x={50} y={94} textAnchor="middle" fontSize={7.5} fill="#9aa6ab">I</text>
      </svg>
      <span>RNFL</span>
    </div>
  );
}

function GclRing({ side, s }: { side: 'OD' | 'OG'; s: GclSectors }) {
  const f = side === 'OG' ? 1 : -1;
  const angle: Record<GclSectorKey, number> = { S: 0, ST: 60 * f, IT: 120 * f, I: 180, IN: 240 * f, SN: 300 * f };
  return (
    <div className="ring">
      <svg viewBox="0 0 100 100">
        {GCL_SECTOR_ORDER.map((k) => (
          <path key={k} d={sectorPath(40, 21, angle[k] - 28, angle[k] + 28)} fill={GCL_COLORS[s[k]]} stroke="#fff" strokeWidth={1.2} />
        ))}
        <text x={50} y={50} textAnchor="middle" dominantBaseline="middle" fontSize={9} fontWeight={600} fontFamily="monospace" fill="#3d5660">GCL+</text>
      </svg>
      <span>GCL+</span>
    </div>
  );
}
