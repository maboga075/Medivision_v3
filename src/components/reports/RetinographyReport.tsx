/**
 * RetinographyReport — compte rendu de rétinographie en A4 PAYSAGE.
 *
 * Inspiré de la vue impression de RetinaSketch : les deux schémas rétiniens
 * (photo réelle + annotations) occupent toute la largeur en haut de page ; les
 * items texte (description des lésions, analyse clinique, conclusion, suivi)
 * sont disposés en dessous. L'ensemble tient sur une seule page A4 paysage.
 */
import * as React from "react";
import "./OCTReport.css";
import type { EyeData, OCTReportData } from "../../types/report";
import RetinaSchemaSvg, { lesionLegend } from "./visual/RetinaSchemaSvg";
import { generateReport } from "../../features/retinasketch/lib/report/generate";
import { highlightText } from "./highlight";

const stripItem = (s: string) =>
  s.replace(/^\s*[\-–—•*]\s*/, "").replace(/\*\*([^*]+)\*\*/g, "$1").trim();

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

/** Description clinique des lésions dessinées (façon module RetinaSketch). */
function lesionLines(eye: EyeData): string[] {
  const anns = eye.annotations ?? [];
  const lat = eye.code === "OD" ? "OD" : "OS";
  const text = generateReport(anns, lat);
  return text
    .split("\n")
    .slice(1) // 1re ligne = libellé de l'œil, déjà affiché par ailleurs
    .map((l) => l.replace(/^•\s*/, "").trim())
    .filter(Boolean);
}

/** Colonne schéma agrandie (photo + annotations + légende). */
function EyeSchema({ eye }: { eye: EyeData }) {
  const impossible = eye.acquisitionQuality === "impossible";
  const isFaible = eye.acquisitionQuality === "faible";
  const legend = lesionLegend(eye.annotations);
  const faible = isFaible && eye.acquisitionQualityReasons?.length
    ? eye.acquisitionQualityReasons.join(" · ")
    : "";

  return (
    <div className="rl-eye">
      <div className="vc-cap">
        <span className="vc-eye-code">{eye.code}</span>
        {/* Indice faible → bulle unique (⚠ + motif) sur la même ligne que OD/OG. */}
        {isFaible ? (
          <span className="vc-acq-motif">
            <span className="vc-acq-warn" aria-hidden>⚠</span>
            {faible || "Indice d'acquisition faible"}
          </span>
        ) : eye.acquisitionQuality ? (
          <span className={`vc-acq vc-acq-${eye.acquisitionQuality}`}>
            {eye.acquisitionQuality === "bon" ? "✓ Bon" : "✗ Impossible"}
          </span>
        ) : null}
      </div>
      {impossible ? (
        <div className="vc-impossible">
          Analyse impossible
          {eye.acquisitionQualityReasons && eye.acquisitionQualityReasons.length > 0 && (
            <div className="vc-reasons">{eye.acquisitionQualityReasons.join(" · ")}</div>
          )}
        </div>
      ) : (
        <>
          <div className="rl-schema">
            <RetinaSchemaSvg
              side={eye.code}
              annotations={eye.annotations}
              background={eye.retinaBackground}
              layers={eye.retinaLayers}
              annotationOpacity={eye.retinaAnnotationOpacity}
            />
          </div>
          {legend.length > 0 && (
            <div className="vc-lesion-legend">
              {legend.map((l) => (
                <span key={l.id}><i style={{ background: l.color }} />{l.name}</span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Bloc « Description des lésions » d'un œil (façon RetinaSketch). */
function LesionDescription({ eye }: { eye: EyeData }) {
  if (eye.acquisitionQuality === "impossible") return null;
  const lines = lesionLines(eye);
  return (
    <div className="rl-lesion-eye">
      <span className="rl-lesion-code">{eye.code}</span>
      {lines.length > 0 ? (
        <ul className="rl-lesion-list">
          {lines.map((l, i) => (
            <li key={i} contentEditable="true" suppressContentEditableWarning={true}>{l}</li>
          ))}
        </ul>
      ) : (
        <span className="rl-lesion-none">Fond d'œil sans particularité annotée.</span>
      )}
    </div>
  );
}

const RetinographyReport: React.FC<{ data: OCTReportData }> = ({ data }) => {
  const d = data;

  const suiviItems: string[] = [];
  if (d.prochainControleOCT) suiviItems.push(`Prochain contrôle : ${d.prochainControleOCT}`);
  (d.suivi ?? []).forEach((s) => {
    const t = stripItem(s);
    if (t && !/prochain\s+contr/i.test(t)) suiviItems.push(t);
  });
  if (d.examenComplementaire) suiviItems.push(`Examen complémentaire : ${d.examenComplementaire}`);
  if (d.conseilPatient) suiviItems.push(`Conseil : ${stripItem(d.conseilPatient)}`);

  return (
    <div className="page rl-landscape">
      {/* ══ HEADER compact ══ */}
      <header className="masthead rl-masthead">
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
      <section className="meta rl-meta">
        <div className="meta-cell">
          <div className="meta-label">Patient</div>
          <div className="meta-value">
            <span contentEditable="true" suppressContentEditableWarning={true}>{d.patient.surname}</span>
            &nbsp;<span className="soft">· {d.patient.age} ans · {d.patient.sex}</span>
          </div>
        </div>
        <div className="meta-cell">
          <div className="meta-label">Prescripteur</div>
          <div className="meta-value" contentEditable="true" suppressContentEditableWarning={true}>{d.prescriber}</div>
        </div>
        <div className="meta-cell">
          <div className="meta-label">Motif</div>
          <div className="meta-value" contentEditable="true" suppressContentEditableWarning={true}>{d.indication.main}</div>
        </div>
        <div className="meta-cell">
          <div className="meta-label">Antécédents</div>
          <div className="meta-value" contentEditable="true" suppressContentEditableWarning={true}>{d.history}</div>
        </div>
      </section>

      {/* ══ MAIN paysage : schémas pleine largeur en haut, texte en dessous ══ */}
      <div className="rl-main">
        {/* Haut : les deux rétinographies occupent toute la largeur */}
        <div className="rl-schemas">
          <EyeSchema eye={d.eyes.od} />
          <EyeSchema eye={d.eyes.og} />
        </div>

        {/* Bas : items texte */}
        <div className="rl-side">
          {/* Description des lésions (OD | OG) sur toute la largeur */}
          <div className="rl-block rl-block-wide">
            <span className="clin-block-tag">Description des lésions</span>
            <div className="rl-lesions">
              <LesionDescription eye={d.eyes.od} />
              <LesionDescription eye={d.eyes.og} />
            </div>
          </div>

          {/* Analyse · Conclusion · Suivi en colonnes */}
          <div className="rl-textcols">
            <div className="rl-block">
              <span className="clin-block-tag">Analyse clinique</span>
              <p className="rl-body" contentEditable="true" suppressContentEditableWarning={true}>
                {highlightText(d.analyseClinic)}
              </p>
            </div>

            <div className="rl-block">
              <div className="rl-block-head">
                <span className="clin-block-tag">Conclusion</span>
                {d.badge && <span className={`sev-badge sev-${d.badge.variant}`}>{d.badge.label}</span>}
              </div>
              <p className="rl-body" contentEditable="true" suppressContentEditableWarning={true}>
                {highlightText(d.conclusion)}
              </p>
            </div>

            {suiviItems.length > 0 && (
              <div className="rl-block">
                <span className="clin-block-tag">Suivi</span>
                <ul className="rl-suivi">
                  {suiviItems.map((s, i) => (
                    <li key={i} contentEditable="true" suppressContentEditableWarning={true}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══ SIGNATURE ══ */}
      <footer className="sign-block rl-sign">
        <div className="sign-right">
          <div className="sign-doctor">
            <span className="dr">{d.signature.doctorTitle}</span>{" "}
            <span contentEditable="true" suppressContentEditableWarning={true}>{d.signature.doctorName}</span>
          </div>
          <div className="sign-spec" contentEditable="true" suppressContentEditableWarning={true}>{d.signature.specialty}</div>
          <div className="sign-contact" contentEditable="true" suppressContentEditableWarning={true}>
            {d.signature.email} · {d.signature.phone}
          </div>
          <div className="sign-line" />
        </div>
      </footer>
    </div>
  );
};

export default RetinographyReport;
