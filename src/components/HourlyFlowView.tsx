import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  HourlyIntervalRecord,
  WaterRecord,
  TARGET_TAG_PWP,
  TARGET_TAG_CWP1,
  TARGET_TAG_CWP2,
} from '../types';
import { fmt, fmtDecimal, fmtDateTH } from '../utils/formatters';
import {
  downloadTotalizerTemplate,
  parseTotalizerWorkbook,
  ParseTotalizerResult,
} from '../utils/totalizerParser';
import { Chart, registerables } from 'chart.js';
import * as XLSX from 'xlsx';
import {
  Clock,
  Download,
  Upload,
  Calendar,
  Layers,
  ArrowUpRight,
  TrendingUp,
  Activity,
  CheckCircle2,
  FileSpreadsheet,
  HelpCircle,
  BarChart3,
  LineChart,
} from 'lucide-react';

Chart.register(...registerables);

interface HourlyFlowViewProps {
  intervals: HourlyIntervalRecord[];
  initialSelectedDate?: string;
  onImportTotalizer: (
    intervals: HourlyIntervalRecord[],
    dailyRecords: WaterRecord[],
    summaryMsg: string
  ) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const HourlyFlowView: React.FC<HourlyFlowViewProps> = ({
  intervals,
  initialSelectedDate,
  onImportTotalizer,
  showToast,
}) => {
  const chartCanvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Available unique dates in interval records
  const availableDates = useMemo(() => {
    const set = new Set(intervals.map((i) => i.date));
    return Array.from(set).sort().reverse();
  }, [intervals]);

  // Selected Date Filter (default to initialSelectedDate or most recent date)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (initialSelectedDate && availableDates.includes(initialSelectedDate)) {
      return initialSelectedDate;
    }
    return availableDates[0] || '';
  });

  useEffect(() => {
    if (initialSelectedDate && availableDates.includes(initialSelectedDate)) {
      setSelectedDate(initialSelectedDate);
    }
  }, [initialSelectedDate, availableDates]);

  useEffect(() => {
    if (availableDates.length > 0 && (!selectedDate || !availableDates.includes(selectedDate))) {
      setSelectedDate(availableDates[0]);
    }
  }, [availableDates, selectedDate]);

  // Chart Mode: 'flow_rate' (m³/h) | 'totalizer_curve' (cumulative m³)
  const [chartMetric, setChartMetric] = useState<'flow_rate' | 'totalizer_curve'>('flow_rate');

  // Filter intervals for the selected date (or all)
  const currentIntervals = useMemo(() => {
    if (!selectedDate) return intervals;
    return intervals.filter((i) => i.date === selectedDate);
  }, [intervals, selectedDate]);

  // Calculate day metrics
  const dayMetrics = useMemo(() => {
    if (currentIntervals.length === 0) {
      return {
        totalUsage: 0,
        avgFlowRate: 0,
        peakFlowRate: 0,
        peakInterval: '—',
        pwpTotal: 0,
        cwp1Total: 0,
        cwp2Total: 0,
        pwpStart: 0,
        pwpEnd: 0,
        cwp1Start: 0,
        cwp1End: 0,
        cwp2Start: 0,
        cwp2End: 0,
        intervalCount: 0,
      };
    }

    let totalUsage = 0;
    let pwpTotal = 0;
    let cwp1Total = 0;
    let cwp2Total = 0;
    let peakFlowRate = 0;
    let peakInterval = '—';

    currentIntervals.forEach((item) => {
      totalUsage += item.totalUsage;
      pwpTotal += item.pwpUsage;
      cwp1Total += item.cwp1Usage;
      cwp2Total += item.cwp2Usage;

      if (item.totalFlowRate > peakFlowRate) {
        peakFlowRate = item.totalFlowRate;
        peakInterval = item.intervalLabel;
      }
    });

    const first = currentIntervals[0];
    const last = currentIntervals[currentIntervals.length - 1];

    const totalHours = currentIntervals.reduce((sum, i) => sum + (i.durationHours || 1), 0);
    const avgFlowRate = totalHours > 0 ? totalUsage / totalHours : 0;

    return {
      totalUsage,
      avgFlowRate,
      peakFlowRate,
      peakInterval,
      pwpTotal,
      cwp1Total,
      cwp2Total,
      pwpStart: first.pwpStartTotalizer ?? 0,
      pwpEnd: last.pwpEndTotalizer ?? 0,
      cwp1Start: first.cwp1StartTotalizer ?? 0,
      cwp1End: last.cwp1EndTotalizer ?? 0,
      cwp2Start: first.cwp2StartTotalizer ?? 0,
      cwp2End: last.cwp2EndTotalizer ?? 0,
      intervalCount: currentIntervals.length,
    };
  }, [currentIntervals]);

  // Render Hourly Chart
  useEffect(() => {
    if (!chartCanvasRef.current || currentIntervals.length === 0) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }

    const ctx = chartCanvasRef.current.getContext('2d');
    if (!ctx) return;

    const labels = currentIntervals.map((i) => i.intervalLabel);

    if (chartMetric === 'flow_rate') {
      // Flow Rate per Hour (m³/h) Bar Chart
      chartInstanceRef.current = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'PWP FT01 (m³/h)',
              data: currentIntervals.map((i) => i.pwpFlowRate),
              backgroundColor: '#38BDF8',
              borderRadius: 3,
              stack: 'flow',
            },
            {
              label: 'CWP FT01 (m³/h)',
              data: currentIntervals.map((i) => i.cwp1FlowRate),
              backgroundColor: '#FBBF24',
              borderRadius: 3,
              stack: 'flow',
            },
            {
              label: 'CWP FT03 (m³/h)',
              data: currentIntervals.map((i) => i.cwp2FlowRate),
              backgroundColor: '#A855F7',
              borderRadius: 3,
              stack: 'flow',
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
              labels: { color: '#94A3B8', font: { size: 11 }, usePointStyle: true },
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
                footer: (items) => {
                  let total = 0;
                  items.forEach((it) => {
                    total += (it.raw as number) || 0;
                  });
                  return `\nอัตราการไหลรวม: ${total.toLocaleString(undefined, {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })} m³/h`;
                },
              },
            },
          },
          scales: {
            x: {
              stacked: true,
              ticks: { color: '#64748B', font: { size: 10 }, maxRotation: 45 },
              grid: { color: 'rgba(255, 255, 255, 0.03)' },
            },
            y: {
              stacked: true,
              ticks: {
                color: '#64748B',
                font: { size: 10 },
                callback: (val) => `${Number(val).toLocaleString()} m³/h`,
              },
              grid: { color: 'rgba(255, 255, 255, 0.04)' },
            },
          },
        },
      });
    } else {
      // Totalizer Cumulative Curve (m³) Line Chart
      chartInstanceRef.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels: currentIntervals.map((i) => i.endTime),
          datasets: [
            {
              label: 'PWP FT01 Totalizer',
              data: currentIntervals.map((i) => i.pwpEndTotalizer),
              borderColor: '#38BDF8',
              backgroundColor: 'rgba(56, 189, 248, 0.05)',
              borderWidth: 2,
              pointRadius: 2,
              tension: 0.2,
            },
            {
              label: 'CWP FT01 Totalizer',
              data: currentIntervals.map((i) => i.cwp1EndTotalizer),
              borderColor: '#FBBF24',
              backgroundColor: 'rgba(251, 191, 36, 0.05)',
              borderWidth: 2,
              pointRadius: 2,
              tension: 0.2,
            },
            {
              label: 'CWP FT03 Totalizer',
              data: currentIntervals.map((i) => i.cwp2EndTotalizer),
              borderColor: '#A855F7',
              backgroundColor: 'rgba(168, 85, 247, 0.05)',
              borderWidth: 2,
              pointRadius: 2,
              tension: 0.2,
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
              labels: { color: '#94A3B8', font: { size: 11 }, usePointStyle: true },
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
                label: (it) => {
                  return `${it.dataset.label}: ${Number(it.raw).toLocaleString()} m³`;
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
                font: { size: 10 },
                callback: (val) => `${Number(val).toLocaleString()} m³`,
              },
              grid: { color: 'rgba(255, 255, 255, 0.04)' },
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
  }, [currentIntervals, chartMetric]);

  // Handle file upload directly in this view
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result;
        if (!buffer) return;
        const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
        const result: ParseTotalizerResult = parseTotalizerWorkbook(wb);

        if (!result.isTotalizerFile || result.intervals.length === 0) {
          showToast(
            'ไม่พบโครงสร้าง 3 Tags Totalizer ในไฟล์ — โปรดตรวจสอบชื่อ Tag หรือดาวน์โหลดไฟล์แม่แบบ',
            'error'
          );
          return;
        }

        const msg = `นำเข้าสำเร็จ: คำนวณช่วงเวลา ${result.intervals.length} รายการ จาก ${result.tagStats.dates.length} วัน`;
        onImportTotalizer(result.intervals, result.dailyAggregates, msg);
        showToast(msg, 'success');

        if (result.tagStats.dates.length > 0) {
          setSelectedDate(result.tagStats.dates[result.tagStats.dates.length - 1]);
        }
      } catch (err) {
        console.error(err);
        showToast('เกิดข้อผิดพลาดในการอ่านไฟล์ Totalizer', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // Export current table to Excel
  const handleExportHourlyExcel = () => {
    try {
      const exportRows = currentIntervals.map((i) => ({
        'วันที่ (Date)': i.date,
        'ช่วงเวลา (Interval)': i.intervalLabel,
        'เวลาเริ่ม (Start)': i.startTimestamp,
        'เวลาสิ้นสุด (End)': i.endTimestamp,
        'ระยะเวลา (ชม.)': i.durationHours,
        // PWP FT01
        'PWP FT01 Totalizer เริ่ม': i.pwpStartTotalizer ?? '',
        'PWP FT01 Totalizer สิ้นสุด': i.pwpEndTotalizer ?? '',
        'PWP FT01 ปริมาณที่ใช้ (m³)': i.pwpUsage,
        'PWP FT01 อัตราการไหล (m³/h)': i.pwpFlowRate,
        // CWP FT01
        'CWP FT01 Totalizer เริ่ม': i.cwp1StartTotalizer ?? '',
        'CWP FT01 Totalizer สิ้นสุด': i.cwp1EndTotalizer ?? '',
        'CWP FT01 ปริมาณที่ใช้ (m³)': i.cwp1Usage,
        'CWP FT01 อัตราการไหล (m³/h)': i.cwp1FlowRate,
        // CWP FT03
        'CWP FT03 Totalizer เริ่ม': i.cwp2StartTotalizer ?? '',
        'CWP FT03 Totalizer สิ้นสุด': i.cwp2EndTotalizer ?? '',
        'CWP FT03 ปริมาณที่ใช้ (m³)': i.cwp2Usage,
        'CWP FT03 อัตราการไหล (m³/h)': i.cwp2FlowRate,
        // Total
        'ปริมาณการใช้น้ำรวม (m³)': i.totalUsage,
        'อัตราการไหลรวม (m³/h)': i.totalFlowRate,
      }));

      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'HourlyFlow_Intervals');
      XLSX.writeFile(wb, `Hourly_Flow_Report_${selectedDate || 'all'}.xlsx`);
      showToast('ส่งออกไฟล์ Excel สำเร็จ', 'success');
    } catch (err) {
      console.error(err);
      showToast('เกิดข้อผิดพลาดในการส่งออกไฟล์ Excel', 'error');
    }
  };

  return (
    <div id="view-hourly" className="p-6 md:p-8 space-y-6">
      {/* Hidden File Input for Totalizer Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".xlsx, .xls, .csv"
        className="hidden"
      />

      {/* Header & Tag Specification Banner */}
      <div className="bg-[#161922] rounded-2xl border border-white/5 p-6 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                <Clock className="w-5 h-5" />
              </span>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
                  <span>ปริมาณการไหลต่อชั่วโมง (Hourly Flow & Interval Telemetry)</span>
                  <span className="bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold">
                    3 TAGS TOTALIZER
                  </span>
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  แยกคำนวณปริมาณการใช้น้ำในแต่ละช่วงเวลาจากค่าสะสม (Totalizer) ตามสูตร:{' '}
                  <span className="text-white font-mono font-medium">
                    ปริมาณการใช้ = Totalizer ปัจจุบัน − Totalizer ก่อนหน้า
                  </span>
                </p>
              </div>
            </div>

            {/* 3 Specified Tags Indicator Badges */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                แท็กที่กำหนด:
              </span>
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-sky-500/10 border border-sky-500/20 text-sky-400 font-mono text-[11px]"
                title={TARGET_TAG_PWP}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
                <span>{TARGET_TAG_PWP}</span>
              </span>
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono text-[11px]"
                title={TARGET_TAG_CWP1}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                <span>{TARGET_TAG_CWP1}</span>
              </span>
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-400 font-mono text-[11px]"
                title={TARGET_TAG_CWP2}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                <span>{TARGET_TAG_CWP2}</span>
              </span>
            </div>
          </div>

          {/* Action Buttons: Template & Upload */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              id="btn-download-totalizer-template"
              type="button"
              onClick={() => {
                downloadTotalizerTemplate();
                showToast('ดาวน์โหลดไฟล์แม่แบบมาตรฐาน (Standard Template) สำเร็จ', 'success');
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium bg-white/5 hover:bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 hover:border-emerald-500/40 transition-all cursor-pointer shadow-sm"
              title="ดาวน์โหลดไฟล์ Excel แม่แบบมาตรฐานที่ระบุ 3 Tags พร้อมข้อมูลตัวอย่าง 24 ชม."
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>ไฟล์แม่แบบมาตรฐาน (.xlsx)</span>
            </button>

            <button
              id="btn-upload-totalizer"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-lg shadow-blue-600/25 transition-all cursor-pointer active:scale-95"
            >
              <Upload className="w-4 h-4" />
              <span>นำเข้าไฟล์ Totalizer</span>
            </button>
          </div>
        </div>
      </div>

      {/* Date Filter & Quick Switch Toolbar */}
      <div className="bg-[#161922] rounded-2xl border border-white/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <Calendar className="w-4 h-4 text-cyan-400" />
            <span className="font-semibold text-white">เลือกวันที่วิเคราะห์:</span>
          </div>

          <select
            id="select-hourly-date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-[#12141C] border border-white/15 text-white text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-cyan-500 font-mono-num"
          >
            {availableDates.map((d) => (
              <option key={d} value={d}>
                {fmtDateTH(d)} ({d})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => availableDates[0] && setSelectedDate(availableDates[0])}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              selectedDate === availableDates[0]
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white/5 text-slate-400 hover:text-white'
            }`}
          >
            ล่าสุด
          </button>
          {availableDates[1] && (
            <button
              type="button"
              onClick={() => setSelectedDate(availableDates[1])}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                selectedDate === availableDates[1]
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white/5 text-slate-400 hover:text-white'
              }`}
            >
              วันก่อนหน้า
            </button>
          )}
          <button
            type="button"
            onClick={handleExportHourlyExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors cursor-pointer ml-2"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>ส่งออกตาราง Excel</span>
          </button>
        </div>
      </div>

      {/* 4 Summary KPI Cards for Selected Date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Interval Consumption */}
        <div className="bg-[#161922] p-5 rounded-2xl border border-white/5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs font-medium">ยอดใช้น้ำรวมของวัน</span>
            <span className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <Activity className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white font-mono-num">
              {fmt(dayMetrics.totalUsage)}
            </span>
            <span className="text-slate-400 text-xs">m³</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            คำนวณจาก {dayMetrics.intervalCount} ช่วงเวลา
          </div>
        </div>

        {/* Average Flow Rate */}
        <div className="bg-[#161922] p-5 rounded-2xl border border-white/5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs font-medium">อัตราการไหลเฉลี่ย</span>
            <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-cyan-400 font-mono-num">
              {fmtDecimal(dayMetrics.avgFlowRate, 1)}
            </span>
            <span className="text-slate-400 text-xs">m³/h</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            เฉลี่ยตลอด 24 ชั่วโมง
          </div>
        </div>

        {/* Peak Flow Rate */}
        <div className="bg-[#161922] p-5 rounded-2xl border border-white/5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs font-medium">อัตราการไหลสูงสุด (Peak)</span>
            <span className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
              <ArrowUpRight className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-400 font-mono-num">
              {fmtDecimal(dayMetrics.peakFlowRate, 1)}
            </span>
            <span className="text-slate-400 text-xs">m³/h</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1">
            <span>ช่วงเวลา:</span>
            <span className="text-white font-mono font-medium">{dayMetrics.peakInterval}</span>
          </div>
        </div>

        {/* 3 Tags Totalizer Summary Breakdown */}
        <div className="bg-[#161922] p-5 rounded-2xl border border-white/5 relative overflow-hidden flex flex-col justify-between">
          <span className="text-slate-400 text-xs font-medium">สัดส่วน 3 Tags ในวัน</span>
          <div className="space-y-1.5 mt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-sky-400">
                <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                <span>PWP FT01:</span>
              </span>
              <span className="font-mono-num text-white font-medium">
                {fmt(dayMetrics.pwpTotal)} m³
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <span>CWP FT01:</span>
              </span>
              <span className="font-mono-num text-white font-medium">
                {fmt(dayMetrics.cwp1Total)} m³
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-purple-400">
                <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                <span>CWP FT03:</span>
              </span>
              <span className="font-mono-num text-white font-medium">
                {fmt(dayMetrics.cwp2Total)} m³
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Hourly Chart Panel */}
      <div className="bg-[#161922] rounded-2xl border border-white/5 shadow-2xl overflow-hidden">
        <div className="p-5 md:p-6 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#1C202B]">
          <div className="space-y-1">
            <h2 className="text-white font-semibold text-base flex items-center gap-2">
              <span>กราฟอัตราการไหลและปริมาณการใช้น้ำรายชั่วโมง</span>
              <span className="text-xs font-normal text-slate-400">
                ({fmtDateTH(selectedDate)})
              </span>
            </h2>
            <p className="text-slate-400 text-xs">
              แสดงการแจกแจงปริมาณการใช้น้ำในแต่ละช่วงเวลา 00:00 - 24:00 น.
            </p>
          </div>

          {/* Metric Switcher */}
          <div className="flex items-center p-1 bg-[#12141C] border border-white/10 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setChartMetric('flow_rate')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                chartMetric === 'flow_rate'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>อัตราการไหล (m³/h)</span>
            </button>

            <button
              type="button"
              onClick={() => setChartMetric('totalizer_curve')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                chartMetric === 'totalizer_curve'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LineChart className="w-3.5 h-3.5" />
              <span>ค่าสะสม Totalizer (m³)</span>
            </button>
          </div>
        </div>

        <div className="p-5 md:p-6">
          <div className="relative h-[320px] w-full">
            <canvas ref={chartCanvasRef}></canvas>
          </div>
        </div>
      </div>

      {/* Detailed Interval Breakdown Table */}
      <div className="bg-[#161922] rounded-2xl border border-white/5 shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#1C202B]">
          <div className="space-y-1">
            <h2 className="text-white font-semibold text-base flex items-center gap-2">
              <span>ตารางแจกแจงปริมาณการใช้น้ำแยกตามช่วงเวลา (Interval Table)</span>
              <span className="bg-cyan-500/20 text-cyan-400 text-[10px] px-2.5 py-0.5 rounded-full border border-cyan-500/30 font-mono">
                {currentIntervals.length} ช่วงเวลา
              </span>
            </h2>
            <p className="text-slate-400 text-xs">
              คำนวณจากผลต่าง Totalizer ปัจจุบัน (End) ลบด้วย Totalizer ก่อนหน้า (Start)
            </p>
          </div>
          <div className="text-xs text-slate-400 font-mono">
            {fmtDateTH(selectedDate)}
          </div>
        </div>

        <div className="max-h-[550px] overflow-y-auto overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-[#161922] sticky top-0 z-10 border-b border-white/10 text-[10px] uppercase font-bold text-slate-400">
                <th className="text-left px-3.5 py-3 tracking-wider">ช่วงเวลา</th>
                <th className="text-right px-3 py-3 tracking-wider text-sky-400 bg-sky-500/5">
                  PWP FT01 (เริ่ม)
                </th>
                <th className="text-right px-3 py-3 tracking-wider text-sky-400 bg-sky-500/5">
                  PWP FT01 (สิ้นสุด)
                </th>
                <th className="text-right px-3 py-3 tracking-wider text-sky-400 bg-sky-500/10 font-bold">
                  PWP ปริมาณ (m³)
                </th>
                <th className="text-right px-3 py-3 tracking-wider text-amber-400 bg-amber-500/5">
                  CWP FT01 (เริ่ม)
                </th>
                <th className="text-right px-3 py-3 tracking-wider text-amber-400 bg-amber-500/5">
                  CWP FT01 (สิ้นสุด)
                </th>
                <th className="text-right px-3 py-3 tracking-wider text-amber-400 bg-amber-500/10 font-bold">
                  CWP1 ปริมาณ (m³)
                </th>
                <th className="text-right px-3 py-3 tracking-wider text-purple-400 bg-purple-500/5">
                  CWP FT03 (เริ่ม)
                </th>
                <th className="text-right px-3 py-3 tracking-wider text-purple-400 bg-purple-500/5">
                  CWP FT03 (สิ้นสุด)
                </th>
                <th className="text-right px-3 py-3 tracking-wider text-purple-400 bg-purple-500/10 font-bold">
                  CWP2 ปริมาณ (m³)
                </th>
                <th className="text-right px-3.5 py-3 tracking-wider text-white bg-blue-600/10 font-bold">
                  รวมช่วงเวลา (m³)
                </th>
                <th className="text-right px-3.5 py-3 tracking-wider text-cyan-400 bg-cyan-600/10 font-bold">
                  อัตราการไหล (m³/h)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {currentIntervals.map((row) => {
                const isPeak = row.intervalLabel === dayMetrics.peakInterval;

                return (
                  <tr
                    key={row.id}
                    className={`transition-colors font-mono-num ${
                      isPeak
                        ? 'bg-rose-500/10 border-l-2 border-l-rose-500'
                        : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    <td className="px-3.5 py-2.5 text-slate-200 font-medium whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span>{row.intervalLabel}</span>
                        {isPeak && (
                          <span className="bg-rose-500/20 text-rose-400 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                            PEAK
                          </span>
                        )}
                      </div>
                    </td>

                    {/* PWP FT01 */}
                    <td className="px-3 py-2.5 text-right text-slate-400 bg-sky-500/[0.02]">
                      {fmt(row.pwpStartTotalizer)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-400 bg-sky-500/[0.02]">
                      {fmt(row.pwpEndTotalizer)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-sky-400 font-semibold bg-sky-500/[0.05]">
                      {fmt(row.pwpUsage)}
                    </td>

                    {/* CWP FT01 */}
                    <td className="px-3 py-2.5 text-right text-slate-400 bg-amber-500/[0.02]">
                      {fmt(row.cwp1StartTotalizer)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-400 bg-amber-500/[0.02]">
                      {fmt(row.cwp1EndTotalizer)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-amber-400 font-semibold bg-amber-500/[0.05]">
                      {fmt(row.cwp1Usage)}
                    </td>

                    {/* CWP FT03 */}
                    <td className="px-3 py-2.5 text-right text-slate-400 bg-purple-500/[0.02]">
                      {fmt(row.cwp2StartTotalizer)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-400 bg-purple-500/[0.02]">
                      {fmt(row.cwp2EndTotalizer)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-purple-400 font-semibold bg-purple-500/[0.05]">
                      {fmt(row.cwp2Usage)}
                    </td>

                    {/* Total Usage */}
                    <td className="px-3.5 py-2.5 text-right text-white font-bold bg-blue-600/[0.05]">
                      {fmt(row.totalUsage)}
                    </td>

                    {/* Flow Rate */}
                    <td className="px-3.5 py-2.5 text-right text-cyan-400 font-semibold bg-cyan-600/[0.05]">
                      {fmtDecimal(row.totalFlowRate, 1)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Table Footer with Day Totals */}
            <tfoot>
              <tr className="bg-[#1C202B] font-bold text-white border-t border-white/10 font-mono-num">
                <td className="px-3.5 py-3">รวมตลอดทั้งวัน (Total)</td>
                <td className="px-3 py-3 text-right text-slate-400">
                  {fmt(dayMetrics.pwpStart)}
                </td>
                <td className="px-3 py-3 text-right text-slate-400">
                  {fmt(dayMetrics.pwpEnd)}
                </td>
                <td className="px-3 py-3 text-right text-sky-400">
                  {fmt(dayMetrics.pwpTotal)} m³
                </td>
                <td className="px-3 py-3 text-right text-slate-400">
                  {fmt(dayMetrics.cwp1Start)}
                </td>
                <td className="px-3 py-3 text-right text-slate-400">
                  {fmt(dayMetrics.cwp1End)}
                </td>
                <td className="px-3 py-3 text-right text-amber-400">
                  {fmt(dayMetrics.cwp1Total)} m³
                </td>
                <td className="px-3 py-3 text-right text-slate-400">
                  {fmt(dayMetrics.cwp2Start)}
                </td>
                <td className="px-3 py-3 text-right text-slate-400">
                  {fmt(dayMetrics.cwp2End)}
                </td>
                <td className="px-3 py-3 text-right text-purple-400">
                  {fmt(dayMetrics.cwp2Total)} m³
                </td>
                <td className="px-3.5 py-3 text-right text-blue-400">
                  {fmt(dayMetrics.totalUsage)} m³
                </td>
                <td className="px-3.5 py-3 text-right text-cyan-400">
                  {fmtDecimal(dayMetrics.avgFlowRate, 1)} m³/h
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
