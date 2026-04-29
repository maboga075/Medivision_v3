import { useState, useCallback } from 'react';
import { reportStorage } from '../../../services/reportStorage';
import type { SavedReport } from '../../../types/savedReport';
import type { OCTReportData } from '../../../types/report';
import type { ReportType } from '../../../utils/constants';

interface SaveReportParams {
  patientId: string;
  patientNom: string;
  folderId?: string;
  reportType: ReportType;
  data: OCTReportData;
  status?: SavedReport['status'];
}

export function useReports() {
  const [reports, setReports] = useState<SavedReport[]>(() => reportStorage.getAll());

  const refresh = useCallback(() => {
    setReports(reportStorage.getAll());
  }, []);

  const saveReport = useCallback(
    ({ patientId, patientNom, folderId, reportType, data, status = 'final' }: SaveReportParams): SavedReport => {
      const now = new Date().toISOString();
      const report: SavedReport = {
        id: crypto.randomUUID(),
        patientId,
        patientNom,
        folderId,
        createdAt: now,
        updatedAt: now,
        reportType,
        data,
        status,
      };
      reportStorage.save(report);
      refresh();
      return report;
    },
    [refresh]
  );

  const updateReport = useCallback(
    (id: string, patch: Partial<Pick<SavedReport, 'data' | 'status'>>) => {
      const existing = reportStorage.getById(id);
      if (!existing) return;
      reportStorage.save({ ...existing, ...patch, updatedAt: new Date().toISOString() });
      refresh();
    },
    [refresh]
  );

  const deleteReport = useCallback(
    (id: string) => {
      reportStorage.delete(id);
      refresh();
    },
    [refresh]
  );

  const getById = useCallback((id: string): SavedReport | null => {
    return reportStorage.getById(id);
  }, []);

  return { reports, saveReport, updateReport, deleteReport, getById, refresh };
}
