/**
 * OCTReport.tsx — Compte rendu OCT / Rétinographie
 * A single-page A4 clinical report component.
 *
 * Usage:
 *   import OCTReport, { sampleReport } from "./OCTReport";
 *   <OCTReport data={sampleReport} />
 *
 * Pair with OCTReport.css (provided alongside).
 * Fonts (Google): Fraunces, Inter Tight, JetBrains Mono.
 */

import * as React from "react";
import "./OCTReport.css";
import type { PillVariant, ParamRow, EyeData, OCTReportData } from "../../types/report";

// Ré-exports pour la compatibilité des imports existants
export type { PillVariant, ParamRow, EyeData, OCTReportData };

/* ─────────────────────── Sub-components ─────────────────────── */

const BrandMark: React.FC = () => (
  <div className="brand-mark" aria-hidden>
    <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth={1.6}
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 16c3.5-5.5 8-8.2 13-8.2S25.5 10.5 29 16c-3.5 5.5-8 8.2-13 8.2S6.5 21.5 3 16Z" />
      <circle cx={16} cy={16} r={4.2} fill="currentColor" stroke="none" />
      <circle cx={17.4} cy={14.6} r={1.1} fill="#0A6E6B" stroke="none" />
    </svg>
  </div>
);

const EyePictogram: React.FC = () => (
  <svg className="eye-pict" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M2 12c2.8-4.5 6.3-6.8 10-6.8S19.2 7.5 22 12c-2.8 4.5-6.3 6.8-10 6.8S4.8 16.5 2 12Z" />
    <circle cx={12} cy={12} r={3.4} fill="currentColor" stroke="none" />
    <circle cx={13.1} cy={10.9} r={0.9} fill="#FFFFFF" stroke="none" />
  </svg>
);

const HeartIcon: React.FC = () => (
  <svg className="rec-icon" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden>
    <path d="M12 21s-7.7-4.7-9.6-10.2A5.6 5.6 0 0 1 12 6.2a5.6 5.6 0 0 1 9.6 4.6C19.7 16.3 12 21 12 21Z" />
  </svg>
);

const ClockIcon: React.FC = () => (
  <svg className="rec-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth={1.6} aria-hidden>
    <circle cx={12} cy={12} r={9} />
    <polyline points="12 7 12 12 15 14" />
  </svg>
);

const Pill: React.FC<{ variant: PillVariant; children: React.ReactNode }> = ({ variant, children }) => (
  <span
    className={`pill ${variant}`}
    contentEditable="true"
    suppressContentEditableWarning={true}
  >{children}</span>
);

/* A7 — ParamLine : une bulle par anomalie (pills[]), ou valeur colorée (value + customColor) */
const ParamLine: React.FC<{ row: ParamRow }> = ({ row }) => (
  <div className="param">
    <div className="param-key">
      {row.label}{" "}
      {row.hint && <span className="hint">· {row.hint}</span>}
    </div>
    <div className="param-val">
      {row.pills && row.pills.length > 0 ? (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {row.pills.map((p, i) => (
            <Pill key={i} variant={p.variant}>{p.text}</Pill>
          ))}
        </div>
      ) : row.value ? (
        <span
          contentEditable="true"
          suppressContentEditableWarning={true}
          style={
            row.customColor ? { color: row.customColor }
            : row.flag === 'alert' ? { color: 'var(--amber)' }
            : row.flag === 'critical' ? { color: 'var(--crimson)' }
            : undefined
          }
        >
          {row.value}
        </span>
      ) : null}
    </div>
  </div>
);

/* A2 — EyeColumn : badge qualité acquisition dans l'en-tête */
const EyeColumn: React.FC<{ eye: EyeData; side: "od" | "og" }> = ({ eye, side }) => (
  <div className={`eye ${side}`}>
    <div className="eye-header">
      <div className="eye-label">
        <span className="code">{eye.code}</span>
        <EyePictogram />
        <span className="name">{eye.name}</span>
        <span className="latin">· {eye.latin}</span>
      </div>
      {eye.acquisitionQuality && (
        <div className={`pill-acquisition pill-${eye.acquisitionQuality}`}>
          {eye.acquisitionQuality === 'bon' ? '✓ Bon'
           : eye.acquisitionQuality === 'faible' ? '⚠ Faible'
           : '✗ Analyse impossible'}
        </div>
      )}
    </div>

    {eye.acquisitionQuality === 'impossible' ? (
      <div className="acquisition-impossible">
        <div className="acquisition-impossible-icon">✗</div>
        <div>
          <div className="acquisition-impossible-title">Analyse impossible</div>
          {eye.acquisitionQualityReasons && eye.acquisitionQualityReasons.length > 0 && (
            <div className="acquisition-impossible-reasons">
              {eye.acquisitionQualityReasons.join(' · ')}
            </div>
          )}
        </div>
      </div>
    ) : (
      <>
        <div className="section">
          <div className="section-title">Analyse morphologique</div>
          {eye.morphology.map((r, i) => <ParamLine key={i} row={r} />)}
        </div>

        <div className="section">
          <div className="section-title">Paramètres biométriques</div>
          {eye.biometrics.map((r, i) => <ParamLine key={i} row={r} />)}
        </div>
      </>
    )}
  </div>
);

/* ───────────────────────── Main component ───────────────────────── */

const OCTReport: React.FC<{ data: OCTReportData }> = ({ data }) => {
  const d = data;
  return (
    <div className="page">
      {/* ══ HEADER ══ */}
      <header className="masthead">
        <div className="masthead-top">
          <div className="kicker">Compte rendu · N°&nbsp;<span contentEditable="true" suppressContentEditableWarning={true}>{d.reportNumber}</span></div>
        </div>
        <div className="masthead-main">
          <div className="brand-row">
            <BrandMark />
            <div className="brand-text">
              <div className="wordmark">{d.brand.clinic} <em>{d.brand.name}</em></div>
              <div className="tagline">
                {d.brand.taglineParts.map((p, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <span className="sep">·</span>}
                    {p}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
          <div className="doc-title">
            <div className="main" contentEditable="true" suppressContentEditableWarning={true}>{d.examTitle}</div>
            <div className="sub" contentEditable="true" suppressContentEditableWarning={true}>{d.examSubtitle}</div>
          </div>
        </div>
      </header>

      {/* ══ META ══ */}
      <section className="meta">
        <div className="meta-cell">
          <div className="meta-label">Patient</div>
          <div className="meta-value">
            <span contentEditable="true" suppressContentEditableWarning={true}>{d.patient.surname}</span>
            &nbsp;<span className="soft">· <span contentEditable="true" suppressContentEditableWarning={true}>{d.patient.age}</span> ans · <span contentEditable="true" suppressContentEditableWarning={true}>{d.patient.sex}</span></span>
          </div>
        </div>
        <div className="meta-cell">
          <div className="meta-label">Prescripteur</div>
          <div className="meta-value" contentEditable="true" suppressContentEditableWarning={true}>{d.prescriber}</div>
        </div>
        {/* A1 — Motif multi-lignes */}
        <div className="meta-cell">
          <div className="meta-label">Motif</div>
          <div className="meta-value">
            {d.indication.main.split(',').map((motif, i) => (
              <div key={i} contentEditable="true" suppressContentEditableWarning={true}>{motif.trim()}</div>
            ))}
            {d.indication.soft && (
              <div className="soft" contentEditable="true" suppressContentEditableWarning={true}>{d.indication.soft}</div>
            )}
          </div>
        </div>
        <div className="meta-cell">
          <div className="meta-label">Antécédents</div>
          <div className="meta-value" contentEditable="true" suppressContentEditableWarning={true}>{d.history}</div>
        </div>
      </section>

      {/* ══ CLINICAL GRID ══ */}
      <section className="clinical">
        <EyeColumn eye={d.eyes.od} side="od" />
        <EyeColumn eye={d.eyes.og} side="og" />
      </section>

      {/* ══ INTERPRETATION ══ */}
      <section className="interpretation">
        <div className="interp-header">
          <span className="title">Analyse clinique</span>
        </div>
        <p className="interp-body" contentEditable="true" suppressContentEditableWarning={true}>{d.interpretation}</p>
      </section>

      {/* ══ CONCLUSION ══ */}
      <section className="conclusion">
        <div className="conclusion-row">
          <div className="conclusion-badge">
            <span className="mark">· Synthèse</span>
            <span className="label">Conclusion</span>
          </div>
          <div className="conclusion-text" contentEditable="true" suppressContentEditableWarning={true}>
            {d.conclusion.headline}
            {d.conclusion.caveat && <em>{d.conclusion.caveat}</em>}
          </div>
        </div>
      </section>

      {/* ══ RECOMMENDATIONS ══ */}
      <section className="recommendations">
        <div className="rec-card">
          <div className="rec-head">
            <span className="rec-title">Hygiène &amp; prévention</span>
            <HeartIcon />
          </div>
          <ul className="rec-list">
            {d.recommendations.hygiene.map((li, i) => <li key={i} contentEditable="true" suppressContentEditableWarning={true}>{li}</li>)}
          </ul>
        </div>
        <div className="rec-card follow">
          <div className="rec-head">
            <span className="rec-title">Suivi &amp; examens complémentaires</span>
            <ClockIcon />
          </div>
          <ul className="rec-list">
            {d.recommendations.followUp.map((li, i) => <li key={i} contentEditable="true" suppressContentEditableWarning={true}>{li}</li>)}
          </ul>
        </div>
      </section>

      {/* ══ SIGNATURE ══ */}
      <footer className="sign-block">
        <div className="sign-left">
          <div className="city" contentEditable="true" suppressContentEditableWarning={true}>{d.signature.dateLabel}</div>
          <div className="contact" contentEditable="true" suppressContentEditableWarning={true}>
            {d.signature.clinicLine}<br />
            {d.signature.email} · {d.signature.phone}
          </div>
        </div>
        <div className="sign-right">
          <div className="sign-doctor">
            <span className="dr">{d.signature.doctorTitle}</span>{' '}
            <span contentEditable="true" suppressContentEditableWarning={true}>{d.signature.doctorName}</span>
          </div>
          <div className="sign-spec" contentEditable="true" suppressContentEditableWarning={true}>{d.signature.specialty}</div>
          <div className="sign-line" />
        </div>
      </footer>
    </div>
  );
};

export default OCTReport;

/* ───────────────────────── Sample data ───────────────────────── */

export const sampleReport: OCTReportData = {
  reportNumber: "2026-0422-01",
  examTitle: "OCT / Rétinographie",
  examSubtitle: "Examen du 22 avril 2026 — Segment postérieur",
  brand: {
    clinic: "Clinique",
    name: "Medivision",
    taglineParts: ["Ophtalmologie", "Imagerie rétinienne", "Libreville"],
  },
  patient:    { surname: "MBOUSSOU", age: 67, sex: "M" },
  prescriber: "Dr. Milebou",
  indication: { main: "Excavation papillaire, Glaucome suspecté", soft: "bilatérale" },
  history:    "Sans particularité",
  eyes: {
    od: {
      code: "OD", name: "Œil droit", latin: "dexter",
      acquisitionQuality: "bon",
      morphology: [
        { label: "Macula", pills: [{ variant: "normal", text: "Physiologique" }] },
        { label: "Papille optique", pills: [{ variant: "alert", text: "Excavation ↑" }] },
        { label: "Périphérie", pills: [{ variant: "normal", text: "Calme 360°" }] },
        { label: "OCTA", hint: "densité capillaire", pills: [{ variant: "normal", text: "Préservée" }] },
      ],
      biometrics: [
        { label: "RNFL", hint: "fibres nerveuses péripapillaires", value: "Dans les normes", customColor: "var(--sage)", isBiometricGraded: true },
        { label: "GCL++", hint: "complexe cell. ganglionnaires", value: "Dans les normes", customColor: "var(--sage)", isBiometricGraded: true },
        { label: "Rapport C/D", hint: "vertical", value: "0.70 ⚠", flag: "alert" },
        { label: "Surface discale", value: "2.0 mm²" },
      ],
    },
    og: {
      code: "OG", name: "Œil gauche", latin: "sinister",
      acquisitionQuality: "bon",
      morphology: [
        { label: "Macula", pills: [{ variant: "normal", text: "Physiologique" }] },
        { label: "Papille optique", pills: [{ variant: "normal", text: "Sans particularité" }] },
        { label: "Périphérie", pills: [{ variant: "normal", text: "Calme 360°" }] },
        { label: "OCTA", hint: "densité capillaire", pills: [{ variant: "normal", text: "Préservée" }] },
      ],
      biometrics: [
        { label: "RNFL", hint: "fibres nerveuses péripapillaires", value: "Inf. en TI", customColor: "var(--crimson)", isBiometricGraded: true },
        { label: "GCL++", hint: "complexe cell. ganglionnaires", value: "Dans les normes", customColor: "var(--sage)", isBiometricGraded: true },
        { label: "Rapport C/D", hint: "vertical", value: "0.60" },
        { label: "Surface discale", value: "2.0 mm²" },
      ],
    },
  },
  interpretation: (
    <>
      L'analyse automatisée des fibres nerveuses péripapillaires (<span className="key">RNFL</span>)
      et du complexe ganglionnaire (<span className="key">GCL++</span>) est strictement normale et{" "}
      <span className="key">symétrique bilatéralement</span>, sans perte axonale détectable à droite.
      À gauche, le <span className="key">RNFL</span> montre une atteinte en secteur temporal inférieur.
      On note une <span className="key">excavation papillaire asymétrique</span>, avec un
      rapport <span className="key">C/D</span> vertical estimé à{" "}
      <span className="key">0.70 à droite contre 0.60 à gauche</span>. La rétine périphérique est
      calme à plat sur 360° bilatéralement.
    </>
  ),
  conclusion: {
    headline: (
      <>Excavation papillaire asymétrique avec atteinte RNFL en TI gauche — profil évocateur de glaucome débutant.</>
    ),
    caveat: <>Surveillance recommandée.</>,
  },
  recommendations: {
    hygiene: [
      <><strong>Activité physique</strong> régulière — 30 min de marche quotidienne favorisant la perfusion oculaire.</>,
      <><strong>Alimentation</strong> riche en oméga-3, légumes verts et antioxydants.</>,
      <><strong>Hydratation</strong> — 1.5 à 2 L d'eau/jour ; limiter la caféine en excès.</>,
    ],
    followUp: [
      <>Mesure de la <strong>pression intraoculaire (PIO)</strong> et pachymétrie cornéenne.</>,
      <><strong>Champ visuel automatisé</strong> type Humphrey 24-2.</>,
      <><strong>Contrôle OCT annuel</strong> — suivi RNFL/GCL pour confirmer la stabilité.</>,
    ],
  },
  signature: {
    city: "Libreville",
    dateLabel: "Fait à Libreville, le 22 avril 2026",
    clinicLine: "CLINIQUE MEDIVISION · Libreville, Gabon",
    email: "yoanmboussou@gmail.com",
    phone: "+241 76 51 50 12",
    doctorTitle: "Dr.",
    doctorName: "Yoan MBOUSSOU",
    specialty: "Médecin · Imagerie rétinienne",
  },
};
