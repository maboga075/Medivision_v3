import type { AIResult, AIPayload, ValidationResult } from '../types/ai';

export interface AICallResult {
  result: AIResult;
  validation: ValidationResult;
}

export const callNativeAI = async (payload: AIPayload): Promise<AICallResult> => {
  const response = await fetch('/api/ai/generate-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = `Erreur serveur IA (${response.status})`;
    try {
      const body = await response.json() as { error?: string };
      if (body.error) message = body.error;
    } catch { /* ignore */ }
    throw new Error(message);
  }

  const data = await response.json() as { result: AIResult; validation: ValidationResult };
  return { result: data.result, validation: data.validation };
};
