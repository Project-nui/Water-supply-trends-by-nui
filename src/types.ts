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

export type ActiveView = 'dashboard' | 'daily' | 'monthly' | 'yearly';

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
