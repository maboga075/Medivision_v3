import type { SavedReport } from '../types/savedReport';

const STORAGE_KEY = 'medivision_saved_reports';

function readAll(): SavedReport[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedReport[];
  } catch {
    return [];
  }
}

function writeAll(reports: SavedReport[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
  } catch {
    // Quota dépassé : retirer les images et réessayer
    const stripped = reports.map((r) => ({
      ...r,
      data: {
        ...r.data,
        eyes: {
          od: { ...r.data.eyes.od },
          og: { ...r.data.eyes.og },
        },
      },
    }));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stripped));
    } catch {
      // Abandonne silencieusement si toujours plein
    }
  }
}

export const reportStorage = {
  getAll(): SavedReport[] {
    return readAll().sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  getById(id: string): SavedReport | null {
    return readAll().find((r) => r.id === id) ?? null;
  },

  save(report: SavedReport): void {
    const all = readAll();
    const idx = all.findIndex((r) => r.id === report.id);
    if (idx >= 0) {
      all[idx] = { ...report, updatedAt: new Date().toISOString() };
    } else {
      all.unshift(report);
    }
    writeAll(all);
  },

  delete(id: string): void {
    writeAll(readAll().filter((r) => r.id !== id));
  },

  deleteByPatient(patientId: string): void {
    writeAll(readAll().filter((r) => r.patientId !== patientId));
  },
};
