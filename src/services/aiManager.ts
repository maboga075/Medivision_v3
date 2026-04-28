import type { AIResult, AIProviderKey, AIPayload, ValidationResult } from '../types/ai';

export const SYSTEM_PROMPT = `Tu es un ophtalmologue senior spécialisé en imagerie oculaire (OCT, rétinographie, OCTA).
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
  "severite": "normal | surveillance | alerte"
}

**DIRECTIVES ANALYSE_CLINIQUE — CRITIQUES, à respecter impérativement :**

LONGUEUR : 3 à 4 phrases MAXIMUM. Jamais plus.

INTERDICTIONS ABSOLUES — ne jamais écrire ces formulations :
- "Acquisition de bonne qualité" / "qualité d'acquisition" / "image de bonne qualité"
- "OCTA non réalisé" / "segment antérieur non examiné" / "non réalisé" / "non effectué"
- "Aucune donnée transmise" / "aucune donnée exploitable" / "non renseigné" / "non transmis"
- Toute formulation signalant l'ABSENCE d'un examen ou d'une donnée
- Toute répétition textuelle des valeurs brutes (ex: "Cup/Disc renseigné à 0.9", "RNFL renseigné comme stable")

LOGIQUE DE RÉDACTION :
- Ne mentionner QUE les structures présentant des anomalies significatives
- Si une structure est normale ou sans donnée → ignorer complètement, ne pas la citer
- Synthétiser la SIGNIFICATION CLINIQUE des anomalies, pas les données elles-mêmes
- Formuler le raisonnement du praticien : "L'asymétrie papillaire associée à l'amincissement du RNFL évoque…", "Les lésions vasculaires maculaires dans ce contexte diabétique suggèrent…"
- Un œil normal sur toutes les structures → une phrase globale suffit ("Les deux yeux présentent des paramètres dans les normes.")

EXEMPLE DE BONNE QUALITÉ :
"L'asymétrie papillaire marquée avec un rapport C/D à 0,9 bilatéral et l'amincissement du RNFL en temporal inférieur gauche constituent un profil glaucomateux à confirmer. Les drusens maculaires bilatéraux s'inscrivent dans un tableau de DMLA débutante à surveiller. Les microanévrismes et néovaisseaux maculaires gauches, dans ce contexte diabétique, orientent vers une rétinopathie diabétique proliférante."

EXEMPLE DE MAUVAISE QUALITÉ (à ne jamais reproduire) :
"Acquisition de bonne qualité aux deux yeux. Au niveau maculaire, l'œil droit présente des drusens, sans autre détail morphologique maculaire transmis. L'OCTA n'a pas été réalisé. Aucune donnée exploitable concernant la périphérie rétinienne n'a été transmise."

**DIRECTIVES CONCLUSION :**
- 1 à 2 phrases, synthèse diagnostique pure
- AUCUN suivi, AUCUNE recommandation ici

**DIRECTIVES PREVENTION (2 à 3 items) :**
- Conseils pratiques adaptés au profil et aux pathologies identifiées

**DIRECTIVES SUIVI (2 à 3 items) :**
- Examens complémentaires et contrôles spécifiques aux anomalies trouvées`;

const parseAndValidateAIResponse = (rawContent: string): { result: AIResult | null; validation: ValidationResult } => {
  let parsed: unknown;

  try {
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    const jsonString = jsonMatch ? jsonMatch[0] : rawContent;
    parsed = JSON.parse(jsonString);
  } catch {
    return {
      result: null,
      validation: {
        valid: false,
        score: 'rouge',
        issues: ['Réponse IA non parseable (JSON invalide)'],
      },
    };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return {
      result: null,
      validation: { valid: false, score: 'rouge', issues: ['Réponse IA non exploitable'] },
    };
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

  if (issues.length > 0) {
    const fallbackResult: AIResult = {
      analyse_clinique: typeof obj['analyse_clinique'] === 'string'
        ? obj['analyse_clinique']
        : 'Analyse non disponible — vérifier les données cliniques.',
      conclusion: typeof obj['conclusion'] === 'string'
        ? obj['conclusion']
        : 'Résultat non exploitable — vérifier les données cliniques.',
      prevention: Array.isArray(obj['prevention'])
        ? (obj['prevention'] as string[])
        : [],
      suivi: Array.isArray(obj['suivi'])
        ? (obj['suivi'] as string[])
        : [],
      severite: (['normal', 'surveillance', 'alerte'].includes(String(severite))
        ? severite
        : 'normal') as AIResult['severite'],
    };
    return {
      result: fallbackResult,
      validation: { valid: false, score: 'orange', issues },
    };
  }

  return {
    result: obj as unknown as AIResult,
    validation: { valid: true, score: 'vert', issues: [] },
  };
};

// ─── Adaptateurs par fournisseur ────────────────────────────────────────────

const fetchOpenAI = async (apiKey: string, model: string, payload: AIPayload): Promise<string> => {
  const response = await fetch('/api/openai/v1/chat/completions', {
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
  if (!response.ok) {
    const err = await response.json() as { error?: { message?: string } };
    throw new Error(err.error?.message ?? 'Erreur API OpenAI');
  }
  const data = await response.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices[0].message.content;
};

const fetchAnthropic = async (apiKey: string, model: string, payload: AIPayload): Promise<string> => {
  const response = await fetch('/api/anthropic/v1/messages', {
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
          content: `Voici les données au format JSON à analyser. Renvoie UNIQUEMENT un objet JSON valide en réponse.\n\n${JSON.stringify(payload)}`,
        },
      ],
    }),
  });
  if (!response.ok) {
    const err = await response.json() as { error?: { message?: string } };
    throw new Error(err.error?.message ?? 'Erreur API Anthropic');
  }
  const data = await response.json() as { content: Array<{ text: string }> };
  return data.content[0].text;
};

const fetchDeepSeek = async (apiKey: string, model: string, payload: AIPayload): Promise<string> => {
  const response = await fetch('/api/deepseek/chat/completions', {
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
  if (!response.ok) {
    const err = await response.json() as { error?: { message?: string } };
    throw new Error(err.error?.message ?? 'Erreur API DeepSeek');
  }
  const data = await response.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices[0].message.content;
};

const fetchGemini = async (apiKey: string, model: string, payload: AIPayload): Promise<string> => {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify(payload) }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    }
  );
  if (!response.ok) {
    const err = await response.json() as { error?: { message?: string } };
    throw new Error(err.error?.message ?? 'Erreur API Gemini');
  }
  const data = await response.json() as { candidates: Array<{ content: { parts: Array<{ text: string }> } }> };
  return data.candidates[0].content.parts[0].text;
};

// ─── Point d'entrée principal ────────────────────────────────────────────────

export interface AICallResult {
  result: AIResult;
  validation: ValidationResult;
}

export const callNativeAI = async (
  payload: AIPayload
): Promise<AICallResult> => {
  const savedConfig = localStorage.getItem('medivision_ai_config');
  let config: Record<string, unknown> | null = null;

  try {
    config = savedConfig ? (JSON.parse(savedConfig) as Record<string, unknown>) : null;
  } catch {
    throw new Error('Configuration IA corrompue. Veuillez reconfigurer dans Paramètres.');
  }

  const providerKey = (config?.activeEngine as AIProviderKey | undefined) ?? 'gemini';

  if (!(['openai', 'anthropic', 'deepseek', 'gemini'] as const).includes(providerKey)) {
    throw new Error(`Fournisseur IA inconnu : ${providerKey}`);
  }

  const providerConfig = config?.[providerKey] as { apiKey?: string; selectedModel?: string } | undefined;

  if (!providerConfig?.apiKey) {
    throw new Error(`Clé API manquante pour le fournisseur : ${providerKey}. Configurez-la dans Paramètres.`);
  }
  if (!providerConfig?.selectedModel) {
    throw new Error(`Modèle non sélectionné pour le fournisseur : ${providerKey}.`);
  }

  const { apiKey, selectedModel } = providerConfig;

  console.info(`[AI] Routage vers ${providerKey} (${selectedModel})`);

  let rawContent: string;

  switch (providerKey) {
    case 'openai':
      rawContent = await fetchOpenAI(apiKey, selectedModel, payload);
      break;
    case 'anthropic':
      rawContent = await fetchAnthropic(apiKey, selectedModel, payload);
      break;
    case 'deepseek':
      rawContent = await fetchDeepSeek(apiKey, selectedModel, payload);
      break;
    case 'gemini':
    default:
      rawContent = await fetchGemini(apiKey, selectedModel, payload);
      break;
  }

  console.info('[AI] Réponse brute reçue');

  const { result, validation } = parseAndValidateAIResponse(rawContent);

  if (!result) {
    throw new Error('Réponse IA non exploitable après parsing.');
  }

  return { result, validation };
};
