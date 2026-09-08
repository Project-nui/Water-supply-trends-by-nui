import React, { useState, useEffect, useRef, useMemo } from 'react';
import { WaterRecord } from '../types';
import { fmt, fmtDateTH } from '../utils/formatters';
import { Chart, registerables } from 'chart.js';
import { Clock } from 'lucide-react';

Chart.register(...registerables);

interface DailyViewProps {
  data: WaterRecord[];
  onSelectHourly?: (date: string) => void;
}

export const DailyView: React.FC<DailyViewProps> = ({ data, onSelectHourly }) => {
  const chartCanvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  // Initialize start & end with last 30 days
  const [startDate, setStartDate] = useState<string>(() => {
    if (data.length === 0) return '';
    const slice = data.slice(-30);
    return slice[0]?.date || '';
  });

  const [endDate, setEndDate] = useState<string>(() => {
    if (data.length === 0) return '';
    return data[data.length - 1]?.date || '';
  });

  // Filtered rows
  const filteredRows = useMemo(() => {
    return data.filter((d) => (!startDate || d.date >= startDate) && (!endDate || d.date <= endDate));
  }, [data, startDate, endDate]);

  const handleSelectLast30 = () => {
    if (data.length === 0) return;
    const slice = data.slice(-30);
    setStartDate(slice[0]?.date || '');
    setEndDate(data[data.length - 1]?.date || '');
  };

  const handleSelectAll = () => {
    if (data.length === 0) return;
    setStartDate(data[0]?.date || '');
    setEndDate(data[data.length - 1]?.date || '');
  };

  useEffect(() => {
    if (!chartCanvasRef.current || filteredRows.length === 0) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }

    const ctx = chartCanvasRef.current.getContext('2d');
    if (!ctx) return;

    chartInstanceRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: filteredRows.map((r) => fmtDateTH(r.date)),
        datasets: [
          {
            label: 'PWP 1-6',
            data: filteredRows.map((r) => r.pwp),
            borderColor: '#38BDF8',
            backgroundColor: 'rgba(56, 189, 248, 0.08)',
            borderWidth: 2,
            pointRadius: filteredRows.length > 90 ? 0 : 2,
            tension: 0.25,
            spanGaps: true,
          },
          {
            label: 'CWP 1-4',
            data: filteredRows.map((r) => r.cwp1),
            borderColor: '#FBBF24',
            backgroundColor: 'rgba(251, 191, 36, 0.08)',
            borderWidth: 2,
            pointRadius: filteredRows.length > 90 ? 0 : 2,
            tension: 0.25,
            spanGaps: true,
          },
          {
            label: 'CWP 5-7',
            data: filteredRows.map((r) => r.cwp2),
            borderColor: '#A855F7',
            backgroundColor: 'rgba(168, 85, 247, 0.08)',
            borderWidth: 2,
            pointRadius: filteredRows.length > 90 ? 0 : 2,
            tension: 0.25,
            spanGaps: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1C202B',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            titleColor: '#FFFFFF',
            bodyColor: '#CBD5E1',
            padding: 10,
            cornerRadius: 8,
          },
        },
        scales: {
          x: {
            ticks: {
              color: '#64748B',
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 10,
              font: { size: 11 },
            },
            grid: { color: 'rgba(255, 255, 255, 0.03)' },
          },
          y: {
            ticks: { color: '#64748B', font: { size: 11 } },
            grid: { color: 'rgba(255, 255, 255, 0.03)' },
          },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [filteredRows]);

  // Reverse rows for table display (newest first)
  const reversedRows = useMemo(() => {
    return [...filteredRows].reverse();
  }, [filteredRows]);

  return (
    <div id="view-daily" className="p-6 md:p-8 space-y-6">
      {/* Date Filter Panel with Chart */}
      <div id="daily-filter-panel" className="bg-[#161922] rounded-2xl border border-white/5 shadow-xl overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 md:p-6 border-b border-white/5 bg-[#1C202B]">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-white font-semibold text-base">
                กราฟแสดงปริมาณการใช้น้ำรายวัน
              </h2>
              <p className="text-slate-400 text-xs mt-0.5">
                เลือกช่วงวันที่ต้องการกรองและเปรียบเทียบ
              </p>
            </div>
            <span className="bg-blue-600/20 text-blue-400 text-[10px] px-2.5 py-1 rounded-full border border-blue-600/30 font-medium">
              DAILY
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-400">
            <label htmlFor="daily-start" className="shrink-0 text-slate-400">จาก</label>
            <input
              id="daily-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-white/5 border border-white/10 text-white px-3 py-1.5 rounded-lg font-mono-num text-xs outline-none focus:border-blue-500 transition-colors"
            />

            <label htmlFor="daily-end" className="shrink-0 text-slate-400">ถึง</label>
            <input
              id="daily-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-white/5 border border-white/10 text-white px-3 py-1.5 rounded-lg font-mono-num text-xs outline-none focus:border-blue-500 transition-colors"
            />

            <button
              id="btn-daily-last30"
              type="button"
              onClick={handleSelectLast30}
              className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white transition-colors cursor-pointer text-xs font-medium"
            >
              30 วันล่าสุด
            </button>

            <button
              id="btn-daily-all"
              type="button"
              onClick={handleSelectAll}
              className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white transition-colors cursor-pointer text-xs font-medium"
            >
              ทั้งหมด
            </button>
          </div>
        </div>

        <div className="p-5 md:p-6">
          <div className="relative h-[290px] w-full">
            <canvas ref={chartCanvasRef}></canvas>
          </div>
        </div>
      </div>

      {/* Daily Data Table Panel */}
      <div id="daily-table-panel" className="bg-[#161922] rounded-2xl border border-white/5 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-white/5 bg-[#1C202B]">
          <div>
            <h2 className="text-white font-semibold text-base">
              ตารางข้อมูลรายวัน
            </h2>
            <p className="text-slate-400 text-xs mt-0.5">
              แสดงรายการจากใหม่ไปเก่าพร้อมผลรวม
            </p>
          </div>
          <div id="daily-count-badge" className="bg-blue-600/20 text-blue-400 text-[10px] px-3 py-1 rounded-full border border-blue-600/30 font-mono-num font-medium">
            {filteredRows.length.toLocaleString()} วัน
          </div>
        </div>

        <div className="max-h-[480px] overflow-y-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#161922] sticky top-0 z-10 border-b border-white/5">
                <th className="text-left font-bold text-slate-400 text-[10px] uppercase tracking-wider px-4 py-3">วันที่</th>
                <th className="text-right font-bold text-sky-400 text-[10px] uppercase tracking-wider px-4 py-3">PWP 1-6 (m³)</th>
                <th className="text-right font-bold text-amber-400 text-[10px] uppercase tracking-wider px-4 py-3">CWP 1-4 (m³)</th>
                <th className="text-right font-bold text-purple-400 text-[10px] uppercase tracking-wider px-4 py-3">CWP 5-7 (m³)</th>
                <th className="text-right font-bold text-slate-300 text-[10px] uppercase tracking-wider px-4 py-3">รวมทั้งหมด (m³)</th>
                {onSelectHourly && (
                  <th className="text-center font-bold text-cyan-400 text-[10px] uppercase tracking-wider px-3 py-3">
                    การไหลรายชั่วโมง
                  </th>
                )}
              </tr>
            </thead>
            <tbody id="daily-table-body" className="divide-y divide-white/5">
              {reversedRows.map((r) => {
                const total = (r.pwp || 0) + (r.cwp1 || 0) + (r.cwp2 || 0);
                return (
                  <tr key={r.date} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-2.5 text-slate-200 font-mono-num text-xs">
                      {fmtDateTH(r.date)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono-num text-xs text-slate-300">
                      {fmt(r.pwp)}
                      {r.pwp === 0 && (
                        <span className="text-rose-400 text-[10px] ml-1.5 inline-block" title="ค่าเป็น 0">
                          ●
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono-num text-xs text-slate-300">
                      {fmt(r.cwp1)}
                      {r.cwp1 === 0 && (
                        <span className="text-rose-400 text-[10px] ml-1.5 inline-block" title="ค่าเป็น 0">
                          ●
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono-num text-xs text-slate-300">
                      {fmt(r.cwp2)}
                      {r.cwp2 === 0 && (
                        <span className="text-rose-400 text-[10px] ml-1.5 inline-block" title="ค่าเป็น 0">
                          ●
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono-num text-xs font-semibold text-white">
                      {fmt(total)}
                    </td>
                    {onSelectHourly && (
                      <td className="px-3 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => onSelectHourly(r.date)}
                          className="px-2 py-1 rounded text-[10px] font-medium bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/20 transition-colors cursor-pointer inline-flex items-center gap-1 shadow-sm"
                          title="ดูอัตราการไหลรายชั่วโมงของวันนี้"
                        >
                          <Clock className="w-3 h-3" />
                          <span>ดูช่วงเวลา</span>
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {reversedRows.length === 0 && (
                <tr>
                  <td colSpan={onSelectHourly ? 6 : 5} className="px-4 py-12 text-center text-slate-400 text-xs">
                    ไม่พบข้อมูลในช่วงวันที่ระบุ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="h-10 bg-[#1C202B] border-t border-white/5 flex items-center px-6 justify-between text-[11px] text-slate-400 font-medium">
          <span>แสดงข้อมูล {filteredRows.length.toLocaleString()} วัน</span>
          <span className="font-mono text-slate-400">TELEMETRY ARCHIVE</span>
        </div>
      </div>
    </div>
  );
};
