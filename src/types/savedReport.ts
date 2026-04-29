import type { OCTReportData } from './report';
import type { ReportType } from '../utils/constants';

export interface SavedReport {
  id: string;
  patientId: string;
  patientNom: string;
  folderId?: string;
  createdAt: string;
  updatedAt: string;
  reportType: ReportType;
  data: OCTReportData;
  status: 'draft' | 'final';
}
