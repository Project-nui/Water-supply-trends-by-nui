export interface WaterRecord {
  date: string; // ISO 'YYYY-MM-DD'
  pwp: number | null;
  cwp1: number | null;
  cwp2: number | null;
}

export interface MonthlyRecord {
  month: string; // 'YYYY-MM'
  label: string; // Thai format e.g. 'ต.ค. 2565'
  pwp: number;
  cwp1: number;
  cwp2: number;
  total: number;
  days: number;
  deltaPercent: number | null;
}

export type ActiveView = 'dashboard' | 'hourly' | 'daily' | 'monthly' | 'yearly';

export interface YearlyRecord {
  year: string; // '2024'
  yearTH: string; // '2567'
  pwp: number;
  cwp1: number;
  cwp2: number;
  total: number;
  days: number;
  avgDaily: number;
  deltaPercentTotal: number | null;
  deltaPercentPwp: number | null;
  deltaPercentCwp1: number | null;
  deltaPercentCwp2: number | null;
}

export interface MonthYoYComparison {
  monthKey: string; // '01', '02', ...
  monthLabel: string; // 'มกราคม', 'กุมภาพันธ์', etc.
  monthShort: string; // 'ม.ค.', 'ก.พ.', etc.
  baseValue: number;
  targetValue: number;
  difference: number;
  percentChange: number | null;
  baseDays: number;
  targetDays: number;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

/**
 * 3 Primary Totalizer SCADA/IoT Tags
 */
export const TARGET_TAG_PWP = 'Pane1-Disturdution PWP FT01 TOTALIZER';
export const TARGET_TAG_CWP1 = 'Pane1-Disturdution CWP FT01 TOTALIZER';
export const TARGET_TAG_CWP2 = 'Pane1-Disturdution CWP FT03 TOTALIZER';

/**
 * Hourly / Interval Flow Record computed from Totalizer deltas
 */
export interface HourlyIntervalRecord {
  id: string;
  date: string; // 'YYYY-MM-DD'
  startTime: string; // '08:00'
  endTime: string; // '09:00'
  intervalLabel: string; // '08:00 - 09:00'
  startTimestamp: string; // 'YYYY-MM-DD HH:mm:ss'
  endTimestamp: string; // 'YYYY-MM-DD HH:mm:ss'
  durationHours: number; // e.g. 1.0

  // Tag 1: Pane1-Disturdution PWP FT01 TOTALIZER
  pwpStartTotalizer: number | null;
  pwpEndTotalizer: number | null;
  pwpUsage: number; // m³
  pwpFlowRate: number; // m³/h

  // Tag 2: Pane1-Disturdution CWP FT01 TOTALIZER
  cwp1StartTotalizer: number | null;
  cwp1EndTotalizer: number | null;
  cwp1Usage: number; // m³
  cwp1FlowRate: number; // m³/h

  // Tag 3: Pane1-Disturdution CWP FT03 TOTALIZER
  cwp2StartTotalizer: number | null;
  cwp2EndTotalizer: number | null;
  cwp2Usage: number; // m³
  cwp2FlowRate: number; // m³/h

  // Aggregate Total
  totalUsage: number; // m³ = pwp + cwp1 + cwp2
  totalFlowRate: number; // m³/h = totalUsage / durationHours
}
