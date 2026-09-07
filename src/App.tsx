/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { ActiveView, WaterRecord, ToastMessage } from './types';
import { INITIAL_DATA } from './data';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { DashboardView } from './components/DashboardView';
import { DailyView } from './components/DailyView';
import { MonthlyView } from './components/MonthlyView';
import { YearlyView } from './components/YearlyView';
import { Toast } from './components/Toast';
import { LoginGate } from './components/LoginGate';

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
          data={data}
          showToast={showToast}
          onLogout={handleLogout}
        />

        <div className="flex-1">
          {activeView === 'dashboard' && <DashboardView data={data} />}
          {activeView === 'daily' && <DailyView data={data} />}
          {activeView === 'monthly' && <MonthlyView data={data} />}
          {activeView === 'yearly' && <YearlyView data={data} showToast={showToast} />}
        </div>
      </main>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
