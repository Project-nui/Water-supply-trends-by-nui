import React, { useRef } from 'react';
import { ActiveView, WaterRecord } from '../types';
import { Upload, Download, LogOut } from 'lucide-react';
import * as XLSX from 'xlsx';

interface TopbarProps {
  activeView: ActiveView;
  onImportData: (records: WaterRecord[], added: number, updated: number, skipped: number) => void;
  data: WaterRecord[];
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onLogout?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  activeView,
  onImportData,
  data,
  showToast,
  onLogout,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const titles: Record<ActiveView, { title: string; sub: string }> = {
    dashboard: {
      title: 'ภาพรวมระบบ',
      sub: 'สรุปการใช้น้ำล่าสุดจากทุกกลุ่มมิเตอร์',
    },
    daily: {
      title: 'ข้อมูลรายวัน',
      sub: 'ตรวจสอบค่าการใช้น้ำและไฟฟ้ารายวันตามช่วงเวลา',
    },
    monthly: {
      title: 'ข้อมูลรายเดือน',
      sub: 'เปรียบเทียบยอดใช้น้ำรายเดือนและแนวโน้ม',
    },
    yearly: {
      title: 'สรุปเปรียบเทียบรายปี',
      sub: 'วิเคราะห์แนวโน้มและเปรียบเทียบการใช้น้ำปีต่อปี (Year-over-Year)',
    },
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result;
        if (!buffer) return;
        const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
        const sheetName = wb.SheetNames[0];
        const sheet = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(sheet, {
          header: 1,
          raw: true,
        });

        if (!rows || rows.length < 2) {
          showToast('ไม่พบข้อมูลในไฟล์ Excel ที่เลือก', 'error');
          return;
        }

        // Find header row containing 'date'
        let headerRowIdx = rows.findIndex(
          (r) => Array.isArray(r) && r.some((c) => typeof c === 'string' && c.toLowerCase().includes('date'))
        );
        if (headerRowIdx === -1) headerRowIdx = 0;

        const header = (rows[headerRowIdx] || []).map((h) => (h || '').toString().trim().toLowerCase());
        const colDate = header.findIndex((h) => h.includes('date') || h.includes('วันที่'));
        const colPwp = header.findIndex((h) => h.includes('pwp'));
        const colCwp1 = header.findIndex((h) => h.includes('cwp 1') || h.includes('cwp1') || h.includes('cwp 1-4'));
        const colCwp2 = header.findIndex((h) => h.includes('cwp 5') || h.includes('cwp2') || h.includes('cwp 5-7'));

        if (colDate === -1) {
          showToast('ไม่พบคอลัมน์ "Date" หรือ "วันที่" ในไฟล์ — ยกเลิกการนำเข้า', 'error');
          return;
        }

        let added = 0;
        let updated = 0;
        let skipped = 0;

        const existingMap = new Map<string, WaterRecord>(data.map((d) => [d.date, { ...d }]));

        const parseNum = (v: unknown): number | null => {
          if (v === undefined || v === null || v === '') return null;
          const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
          return isNaN(n) ? null : n;
        };

        for (let i = headerRowIdx + 1; i < rows.length; i++) {
          const r = rows[i];
          if (!r || r[colDate] === undefined || r[colDate] === null || r[colDate] === '') continue;

          const rawDate = r[colDate];
          let dateObj: Date;

          if (rawDate instanceof Date) {
            dateObj = rawDate;
          } else if (typeof rawDate === 'number') {
            // Excel serial date number
            dateObj = new Date((rawDate - 25569) * 86400 * 1000);
          } else {
            dateObj = new Date(String(rawDate));
          }

          if (isNaN(dateObj.getTime())) {
            skipped++;
            continue;
          }

          const iso = dateObj.toISOString().slice(0, 10);
          const pwpVal = colPwp >= 0 ? parseNum(r[colPwp]) : null;
          const cwp1Val = colCwp1 >= 0 ? parseNum(r[colCwp1]) : null;
          const cwp2Val = colCwp2 >= 0 ? parseNum(r[colCwp2]) : null;

          if (existingMap.has(iso)) {
            updated++;
            const existing = existingMap.get(iso)!;
            if (pwpVal !== null) existing.pwp = pwpVal;
            if (cwp1Val !== null) existing.cwp1 = cwp1Val;
            if (cwp2Val !== null) existing.cwp2 = cwp2Val;
          } else {
            added++;
            existingMap.set(iso, {
              date: iso,
              pwp: pwpVal,
              cwp1: cwp1Val,
              cwp2: cwp2Val,
            });
          }
        }

        const mergedRecords = Array.from(existingMap.values()).sort((a, b) => a.date.localeCompare(b.date));
        onImportData(mergedRecords, added, updated, skipped);
      } catch (err) {
        console.error(err);
        showToast('เกิดข้อผิดพลาดขณะอ่านไฟล์ — ตรวจสอบรูปแบบไฟล์ Excel', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleExportExcel = () => {
    try {
      const exportRows = data.map((d) => ({
        Date: d.date,
        'PWP 1-6': d.pwp ?? '',
        'CWP 1-4': d.cwp1 ?? '',
        'CWP 5-7': d.cwp2 ?? '',
        'Total (รวม)': (d.pwp || 0) + (d.cwp1 || 0) + (d.cwp2 || 0),
      }));

      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'WaterConsumption');
      XLSX.writeFile(wb, `water_consumption_data_${new Date().toISOString().slice(0, 10)}.xlsx`);
      showToast('ดาวน์โหลดไฟล์ Excel สำเร็จ', 'success');
    } catch (err) {
      console.error(err);
      showToast('เกิดข้อผิดพลาดในการส่งออกไฟล์ Excel', 'error');
    }
  };

  return (
    <header
      id="app-topbar"
      className="border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between px-6 md:px-8 py-4 bg-[#161922] gap-4 shrink-0"
    >
      <div>
        <h1 id="topbar-page-title" className="text-white font-semibold tracking-tight text-lg md:text-xl">
          {titles[activeView].title}
        </h1>
        <p id="topbar-page-sub" className="text-slate-400 text-xs mt-0.5">
          {titles[activeView].sub}
        </p>
      </div>

      <div className="flex items-center gap-3">
        {/* Sleek Live Indicator Pill */}
        <div className="hidden lg:flex items-center gap-2 bg-white/5 px-3.5 py-2 rounded-full border border-white/10">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-xs font-medium text-slate-300">ระบบทำงานปกติ: ออนไลน์</span>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          id="file-input"
          className="hidden"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileChange}
        />

        <button
          id="btn-export-excel"
          type="button"
          onClick={handleExportExcel}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white transition-colors cursor-pointer shadow-sm"
          title="ส่งออกข้อมูลเป็น Excel"
        >
          <Download className="w-3.5 h-3.5 text-slate-400" />
          <span>ส่งออก Excel</span>
        </button>

        <button
          id="import-btn"
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer shadow-md shadow-blue-600/20"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>นำเข้าข้อมูล Excel</span>
        </button>

        {onLogout && (
          <button
            id="btn-logout"
            type="button"
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-white/10 bg-white/5 text-slate-400 hover:text-rose-400 hover:border-rose-500/30 hover:bg-rose-500/10 transition-colors cursor-pointer"
            title="ออกจากระบบ / ล็อคหน้าจอ"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">ออกจากระบบ</span>
          </button>
        )}
      </div>
    </header>
  );
};
