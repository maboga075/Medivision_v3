/**
 * RnflGclPicker — saisie RNFL & GCL+ par secteurs cliquables (V3, module 2).
 * Port React de la maquette `saisie-rnfl-gcl.html`.
 *
 * - Clic sur un secteur : fait défiler son état.
 *     RNFL : vert → jaune → rouge → blanc (au-dessus) → vert
 *     GCL  : vert → jaune → rouge → vert
 * - Bouton central « tout » : remplit/cycle tous les secteurs d'un coup.
 * - Presets cliniques et miroir N↔T pour accélérer la saisie.
 *
 * Le composant est mono-œil (un par EyeExamSection) ; `side` ne sert qu'au
 * placement nasal/temporal (miroir OD/OG), pas à un sélecteur interne.
 */

import {
  RNFL_COLORS,
  GCL_COLORS,
  RNFL_SECTOR_ORDER,
  GCL_SECTOR_ORDER,
  GRADE_WORD,
  summarizeRnfl,
  summarizeGcl,
  createDefaultRnflSectors,
  createDefaultGclSectors,
  type RnflSectors,
  type GclSectors,
  type RnflGrade,
  type GclGrade,
  type RnflSectorKey,
  type GclSectorKey,
} from '../../utils/rnflGcl';

interface RnflGclPickerProps {
  side: 'OD' | 'OG';
  rnfl: RnflSectors;
  gcl: GclSectors;
  onChange: (next: { rnflSectors: RnflSectors; gclSectors: GclSectors }) => void;
  disabled?: boolean;
}

/* ─── Géométrie SVG (repère 100×100, centre 50,50) ─── */

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

function labelPos(r: number, deg: number): { x: number; y: number } {
  const [x, y] = polar(r, deg);
  return { x, y };
}

/* ─── Composant ─── */

export default function RnflGclPicker({ side, rnfl, gcl, onChange, disabled }: RnflGclPickerProps) {
  const r = rnfl ?? createDefaultRnflSectors();
  const g = gcl ?? createDefaultGclSectors();

  const emit = (rnflSectors: RnflSectors, gclSectors: GclSectors) =>
    onChange({ rnflSectors, gclSectors });

  const cycleRnfl = (k: RnflSectorKey) => {
    if (disabled) return;
    emit({ ...r, [k]: (((r[k] + 1) % 4) as RnflGrade) }, g);
  };
  const cycleGcl = (k: GclSectorKey) => {
    if (disabled) return;
    emit(r, { ...g, [k]: (((g[k] + 1) % 3) as GclGrade) });
  };

  const cycleAllRnfl = () => {
    if (disabled) return;
    const vals = RNFL_SECTOR_ORDER.map((k) => r[k]);
    const same = vals.every((v) => v === vals[0]);
    const next = (same ? (vals[0] + 1) % 4 : 1) as RnflGrade;
    emit({ S: next, I: next, N: next, T: next }, g);
  };
  const cycleAllGcl = () => {
    if (disabled) return;
    const vals = GCL_SECTOR_ORDER.map((k) => g[k]);
    const same = vals.every((v) => v === vals[0]);
    const next = (same ? (vals[0] + 1) % 3 : 1) as GclGrade;
    emit(r, { S: next, ST: next, IT: next, I: next, IN: next, SN: next });
  };

  const preset = (name: 'normal' | 'inf' | 'sup') => {
    if (disabled) return;
    if (name === 'normal') return emit(createDefaultRnflSectors(), createDefaultGclSectors());
    if (name === 'inf')
      return emit({ S: 0, I: 2, N: 0, T: 1 }, { S: 0, ST: 0, IT: 2, I: 2, IN: 1, SN: 0 });
    // sup
    return emit({ S: 2, I: 0, N: 1, T: 0 }, { S: 2, ST: 2, IT: 0, I: 0, IN: 0, SN: 1 });
  };

  const mirror = () => {
    if (disabled) return;
    emit(
      { ...r, N: r.T, T: r.N },
      { ...g, ST: g.SN, SN: g.ST, IT: g.IN, IN: g.IT },
    );
  };

  /* RNFL : S haut, I bas ; N/T selon l'œil. */
  const Nside = side === 'OG' ? 270 : 90;
  const Tside = side === 'OG' ? 90 : 270;
  const rnflGeom: { k: RnflSectorKey; a0: number; a1: number }[] = [
    { k: 'S', a0: 318, a1: 402 },
    { k: 'I', a0: 138, a1: 222 },
    { k: 'N', a0: Nside - 42, a1: Nside + 42 },
    { k: 'T', a0: Tside - 42, a1: Tside + 42 },
  ];
  const rnflLabels = [
    { t: 'S', ...labelPos(31, 0) },
    { t: 'I', ...labelPos(31, 180) },
    { t: 'N', ...labelPos(31, Nside) },
    { t: 'T', ...labelPos(31, Tside) },
  ];

  /* GCL : 6 secteurs, miroir via facteur f. */
  const f = side === 'OG' ? 1 : -1;
  const gclAngle: Record<GclSectorKey, number> = {
    S: 0, ST: 60 * f, IT: 120 * f, I: 180, IN: 240 * f, SN: 300 * f,
  };

  const rnflStroke = (grade: RnflGrade) => (grade === 3 ? '#9aa6ab' : '#fff');

  const rnflSummary = summarizeRnfl(r);
  const gclSummary = summarizeGcl(g);

  return (
    <div className={disabled ? 'opacity-50 pointer-events-none select-none' : ''}>
      <div className="grid grid-cols-2 gap-3">
        {/* RNFL */}
        <div className="p-2 text-center">
          <div className="text-[11px] font-mono font-bold text-slate-700">RNFL</div>
          <div className="text-[10px] text-slate-400 mb-1">fibres péripapillaires · 4 quadrants</div>
          <svg viewBox="0 0 100 100" className="w-full max-w-[150px] mx-auto block">
            {rnflGeom.map(({ k, a0, a1 }) => (
              <path
                key={k}
                d={sectorPath(40, 22, a0, a1)}
                fill={RNFL_COLORS[r[k]]}
                stroke={rnflStroke(r[k])}
                strokeWidth={1.3}
                className="cursor-pointer transition-[filter] hover:brightness-105"
                onClick={() => cycleRnfl(k)}
              />
            ))}
            <circle
              cx={50}
              cy={50}
              r={15.5}
              fill="#f6f2ea"
              stroke="#cdd5d2"
              strokeWidth={1.2}
              className="cursor-pointer"
              onClick={cycleAllRnfl}
            />
            <text x={50} y={51} textAnchor="middle" dominantBaseline="middle" fontSize={6.2} fontFamily="monospace" fill="#7d8e94" className="pointer-events-none">tout</text>
            {rnflLabels.map((l) => (
              <text key={l.t} x={l.x} y={l.y} textAnchor="middle" dominantBaseline="middle" fontSize={7.5} fontFamily="monospace" fill="#9aa6ab" className="pointer-events-none">{l.t}</text>
            ))}
          </svg>
        </div>

        {/* GCL+ */}
        <div className="p-2 text-center">
          <div className="text-[11px] font-mono font-bold text-slate-700">GCL+ <span className="text-slate-400">(GCIPL)</span></div>
          <div className="text-[10px] text-slate-400 mb-1">macula · 6 secteurs</div>
          <svg viewBox="0 0 100 100" className="w-full max-w-[150px] mx-auto block">
            {GCL_SECTOR_ORDER.map((k) => (
              <path
                key={k}
                d={sectorPath(40, 20, gclAngle[k] - 28, gclAngle[k] + 28)}
                fill={GCL_COLORS[g[k]]}
                stroke="#fff"
                strokeWidth={1.3}
                className="cursor-pointer transition-[filter] hover:brightness-105"
                onClick={() => cycleGcl(k)}
              />
            ))}
            <circle
              cx={50}
              cy={50}
              r={15.5}
              fill="#f6f2ea"
              stroke="#cdd5d2"
              strokeWidth={1.2}
              className="cursor-pointer"
              onClick={cycleAllGcl}
            />
            <text x={50} y={51} textAnchor="middle" dominantBaseline="middle" fontSize={6.2} fontFamily="monospace" fill="#7d8e94" className="pointer-events-none">tout</text>
          </svg>
        </div>
      </div>

      {/* Légende */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: GCL_COLORS[0] }} />Normal</span>
        <span className="inline-flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: GCL_COLORS[1] }} />Limite</span>
        <span className="inline-flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: GCL_COLORS[2] }} />Hors norme</span>
        <span className="inline-flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm inline-block border border-slate-400" style={{ background: '#fff' }} />Au-dessus <span className="opacity-70">(RNFL)</span></span>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-2 mt-3">
        <button type="button" onClick={() => preset('normal')} className="text-xs border border-slate-200 bg-white text-slate-700 px-3 py-1.5 rounded-full hover:border-teal-400 hover:text-teal-600 transition-colors">Tout normal</button>
        <button type="button" onClick={() => preset('inf')} className="text-xs border border-slate-200 bg-white text-slate-700 px-3 py-1.5 rounded-full hover:border-teal-400 hover:text-teal-600 transition-colors">Arciforme inférieur</button>
        <button type="button" onClick={() => preset('sup')} className="text-xs border border-slate-200 bg-white text-slate-700 px-3 py-1.5 rounded-full hover:border-teal-400 hover:text-teal-600 transition-colors">Arciforme supérieur</button>
        <button type="button" onClick={mirror} className="text-xs border border-dashed border-slate-300 bg-white text-slate-500 px-3 py-1.5 rounded-full hover:border-teal-400 hover:text-teal-600 transition-colors">⇄ Miroir N↔T</button>
      </div>

      {/* Résumé lisible */}
      <div className="mt-3 text-xs text-slate-600 space-y-0.5">
        <div><span className="font-bold text-slate-700">RNFL :</span> {rnflSummary.worst === 0 && rnflSummary.abnormalCount === 0 ? 'dans les normes' : describeGrades(RNFL_SECTOR_ORDER, r)}</div>
        <div><span className="font-bold text-slate-700">GCL+ :</span> {gclSummary.worst === 0 && gclSummary.abnormalCount === 0 ? 'dans les normes' : describeGrades(GCL_SECTOR_ORDER, g)}</div>
      </div>
    </div>
  );
}

const SECTOR_NAME: Record<string, string> = {
  S: 'Supérieur', I: 'Inférieur', N: 'Nasal', T: 'Temporal',
  ST: 'Supéro-temporal', IT: 'Inféro-temporal', IN: 'Inféro-nasal', SN: 'Supéro-nasal',
};

function describeGrades<K extends string>(order: K[], sectors: Record<K, number>): string {
  const parts = order.filter((k) => sectors[k] > 0).map((k) => `${SECTOR_NAME[k]} (${GRADE_WORD[sectors[k]]})`);
  return parts.length ? parts.join(' · ') : 'dans les normes';
}
