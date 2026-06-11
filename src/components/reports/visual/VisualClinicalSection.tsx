/**
 * VisualClinicalSection — bloc clinique visuel du compte rendu (V3).
 * Schéma rétine + anneaux RNFL/GCL + barre C/D par œil.
 * Légendes repositionnées : lésions sous le schéma, sévérité sous les anneaux.
 */

import type { EyeData } from '../../../types/report';
import RetinaSchemaSvg, { lesionLegend } from './RetinaSchemaSvg';
import NeuroRings from './NeuroRings';
import CDGauge from './CDGauge';

const SEV_LEGEND = [
  { label: 'Normal', color: '#7bc4a0' },
  { label: 'Limite', color: '#e6b566' },
  { label: 'Hors norme', color: '#d98b7e' },
];

function eyeFinding(eye: EyeData): { text: string; clear: boolean } {
  const lesions = lesionLegend(eye.annotations).map((l) => l.name);
  const morpho = eye.morphology
    .flatMap((r) => (r.pills ?? []).filter((p) => p.variant !== 'normal').map((p) => p.text));
  const all = [...lesions, ...morpho];
  if (all.length === 0) return { text: 'Sans particularité', clear: true };
  return { text: all.join(' · '), clear: false };
}

/** Valeur texte RNFL/GCL depuis les lignes biométriques (repli sans secteurs). */
function biomValue(eye: EyeData, label: string): { text: string; color?: string } | null {
  const row = eye.biometrics.find((r) => r.label === label);
  if (!row || !row.value) return null;
  return { text: row.value, color: row.customColor };
}

function EyeColumn({ eye }: { eye: EyeData }) {
  const impossible = eye.acquisitionQuality === 'impossible';
  const hasRings = !!(eye.rnflSectors || eye.gclSectors);
  const finding = eyeFinding(eye);
  const rnflTxt = biomValue(eye, 'RNFL');
  const gclTxt = biomValue(eye, 'GCL++');
  const legend = lesionLegend(eye.annotations);

  return (
    <div className="vc-col">
      <div className="vc-cap">
        <span className="vc-eye-code">{eye.code}</span>
        <span className="vc-eye-name">{eye.name}</span>
        {eye.acquisitionQuality && (
          <span className={`vc-acq vc-acq-${eye.acquisitionQuality}`}>
            {eye.acquisitionQuality === 'bon' ? '✓ Bon' : eye.acquisitionQuality === 'faible' ? '⚠ Faible' : '✗ Impossible'}
          </span>
        )}
      </div>

      {impossible ? (
        <div className="vc-impossible">
          Analyse impossible
          {eye.acquisitionQualityReasons && eye.acquisitionQualityReasons.length > 0 && (
            <div className="vc-reasons">{eye.acquisitionQualityReasons.join(' · ')}</div>
          )}
        </div>
      ) : (
        <>
          {/* Schéma rétinien */}
          <div className="vc-schema">
            <RetinaSchemaSvg side={eye.code} annotations={eye.annotations} />
          </div>

          {/* Légende des lésions dessinées — sous le schéma, par œil */}
          {legend.length > 0 && (
            <div className="vc-lesion-legend">
              {legend.map((l) => (
                <span key={l.id}><i style={{ background: l.color }} />{l.name}</span>
              ))}
            </div>
          )}

          <div className={`vc-finding ${finding.clear ? 'clear' : ''}`}>{finding.text}</div>

          {/* Bloc neuro : anneaux + barre C/D */}
          <div className="vc-neuro">
            {hasRings ? (
              <NeuroRings side={eye.code} rnfl={eye.rnflSectors} gcl={eye.gclSectors} />
            ) : (
              <div className="vc-neuro-text">
                {rnflTxt && <div><span>RNFL</span><b style={rnflTxt.color ? { color: rnflTxt.color } : undefined}>{rnflTxt.text}</b></div>}
                {gclTxt && <div><span>GCL++</span><b style={gclTxt.color ? { color: gclTxt.color } : undefined}>{gclTxt.text}</b></div>}
              </div>
            )}
            <CDGauge cupDisc={eye.cupDisc} cupDiscFlag={eye.cupDiscFlag} discSurface={eye.discSurface} />
          </div>
        </>
      )}
    </div>
  );
}

export default function VisualClinicalSection({ od, og }: { od: EyeData; og: EyeData }) {
  return (
    <div className="visual-clinical">
      <div className="vc-pair">
        <EyeColumn eye={od} />
        <EyeColumn eye={og} />
      </div>

      {/* Légende de sévérité RNFL/GCL — partagée, sous les deux colonnes */}
      <div className="vc-sev-legend">
        {SEV_LEGEND.map((s) => (
          <span key={s.label}><i style={{ background: s.color }} />{s.label}</span>
        ))}
      </div>
    </div>
  );
}
