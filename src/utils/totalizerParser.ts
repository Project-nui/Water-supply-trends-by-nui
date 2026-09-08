import * as XLSX from 'xlsx';
import {
  HourlyIntervalRecord,
  WaterRecord,
  TARGET_TAG_PWP,
  TARGET_TAG_CWP1,
  TARGET_TAG_CWP2,
} from '../types';

/**
 * Normalizes string for fuzzy tag comparison:
 * handles typos like "Disturdution" vs "Distribution", underscores, extra spaces, casing
 */
export function normalizeTagName(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[_\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks whether a column header or tag matches one of the 3 specified tags:
 * 1. Pane1-Disturdution PWP FT01 TOTALIZER -> 'pwp'
 * 2. Pane1-Disturdution CWP FT01 TOTALIZER -> 'cwp1'
 * 3. Pane1-Disturdution CWP FT03 TOTALIZER -> 'cwp2'
 * Any other tag returns null (filtering strictly for these 3 tags).
 */
export function matchTargetTag(header: string): 'pwp' | 'cwp1' | 'cwp2' | null {
  if (!header) return null;
  const n = normalizeTagName(header);

  // Exact or near-exact match check
  // Tag 1: Pane1-Disturdution PWP FT01 TOTALIZER
  const isPwp =
    n.includes('pwp') &&
    (n.includes('ft01') || n.includes('ft 01') || n.includes('ft1') || n.includes('ft 1'));
  if (isPwp) {
    return 'pwp';
  }

  // Tag 2: Pane1-Disturdution CWP FT01 TOTALIZER
  const isCwp1 =
    n.includes('cwp') &&
    (n.includes('ft01') || n.includes('ft 01') || n.includes('ft1') || n.includes('ft 1'));
  if (isCwp1) {
    return 'cwp1';
  }

  // Tag 3: Pane1-Disturdution CWP FT03 TOTALIZER
  const isCwp2 =
    n.includes('cwp') &&
    (n.includes('ft03') || n.includes('ft 03') || n.includes('ft3') || n.includes('ft 3'));
  if (isCwp2) {
    return 'cwp2';
  }

  return null;
}

/**
 * Helper to parse any raw cell into a JavaScript Date object
 */
export function parseDateCell(raw: unknown): Date | null {
  if (!raw) return null;
  if (raw instanceof Date) {
    return isNaN(raw.getTime()) ? null : raw;
  }
  if (typeof raw === 'number') {
    // Excel serial date number
    // 25569 is days between 1899-12-30 and 1970-01-01
    const ms = Math.round((raw - 25569) * 86400 * 1000);
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  const str = String(raw).trim();
  if (!str) return null;

  // Try standard parsing
  let d = new Date(str);
  if (!isNaN(d.getTime())) return d;

  // Try DD/MM/YYYY HH:mm:ss or YYYY/MM/DD HH:mm:ss
  const match = str.match(/^(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,4})[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
  if (match) {
    let year = parseInt(match[1], 10);
    let month = parseInt(match[2], 10);
    let day = parseInt(match[3], 10);
    const hours = parseInt(match[4], 10);
    const mins = parseInt(match[5], 10);
    const secs = match[6] ? parseInt(match[6], 10) : 0;

    // If year was in the 3rd position (DD/MM/YYYY)
    if (day > 1000) {
      const temp = year;
      year = day;
      day = temp;
    }
    // Thai Buddhist year adjustment (e.g. 2567 -> 2024)
    if (year > 2400) {
      year -= 543;
    }

    d = new Date(year, month - 1, day, hours, mins, secs);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

/**
 * Helper to parse numeric totalizer values safely
 */
export function parseNum(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, '').trim());
  return isNaN(n) ? null : n;
}

function padZero(num: number): string {
  return num < 10 ? `0${num}` : `${num}`;
}

export function formatDateTime(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = padZero(d.getMonth() + 1);
  const dd = padZero(d.getDate());
  const hh = padZero(d.getHours());
  const mi = padZero(d.getMinutes());
  const ss = padZero(d.getSeconds());
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

export function formatDateOnly(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = padZero(d.getMonth() + 1);
  const dd = padZero(d.getDate());
  return `${yyyy}-${mm}-${dd}`;
}

export function formatTimeOnly(d: Date): string {
  const hh = padZero(d.getHours());
  const mi = padZero(d.getMinutes());
  return `${hh}:${mi}`;
}

interface RawPoint {
  timestamp: Date;
  pwp: number | null;
  cwp1: number | null;
  cwp2: number | null;
}

export interface ParseTotalizerResult {
  isTotalizerFile: boolean;
  intervals: HourlyIntervalRecord[];
  dailyAggregates: WaterRecord[];
  tagStats: {
    foundPwp: boolean;
    foundCwp1: boolean;
    foundCwp2: boolean;
    pointCount: number;
    intervalCount: number;
    dates: string[];
  };
}

/**
 * Parses an uploaded Excel workbook for the 3 target Totalizer tags and computes interval usage.
 */
export function parseTotalizerWorkbook(wb: XLSX.WorkBook): ParseTotalizerResult {
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(sheet, {
    header: 1,
    raw: true,
  });

  if (!rows || rows.length < 2) {
    return {
      isTotalizerFile: false,
      intervals: [],
      dailyAggregates: [],
      tagStats: {
        foundPwp: false,
        foundCwp1: false,
        foundCwp2: false,
        pointCount: 0,
        intervalCount: 0,
        dates: [],
      },
    };
  }

  // 1. Scan the first few rows to locate the header row
  let headerRowIdx = -1;
  let colTimestamp = -1;
  let colPwp = -1;
  let colCwp1 = -1;
  let colCwp2 = -1;

  // Also check for Tall/Long format (columns: TagName, Timestamp, Value)
  let isTallFormat = false;
  let colTagName = -1;
  let colTallTimestamp = -1;
  let colTallValue = -1;

  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;

    // Check Wide format headers
    const headers = row.map((cell) => (cell || '').toString().trim());

    const tIdx = headers.findIndex((h) => {
      const lower = h.toLowerCase();
      return (
        lower.includes('time') ||
        lower.includes('date') ||
        lower.includes('วันที่') ||
        lower.includes('เวลา') ||
        lower === 'stamp'
      );
    });

    let pwpIdx = -1;
    let cwp1Idx = -1;
    let cwp2Idx = -1;

    headers.forEach((h, idx) => {
      if (idx === tIdx) return;
      const tag = matchTargetTag(h);
      if (tag === 'pwp' && pwpIdx === -1) pwpIdx = idx;
      if (tag === 'cwp1' && cwp1Idx === -1) cwp1Idx = idx;
      if (tag === 'cwp2' && cwp2Idx === -1) cwp2Idx = idx;
    });

    // If at least one totalizer tag is found alongside a timestamp
    if (tIdx !== -1 && (pwpIdx !== -1 || cwp1Idx !== -1 || cwp2Idx !== -1)) {
      headerRowIdx = r;
      colTimestamp = tIdx;
      colPwp = pwpIdx;
      colCwp1 = cwp1Idx;
      colCwp2 = cwp2Idx;
      break;
    }

    // Check Tall format
    const tagCol = headers.findIndex((h) => {
      const l = h.toLowerCase();
      return l.includes('tag') || l.includes('name') || l.includes('ชื่อ');
    });
    const timeCol = headers.findIndex((h) => {
      const l = h.toLowerCase();
      return l.includes('time') || l.includes('date') || l.includes('วันที่');
    });
    const valCol = headers.findIndex((h) => {
      const l = h.toLowerCase();
      return l.includes('val') || l.includes('total') || l.includes('ค่า');
    });

    if (tagCol !== -1 && timeCol !== -1 && valCol !== -1) {
      headerRowIdx = r;
      isTallFormat = true;
      colTagName = tagCol;
      colTallTimestamp = timeCol;
      colTallValue = valCol;
      break;
    }
  }

  if (headerRowIdx === -1) {
    return {
      isTotalizerFile: false,
      intervals: [],
      dailyAggregates: [],
      tagStats: {
        foundPwp: false,
        foundCwp1: false,
        foundCwp2: false,
        pointCount: 0,
        intervalCount: 0,
        dates: [],
      },
    };
  }

  // 2. Extract Raw Totalizer Points
  const rawPointsMap = new Map<number, RawPoint>();

  if (isTallFormat) {
    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r) continue;
      const rawDate = r[colTallTimestamp];
      const parsedDate = parseDateCell(rawDate);
      if (!parsedDate) continue;

      const rawTag = String(r[colTagName] || '');
      const matched = matchTargetTag(rawTag);
      if (!matched) continue; // Only process the 3 target tags

      const val = parseNum(r[colTallValue]);
      const timeMs = parsedDate.getTime();

      let point = rawPointsMap.get(timeMs);
      if (!point) {
        point = { timestamp: parsedDate, pwp: null, cwp1: null, cwp2: null };
        rawPointsMap.set(timeMs, point);
      }
      if (matched === 'pwp') point.pwp = val;
      if (matched === 'cwp1') point.cwp1 = val;
      if (matched === 'cwp2') point.cwp2 = val;
    }
  } else {
    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r) continue;
      const rawDate = r[colTimestamp];
      const parsedDate = parseDateCell(rawDate);
      if (!parsedDate) continue;

      const pwpVal = colPwp !== -1 ? parseNum(r[colPwp]) : null;
      const cwp1Val = colCwp1 !== -1 ? parseNum(r[colCwp1]) : null;
      const cwp2Val = colCwp2 !== -1 ? parseNum(r[colCwp2]) : null;

      const timeMs = parsedDate.getTime();
      let point = rawPointsMap.get(timeMs);
      if (!point) {
        point = {
          timestamp: parsedDate,
          pwp: pwpVal,
          cwp1: cwp1Val,
          cwp2: cwp2Val,
        };
        rawPointsMap.set(timeMs, point);
      } else {
        if (pwpVal !== null) point.pwp = pwpVal;
        if (cwp1Val !== null) point.cwp1 = cwp1Val;
        if (cwp2Val !== null) point.cwp2 = cwp2Val;
      }
    }
  }

  // 3. Sort chronologically ascending
  const sortedPoints = Array.from(rawPointsMap.values()).sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );

  if (sortedPoints.length < 2) {
    return {
      isTotalizerFile: true,
      intervals: [],
      dailyAggregates: [],
      tagStats: {
        foundPwp: colPwp !== -1,
        foundCwp1: colCwp1 !== -1,
        foundCwp2: colCwp2 !== -1,
        pointCount: sortedPoints.length,
        intervalCount: 0,
        dates: [],
      },
    };
  }

  // 4. Calculate Interval Differences (Totalizer_current - Totalizer_previous)
  const intervals: HourlyIntervalRecord[] = [];
  const dailyMap = new Map<
    string,
    { pwp: number; cwp1: number; cwp2: number; count: number }
  >();

  for (let i = 1; i < sortedPoints.length; i++) {
    const prev = sortedPoints[i - 1];
    const curr = sortedPoints[i];

    const diffMs = curr.timestamp.getTime() - prev.timestamp.getTime();
    if (diffMs <= 0) continue; // Duplicate or invalid time jump

    const durationHours = diffMs / (1000 * 60 * 60);

    // Calculate usage: curr - prev
    // If negative (e.g. Totalizer reset / overflow), protect against distorted numbers
    const calcUsage = (start: number | null, end: number | null): number => {
      if (start === null || end === null) return 0;
      const delta = end - start;
      return delta >= 0 ? delta : 0;
    };

    const pwpUsage = calcUsage(prev.pwp, curr.pwp);
    const cwp1Usage = calcUsage(prev.cwp1, curr.cwp1);
    const cwp2Usage = calcUsage(prev.cwp2, curr.cwp2);

    const pwpFlowRate = durationHours > 0 ? pwpUsage / durationHours : pwpUsage;
    const cwp1FlowRate = durationHours > 0 ? cwp1Usage / durationHours : cwp1Usage;
    const cwp2FlowRate = durationHours > 0 ? cwp2Usage / durationHours : cwp2Usage;

    const totalUsage = pwpUsage + cwp1Usage + cwp2Usage;
    const totalFlowRate = durationHours > 0 ? totalUsage / durationHours : totalUsage;

    const dateKey = formatDateOnly(curr.timestamp);
    const startTimeStr = formatTimeOnly(prev.timestamp);
    const endTimeStr = formatTimeOnly(curr.timestamp);

    const intervalRecord: HourlyIntervalRecord = {
      id: `${dateKey}_${startTimeStr}_${endTimeStr}_${i}`,
      date: dateKey,
      startTime: startTimeStr,
      endTime: endTimeStr,
      intervalLabel: `${startTimeStr} - ${endTimeStr}`,
      startTimestamp: formatDateTime(prev.timestamp),
      endTimestamp: formatDateTime(curr.timestamp),
      durationHours: Number(durationHours.toFixed(3)),
      pwpStartTotalizer: prev.pwp,
      pwpEndTotalizer: curr.pwp,
      pwpUsage: Number(pwpUsage.toFixed(2)),
      pwpFlowRate: Number(pwpFlowRate.toFixed(2)),
      cwp1StartTotalizer: prev.cwp1,
      cwp1EndTotalizer: curr.cwp1,
      cwp1Usage: Number(cwp1Usage.toFixed(2)),
      cwp1FlowRate: Number(cwp1FlowRate.toFixed(2)),
      cwp2StartTotalizer: prev.cwp2,
      cwp2EndTotalizer: curr.cwp2,
      cwp2Usage: Number(cwp2Usage.toFixed(2)),
      cwp2FlowRate: Number(cwp2FlowRate.toFixed(2)),
      totalUsage: Number(totalUsage.toFixed(2)),
      totalFlowRate: Number(totalFlowRate.toFixed(2)),
    };

    intervals.push(intervalRecord);

    // Accumulate daily totals
    const dRec = dailyMap.get(dateKey) || { pwp: 0, cwp1: 0, cwp2: 0, count: 0 };
    dRec.pwp += pwpUsage;
    dRec.cwp1 += cwp1Usage;
    dRec.cwp2 += cwp2Usage;
    dRec.count += 1;
    dailyMap.set(dateKey, dRec);
  }

  // 5. Generate Daily Aggregates (WaterRecord[])
  const dailyAggregates: WaterRecord[] = Array.from(dailyMap.entries()).map(
    ([date, agg]) => ({
      date,
      pwp: Number(agg.pwp.toFixed(2)),
      cwp1: Number(agg.cwp1.toFixed(2)),
      cwp2: Number(agg.cwp2.toFixed(2)),
    })
  );

  const foundPwp = intervals.some((x) => x.pwpStartTotalizer !== null);
  const foundCwp1 = intervals.some((x) => x.cwp1StartTotalizer !== null);
  const foundCwp2 = intervals.some((x) => x.cwp2StartTotalizer !== null);
  const dates = Array.from(dailyMap.keys()).sort();

  return {
    isTotalizerFile: true,
    intervals,
    dailyAggregates,
    tagStats: {
      foundPwp,
      foundCwp1,
      foundCwp2,
      pointCount: sortedPoints.length,
      intervalCount: intervals.length,
      dates,
    },
  };
}

/**
 * Generates and downloads a clean, standardized Excel template matching the exact upload specification:
 * Sheet 1: 3-Tag Totalizer Telemetry (Hourly calculation)
 * Sheet 2: Daily Summary Format
 * Sheet 3: Specification and Guidelines
 */
export function downloadStandardImportTemplate() {
  const sampleHourlyRows: (string | number)[][] = [
    [
      'Timestamp',
      TARGET_TAG_PWP,
      TARGET_TAG_CWP1,
      TARGET_TAG_CWP2,
    ],
  ];

  // Base cumulative starting totalizer numbers
  let pwpTot = 10000;
  let cwp1Tot = 50000;
  let cwp2Tot = 30000;

  const dateBase = '2026-09-07';

  // Add 00:00 to 24:00 points (25 points = 24 intervals)
  for (let h = 0; h <= 24; h++) {
    const hh = padZero(h % 24);
    const dateStr = h === 24 ? '2026-09-08 00:00:00' : `${dateBase} ${hh}:00:00`;
    sampleHourlyRows.push([dateStr, pwpTot, cwp1Tot, cwp2Tot]);

    // Diurnal variation in usage (higher during daytime 08:00 - 18:00)
    const factor = h >= 8 && h <= 18 ? 1.4 : 0.7;
    const pwpDelta = Math.round((280 + Math.random() * 60) * factor);
    const cwp1Delta = Math.round((1200 + Math.random() * 200) * factor);
    const cwp2Delta = Math.round((750 + Math.random() * 150) * factor);

    pwpTot += pwpDelta;
    cwp1Tot += cwp1Delta;
    cwp2Tot += cwp2Delta;
  }

  const wsHourly = XLSX.utils.aoa_to_sheet(sampleHourlyRows);
  wsHourly['!cols'] = [{ wch: 22 }, { wch: 42 }, { wch: 42 }, { wch: 42 }];

  // Sheet 2: Daily format
  const sampleDailyRows: (string | number)[][] = [
    ['Date', 'PWP 1-6', 'CWP 1-4', 'CWP 5-7'],
    ['2026-09-01', 6540, 27800, 20450],
    ['2026-09-02', 6820, 28150, 20900],
    ['2026-09-03', 6410, 27600, 20120],
    ['2026-09-04', 7100, 29200, 21400],
    ['2026-09-05', 6950, 28700, 21050],
    ['2026-09-06', 7020, 28950, 21200],
    ['2026-09-07', 7200, 29400, 21500],
  ];
  const wsDaily = XLSX.utils.aoa_to_sheet(sampleDailyRows);
  wsDaily['!cols'] = [{ wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];

  // Sheet 3: Standard Specifications & Guide
  const guideRows: (string | number)[][] = [
    ['คู่มือมาตรฐานรูปแบบไฟล์นำเข้าข้อมูลระบบ WHA Water (Data Import Standard)'],
    [''],
    ['ข้อกำหนดคอลัมน์มาตรฐานสำหรับรูปแบบ 3 Tags Totalizer (แนะนำสำหรับวิเคราะห์รายชั่วโมง)'],
    ['ลำดับ', 'ชื่อคอลัมน์ / Tag Name', 'คำอธิบาย', 'หน่วย', 'ตัวอย่างค่า'],
    ['1', 'Timestamp', 'วันและเวลาที่บันทึกข้อมูล (YYYY-MM-DD HH:mm:ss หรือ DD/MM/YYYY HH:mm)', 'เวลา', '2026-09-07 08:00:00'],
    ['2', TARGET_TAG_PWP, 'มิเตอร์น้ำดี PWP 1-6 (ค่าสะสม Totalizer สะสมต่อเนื่อง)', 'm³ (ลบ.ม.)', '12540.50'],
    ['3', TARGET_TAG_CWP1, 'มิเตอร์น้ำหล่อเย็น CWP 1-4 (ค่าสะสม Totalizer สะสมต่อเนื่อง)', 'm³ (ลบ.ม.)', '53200.00'],
    ['4', TARGET_TAG_CWP2, 'มิเตอร์น้ำหล่อเย็น CWP 5-7 (ค่าสะสม Totalizer สะสมต่อเนื่อง)', 'm³ (ลบ.ม.)', '32150.00'],
    [''],
    ['หลักการคำนวณของระบบ'],
    ['- ปริมาณการใช้ (Usage m³) = ค่า Totalizer จุดสิ้นสุดช่วงเวลา - ค่า Totalizer จุดเริ่มต้นช่วงเวลา'],
    ['- อัตราการไหล (Flow Rate m³/h) = ปริมาณการใช้ (Usage m³) ÷ จำนวนชั่วโมงในช่วงเวลานั้น'],
    ['- ค่าสรุปรายวันจะถูกรวมสะสมและส่งเข้าหน้าภาพรวม (Dashboard) และหน้าข้อมูลรายวัน (Daily View) โดยอัตโนมัติ'],
    [''],
    ['พัฒนาโดย: Thawatchai ENG Team (ระบบติดตามการใช้น้ำ WHA)'],
  ];
  const wsGuide = XLSX.utils.aoa_to_sheet(guideRows);
  wsGuide['!cols'] = [{ wch: 8 }, { wch: 44 }, { wch: 48 }, { wch: 14 }, { wch: 22 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsHourly, '3Tags_Totalizer');
  XLSX.utils.book_append_sheet(wb, wsDaily, 'Daily_Summary');
  XLSX.utils.book_append_sheet(wb, wsGuide, 'Specification_Guide');
  XLSX.writeFile(wb, 'WHA_Water_Import_Standard_Template.xlsx');
}

/**
 * Backward compatibility alias
 */
export const downloadTotalizerTemplate = downloadStandardImportTemplate;

/**
 * Creates realistic initial hourly totalizer interval data for recent days
 * so the Hourly Flow view is immediately rich and interactive.
 */
export function generateInitialHourlyIntervals(
  records: WaterRecord[]
): HourlyIntervalRecord[] {
  const result: HourlyIntervalRecord[] = [];
  if (!records || records.length === 0) return result;

  // Take the last 3 days
  const recentDays = records.slice(-3);

  // Hourly profile weights (sum to ~1.0)
  const hourlyWeights = [
    0.025, 0.022, 0.02, 0.021, 0.025, 0.035, // 00-06
    0.045, 0.055, 0.062, 0.065, 0.064, 0.06, // 06-12
    0.058, 0.063, 0.065, 0.064, 0.06, 0.052, // 12-18
    0.046, 0.042, 0.038, 0.034, 0.03, 0.026, // 18-24
  ];

  let pwpTot = 1452800;
  let cwp1Tot = 4210600;
  let cwp2Tot = 2984500;

  recentDays.forEach((dayRec) => {
    const dayPwp = dayRec.pwp ?? 6800;
    const dayCwp1 = dayRec.cwp1 ?? 28000;
    const dayCwp2 = dayRec.cwp2 ?? 21000;

    for (let h = 0; h < 24; h++) {
      const weight = hourlyWeights[h] || 0.04;
      const pwpUsage = Number((dayPwp * weight).toFixed(2));
      const cwp1Usage = Number((dayCwp1 * weight).toFixed(2));
      const cwp2Usage = Number((dayCwp2 * weight).toFixed(2));

      const startH = padZero(h);
      const endH = padZero((h + 1) % 24);
      const nextDate = h === 23 ? getNextDateString(dayRec.date) : dayRec.date;

      const pwpStart = pwpTot;
      const cwp1Start = cwp1Tot;
      const cwp2Start = cwp2Tot;

      pwpTot += pwpUsage;
      cwp1Tot += cwp1Usage;
      cwp2Tot += cwp2Usage;

      const totalUsage = Number((pwpUsage + cwp1Usage + cwp2Usage).toFixed(2));

      result.push({
        id: `${dayRec.date}_${startH}_${endH}`,
        date: dayRec.date,
        startTime: `${startH}:00`,
        endTime: h === 23 ? '24:00' : `${endH}:00`,
        intervalLabel: `${startH}:00 - ${h === 23 ? '24:00' : `${endH}:00`}`,
        startTimestamp: `${dayRec.date} ${startH}:00:00`,
        endTimestamp: `${nextDate} ${h === 23 ? '00:00:00' : `${endH}:00:00`}`,
        durationHours: 1.0,
        pwpStartTotalizer: Number(pwpStart.toFixed(2)),
        pwpEndTotalizer: Number(pwpTot.toFixed(2)),
        pwpUsage,
        pwpFlowRate: pwpUsage,
        cwp1StartTotalizer: Number(cwp1Start.toFixed(2)),
        cwp1EndTotalizer: Number(cwp1Tot.toFixed(2)),
        cwp1Usage,
        cwp1FlowRate: cwp1Usage,
        cwp2StartTotalizer: Number(cwp2Start.toFixed(2)),
        cwp2EndTotalizer: Number(cwp2Tot.toFixed(2)),
        cwp2Usage,
        cwp2FlowRate: cwp2Usage,
        totalUsage,
        totalFlowRate: totalUsage,
      });
    }
  });

  return result;
}

function getNextDateString(dateStr: string): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  return formatDateOnly(d);
}
