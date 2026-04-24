import { useCallback, useRef } from 'react';
import type { EyeState, HypotheseDiagnostique } from '../types/clinical';
import type { ReportType } from '../utils/constants';

const DRAFT_STORAGE_KEY = 'medivision_consultation_drafts';

export interface ConsultationDraft {
  reportType: ReportType;
  eyeOD: EyeState;
  eyeOG: EyeState;
  forceShowAnterior: boolean;
  octaDone: boolean;
  hypothesesDiagnostiques: HypotheseDiagnostique[];
  hypotheseLibre: string;
  selectedCat: string;
  selectedHyp: string;
  selectedLat: 'OD et OG' | 'OD' | 'OG';
}

function tryWrite(data: Record<string, ConsultationDraft>) {
  try {
    sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Quota dépassé — on réessaie en retirant les images (base64 volumineuses)
    const stripped = Object.fromEntries(
      Object.entries(data).map(([id, d]) => [
        id,
        { ...d, eyeOD: { ...d.eyeOD, images: [] }, eyeOG: { ...d.eyeOG, images: [] } },
      ])
    );
    try {
      sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(stripped));
    } catch {
      // Impossible même sans images, on abandonne silencieusement
    }
  }
}

export function useConsultationDrafts() {
  const draftsRef = useRef<Record<string, ConsultationDraft>>({});

  const loadAllDrafts = useCallback(() => {
    try {
      const stored = sessionStorage.getItem(DRAFT_STORAGE_KEY);
      if (stored) {
        draftsRef.current = JSON.parse(stored) as Record<string, ConsultationDraft>;
      }
    } catch (err) {
      console.warn('[drafts] Erreur chargement sessionStorage:', err);
    }
    return draftsRef.current;
  }, []);

  const saveDraft = useCallback((patientId: string, draft: ConsultationDraft) => {
    draftsRef.current[patientId] = draft;
    tryWrite(draftsRef.current);
  }, []);

  const getDraft = useCallback((patientId: string): ConsultationDraft | null => {
    return draftsRef.current[patientId] ?? null;
  }, []);

  const deleteDraft = useCallback((patientId: string) => {
    delete draftsRef.current[patientId];
    tryWrite(draftsRef.current);
  }, []);

  const clearAllDrafts = useCallback(() => {
    draftsRef.current = {};
    try {
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return { loadAllDrafts, saveDraft, getDraft, deleteDraft, clearAllDrafts };
}
