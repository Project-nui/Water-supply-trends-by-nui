import React from 'react';
import { ActiveView } from '../types';
import { Activity, Calendar, Clock, BarChart3, TrendingUp, LogOut, Code2 } from 'lucide-react';

interface SidebarProps {
  activeView: ActiveView;
  onSelectView: (view: ActiveView) => void;
  totalRecords: number;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  totalRecords,
  onLogout,
}) => {
  return (
    <aside
      id="app-sidebar"
      className="w-full md:w-64 shrink-0 bg-[#11141D] border-b md:border-b-0 md:border-r border-white/5 flex flex-col p-5 md:p-6 justify-between"
    >
      <div>
        {/* Brand header */}
        <div id="brand-header" className="flex items-center gap-3 pb-5 border-b border-white/5 mb-6">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white shadow-md text-sm shrink-0">
            W
          </div>
          <div className="min-w-0">
            <div className="text-white font-semibold tracking-tight text-[15px] leading-tight truncate">
              ระบบติดตามน้ำ
            </div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mt-0.5 truncate">
              PWP / CWP Telemetry
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-3 px-3">
            เมนูระบบ / MENU
          </p>
          <nav id="sidebar-nav" className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
            <button
              id="nav-btn-dashboard"
              type="button"
              onClick={() => onSelectView('dashboard')}
              className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg text-sm transition-all whitespace-nowrap text-left border cursor-pointer ${
                activeView === 'dashboard'
                  ? 'bg-blue-600/15 text-blue-300 border-blue-500/30 font-medium shadow-sm ring-1 ring-blue-500/20'
                  : 'text-slate-400 border-transparent hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Activity className="w-4 h-4 shrink-0 text-blue-400" />
                <span>ภาพรวม (Dashboard)</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                KPI
              </span>
            </button>

            <button
              id="nav-btn-hourly"
              type="button"
              onClick={() => onSelectView('hourly')}
              className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg text-sm transition-all whitespace-nowrap text-left border cursor-pointer ${
                activeView === 'hourly'
                  ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30 font-medium shadow-sm ring-1 ring-cyan-500/20'
                  : 'text-slate-400 border-transparent hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 shrink-0 text-cyan-400" />
                <span>การไหลรายชั่วโมง (Hourly Flow)</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                3 Tags
              </span>
            </button>

            <button
              id="nav-btn-daily"
              type="button"
              onClick={() => onSelectView('daily')}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm transition-all whitespace-nowrap text-left border cursor-pointer ${
                activeView === 'daily'
                  ? 'bg-blue-600/10 text-blue-400 border-blue-600/20 font-medium shadow-sm'
                  : 'text-slate-400 border-transparent hover:bg-white/5 hover:text-white'
              }`}
            >
              <Calendar className="w-4 h-4 shrink-0 text-amber-400" />
              <span>รายวัน (Daily)</span>
            </button>

            <button
              id="nav-btn-monthly"
              type="button"
              onClick={() => onSelectView('monthly')}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm transition-all whitespace-nowrap text-left border cursor-pointer ${
                activeView === 'monthly'
                  ? 'bg-blue-600/10 text-blue-400 border-blue-600/20 font-medium shadow-sm'
                  : 'text-slate-400 border-transparent hover:bg-white/5 hover:text-white'
              }`}
            >
              <BarChart3 className="w-4 h-4 shrink-0 text-purple-400" />
              <span>รายเดือน (Monthly)</span>
            </button>

            <button
              id="nav-btn-yearly"
              type="button"
              onClick={() => onSelectView('yearly')}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm transition-all whitespace-nowrap text-left border cursor-pointer ${
                activeView === 'yearly'
                  ? 'bg-blue-600/10 text-blue-400 border-blue-600/20 font-medium shadow-sm'
                  : 'text-slate-400 border-transparent hover:bg-white/5 hover:text-white'
              }`}
            >
              <TrendingUp className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>เทียบปีต่อปี (Yearly / YoY)</span>
            </button>

            {onLogout && (
              <button
                id="nav-btn-logout"
                type="button"
                onClick={onLogout}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm transition-all whitespace-nowrap text-left border border-transparent text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer mt-2"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>ออกจากระบบ (Lock)</span>
              </button>
            )}
          </nav>
        </div>
      </div>

      {/* Feature banner & footer status */}
      <div id="sidebar-footer" className="flex flex-col gap-3 pt-4 md:pt-6 border-t md:border-t-0 border-white/5 mt-3 md:mt-0">
        {/* Developer Credit Box */}
        <div
          id="developer-credit-box"
          className="p-3 bg-white/[0.04] hover:bg-white/[0.06] border border-white/10 rounded-xl transition-colors"
        >
          <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-semibold uppercase tracking-wider mb-1">
            <Code2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>Developer</span>
          </div>
          <p className="text-xs font-medium text-slate-200 pl-5 leading-snug">
            Developer by Thawatchai ENG Team
          </p>
        </div>

        <div className="hidden md:block p-4 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-xl shadow-lg border border-white/10">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <p className="text-white text-xs font-bold">บันทึกข้อมูลเรียลไทม์</p>
          </div>
          <p className="text-white/80 text-[11px] leading-relaxed">
            พร้อมข้อมูลสะสม {totalRecords.toLocaleString()} รายการ ซิงค์ข้อมูลล่าสุดอัตโนมัติ
          </p>
        </div>

        <div className="hidden md:flex items-center justify-between px-1 text-[11px] text-slate-500 font-medium">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>SYSTEM ACTIVE</span>
          </span>
          <span id="dataset-status-text" className="font-mono text-slate-400">{totalRecords.toLocaleString()} ROWS</span>
        </div>
      </div>
    </aside>
  );
};
