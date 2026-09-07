import { WaterRecord } from '../types';
import { raw2022_2023 } from './records2022_2023';
import { raw2024 } from './records2024';
import { raw2025 } from './records2025';
import { raw2026 } from './records2026';

export const INITIAL_DATA: WaterRecord[] = [
  ...raw2022_2023,
  ...raw2024,
  ...raw2025,
  ...raw2026,
].map(([date, pwp, cwp1, cwp2]) => ({
  date,
  pwp,
  cwp1,
  cwp2,
})).sort((a, b) => a.date.localeCompare(b.date));
