/**
 * PatientReport — compte rendu en langage simple (vue patient, V3).
 * Port de la vue patient de `medivision-dual-report.html`, alimenté par
 * `data.resumePatient` et les schémas rétine des deux yeux.
 */

import * as React from 'react';
import './PatientReport.css';
import type { OCTReportData, PatientSummary } from '../../types/report';
import RetinaSchemaSvg from './visual/RetinaSchemaSvg';

const ETAT_LABEL: Record<'ok' | 'watch' | 'alert', string> = {
  ok: 'En bon état',
  watch: 'À surveiller',
  alert: 'Suivi rapproché',
};

function EyeBadge({ etat }: { etat?: 'ok' | 'watch' | 'alert' }) {
  const e = etat ?? 'ok';
  return <span className={`pt-badge ${e}`}>{ETAT_LABEL[e]}</span>;
}

const PatientReport: React.FC<{ data: OCTReportData }> = ({ data }) => {
  const rp: PatientSummary = data.resumePatient ?? {
    titre: 'Vos résultats expliqués',
    observe: "Votre médecin vous présente le détail de votre examen.",
    signification: 'Un suivi régulier permet de protéger votre vue dans le temps.',
    suite: 'Respectez les rendez-vous de contrôle proposés par votre médecin.',
    rassurance: 'Votre médecin reste disponible pour répondre à vos questions.',
  };

  return (
    <div className="patient-page">
      <div className="pt-hero">
        <div className="eyebrow">Vos résultats expliqués</div>
        <h2>{rp.titre}</h2>
        <div className="who">
          {data.patient.surname} — {data.signature.dateLabel.replace(/^Fait à[^,]*,\s*le\s*/i, '')}
        </div>

        <div className="pt-eyes">
          <div className="pt-eye">
            <RetinaSchemaSvg side="OD" annotations={data.eyes.od.annotations} />
            <div className="label">Œil droit</div>
            <div className="ctr"><EyeBadge etat={rp.odEtat} /></div>
          </div>
          <div className="pt-eye">
            <RetinaSchemaSvg side="OG" annotations={data.eyes.og.annotations} />
            <div className="label">Œil gauche</div>
            <div className="ctr"><EyeBadge etat={rp.ogEtat} /></div>
          </div>
        </div>
      </div>

      <div className="pt-cards">
        <div className="pcard">
          <div className="step">1</div>
          <h3>Ce qu'on a observé</h3>
          <p>{rp.observe}</p>
        </div>
        <div className="pcard">
          <div className="step">2</div>
          <h3>Ce que ça veut dire</h3>
          <p>{rp.signification}</p>
        </div>
        <div className="pcard">
          <div className="step">3</div>
          <h3>La suite</h3>
          <p>{rp.suite}</p>
        </div>
      </div>

      <div className="pt-reassure">
        <div className="ic">🌿</div>
        <p><b>À retenir :</b> {rp.rassurance}</p>
      </div>

      <div className="pt-foot">
        <div className="doc">
          Examen réalisé par<br />
          <b>{data.signature.doctorTitle} {data.signature.doctorName}</b> · {data.signature.clinicLine}
        </div>
      </div>
    </div>
  );
};

export default PatientReport;
