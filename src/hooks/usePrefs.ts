import { useState, useEffect } from 'react';
import { DEFAULT_PREFS } from '../utils/constants';
import type { UserPrefs, PrefsKey } from '../types/prefs';

const STORAGE_KEY = 'medivision_v9_prefs';

export function usePrefs(): {
  prefs: UserPrefs;
  updatePrefs: (key: PrefsKey, value: string) => void;
  removePref: (key: PrefsKey, value: string) => void;
} {
  const [prefs, setPrefs] = useState<UserPrefs>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_PREFS, ...(JSON.parse(saved) as Partial<UserPrefs>) };
      }
      return DEFAULT_PREFS;
    } catch {
      return DEFAULT_PREFS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // storage quota exceeded — fail silently
    }
  }, [prefs]);

  const updatePrefs = (key: PrefsKey, value: string) => {
    if (!value || typeof value !== 'string' || !value.trim()) return;
    setPrefs((p) => ({ ...p, [key]: [...new Set([...p[key], value.trim()])] }));
  };

  const removePref = (key: PrefsKey, value: string) => {
    setPrefs((p) => ({ ...p, [key]: p[key].filter((v) => v !== value) }));
  };

  return { prefs, updatePrefs, removePref };
}
