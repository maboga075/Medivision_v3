import { EditableInline } from '../shared/EditableText';
import { isCupDiscAlert, isAnomaly } from '../../utils/clinicalData';

interface TableRow {
  label: string;
  od: string | number | undefined;
  og: string | number | undefined;
  fieldOD: string;
  fieldOG: string;
  isCupDisc?: boolean;
  isSurface?: boolean;
  sub?: boolean;
}

interface ReportDataTableProps {
  title: string;
  rows: TableRow[];
  edits: Record<string, string>;
  onEdit: (field: string, value: string) => void;
}

const getCellColor = (val: string, isCupDisc?: boolean, isSurface?: boolean): string => {
  if (isCupDisc) return isCupDiscAlert(val) ? 'text-red-600 font-black' : 'text-slate-700 font-medium';
  if (isSurface) return 'text-slate-700 font-medium';
  if (val === 'Impossible') return 'text-red-600 font-black';
  return isAnomaly(val) ? 'text-orange-600 font-black' : 'text-slate-700 font-medium';
};

export default function ReportDataTable({ title, rows, edits, onEdit }: ReportDataTableProps) {
  if (!rows || rows.length === 0) return null;

  return (
    <div className="w-full mb-4">
      <div className="text-xs font-extrabold text-teal-600 uppercase tracking-wider mb-2 border-b-2 border-teal-100 pb-1">
        {title}
      </div>
      <table className="w-full text-xs border-collapse table-fixed bg-white rounded-xl overflow-hidden shadow-sm border border-slate-200">
        <thead>
          <tr className="bg-[#0C2233] text-white">
            <th className="p-2 text-left w-1/3 font-bold">Paramètre</th>
            <th className="p-2 text-center w-1/3 font-bold">OD</th>
            <th className="p-2 text-center w-1/3 font-bold border-l border-slate-700">OG</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const rawOD = String(edits[r.fieldOD] !== undefined ? edits[r.fieldOD] : r.od ?? '—');
            const rawOG = String(edits[r.fieldOG] !== undefined ? edits[r.fieldOG] : r.og ?? '—');

            return (
              <tr
                key={i}
                className={`border-b border-slate-100 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}
              >
                <td
                  className={`p-2 ${r.sub ? 'pl-6 text-slate-500 italic' : 'font-extrabold text-slate-800'}`}
                >
                  {r.label}
                </td>
                <td className={`p-2 text-center border-l border-slate-100 ${getCellColor(rawOD, r.isCupDisc, r.isSurface)}`}>
                  <EditableInline value={rawOD} field={r.fieldOD} onEdit={onEdit} />
                </td>
                <td className={`p-2 text-center border-l border-slate-100 ${getCellColor(rawOG, r.isCupDisc, r.isSurface)}`}>
                  <EditableInline value={rawOG} field={r.fieldOG} onEdit={onEdit} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
