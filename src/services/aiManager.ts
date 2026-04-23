import type { AIResult, AIProviderKey, AIPayload, ValidationResult } from '../types/ai';

// Prompt système amélioré — inspiré du monolithe, schéma de sortie mis à jour
export const SYSTEM_PROMPT = `Tu es un ophtalmologue senior spécialisé en imagerie oculaire (OCT, rétinographie, OCTA).
Tu reçois des données cliniques structurées, potentiellement enrichies d'une pré-analyse clinique automatisée ("analyse_clinique").

MÉTHODOLOGIE OBLIGATOIRE :
1. IDENTIFIER les anomalies objectives fournies.
2. INTÉGRER l'historique (ex: suivi RNFL/GCL) pour définir la stabilité ou l'évolution.
3. CORRÉLER avec le motif d'examen et les antécédents.
4. CONCLURE en répondant directement au motif d'examen.

RÈGLE ABSOLUE :
Tu ne dois générer une section dans 'interpretation' QUE si des données pertinentes t'ont été transmises pour cette structure.
Si on ne te transmet aucune donnée sur la macula (ex: examen du segment antérieur exclusif), N'INCLUS PAS la clé 'macula' dans le JSON.
Ne dis jamais "Non réalisé" ou "Non documenté". Omet simplement la clé.
Tu ne dois JAMAIS inventer de données absentes. Si les données sont insuffisantes, utilise des formulations prudentes.

FORMAT DE RÉPONSE (JSON strict, AUCUN texte autour, AUCUNE balise markdown) :
{
  "interpretation": {
    "segment_anterieur": "Analyse du segment antérieur et cornée (si données fournies).",
    "synthese_oct": "Synthèse intégrée RNFL/GCL/OCTA (si données fournies).",
    "macula": "État maculaire (si données fournies).",
    "papille": "État papille/disque (si données fournies).",
    "vascularisation": "État vasculaire rétinien (si données fournies).",
    "peripherie": "État de la périphérie rétinienne (si données fournies)."
  },
  "conclusion": "2-3 phrases répondant DIRECTEMENT au motif d'examen.",
  "recommandations": {
    "hygiene": "Conseils personnalisés pour le patient.",
    "suivi": "Délai du prochain contrôle + examens complémentaires si nécessaires."
  },
  "severite": "normal|surveillance|alerte"
}

RÈGLES STRICTES :
- Français médical professionnel, concis, décisionnel.
- Répondre UNIQUEMENT avec le JSON, sans commentaire ni explication.`;

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

  if (typeof obj['conclusion'] !== 'string') issues.push('Champ conclusion manquant');
  if (typeof obj['interpretation'] !== 'object' || obj['interpretation'] === null) issues.push('Champ interpretation manquant');
  if (typeof obj['recommandations'] !== 'object' || obj['recommandations'] === null) issues.push('Champ recommandations manquant');

  const severite = obj['severite'];
  if (!['normal', 'surveillance', 'alerte'].includes(String(severite))) {
    issues.push(`Valeur severite invalide: "${severite}"`);
  }

  if (issues.length > 0) {
    // Tentative de fallback partiel
    const fallbackResult: AIResult = {
      interpretation: (typeof obj['interpretation'] === 'object' && obj['interpretation'] !== null
        ? obj['interpretation']
        : {}) as AIResult['interpretation'],
      conclusion: typeof obj['conclusion'] === 'string' ? obj['conclusion'] : 'Résultat non exploitable — vérifier les données cliniques.',
      recommandations: (typeof obj['recommandations'] === 'object' && obj['recommandations'] !== null
        ? obj['recommandations']
        : { hygiene: '—', suivi: '—' }) as AIResult['recommandations'],
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
