/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { ActiveView, WaterRecord, ToastMessage, HourlyIntervalRecord } from './types';
import { INITIAL_DATA } from './data';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { DashboardView } from './components/DashboardView';
import { HourlyFlowView } from './components/HourlyFlowView';
import { DailyView } from './components/DailyView';
import { MonthlyView } from './components/MonthlyView';
import { YearlyView } from './components/YearlyView';
import { Toast } from './components/Toast';
import { LoginGate } from './components/LoginGate';
import { generateInitialHourlyIntervals } from './utils/totalizerParser';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      const sessionAuth = sessionStorage.getItem('wha_water_auth');
      if (sessionAuth === 'true') return true;
      const localAuth = localStorage.getItem('wha_water_auth');
      if (localAuth === 'true') return true;
    } catch {
      // ignore
    }
    return false;
  });

  const [data, setData] = useState<WaterRecord[]>(() => {
    try {
      const saved = localStorage.getItem('water_records_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return INITIAL_DATA;
  });

  const [hourlyIntervals, setHourlyIntervals] = useState<HourlyIntervalRecord[]>(() => {
    try {
      const saved = localStorage.getItem('hourly_records_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return generateInitialHourlyIntervals(INITIAL_DATA);
  });

  const [selectedHourlyDate, setSelectedHourlyDate] = useState<string>('');
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({
      id: String(Date.now()),
      message,
      type,
    });
  };

  const handleLoginSuccess = (remember: boolean) => {
    setIsAuthenticated(true);
    try {
      sessionStorage.setItem('wha_water_auth', 'true');
      if (remember) {
        localStorage.setItem('wha_water_auth', 'true');
      }
    } catch {
      // ignore
    }
    showToast('เข้าสู่ระบบสำเร็จ ยินดีต้อนรับสู่ระบบติดตามการใช้น้ำ', 'success');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    try {
      sessionStorage.removeItem('wha_water_auth');
      localStorage.removeItem('wha_water_auth');
    } catch {
      // ignore
    }
    showToast('ออกจากระบบเรียบร้อยแล้ว', 'info');
  };

  const handleImportData = (
    mergedRecords: WaterRecord[],
    added: number,
    updated: number,
    skipped: number
  ) => {
    setData(mergedRecords);
    try {
      localStorage.setItem('water_records_v1', JSON.stringify(mergedRecords));
    } catch {
      // storage might be full for large payload, keep in memory state
    }

    const skipMsg = skipped > 0 ? `, ข้าม ${skipped} แถว (วันที่ไม่ถูกต้อง)` : '';
    showToast(`นำเข้าสำเร็จ: เพิ่มใหม่ ${added} รายการ, อัปเดต ${updated} รายการ${skipMsg}`, 'success');
  };

  const handleImportTotalizer = (
    newIntervals: HourlyIntervalRecord[],
    dailyAggregates: WaterRecord[],
    summaryMsg: string
  ) => {
    // 1. Merge intervals
    const intervalMap = new Map<string, HourlyIntervalRecord>(
      hourlyIntervals.map((i) => [i.id, i])
    );
    newIntervals.forEach((i) => {
      intervalMap.set(i.id, i);
    });
    const mergedIntervals = Array.from(intervalMap.values()).sort((a, b) =>
      a.startTimestamp.localeCompare(b.startTimestamp)
    );
    setHourlyIntervals(mergedIntervals);
    try {
      localStorage.setItem('hourly_records_v1', JSON.stringify(mergedIntervals));
    } catch {
      // storage might be full
    }

    // 2. Merge daily aggregates into general WaterRecord list
    const dataMap = new Map<string, WaterRecord>(data.map((d) => [d.date, { ...d }]));
    dailyAggregates.forEach((d) => {
      dataMap.set(d.date, d);
    });
    const mergedData = Array.from(dataMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    setData(mergedData);
    try {
      localStorage.setItem('water_records_v1', JSON.stringify(mergedData));
    } catch {
      // ignore
    }

    // 3. Navigate to hourly view so user sees computed results immediately
    setActiveView('hourly');
  };

  if (!isAuthenticated) {
    return (
      <>
        <LoginGate onSuccess={handleLoginSuccess} />
        <Toast toast={toast} onClose={() => setToast(null)} />
      </>
    );
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[#0F1117] text-slate-300 font-sans">
      <Sidebar
        activeView={activeView}
        onSelectView={setActiveView}
        totalRecords={data.length}
        onLogout={handleLogout}
      />

      <main className="flex-1 min-w-0 flex flex-col bg-[#0F1117] overflow-y-auto">
        <Topbar
          activeView={activeView}
          onImportData={handleImportData}
          onImportTotalizer={handleImportTotalizer}
          data={data}
          showToast={showToast}
          onLogout={handleLogout}
        />

        <div className="flex-1">
          {activeView === 'dashboard' && <DashboardView data={data} />}
          {activeView === 'hourly' && (
            <HourlyFlowView
              intervals={hourlyIntervals}
              initialSelectedDate={selectedHourlyDate}
              onImportTotalizer={handleImportTotalizer}
              showToast={showToast}
            />
          )}
          {activeView === 'daily' && (
            <DailyView
              data={data}
              onSelectHourly={(d) => {
                setSelectedHourlyDate(d);
                setActiveView('hourly');
              }}
            />
          )}
          {activeView === 'monthly' && <MonthlyView data={data} />}
          {activeView === 'yearly' && <YearlyView data={data} showToast={showToast} />}
        </div>
      </main>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
