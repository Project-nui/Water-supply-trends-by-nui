import React, { useRef, useState } from 'react';
import { ActiveView, WaterRecord, HourlyIntervalRecord, TARGET_TAG_PWP, TARGET_TAG_CWP1, TARGET_TAG_CWP2 } from '../types';
import { Upload, Download, LogOut, FileSpreadsheet, Info, X, CheckCircle2, ArrowDownToLine } from 'lucide-react';
import * as XLSX from 'xlsx';
import { parseTotalizerWorkbook, downloadStandardImportTemplate } from '../utils/totalizerParser';

interface TopbarProps {
  activeView: ActiveView;
  onImportData: (records: WaterRecord[], added: number, updated: number, skipped: number) => void;
  onImportTotalizer?: (intervals: HourlyIntervalRecord[], daily: WaterRecord[], msg: string) => void;
  data: WaterRecord[];
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onLogout?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  activeView,
  onImportData,
  onImportTotalizer,
  data,
  showToast,
  onLogout,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  const titles: Record<ActiveView, { title: string; sub: string }> = {
    dashboard: {
      title: 'ภาพรวมระบบ',
      sub: 'สรุปการใช้น้ำล่าสุดจากทุกกลุ่มมิเตอร์',
    },
    hourly: {
      title: 'ปริมาณการไหลต่อชั่วโมง (Hourly Flow)',
      sub: 'วิเคราะห์อัตราการไหล (m³/h) และแยกคำนวณช่วงเวลาจาก 3 Tags Totalizer',
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

        // Check if file is a 3-Tag Totalizer telemetry file
        const totalizerResult = parseTotalizerWorkbook(wb);
        if (totalizerResult.isTotalizerFile && totalizerResult.intervals.length > 0) {
          const msg = `นำเข้า Totalizer สำเร็จ: คำนวณช่วงเวลา ${totalizerResult.intervals.length} รายการ จาก ${totalizerResult.tagStats.dates.length} วัน`;
          if (onImportTotalizer) {
            onImportTotalizer(totalizerResult.intervals, totalizerResult.dailyAggregates, msg);
          }
          showToast(msg, 'success');
          return;
        }

        // Otherwise fallback to daily aggregate row parsing
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

        {/* Standard Import Template Download Button */}
        <button
          id="btn-topbar-template"
          type="button"
          onClick={() => {
            downloadStandardImportTemplate();
            showToast('ดาวน์โหลดไฟล์แม่แบบมาตรฐาน (WHA Water Import Template) สำเร็จ', 'success');
          }}
          className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-emerald-500/25 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:text-white transition-colors cursor-pointer shadow-sm"
          title="ดาวน์โหลดไฟล์แม่แบบ Excel มาตรฐานสำหรับการนำเข้าข้อมูล (Standard Template 3 Tags)"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline">ไฟล์แม่แบบ (Template)</span>
        </button>

        {/* Template & Format Guide Modal Trigger */}
        <button
          id="btn-topbar-format-guide"
          type="button"
          onClick={() => setIsTemplateModalOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer shadow-sm"
          title="ดูข้อกำหนดและโครงสร้างไฟล์แม่แบบสำหรับการนำเข้าข้อมูล"
        >
          <Info className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden lg:inline">รูปแบบข้อมูล</span>
        </button>

        <button
          id="btn-export-excel"
          type="button"
          onClick={handleExportExcel}
          className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white transition-colors cursor-pointer shadow-sm"
          title="ส่งออกข้อมูลเป็น Excel"
        >
          <Download className="w-3.5 h-3.5 text-slate-400" />
          <span className="hidden md:inline">ส่งออก</span>
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

      {/* Standard Import Template Specification Modal */}
      {isTemplateModalOpen && (
        <div
          id="modal-template-spec"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsTemplateModalOpen(false);
          }}
        >
          <div className="bg-[#161922] border border-white/10 rounded-2xl max-w-2xl w-full p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-start justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-base">
                    แบบฟอร์มไฟล์แม่แบบสำหรับการนำเข้าข้อมูล (Data Template)
                  </h3>
                  <p className="text-xs text-slate-400">
                    มาตรฐานรูปแบบไฟล์ที่กำหนดให้ผู้ใช้อัปโหลดเพื่อให้ข้อมูลสอดคล้องกับระบบ
                  </p>
                </div>
              </div>
              <button
                id="btn-close-template-modal"
                type="button"
                onClick={() => setIsTemplateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-3.5 flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div className="text-xs text-cyan-200 leading-relaxed">
                  <span className="font-semibold text-white">มาตรฐานหลัก (Standard 3 Tags):</span>{' '}
                  ระบบใช้ค่าสะสมของ 3 Tags Totalizer พร้อมคอลัมน์ Timestamp
                  เพื่อนำมาคำนวณอัตราการไหลรายชั่วโมง (Flow Rate m³/h) และสรุปยอดรายวันเข้าสู่ภาพรวม Dashboard โดยอัตโนมัติ
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-200 mb-2">
                  คอลัมน์มาตรฐานที่กำหนดในไฟล์แม่แบบ (Required Column Headers):
                </p>
                <div className="overflow-x-auto border border-white/10 rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#12141C] text-slate-400 font-semibold border-b border-white/10">
                      <tr>
                        <th className="px-3 py-2 text-slate-400">#</th>
                        <th className="px-3 py-2 text-slate-300">ชื่อคอลัมน์ในไฟล์แม่แบบ</th>
                        <th className="px-3 py-2 text-slate-300">กลุ่มมิเตอร์</th>
                        <th className="px-3 py-2 text-slate-300">คำอธิบาย</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-slate-300 font-mono-num">
                      <tr className="hover:bg-white/[0.02]">
                        <td className="px-3 py-2 text-slate-500">1</td>
                        <td className="px-3 py-2 text-white font-medium">Timestamp</td>
                        <td className="px-3 py-2 text-slate-400">เวลา</td>
                        <td className="px-3 py-2 text-slate-400 font-sans">
                          วันและเวลา (เช่น 2026-09-07 08:00:00)
                        </td>
                      </tr>
                      <tr className="hover:bg-white/[0.02]">
                        <td className="px-3 py-2 text-slate-500">2</td>
                        <td className="px-3 py-2 text-blue-400 font-medium">{TARGET_TAG_PWP}</td>
                        <td className="px-3 py-2 text-blue-300">PWP 1-6</td>
                        <td className="px-3 py-2 text-slate-400 font-sans">
                          ค่า Totalizer น้ำดีสะสม (m³)
                        </td>
                      </tr>
                      <tr className="hover:bg-white/[0.02]">
                        <td className="px-3 py-2 text-slate-500">3</td>
                        <td className="px-3 py-2 text-amber-400 font-medium">{TARGET_TAG_CWP1}</td>
                        <td className="px-3 py-2 text-amber-300">CWP 1-4</td>
                        <td className="px-3 py-2 text-slate-400 font-sans">
                          ค่า Totalizer น้ำหล่อเย็นสะสม (m³)
                        </td>
                      </tr>
                      <tr className="hover:bg-white/[0.02]">
                        <td className="px-3 py-2 text-slate-500">4</td>
                        <td className="px-3 py-2 text-purple-400 font-medium">{TARGET_TAG_CWP2}</td>
                        <td className="px-3 py-2 text-purple-300">CWP 5-7</td>
                        <td className="px-3 py-2 text-slate-400 font-sans">
                          ค่า Totalizer น้ำหล่อเย็นสะสม (m³)
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-[#12141C] p-3.5 rounded-xl border border-white/5 space-y-1.5 text-xs text-slate-400">
                <div className="font-semibold text-white">ข้อแนะนำในการเตรียมข้อมูล:</div>
                <p>1. สามารถดาวน์โหลดไฟล์แม่แบบด้านล่าง ซึ่งมีข้อมูลตัวอย่าง 24 ชม. และชีตข้อมูลสรุปรายวันจัดเตรียมไว้ให้ครบถ้วน</p>
                <p>2. กรุณาไม่แก้ไขหรือเปลี่ยนชื่อคอลัมน์ เพื่อให้ระบบสามารถจับคู่อัตโนมัติได้อย่างสมบูรณ์</p>
                <p>3. ข้อมูล Totalizer ต้องเป็นค่าสะสมที่เพิ่มขึ้นตามเวลาอย่างต่อเนื่อง</p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
              <button
                id="btn-modal-download-template"
                type="button"
                onClick={() => {
                  downloadStandardImportTemplate();
                  showToast('ดาวน์โหลดไฟล์แม่แบบมาตรฐานสำเร็จ', 'success');
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
              >
                <ArrowDownToLine className="w-4 h-4" />
                <span>ดาวน์โหลดไฟล์แม่แบบ (.xlsx)</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsTemplateModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                >
                  ปิดหน้าต่าง
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsTemplateModalOpen(false);
                    fileInputRef.current?.click();
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>เลือกไฟล์เพื่อนำเข้าทันที</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
