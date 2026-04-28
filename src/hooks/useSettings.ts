import { useEffect, useState, useCallback } from 'react';
import { db, doc, getDoc, setDoc, serverTimestamp } from '../services/firebase';
import type { AppSettings, Doctor } from '../types/settings';

const SETTINGS_DOC_ID = 'clinic';
const LOCAL_CACHE_KEY = 'medivision_settings_cache';

const DEFAULT_SETTINGS: AppSettings = {
  clinic: {
    nom: 'Clinique Medivision',
    adresse: 'Libreville, Gabon',
    telephone: '+241 76 51 50 12',
    email: 'yoanmboussou@gmail.com',
    logo: undefined,
    medecinPrincipal: undefined,
  },
  doctors: [],
  medecinPrescripteurParDefaut: undefined,
  formulario: {},
  export: {
    templateNomFichier: 'CR_{{nom}}_{{date}}',
    formatParDefaut: 'pdf',
  },
};

function cleanUndefined(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(cleanUndefined);
  return Object.fromEntries(
    Object.entries(obj as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, cleanUndefined(v)])
  );
}

function stripTimestamps(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(stripTimestamps);
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (v && typeof v === 'object' && 'seconds' in v && 'nanoseconds' in v) continue;
    result[k] = stripTimestamps(v);
  }
  return result;
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const cached = localStorage.getItem(LOCAL_CACHE_KEY);
        if (cached) setSettings(JSON.parse(cached) as AppSettings);

        const ref = doc(db, 'settings', SETTINGS_DOC_ID);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          const data = stripTimestamps(snap.data()) as AppSettings;
          const merged = { ...DEFAULT_SETTINGS, ...data };
          setSettings(merged);
          localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(merged));
        } else {
          await setDoc(ref, cleanUndefined({ ...DEFAULT_SETTINGS, updatedAt: serverTimestamp() }) as Record<string, unknown>);
          setSettings(DEFAULT_SETTINGS);
          localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(DEFAULT_SETTINGS));
        }
        setError(null);
      } catch (e) {
        console.error('[useSettings] load error', e);
        setError(e instanceof Error ? e.message : 'Erreur chargement paramètres');
        const cached = localStorage.getItem(LOCAL_CACHE_KEY);
        if (cached) setSettings(JSON.parse(cached) as AppSettings);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const persist = useCallback(async (next: AppSettings) => {
    const ref = doc(db, 'settings', SETTINGS_DOC_ID);
    const clean = cleanUndefined({ ...next, updatedAt: serverTimestamp() }) as Record<string, unknown>;
    await setDoc(ref, clean);
    setSettings(next);
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(next));
  }, []);

  const updateClinic = useCallback(
    async (updates: Partial<AppSettings['clinic']>) => {
      if (!settings) return;
      await persist({ ...settings, clinic: { ...settings.clinic, ...updates } });
    },
    [settings, persist]
  );

  const addDoctor = useCallback(
    async (doctor: Omit<Doctor, 'id'>): Promise<Doctor> => {
      if (!settings) throw new Error('Settings non chargés');
      const newDoc: Doctor = { ...doctor, id: `doc_${Date.now()}` };
      await persist({ ...settings, doctors: [...settings.doctors, newDoc] });
      return newDoc;
    },
    [settings, persist]
  );

  const updateDoctor = useCallback(
    async (doctorId: string, updates: Partial<Doctor>) => {
      if (!settings) return;
      const doctors = settings.doctors.map((d) =>
        d.id === doctorId ? { ...d, ...updates } : d
      );
      await persist({ ...settings, doctors });
    },
    [settings, persist]
  );

  const deleteDoctor = useCallback(
    async (doctorId: string) => {
      if (!settings) return;
      const doctors = settings.doctors.filter((d) => d.id !== doctorId);
      const next: AppSettings = {
        ...settings,
        doctors,
        medecinPrescripteurParDefaut:
          settings.medecinPrescripteurParDefaut === doctorId
            ? undefined
            : settings.medecinPrescripteurParDefaut,
      };
      await persist(next);
    },
    [settings, persist]
  );

  const setDefaultPrescriber = useCallback(
    async (doctorId: string | undefined) => {
      if (!settings) return;
      await persist({ ...settings, medecinPrescripteurParDefaut: doctorId });
    },
    [settings, persist]
  );

  const updateFormulaire = useCallback(
    async (updates: Partial<AppSettings['formulario']>) => {
      if (!settings) return;
      await persist({ ...settings, formulario: { ...settings.formulario, ...updates } });
    },
    [settings, persist]
  );

  const updateBulles = useCallback(
    async (category: string, items: string[]) => {
      if (!settings) return;
      await persist({
        ...settings,
        formulario: { ...settings.formulario, [category]: items },
      });
    },
    [settings, persist]
  );

  const updateFormulaireSettings = updateFormulaire;

  const updatePrescripteurs = useCallback(
    async (list: string[]) => {
      if (!settings) return;
      await persist({ ...settings, prescripteurs: list });
    },
    [settings, persist]
  );

  const updateExport = useCallback(
    async (updates: Partial<AppSettings['export']>) => {
      if (!settings) return;
      await persist({ ...settings, export: { ...settings.export, ...updates } });
    },
    [settings, persist]
  );

  return {
    settings,
    loading,
    error,
    updateClinic,
    addDoctor,
    updateDoctor,
    deleteDoctor,
    setDefaultPrescriber,
    updateFormulaire,
    updateFormulaireSettings,
    updateBulles,
    updatePrescripteurs,
    updateExport,
  };
}
