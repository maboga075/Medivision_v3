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
import type { Annotation } from "../../features/retinasketch/lib/types";
import VisualClinicalSection from "./visual/VisualClinicalSection";
import { lesionLegend } from "./visual/RetinaSchemaSvg";
import ImagerySlotSvg from "./visual/ImagerySlotSvg";
import RetinographyReport from "./RetinographyReport";
import { highlightText } from "./highlight";

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

// Supprime les tirets/puces de début et le markdown **gras** générés par certains modèles IA
const stripItem = (s: string) =>
  s.replace(/^\s*[\-–—•*]\s*/, '').replace(/\*\*([^*]+)\*\*/g, '$1').trim();

/* Bloc synthèse — résolution des champs avec repli sur les anciens rapports.
   Les rapports sauvegardés avant la refonte n'ont pas les champs structurés :
   on retombe alors sur suivi[] (item "Contrôle OCT …") et prevention[]. */
function resolveControleOCT(d: OCTReportData): string {
  if (d.prochainControleOCT) return d.prochainControleOCT;
  const fromSuivi = (d.suivi ?? []).find((s) => /contr[ôo]le\s*oct/i.test(s));
  if (fromSuivi) return stripItem(fromSuivi.replace(/^.*?contr[ôo]le\s*oct\s*:?\s*/i, ''));
  return '';
}

function resolveConseil(d: OCTReportData): string {
  if (d.conseilPatient) return d.conseilPatient;
  if (d.prevention && d.prevention.length > 0) return stripItem(d.prevention[0]);
  return '';
}

/* ───────────────────────── Sections partagées ───────────────────────── */

const Masthead: React.FC<{ d: OCTReportData }> = ({ d }) => (
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
);

const MetaSection: React.FC<{ d: OCTReportData }> = ({ d }) => (
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
);

const ClinicalTextBlocks: React.FC<{ d: OCTReportData }> = ({ d }) => (
      <section className="clin-sections">

        {/* 1 — Analyse clinique */}
        <div className="clin-block analyse">
          <div className="clin-block-head">
            <span className="clin-block-tag">Analyse clinique</span>
          </div>
          <p
            className="clin-block-body"
            contentEditable="true"
            suppressContentEditableWarning={true}
          >
            {highlightText(d.analyseClinic)}
          </p>
        </div>

        {/* 2 — Conclusion */}
        <div className="clin-block conclusion">
          <div className="clin-block-head">
            <span className="clin-block-tag">Conclusion</span>
            {d.badge && (
              <span className={`sev-badge sev-${d.badge.variant}`}>{d.badge.label}</span>
            )}
          </div>
          <p
            className="clin-block-body"
            contentEditable="true"
            suppressContentEditableWarning={true}
          >
            {highlightText(d.conclusion)}
          </p>
        </div>

        {/* 3 — Synthèse & suivi (bloc compact unique) */}
        <div className="clin-block synthese">
          <div className="clin-block-head">
            <span className="clin-block-tag">Synthèse &amp; suivi</span>
          </div>
          <ul className="clin-list">
            {resolveControleOCT(d) && (
              <li contentEditable="true" suppressContentEditableWarning={true}>
                <span className="clin-bullet" contentEditable="false">–</span>
                <span className="clin-strong" contentEditable="false">Prochain contrôle OCT : </span>
                {resolveControleOCT(d)}
              </li>
            )}
            {d.examenComplementaire && (
              <li contentEditable="true" suppressContentEditableWarning={true}>
                <span className="clin-bullet" contentEditable="false">–</span>
                <span className="clin-strong" contentEditable="false">Examen complémentaire : </span>
                {d.examenComplementaire}
              </li>
            )}
            {resolveConseil(d) && (
              <li contentEditable="true" suppressContentEditableWarning={true}>
                <span className="clin-bullet" contentEditable="false">–</span>
                <span className="clin-strong" contentEditable="false">Conseil : </span>
                {resolveConseil(d)}
              </li>
            )}
          </ul>
        </div>

      </section>
);

const SignatureFooter: React.FC<{ d: OCTReportData }> = ({ d }) => (
      <footer className="sign-block">
        <div className="sign-right">
          <div className="sign-doctor">
            <span className="dr">{d.signature.doctorTitle}</span>{' '}
            <span contentEditable="true" suppressContentEditableWarning={true}>{d.signature.doctorName}</span>
          </div>
          <div className="sign-spec" contentEditable="true" suppressContentEditableWarning={true}>{d.signature.specialty}</div>
          <div className="sign-contact" contentEditable="true" suppressContentEditableWarning={true}>
            {d.signature.email} · {d.signature.phone}
          </div>
          <div className="sign-line" />
        </div>
      </footer>
);

/* ─── En-tête compact des pages de texte (continuité multipage) ─── */
const RunningHeader: React.FC<{ d: OCTReportData }> = ({ d }) => (
  <div className="page-running">
    <span className="pr-title">{d.examTitle}</span>
    <span className="pr-meta">{d.patient.surname} · N°&nbsp;{d.reportNumber}</span>
  </div>
);

/* ─── Légende des lésions (codes couleurs) sous une image ─── */
const LesionLegend: React.FC<{ annotations?: Annotation[] }> = ({ annotations }) => {
  const legend = lesionLegend(annotations ?? []);
  if (legend.length === 0) return null;
  return (
    <div className="imagery-legend">
      {legend.map((l) => (
        <span key={l.id} className="imagery-legend-item">
          <i style={{ background: l.color }} />
          {l.name}
        </span>
      ))}
    </div>
  );
};

/* ─── Annexe images (pages ≥ 2) ───
   Rétinographies (schémas + annotations) puis autres coupes (B-scan, OCT-A,
   en-face, cornée, angle IC). Sous chaque image : légende des lésions (codes
   couleurs) en évidence. */
const ImageryEyeColumn: React.FC<{ eye: EyeData }> = ({ eye }) => {
  const slots = (eye.imagerySlots ?? []).filter((s) => s.background?.src);
  if (slots.length === 0) return null;
  const opacity = eye.retinaAnnotationOpacity;
  return (
    <div className="imagery-col">
      <div className="imagery-eye">{eye.code === 'OD' ? 'Œil droit · OD' : 'Œil gauche · OG'}</div>
      {slots.map((s) => (
        <figure key={s.id} className={s.geometry === 'rect' ? 'imagery-bscan' : 'imagery-square'}>
          <ImagerySlotSvg
            side={eye.code}
            geometry={s.geometry}
            background={s.background}
            annotations={s.annotations}
            annotationOpacity={opacity}
          />
          <figcaption>{s.label}</figcaption>
          {/* Légende des lésions, auto-générée par coupe et éditable en place */}
          <div
            className="imagery-caption"
            contentEditable="true"
            suppressContentEditableWarning={true}
            data-placeholder="Cliquer pour ajouter une légende…"
          >
            {s.caption}
          </div>
          <LesionLegend annotations={s.annotations} />
        </figure>
      ))}
    </div>
  );
};

const ImageAnnex: React.FC<{ d: OCTReportData }> = ({ d }) => {
  const hasImagery =
    !!d.eyes.od.imagerySlots?.some((s) => s.background?.src) ||
    !!d.eyes.og.imagerySlots?.some((s) => s.background?.src);
  return (
    <section className="imagery">
      <div className="section-title">Imagerie</div>
      {/* Rétinographies (schémas + annotations + légendes lésions) */}
      <VisualClinicalSection od={d.eyes.od} og={d.eyes.og} mode="schema" />
      {/* Autres coupes par œil */}
      {hasImagery && (
        <div className="imagery-grid">
          <ImageryEyeColumn eye={d.eyes.od} />
          <ImageryEyeColumn eye={d.eyes.og} />
        </div>
      )}
    </section>
  );
};

/* ───────────────────────── Main component ───────────────────────── */

const OCTReport: React.FC<{ data: OCTReportData }> = ({ data }) => {
  const d = data;
  // Rétinographie pure → mise en page paysage dédiée (schémas agrandis).
  if (d.layout === 'landscape') return <RetinographyReport data={d} />;

  // Contenu visuel présent (rétinographie annotée et/ou imagerie complémentaire)
  // → une annexe images en pages ≥ 2 ; page 1 réservée au résumé clinique.
  const hasImagery =
    !!d.eyes.od.imagerySlots?.some((s) => s.background?.src) ||
    !!d.eyes.og.imagerySlots?.some((s) => s.background?.src);
  const hasRetinaVisual =
    !!d.eyes.od.retinaBackground?.src ||
    !!d.eyes.og.retinaBackground?.src ||
    !!d.eyes.od.annotations?.length ||
    !!d.eyes.og.annotations?.length;
  const hasAnnex = hasImagery || hasRetinaVisual;

  // Page 1 (résumé clinique) : infos patient + encadré RNFL/GCL/disc/CD + textes.
  const clinicalPage = (
    <div className="page">
      <Masthead d={d} />
      <MetaSection d={d} />
      <section className="clinical">
        <VisualClinicalSection od={d.eyes.od} og={d.eyes.og} mode="neuro" />
      </section>
      <ClinicalTextBlocks d={d} />
      <SignatureFooter d={d} />
    </div>
  );

  // Sans aucun visuel : le résumé clinique suffit (une page).
  if (!hasAnnex) return clinicalPage;

  // Sinon : page 1 clinique + annexe images (pages ≥ 2).
  return (
    <>
      {clinicalPage}
      <div className="page">
        <RunningHeader d={d} />
        <ImageAnnex d={d} />
      </div>
    </>
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
  analyseClinic: "L'analyse des fibres nerveuses péripapillaires (RNFL) est normale à droite, sans perte axonale détectable. À gauche, le RNFL montre une atteinte en secteur temporal inférieur. Le complexe ganglionnaire (GCL++) est symétrique et dans les normes bilatéralement. La papille optique présente une excavation asymétrique, avec un rapport C/D vertical estimé à 0.70 à droite (limite) contre 0.60 à gauche. La macula est physiologique des deux côtés. La rétine périphérique est calme à plat sur 360° bilatéralement.",
  conclusion: "Excavation papillaire asymétrique avec atteinte RNFL en secteur temporal inférieur gauche — profil évocateur de glaucome débutant. Rapport C/D droit à la limite de la normale. Bilan complémentaire recommandé.",
  prevention: [
    "Activité physique régulière — 30 min de marche quotidienne favorisant la perfusion oculaire.",
    "Alimentation riche en oméga-3, légumes verts et antioxydants.",
    "Hydratation — 1,5 à 2 L d'eau par jour ; limiter la caféine en excès.",
  ],
  suivi: [
    "Mesure de la pression intraoculaire (PIO) et pachymétrie cornéenne.",
    "Champ visuel automatisé type Humphrey 24-2.",
    "Contrôle OCT annuel — suivi RNFL/GCL pour confirmer la stabilité.",
  ],
  severite: "surveillance",
  prochainControleOCT: "dans 6 mois",
  examenComplementaire: "Mesure PIO + champ visuel Humphrey 24-2",
  conseilPatient: "Contrôler la tension artérielle, signaler tout antécédent familial de glaucome et consulter rapidement en cas de baisse du champ visuel.",
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
