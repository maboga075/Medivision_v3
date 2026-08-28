import type { VercelRequest, VercelResponse } from '@vercel/node';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ─── Types locaux (miroir de src/types/ai.ts) ────────────────────────────────

interface PatientSummaryAI {
  titre?: string;
  observe?: string;
  signification?: string;
  suite?: string;
  rassurance?: string;
  od_etat?: 'ok' | 'watch' | 'alert';
  og_etat?: 'ok' | 'watch' | 'alert';
}

interface AIResult {
  analyse_clinique: string;
  conclusion: string;
  prevention: string[];
  suivi: string[];
  conseil_patient: string;
  severite: 'normal' | 'surveillance' | 'alerte';
  resume_patient?: PatientSummaryAI;
}

interface ValidationResult {
  valid: boolean;
  score: 'vert' | 'orange' | 'rouge';
  issues: string[];
}

type AIProviderKey = 'openai' | 'anthropic' | 'deepseek' | 'gemini';

const AI_PROVIDERS: AIProviderKey[] = ['openai', 'anthropic', 'deepseek', 'gemini'];
const LOCAL_ENV_FILES = ['.env.local', '.env'];

// ─── Prompt système ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es un ophtalmologue senior spécialisé en imagerie oculaire (OCT, rétinographie, OCTA).
Tu reçois des données cliniques structurées et dois générer un compte rendu synthétique en JSON.

RÈGLES ABSOLUES :
1. Ne génère une section que si des données pertinentes t'ont été transmises.
2. N'invente JAMAIS de données — utilise seulement ce qui est fourni.
3. Répondre UNIQUEMENT en JSON strict, AUCUN texte autour.
4. Les champs "prevention" et "suivi" sont des TABLEAUX de chaînes.

**FORMAT DE RÉPONSE (JSON strict) :**
{
  "analyse_clinique": "3 à 4 phrases synthétiques orientées raisonnement clinique.",
  "conclusion": "Synthèse diagnostique pure (1-2 phrases). AUCUN suivi ici.",
  "prevention": ["item 1", "item 2"],
  "suivi": ["item 1", "item 2"],
  "conseil_patient": "Une seule phrase de conseil au patient, liée à sa pathologie.",
  "severite": "normal | surveillance | alerte",
  "resume_patient": {
    "titre": "Titre court et rassurant (ex: « Un œil à surveiller, l'autre en bon état »).",
    "observe": "Ce qu'on a observé, en mots simples — sans jargon médical.",
    "signification": "Ce que ça veut dire pour le patient, avec prudence et sans alarmer.",
    "suite": "La suite concrète (prochain contrôle, gestes utiles).",
    "rassurance": "Une phrase de réassurance honnête.",
    "od_etat": "ok | watch | alert",
    "og_etat": "ok | watch | alert"
  }
}

**DIRECTIVES ANALYSE_CLINIQUE — CRITIQUES, à respecter impérativement :**

LONGUEUR : 3 à 4 phrases MAXIMUM. Jamais plus.

INTERDICTIONS ABSOLUES — ne jamais écrire ces formulations :
- "Acquisition de bonne qualité" / "image de bonne qualité" (ne JAMAIS signaler une bonne qualité)
- "OCTA non réalisé" / "segment antérieur non examiné" / "non réalisé" / "non effectué"
- "Aucune donnée transmise" / "aucune donnée exploitable" / "non renseigné" / "non transmis"
- Toute formulation signalant l'ABSENCE d'un examen ou d'une donnée
- Toute répétition textuelle des valeurs brutes (ex: "Cup/Disc renseigné à 0.9", "RNFL renseigné comme stable")

INDICE D'ACQUISITION — à PRENDRE EN COMPTE impérativement :
- Si "acquisitionQuality" vaut "faible" ou "impossible" : nuancer TOUTE l'interprétation
  (l'atteinte peut être surestimée/sous-estimée) et MENTIONNER le motif fourni dans
  "acquisitionMotifs" (ex: "interprétation à nuancer du fait d'une opacité des milieux transparents").
- Si "rnfl_gcl_non_interpretable" est vrai pour un œil : NE PAS interpréter le RNFL ni le GCL
  de cet œil ; écrire à la place « RNFL et GCL non interprétables en raison d'un indice
  d'acquisition faible » et fonder l'analyse sur les autres éléments.
- Une bonne qualité d'acquisition (acquisitionQuality absent) ne doit JAMAIS être mentionnée.

OBSERVATIONS ISSUES DE L'ANNOTATION D'IMAGES ("observations" : clés "retina", "bscan", "cornea", "octa") :
- Chaque entrée est une lésion DÉJÀ localisée dans le référentiel de SA coupe : respecter cette
  localisation, ne jamais la transposer d'une coupe à une autre.
- "retina" : rétinographie / fond d'œil de face (zone anatomique, quadrant, secteur).
- "bscan" : coupe OCT B-scan — tenir compte de la COUCHE rétinienne mentionnée (RNFL, GCL,
  plexiformes, nucléaires, photorécepteurs, EPR…) et de la position transverse.
- "cornea" : coupe de cornée (OCT segment antérieur) — tenir compte de la COUCHE cornéenne
  (épithélium, Bowman, stroma, Descemet, endothélium).
- "octa" : OCT-angiographie.

LOGIQUE DE RÉDACTION :
- Ne mentionner QUE les structures présentant des anomalies significatives
- Si une structure est normale ou sans donnée → ignorer complètement, ne pas la citer
- Synthétiser la SIGNIFICATION CLINIQUE des anomalies, pas les données elles-mêmes
- Formuler le raisonnement du praticien : "L'asymétrie papillaire associée à l'amincissement du RNFL évoque…"
- Un œil normal sur toutes les structures → une phrase globale suffit

MISE EN FORME (analyse_clinique ET conclusion) — à respecter impérativement :
- Entourer de doubles astérisques \`**…**\` UNIQUEMENT les noms de MALADIES ou de
  SYMPTÔMES (ex: \`**glaucome**\`, \`**œdème maculaire**\`, \`**hémorragie rétinienne**\`,
  \`**néovaisseaux**\`). C'est le SEUL usage autorisé du gras.
- NE JAMAIS mettre en gras les sigles techniques (RNFL, GCL, OCT, OCTA, C/D, PIO…),
  les structures anatomiques (macula, papille, rétine…) ni les valeurs chiffrées.
- Désigner les côtés par « œil droit » / « œil gauche » (jamais « à droite » / « à gauche »).

**DIRECTIVES CONCLUSION — formulation prudente OBLIGATOIRE :**
- 1 à 2 phrases, synthèse diagnostique pure. AUCUN suivi, AUCUNE recommandation ici.
- Ne JAMAIS poser un diagnostic ferme (ne pas écrire "Glaucome", "DMLA", "Rétinopathie diabétique" seuls).
- Toujours formuler par compatibilité ou par absence d'argument :
  • en présence de signes évocateurs → « OCT compatible avec … » / « Aspect compatible avec … »
  • en l'absence de signe → « Pas d'argument en faveur de … » / « Absence d'argument en faveur de … »
- Adapter au type d'examen (OCT, rétinographie, OCTA) et rester cohérent avec l'analyse et les données.
- Tenir compte de l'indice d'acquisition : si dégradé, rester prudent (« sous réserve d'un indice
  d'acquisition faible »).

**DIRECTIVES PREVENTION (2 à 3 items) :**
- Conseils pratiques adaptés au profil et aux pathologies identifiées

**DIRECTIVES SUIVI (2 à 3 items) :**
- Examens complémentaires et contrôles spécifiques aux anomalies trouvées

**DIRECTIVES CONSEIL_PATIENT (1 phrase, OBLIGATOIRE) :**
- UNE seule phrase, adressée au patient, en lien direct avec SA pathologie identifiée
- Cibler en priorité : arrêt et information des facteurs de risque (tabac, équilibre tensionnel/glycémique…),
  recommandations alimentaires pertinentes, et surveillance de l'apparition ou de l'évolution de symptômes
- Adapter au profil : ne mentionner que ce qui est pertinent pour la/les pathologie(s) du patient
- Formulation prudente et factuelle — n'invente aucune donnée
- Si aucune pathologie n'est identifiée, donner un conseil d'hygiène visuelle générale et de surveillance

**DIRECTIVES RESUME_PATIENT (langage simple, OBLIGATOIRE) :**
- Destiné AU PATIENT, pas au médecin : phrases courtes, vocabulaire courant, aucun terme technique
  (pas de « RNFL », « GCL », « C/D », « œdème maculaire » sans explication simple entre parenthèses)
- Ton bienveillant, honnête et rassurant — ne jamais minimiser une atteinte réelle ni dramatiser
- "od_etat"/"og_etat" : "ok" (rien à signaler), "watch" (à surveiller), "alert" (suivi rapproché)
- Rester strictement cohérent avec l'analyse et la conclusion ci-dessus — n'invente aucune donnée`;

// ─── Parsing / validation ────────────────────────────────────────────────────

function parseAndValidate(raw: string): { result: AIResult | null; validation: ValidationResult } {
  let parsed: unknown;
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(match ? match[0] : raw);
  } catch {
    return { result: null, validation: { valid: false, score: 'rouge', issues: ['JSON invalide'] } };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { result: null, validation: { valid: false, score: 'rouge', issues: ['Réponse non exploitable'] } };
  }

  const obj = parsed as Record<string, unknown>;
  const issues: string[] = [];

  if (typeof obj['analyse_clinique'] !== 'string') issues.push('Champ analyse_clinique manquant');
  if (typeof obj['conclusion'] !== 'string') issues.push('Champ conclusion manquant');
  if (!Array.isArray(obj['prevention'])) issues.push('Champ prevention manquant ou non-tableau');
  if (!Array.isArray(obj['suivi'])) issues.push('Champ suivi manquant ou non-tableau');

  const severite = obj['severite'];
  if (!['normal', 'surveillance', 'alerte'].includes(String(severite))) {
    issues.push(`Valeur severite invalide: "${severite}"`);
  }

  const result: AIResult = {
    analyse_clinique: typeof obj['analyse_clinique'] === 'string' ? obj['analyse_clinique'] : 'Analyse non disponible.',
    conclusion: typeof obj['conclusion'] === 'string' ? obj['conclusion'] : 'Résultat non exploitable.',
    prevention: Array.isArray(obj['prevention']) ? (obj['prevention'] as string[]) : [],
    suivi: Array.isArray(obj['suivi']) ? (obj['suivi'] as string[]) : [],
    conseil_patient: typeof obj['conseil_patient'] === 'string' ? obj['conseil_patient'] : '',
    severite: (['normal', 'surveillance', 'alerte'].includes(String(severite)) ? severite : 'normal') as AIResult['severite'],
    ...(obj['resume_patient'] && typeof obj['resume_patient'] === 'object'
      ? { resume_patient: obj['resume_patient'] as PatientSummaryAI }
      : {}),
  };

  return {
    result,
    validation: issues.length > 0 ? { valid: false, score: 'orange', issues } : { valid: true, score: 'vert', issues: [] },
  };
}

// ─── Adaptateurs fournisseurs ────────────────────────────────────────────────

async function callOpenAI(apiKey: string, model: string, payload: unknown): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(payload) },
      ],
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) {
    const err = await res.json() as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `Erreur OpenAI ${res.status}`);
  }
  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices[0].message.content;
}

async function callAnthropic(apiKey: string, model: string, payload: unknown): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Données à analyser. Renvoie UNIQUEMENT un objet JSON valide.\n\n${JSON.stringify(payload)}`,
        },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.json() as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `Erreur Anthropic ${res.status}`);
  }
  const data = await res.json() as { content: Array<{ text: string }> };
  return data.content[0].text;
}

async function callDeepSeek(apiKey: string, model: string, payload: unknown): Promise<string> {
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(payload) },
      ],
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) {
    const err = await res.json() as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `Erreur DeepSeek ${res.status}`);
  }
  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices[0].message.content;
}

async function callGemini(apiKey: string, model: string, payload: unknown): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(payload) }] }],
      generationConfig: { responseMimeType: 'application/json' },
    }),
  });
  if (!res.ok) {
    const err = await res.json() as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `Erreur Gemini ${res.status}`);
  }
  const data = await res.json() as { candidates: Array<{ content: { parts: Array<{ text: string }> } }> };
  return data.candidates[0].content.parts[0].text;
}

// ─── Handler Vercel ──────────────────────────────────────────────────────────

function stripEnvQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function loadLocalEnvIfNeeded(): void {
  if (process.env.AI_PROVIDER) return;

  for (const filename of LOCAL_ENV_FILES) {
    const filePath = resolve(process.cwd(), filename);
    if (!existsSync(filePath)) continue;

    const content = readFileSync(filePath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex === -1) continue;

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = stripEnvQuotes(trimmed.slice(separatorIndex + 1));
      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }

    if (process.env.AI_PROVIDER) return;
  }
}

function readAIConfig():
  | { ok: true; provider: AIProviderKey; model: string; apiKey: string }
  | { ok: false; status: number; error: string } {
  loadLocalEnvIfNeeded();

  const providerValue = process.env.AI_PROVIDER;
  if (!providerValue) {
    return {
      ok: false,
      status: 503,
      error: 'Variable AI_PROVIDER non configurée sur le serveur.',
    };
  }

  if (!AI_PROVIDERS.includes(providerValue as AIProviderKey)) {
    return {
      ok: false,
      status: 503,
      error: `Fournisseur IA inconnu : ${providerValue}`,
    };
  }

  const provider = providerValue as AIProviderKey;
  const model = process.env.AI_MODEL;

  if (!model) {
    return {
      ok: false,
      status: 503,
      error: 'Variable AI_MODEL non configurée sur le serveur.',
    };
  }

  const keyMap: Record<AIProviderKey, string | undefined> = {
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
    deepseek: process.env.DEEPSEEK_API_KEY,
  };

  const apiKey = keyMap[provider];
  if (!apiKey) {
    return {
      ok: false,
      status: 503,
      error: `Clé API ${provider} non configurée sur le serveur.`,
    };
  }

  return { ok: true, provider, model, apiKey };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const config = readAIConfig();
  if (!config.ok) {
    return res.status(config.status).json({ error: config.error });
  }

  const payload = req.body;

  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'Corps de requête invalide.' });
  }

  if ('__ping' in payload) {
    return res.status(200).json({
      configured: true,
      provider: config.provider,
      model: config.model,
    });
  }

  try {
    let rawContent: string;

    switch (config.provider) {
      case 'openai':
        rawContent = await callOpenAI(config.apiKey, config.model, payload);
        break;
      case 'anthropic':
        rawContent = await callAnthropic(config.apiKey, config.model, payload);
        break;
      case 'deepseek':
        rawContent = await callDeepSeek(config.apiKey, config.model, payload);
        break;
      case 'gemini':
      default:
        rawContent = await callGemini(config.apiKey, config.model, payload);
        break;
    }

    const { result, validation } = parseAndValidate(rawContent);

    if (!result) {
      return res.status(502).json({ error: 'Réponse IA non exploitable après parsing.', validation });
    }

    return res.status(200).json({ result, validation });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur interne';
    return res.status(502).json({ error: message });
  }
}
