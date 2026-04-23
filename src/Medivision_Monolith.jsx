import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  ClipboardList, Printer, RefreshCw, AlertTriangle, CheckCircle, 
  Stethoscope, ChevronLeft, FileImage, UploadCloud, X, Edit3, Zap,
  ChevronDown, ChevronRight, Star, Settings, Trash2, Key, Eye, EyeOff,
  Shield, TestTube, FileText, RotateCcw, Sparkles, Download, Clock, PlusCircle
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════
//  1. CONFIGURATION & CONSTANTES CLINIQUES (DÉFAUTS)
// ═══════════════════════════════════════════════════════════════════

const DEFAULT_PREFS = {
  doctors: ["Dr. Milebou", "Dr. Kougou Ntoutoume", "Dr. Bongo", "Dr. Nyinko Aboughe", "Dr. Gabin", "Dr. Mekyna", "Dr. Matsanga", "Dr. Njilekissa", "Dr. Apedo", "Dr. Souleyman", "Pr. Mba Aki"],
  antecedents: ["Sans particularité", "Excavation papillaire", "Diabète type 2", "HTA", "Glaucome", "Chirurgie cataracte", "Hypertonie oculaire", "Myopie forte", "DMLA", "Neuropathie optique", "Uvéite", "Cataracte", "Maculopathie diabétique", "Rétinopathie hypertensive"],
  motifs: ["Suspicion d'un glaucome", "Excavation papillaire bilatérale", "Hypertonie oculaire", "Pâleur papillaire", "Recherche d'une rétinopathie diabétique", "Bilan visuel", "BAV", "Remaniement maculaire", "Suivi d'un glaucome", "Suivi rétinopathie diabétique", "Suspicion de kératocône", "Suspicion d'OVCR", "Suspicion de DMLA", "Neuropathie optique"],
  acqMotifs: ["Cataracte", "Nystagmus", "Problème de fixation", "Opacités cornéennes", "Sécheresse oculaire sévère", "Ptosis", "Trouble des milieux"],
  obsFavoris: ["Sans particularité", "Membrane épirétinienne", "Drusens", "Œdème maculaire cystoïde", "Traction vitréo-maculaire", "Décollement séreux rétinien", "Hémorragies en flammèches", "Micro-anévrismes", "Exsudats maculaires", "Excavation modérée", "Pâleur papillaire"],
  obsAnterieur: ["Sans particularité", "Amincissement focal (suspect kératocône)", "Bomboement cornéen inférieur", "Cicatrices cornéennes", "Stries de Vogt", "Œdème cornéen", "Infiltrat", "Guttata", "Dystrophie de Fuchs", "Opacité cristallinienne"],
  obsOCTA: ["Sans particularité", "Diminution de la densité vasculaire", "Néovaisseaux", "Désorganisation maille capillaire", "Territoires ischémiques", "Absence de néovaisseaux", "Élargissement de la ZAF", "Raréfaction capillaire périfovéolaire"],
  obsPapille: ["Sans particularité", "Contours nets", "Contours flous", "Bords réguliers", "Excavation modérée", "Excavation marquée", "Pâleur papillaire", "Encoche rebord neuro-rétinien", "Hémorragies papillaires", "Raréfaction vasculaire péripapillaire", "Papille pâle", "Atrophie péripapillaire", "Tilted disc", "Drusen papillaires"],
  obsMacula: ["Sans particularité", "Reflet maculaire suspect", "Drusens", "Exsudats maculaires", "Œdème maculaire", "Membrane épirétinienne", "Décollement séreux", "Trou maculaire", "Menace trou lamellaire", "Remaniement de l'épithélium pigmentaire", "Atrophie maculaire"],
  obsVasc: ["Sans particularité", "Tortuosités veineuses", "Hémorragies en flammèches", "Hémorragies punctiformes", "Micro-anévrismes", "Néovaisseaux", "Nodules cotonneux", "Exsudats secs", "Ischémie rétinienne", "Engainement vasculaire", "Occlusion veineuse"],
  obsPeriph: ["Sans particularité", "Déchirure rétinienne", "Décollement rétinien", "Dégénérescence palissadique", "Givre rétinien", "Trou rond atrophique"],
};

const RNFL_OPTIONS = ["Dans les normes", "Inférieur aux normes", "Dans les limites inférieures de la norme", "Supérieur aux normes", "Inférieur aux normes dans l'ensemble des cadrans"];
const EVOLUTION_OPTIONS = ["Stable", "Diminution (amincissement)", "Augmentation (épaississement)", "Fluctuant", "Non évaluable"];
const LOC_PAPILLAIRE = ["cadran papillaire supérieur", "cadran papillaire inférieur", "cadran papillaire temporal inférieur", "cadran papillaire temporal supérieur", "cadrans papillaires temporal sup. et inf.", "cadran papillaire nasal inférieur", "cadran papillaire nasal supérieur"];
const LOC_MACULAIRE = [
  "ensemble des cadrans maculaires", "cadran maculaire supérieur", "cadran maculaire inférieur", 
  "cadran maculaire temporal inférieur", "cadran maculaire temporal supérieur", "cadrans maculaires temporal sup. et inf.",
  "cadran maculaire nasal inférieur", "cadran maculaire nasal supérieur", "cadrans maculaires nasal sup. et inf."
];
const REPORT_TYPES = ["Compte rendu OCT", "Compte rendu Rétinographie", "Compte rendu OCT + Rétinographie", "OCT du Segment Antérieur"];
const NORMAL_VALUES = ["Sans particularité", "Dans les normes", "Stable", "—", "", "Contours nets", "Bords réguliers", "Absence de néovaisseaux", "Bon", "Supérieur aux normes", "Impossible"];

const EXCLUSIONS = {
  obsAnterieur: [["Sans particularité", "Amincissement focal (suspect kératocône)"]],
  obsOCTA: [["Néovaisseaux", "Absence de néovaisseaux"]],
  obsPapille: [["Contours nets", "Contours flous"], ["Excavation modérée", "Excavation marquée"]],
};

// ═══════════════════════════════════════════════════════════════════
//  1b. SYSTEM PROMPT AMÉLIORÉ
// ═══════════════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `Tu es un ophtalmologue senior spécialisé en imagerie oculaire (OCT, rétinographie, OCTA).
Tu reçois des données cliniques structurées, potentiellement enrichies d'une pré-analyse clinique automatisée ("analyse_clinique").

MÉTHODOLOGIE OBLIGATOIRE :
1. IDENTIFIER les anomalies objectives fournies.
2. INTÉGRER l'historique (ex: suivi RNFL/GCL) pour définir la stabilité ou l'évolution.
3. CORRÉLER avec le motif d'examen et les antécédents.
4. CONCLURE en répondant directement au motif d'examen.

RÈGLE D'OR ABSOLUE :
Tu ne dois générer une section dans 'interpretation' QUE si des données pertinentes t'ont été transmises pour cette structure. 
Si on ne te transmet aucune donnée sur la macula ou la papille (ex: examen du segment antérieur exclusif), N'INCLUS PAS les clés 'macula' ou 'papille' dans le JSON. Ne dis jamais "Non réalisé" ou "Non documenté". Omet simplement la clé.

FORMAT DE RÉPONSE (JSON strict) :
{
  "interpretation": {
    "segment_anterieur": "Analyse du segment antérieur et cornée (si fourni).",
    "synthese_oct": "Synthèse intégrée RNFL/GCL/OCTA (si fourni).",
    "macula": "État maculaire (si fourni).",
    "papille": "État papille/disque (si fourni).",
    "vascularisation": "État vasculaire rétinien (si fourni).",
    "peripherie": "État de la périphérie rétinienne (si fourni)."
  },
  "conclusion": "2-3 phrases répondant DIRECTEMENT au motif d'examen.",
  "recommandations": {
    "hygiene": "Conseils personnalisés.",
    "suivi": "Délai du prochain contrôle + examens complémentaires."
  },
  "severite": "normal|surveillance|alerte"
}

RÈGLES STRICTES :
- Français médical professionnel, concis, décisionnel.
- Répondre UNIQUEMENT avec le JSON.`;

// ═══════════════════════════════════════════════════════════════════
//  2. UTILITAIRES
// ═══════════════════════════════════════════════════════════════════

const createEyeState = () => ({
  acquisitionStatus: "Bon", 
  acquisitionMotif: "",
  
  hasFollowUp: false,
  followUpDate: "",
  rnflEvolution: "Stable",
  gclEvolution: "Stable",

  rnfl: "Dans les normes", rnflLoc: "", gcl: "Dans les normes", gclLoc: "",
  
  cornealThickness: "",
  obsAnterieur: ["Sans particularité"],

  discSurface: "", cupDisc: "",
  obsFavoris: ["Sans particularité"], 
  octaPerformed: false, 
  obsOCTA: ["Sans particularité"],
  obsPapille: ["Sans particularité"], obsMacula: ["Sans particularité"],
  obsVasc: ["Sans particularité"], obsPeriph: ["Sans particularité"],
  obsFree: "", images: [] 
});

const needsLocalisation = (val) => val && val !== "Dans les normes" && val !== "Supérieur aux normes" && val !== "Impossible" && !val.includes("ensemble");

const isAnomaly = (value) => {
  if (!value || value === "—") return false;
  return String(value).split(", ").map(s => s.trim()).some(p => !NORMAL_VALUES.includes(p));
};

const isCupDiscAlert = (value) => {
  if (!value || value === "—" || value === "Impossible") return false;
  const num = parseFloat(String(value).replace(",", "."));
  return !isNaN(num) && num >= 0.7;
};

const hasRealSelection = (arr) => arr.length > 0 && !(arr.length === 1 && arr[0] === "Sans particularité");

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve({ name: file.name, type: file.type, data: reader.result });
  reader.onerror = error => reject(error);
});

// ═══════════════════════════════════════════════════════════════════
//  2b. PRÉ-DIGESTION CLINIQUE
// ═══════════════════════════════════════════════════════════════════

const RNFL_ANOMALY_VALUES = ["Inférieur aux normes", "Dans les limites inférieures de la norme", "Inférieur aux normes dans l'ensemble des cadrans"];
const OBS_NORMAL_VALUES = ["Sans particularité", "Contours nets", "Bords réguliers", "Absence de néovaisseaux"];

function buildClinicalSummary(eye, side, isOCT, showAnterior, showPosterior) {
  const label = side === "OD" ? "Œil droit" : "Œil gauche";
  const anomalies = [];
  const patterns = [];
  let suspicion = null;

  if (eye.acquisitionStatus === "Impossible") return { lateralite: label, qualite_acquisition: "Impossible", suspicion: "Analyse impossible" };

  if (isOCT && showPosterior) {
    if (RNFL_ANOMALY_VALUES.includes(eye.rnfl)) anomalies.push(`RNFL ${eye.rnfl.toLowerCase()} (${eye.rnflLoc || 'global'})`);
    if (RNFL_ANOMALY_VALUES.includes(eye.gcl)) anomalies.push(`GCL++ ${eye.gcl.toLowerCase()} (${eye.gclLoc || 'global'})`);
    
    if (eye.hasFollowUp) {
      if (eye.rnflEvolution.includes("Diminution")) patterns.push(`Amincissement progressif du RNFL depuis le ${eye.followUpDate}`);
      if (eye.gclEvolution.includes("Diminution")) patterns.push(`Amincissement progressif du GCL depuis le ${eye.followUpDate}`);
    }
  }

  if (showAnterior) {
    if (eye.obsAnterieur.some(o => o.includes("kératocône") || o.includes("Amincissement"))) {
      patterns.push(`Pachymétrie: ${eye.cornealThickness}µm avec signes suspects de kératocône`);
      suspicion = "Kératocône suspect";
    }
  }

  if (showPosterior) {
    const cd = parseFloat(String(eye.cupDisc).replace(",", "."));
    if (!isNaN(cd) && cd >= 0.7) anomalies.push(`C/D vertical élevé (${eye.cupDisc})`);

    const hasDrusens = (eye.obsMacula || []).some(o => o.includes("Drusens"));
    if (hasDrusens) suspicion = suspicion || "DMLA débutante";
    if (anomalies.length > 0 && cd >= 0.7) suspicion = suspicion || "Neuropathie optique glaucomateuse";
  }

  return { lateralite: label, anomalies, patterns, suspicion: suspicion || "Examen sans anomalie majeure évidente" };
}

// ═══════════════════════════════════════════════════════════════════
//  2c. VALIDATION JSON IA
// ═══════════════════════════════════════════════════════════════════

function safeParseJSON(text) {
  if (!text || typeof text !== "string") return { ok: false, data: null, error: "Réponse vide" };
  let cleaned = text.trim();
  const jsonStart = cleaned.indexOf("{");
  const jsonEnd = cleaned.lastIndexOf("}");
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
  try { return { ok: true, data: JSON.parse(cleaned), error: null }; } 
  catch (e) { return { ok: false, data: null, error: `Erreur de parsing : ${e.message}` }; }
}

function validateAIResponse(obj) {
  const issues = [];
  if (!obj) return { valid: false, score: "rouge", issues: ["Objet null"] };
  if (!obj.conclusion) issues.push("Conclusion manquante");
  if (!obj.recommandations) issues.push("Recommandations manquantes");
  return { valid: issues.length === 0, score: issues.length === 0 ? "vert" : "orange", issues };
}

// ═══════════════════════════════════════════════════════════════════
//  2d. EXPORT WORD NATIF
// ═══════════════════════════════════════════════════════════════════

function buildWordDocument(data, aiResult) {
  if (!data || !aiResult) return "";

  const interp = aiResult.interpretation || {};
  const recos = aiResult.recommandations || {};
  
  const showAnt = data.contexte.showAnterior;
  const showPost = data.contexte.showPosterior;

  const makeRow = (label, od, og) => `
    <tr>
      <td style="padding:5px; border-bottom:1px solid #ddd; font-weight:bold; color:#0C2233;">${label}</td>
      <td style="padding:5px; border-bottom:1px solid #ddd; text-align:center;">${od || "—"}</td>
      <td style="padding:5px; border-bottom:1px solid #ddd; text-align:center;">${og || "—"}</td>
    </tr>
  `;

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Calibri', Arial, sans-serif; font-size: 11pt; color: #333; line-height: 1.4; }
        h1 { color: #0C2233; font-size: 18pt; margin-bottom: 0; text-align: center; }
        h2 { color: #2A9D8F; font-size: 12pt; border-bottom: 1px solid #2A9D8F; padding-bottom: 3px; margin-top: 20px; }
        .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #0C2233; padding-bottom: 10px; }
        .meta-table { width: 100%; margin-bottom: 20px; background-color: #f9f9f9; }
        .meta-table td { padding: 5px; }
        .data-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .data-table th { background-color: #0C2233; color: #ffffff; padding: 5px; text-align: left; }
        .text-block { margin-bottom: 10px; }
        .label { font-weight: bold; color: #0C2233; }
        .conclusion { border: 2px solid #2A9D8F; padding: 10px; font-style: italic; background-color: #f0f9f8; }
        .footer { text-align: right; margin-top: 40px; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>CLINIQUE MEDIVISION</h1>
        <p style="margin:0; font-size:9pt; color:#666;">OPHTALMOLOGIE · LIBREVILLE, GABON</p>
        <h2 style="border:none; margin-top:10px; color:#0C2233;">${data.type_cr} - ${data.date_examen}</h2>
      </div>

      <table class="meta-table">
        <tr>
          <td><span class="label">Patient :</span> ${data.patient?.nom} (${data.patient?.age} ans)</td>
          <td><span class="label">Prescripteur :</span> ${data.contexte?.prescripteur}</td>
        </tr>
        <tr>
          <td><span class="label">Motif :</span> ${(data.contexte?.motifs || []).join(", ")}</td>
          <td><span class="label">Antécédents :</span> ${(data.contexte?.antecedents || []).join(", ")}</td>
        </tr>
      </table>

      <h2>Données de l'examen</h2>
      ${showAnt ? `
        <h3 style="color:#0C2233; font-size:11pt;">Segment Antérieur</h3>
        <table class="data-table">
          <tr><th>Paramètre</th><th style="text-align:center;">Œil Droit</th><th style="text-align:center;">Œil Gauche</th></tr>
          ${makeRow("Pachymétrie", data.oeil_droit?.segment_anterieur?.pachymetrie ? data.oeil_droit.segment_anterieur.pachymetrie + ' µm' : '—', data.oeil_gauche?.segment_anterieur?.pachymetrie ? data.oeil_gauche.segment_anterieur.pachymetrie + ' µm' : '—')}
          ${makeRow("Cornée", (data.oeil_droit?.segment_anterieur?.observations||[]).join(", "), (data.oeil_gauche?.segment_anterieur?.observations||[]).join(", "))}
        </table>
      ` : ''}

      ${showPost ? `
        <h3 style="color:#0C2233; font-size:11pt;">Segment Postérieur</h3>
        <table class="data-table">
          <tr><th>Paramètre</th><th style="text-align:center;">Œil Droit</th><th style="text-align:center;">Œil Gauche</th></tr>
          ${data.type_cr.includes("OCT") ? `
            ${makeRow("RNFL", data.oeil_droit?.oct?.rnfl, data.oeil_gauche?.oct?.rnfl)}
            ${makeRow("GCL++", data.oeil_droit?.oct?.gcl_pp, data.oeil_gauche?.oct?.gcl_pp)}
          ` : ''}
          ${makeRow("Cup/Disc", data.oeil_droit?.disque?.cup_disc_vertical, data.oeil_gauche?.disque?.cup_disc_vertical)}
          ${makeRow("Papille", (data.oeil_droit?.retino?.papille||[]).join(", "), (data.oeil_gauche?.retino?.papille||[]).join(", "))}
          ${makeRow("Macula", (data.oeil_droit?.retino?.macula||[]).join(", "), (data.oeil_gauche?.retino?.macula||[]).join(", "))}
          ${makeRow("Vaisseaux", (data.oeil_droit?.retino?.vascularisation||[]).join(", "), (data.oeil_gauche?.retino?.vascularisation||[]).join(", "))}
        </table>
      ` : ''}

      <h2>Interprétation Médicale</h2>
      ${interp.segment_anterieur ? `<div class="text-block"><span class="label">Segment Antérieur :</span> ${interp.segment_anterieur}</div>` : ''}
      ${interp.synthese_oct ? `<div class="text-block"><span class="label">Synthèse OCT :</span> ${interp.synthese_oct}</div>` : ''}
      ${interp.macula ? `<div class="text-block"><span class="label">Macula :</span> ${interp.macula}</div>` : ''}
      ${interp.papille ? `<div class="text-block"><span class="label">Papille :</span> ${interp.papille}</div>` : ''}
      ${interp.vascularisation ? `<div class="text-block"><span class="label">Vascularisation :</span> ${interp.vascularisation}</div>` : ''}
      ${interp.peripherie ? `<div class="text-block"><span class="label">Périphérie :</span> ${interp.peripherie}</div>` : ''}

      <h2>Conclusion</h2>
      <div class="conclusion">${aiResult.conclusion || "—"}</div>

      <h2>Recommandations</h2>
      <div class="text-block"><span class="label">Hygiène :</span> ${recos.hygiene || "—"}</div>
      <div class="text-block"><span class="label">Suivi :</span> ${recos.suivi || "—"}</div>

      <div class="footer">
        Dr. Yoan MBOUSSOU<br>
        <span style="font-size:9pt; font-weight:normal; color:#666;">Imagerie Rétinienne</span>
      </div>
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `CR_${data.patient?.nom?.replace(/\s+/g, '_') || 'patient'}_${data.date_examen}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════════════════════
//  3. APPELS API (Moteur IA Natif)
// ═══════════════════════════════════════════════════════════════════

const fetchWithExponentialBackoff = async (url, payload, retries = 5, baseDelay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
      return await response.json();
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(res => setTimeout(res, baseDelay * Math.pow(2, i)));
    }
  }
};

const callNativeGemini = async (jsonData, imagesOD, imagesOG) => {
  const apiKey = ""; 
  const modelId = "gemini-2.5-flash-preview-09-2025";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
  
  const parts = [{ text: `Données cliniques de l'examen : ${JSON.stringify(jsonData)}` }];

  if (imagesOD.length > 0) {
    parts.push({ text: "Images associées à l'Œil Droit (OD) :" });
    imagesOD.forEach(img => parts.push({ inlineData: { mimeType: img.type, data: img.data.split(',')[1] } }));
  }
  if (imagesOG.length > 0) {
    parts.push({ text: "Images associées à l'Œil Gauche (OG) :" });
    imagesOG.forEach(img => parts.push({ inlineData: { mimeType: img.type, data: img.data.split(',')[1] } }));
  }

  const payload = {
    contents: [{ role: "user", parts }],
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    generationConfig: { responseMimeType: "application/json" }
  };

  const result = await fetchWithExponentialBackoff(url, payload);
  const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
  const parsed = safeParseJSON(rawText);
  if (!parsed.ok) throw new Error(`Réponse IA invalide : ${parsed.error}`);
  return parsed.data;
};

const callNativeGeminiText = async (systemPrompt, userText) => {
  const apiKey = "";
  const modelId = "gemini-2.5-flash-preview-09-2025";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
  
  const payload = {
    contents: [{ role: "user", parts: [{ text: userText }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] }
  };

  const result = await fetchWithExponentialBackoff(url, payload);
  return result.candidates?.[0]?.content?.parts?.[0]?.text || "";
};

// ═══════════════════════════════════════════════════════════════════
//  4. COMPOSANTS UI - SAISIE
// ═══════════════════════════════════════════════════════════════════

const ChipGroup = ({ label, icon, chips, selected, onToggle, onAddCustom, norms = ["Sans particularité"], exclusions = [] }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [custom, setCustom] = useState("");

  const handleToggle = (chip) => {
    if (norms.includes(chip)) return onToggle([chip]);
    let next = selected.includes(chip) ? selected.filter(x => x !== chip) : [...selected.filter(x => !norms.includes(x)), chip];
    if (!next.length) next = [norms[0]];
    if (!selected.includes(chip)) {
      exclusions.forEach(([a, b]) => {
        if (chip === a) next = next.filter(x => x !== b);
        if (chip === b) next = next.filter(x => x !== a);
      });
    }
    onToggle(next);
  };

  const handleAdd = () => {
    if (custom.trim()) {
      if (onAddCustom) onAddCustom(custom.trim());
      onToggle([...selected.filter(x => !norms.includes(x)), custom.trim()]);
      setCustom(""); setShowAdd(false);
    }
  };

  return (
    <div className="mb-2">
      {label && <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">{icon} {label}</div>}
      <div className="flex flex-wrap gap-2">
        {chips.map(c => (
          <span key={c} onClick={() => handleToggle(c)} className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer border transition-colors ${selected.includes(c) ? 'bg-teal-50 border-teal-500 text-teal-700 font-bold shadow-sm' : 'bg-white border-slate-200 text-slate-700 hover:border-teal-300'}`}>{c}</span>
        ))}
        {showAdd ? (
          <div className="flex items-center gap-1">
            <input autoFocus className="px-2 py-1 border border-teal-300 rounded-full text-xs outline-none focus:ring-1 focus:ring-teal-500 min-w-[120px]" placeholder="Saisir..." value={custom} onChange={e => setCustom(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setShowAdd(false); }} />
            <button onClick={handleAdd} className="bg-teal-500 text-white px-2 py-1 rounded-full text-xs font-bold hover:bg-teal-600 transition-colors">OK</button>
            <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-600 p-1"><X className="w-3 h-3"/></button>
          </div>
        ) : (
          <span onClick={() => setShowAdd(true)} className="px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer border border-dashed border-slate-300 text-slate-500 hover:bg-slate-50 flex items-center">＋ Autre</span>
        )}
      </div>
    </div>
  );
};

const CollapsibleSection = ({ title, icon, selectedData, children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const activeCount = hasRealSelection(selectedData) ? selectedData.length : 0;
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white mb-2 shadow-sm">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full p-2.5 bg-slate-50 hover:bg-slate-100 transition-colors flex justify-between items-center outline-none">
        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
          {icon && <span className="text-[12px]">{icon}</span>} {title}
          {activeCount > 0 && <span className="bg-teal-500 text-white px-1.5 py-0.5 rounded text-[9px] font-black leading-none ml-1">{activeCount}</span>}
        </span>
        {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
      </button>
      {isOpen && <div className="p-3 border-t border-slate-100 bg-white">{children}</div>}
    </div>
  );
};

const ImageUploader = ({ images, onUpload, onRemove }) => {
  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    for (let file of files) {
      if (file.type.startsWith('image/')) {
        const base64 = await fileToBase64(file);
        onUpload(base64);
      }
    }
  };
  return (
    <div className="mt-4 p-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-slate-600 uppercase flex items-center gap-2"><FileImage className="w-4 h-4" /> Annexes (Images)</span>
        <label className="bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer hover:bg-teal-50 hover:text-teal-700 transition-colors flex items-center gap-2">
          <UploadCloud className="w-4 h-4" /> Ajouter
          <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileChange} />
        </label>
      </div>
      {images.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 mt-2">
          {images.map((img, i) => (
            <div key={i} className="relative aspect-square rounded-lg border border-slate-200 overflow-hidden group">
              <img src={img.data} alt="Upload" className="w-full h-full object-cover" />
              <button onClick={() => onRemove(i)} className="absolute top-1 right-1 bg-white/90 p-1 rounded-md text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-xs text-slate-400 py-4 italic">Aucune image jointe.</div>
      )}
    </div>
  );
};

const EyeForm = ({ side, label, color, eye, onChange, isOCT, prefs, updatePrefs, showAnterior, showPosterior }) => {
  const update = (k, v) => onChange({ ...eye, [k]: v });
  const [showAddAcqMotif, setShowAddAcqMotif] = useState(false);
  const [newAcqMotif, setNewAcqMotif] = useState("");

  const handleAddAcqMotif = () => {
    if (newAcqMotif.trim()) {
      updatePrefs('acqMotifs', newAcqMotif.trim());
      update("acquisitionMotif", newAcqMotif.trim());
      setNewAcqMotif(""); setShowAddAcqMotif(false);
    }
  };

  return (
    <div className="flex-1 min-w-[320px] bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      <div className="p-3 text-white font-bold text-sm tracking-wide flex items-center gap-2" style={{ backgroundColor: color }}>👁️ {label}</div>
      <div className="p-4 flex-1">
        
        <div className="mb-4 p-3 bg-slate-50 border border-slate-100 rounded-lg">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">📊 Indice d'acquisition</div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => onChange({...eye, acquisitionStatus: "Bon", acquisitionMotif: ""})} className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-colors ${eye.acquisitionStatus === "Bon" ? 'bg-teal-50 border-teal-500 text-teal-700' : 'bg-white border-slate-200 text-slate-600'}`}>✓ Bon</button>
            <button onClick={() => update("acquisitionStatus", "Faible")} className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-colors ${eye.acquisitionStatus === "Faible" ? 'bg-orange-50 border-orange-500 text-orange-700' : 'bg-white border-slate-200 text-slate-600'}`}>⚠ Faible</button>
            <button onClick={() => update("acquisitionStatus", "Impossible")} className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-colors ${eye.acquisitionStatus === "Impossible" ? 'bg-red-50 border-red-500 text-red-700' : 'bg-white border-slate-200 text-slate-600'}`}>❌ Impossible</button>
          </div>
          {eye.acquisitionStatus !== "Bon" && (
            <div className="mt-3">
              <div className="flex gap-2">
                <select className="flex-1 p-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-teal-500" value={eye.acquisitionMotif} onChange={e => update("acquisitionMotif", e.target.value)}>
                  <option value="">— Préciser le motif —</option>
                  {prefs.acqMotifs.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                {showAddAcqMotif ? (
                  <div className="flex items-center gap-1">
                    <input autoFocus className="w-24 px-2 py-1.5 border border-teal-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-teal-500" placeholder="Saisir..."
                      value={newAcqMotif} onChange={e => setNewAcqMotif(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddAcqMotif(); if (e.key === 'Escape') setShowAddAcqMotif(false); }} />
                    <button onClick={handleAddAcqMotif} className="bg-teal-500 text-white px-2 py-1.5 rounded-lg text-xs font-bold hover:bg-teal-600 transition-colors">OK</button>
                    <button onClick={() => setShowAddAcqMotif(false)} className="text-slate-400 hover:text-slate-600 p-1"><X className="w-4 h-4"/></button>
                  </div>
                ) : (
                  <button onClick={() => setShowAddAcqMotif(true)} className="px-3 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 flex items-center justify-center font-bold text-lg leading-none">＋</button>
                )}
              </div>
            </div>
          )}
        </div>

        {isOCT && eye.acquisitionStatus !== "Impossible" && showPosterior && (
          <div className="mb-4 space-y-4">
            <div className="border border-slate-200 rounded-lg p-3 bg-white">
              <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                <div className="text-[10px] font-extrabold text-teal-600 uppercase tracking-wider">Suivi RNFL / GCL</div>
                <div className="flex gap-2">
                  <button onClick={() => update("hasFollowUp", true)} className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-colors ${eye.hasFollowUp ? 'bg-teal-50 border-teal-500 text-teal-700' : 'bg-white border-slate-200 text-slate-600'}`}>OUI</button>
                  <button onClick={() => update("hasFollowUp", false)} className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-colors ${!eye.hasFollowUp ? 'bg-slate-100 border-slate-300 text-slate-700' : 'bg-white border-slate-200 text-slate-600'}`}>NON</button>
                </div>
              </div>
              
              {eye.hasFollowUp && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Date ancien examen</label>
                    <input type="date" className="w-full p-2 border border-slate-200 rounded-lg text-xs" value={eye.followUpDate} onChange={e => update("followUpDate", e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Évolution RNFL</label>
                      <select className="w-full p-2 border border-slate-200 rounded-lg text-xs" value={eye.rnflEvolution} onChange={e => update("rnflEvolution", e.target.value)}>
                        {EVOLUTION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Évolution GCL++</label>
                      <select className="w-full p-2 border border-slate-200 rounded-lg text-xs" value={eye.gclEvolution} onChange={e => update("gclEvolution", e.target.value)}>
                        {EVOLUTION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="text-[10px] font-extrabold text-teal-600 uppercase tracking-wider mb-2 border-b border-teal-100 pb-1">Mesures actuelles OCT</div>
            <div className="grid grid-cols-2 gap-3 mb-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">RNFL</label>
                <select className="w-full p-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-teal-500" value={eye.rnfl} onChange={e => onChange({...eye, rnfl: e.target.value, rnflLoc: needsLocalisation(e.target.value) ? eye.rnflLoc : ""})}>
                  {RNFL_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              {needsLocalisation(eye.rnfl) && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Localisation RNFL</label>
                  <select className="w-full p-2 border border-slate-200 rounded-lg text-xs" value={eye.rnflLoc} onChange={e => update("rnflLoc", e.target.value)}>
                    <option value="">— Préciser —</option>
                    {LOC_PAPILLAIRE.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">GCL++</label>
                <select className="w-full p-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-teal-500" value={eye.gcl} onChange={e => onChange({...eye, gcl: e.target.value, gclLoc: needsLocalisation(e.target.value) ? eye.gclLoc : ""})}>
                  {RNFL_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              {needsLocalisation(eye.gcl) && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Localisation GCL</label>
                  <select className="w-full p-2 border border-slate-200 rounded-lg text-xs" value={eye.gclLoc} onChange={e => update("gclLoc", e.target.value)}>
                    <option value="">— Préciser —</option>
                    {LOC_MACULAIRE.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>
        )}

        {isOCT && eye.acquisitionStatus !== "Impossible" && showAnterior && (
          <div className="mb-4">
            <div className="border border-slate-200 rounded-lg p-3 bg-indigo-50/50 mt-2">
              <div className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-wider mb-2 border-b border-indigo-100 pb-1">OCT Segment Antérieur</div>
              <div className="space-y-3 animate-in fade-in">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Épaisseur cornéenne centrale (µm)</label>
                  <input type="number" className="w-full p-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-400" placeholder="Ex: 540" value={eye.cornealThickness} onChange={e => update("cornealThickness", e.target.value)} />
                </div>
                <ChipGroup label="Signes Cornéens" chips={prefs.obsAnterieur || DEFAULT_PREFS.obsAnterieur} selected={eye.obsAnterieur} onToggle={v => update("obsAnterieur", v)} exclusions={EXCLUSIONS.obsAnterieur} />
              </div>
            </div>
          </div>
        )}

        {eye.acquisitionStatus !== "Impossible" && showPosterior && (
          <div className="mb-6">
            <div className="text-[10px] font-extrabold text-teal-600 uppercase tracking-wider mb-2 border-b border-teal-100 pb-1 mt-4">Disque optique</div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Surface (mm²)</label><input type="number" step="0.1" className="w-full p-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-teal-500" placeholder="Ex: 2.1" value={eye.discSurface} onChange={e => update("discSurface", e.target.value)} /></div>
              <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">C/D vertical</label><input type="number" step="0.1" className="w-full p-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-teal-500" placeholder="Ex: 0.4" value={eye.cupDisc} onChange={e => update("cupDisc", e.target.value)} /></div>
            </div>
          </div>
        )}

        {showPosterior && (
          <>
            <div className="text-[10px] font-extrabold text-teal-600 uppercase tracking-wider mb-3 border-b border-teal-100 pb-1 mt-4">Observations Morphologiques</div>
            <div className="mb-4">
              <ChipGroup label="FAVORIS (Observations Courantes)" icon={<Star className="w-3.5 h-3.5 text-amber-400" />} chips={prefs.obsFavoris} selected={eye.obsFavoris} onToggle={v => update("obsFavoris", v)} onAddCustom={v => updatePrefs('obsFavoris', v)} />
            </div>
            <div className="space-y-1 mb-4 bg-slate-50 p-2 rounded-xl border border-slate-200">
              <CollapsibleSection title="Papille" icon="◉" selectedData={eye.obsPapille}>
                <ChipGroup label="" chips={prefs.obsPapille} selected={eye.obsPapille} onToggle={v => update("obsPapille", v)} onAddCustom={v => updatePrefs('obsPapille', v)} exclusions={EXCLUSIONS.obsPapille} />
              </CollapsibleSection>
              <CollapsibleSection title="Macula" icon="◎" selectedData={eye.obsMacula}>
                <ChipGroup label="" chips={prefs.obsMacula} selected={eye.obsMacula} onToggle={v => update("obsMacula", v)} onAddCustom={v => updatePrefs('obsMacula', v)} />
              </CollapsibleSection>
              <CollapsibleSection title="Vascularisation" icon="⟡" selectedData={eye.obsVasc}>
                <ChipGroup label="" chips={prefs.obsVasc} selected={eye.obsVasc} onToggle={v => update("obsVasc", v)} onAddCustom={v => updatePrefs('obsVasc', v)} />
              </CollapsibleSection>
              <CollapsibleSection title="Périphérie" icon="○" selectedData={eye.obsPeriph}>
                <ChipGroup label="" chips={prefs.obsPeriph} selected={eye.obsPeriph} onToggle={v => update("obsPeriph", v)} onAddCustom={v => updatePrefs('obsPeriph', v)} />
              </CollapsibleSection>
              {isOCT && (
                <CollapsibleSection title="OCTA" icon="🔬" selectedData={eye.obsOCTA}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Examen OCTA réalisé ?</div>
                    <div className="flex gap-2">
                      <button onClick={() => update("octaPerformed", true)} className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-colors ${eye.octaPerformed ? 'bg-teal-50 border-teal-500 text-teal-700' : 'bg-white border-slate-200 text-slate-600'}`}>OUI</button>
                      <button onClick={() => update("octaPerformed", false)} className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-colors ${!eye.octaPerformed ? 'bg-slate-100 border-slate-300 text-slate-700' : 'bg-white border-slate-200 text-slate-600'}`}>NON</button>
                    </div>
                  </div>
                  {eye.octaPerformed && (
                    <div className="border-t border-slate-100 pt-3 mt-2">
                      <ChipGroup label="" chips={prefs.obsOCTA} selected={eye.obsOCTA} onToggle={v => update("obsOCTA", v)} onAddCustom={v => updatePrefs('obsOCTA', v)} exclusions={EXCLUSIONS.obsOCTA} />
                    </div>
                  )}
                </CollapsibleSection>
              )}
            </div>
          </>
        )}

        <div className="mt-4 border-t border-slate-100 pt-4">
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Texte libre (Notes additionnelles)</label>
          <textarea className="w-full p-2 border border-slate-200 rounded-lg text-xs h-16 outline-none focus:border-teal-500" value={eye.obsFree} onChange={e => update("obsFree", e.target.value)} />
        </div>

        <ImageUploader images={eye.images} onUpload={(img) => update("images", [...eye.images, img])} onRemove={(idx) => update("images", eye.images.filter((_, i) => i !== idx))} />
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
//  6. COMPOSANTS UI - RENDU / RAPPORT
// ═══════════════════════════════════════════════════════════════════

const EditableInline = ({ value, field, onEdit, className = "" }) => (
  <span contentEditable suppressContentEditableWarning onBlur={(e) => onEdit(field, e.target.innerText)} className={`outline-none hover:bg-teal-50 border-b border-transparent hover:border-teal-300 transition-colors cursor-text inline-block min-w-[20px] ${className}`}>{value}</span>
);

const ReportDataTable = ({ title, rows, edits, onEdit }) => {
  if (!rows || rows.length === 0) return null;
  return (
    <div className="w-full mb-3">
      <div className="text-[11px] font-extrabold text-[#2A9D8F] uppercase tracking-wider mb-1 border-b-2 border-[#2A9D8F33] pb-1">{title}</div>
      <table className="w-full text-[11px] border-collapse table-fixed">
        <thead>
          <tr className="bg-[#0C2233] text-white">
            <th className="p-1.5 text-left w-1/3">Paramètre</th>
            <th className="p-1.5 text-center w-1/3">OD</th>
            <th className="p-1.5 text-center w-1/3">OG</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const valOD = edits[r.fieldOD] !== undefined ? edits[r.fieldOD] : (r.od || "—");
            const valOG = edits[r.fieldOG] !== undefined ? edits[r.fieldOG] : (r.og || "—");

            const colorOD = r.isCupDisc ? (isCupDiscAlert(valOD) ? "text-red-600 font-bold" : "text-slate-600") 
                          : r.isSurface ? "text-slate-600" 
                          : (valOD === "Impossible" ? "text-red-600 font-bold" : isAnomaly(valOD) ? "text-orange-600 font-bold" : "text-slate-600");
            const colorOG = r.isCupDisc ? (isCupDiscAlert(valOG) ? "text-red-600 font-bold" : "text-slate-600") 
                          : r.isSurface ? "text-slate-600" 
                          : (valOG === "Impossible" ? "text-red-600 font-bold" : isAnomaly(valOG) ? "text-orange-600 font-bold" : "text-slate-600");

            return (
              <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-[#2A9D8F0A]"}>
                <td className={`p-1 border-b border-slate-100 ${r.sub ? "pl-4 text-slate-500 italic" : "font-bold text-[#0C2233]"}`}>{r.label}</td>
                <td className={`p-1 text-center border-b border-slate-100 ${colorOD}`}><EditableInline value={valOD} field={r.fieldOD} onEdit={onEdit} /></td>
                <td className={`p-1 text-center border-b border-slate-100 ${colorOG}`}><EditableInline value={valOG} field={r.fieldOG} onEdit={onEdit} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const EditableSection = ({ label, value, onEdit, field }) => {
  if (!value) return null;
  return (
    <div className="group relative py-0.5 border-b border-transparent hover:border-teal-200 transition-colors flex items-start gap-2">
      <span className="text-[11px] font-bold text-[#0C2233] min-w-[140px] uppercase pt-1">{label} :</span>
      <div contentEditable suppressContentEditableWarning onBlur={(e) => onEdit(field, e.target.innerText)} className="text-[12px] text-slate-600 outline-none flex-1 focus:bg-teal-50 p-1 rounded min-h-[20px]">{value}</div>
      <Edit3 className="w-3 h-3 text-teal-300 opacity-0 group-hover:opacity-100 absolute right-0 mt-1" />
    </div>
  );
};

const ValidationBadge = ({ validation }) => {
  if (!validation) return null;
  const colorMap = { vert: "bg-green-100 text-green-700 border-green-300", orange: "bg-amber-100 text-amber-700 border-amber-300", rouge: "bg-red-100 text-red-700 border-red-300" };
  const iconMap = { vert: <CheckCircle className="w-3.5 h-3.5" />, orange: <AlertTriangle className="w-3.5 h-3.5" />, rouge: <AlertTriangle className="w-3.5 h-3.5" /> };
  const labelMap = { vert: "JSON valide", orange: "JSON partiel", rouge: "JSON dégradé" };

  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold ${colorMap[validation.score]}`}>
      {iconMap[validation.score]} {labelMap[validation.score]}
      {validation.issues.length > 0 && (
        <span className="ml-1 opacity-70">({validation.issues.length} problème{validation.issues.length > 1 ? "s" : ""})</span>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
//  7. STYLES D'IMPRESSION (CSS global injecté)
// ═══════════════════════════════════════════════════════════════════

const PrintStyles = () => (
  <style>{`
    @media print {
      body, html { margin: 0 !important; padding: 0 !important; background: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; height: 100vh; overflow: hidden; }
      nav, .no-print, button, .print\\:hidden { display: none !important; }
      
      @page { size: A4 portrait; margin: 0; }
      
      .report-page { 
        box-shadow: none !important; 
        border: none !important; 
        width: 210mm !important;
        height: 296mm !important; /* Fix pour la page fantome */
        margin: 0 auto !important; 
        padding: 12mm 15mm !important;
        box-sizing: border-box !important;
        page-break-after: always;
        overflow: hidden;
      }
      
      .report-page:last-child {
        page-break-after: auto;
      }
      
      .report-page table, .report-page .conclusion-block, .report-page .interpretation-block, .report-page .recommandations-block {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      
      .group .edit-icon, [contenteditable]:hover { background: transparent !important; border-color: transparent !important; }
      
      .bg-\\[\\#0C2233\\] { background-color: #0C2233 !important; }
      th { background-color: #0C2233 !important; color: white !important; }
      
      main { padding: 0 !important; margin: 0 !important; max-width: 100% !important; }
    }
  `}</style>
);

// ═══════════════════════════════════════════════════════════════════
//  8. APPLICATION PRINCIPALE
// ═══════════════════════════════════════════════════════════════════

export default function App() {
  const [view, setView] = useState('form'); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [addingCategory, setAddingCategory] = useState(null);
  const [addingValue, setAddingValue] = useState("");

  const reportRef = useRef(null);
  const sickLeaveRef = useRef(null);

  const [prefs, setPrefs] = useState(() => {
    try {
      const saved = localStorage.getItem('medivision_v9_prefs');
      if (saved) {
        return { ...DEFAULT_PREFS, ...JSON.parse(saved) };
      }
      return DEFAULT_PREFS;
    } catch (e) { return DEFAULT_PREFS; }
  });

  useEffect(() => {
    try { localStorage.setItem('medivision_v9_prefs', JSON.stringify(prefs)); } catch (e) {}
  }, [prefs]);

  const updatePrefs = (key, value) => {
    if (!value || typeof value !== 'string' || !value.trim()) return;
    setPrefs(p => ({ ...p, [key]: [...new Set([...p[key], value.trim()])] }));
  };
  const removePref = (key, value) => setPrefs(p => ({ ...p, [key]: p[key].filter(v => v !== value) }));

  const [patientName, setPatientName] = useState("");
  const [age, setAge] = useState("");
  const [dateExamen, setDateExamen] = useState(() => new Date().toISOString().slice(0, 10));
  const [reportType, setReportType] = useState("Compte rendu OCT");
  const [doctor, setDoctor] = useState("");
  const [showAddDoctor, setShowAddDoctor] = useState(false);
  const [newDoctor, setNewDoctor] = useState("");
  const [antecedents, setAntecedents] = useState(["Sans particularité"]);
  const [showAddAtcd, setShowAddAtcd] = useState(false);
  const [newAtcd, setNewAtcd] = useState("");
  const [motifs, setMotifs] = useState([]);
  const [showAddMotif, setShowAddMotif] = useState(false);
  const [newMotif, setNewMotif] = useState("");
  const [eyeOD, setEyeOD] = useState(createEyeState());
  const [eyeOG, setEyeOG] = useState(createEyeState());

  const [data, setData] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [edits, setEdits] = useState({});
  const [jsonValidation, setJsonValidation] = useState(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Derivations Modulaires
  const isAnteriorBase = reportType === "OCT du Segment Antérieur";
  const [forceShowPosterior, setForceShowPosterior] = useState(false);
  const [forceShowAnterior, setForceShowAnterior] = useState(false);

  useEffect(() => {
    setForceShowPosterior(false);
    setForceShowAnterior(false);
  }, [reportType]);

  const showAnterior = isAnteriorBase || forceShowAnterior;
  const showPosterior = !isAnteriorBase || forceShowPosterior;

  // Nouveaux états pour les outils IA génératifs
  const [sickLeaveContent, setSickLeaveContent] = useState("");
  const [loadingExtra, setLoadingExtra] = useState(false);
  const [sickLeaveDays, setSickLeaveDays] = useState("1");
  const [isExportingSickLeavePdf, setIsExportingSickLeavePdf] = useState(false);

  const toggleAtcd = (item) => setAntecedents(prev => item === "Sans particularité" ? ["Sans particularité"] : prev.includes(item) ? (prev.filter(x => x !== item).length ? prev.filter(x => x !== item) : ["Sans particularité"]) : [...prev.filter(x => x !== "Sans particularité"), item]);
  const toggleMotif = (item) => setMotifs(prev => prev.includes(item) ? prev.filter(x => x !== item) : [...prev, item]);
  const handleEdit = (field, value) => setEdits(prev => ({ ...prev, [field]: value }));
  const getVal = (field, fallback) => edits[field] !== undefined ? edits[field] : fallback;

  const handlePrint = useCallback(() => {
    if (document.activeElement) document.activeElement.blur();
    try { window.print(); } catch (err) { alert("Appuyez sur Ctrl+P ou Cmd+P."); }
  }, []);

  const handleNewPatient = useCallback(() => {
    setPatientName(""); setAge(""); setDateExamen(new Date().toISOString().slice(0, 10));
    setReportType("Compte rendu OCT"); setDoctor("");
    setAntecedents(["Sans particularité"]); setMotifs([]);
    setEyeOD(createEyeState()); setEyeOG(createEyeState());
    setData(null); setAiResult(null); setEdits({}); setJsonValidation(null);
    setSickLeaveContent("");
    setError(null); setView('form');
    window.scrollTo(0, 0);
  }, []);

  const handleExportWord = useCallback(() => {
    buildWordDocument(data, aiResult);
  }, [data, aiResult]);

  const exportElementToPDF = (elementRef, filename, setExportingState) => {
    if (!elementRef.current) return;
    setExportingState(true);

    const generate = () => {
      const opt = {
        margin: [0, 0, 0, 0],
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      
      window.html2pdf().set(opt).from(elementRef.current).save().then(() => {
        setExportingState(false);
      }).catch(err => {
        console.error("Erreur lors de la génération du PDF", err);
        setExportingState(false);
      });
    };

    if (!window.html2pdf) {
      const script = document.createElement('script');
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
      script.onload = generate;
      script.onerror = () => {
        alert("Erreur de chargement du module PDF. Vérifiez votre connexion internet.");
        setExportingState(false);
      };
      document.head.appendChild(script);
    } else {
      generate();
    }
  };

  const handleExportMainPDF = useCallback(() => {
    const safeFilename = `CR_${patientName.replace(/\s+/g, '_') || 'patient'}_${dateExamen}.pdf`;
    exportElementToPDF(reportRef, safeFilename, setIsExportingPdf);
  }, [patientName, dateExamen]);

  const handleExportSickLeavePDF = useCallback(() => {
    const safeFilename = `Arret_Maladie_${patientName.replace(/\s+/g, '_') || 'patient'}_${dateExamen}.pdf`;
    exportElementToPDF(sickLeaveRef, safeFilename, setIsExportingSickLeavePdf);
  }, [patientName, dateExamen]);

  const handleGenerateSickLeave = async () => {
    if (!data) return;
    setLoadingExtra(true);
    try {
      const systemPrompt = `Tu es médecin. Rédige uniquement le paragraphe central d'un certificat d'arrêt de travail de ${sickLeaveDays} jour(s) pour le patient ${data.patient.nom}. Ne mentionne STRICTEMENT JAMAIS la pathologie (secret médical obligatoire). Exclue la date du jour, l'en-tête et la signature. Le texte doit commencer directement par "Je soussigné..." et aller à l'essentiel, avec un ton administratif très formel.`;
      
      const contextData = { patient: data.patient };
      const userText = JSON.stringify(contextData, null, 2);
      
      const result = await callNativeGeminiText(systemPrompt, userText);
      setSickLeaveContent(result.replace(/^"(.*)"$/, '$1').trim()); // Clean up possible wrapper quotes
    } catch (err) {
      alert(`Erreur lors de la génération : ${err.message}`);
    } finally {
      setLoadingExtra(false);
    }
  };

  const generateReport = async () => {
    if (!patientName.trim()) return setError("Le nom du patient est requis.");
    if (!motifs.length) return setError("Au moins un motif d'examen est requis.");
    
    setError(null); setLoading(true);

    const isOCTcr = reportType.includes("OCT");

    const buildEyeJSON = (eye) => {
      const obj = {};
      obj.indice_acquisition = eye.acquisitionStatus;
      if (eye.acquisitionStatus !== "Bon") obj.indice_acquisition_motif = eye.acquisitionMotif;
      
      if (isOCTcr) {
        obj.oct = {};
        
        if (showPosterior) {
          if (eye.octaPerformed) obj.oct.observations_octa = eye.obsOCTA.filter(Boolean);
          if (eye.hasFollowUp) {
            obj.oct.suivi_antérieur = { date: eye.followUpDate, evolution_rnfl: eye.rnflEvolution, evolution_gcl: eye.gclEvolution };
          }
          if (eye.acquisitionStatus !== "Impossible") {
            obj.oct.rnfl = eye.rnfl; if (eye.rnflLoc) obj.oct.rnfl_localisation = eye.rnflLoc;
            obj.oct.gcl_pp = eye.gcl; if (eye.gclLoc) obj.oct.gcl_localisation = eye.gclLoc;
          } else { obj.oct.rnfl = "Impossible"; obj.oct.gcl_pp = "Impossible"; }
        }
        
        if (showAnterior) {
          obj.oct.segment_anterieur = { pachymetrie: eye.cornealThickness, observations: eye.obsAnterieur.filter(Boolean) };
        }
      }
      
      if (showPosterior) {
        obj.observations_principales = eye.obsFavoris.filter(Boolean);
        if (eye.acquisitionStatus !== "Impossible") {
          obj.disque = { ...(eye.discSurface && { surface_mm2: eye.discSurface }), ...(eye.cupDisc && { cup_disc_vertical: eye.cupDisc }) };
        } else {
          obj.disque = { surface_mm2: "Impossible", cup_disc_vertical: "Impossible" };
        }
        obj.retino = { papille: eye.obsPapille.filter(Boolean), macula: eye.obsMacula.filter(Boolean), vascularisation: eye.obsVasc.filter(Boolean), peripherie: eye.obsPeriph.filter(Boolean) };
      }

      if (eye.obsFree) obj.texte_libre = eye.obsFree;
      return obj;
    };

    const analyseOD = buildClinicalSummary(eyeOD, "OD", isOCTcr, showAnterior, showPosterior);
    const analyseOG = buildClinicalSummary(eyeOG, "OG", isOCTcr, showAnterior, showPosterior);

    const finalJSON = {
      type_cr: reportType,
      date_examen: new Date(dateExamen + "T12:00:00").toLocaleDateString("fr-FR"),
      patient: { nom: patientName, age },
      contexte: { prescripteur: doctor, motifs, antecedents, showAnterior, showPosterior },
      oeil_droit: buildEyeJSON(eyeOD),
      oeil_gauche: buildEyeJSON(eyeOG),
      analyse_clinique: { oeil_droit: analyseOD, oeil_gauche: analyseOG }
    };

    try {
      const result = await callNativeGemini(finalJSON, eyeOD.images, eyeOG.images);
      
      const validation = validateAIResponse(result);
      setJsonValidation(validation);

      setData(finalJSON);
      setAiResult(result);
      setEdits({});
      setView('report');
      window.scrollTo(0, 0);

    } catch (err) {
      setError(`Erreur d'interprétation IA : ${err.message || "Veuillez réessayer."}`);
    } finally {
      setLoading(false);
    }
  };

  const hasImages = data && (eyeOD.images.length > 0 || eyeOG.images.length > 0);
  const safeAI = aiResult || {};
  const safeInterp = safeAI.interpretation || {};
  const safeRecos = safeAI.recommandations || {};

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900 pb-10">
      <PrintStyles />
      
      <nav className="bg-[#0C2233] text-white px-6 py-3 flex justify-between items-center sticky top-0 z-50 shadow-lg border-b-2 border-teal-500 no-print">
        <div className="flex items-center gap-2">
          <div className="bg-teal-500 p-1.5 rounded-lg"><Stethoscope className="w-5 h-5" /></div>
          <h1 className="text-xl font-black tracking-tight">MEDIVISION <span className="text-teal-400 font-light">STUDIO V8</span></h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full">
            <span className="text-sm">✦</span>
            <span className="text-[10px] font-bold">Gemini Engine Actif</span>
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
          </div>
          <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-white/10 rounded-full transition-colors" title="Configuration des listes"><Settings className="w-5 h-5" /></button>
          <div className="h-6 w-px bg-slate-600 mx-1"></div>
          <button onClick={() => setView('form')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${view === 'form' ? 'bg-teal-500 text-white' : 'hover:bg-white/10'}`}>SAISIE</button>
          <button disabled={!aiResult} onClick={() => setView('report')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${view === 'report' ? 'bg-teal-500 text-white' : 'hover:bg-white/10 disabled:opacity-30'}`}>RAPPORT</button>
        </div>
      </nav>

      {showSettings && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50">
              <h2 className="font-bold flex items-center gap-2"><Settings className="w-5 h-5 text-teal-600" /> Configuration des Listes Cliniques</h2>
              <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-slate-200 rounded text-slate-500"><X /></button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="space-y-6">
                {Object.entries({
                  'doctors': 'Médecins Prescripteurs', 'motifs': "Motifs d'Examen", 'antecedents': 'Antécédents',
                  'obsFavoris': 'Observations Favorites', 'obsAnterieur': 'Segment Antérieur', 'obsPapille': 'Papille', 'obsMacula': 'Macula',
                  'obsVasc': 'Vascularisation', 'obsPeriph': 'Périphérie'
                }).map(([key, label]) => (
                  <div key={key} className="border-b border-slate-100 pb-4 last:border-0">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">{label}</h3>
                    <div className="flex flex-wrap gap-2">
                      {prefs[key]?.map(item => (
                        <span key={item} className="group bg-white px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 border border-slate-200 shadow-sm">
                          {item}
                          {item !== "Sans particularité" && (
                            <button onClick={() => removePref(key, item)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                          )}
                        </span>
                      ))}
                      {addingCategory === key ? (
                        <div className="flex items-center gap-1">
                          <input autoFocus className="px-2 py-1.5 border border-teal-300 rounded-full text-xs outline-none focus:ring-1 focus:ring-teal-500 min-w-[120px]" placeholder="Nouvel élément..."
                            value={addingValue} onChange={e => setAddingValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { if (addingValue.trim()) updatePrefs(key, addingValue); setAddingCategory(null); setAddingValue(""); }
                              else if (e.key === 'Escape') { setAddingCategory(null); setAddingValue(""); }
                            }} />
                          <button onClick={() => { if (addingValue.trim()) updatePrefs(key, addingValue); setAddingCategory(null); setAddingValue(""); }} className="bg-teal-500 text-white px-2 py-1.5 rounded-full text-xs font-bold hover:bg-teal-600 transition-colors">OK</button>
                          <button onClick={() => { setAddingCategory(null); setAddingValue(""); }} className="text-slate-400 hover:text-slate-600 p-1"><X className="w-4 h-4"/></button>
                        </div>
                      ) : (
                        <button onClick={() => { setAddingCategory(key); setAddingValue(""); }} className="px-3 py-1.5 rounded-full text-xs border border-dashed border-teal-400 text-teal-600 font-bold hover:bg-teal-50 transition-colors">+ Ajouter</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t flex justify-end">
              <button onClick={() => setShowSettings(false)} className="bg-[#0C2233] text-white px-6 py-2 rounded-xl font-bold shadow-md hover:bg-slate-800 transition-colors">Enregistrer & Fermer</button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto p-4 sm:p-6 mt-4">
        {view === 'form' ? (
          <div className="animate-in fade-in duration-500 no-print">
            
            {error && (
              <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 flex items-center gap-3 text-sm rounded shadow-sm">
                <AlertTriangle className="w-5 h-5" /> {error}
              </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-6 overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-200 p-4 font-bold text-[#0C2233] flex items-center gap-2 uppercase tracking-wide text-sm">🏥 Patient & Contexte</div>
              <div className="p-5 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nom du patient</label>
                  <input className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:border-teal-500 outline-none" placeholder="Nom Prénom" value={patientName} onChange={e => setPatientName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Âge</label>
                  <input className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:border-teal-500 outline-none" placeholder="Ans" value={age} onChange={e => setAge(e.target.value)} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Date</label>
                  <input type="date" className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:border-teal-500 outline-none" value={dateExamen} onChange={e => setDateExamen(e.target.value)} />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Prescripteur</label>
                  <div className="flex gap-2">
                    <select className="flex-1 p-2.5 border border-slate-200 rounded-lg text-sm focus:border-teal-500 outline-none" value={doctor} onChange={e => setDoctor(e.target.value)}>
                      <option value="">— Sélectionner —</option>
                      {prefs.doctors.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    {showAddDoctor ? (
                      <div className="flex items-center gap-1">
                        <input autoFocus className="w-24 px-2 py-1.5 border border-teal-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-teal-500" placeholder="Saisir..."
                          value={newDoctor} onChange={e => setNewDoctor(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { if (newDoctor.trim()) { updatePrefs('doctors', newDoctor.trim()); setDoctor(newDoctor.trim()); } setNewDoctor(""); setShowAddDoctor(false); }
                            if (e.key === 'Escape') setShowAddDoctor(false);
                          }} />
                        <button onClick={() => { if (newDoctor.trim()) { updatePrefs('doctors', newDoctor.trim()); setDoctor(newDoctor.trim()); } setNewDoctor(""); setShowAddDoctor(false); }} className="bg-teal-500 text-white px-2 py-1.5 rounded-lg text-xs font-bold hover:bg-teal-600 transition-colors">OK</button>
                        <button onClick={() => setShowAddDoctor(false)} className="text-slate-400 hover:text-slate-600 p-1"><X className="w-4 h-4"/></button>
                      </div>
                    ) : (
                      <button onClick={() => setShowAddDoctor(true)} className="px-3 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 flex items-center justify-center font-bold text-lg leading-none">＋</button>
                    )}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Type de Compte Rendu</label>
                  <select className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:border-teal-500 outline-none" value={reportType} onChange={e => setReportType(e.target.value)}>
                    {REPORT_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  {/* MODULARITÉ FRONT-END: Dérogations */}
                  <div className="mt-2">
                    {isAnteriorBase && !forceShowPosterior && (
                      <button onClick={() => setForceShowPosterior(true)} className="text-[10px] font-bold text-teal-600 flex items-center gap-1 hover:underline"><PlusCircle className="w-3 h-3" /> Ajouter un examen postérieur</button>
                    )}
                    {!isAnteriorBase && !forceShowAnterior && (
                      <button onClick={() => setForceShowAnterior(true)} className="text-[10px] font-bold text-teal-600 flex items-center gap-1 hover:underline"><PlusCircle className="w-3 h-3" /> Ajouter un OCT du segment antérieur</button>
                    )}
                  </div>
                </div>

                <div className="md:col-span-4 mt-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Antécédents</label>
                  <div className="flex flex-wrap gap-2">
                    {prefs.antecedents.map(a => <span key={a} onClick={() => toggleAtcd(a)} className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer border transition-colors ${antecedents.includes(a) ? 'bg-teal-50 border-teal-500 text-teal-700 font-bold' : 'bg-white border-slate-200 text-slate-600 hover:border-teal-300'}`}>{a}</span>)}
                    {showAddAtcd ? (
                      <div className="flex items-center gap-1">
                        <input autoFocus className="px-2 py-1 border border-teal-300 rounded-full text-xs outline-none focus:ring-1 focus:ring-teal-500 min-w-[120px]" placeholder="Saisir..."
                          value={newAtcd} onChange={e => setNewAtcd(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { if (newAtcd.trim()) { updatePrefs('antecedents', newAtcd.trim()); toggleAtcd(newAtcd.trim()); } setNewAtcd(""); setShowAddAtcd(false); }
                            if (e.key === 'Escape') setShowAddAtcd(false);
                          }} />
                        <button onClick={() => { if (newAtcd.trim()) { updatePrefs('antecedents', newAtcd.trim()); toggleAtcd(newAtcd.trim()); } setNewAtcd(""); setShowAddAtcd(false); }} className="bg-teal-500 text-white px-2 py-1 rounded-full text-xs font-bold hover:bg-teal-600 transition-colors">OK</button>
                        <button onClick={() => setShowAddAtcd(false)} className="text-slate-400 hover:text-slate-600 p-1"><X className="w-3 h-3"/></button>
                      </div>
                    ) : (
                      <span onClick={() => setShowAddAtcd(true)} className="px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer border border-dashed border-slate-300 text-slate-500 hover:bg-slate-50 flex items-center">＋ Autre</span>
                    )}
                  </div>
                </div>

                <div className="md:col-span-4 mt-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Motifs d'examen</label>
                  <div className="flex flex-wrap gap-2">
                    {prefs.motifs.map(m => <span key={m} onClick={() => toggleMotif(m)} className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer border transition-colors ${motifs.includes(m) ? 'bg-teal-50 border-teal-500 text-teal-700 font-bold' : 'bg-white border-slate-200 text-slate-600 hover:border-teal-300'}`}>{m}</span>)}
                    {showAddMotif ? (
                      <div className="flex items-center gap-1">
                        <input autoFocus className="px-2 py-1 border border-teal-300 rounded-full text-xs outline-none focus:ring-1 focus:ring-teal-500 min-w-[120px]" placeholder="Saisir..."
                          value={newMotif} onChange={e => setNewMotif(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { if (newMotif.trim()) { updatePrefs('motifs', newMotif.trim()); toggleMotif(newMotif.trim()); } setNewMotif(""); setShowAddMotif(false); }
                            if (e.key === 'Escape') setShowAddMotif(false);
                          }} />
                        <button onClick={() => { if (newMotif.trim()) { updatePrefs('motifs', newMotif.trim()); toggleMotif(newMotif.trim()); } setNewMotif(""); setShowAddMotif(false); }} className="bg-teal-500 text-white px-2 py-1 rounded-full text-xs font-bold hover:bg-teal-600 transition-colors">OK</button>
                        <button onClick={() => setShowAddMotif(false)} className="text-slate-400 hover:text-slate-600 p-1"><X className="w-3 h-3"/></button>
                      </div>
                    ) : (
                      <span onClick={() => setShowAddMotif(true)} className="px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer border border-dashed border-slate-300 text-slate-500 hover:bg-slate-50 flex items-center">＋ Autre</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 mb-8">
              <EyeForm side="OD" label="ŒIL DROIT" color="#0C2233" eye={eyeOD} onChange={setEyeOD} isOCT={reportType.includes("OCT")} prefs={prefs} updatePrefs={updatePrefs} showAnterior={showAnterior} showPosterior={showPosterior} />
              <EyeForm side="OG" label="ŒIL GAUCHE" color="#13344D" eye={eyeOG} onChange={setEyeOG} isOCT={reportType.includes("OCT")} prefs={prefs} updatePrefs={updatePrefs} showAnterior={showAnterior} showPosterior={showPosterior} />
            </div>

            <div className="flex justify-center mb-10">
              <button onClick={generateReport} disabled={loading} className="w-full max-w-lg bg-teal-600 hover:bg-teal-700 text-white px-10 py-4 rounded-xl font-bold flex items-center justify-center gap-3 transition-all transform hover:scale-105 disabled:opacity-50 disabled:scale-100 shadow-xl text-lg">
                {loading ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Zap className="w-6 h-6" />}
                {loading ? `GÉNÉRATION...` : `GÉNÉRER LE RAPPORT (GEMINI ENGINE)`}
              </button>
            </div>
          </div>
        ) : aiResult && (
          <div className="animate-in slide-in-from-bottom-4 duration-700">
            {/* Barre d'actions (masquée à l'impression) */}
            <div className="flex flex-wrap gap-3 mb-6 no-print">
              <button onClick={() => setView('form')} className="bg-white text-slate-600 px-4 py-2 rounded-lg border border-slate-200 flex items-center gap-2 text-sm font-bold hover:bg-slate-50 shadow-sm"><ChevronLeft className="w-4 h-4" /> Modification</button>
              
              {/* Badge qualité JSON */}
              <div className="flex items-center">
                <ValidationBadge validation={jsonValidation} />
              </div>

              <div className="ml-auto flex gap-3">
                <button onClick={handleNewPatient} className="bg-white text-slate-600 px-4 py-2 rounded-lg border border-slate-200 flex items-center gap-2 text-sm font-bold hover:bg-slate-50 shadow-sm"><RotateCcw className="w-4 h-4" /> Nouveau patient</button>
                <button onClick={handleExportWord} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold hover:bg-blue-700 shadow-md"><FileText className="w-4 h-4" /> Exporter Word natif</button>
                <button onClick={handleExportMainPDF} disabled={isExportingPdf} className="bg-teal-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold hover:bg-teal-700 shadow-md disabled:opacity-50">
                  {isExportingPdf ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Télécharger PDF
                </button>
                <button onClick={handlePrint} className="bg-[#0C2233] text-white px-6 py-2 rounded-lg flex items-center gap-2 text-sm font-bold hover:bg-slate-800 shadow-md"><Printer className="w-4 h-4" /> Imprimer / PDF A4</button>
              </div>
            </div>

            {/* Avertissement si validation dégradée */}
            {jsonValidation && !jsonValidation.valid && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 no-print">
                <div className="font-bold mb-1 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Réponse IA partiellement incomplète</div>
                <ul className="list-disc ml-5 space-y-0.5">
                  {jsonValidation.issues.map((issue, i) => <li key={i}>{issue}</li>)}
                </ul>
                <p className="mt-2 text-[10px] italic">Vous pouvez corriger manuellement les champs du compte rendu ci-dessous.</p>
              </div>
            )}

            {/* CONTENEUR GLOBAL DU RAPPORT PRINCIPAL (Rapport + Annexes) */}
            <div ref={reportRef} className="w-full flex flex-col items-center">
              
              {/* RAPPORT PAGE 1 */}
              <div className="report-page bg-white shadow-2xl mx-auto w-full max-w-[210mm] p-[10mm] text-slate-900 border border-slate-100 flex flex-col relative box-border mb-8 print:mb-0">
                <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none no-print"><Stethoscope className="w-48 h-48" /></div>
                
                <div className="flex justify-between items-start border-b-4 border-[#0C2233] pb-2 mb-3 relative">
                  <div>
                    <h1 className="text-3xl font-black text-[#0C2233] leading-none">CLINIQUE MEDIVISION</h1>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Ophtalmologie · Libreville, Gabon</p>
                  </div>
                  <div className="text-right">
                    <div className="text-teal-600 font-bold text-lg"><EditableInline value={getVal('type_cr', data?.type_cr)} field="type_cr" onEdit={handleEdit} /></div>
                    <div className="text-slate-400 text-xs font-medium"><EditableInline value={getVal('date_examen', data?.date_examen)} field="date_examen" onEdit={handleEdit} /></div>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 grid grid-cols-4 gap-2 mb-3">
                  <div className="col-span-1">
                    <p className="text-[10px] font-bold text-[#0C2233] uppercase mb-0.5">Patient</p>
                    <div className="text-[11px] text-slate-600 font-semibold"><EditableInline value={getVal('patient_nom', data?.patient?.nom)} field="patient_nom" onEdit={handleEdit} /> - <EditableInline value={getVal('patient_age', data?.patient?.age)} field="patient_age" onEdit={handleEdit} /> ans</div>
                  </div>
                  <div className="col-span-1">
                    <p className="text-[10px] font-bold text-[#0C2233] uppercase mb-0.5">Prescripteur</p>
                    <div className="text-[11px] text-slate-600 font-semibold"><EditableInline value={getVal('prescripteur', data?.contexte?.prescripteur || "—")} field="prescripteur" onEdit={handleEdit} /></div>
                  </div>
                  <div className="col-span-1">
                    <p className="text-[10px] font-bold text-[#0C2233] uppercase mb-0.5">Motif(s)</p>
                    <div className="text-[11px] text-slate-600 italic leading-tight"><EditableInline value={getVal('motifs', (data?.contexte?.motifs || []).join(" · ") || "—")} field="motifs" onEdit={handleEdit} /></div>
                  </div>
                  <div className="col-span-1">
                    <p className="text-[10px] font-bold text-[#0C2233] uppercase mb-0.5">Antécédents</p>
                    <div className="text-[11px] text-slate-600 italic leading-tight"><EditableInline value={getVal('antecedents', (data?.contexte?.antecedents || []).join(", ") || "—")} field="antecedents" onEdit={handleEdit} /></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-3">
                  {data?.contexte?.showAnterior && (
                    <ReportDataTable title="Segment Antérieur" edits={edits} onEdit={handleEdit} rows={[
                      { label: "Pachymétrie", od: data?.oeil_droit?.segment_anterieur?.pachymetrie ? data.oeil_droit.segment_anterieur.pachymetrie + " µm" : "—", og: data?.oeil_gauche?.segment_anterieur?.pachymetrie ? data.oeil_gauche.segment_anterieur.pachymetrie + " µm" : "—", fieldOD: 'ant_pachy_od', fieldOG: 'ant_pachy_og' },
                      { label: "Cornée", od: (data?.oeil_droit?.segment_anterieur?.observations||[]).join(", "), og: (data?.oeil_gauche?.segment_anterieur?.observations||[]).join(", "), fieldOD: 'ant_obs_od', fieldOG: 'ant_obs_og' }
                    ]} />
                  )}

                  {data?.contexte?.showPosterior && (
                    <ReportDataTable title="Mesures OCT / RNFL" edits={edits} onEdit={handleEdit} rows={[
                      { label: "RNFL", od: data?.oeil_droit?.oct?.rnfl, og: data?.oeil_gauche?.oct?.rnfl, fieldOD: 'oct_rnfl_od', fieldOG: 'oct_rnfl_og' },
                      { label: "GCL++", od: data?.oeil_droit?.oct?.gcl_pp, og: data?.oeil_gauche?.oct?.gcl_pp, fieldOD: 'oct_gcl_od', fieldOG: 'oct_gcl_og' },
                      { label: "Cup/Disc (V)", od: data?.oeil_droit?.disque?.cup_disc_vertical, og: data?.oeil_gauche?.disque?.cup_disc_vertical, fieldOD: 'oct_cd_od', fieldOG: 'oct_cd_og', isCupDisc: true },
                      { label: "Surface Disque", od: data?.oeil_droit?.disque?.surface_mm2 && data.oeil_droit.disque.surface_mm2 !== "Impossible" ? `${data.oeil_droit.disque.surface_mm2} mm²` : data?.oeil_droit?.disque?.surface_mm2, og: data?.oeil_gauche?.disque?.surface_mm2 && data.oeil_gauche.disque.surface_mm2 !== "Impossible" ? `${data.oeil_gauche.disque.surface_mm2} mm²` : data?.oeil_gauche?.disque?.surface_mm2, fieldOD: 'oct_surf_od', fieldOG: 'oct_surf_og', isSurface: true },
                    ]} />
                  )}
                  
                  {data?.contexte?.showPosterior && (
                    <ReportDataTable title="Analyse Fond d'Œil" edits={edits} onEdit={handleEdit} rows={[
                      { label: "Papille", od: (data?.oeil_droit?.retino?.papille||[]).join(", "), og: (data?.oeil_gauche?.retino?.papille||[]).join(", "), fieldOD: 'ret_papille_od', fieldOG: 'ret_papille_og' },
                      { label: "Macula", od: (data?.oeil_droit?.retino?.macula||[]).join(", "), og: (data?.oeil_gauche?.retino?.macula||[]).join(", "), fieldOD: 'ret_macula_od', fieldOG: 'ret_macula_og' },
                      { label: "Vaisseaux", od: (data?.oeil_droit?.retino?.vascularisation||[]).join(", "), og: (data?.oeil_gauche?.retino?.vascularisation||[]).join(", "), fieldOD: 'ret_vais_od', fieldOG: 'ret_vais_og' },
                    ]} />
                  )}
                </div>

                <div className="mb-3 interpretation-block">
                  <div className="text-[11px] font-extrabold text-[#2A9D8F] uppercase tracking-wider mb-1 border-b-2 border-[#2A9D8F33] pb-1">Interprétation Médicale</div>
                  <div className="space-y-0">
                    {safeInterp.segment_anterieur && <EditableSection label="Segment Antérieur" value={getVal('segment_anterieur', safeInterp.segment_anterieur)} field="segment_anterieur" onEdit={handleEdit} />}
                    {safeInterp.synthese_oct && <EditableSection label="RNFL/GCL" value={getVal('synthese_oct', safeInterp.synthese_oct)} field="synthese_oct" onEdit={handleEdit} />}
                    {safeInterp.macula && <EditableSection label="Macula" value={getVal('macula', safeInterp.macula)} field="macula" onEdit={handleEdit} />}
                    {safeInterp.papille && <EditableSection label="Papille" value={getVal('papille', safeInterp.papille)} field="papille" onEdit={handleEdit} />}
                    {safeInterp.vascularisation && <EditableSection label="Vascularisation" value={getVal('vascularisation', safeInterp.vascularisation)} field="vascularisation" onEdit={handleEdit} />}
                    {safeInterp.peripherie && <EditableSection label="Périphérie" value={getVal('peripherie', safeInterp.peripherie)} field="peripherie" onEdit={handleEdit} />}
                  </div>
                </div>

                <div className={`conclusion-block p-2.5 rounded-xl mb-3 border-2 ${safeAI.severite === 'alerte' ? 'bg-red-50 border-red-100' : safeAI.severite === 'surveillance' ? 'bg-orange-50 border-orange-100' : 'bg-green-50 border-green-100'}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <CheckCircle className={`w-3.5 h-3.5 ${safeAI.severite === 'alerte' ? 'text-red-600' : safeAI.severite === 'surveillance' ? 'text-orange-600' : 'text-green-600'}`} />
                    <span className="text-[10px] font-bold text-[#0C2233] uppercase">Conclusion</span>
                  </div>
                  <div contentEditable suppressContentEditableWarning onBlur={(e) => handleEdit('conclusion', e.target.innerText)} className="text-[11px] italic text-slate-800 leading-relaxed outline-none focus:bg-white/50 p-1 rounded transition-colors">{getVal('conclusion', safeAI.conclusion || "—")}</div>
                </div>

                <div className="recommandations-block grid grid-cols-2 gap-3 mb-2">
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <p className="text-[10px] font-bold text-[#0C2233] uppercase mb-0.5">Hygiène</p>
                    <div contentEditable suppressContentEditableWarning onBlur={(e) => handleEdit('hygiene', e.target.innerText)} className="text-[11px] text-slate-600 leading-snug outline-none hover:bg-teal-50 focus:bg-teal-50 border-b border-transparent hover:border-teal-200 transition-colors">{getVal('hygiene', safeRecos.hygiene || "—")}</div>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <p className="text-[10px] font-bold text-[#0C2233] uppercase mb-0.5">Suivi Recommandé</p>
                    <div contentEditable suppressContentEditableWarning onBlur={(e) => handleEdit('suivi', e.target.innerText)} className="text-[11px] text-slate-600 leading-snug outline-none hover:bg-teal-50 focus:bg-teal-50 border-b border-transparent hover:border-teal-200 transition-colors">{getVal('suivi', safeRecos.suivi || "—")}</div>
                  </div>
                </div>

                <div className="w-full mt-auto pt-2 border-t border-slate-100 flex justify-between items-end pb-1">
                  <p className="text-[8px] text-slate-400">Libreville</p>
                  <div className="text-right">
                    <p className="text-sm font-bold text-[#0C2233]">Dr. Yoan MBOUSSOU</p>
                    <p className="text-[9px] text-slate-500 tracking-tighter uppercase">Imagerie Rétinienne</p>
                  </div>
                </div>
              </div>

              {/* RAPPORT PAGE 2 - ANNEXES */}
              {hasImages && (
                <div className="report-page report-page-annexes bg-white shadow-2xl mx-auto w-full max-w-[210mm] p-[10mm] text-slate-900 border border-slate-100 flex flex-col relative box-border mt-8">
                  <div className="border-b-4 border-[#0C2233] pb-2 mb-4">
                    <h2 className="text-2xl font-black text-[#0C2233]">Annexes Iconographiques</h2>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Patient: {patientName} • Date: {new Date(dateExamen).toLocaleDateString()}</p>
                  </div>

                  {eyeOD.images.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm font-bold text-teal-700 uppercase mb-3 border-b border-teal-100 pb-1">Œil Droit (OD)</h3>
                      <div className="grid grid-cols-2 gap-3">
                        {eyeOD.images.map((img, i) => (
                          <div key={i} className="border border-slate-200 p-2 rounded-lg bg-slate-50">
                            <img src={img.data} alt={`OD-${i}`} className="w-full h-auto object-contain rounded" style={{ maxHeight: "250px" }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {eyeOG.images.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm font-bold text-teal-700 uppercase mb-3 border-b border-teal-100 pb-1">Œil Gauche (OG)</h3>
                      <div className="grid grid-cols-2 gap-3">
                        {eyeOG.images.map((img, i) => (
                          <div key={i} className="border border-slate-200 p-2 rounded-lg bg-slate-50">
                            <img src={img.data} alt={`OG-${i}`} className="w-full h-auto object-contain rounded" style={{ maxHeight: "250px" }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="w-full mt-auto pt-2 border-t border-slate-100 flex justify-between items-end pb-1">
                    <p className="text-[8px] text-slate-400">Libreville</p>
                    <div className="text-right">
                      <p className="text-sm font-bold text-[#0C2233]">Dr. Yoan MBOUSSOU</p>
                      <p className="text-[9px] text-slate-500 tracking-tighter uppercase">Imagerie Rétinienne</p>
                    </div>
                  </div>
                </div>
              )}

            </div> {/* FIN DU CONTENEUR GLOBAL */}

            {/* ✨ OUTILS IA ADDITIONNELS (Seulement l'arrêt maladie) */}
            <div className="mt-8 mb-4 p-6 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-2xl border border-indigo-100 shadow-sm no-print max-w-[210mm] mx-auto">
              <h3 className="text-sm font-black text-indigo-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-500" /> Assistant IA Post-Consultation
              </h3>
              
              <div className="flex items-center justify-between mb-4 bg-white p-4 rounded-xl border border-indigo-100 shadow-sm">
                <h4 className="font-bold text-indigo-800 flex items-center gap-2"><Clock className="w-4 h-4"/> Certificat d'Arrêt Maladie</h4>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-500">Durée :</span>
                  <input type="number" min="1" max="90" value={sickLeaveDays} onChange={(e) => setSickLeaveDays(e.target.value)} className="w-16 px-2 py-1 text-sm border border-indigo-200 rounded text-center outline-none focus:border-indigo-400 font-bold text-indigo-900" />
                  <span className="text-xs font-medium text-slate-500">jours</span>
                  <button onClick={handleGenerateSickLeave} disabled={loadingExtra} className="ml-4 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50 shadow-sm">
                    {loadingExtra ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />} Générer
                  </button>
                </div>
              </div>

              {/* Rendu du Certificat d'Arrêt Maladie au format A4 */}
              {sickLeaveContent && (
                <div className="relative mt-6">
                  <div className="flex justify-end mb-2">
                    <button onClick={handleExportSickLeavePDF} disabled={isExportingSickLeavePdf} className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-xs font-bold hover:bg-indigo-700 shadow-md disabled:opacity-50">
                      {isExportingSickLeavePdf ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Télécharger en PDF
                    </button>
                  </div>
                  
                  <div ref={sickLeaveRef} className="report-page bg-white shadow-2xl mx-auto w-full max-w-[210mm] min-h-[297mm] p-[20mm] text-slate-900 border border-slate-100 flex flex-col relative box-border">
                    <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none"><Stethoscope className="w-48 h-48" /></div>
                    
                    <div className="border-b-4 border-[#0C2233] pb-4 mb-12">
                      <h1 className="text-3xl font-black text-[#0C2233] leading-none">CLINIQUE MEDIVISION</h1>
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-2">Ophtalmologie · Libreville, Gabon</p>
                    </div>

                    <div className="text-center mb-16">
                      <h2 className="text-2xl font-black text-slate-800 uppercase tracking-wide border-b-2 border-slate-200 inline-block pb-2">Certificat Médical d'Arrêt de Travail</h2>
                    </div>

                    <div className="flex-1">
                      <div contentEditable suppressContentEditableWarning onBlur={(e) => setSickLeaveContent(e.target.innerText)} className="text-base text-slate-800 leading-loose outline-none focus:bg-indigo-50/50 p-2 rounded transition-colors text-justify min-h-[200px]">
                        {sickLeaveContent}
                      </div>
                    </div>

                    <div className="w-full mt-auto pt-8 border-t border-slate-100 flex justify-between items-end">
                      <p className="text-xs text-slate-500">Fait pour valoir ce que de droit.</p>
                      <div className="text-right">
                        <p className="text-sm font-medium text-slate-600 mb-12">Libreville, le {new Date(dateExamen).toLocaleDateString('fr-FR')}</p>
                        <p className="text-lg font-bold text-[#0C2233]">Dr. Yoan MBOUSSOU</p>
                        <p className="text-xs text-slate-500 uppercase tracking-widest mt-1">Imagerie Rétinienne</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}
      </main>
    </div>
  );
}