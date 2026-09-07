import React, { useEffect, useRef, useMemo, useState } from 'react';
import { WaterRecord } from '../types';
import { aggregateMonthly, fmt, fmtDecimal } from '../utils/formatters';
import {
  getMonthStats,
  compareTwoMonths,
  getPrevMonthKey,
  getSameMonthLastYearKey,
} from '../utils/monthCompare';
import { MonthComparePanel } from './MonthComparePanel';
import { Chart, registerables } from 'chart.js';
import {
  BarChart3,
  LineChart,
  Layers,
  ArrowRightLeft,
  CheckCircle2,
  Calendar,
  Filter,
} from 'lucide-react';

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

  // Available months options (newest first)
  const availableMonths = useMemo(() => {
    return [...monthlyList].reverse().map((m) => ({
      monthKey: m.month,
      label: m.label,
    }));
  }, [monthlyList]);

  // Selected Months for Comparison
  const [baseMonth, setBaseMonth] = useState<string>(() => {
    if (monthlyList.length >= 1) {
      return monthlyList[monthlyList.length - 1].month;
    }
    return '';
  });

  const [compareMonth, setCompareMonth] = useState<string>(() => {
    if (monthlyList.length >= 2) {
      return monthlyList[monthlyList.length - 2].month;
    }
    return '';
  });

  // Sync state if initial was empty but monthlyList becomes available
  useEffect(() => {
    if (monthlyList.length > 0) {
      if (!baseMonth || !monthlyList.some((m) => m.month === baseMonth)) {
        setBaseMonth(monthlyList[monthlyList.length - 1].month);
      }
      if (
        !compareMonth ||
        !monthlyList.some((m) => m.month === compareMonth) ||
        compareMonth === baseMonth
      ) {
        if (monthlyList.length >= 2) {
          setCompareMonth(monthlyList[monthlyList.length - 2].month);
        } else {
          setCompareMonth(monthlyList[0].month);
        }
      }
    }
  }, [monthlyList, baseMonth, compareMonth]);

  // Chart view mode: 'compare_bars' | 'daily_trend' | 'overview'
  const [chartMode, setChartMode] = useState<'compare_bars' | 'daily_trend' | 'overview'>('compare_bars');

  // Table comparison mode: 'prev' (MoM vs immediate previous) | 'base' (vs chosen Base Month)
  const [tableCompareMode, setTableCompareMode] = useState<'prev' | 'base'>('base');

  // Stats calculation
  const statsA = useMemo(() => {
    return getMonthStats(data, baseMonth);
  }, [data, baseMonth]);

  const statsB = useMemo(() => {
    return getMonthStats(data, compareMonth);
  }, [data, compareMonth]);

  const comparison = useMemo(() => {
    return compareTwoMonths(statsA, statsB);
  }, [statsA, statsB]);

  // Quick preset handlers
  const handleSwapMonths = () => {
    const temp = baseMonth;
    setBaseMonth(compareMonth);
    setCompareMonth(temp);
  };

  const handleSelectMoM = () => {
    if (!baseMonth) return;
    const prevKey = getPrevMonthKey(baseMonth);
    const found = monthlyList.find((m) => m.month === prevKey);
    if (found) {
      setCompareMonth(found.month);
    } else if (monthlyList.length >= 2) {
      const idx = monthlyList.findIndex((m) => m.month === baseMonth);
      if (idx > 0) {
        setCompareMonth(monthlyList[idx - 1].month);
      }
    }
  };

  const handleSelectYoY = () => {
    if (!baseMonth) return;
    const sameMonthPrevYear = getSameMonthLastYearKey(baseMonth);
    const found = monthlyList.find((m) => m.month === sameMonthPrevYear);
    if (found) {
      setCompareMonth(found.month);
    } else {
      // Find matching month number in any earlier year
      const targetMonthNum = baseMonth.slice(5, 7);
      const candidates = monthlyList.filter(
        (m) => m.month.slice(5, 7) === targetMonthNum && m.month !== baseMonth
      );
      if (candidates.length > 0) {
        setCompareMonth(candidates[candidates.length - 1].month);
      }
    }
  };

  // Render Chart depending on chartMode
  useEffect(() => {
    if (!chartCanvasRef.current || monthlyList.length === 0) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }

    const ctx = chartCanvasRef.current.getContext('2d');
    if (!ctx) return;

    if (chartMode === 'overview') {
      // 1. All Months Overview
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
    } else if (chartMode === 'compare_bars') {
      // 2. Side-by-side grouped bar chart comparing Base vs Compare
      chartInstanceRef.current = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['ยอดรวมทั้งหมด', 'PWP 1-6', 'CWP 1-4', 'CWP 5-7'],
          datasets: [
            {
              label: `${statsA.label || 'เดือนหลัก'} (Base)`,
              data: [statsA.total, statsA.pwp, statsA.cwp1, statsA.cwp2],
              backgroundColor: '#3B82F6',
              borderRadius: 6,
              barPercentage: 0.7,
              categoryPercentage: 0.7,
            },
            {
              label: `${statsB.label || 'เดือนเปรียบเทียบ'} (Compare)`,
              data: [statsB.total, statsB.pwp, statsB.cwp1, statsB.cwp2],
              backgroundColor: '#10B981',
              borderRadius: 6,
              barPercentage: 0.7,
              categoryPercentage: 0.7,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              display: true,
              position: 'top',
              labels: {
                color: '#94A3B8',
                font: { size: 12 },
                usePointStyle: true,
                pointStyle: 'circle',
              },
            },
            tooltip: {
              backgroundColor: '#1C202B',
              borderColor: 'rgba(255, 255, 255, 0.1)',
              borderWidth: 1,
              titleColor: '#FFFFFF',
              bodyColor: '#CBD5E1',
              padding: 12,
              cornerRadius: 8,
              callbacks: {
                afterBody: (tooltipItems) => {
                  if (tooltipItems.length >= 2) {
                    const valA = tooltipItems[0].raw as number;
                    const valB = tooltipItems[1].raw as number;
                    const diff = valB - valA;
                    const pct = valA > 0 ? ((diff / valA) * 100).toFixed(1) : '—';
                    return `\nผลต่าง (Diff): ${diff > 0 ? '+' : ''}${diff.toLocaleString()} m³ (${pct}%)`;
                  }
                  return '';
                },
              },
            },
          },
          scales: {
            x: {
              ticks: { color: '#94A3B8', font: { size: 12, weight: 'bold' } },
              grid: { color: 'rgba(255, 255, 255, 0.04)' },
            },
            y: {
              ticks: {
                color: '#64748B',
                font: { size: 11 },
                callback: (val) => `${Number(val).toLocaleString()} m³`,
              },
              grid: { color: 'rgba(255, 255, 255, 0.04)' },
            },
          },
        },
      });
    } else if (chartMode === 'daily_trend') {
      // 3. Daily overlay comparison (Day 1 to 31)
      const dayNumbers = Array.from({ length: 31 }, (_, i) => i + 1);
      const dataA = dayNumbers.map((d) => statsA.dailyMap.get(d)?.total ?? null);
      const dataB = dayNumbers.map((d) => statsB.dailyMap.get(d)?.total ?? null);

      chartInstanceRef.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels: dayNumbers.map((d) => `วันที่ ${d}`),
          datasets: [
            {
              label: `${statsA.label || 'เดือนหลัก'} (${statsA.days} วัน)`,
              data: dataA,
              borderColor: '#3B82F6',
              backgroundColor: 'rgba(59, 130, 246, 0.08)',
              borderWidth: 2.5,
              pointBackgroundColor: '#3B82F6',
              pointRadius: 2.5,
              pointHoverRadius: 6,
              tension: 0.25,
              spanGaps: false,
              fill: true,
            },
            {
              label: `${statsB.label || 'เดือนเปรียบเทียบ'} (${statsB.days} วัน)`,
              data: dataB,
              borderColor: '#10B981',
              backgroundColor: 'rgba(16, 185, 129, 0.08)',
              borderWidth: 2.5,
              pointBackgroundColor: '#10B981',
              pointRadius: 2.5,
              pointHoverRadius: 6,
              tension: 0.25,
              spanGaps: false,
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              display: true,
              position: 'top',
              labels: {
                color: '#94A3B8',
                font: { size: 12 },
                usePointStyle: true,
                pointStyle: 'circle',
              },
            },
            tooltip: {
              backgroundColor: '#1C202B',
              borderColor: 'rgba(255, 255, 255, 0.1)',
              borderWidth: 1,
              titleColor: '#FFFFFF',
              bodyColor: '#CBD5E1',
              padding: 12,
              cornerRadius: 8,
              callbacks: {
                afterBody: (items) => {
                  const itemA = items.find((i) => i.datasetIndex === 0);
                  const itemB = items.find((i) => i.datasetIndex === 1);
                  if (itemA && itemB && itemA.raw !== null && itemB.raw !== null) {
                    const diff = (itemB.raw as number) - (itemA.raw as number);
                    const pct =
                      (itemA.raw as number) > 0
                        ? ((diff / (itemA.raw as number)) * 100).toFixed(1)
                        : '—';
                    return `\nผลต่าง (Diff): ${diff > 0 ? '+' : ''}${diff.toLocaleString()} m³ (${pct}%)`;
                  }
                  return '';
                },
              },
            },
          },
          scales: {
            x: {
              ticks: { color: '#64748B', font: { size: 10 }, maxRotation: 45 },
              grid: { color: 'rgba(255, 255, 255, 0.03)' },
            },
            y: {
              ticks: {
                color: '#64748B',
                font: { size: 11 },
                callback: (val) => `${Number(val).toLocaleString()} m³`,
              },
              grid: { color: 'rgba(255, 255, 255, 0.03)' },
            },
          },
        },
      });
    }

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [monthlyList, chartMode, statsA, statsB]);

  // Reverse for table (most recent month first)
  const reversedMonthly = useMemo(() => {
    return [...monthlyList].reverse();
  }, [monthlyList]);

  return (
    <div id="view-monthly" className="p-6 md:p-8 space-y-6">
      {/* 1. Custom Month-to-Month Comparison Interactive Panel */}
      <MonthComparePanel
        availableMonths={availableMonths}
        baseMonth={baseMonth}
        compareMonth={compareMonth}
        onSelectBase={setBaseMonth}
        onSelectCompare={setCompareMonth}
        onSwap={handleSwapMonths}
        onSelectMoM={handleSelectMoM}
        onSelectYoY={handleSelectYoY}
        comparison={comparison}
      />

      {/* 2. Monthly Chart Panel with Comparative Views */}
      <div
        id="monthly-chart-panel"
        className="bg-[#161922] rounded-2xl border border-white/5 shadow-2xl overflow-hidden"
      >
        <div className="p-5 md:p-6 border-b border-white/5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#1C202B]">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-white font-semibold text-base flex items-center gap-2">
                <span>กราฟแสดงการใช้น้ำ</span>
                <span className="text-xs font-normal text-slate-400">
                  {chartMode === 'compare_bars'
                    ? `(เปรียบเทียบ ${statsA.label} vs ${statsB.label})`
                    : chartMode === 'daily_trend'
                    ? `(แนวโน้มรายวัน ${statsA.label} vs ${statsB.label})`
                    : '(ภาพรวมทุกเดือนที่บันทึก)'}
                </span>
              </h2>
              <p className="text-slate-400 text-xs mt-0.5">
                เลือกโหมดมุมมองเพื่อวิเคราะห์ยอดรวมรายมิเตอร์ หรือเปรียบเทียบเจาะลึก 2 เดือน
              </p>
            </div>
          </div>

          {/* Chart View Mode Segmented Controls */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#12141C] border border-white/10 rounded-xl">
            <button
              id="chart-mode-compare"
              type="button"
              onClick={() => setChartMode('compare_bars')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                chartMode === 'compare_bars'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>เปรียบเทียบ 2 เดือนที่เลือก</span>
            </button>

            <button
              id="chart-mode-daily-trend"
              type="button"
              onClick={() => setChartMode('daily_trend')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                chartMode === 'daily_trend'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <LineChart className="w-3.5 h-3.5" />
              <span>แนวโน้มรายวัน (Day 1-31)</span>
            </button>

            <button
              id="chart-mode-overview"
              type="button"
              onClick={() => setChartMode('overview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                chartMode === 'overview'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>ภาพรวมทุกเดือน</span>
            </button>
          </div>
        </div>

        {/* Chart Canvas Area (CSS selector 1 target) */}
        <div className="p-5 md:p-6">
          <div className="relative h-[340px] w-full">
            <canvas ref={chartCanvasRef}></canvas>
          </div>

          {/* Helper Legend / Explanation Bar below canvas */}
          {chartMode === 'compare_bars' && (
            <div className="mt-4 pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-blue-600"></span>
                  <span className="text-white font-medium">{statsA.label}</span>
                  <span>(เดือนหลัก: {fmt(statsA.total)} m³)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-emerald-500"></span>
                  <span className="text-white font-medium">{statsB.label}</span>
                  <span>(เดือนเปรียบเทียบ: {fmt(statsB.total)} m³)</span>
                </span>
              </div>
              <div className="text-[11px] text-slate-500">
                Tip: ชี้เมาส์เหนือแท่งกราฟเพื่อดูผลต่างสุทธิและสัดส่วน %
              </div>
            </div>
          )}

          {chartMode === 'daily_trend' && (
            <div className="mt-4 pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                  <span className="text-white font-medium">{statsA.label}</span>
                  <span>(เฉลี่ย {fmtDecimal(statsA.avgDaily, 1)} m³/วัน)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                  <span className="text-white font-medium">{statsB.label}</span>
                  <span>(เฉลี่ย {fmtDecimal(statsB.avgDaily, 1)} m³/วัน)</span>
                </span>
              </div>
              <div className="text-[11px] text-slate-500">
                Tip: เปรียบเทียบความต้องการใช้น้ำในแต่ละช่วงวันของเดือน
              </div>
            </div>
          )}

          {chartMode === 'overview' && (
            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                  <span>PWP 1-6</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span>CWP 1-4</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                  <span>CWP 5-7</span>
                </div>
              </div>
              <div className="text-[11px] text-slate-500">
                รวมทั้งหมด {monthlyList.length} เดือน
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Monthly Summary Table Panel (CSS selector 2 target) */}
      <div
        id="monthly-table-panel"
        className="bg-[#161922] rounded-2xl border border-white/5 shadow-2xl overflow-hidden"
      >
        {/* Table Header Controls (CSS selector 2 target) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 border-b border-white/5 bg-[#1C202B] gap-4">
          <div className="space-y-1">
            <h2 className="text-white font-semibold text-base flex items-center gap-2">
              <span>ตารางสรุปรายเดือน</span>
              <span className="text-xs font-normal text-slate-400">
                {tableCompareMode === 'base'
                  ? `(คำนวณเปรียบเทียบกับเดือนหลัก: ${statsA.label})`
                  : '(คำนวณเปรียบเทียบกับเดือนก่อนหน้า MoM)'}
              </span>
            </h2>
            <p className="text-slate-400 text-xs">
              สามารถคลิกปุ่มในแถวเพื่อเลือกเป็นเดือนหลักหรือเดือนเปรียบเทียบได้ทันที
            </p>
          </div>

          {/* Table Comparison Mode Switch */}
          <div className="flex items-center gap-2">
            <div className="flex items-center p-1 bg-[#12141C] border border-white/10 rounded-xl text-xs">
              <button
                id="btn-table-compare-base"
                type="button"
                onClick={() => setTableCompareMode('base')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  tableCompareMode === 'base'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title={`เทียบยอดกับ ${statsA.label}`}
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>เทียบกับ {statsA.label || 'เดือนหลัก'}</span>
              </button>

              <button
                id="btn-table-compare-prev"
                type="button"
                onClick={() => setTableCompareMode('prev')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  tableCompareMode === 'prev'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="เทียบกับเดือนก่อนหน้าในประวัติ"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>เทียบเดือนก่อน (MoM)</span>
              </button>
            </div>

            <div className="bg-blue-600/20 text-blue-400 text-[10px] px-3 py-1.5 rounded-full border border-blue-600/30 font-mono-num font-medium whitespace-nowrap">
              {reversedMonthly.length} เดือน
            </div>
          </div>
        </div>

        {/* Table Body */}
        <div className="max-h-[500px] overflow-y-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#161922] sticky top-0 z-10 border-b border-white/5">
                <th className="text-left font-bold text-slate-400 text-[10px] uppercase tracking-wider px-4 py-3">
                  เดือน
                </th>
                <th className="text-right font-bold text-sky-400 text-[10px] uppercase tracking-wider px-4 py-3">
                  PWP 1-6 (m³)
                </th>
                <th className="text-right font-bold text-amber-400 text-[10px] uppercase tracking-wider px-4 py-3">
                  CWP 1-4 (m³)
                </th>
                <th className="text-right font-bold text-purple-400 text-[10px] uppercase tracking-wider px-4 py-3">
                  CWP 5-7 (m³)
                </th>
                <th className="text-right font-bold text-slate-300 text-[10px] uppercase tracking-wider px-4 py-3">
                  รวมทั้งหมด (m³)
                </th>
                <th className="text-right font-bold text-slate-400 text-[10px] uppercase tracking-wider px-4 py-3">
                  {tableCompareMode === 'base' ? `เทียบกับ ${statsA.label}` : 'เทียบเดือนก่อนหน้า'}
                </th>
                <th className="text-center font-bold text-slate-500 text-[10px] uppercase tracking-wider px-4 py-3">
                  เลือกเปรียบเทียบ
                </th>
              </tr>
            </thead>
            <tbody id="monthly-table-body" className="divide-y divide-white/5">
              {reversedMonthly.map((m) => {
                const isBase = m.month === baseMonth;
                const isCompare = m.month === compareMonth;

                // Difference calculation based on mode
                let diffVal: number = 0;
                let diffPct: number | null = null;
                let hasDelta = false;

                if (tableCompareMode === 'base') {
                  if (statsA.total > 0 && m.month !== baseMonth) {
                    diffVal = m.total - statsA.total;
                    diffPct = (diffVal / statsA.total) * 100;
                    hasDelta = true;
                  }
                } else {
                  if (m.deltaPercent !== null) {
                    hasDelta = true;
                    diffPct = m.deltaPercent;
                    // approximate diffVal from deltaPercent
                    const prevTotal = m.total / (1 + m.deltaPercent / 100);
                    diffVal = m.total - prevTotal;
                  }
                }

                const isUp = diffPct !== null && diffPct >= 0;

                return (
                  <tr
                    key={m.month}
                    className={`transition-colors ${
                      isBase
                        ? 'bg-blue-600/10 border-l-2 border-l-blue-500'
                        : isCompare
                        ? 'bg-emerald-500/10 border-l-2 border-l-emerald-500'
                        : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    <td className="px-4 py-3 text-slate-200 font-mono-num text-xs font-medium">
                      <div className="flex items-center gap-2">
                        <span>{m.label}</span>
                        <span className="text-slate-500 font-normal">({m.days} วัน)</span>
                        {isBase && (
                          <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[9px] px-1.5 py-0.5 rounded font-bold">
                            เดือนหลัก (1)
                          </span>
                        )}
                        {isCompare && (
                          <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] px-1.5 py-0.5 rounded font-bold">
                            เดือนเทียบ (2)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono-num text-xs text-slate-300">
                      {fmt(m.pwp)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-num text-xs text-slate-300">
                      {fmt(m.cwp1)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-num text-xs text-slate-300">
                      {fmt(m.cwp2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-num text-xs font-semibold text-white">
                      {fmt(m.total)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-num text-xs">
                      {isBase && tableCompareMode === 'base' ? (
                        <span className="text-blue-400 text-[11px] font-semibold bg-blue-500/10 px-2 py-0.5 rounded">
                          เกณฑ์อ้างอิง (Base)
                        </span>
                      ) : hasDelta && diffPct !== null ? (
                        <div className="inline-flex flex-col items-end">
                          <span
                            className={`inline-flex items-center gap-1 font-semibold ${
                              isUp ? 'text-rose-400' : 'text-emerald-400'
                            }`}
                          >
                            <span>{isUp ? '↑ +' : '↓ '}</span>
                            <span>{Math.abs(diffPct).toFixed(1)}%</span>
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {diffVal > 0 ? '+' : ''}
                            {fmt(diffVal)} m³
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setBaseMonth(m.month)}
                          disabled={isBase}
                          className={`px-2 py-1 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                            isBase
                              ? 'bg-blue-600 text-white opacity-80 cursor-default'
                              : 'bg-white/5 hover:bg-blue-600/20 text-slate-400 hover:text-blue-400 border border-white/10 hover:border-blue-500/30'
                          }`}
                          title="ตั้งเป็นเดือนหลัก (1)"
                        >
                          {isBase ? 'หลัก ✓' : 'เป็นหลัก'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCompareMonth(m.month)}
                          disabled={isCompare}
                          className={`px-2 py-1 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                            isCompare
                              ? 'bg-emerald-500 text-white opacity-80 cursor-default'
                              : 'bg-white/5 hover:bg-emerald-600/20 text-slate-400 hover:text-emerald-400 border border-white/10 hover:border-emerald-500/30'
                          }`}
                          title="ตั้งเป็นเดือนเปรียบเทียบ (2)"
                        >
                          {isCompare ? 'เทียบ ✓' : 'เป็นเทียบ'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {reversedMonthly.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400 text-xs">
                    ไม่มีข้อมูลสรุปรายเดือน
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="h-10 bg-[#1C202B] border-t border-white/5 flex items-center px-6 justify-between text-[11px] text-slate-400 font-medium">
          <div className="flex items-center gap-3">
            <span>รวมทั้งหมด {reversedMonthly.length} เดือน</span>
            <span className="text-slate-600">|</span>
            <span className="text-blue-400">เดือนหลัก: {statsA.label}</span>
            <span className="text-slate-600">vs</span>
            <span className="text-emerald-400">เดือนเทียบ: {statsB.label}</span>
          </div>
          <span className="font-mono text-slate-400">MONTHLY AGGREGATES</span>
        </div>
      </div>
    </div>
  );
};
