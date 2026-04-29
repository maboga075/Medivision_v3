import { REPORT_TYPES } from '../../../utils/constants';
import type { ReportType } from '../../../utils/constants';
import type { Doctor } from '../../../types/settings';

interface ExamTypeSelectorProps {
  reportType: ReportType;
  onReportTypeChange: (type: ReportType) => void;
  selectedDoctorId: string;
  onDoctorChange: (id: string) => void;
  showAnterior: boolean;
  isAnteriorBase: boolean;
  onAnteriorChange: (checked: boolean) => void;
  octaDone: boolean;
  onOctaDoneChange: (checked: boolean) => void;
  doctors?: Doctor[];
}

export default function ExamTypeSelector({
  reportType,
  onReportTypeChange,
  selectedDoctorId,
  onDoctorChange,
  showAnterior,
  isAnteriorBase,
  onAnteriorChange,
  octaDone,
  onOctaDoneChange,
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
            <select
              className="p-3 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none bg-slate-50 w-full sm:w-64"
              value={selectedDoctorId}
              onChange={(e) => onDoctorChange(e.target.value)}
            >
              <option value="">— Sélectionner —</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  Dr. {d.prenom} {d.nom}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-6 pt-3 border-t border-slate-100">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={showAnterior}
            onChange={(e) => {
              if (isAnteriorBase) onAnteriorChange(e.target.checked);
              else onAnteriorChange(e.target.checked);
            }}
            className="w-5 h-5 rounded border-2 border-slate-300 accent-teal-600 cursor-pointer"
          />
          <span className="font-medium text-slate-700 text-sm">OCT segment antérieur réalisé</span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={octaDone}
            onChange={(e) => onOctaDoneChange(e.target.checked)}
            className="w-5 h-5 rounded border-2 border-slate-300 accent-teal-600 cursor-pointer"
          />
          <span className="font-medium text-slate-700 text-sm">OCTA réalisé</span>
        </label>
      </div>
    </div>
  );
}
