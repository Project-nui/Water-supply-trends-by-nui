import React from 'react';
import { TwoMonthsComparison } from '../utils/monthCompare';
import { fmt, fmtDecimal } from '../utils/formatters';
import {
  ArrowRightLeft,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  Download,
  CalendarDays,
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface MonthComparePanelProps {
  availableMonths: { monthKey: string; label: string }[];
  baseMonth: string;
  compareMonth: string;
  onSelectBase: (m: string) => void;
  onSelectCompare: (m: string) => void;
  onSwap: () => void;
  onSelectMoM: () => void;
  onSelectYoY: () => void;
  comparison: TwoMonthsComparison;
}

export const MonthComparePanel: React.FC<MonthComparePanelProps> = ({
  availableMonths,
  baseMonth,
  compareMonth,
  onSelectBase,
  onSelectCompare,
  onSwap,
  onSelectMoM,
  onSelectYoY,
  comparison,
}) => {
  const { monthA, monthB, total, pwp, cwp1, cwp2, avgDaily } = comparison;

  const handleExportExcel = () => {
    const rows = [
      {
        'รายการ': 'ยอดใช้น้ำรวมทั้งหมด (Total m³)',
        [`เดือนหลัก (${monthA.label})`]: monthA.total,
        [`เดือนเปรียบเทียบ (${monthB.label})`]: monthB.total,
        'ผลต่างสุทธิ (m³)': total.difference,
        'อัตราการเปลี่ยนแปลง (%)': total.percentChange !== null ? `${total.percentChange.toFixed(2)}%` : '—',
        'สถานะ': total.difference > 0 ? 'เพิ่มขึ้น' : total.difference < 0 ? 'ลดลง (ประหยัด)' : 'เท่าเดิม',
      },
      {
        'รายการ': 'PWP 1-6 (m³)',
        [`เดือนหลัก (${monthA.label})`]: monthA.pwp,
        [`เดือนเปรียบเทียบ (${monthB.label})`]: monthB.pwp,
        'ผลต่างสุทธิ (m³)': pwp.difference,
        'อัตราการเปลี่ยนแปลง (%)': pwp.percentChange !== null ? `${pwp.percentChange.toFixed(2)}%` : '—',
        'สถานะ': pwp.difference > 0 ? 'เพิ่มขึ้น' : pwp.difference < 0 ? 'ลดลง (ประหยัด)' : 'เท่าเดิม',
      },
      {
        'รายการ': 'CWP 1-4 (m³)',
        [`เดือนหลัก (${monthA.label})`]: monthA.cwp1,
        [`เดือนเปรียบเทียบ (${monthB.label})`]: monthB.cwp1,
        'ผลต่างสุทธิ (m³)': cwp1.difference,
        'อัตราการเปลี่ยนแปลง (%)': cwp1.percentChange !== null ? `${cwp1.percentChange.toFixed(2)}%` : '—',
        'สถานะ': cwp1.difference > 0 ? 'เพิ่มขึ้น' : cwp1.difference < 0 ? 'ลดลง (ประหยัด)' : 'เท่าเดิม',
      },
      {
        'รายการ': 'CWP 5-7 (m³)',
        [`เดือนหลัก (${monthA.label})`]: monthA.cwp2,
        [`เดือนเปรียบเทียบ (${monthB.label})`]: monthB.cwp2,
        'ผลต่างสุทธิ (m³)': cwp2.difference,
        'อัตราการเปลี่ยนแปลง (%)': cwp2.percentChange !== null ? `${cwp2.percentChange.toFixed(2)}%` : '—',
        'สถานะ': cwp2.difference > 0 ? 'เพิ่มขึ้น' : cwp2.difference < 0 ? 'ลดลง (ประหยัด)' : 'เท่าเดิม',
      },
      {
        'รายการ': 'เฉลี่ยต่อวัน (m³/วัน)',
        [`เดือนหลัก (${monthA.label})`]: Number(monthA.avgDaily.toFixed(2)),
        [`เดือนเปรียบเทียบ (${monthB.label})`]: Number(monthB.avgDaily.toFixed(2)),
        'ผลต่างสุทธิ (m³)': Number(avgDaily.difference.toFixed(2)),
        'อัตราการเปลี่ยนแปลง (%)': avgDaily.percentChange !== null ? `${avgDaily.percentChange.toFixed(2)}%` : '—',
        'สถานะ': avgDaily.difference > 0 ? 'เพิ่มขึ้น' : avgDaily.difference < 0 ? 'ลดลง (ประหยัด)' : 'เท่าเดิม',
      },
      {
        'รายการ': 'จำนวนวันที่มีบันทึก (วัน)',
        [`เดือนหลัก (${monthA.label})`]: monthA.days,
        [`เดือนเปรียบเทียบ (${monthB.label})`]: monthB.days,
        'ผลต่างสุทธิ (m³)': monthB.days - monthA.days,
        'อัตราการเปลี่ยนแปลง (%)': '—',
        'สถานะ': '—',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Month_Comparison');
    XLSX.writeFile(wb, `WHA_Month_Comparison_${monthA.monthKey}_vs_${monthB.monthKey}.xlsx`);
  };

  const renderBadge = (diff: number, pct: number | null) => {
    if (diff === 0) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
          <Minus className="w-3 h-3" />
          <span>เท่าเดิม</span>
        </span>
      );
    }
    const isUp = diff > 0;
    return (
      <span
        className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${
          isUp
            ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
            : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
        }`}
      >
        {isUp ? (
          <>
            <TrendingUp className="w-3 h-3 shrink-0" />
            <span>+{pct !== null ? pct.toFixed(1) : ''}%</span>
          </>
        ) : (
          <>
            <TrendingDown className="w-3 h-3 shrink-0" />
            <span>{pct !== null ? pct.toFixed(1) : ''}%</span>
          </>
        )}
      </span>
    );
  };

  return (
    <div
      id="custom-month-comparison-section"
      className="bg-[#161922] rounded-2xl border border-white/5 shadow-2xl overflow-hidden space-y-0"
    >
      {/* Header & Month Selectors */}
      <div className="p-5 md:p-6 bg-[#1C202B] border-b border-white/5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-600/15 border border-blue-500/30 text-blue-400">
                <ArrowRightLeft className="w-4 h-4" />
              </span>
              <h2 className="text-white font-semibold text-base">
                เปรียบเทียบข้อมูลการใช้น้ำระหว่างเดือน (Custom Month Comparison)
              </h2>
              <span className="bg-emerald-500/15 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/20 font-medium">
                INTERACTIVE
              </span>
            </div>
            <p className="text-slate-400 text-xs pl-8">
              เลือกเดือนหลักและเดือนที่ต้องการนำมาเปรียบเทียบได้อิสระ เพื่อดูผลต่าง ปริมาณ และอัตราการเติบโต
            </p>
          </div>

          {/* Quick Presets & Export */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              id="btn-preset-mom"
              type="button"
              onClick={onSelectMoM}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 hover:border-white/20 transition-colors cursor-pointer"
              title="เปรียบเทียบกับเดือนก่อนหน้าอัตโนมัติ"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>เทียบเดือนก่อนหน้า (MoM)</span>
            </button>
            <button
              id="btn-preset-yoy"
              type="button"
              onClick={onSelectYoY}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 hover:border-white/20 transition-colors cursor-pointer"
              title="เปรียบเทียบกับเดือนเดียวกันของปีก่อนหน้า"
            >
              <Calendar className="w-3.5 h-3.5 text-purple-400" />
              <span>เทียบเดือนเดิมปีก่อน (YoY)</span>
            </button>
            <button
              id="btn-export-comparison-xlsx"
              type="button"
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-400 border border-emerald-500/30 transition-colors cursor-pointer ml-auto sm:ml-0"
              title="ส่งออกรายงานเปรียบเทียบเป็น Excel"
            >
              <Download className="w-3.5 h-3.5" />
              <span>ส่งออก Excel</span>
            </button>
          </div>
        </div>

        {/* Selection Bar */}
        <div className="mt-5 p-4 bg-[#12141C] border border-white/5 rounded-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Month A (Base) */}
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <span>1. เดือนหลัก (Base Month)</span>
              </span>
              <span className="text-slate-500 font-mono text-[11px]">
                {monthA.days} วันบันทึก
              </span>
            </div>
            <div className="relative">
              <select
                id="select-base-month"
                value={baseMonth}
                onChange={(e) => onSelectBase(e.target.value)}
                className="w-full bg-[#1A1D27] border border-white/10 text-white text-xs sm:text-sm font-medium rounded-lg px-3.5 py-2.5 outline-none focus:border-blue-500 cursor-pointer appearance-none pr-8"
              >
                {availableMonths.map((m) => (
                  <option key={m.monthKey} value={m.monthKey}>
                    {m.label} ({m.monthKey})
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                <CalendarDays className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Swap Button */}
          <div className="flex items-center justify-center pt-2 md:pt-4">
            <button
              id="btn-swap-months"
              type="button"
              onClick={onSwap}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all cursor-pointer shadow-sm active:scale-95"
              title="สลับเดือนหลักกับเดือนเปรียบเทียบ"
            >
              <ArrowRightLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Month B (Compare) */}
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>2. เดือนเปรียบเทียบ (Compare Month)</span>
              </span>
              <span className="text-slate-500 font-mono text-[11px]">
                {monthB.days} วันบันทึก
              </span>
            </div>
            <div className="relative">
              <select
                id="select-compare-month"
                value={compareMonth}
                onChange={(e) => onSelectCompare(e.target.value)}
                className="w-full bg-[#1A1D27] border border-white/10 text-white text-xs sm:text-sm font-medium rounded-lg px-3.5 py-2.5 outline-none focus:border-emerald-500 cursor-pointer appearance-none pr-8"
              >
                {availableMonths.map((m) => (
                  <option key={m.monthKey} value={m.monthKey}>
                    {m.label} ({m.monthKey})
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                <CalendarDays className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Comparison Metrics Grid */}
      <div className="p-5 md:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Metric 1: Total */}
        <div
          id="compare-card-total"
          className="p-4 bg-[#1C202B] rounded-xl border border-white/5 space-y-3 relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">ยอดใช้น้ำรวม</span>
            {renderBadge(total.difference, total.percentChange)}
          </div>

          <div>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-slate-400 text-xs">{monthB.label}:</span>
              <span className="font-bold text-white text-base font-mono-num">
                {fmt(monthB.total)} <span className="text-[11px] font-normal text-slate-400">m³</span>
              </span>
            </div>
            <div className="flex items-baseline justify-between text-xs text-slate-400 mt-1">
              <span>{monthA.label}:</span>
              <span className="font-mono-num text-slate-300">
                {fmt(monthA.total)} m³
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
            <span className="text-slate-500">ผลต่าง:</span>
            <span
              className={`font-semibold font-mono-num ${
                total.difference > 0
                  ? 'text-rose-400'
                  : total.difference < 0
                  ? 'text-emerald-400'
                  : 'text-slate-400'
              }`}
            >
              {total.difference > 0 ? '+' : ''}
              {fmt(total.difference)} m³
            </span>
          </div>
        </div>

        {/* Metric 2: PWP 1-6 */}
        <div
          id="compare-card-pwp"
          className="p-4 bg-[#1C202B] rounded-xl border border-white/5 space-y-3 relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-sky-400 font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-400"></span>
              <span>PWP 1-6</span>
            </span>
            {renderBadge(pwp.difference, pwp.percentChange)}
          </div>

          <div>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-slate-400 text-xs">{monthB.label}:</span>
              <span className="font-bold text-white text-base font-mono-num">
                {fmt(monthB.pwp)} <span className="text-[11px] font-normal text-slate-400">m³</span>
              </span>
            </div>
            <div className="flex items-baseline justify-between text-xs text-slate-400 mt-1">
              <span>{monthA.label}:</span>
              <span className="font-mono-num text-slate-300">
                {fmt(monthA.pwp)} m³
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
            <span className="text-slate-500">ผลต่าง:</span>
            <span
              className={`font-semibold font-mono-num ${
                pwp.difference > 0
                  ? 'text-rose-400'
                  : pwp.difference < 0
                  ? 'text-emerald-400'
                  : 'text-slate-400'
              }`}
            >
              {pwp.difference > 0 ? '+' : ''}
              {fmt(pwp.difference)} m³
            </span>
          </div>
        </div>

        {/* Metric 3: CWP 1-4 */}
        <div
          id="compare-card-cwp1"
          className="p-4 bg-[#1C202B] rounded-xl border border-white/5 space-y-3 relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-amber-400 font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span>CWP 1-4</span>
            </span>
            {renderBadge(cwp1.difference, cwp1.percentChange)}
          </div>

          <div>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-slate-400 text-xs">{monthB.label}:</span>
              <span className="font-bold text-white text-base font-mono-num">
                {fmt(monthB.cwp1)} <span className="text-[11px] font-normal text-slate-400">m³</span>
              </span>
            </div>
            <div className="flex items-baseline justify-between text-xs text-slate-400 mt-1">
              <span>{monthA.label}:</span>
              <span className="font-mono-num text-slate-300">
                {fmt(monthA.cwp1)} m³
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
            <span className="text-slate-500">ผลต่าง:</span>
            <span
              className={`font-semibold font-mono-num ${
                cwp1.difference > 0
                  ? 'text-rose-400'
                  : cwp1.difference < 0
                  ? 'text-emerald-400'
                  : 'text-slate-400'
              }`}
            >
              {cwp1.difference > 0 ? '+' : ''}
              {fmt(cwp1.difference)} m³
            </span>
          </div>
        </div>

        {/* Metric 4: CWP 5-7 */}
        <div
          id="compare-card-cwp2"
          className="p-4 bg-[#1C202B] rounded-xl border border-white/5 space-y-3 relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-purple-400 font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-400"></span>
              <span>CWP 5-7</span>
            </span>
            {renderBadge(cwp2.difference, cwp2.percentChange)}
          </div>

          <div>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-slate-400 text-xs">{monthB.label}:</span>
              <span className="font-bold text-white text-base font-mono-num">
                {fmt(monthB.cwp2)} <span className="text-[11px] font-normal text-slate-400">m³</span>
              </span>
            </div>
            <div className="flex items-baseline justify-between text-xs text-slate-400 mt-1">
              <span>{monthA.label}:</span>
              <span className="font-mono-num text-slate-300">
                {fmt(monthA.cwp2)} m³
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
            <span className="text-slate-500">ผลต่าง:</span>
            <span
              className={`font-semibold font-mono-num ${
                cwp2.difference > 0
                  ? 'text-rose-400'
                  : cwp2.difference < 0
                  ? 'text-emerald-400'
                  : 'text-slate-400'
              }`}
            >
              {cwp2.difference > 0 ? '+' : ''}
              {fmt(cwp2.difference)} m³
            </span>
          </div>
        </div>

        {/* Metric 5: Daily Average */}
        <div
          id="compare-card-avg-daily"
          className="p-4 bg-[#1C202B] rounded-xl border border-white/5 space-y-3 relative overflow-hidden sm:col-span-2 lg:col-span-1"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-300 font-medium">เฉลี่ยต่อวัน</span>
            {renderBadge(avgDaily.difference, avgDaily.percentChange)}
          </div>

          <div>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-slate-400 text-xs">{monthB.label}:</span>
              <span className="font-bold text-white text-base font-mono-num">
                {fmtDecimal(monthB.avgDaily, 1)}{' '}
                <span className="text-[11px] font-normal text-slate-400">m³/วัน</span>
              </span>
            </div>
            <div className="flex items-baseline justify-between text-xs text-slate-400 mt-1">
              <span>{monthA.label}:</span>
              <span className="font-mono-num text-slate-300">
                {fmtDecimal(monthA.avgDaily, 1)} m³/วัน
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
            <span className="text-slate-500">ผลต่างเฉลี่ย:</span>
            <span
              className={`font-semibold font-mono-num ${
                avgDaily.difference > 0
                  ? 'text-rose-400'
                  : avgDaily.difference < 0
                  ? 'text-emerald-400'
                  : 'text-slate-400'
              }`}
            >
              {avgDaily.difference > 0 ? '+' : ''}
              {fmtDecimal(avgDaily.difference, 1)} m³/วัน
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
