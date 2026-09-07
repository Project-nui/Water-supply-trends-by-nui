import React, { useEffect, useRef } from 'react';
import { WaterRecord } from '../types';
import { fmt, fmtDateTH } from '../utils/formatters';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

interface DashboardViewProps {
  data: WaterRecord[];
}

export const DashboardView: React.FC<DashboardViewProps> = ({ data }) => {
  const chartCanvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  const last = data.length > 0 ? data[data.length - 1] : null;
  const prev = data.length > 1 ? data[data.length - 2] : null;

  const renderKpiDelta = (key: 'pwp' | 'cwp1' | 'cwp2') => {
    if (!last || !prev) return <span className="text-[#7FA3A8]">ไม่มีข้อมูลเปรียบเทียบ</span>;
    const currentVal = last[key];
    const prevVal = prev[key];

    if (currentVal === null || prevVal === null || prevVal === 0) {
      return <span className="text-slate-500 text-xs">ไม่มีข้อมูลเปรียบเทียบ</span>;
    }

    const pct = ((currentVal - prevVal) / prevVal) * 100;
    const up = pct >= 0;

    return (
      <span className={`inline-flex items-center gap-1 ${up ? 'text-rose-400' : 'text-emerald-400'}`}>
        <span>{up ? '↑ +' : '↓ '}{pct.toFixed(1)}%</span>
        <span className="text-slate-500 font-normal">จากวันก่อนหน้า</span>
      </span>
    );
  };

  const last30 = data.slice(-30);
  const trendRangeNote =
    last30.length > 0 ? `${fmtDateTH(last30[0].date)} — ${fmtDateTH(last30[last30.length - 1].date)}` : '—';

  // Quality statistics
  const zeroPwpCount = data.filter((d) => d.pwp === 0).length;
  const zeroCwp1Count = data.filter((d) => d.cwp1 === 0).length;
  const zeroCwp2Count = data.filter((d) => d.cwp2 === 0).length;

  useEffect(() => {
    if (!chartCanvasRef.current || last30.length === 0) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }

    const ctx = chartCanvasRef.current.getContext('2d');
    if (!ctx) return;

    chartInstanceRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: last30.map((r) => fmtDateTH(r.date)),
        datasets: [
          {
            label: 'PWP 1-6',
            data: last30.map((r) => r.pwp),
            borderColor: '#38BDF8',
            backgroundColor: 'rgba(56, 189, 248, 0.08)',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.3,
            spanGaps: true,
          },
          {
            label: 'CWP 1-4',
            data: last30.map((r) => r.cwp1),
            borderColor: '#FBBF24',
            backgroundColor: 'rgba(251, 191, 36, 0.08)',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.3,
            spanGaps: true,
          },
          {
            label: 'CWP 5-7',
            data: last30.map((r) => r.cwp2),
            borderColor: '#A855F7',
            backgroundColor: 'rgba(168, 85, 247, 0.08)',
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.3,
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
              maxTicksLimit: 8,
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
  }, [data]);

  return (
    <div id="view-dashboard" className="p-6 md:p-8 space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* PWP KPI */}
        <div id="kpi-card-pwp" className="bg-[#161922] p-5 md:p-6 rounded-2xl border border-white/5 shadow-xl relative overflow-hidden group hover:border-white/10 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 font-semibold tracking-wider uppercase">PWP 1-6 · ล่าสุด</span>
            <span className="bg-sky-500/10 text-sky-400 text-[10px] px-2.5 py-0.5 rounded-full border border-sky-500/20 font-medium">
              MAIN FEED
            </span>
          </div>
          <div className="text-3xl font-bold font-mono-num text-white mb-2">
            {fmt(last?.pwp)}
            <span className="text-xs text-slate-500 ml-1.5 font-normal">m³</span>
          </div>
          <div className="text-xs font-mono-num">
            {renderKpiDelta('pwp')}
          </div>
        </div>

        {/* CWP 1-4 KPI */}
        <div id="kpi-card-cwp1" className="bg-[#161922] p-5 md:p-6 rounded-2xl border border-white/5 shadow-xl relative overflow-hidden group hover:border-white/10 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 font-semibold tracking-wider uppercase">CWP 1-4 · ล่าสุด</span>
            <span className="bg-amber-500/10 text-amber-400 text-[10px] px-2.5 py-0.5 rounded-full border border-amber-500/20 font-medium">
              CIRCUIT A
            </span>
          </div>
          <div className="text-3xl font-bold font-mono-num text-white mb-2">
            {fmt(last?.cwp1)}
            <span className="text-xs text-slate-500 ml-1.5 font-normal">m³</span>
          </div>
          <div className="text-xs font-mono-num">
            {renderKpiDelta('cwp1')}
          </div>
        </div>

        {/* CWP 5-7 KPI */}
        <div id="kpi-card-cwp2" className="bg-[#161922] p-5 md:p-6 rounded-2xl border border-white/5 shadow-xl relative overflow-hidden group hover:border-white/10 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 font-semibold tracking-wider uppercase">CWP 5-7 · ล่าสุด</span>
            <span className="bg-purple-500/10 text-purple-400 text-[10px] px-2.5 py-0.5 rounded-full border border-purple-500/20 font-medium">
              CIRCUIT B
            </span>
          </div>
          <div className="text-3xl font-bold font-mono-num text-white mb-2">
            {fmt(last?.cwp2)}
            <span className="text-xs text-slate-500 ml-1.5 font-normal">m³</span>
          </div>
          <div className="text-xs font-mono-num">
            {renderKpiDelta('cwp2')}
          </div>
        </div>
      </div>

      {/* 30-Day Trend Chart Panel */}
      <div id="dashboard-trend-panel" className="bg-[#161922] rounded-2xl border border-white/5 shadow-2xl overflow-hidden">
        <div className="p-5 md:p-6 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#1C202B]">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-white font-semibold text-base leading-snug">
                แนวโน้ม 30 วันล่าสุด
              </h2>
              <p className="text-slate-400 text-xs mt-0.5">
                {trendRangeNote}
              </p>
            </div>
            <span className="bg-blue-600/20 text-blue-400 text-[10px] px-2.5 py-1 rounded-full border border-blue-600/30 font-medium">
              LIVE DATA
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

      {/* Data Quality Panel */}
      <div id="dashboard-data-quality-panel" className="bg-[#161922] rounded-2xl border border-white/5 shadow-xl p-5 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-5 border-b border-white/5">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">
              SYSTEM HEALTH & AUDIT
            </p>
            <h2 className="text-white font-semibold text-base">
              คุณภาพและความสมบูรณ์ของข้อมูล
            </h2>
            <p className="text-slate-400 text-xs mt-0.5">
              การตรวจสอบความผิดปกติและมิเตอร์หยุดเดิน (ค่า 0)
            </p>
          </div>
          <span className="self-start sm:self-auto bg-emerald-500/10 text-emerald-400 text-[10px] px-3 py-1 rounded-full border border-emerald-500/20 font-medium">
            AUDIT VERIFIED
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-white/[0.02] p-4 rounded-xl border border-white/5">
            <div className="text-2xl font-bold font-mono-num text-white">
              {data.length.toLocaleString()}
            </div>
            <div className="text-xs text-slate-400 mt-1">วันที่มีข้อมูลทั้งหมด</div>
          </div>

          <div className="bg-white/[0.02] p-4 rounded-xl border border-white/5">
            <div className="text-2xl font-bold font-mono-num text-rose-400">
              {zeroPwpCount}
            </div>
            <div className="text-xs text-slate-400 mt-1">วันที่ PWP 1-6 เป็น 0</div>
          </div>

          <div className="bg-white/[0.02] p-4 rounded-xl border border-white/5">
            <div className="text-2xl font-bold font-mono-num text-rose-400">
              {zeroCwp1Count}
            </div>
            <div className="text-xs text-slate-400 mt-1">วันที่ CWP 1-4 เป็น 0</div>
          </div>

          <div className="bg-white/[0.02] p-4 rounded-xl border border-white/5">
            <div className="text-2xl font-bold font-mono-num text-rose-400">
              {zeroCwp2Count}
            </div>
            <div className="text-xs text-slate-400 mt-1">วันที่ CWP 5-7 เป็น 0</div>
          </div>

          <div className="bg-white/[0.02] p-4 rounded-xl border border-white/5">
            <div className="text-xl font-bold font-mono-num text-sky-400">
              {last ? fmtDateTH(last.date) : '—'}
            </div>
            <div className="text-xs text-slate-400 mt-1">ข้อมูลล่าสุดถึงวันที่</div>
          </div>
        </div>
      </div>
    </div>
  );
};
