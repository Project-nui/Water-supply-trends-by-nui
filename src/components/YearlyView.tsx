import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Chart } from 'chart.js/auto';
import { WaterRecord } from '../types';
import {
  aggregateYearly,
  getMonthYoYData,
  fmt,
  fmtDecimal,
  fmtYearTH,
} from '../utils/formatters';
import {
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  Calendar,
  Layers,
  BarChart3,
  Download,
  CheckCircle2,
  Minus,
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface YearlyViewProps {
  data: WaterRecord[];
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

type MetricType = 'total' | 'pwp' | 'cwp1' | 'cwp2';

export const YearlyView: React.FC<YearlyViewProps> = ({ data, showToast }) => {
  const annualChartRef = useRef<HTMLCanvasElement | null>(null);
  const monthlyYoYChartRef = useRef<HTMLCanvasElement | null>(null);
  const annualChartInstance = useRef<Chart | null>(null);
  const monthlyYoYChartInstance = useRef<Chart | null>(null);

  // Aggregate yearly records
  const yearlyList = useMemo(() => aggregateYearly(data), [data]);
  const availableYears = useMemo(() => yearlyList.map((y) => y.year), [yearlyList]);

  // Year comparison selector states (default to latest 2 years if available)
  const defaultTarget = availableYears.length > 0 ? availableYears[availableYears.length - 1] : '';
  const defaultBase =
    availableYears.length > 1
      ? availableYears[availableYears.length - 2]
      : availableYears.length > 0
      ? availableYears[0]
      : '';

  const [baseYear, setBaseYear] = useState<string>(defaultBase);
  const [targetYear, setTargetYear] = useState<string>(defaultTarget);
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('total');

  // Update default states if years change
  useEffect(() => {
    if (availableYears.length > 0) {
      if (!availableYears.includes(targetYear)) {
        setTargetYear(availableYears[availableYears.length - 1]);
      }
      if (!availableYears.includes(baseYear)) {
        setBaseYear(
          availableYears.length > 1
            ? availableYears[availableYears.length - 2]
            : availableYears[0]
        );
      }
    }
  }, [availableYears, baseYear, targetYear]);

  // Month-by-month YoY comparison data
  const monthYoYData = useMemo(() => {
    if (!baseYear || !targetYear) return [];
    return getMonthYoYData(data, baseYear, targetYear, selectedMetric);
  }, [data, baseYear, targetYear, selectedMetric]);

  // Base and Target yearly records for summary KPI
  const baseRecord = useMemo(
    () => yearlyList.find((y) => y.year === baseYear),
    [yearlyList, baseYear]
  );
  const targetRecord = useMemo(
    () => yearlyList.find((y) => y.year === targetYear),
    [yearlyList, targetYear]
  );

  // Calculate comparison delta
  const comparisonSummary = useMemo(() => {
    if (!baseRecord || !targetRecord) {
      return { diff: 0, pct: 0, baseTotal: 0, targetTotal: 0 };
    }

    const baseVal =
      selectedMetric === 'pwp'
        ? baseRecord.pwp
        : selectedMetric === 'cwp1'
        ? baseRecord.cwp1
        : selectedMetric === 'cwp2'
        ? baseRecord.cwp2
        : baseRecord.total;

    const targetVal =
      selectedMetric === 'pwp'
        ? targetRecord.pwp
        : selectedMetric === 'cwp1'
        ? targetRecord.cwp1
        : selectedMetric === 'cwp2'
        ? targetRecord.cwp2
        : targetRecord.total;

    const diff = targetVal - baseVal;
    const pct = baseVal > 0 ? (diff / baseVal) * 100 : 0;

    return { diff, pct, baseTotal: baseVal, targetTotal: targetVal };
  }, [baseRecord, targetRecord, selectedMetric]);

  // Swap Base and Compare Year
  const handleSwapYears = () => {
    const temp = baseYear;
    setBaseYear(targetYear);
    setTargetYear(temp);
  };

  // Render Annual Totals Bar Chart
  useEffect(() => {
    if (!annualChartRef.current || yearlyList.length === 0) return;

    if (annualChartInstance.current) {
      annualChartInstance.current.destroy();
    }

    const ctx = annualChartRef.current.getContext('2d');
    if (!ctx) return;

    annualChartInstance.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: yearlyList.map((y) => `พ.ศ. ${y.yearTH} (${y.year})`),
        datasets: [
          {
            label: 'PWP 1-6',
            data: yearlyList.map((y) => y.pwp),
            backgroundColor: '#38BDF8',
            borderRadius: 4,
          },
          {
            label: 'CWP 1-4',
            data: yearlyList.map((y) => y.cwp1),
            backgroundColor: '#FBBF24',
            borderRadius: 4,
          },
          {
            label: 'CWP 5-7',
            data: yearlyList.map((y) => y.cwp2),
            backgroundColor: '#A855F7',
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
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
            callbacks: {
              label: (context) => {
                const val = (context.parsed.y || 0).toLocaleString();
                return ` ${context.dataset.label}: ${val} m³`;
              },
            },
          },
        },
        scales: {
          x: {
            ticks: {
              color: '#94A3B8',
              font: { size: 12 },
            },
            grid: { color: 'rgba(255, 255, 255, 0.03)' },
          },
          y: {
            ticks: {
              color: '#64748B',
              font: { size: 11 },
              callback: (value) => {
                const num = Number(value);
                return num >= 1000 ? `${(num / 1000).toFixed(0)}k` : `${num}`;
              },
            },
            grid: { color: 'rgba(255, 255, 255, 0.03)' },
          },
        },
      },
    });

    return () => {
      if (annualChartInstance.current) {
        annualChartInstance.current.destroy();
      }
    };
  }, [yearlyList]);

  // Render 12-Month YoY Comparison Chart
  useEffect(() => {
    if (!monthlyYoYChartRef.current || monthYoYData.length === 0) return;

    if (monthlyYoYChartInstance.current) {
      monthlyYoYChartInstance.current.destroy();
    }

    const ctx = monthlyYoYChartRef.current.getContext('2d');
    if (!ctx) return;

    const baseYearLabel = `ปีฐาน พ.ศ. ${fmtYearTH(baseYear)}`;
    const targetYearLabel = `ปีเปรียบเทียบ พ.ศ. ${fmtYearTH(targetYear)}`;

    monthlyYoYChartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: monthYoYData.map((m) => m.monthShort),
        datasets: [
          {
            label: baseYearLabel,
            data: monthYoYData.map((m) => m.baseValue),
            borderColor: '#94A3B8',
            backgroundColor: 'rgba(148, 163, 184, 0.1)',
            borderDash: [5, 5],
            borderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: '#94A3B8',
            tension: 0.25,
          },
          {
            label: targetYearLabel,
            data: monthYoYData.map((m) => m.targetValue),
            borderColor: '#38BDF8',
            backgroundColor: 'rgba(56, 189, 248, 0.12)',
            borderWidth: 2.5,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: '#38BDF8',
            fill: true,
            tension: 0.25,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
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
            callbacks: {
              afterBody: (tooltipItems) => {
                if (tooltipItems.length >= 2) {
                  const baseVal = tooltipItems[0].parsed.y || 0;
                  const targetVal = tooltipItems[1].parsed.y || 0;
                  const diff = targetVal - baseVal;
                  const pct = baseVal > 0 ? (diff / baseVal) * 100 : 0;
                  const sign = diff >= 0 ? '+' : '';
                  return `\nผลต่าง: ${sign}${diff.toLocaleString()} m³ (${sign}${pct.toFixed(1)}%)`;
                }
                return '';
              },
            },
          },
        },
        scales: {
          x: {
            ticks: {
              color: '#94A3B8',
              font: { size: 12 },
            },
            grid: { color: 'rgba(255, 255, 255, 0.03)' },
          },
          y: {
            ticks: {
              color: '#64748B',
              font: { size: 11 },
              callback: (value) => {
                const num = Number(value);
                return num >= 1000 ? `${(num / 1000).toFixed(0)}k` : `${num}`;
              },
            },
            grid: { color: 'rgba(255, 255, 255, 0.03)' },
          },
        },
      },
    });

    return () => {
      if (monthlyYoYChartInstance.current) {
        monthlyYoYChartInstance.current.destroy();
      }
    };
  }, [monthYoYData, baseYear, targetYear]);

  // Export YoY Comparison to Excel
  const handleExportYoYExcel = () => {
    try {
      const exportRows = monthYoYData.map((m) => {
        const metricName =
          selectedMetric === 'pwp'
            ? 'PWP 1-6'
            : selectedMetric === 'cwp1'
            ? 'CWP 1-4'
            : selectedMetric === 'cwp2'
            ? 'CWP 5-7'
            : 'ยอดรวมทั้งหมด';

        return {
          เดือน: m.monthLabel,
          [`ปีฐาน พ.ศ. ${fmtYearTH(baseYear)} (m³)`]: m.baseValue,
          [`ปีเปรียบเทียบ พ.ศ. ${fmtYearTH(targetYear)} (m³)`]: m.targetValue,
          'ผลต่าง (m³)': m.difference,
          'อัตราเปลี่ยนแปลง YoY (%)': m.percentChange !== null ? m.percentChange.toFixed(2) : '—',
          กลุ่มมิเตอร์: metricName,
        };
      });

      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'YoY_Comparison');
      XLSX.writeFile(
        wb,
        `water_consumption_yoy_${baseYear}_vs_${targetYear}_${new Date().toISOString().slice(0, 10)}.xlsx`
      );
      showToast('ส่งออกรายงานสรุปเทียบปีต่อปี (Excel) สำเร็จ', 'success');
    } catch (err) {
      console.error(err);
      showToast('เกิดข้อผิดพลาดในการส่งออกไฟล์ Excel', 'error');
    }
  };

  const metricLabels: Record<MetricType, string> = {
    total: 'ยอดรวมทั้งหมด (Total)',
    pwp: 'PWP 1-6',
    cwp1: 'CWP 1-4',
    cwp2: 'CWP 5-7',
  };

  return (
    <div id="view-yearly" className="p-6 md:p-8 space-y-6">
      {/* Top YoY Comparative KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Target Year Total */}
        <div className="bg-[#161922] p-5 rounded-2xl border border-white/5 shadow-xl relative">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
              ปีเปรียบเทียบ (พ.ศ. {fmtYearTH(targetYear)})
            </span>
            <span className="bg-blue-600/20 text-blue-400 text-[10px] px-2 py-0.5 rounded-full border border-blue-600/30 font-medium">
              TARGET
            </span>
          </div>
          <div className="text-3xl font-bold font-mono-num text-white">
            {fmt(comparisonSummary.targetTotal)}
            <span className="text-xs text-slate-500 ml-1.5 font-normal">m³</span>
          </div>
          <div className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>บันทึก {targetRecord?.days ?? 0} วัน (เฉลี่ย {fmt(targetRecord?.avgDaily)} m³/วัน)</span>
          </div>
        </div>

        {/* Card 2: Base Year Total */}
        <div className="bg-[#161922] p-5 rounded-2xl border border-white/5 shadow-xl relative">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
              ปีฐาน (พ.ศ. {fmtYearTH(baseYear)})
            </span>
            <span className="bg-white/10 text-slate-300 text-[10px] px-2 py-0.5 rounded-full border border-white/10 font-medium">
              BASE
            </span>
          </div>
          <div className="text-3xl font-bold font-mono-num text-slate-200">
            {fmt(comparisonSummary.baseTotal)}
            <span className="text-xs text-slate-500 ml-1.5 font-normal">m³</span>
          </div>
          <div className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>บันทึก {baseRecord?.days ?? 0} วัน (เฉลี่ย {fmt(baseRecord?.avgDaily)} m³/วัน)</span>
          </div>
        </div>

        {/* Card 3: Difference Net */}
        <div className="bg-[#161922] p-5 rounded-2xl border border-white/5 shadow-xl relative">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
              ผลต่างการใช้น้ำ (Net Diff)
            </span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                comparisonSummary.diff > 0
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  : comparisonSummary.diff < 0
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-white/5 text-slate-400 border-white/10'
              }`}
            >
              {comparisonSummary.diff > 0 ? 'เพิ่มขึ้น' : comparisonSummary.diff < 0 ? 'ประหยัดได้' : 'เท่าเดิม'}
            </span>
          </div>
          <div
            className={`text-3xl font-bold font-mono-num ${
              comparisonSummary.diff > 0
                ? 'text-rose-400'
                : comparisonSummary.diff < 0
                ? 'text-emerald-400'
                : 'text-white'
            }`}
          >
            {comparisonSummary.diff > 0 ? '+' : ''}
            {fmt(comparisonSummary.diff)}
            <span className="text-xs text-slate-500 ml-1.5 font-normal">m³</span>
          </div>
          <div className="text-xs text-slate-400 mt-2">
            เทียบ {metricLabels[selectedMetric]}
          </div>
        </div>

        {/* Card 4: YoY Growth Rate (%) */}
        <div className="bg-[#161922] p-5 rounded-2xl border border-white/5 shadow-xl relative">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
              อัตราเปลี่ยนแปลง YoY (%)
            </span>
            <span className="bg-purple-500/10 text-purple-400 text-[10px] px-2 py-0.5 rounded-full border border-purple-500/20 font-medium">
              GROWTH RATE
            </span>
          </div>
          <div
            className={`text-3xl font-bold font-mono-num flex items-center gap-1.5 ${
              comparisonSummary.pct > 0
                ? 'text-rose-400'
                : comparisonSummary.pct < 0
                ? 'text-emerald-400'
                : 'text-white'
            }`}
          >
            {comparisonSummary.pct > 0 ? (
              <TrendingUp className="w-6 h-6" />
            ) : comparisonSummary.pct < 0 ? (
              <TrendingDown className="w-6 h-6" />
            ) : (
              <Minus className="w-6 h-6" />
            )}
            <span>
              {comparisonSummary.pct > 0 ? '+' : ''}
              {fmtDecimal(comparisonSummary.pct, 1)}%
            </span>
          </div>
          <div className="text-xs text-slate-400 mt-2">
            อัตราการเติบโตเทียบปี {fmtYearTH(targetYear)} vs {fmtYearTH(baseYear)}
          </div>
        </div>
      </div>

      {/* Section 1: Annual Overview & Bar Chart */}
      <div id="annual-totals-panel" className="bg-[#161922] rounded-2xl border border-white/5 shadow-2xl overflow-hidden">
        <div className="p-5 md:p-6 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#1C202B]">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-white font-semibold text-base">
                ยอดการใช้น้ำรวมรายปี (Annual Totals)
              </h2>
              <p className="text-slate-400 text-xs mt-0.5">
                เปรียบเทียบปริมาณการใช้น้ำแต่ละกลุ่มมิเตอร์ตลอด {yearlyList.length} ปีที่ผ่านมา
              </p>
            </div>
            <span className="bg-blue-600/20 text-blue-400 text-[10px] px-2.5 py-1 rounded-full border border-blue-600/30 font-medium">
              ANNUAL
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
            <canvas ref={annualChartRef}></canvas>
          </div>
        </div>
      </div>

      {/* Section 2: Interactive YoY Comparison Dashboard */}
      <div id="interactive-yoy-panel" className="bg-[#161922] rounded-2xl border border-white/5 shadow-2xl overflow-hidden">
        {/* Header & Controls Bar */}
        <div className="p-5 md:p-6 border-b border-white/5 bg-[#1C202B] space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-white font-semibold text-base">
                  เครื่องมือวิเคราะห์เทียบปีต่อปี (Year-over-Year Deep Dive)
                </h2>
                <span className="bg-emerald-500/10 text-emerald-400 text-[10px] px-2.5 py-1 rounded-full border border-emerald-500/20 font-medium">
                  YoY COMPARISON
                </span>
              </div>
              <p className="text-slate-400 text-xs mt-0.5">
                เลือกปีฐาน ปีเปรียบเทียบ และประเภทมิเตอร์เพื่อวิเคราะห์ความผันผวนเดือนต่อเดือน
              </p>
            </div>

            <button
              id="btn-export-yoy-excel"
              type="button"
              onClick={handleExportYoYExcel}
              className="self-start lg:self-auto flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white transition-colors cursor-pointer shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>ส่งออกตาราง YoY (Excel)</span>
            </button>
          </div>

          {/* Interactive Selectors Bar */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {/* Base Year Selector */}
            <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">
              <span className="text-xs text-slate-400 font-medium">ปีฐาน:</span>
              <select
                id="select-base-year"
                value={baseYear}
                onChange={(e) => setBaseYear(e.target.value)}
                className="bg-transparent text-white font-medium text-xs outline-none cursor-pointer pr-2"
              >
                {availableYears.map((yr) => (
                  <option key={`base-${yr}`} value={yr} className="bg-[#1C202B] text-white">
                    พ.ศ. {fmtYearTH(yr)} ({yr})
                  </option>
                ))}
              </select>
            </div>

            {/* Swap Button */}
            <button
              id="btn-swap-years"
              type="button"
              onClick={handleSwapYears}
              title="สลับปีเปรียบเทียบ"
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
            </button>

            {/* Target Year Selector */}
            <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">
              <span className="text-xs text-slate-400 font-medium">ปีเปรียบเทียบ:</span>
              <select
                id="select-target-year"
                value={targetYear}
                onChange={(e) => setTargetYear(e.target.value)}
                className="bg-transparent text-blue-400 font-medium text-xs outline-none cursor-pointer pr-2"
              >
                {availableYears.map((yr) => (
                  <option key={`target-${yr}`} value={yr} className="bg-[#1C202B] text-white">
                    พ.ศ. {fmtYearTH(yr)} ({yr})
                  </option>
                ))}
              </select>
            </div>

            {/* Metric Segmented Toggle */}
            <div className="flex items-center bg-white/5 p-0.5 rounded-lg border border-white/10">
              {(['total', 'pwp', 'cwp1', 'cwp2'] as MetricType[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSelectedMetric(m)}
                  className={`px-3 py-1 rounded-md text-xs transition-all cursor-pointer ${
                    selectedMetric === m
                      ? 'bg-blue-600 text-white font-medium shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {m === 'total' ? 'รวมทั้งหมด' : m.toUpperCase().replace('PWP', 'PWP ').replace('CWP', 'CWP ')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 12-Month Comparison Line Curve */}
        <div className="p-5 md:p-6 border-b border-white/5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-white text-sm font-semibold">
                เส้นกราฟเปรียบเทียบ 12 เดือน: พ.ศ. {fmtYearTH(targetYear)} เทียบกับ พ.ศ. {fmtYearTH(baseYear)}
              </h3>
              <p className="text-slate-400 text-xs">
                แสดงพฤติกรรมการใช้น้ำ {metricLabels[selectedMetric]} ในแต่ละเดือน
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-slate-400 border-dashed"></span>
                <span className="text-slate-400">ปีฐาน ({fmtYearTH(baseYear)})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-sky-400"></span>
                <span className="text-sky-400 font-medium">ปีเปรียบเทียบ ({fmtYearTH(targetYear)})</span>
              </div>
            </div>
          </div>

          <div className="relative h-[290px] w-full">
            <canvas ref={monthlyYoYChartRef}></canvas>
          </div>
        </div>

        {/* 12-Month Detailed Comparison Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#161922] border-b border-white/5">
                <th className="text-left font-bold text-slate-400 text-[10px] uppercase tracking-wider px-5 py-3">
                  เดือน
                </th>
                <th className="text-right font-bold text-slate-400 text-[10px] uppercase tracking-wider px-4 py-3">
                  ปีฐาน พ.ศ. {fmtYearTH(baseYear)} (m³)
                </th>
                <th className="text-right font-bold text-sky-400 text-[10px] uppercase tracking-wider px-4 py-3">
                  ปีเปรียบเทียบ พ.ศ. {fmtYearTH(targetYear)} (m³)
                </th>
                <th className="text-right font-bold text-slate-300 text-[10px] uppercase tracking-wider px-4 py-3">
                  ผลต่าง (+/- m³)
                </th>
                <th className="text-right font-bold text-slate-300 text-[10px] uppercase tracking-wider px-5 py-3">
                  อัตราเปลี่ยนแปลง YoY (%)
                </th>
                <th className="text-center font-bold text-slate-400 text-[10px] uppercase tracking-wider px-4 py-3">
                  สถานะ
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {monthYoYData.map((m) => {
                const isPositive = m.difference > 0;
                const isNegative = m.difference < 0;
                const hasData = m.baseDays > 0 || m.targetDays > 0;

                return (
                  <tr key={m.monthKey} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3 text-slate-200 font-medium text-xs">
                      {m.monthLabel}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-num text-xs text-slate-400">
                      {hasData ? fmt(m.baseValue) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-num text-xs text-slate-200 font-semibold">
                      {hasData ? fmt(m.targetValue) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-num text-xs">
                      {hasData ? (
                        <span
                          className={
                            isPositive
                              ? 'text-rose-400 font-medium'
                              : isNegative
                              ? 'text-emerald-400 font-medium'
                              : 'text-slate-400'
                          }
                        >
                          {isPositive ? '+' : ''}
                          {fmt(m.difference)}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right font-mono-num text-xs">
                      {m.percentChange !== null ? (
                        <span
                          className={`inline-flex items-center gap-1 ${
                            isPositive
                              ? 'text-rose-400 font-semibold'
                              : isNegative
                              ? 'text-emerald-400 font-semibold'
                              : 'text-slate-400'
                          }`}
                        >
                          {isPositive ? '↑ +' : isNegative ? '↓ ' : ''}
                          {fmtDecimal(m.percentChange, 1)}%
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-xs">
                      {!hasData ? (
                        <span className="text-slate-600 text-[11px]">ไม่มีข้อมูล</span>
                      ) : isPositive ? (
                        <span className="bg-rose-500/10 text-rose-400 text-[10px] px-2 py-0.5 rounded-full border border-rose-500/20 font-medium">
                          เพิ่มขึ้น
                        </span>
                      ) : isNegative ? (
                        <span className="bg-emerald-500/10 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/20 font-medium">
                          ประหยัดลง
                        </span>
                      ) : (
                        <span className="bg-white/5 text-slate-400 text-[10px] px-2 py-0.5 rounded-full border border-white/10 font-medium">
                          เท่าเดิม
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="h-11 bg-[#1C202B] border-t border-white/5 flex items-center px-6 justify-between text-[11px] text-slate-400 font-medium">
          <span>เปรียบเทียบครบทั้ง 12 เดือนระหว่างปี พ.ศ. {fmtYearTH(baseYear)} และ พ.ศ. {fmtYearTH(targetYear)}</span>
          <span className="font-mono text-slate-400">YOY MONTHLY BREAKDOWN</span>
        </div>
      </div>

      {/* Section 3: Full Yearly Summary Table (ตารางสรุปรายปีทั้งหมด) */}
      <div id="yearly-summary-table-panel" className="bg-[#161922] rounded-2xl border border-white/5 shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-white/5 bg-[#1C202B] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-white font-semibold text-base">
              ตารางสรุปข้อมูลรายปีและอัตราการเติบโต YoY
            </h2>
            <p className="text-slate-400 text-xs mt-0.5">
              แสดงยอดรวมแต่ละมิเตอร์ จำนวนวัน และการเปลี่ยนแปลงเทียบกับปีก่อนหน้า
            </p>
          </div>
          <div className="bg-blue-600/20 text-blue-400 text-[10px] px-3 py-1 rounded-full border border-blue-600/30 font-mono-num font-medium">
            {yearlyList.length} ปีทั้งหมด
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#161922] border-b border-white/5">
                <th className="text-left font-bold text-slate-400 text-[10px] uppercase tracking-wider px-5 py-3">
                  ปี (พ.ศ. / ค.ศ.)
                </th>
                <th className="text-right font-bold text-slate-400 text-[10px] uppercase tracking-wider px-3 py-3">
                  จำนวนวัน
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
                <th className="text-right font-bold text-slate-200 text-[10px] uppercase tracking-wider px-4 py-3">
                  รวมทั้งหมด (m³)
                </th>
                <th className="text-right font-bold text-slate-400 text-[10px] uppercase tracking-wider px-4 py-3">
                  เฉลี่ย (m³/วัน)
                </th>
                <th className="text-right font-bold text-slate-300 text-[10px] uppercase tracking-wider px-5 py-3">
                  YoY รวม (%)
                </th>
                <th className="text-center font-bold text-slate-400 text-[10px] uppercase tracking-wider px-4 py-3">
                  ดำเนินการ
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {[...yearlyList].reverse().map((y) => {
                const hasDelta = y.deltaPercentTotal !== null;
                const isUp = hasDelta && y.deltaPercentTotal! > 0;
                const isDown = hasDelta && y.deltaPercentTotal! < 0;

                return (
                  <tr key={y.year} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3.5 text-slate-200 font-medium text-xs">
                      พ.ศ. {y.yearTH}{' '}
                      <span className="text-slate-500 font-mono text-[11px]">({y.year})</span>
                    </td>
                    <td className="px-3 py-3.5 text-right font-mono-num text-xs text-slate-400">
                      {y.days} วัน
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono-num text-xs text-slate-300">
                      {fmt(y.pwp)}
                      {y.deltaPercentPwp !== null && (
                        <span
                          className={`text-[10px] ml-1.5 block ${
                            y.deltaPercentPwp > 0 ? 'text-rose-400' : 'text-emerald-400'
                          }`}
                        >
                          {y.deltaPercentPwp > 0 ? '+' : ''}
                          {y.deltaPercentPwp.toFixed(1)}%
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono-num text-xs text-slate-300">
                      {fmt(y.cwp1)}
                      {y.deltaPercentCwp1 !== null && (
                        <span
                          className={`text-[10px] ml-1.5 block ${
                            y.deltaPercentCwp1 > 0 ? 'text-rose-400' : 'text-emerald-400'
                          }`}
                        >
                          {y.deltaPercentCwp1 > 0 ? '+' : ''}
                          {y.deltaPercentCwp1.toFixed(1)}%
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono-num text-xs text-slate-300">
                      {fmt(y.cwp2)}
                      {y.deltaPercentCwp2 !== null && (
                        <span
                          className={`text-[10px] ml-1.5 block ${
                            y.deltaPercentCwp2 > 0 ? 'text-rose-400' : 'text-emerald-400'
                          }`}
                        >
                          {y.deltaPercentCwp2 > 0 ? '+' : ''}
                          {y.deltaPercentCwp2.toFixed(1)}%
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono-num text-xs font-semibold text-white">
                      {fmt(y.total)}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono-num text-xs text-slate-400">
                      {fmt(y.avgDaily)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono-num text-xs">
                      {hasDelta ? (
                        <span
                          className={`inline-flex items-center gap-1 font-semibold ${
                            isUp ? 'text-rose-400' : isDown ? 'text-emerald-400' : 'text-slate-400'
                          }`}
                        >
                          {isUp ? '↑ +' : isDown ? '↓ ' : ''}
                          {y.deltaPercentTotal!.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => setTargetYear(y.year)}
                        className={`text-[11px] px-2.5 py-1 rounded-md transition-colors cursor-pointer border ${
                          targetYear === y.year
                            ? 'bg-blue-600/20 text-blue-400 border-blue-600/30 font-medium'
                            : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {targetYear === y.year ? 'กำลังเปรียบเทียบ' : 'เลือกเป็นปีเปรียบเทียบ'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="h-11 bg-[#1C202B] border-t border-white/5 flex items-center px-6 justify-between text-[11px] text-slate-400 font-medium">
          <span>รวมทั้งสิ้น {yearlyList.length} ปี</span>
          <span className="font-mono text-slate-400">ANNUAL HISTORICAL DATA</span>
        </div>
      </div>
    </div>
  );
};
