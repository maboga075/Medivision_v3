/**
 * VisualClinicalSection — bloc clinique visuel du compte rendu (V3).
 * Layout :
 *   – Schémas rétiniens côte à côte (2 colonnes)
 *   – Neuro en 3 colonnes : [anneaux OD + barre C/D] | [labels C/D centrés] | [barre C/D + anneaux OG]
 *   – Légende sévérité partagée sous les anneaux
 */

import type { EyeData } from '../../../types/report';
import RetinaSchemaSvg, { lesionLegend } from './RetinaSchemaSvg';
import NeuroRings, { type Evo } from './NeuroRings';
import CDGauge from './CDGauge';

const SEV_LEGEND = [
  { label: 'Normal', color: '#7bc4a0' },
  { label: 'Limite', color: '#e6b566' },
  { label: 'Hors norme', color: '#d98b7e' },
];

/** Traduit une option d'évolution de suivi en mot + classe couleur (ou null si non significatif). */
function evoDisplay(evo?: string): Evo | null {
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
  const isFaible = eye.acquisitionQuality === 'faible';
  const finding = eyeFinding(eye);
  const legend = lesionLegend(eye.annotations);

  // Indice faible : une seule bulle (panneau ⚠ + motif), sans badge séparé.
  const faibleReasons = isFaible && eye.acquisitionQualityReasons?.length
    ? eye.acquisitionQualityReasons.join(' · ')
    : '';

  return (
    <div className="vc-col">
      <div className="vc-cap">
        <span className="vc-eye-code">{eye.code}</span>
        {/* Indice faible → bulle unique (⚠ + motif) sur la même ligne que OD/OG ;
            sinon badge « bon » / « impossible ». */}
        {isFaible ? (
          <span className="vc-acq-motif">
            <span className="vc-acq-warn" aria-hidden>⚠</span>
            {faibleReasons || "Indice d'acquisition faible"}
          </span>
        ) : eye.acquisitionQuality ? (
          <span className={`vc-acq vc-acq-${eye.acquisitionQuality}`}>
            {eye.acquisitionQuality === 'bon' ? '✓ Bon' : '✗ Impossible'}
          </span>
        ) : null}
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
            <RetinaSchemaSvg
              side={eye.code}
              annotations={eye.annotations}
              background={eye.retinaBackground}
              layers={eye.retinaLayers}
              annotationOpacity={eye.retinaAnnotationOpacity}
            />
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

/**
 * `mode` (Lot C — rapport multipage) :
 *   - `full`   : schémas rétine + encadré neuro (comportement historique / mono-page).
 *   - `neuro`  : uniquement l'encadré RNFL/GCL/disc/CD (page 1 du rapport multipage).
 *   - `schema` : uniquement les schémas rétine + légendes lésions (annexe images).
 */
export default function VisualClinicalSection({
  od,
  og,
  mode = 'full',
}: {
  od: EyeData;
  og: EyeData;
  mode?: 'full' | 'neuro' | 'schema';
}) {
  const odHasRings = !!(od.rnflSectors || od.gclSectors);
  const ogHasRings = !!(og.rnflSectors || og.gclSectors);
  const hasAnyRings = odHasRings || ogHasRings;

  const odRnflTxt = biomValue(od, 'RNFL');
  const odGclTxt = biomValue(od, 'GCL++');
  const ogRnflTxt = biomValue(og, 'RNFL');
  const ogGclTxt = biomValue(og, 'GCL++');

  // RNFL/GCL présents (anneaux ou texte) — absents en rétinographie pure.
  const hasNeuroData = hasAnyRings || !!(odRnflTxt || odGclTxt || ogRnflTxt || ogGclTxt);
  const hasAnyCD = !!(od.cupDisc || og.cupDisc);

  const showSurface = !!(od.discSurface || og.discSurface);

  const followUpDate = fmtFollowUpDate(od.followUp?.date || og.followUp?.date);
  const odRnflEvo = evoDisplay(od.followUp?.rnflEvolution);
  const odGclEvo = evoDisplay(od.followUp?.gclEvolution);
  const ogRnflEvo = evoDisplay(og.followUp?.rnflEvolution);
  const ogGclEvo = evoDisplay(og.followUp?.gclEvolution);

  return (
    <div className="visual-clinical">
      {/* Schémas rétiniens (masqués en mode « neuro ») */}
      {mode !== 'neuro' && (
      <div className="vc-pair">
        <EyeSchemaColumn eye={od} />
        <EyeSchemaColumn eye={og} />
      </div>
      )}

      {/* Encadré neuro (masqué en mode « schema ») */}
      {mode !== 'schema' && (<>
      {/* Bloc neuro 3 colonnes : [OD rings+bar] [labels] [OG bar+rings] */}
      <div className="vc-neuro-row">

        {/* OD : anneaux à gauche, barre C/D à droite (vers le centre) */}
        <div className={`vc-neuro-half vc-neuro-od${od.rnflGclExcluded ? ' vc-neuro-centered' : ''}`}>
          {od.acquisitionQuality !== 'impossible' && (
            <>
              {od.rnflGclExcluded ? (
                <div className="vc-neuro-excluded"><b>RNFL &amp; GCL</b> non interprétables<span>indice d'acquisition faible</span></div>
              ) : odHasRings ? (
                <NeuroRings side="OD" rnfl={od.rnflSectors} gcl={od.gclSectors} rnflEvo={odRnflEvo} gclEvo={odGclEvo} />
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
          {(hasAnyCD || hasNeuroData) && <span className="vc-nc-label">C/D vertical</span>}
          {showSurface && <span className="vc-nc-label">Cup area (mm²)</span>}
        </div>

        {/* OG : barre C/D à gauche (vers le centre), anneaux à droite */}
        <div className={`vc-neuro-half vc-neuro-og${og.rnflGclExcluded ? ' vc-neuro-centered' : ''}`}>
          {og.acquisitionQuality !== 'impossible' && (
            <>
              <CDGauge cupDisc={og.cupDisc} cupDiscFlag={og.cupDiscFlag} discSurface={og.discSurface} />
              {og.rnflGclExcluded ? (
                <div className="vc-neuro-excluded"><b>RNFL &amp; GCL</b> non interprétables<span>indice d'acquisition faible</span></div>
              ) : ogHasRings ? (
                <NeuroRings side="OG" rnfl={og.rnflSectors} gcl={og.gclSectors} rnflEvo={ogRnflEvo} gclEvo={ogGclEvo} />
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

      {/* Date du suivi, centrée entre les deux yeux (l'évolution est sous chaque cercle) */}
      {followUpDate && (
        <div className="vc-fu-date-row"><span className="vc-fu-date">Suivi · {followUpDate}</span></div>
      )}

      {/* Légende sévérité + définitions des sigles — uniquement si RNFL/GCL affichés
          (masquée en rétinographie pure où ces paramètres OCT sont absents). */}
      {hasNeuroData && (
        <div className="vc-sev-legend">
          {SEV_LEGEND.map((s) => (
            <span key={s.label}><i style={{ background: s.color }} />{s.label}</span>
          ))}
          <span className="vc-sev-def"><b>RNFL</b> : fibres nerveuses péripapillaires</span>
          <span className="vc-sev-def"><b>GCL</b> : complexe cellules ganglionnaires</span>
        </div>
      )}
      </>)}
    </div>
  );
}
