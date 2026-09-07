import React, { useEffect, useRef, useMemo } from 'react';
import { WaterRecord } from '../types';
import { aggregateMonthly, fmt } from '../utils/formatters';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

interface MonthlyViewProps {
  data: WaterRecord[];
}

export const MonthlyView: React.FC<MonthlyViewProps> = ({ data }) => {
  const chartCanvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  const monthlyList = useMemo(() => {
    return aggregateMonthly(data);
  }, [data]);

  useEffect(() => {
    if (!chartCanvasRef.current || monthlyList.length === 0) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }

    const ctx = chartCanvasRef.current.getContext('2d');
    if (!ctx) return;

    chartInstanceRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: monthlyList.map((m) => m.label),
        datasets: [
          {
            label: 'PWP 1-6',
            data: monthlyList.map((m) => m.pwp),
            backgroundColor: '#38BDF8',
            borderRadius: 4,
          },
          {
            label: 'CWP 1-4',
            data: monthlyList.map((m) => m.cwp1),
            backgroundColor: '#FBBF24',
            borderRadius: 4,
          },
          {
            label: 'CWP 5-7',
            data: monthlyList.map((m) => m.cwp2),
            backgroundColor: '#A855F7',
            borderRadius: 4,
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
            stacked: false,
            ticks: {
              color: '#64748B',
              maxRotation: 45,
              autoSkip: true,
              maxTicksLimit: 16,
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
  }, [monthlyList]);

  // Reverse for table (most recent month first)
  const reversedMonthly = useMemo(() => {
    return [...monthlyList].reverse();
  }, [monthlyList]);

  return (
    <div id="view-monthly" className="p-6 md:p-8 space-y-6">
      {/* Monthly Chart Panel */}
      <div id="monthly-chart-panel" className="bg-[#161922] rounded-2xl border border-white/5 shadow-2xl overflow-hidden">
        <div className="p-5 md:p-6 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#1C202B]">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-white font-semibold text-base">
                ยอดรวมการใช้น้ำรายเดือน
              </h2>
              <p className="text-slate-400 text-xs mt-0.5">
                เปรียบเทียบสัดส่วนระหว่าง PWP 1-6, CWP 1-4 และ CWP 5-7
              </p>
            </div>
            <span className="bg-blue-600/20 text-blue-400 text-[10px] px-2.5 py-1 rounded-full border border-blue-600/30 font-medium">
              MONTHLY
            </span>
          </div>

          <div className="flex items-center gap-2.5 text-xs text-slate-300">
            <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-md border border-white/10">
              <span className="w-2 h-2 rounded-full bg-sky-400"></span>
              <span className="font-medium text-[11px]">PWP 1-6</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-md border border-white/10">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span className="font-medium text-[11px]">CWP 1-4</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-md border border-white/10">
              <span className="w-2 h-2 rounded-full bg-purple-400"></span>
              <span className="font-medium text-[11px]">CWP 5-7</span>
            </div>
          </div>
        </div>

        <div className="p-5 md:p-6">
          <div className="relative h-[300px] w-full">
            <canvas ref={chartCanvasRef}></canvas>
          </div>
        </div>
      </div>

      {/* Monthly Summary Table Panel */}
      <div id="monthly-table-panel" className="bg-[#161922] rounded-2xl border border-white/5 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-white/5 bg-[#1C202B]">
          <div>
            <h2 className="text-white font-semibold text-base">
              ตารางสรุปรายเดือน
            </h2>
            <p className="text-slate-400 text-xs mt-0.5">
              อัตราการเปลี่ยนแปลงเมื่อเทียบกับเดือนก่อนหน้า
            </p>
          </div>
          <div className="bg-blue-600/20 text-blue-400 text-[10px] px-3 py-1 rounded-full border border-blue-600/30 font-mono-num font-medium">
            {reversedMonthly.length} เดือน
          </div>
        </div>

        <div className="max-h-[480px] overflow-y-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#161922] sticky top-0 z-10 border-b border-white/5">
                <th className="text-left font-bold text-slate-400 text-[10px] uppercase tracking-wider px-4 py-3">เดือน</th>
                <th className="text-right font-bold text-sky-400 text-[10px] uppercase tracking-wider px-4 py-3">PWP 1-6 (m³)</th>
                <th className="text-right font-bold text-amber-400 text-[10px] uppercase tracking-wider px-4 py-3">CWP 1-4 (m³)</th>
                <th className="text-right font-bold text-purple-400 text-[10px] uppercase tracking-wider px-4 py-3">CWP 5-7 (m³)</th>
                <th className="text-right font-bold text-slate-300 text-[10px] uppercase tracking-wider px-4 py-3">รวมทั้งหมด (m³)</th>
                <th className="text-right font-bold text-slate-400 text-[10px] uppercase tracking-wider px-4 py-3">เทียบเดือนก่อน</th>
              </tr>
            </thead>
            <tbody id="monthly-table-body" className="divide-y divide-white/5">
              {reversedMonthly.map((m) => {
                const hasDelta = m.deltaPercent !== null;
                const isUp = hasDelta && m.deltaPercent! >= 0;

                return (
                  <tr key={m.month} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-2.5 text-slate-200 font-mono-num text-xs font-medium">
                      {m.label} <span className="text-slate-500 font-normal">({m.days} วัน)</span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono-num text-xs text-slate-300">
                      {fmt(m.pwp)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono-num text-xs text-slate-300">
                      {fmt(m.cwp1)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono-num text-xs text-slate-300">
                      {fmt(m.cwp2)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono-num text-xs font-semibold text-white">
                      {fmt(m.total)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono-num text-xs">
                      {hasDelta ? (
                        <span className={`inline-flex items-center gap-1 ${isUp ? 'text-rose-400' : 'text-emerald-400'}`}>
                          <span>{isUp ? '↑ +' : '↓ '}{m.deltaPercent!.toFixed(1)}%</span>
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {reversedMonthly.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400 text-xs">
                    ไม่มีข้อมูลสรุปรายเดือน
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="h-10 bg-[#1C202B] border-t border-white/5 flex items-center px-6 justify-between text-[11px] text-slate-400 font-medium">
          <span>รวมทั้งหมด {reversedMonthly.length} เดือน</span>
          <span className="font-mono text-slate-400">MONTHLY AGGREGATES</span>
        </div>
      </div>
    </div>
  );
};
