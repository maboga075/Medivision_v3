import { REPORT_TYPES } from '../../../utils/constants';
import type { ReportType } from '../../../utils/constants';
import type { Doctor } from '../../../types/settings';
import DoctorCombobox from '../../../components/forms/DoctorCombobox';

interface ExamTypeSelectorProps {
  reportType: ReportType;
  onReportTypeChange: (type: ReportType) => void;
  selectedDoctorId: string;
  onDoctorChange: (id: string) => void;
  doctors?: Doctor[];
}

export default function ExamTypeSelector({
  reportType,
  onReportTypeChange,
  selectedDoctorId,
  onDoctorChange,
  doctors,
}: ExamTypeSelectorProps) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm mb-6 flex flex-col gap-4">
      <div className="flex flex-col md:flex-row flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          <label className="text-sm font-black uppercase text-slate-500 tracking-wider">
            Type d'examen
          </label>
          <select
            className="p-3 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none bg-slate-50 w-full sm:w-64"
            value={reportType}
            onChange={(e) => onReportTypeChange(e.target.value as ReportType)}
          >
            {REPORT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {doctors && doctors.length > 0 && (
          <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
            <label className="text-sm font-black uppercase text-slate-500 tracking-wider">
              Médecin examinateur
            </label>
            <DoctorCombobox
              doctors={doctors}
              selectedId={selectedDoctorId}
              onChange={onDoctorChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}
