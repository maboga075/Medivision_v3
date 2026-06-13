/**
 * VisualClinicalSection — bloc clinique visuel du compte rendu (V3).
 * Layout :
 *   – Schémas rétiniens côte à côte (2 colonnes)
 *   – Neuro en 3 colonnes : [anneaux OD + barre C/D] | [labels C/D centrés] | [barre C/D + anneaux OG]
 *   – Légende sévérité partagée sous les anneaux
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

/** Traduit une option d'évolution de suivi en mot + classe couleur (ou null si non significatif). */
function evoDisplay(evo?: string): { word: string; cls: 'down' | 'stable' | 'up' | 'warn' } | null {
  if (!evo) return null;
  const e = evo.toLowerCase();
  if (e.includes('diminu') || e.includes('amincis')) return { word: 'Diminué', cls: 'down' };
  if (e.includes('stable')) return { word: 'Stable', cls: 'stable' };
  if (e.includes('augment') || e.includes('épaiss') || e.includes('epaiss')) return { word: 'Augmenté', cls: 'up' };
  if (e.includes('fluctu')) return { word: 'Fluctuant', cls: 'warn' };
  return null; // « Non évaluable » ou vide : rien à afficher
}

/** Formate une date ISO (yyyy-mm-dd) en jj/mm/aaaa. */
function fmtFollowUpDate(d?: string): string {
  if (!d) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : d;
}

function EvoBadges({ followUp }: { followUp?: EyeData['followUp'] }) {
  const rnfl = evoDisplay(followUp?.rnflEvolution);
  const gcl = evoDisplay(followUp?.gclEvolution);
  if (!rnfl && !gcl) return null;
  return (
    <div className="vc-fu-badges">
      {rnfl && <span className={`vc-fu-badge vc-fu-${rnfl.cls}`}>RNFL {rnfl.word}</span>}
      {gcl && <span className={`vc-fu-badge vc-fu-${gcl.cls}`}>GCL {gcl.word}</span>}
    </div>
  );
}

/**
 * Synthèse par œil. Les lésions RetinaSketch sont déjà listées dans la légende
 * (chips colorés) : on ne les répète donc PAS ici pour éviter la redondance.
 * On ne conserve que les anomalies morphologiques (hors lésions dessinées).
 * Retourne null quand rien n'est à signaler hors lésions (la légende suffit).
 */
function eyeFinding(eye: EyeData): { text: string; clear: boolean } | null {
  const morpho = eye.morphology
    .flatMap((r) => (r.pills ?? []).filter((p) => p.variant !== 'normal').map((p) => p.text));
  const hasLesions = lesionLegend(eye.annotations).length > 0;
  if (morpho.length > 0) return { text: morpho.join(' · '), clear: false };
  if (hasLesions) return null; // déjà visible dans la légende des lésions
  return { text: 'Sans particularité', clear: true };
}

function biomValue(eye: EyeData, label: string): { text: string; color?: string } | null {
  const row = eye.biometrics.find((r) => r.label === label);
  if (!row || !row.value) return null;
  return { text: row.value, color: row.customColor };
}

/** Colonne schema (schéma rétinien + légende lésions + finding) */
function EyeSchemaColumn({ eye }: { eye: EyeData }) {
  const impossible = eye.acquisitionQuality === 'impossible';
  const finding = eyeFinding(eye);
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
          <div className="vc-schema">
            <RetinaSchemaSvg side={eye.code} annotations={eye.annotations} />
          </div>
          {legend.length > 0 ? (
            <div className="vc-lesion-legend">
              {legend.map((l) => (
                <span key={l.id}><i style={{ background: l.color }} />{l.name}</span>
              ))}
            </div>
          ) : finding && finding.clear ? (
            /* « Sans particularité » : encadré par 2 barres, même police que la légende */
            <div className="vc-lesion-legend vc-lesion-legend-ras"><span>{finding.text}</span></div>
          ) : null}
          {finding && !finding.clear && (
            <div className="vc-finding">{finding.text}</div>
          )}
        </>
      )}
    </div>
  );
}

export default function VisualClinicalSection({ od, og }: { od: EyeData; og: EyeData }) {
  const odHasRings = !!(od.rnflSectors || od.gclSectors);
  const ogHasRings = !!(og.rnflSectors || og.gclSectors);
  const hasAnyRings = odHasRings || ogHasRings;

  const odRnflTxt = biomValue(od, 'RNFL');
  const odGclTxt = biomValue(od, 'GCL++');
  const ogRnflTxt = biomValue(og, 'RNFL');
  const ogGclTxt = biomValue(og, 'GCL++');

  const showSurface = !!(od.discSurface || og.discSurface);

  const followUpDate = fmtFollowUpDate(od.followUp?.date || og.followUp?.date);
  const hasEvo =
    !!evoDisplay(od.followUp?.rnflEvolution) || !!evoDisplay(od.followUp?.gclEvolution) ||
    !!evoDisplay(og.followUp?.rnflEvolution) || !!evoDisplay(og.followUp?.gclEvolution);
  const hasFollowUp = !!followUpDate || hasEvo;

  return (
    <div className="visual-clinical">
      {/* Schémas rétiniens */}
      <div className="vc-pair">
        <EyeSchemaColumn eye={od} />
        <EyeSchemaColumn eye={og} />
      </div>

      {/* Bloc neuro 3 colonnes : [OD rings+bar] [labels] [OG bar+rings] */}
      <div className="vc-neuro-row">

        {/* OD : anneaux à gauche, barre C/D à droite (vers le centre) */}
        <div className="vc-neuro-half vc-neuro-od">
          {od.acquisitionQuality !== 'impossible' && (
            <>
              {odHasRings ? (
                <NeuroRings side="OD" rnfl={od.rnflSectors} gcl={od.gclSectors} />
              ) : (
                <div className="vc-neuro-text">
                  {odRnflTxt && <div><span>RNFL</span><b style={odRnflTxt.color ? { color: odRnflTxt.color } : undefined}>{odRnflTxt.text}</b></div>}
                  {odGclTxt && <div><span>GCL++</span><b style={odGclTxt.color ? { color: odGclTxt.color } : undefined}>{odGclTxt.text}</b></div>}
                </div>
              )}
              <CDGauge cupDisc={od.cupDisc} cupDiscFlag={od.cupDiscFlag} discSurface={od.discSurface} />
            </>
          )}
        </div>

        {/* Centre : labels descriptifs, partagés */}
        <div className="vc-neuro-center">
          {hasAnyRings && (
            <>
              <span className="vc-nc-label">C/D vertical</span>
              {showSurface && <span className="vc-nc-label">Cup area (mm²)</span>}
            </>
          )}
        </div>

        {/* OG : barre C/D à gauche (vers le centre), anneaux à droite */}
        <div className="vc-neuro-half vc-neuro-og">
          {og.acquisitionQuality !== 'impossible' && (
            <>
              <CDGauge cupDisc={og.cupDisc} cupDiscFlag={og.cupDiscFlag} discSurface={og.discSurface} />
              {ogHasRings ? (
                <NeuroRings side="OG" rnfl={og.rnflSectors} gcl={og.gclSectors} />
              ) : (
                <div className="vc-neuro-text">
                  {ogRnflTxt && <div><span>RNFL</span><b style={ogRnflTxt.color ? { color: ogRnflTxt.color } : undefined}>{ogRnflTxt.text}</b></div>}
                  {ogGclTxt && <div><span>GCL++</span><b style={ogGclTxt.color ? { color: ogGclTxt.color } : undefined}>{ogGclTxt.text}</b></div>}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Suivi RNFL/GCL : évolution par œil, date au centre */}
      {hasFollowUp && (
        <div className="vc-followup">
          <div className="vc-fu-side"><EvoBadges followUp={od.followUp} /></div>
          <div className="vc-fu-center">
            {followUpDate && <span className="vc-fu-date">Suivi · {followUpDate}</span>}
          </div>
          <div className="vc-fu-side"><EvoBadges followUp={og.followUp} /></div>
        </div>
      )}

      {/* Légende sévérité + définitions des sigles — sur une seule ligne */}
      <div className="vc-sev-legend">
        {SEV_LEGEND.map((s) => (
          <span key={s.label}><i style={{ background: s.color }} />{s.label}</span>
        ))}
        <span className="vc-sev-def"><b>RNFL</b> : fibres nerveuses péripapillaires</span>
        <span className="vc-sev-def"><b>GCL</b> : complexe cellules ganglionnaires</span>
      </div>
    </div>
  );
}
