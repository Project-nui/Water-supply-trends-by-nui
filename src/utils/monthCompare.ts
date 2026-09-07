import { WaterRecord } from '../types';
import { fmtMonthTH } from './formatters';

export interface MonthStats {
  monthKey: string; // 'YYYY-MM'
  label: string;    // 'ก.พ. 2569'
  days: number;
  pwp: number;
  cwp1: number;
  cwp2: number;
  total: number;
  avgDaily: number;
  dailyMap: Map<number, { pwp: number; cwp1: number; cwp2: number; total: number }>;
}

export interface MetricComparison {
  baseValue: number;
  compareValue: number;
  difference: number;
  percentChange: number | null;
}

export interface TwoMonthsComparison {
  monthA: MonthStats;
  monthB: MonthStats;
  total: MetricComparison;
  pwp: MetricComparison;
  cwp1: MetricComparison;
  cwp2: MetricComparison;
  avgDaily: MetricComparison;
}

export function calculateMetricComparison(base: number, compare: number): MetricComparison {
  const difference = compare - base;
  let percentChange: number | null = null;
  if (base > 0) {
    percentChange = (difference / base) * 100;
  } else if (compare > 0) {
    percentChange = 100;
  } else {
    percentChange = 0;
  }
  return {
    baseValue: base,
    compareValue: compare,
    difference,
    percentChange,
  };
}

export function getMonthStats(data: WaterRecord[], monthKey: string): MonthStats {
  const dailyMap = new Map<number, { pwp: number; cwp1: number; cwp2: number; total: number }>();
  let pwp = 0;
  let cwp1 = 0;
  let cwp2 = 0;
  let days = 0;

  for (const r of data) {
    if (!r.date || !r.date.startsWith(monthKey)) continue;
    const dayNum = parseInt(r.date.slice(8, 10), 10);
    const dayTotal = (r.pwp || 0) + (r.cwp1 || 0) + (r.cwp2 || 0);

    pwp += r.pwp || 0;
    cwp1 += r.cwp1 || 0;
    cwp2 += r.cwp2 || 0;
    days += 1;

    dailyMap.set(dayNum, {
      pwp: r.pwp || 0,
      cwp1: r.cwp1 || 0,
      cwp2: r.cwp2 || 0,
      total: dayTotal,
    });
  }

  const total = pwp + cwp1 + cwp2;
  const avgDaily = days > 0 ? total / days : 0;

  return {
    monthKey,
    label: fmtMonthTH(monthKey),
    days,
    pwp,
    cwp1,
    cwp2,
    total,
    avgDaily,
    dailyMap,
  };
}

export function compareTwoMonths(statsA: MonthStats, statsB: MonthStats): TwoMonthsComparison {
  return {
    monthA: statsA,
    monthB: statsB,
    total: calculateMetricComparison(statsA.total, statsB.total),
    pwp: calculateMetricComparison(statsA.pwp, statsB.pwp),
    cwp1: calculateMetricComparison(statsA.cwp1, statsB.cwp1),
    cwp2: calculateMetricComparison(statsA.cwp2, statsB.cwp2),
    avgDaily: calculateMetricComparison(statsA.avgDaily, statsB.avgDaily),
  };
}

export function getPrevMonthKey(key: string): string {
  const [yStr, mStr] = key.split('-');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(y) || isNaN(m)) return key;

  if (m === 1) {
    return `${y - 1}-12`;
  }
  const prevM = m - 1;
  return `${y}-${prevM < 10 ? '0' + prevM : prevM}`;
}

export function getSameMonthLastYearKey(key: string): string {
  const [yStr, mStr] = key.split('-');
  const y = parseInt(yStr, 10);
  if (isNaN(y)) return key;
  return `${y - 1}-${mStr}`;
}
