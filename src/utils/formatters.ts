import { WaterRecord, MonthlyRecord, YearlyRecord, MonthYoYComparison } from '../types';

export const THAI_MONTH_NAMES = [
  { key: '01', short: 'ม.ค.', full: 'มกราคม' },
  { key: '02', short: 'ก.พ.', full: 'กุมภาพันธ์' },
  { key: '03', short: 'มี.ค.', full: 'มีนาคม' },
  { key: '04', short: 'เม.ย.', full: 'เมษายน' },
  { key: '05', short: 'พ.ค.', full: 'พฤษภาคม' },
  { key: '06', short: 'มิ.ย.', full: 'มิถุนายน' },
  { key: '07', short: 'ก.ค.', full: 'กรกฎาคม' },
  { key: '08', short: 'ส.ค.', full: 'สิงหาคม' },
  { key: '09', short: 'ก.ย.', full: 'กันยายน' },
  { key: '10', short: 'ต.ค.', full: 'ตุลาคม' },
  { key: '11', short: 'พ.ย.', full: 'พฤศจิกายน' },
  { key: '12', short: 'ธ.ค.', full: 'ธันวาคม' },
];

export function fmtYearTH(yearStr: string): string {
  const y = parseInt(yearStr, 10);
  if (isNaN(y)) return yearStr;
  return `${y + 543}`;
}

export function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export function fmtDecimal(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtDateTH(iso: string): string {
  try {
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

export function fmtMonthTH(key: string): string {
  try {
    const [y, m] = key.split('-');
    const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
    if (isNaN(d.getTime())) return key;
    return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short' });
  } catch {
    return key;
  }
}

export function aggregateMonthly(data: WaterRecord[]): MonthlyRecord[] {
  const map = new Map<string, { pwp: number; cwp1: number; cwp2: number; days: number }>();
  
  for (const d of data) {
    if (!d.date) continue;
    const monthKey = d.date.slice(0, 7);
    if (!map.has(monthKey)) {
      map.set(monthKey, { pwp: 0, cwp1: 0, cwp2: 0, days: 0 });
    }
    const item = map.get(monthKey)!;
    item.pwp += d.pwp || 0;
    item.cwp1 += d.cwp1 || 0;
    item.cwp2 += d.cwp2 || 0;
    item.days += 1;
  }

  const sortedKeys = Array.from(map.keys()).sort();
  const results: MonthlyRecord[] = [];

  for (let i = 0; i < sortedKeys.length; i++) {
    const key = sortedKeys[i];
    const val = map.get(key)!;
    const total = val.pwp + val.cwp1 + val.cwp2;

    let deltaPercent: number | null = null;
    if (i > 0) {
      const prevKey = sortedKeys[i - 1];
      const prevVal = map.get(prevKey)!;
      const prevTotal = prevVal.pwp + prevVal.cwp1 + prevVal.cwp2;
      if (prevTotal > 0) {
        deltaPercent = ((total - prevTotal) / prevTotal) * 100;
      }
    }

    results.push({
      month: key,
      label: fmtMonthTH(key),
      pwp: val.pwp,
      cwp1: val.cwp1,
      cwp2: val.cwp2,
      total,
      days: val.days,
      deltaPercent,
    });
  }

  return results;
}

export function aggregateYearly(data: WaterRecord[]): YearlyRecord[] {
  const map = new Map<string, { pwp: number; cwp1: number; cwp2: number; days: number }>();

  for (const d of data) {
    if (!d.date) continue;
    const year = d.date.slice(0, 4);
    if (!map.has(year)) {
      map.set(year, { pwp: 0, cwp1: 0, cwp2: 0, days: 0 });
    }
    const item = map.get(year)!;
    item.pwp += d.pwp || 0;
    item.cwp1 += d.cwp1 || 0;
    item.cwp2 += d.cwp2 || 0;
    item.days += 1;
  }

  const sortedYears = Array.from(map.keys()).sort();
  const results: YearlyRecord[] = [];

  for (let i = 0; i < sortedYears.length; i++) {
    const year = sortedYears[i];
    const val = map.get(year)!;
    const total = val.pwp + val.cwp1 + val.cwp2;
    const avgDaily = val.days > 0 ? total / val.days : 0;

    let deltaPercentTotal: number | null = null;
    let deltaPercentPwp: number | null = null;
    let deltaPercentCwp1: number | null = null;
    let deltaPercentCwp2: number | null = null;

    if (i > 0) {
      const prevYear = sortedYears[i - 1];
      const prevVal = map.get(prevYear)!;
      const prevTotal = prevVal.pwp + prevVal.cwp1 + prevVal.cwp2;

      if (prevTotal > 0) {
        deltaPercentTotal = ((total - prevTotal) / prevTotal) * 100;
      }
      if (prevVal.pwp > 0) {
        deltaPercentPwp = ((val.pwp - prevVal.pwp) / prevVal.pwp) * 100;
      }
      if (prevVal.cwp1 > 0) {
        deltaPercentCwp1 = ((val.cwp1 - prevVal.cwp1) / prevVal.cwp1) * 100;
      }
      if (prevVal.cwp2 > 0) {
        deltaPercentCwp2 = ((val.cwp2 - prevVal.cwp2) / prevVal.cwp2) * 100;
      }
    }

    results.push({
      year,
      yearTH: fmtYearTH(year),
      pwp: val.pwp,
      cwp1: val.cwp1,
      cwp2: val.cwp2,
      total,
      days: val.days,
      avgDaily,
      deltaPercentTotal,
      deltaPercentPwp,
      deltaPercentCwp1,
      deltaPercentCwp2,
    });
  }

  return results;
}

export function getMonthYoYData(
  data: WaterRecord[],
  baseYear: string,
  targetYear: string,
  metric: 'total' | 'pwp' | 'cwp1' | 'cwp2' = 'total'
): MonthYoYComparison[] {
  // Aggregate by Month '01' - '12' for baseYear and targetYear
  const baseMap = new Map<string, { value: number; days: number }>();
  const targetMap = new Map<string, { value: number; days: number }>();

  for (const m of THAI_MONTH_NAMES) {
    baseMap.set(m.key, { value: 0, days: 0 });
    targetMap.set(m.key, { value: 0, days: 0 });
  }

  for (const d of data) {
    if (!d.date) continue;
    const year = d.date.slice(0, 4);
    const month = d.date.slice(5, 7);

    const val =
      metric === 'pwp'
        ? d.pwp || 0
        : metric === 'cwp1'
        ? d.cwp1 || 0
        : metric === 'cwp2'
        ? d.cwp2 || 0
        : (d.pwp || 0) + (d.cwp1 || 0) + (d.cwp2 || 0);

    if (year === baseYear && baseMap.has(month)) {
      const item = baseMap.get(month)!;
      item.value += val;
      item.days += 1;
    } else if (year === targetYear && targetMap.has(month)) {
      const item = targetMap.get(month)!;
      item.value += val;
      item.days += 1;
    }
  }

  return THAI_MONTH_NAMES.map((m) => {
    const base = baseMap.get(m.key) || { value: 0, days: 0 };
    const target = targetMap.get(m.key) || { value: 0, days: 0 };
    const diff = target.value - base.value;
    let pct: number | null = null;
    if (base.value > 0) {
      pct = (diff / base.value) * 100;
    } else if (target.value > 0) {
      pct = 100;
    }

    return {
      monthKey: m.key,
      monthLabel: m.full,
      monthShort: m.short,
      baseValue: target.days > 0 || base.days > 0 ? base.value : 0,
      targetValue: target.days > 0 || base.days > 0 ? target.value : 0,
      difference: diff,
      percentChange: pct,
      baseDays: base.days,
      targetDays: target.days,
    };
  });
}
