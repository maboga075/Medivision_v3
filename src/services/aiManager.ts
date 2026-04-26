import type { AIResult, AIProviderKey, AIPayload, ValidationResult } from '../types/ai';

export const SYSTEM_PROMPT = `Tu es un ophtalmologue senior spécialisé en imagerie oculaire (OCT, rétinographie, OCTA).
Tu reçois des données cliniques structurées et dois générer un compte rendu en JSON.

RÈGLES OBLIGATOIRES :
1. Ne génère une section que si des données pertinentes t'ont été transmises.
2. N'invente JAMAIS de données — utilise seulement ce qui est fourni.
3. Répondre UNIQUEMENT en JSON strict, AUCUN texte autour.
4. Les champs "prevention" et "suivi" sont des TABLEAUX de chaînes (chaque élément = 1 item de liste).

**FORMAT DE RÉPONSE (JSON strict) :**
{
  "analyse_clinique": "Texte narratif médical complet. Décrire les résultats par structure : macula (OD puis OG), papille (OD puis OG), RNFL, GCL++, périphérie. Mentionner le segment antérieur seulement si anteriorSegmentDone = true. Mentionner l'OCTA seulement si octaDone = true. Si une structure manque de données, l'indiquer explicitement.",
  "conclusion": "Synthèse diagnostique pure (2-3 phrases). AUCUN suivi, AUCUNE surveillance, AUCUN examen complémentaire ici.",
  "prevention": [
    "Conseil hygiène/prévention 1",
    "Conseil hygiène/prévention 2"
  ],
  "suivi": [
    "Examen ou contrôle recommandé 1",
    "Examen ou contrôle recommandé 2"
  ],
  "severite": "normal | surveillance | alerte"
}

**DIRECTIVES ANALYSE_CLINIQUE :**
- Prose médicale professionnelle, structure narrative (pas de liste)
- Décrire OD puis OG pour chaque structure anatomique
- Ne jamais inclure de suivi ou de recommandations dans ce champ

**DIRECTIVES PREVENTION (2 à 4 items maximum) :**
- Conseils de mode de vie et d'hygiène oculaire
- Adapter au profil du patient (âge, antécédents, sévérité)

**DIRECTIVES SUIVI (2 à 4 items maximum) :**
- Examens complémentaires, contrôles, délais de révision
- Toute information de surveillance/follow-up va UNIQUEMENT ici

N'invente jamais d'anatomie. Si les données sont insuffisantes, le dire explicitement.`;

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
