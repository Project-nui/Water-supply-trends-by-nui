import React, { useState } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck, Droplets, AlertCircle, ArrowRight } from 'lucide-react';

interface LoginGateProps {
  onSuccess: (remember: boolean) => void;
}

export const LoginGate: React.FC<LoginGateProps> = ({ onSuccess }) => {
  const [passcode, setPasscode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(false);
    setErrorMessage('');
    setIsSubmitting(true);

    setTimeout(() => {
      if (passcode.trim() === 'wha1234') {
        onSuccess(rememberMe);
      } else {
        setError(true);
        setErrorMessage('รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบรหัสผ่านอีกครั้ง');
        setIsSubmitting(false);
      }
    }, 250);
  };

  return (
    <div
      id="login-gate-screen"
      className="min-h-screen w-full bg-[#0F1117] flex items-center justify-center p-4 sm:p-6 relative overflow-hidden"
    >
      {/* Subtle Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-purple-600/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md bg-[#161922] border border-white/10 rounded-2xl shadow-2xl overflow-hidden relative z-10">
        {/* Header Visual Bar */}
        <div className="p-6 md:p-8 bg-[#1C202B] border-b border-white/5 text-center relative">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-4 shadow-lg shadow-blue-600/10">
            <Droplets className="w-7 h-7" />
          </div>

          <div className="inline-flex items-center gap-1.5 bg-blue-600/10 border border-blue-600/20 px-3 py-1 rounded-full text-blue-400 text-[11px] font-medium tracking-wide mb-2">
            <Lock className="w-3 h-3" />
            <span>PROTECTED ACCESS GATE</span>
          </div>

          <h1 className="text-xl font-bold text-white tracking-tight">
            ระบบติดตามการใช้น้ำ WHA
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            กรุณาระบุรหัสผ่านเพื่อเข้าสู่ระบบแดชบอร์ด
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-5">
          {error && (
            <div
              id="login-error-alert"
              className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs animate-shake"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="passcode-input"
              className="block text-xs font-medium text-slate-300"
            >
              รหัสผ่านเข้าใช้งาน
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="passcode-input"
                type={showPassword ? 'text' : 'password'}
                autoFocus
                value={passcode}
                onChange={(e) => {
                  setPasscode(e.target.value);
                  if (error) setError(false);
                }}
                placeholder="ระบุรหัสผ่าน..."
                className={`w-full bg-white/5 border ${
                  error ? 'border-rose-500/60 focus:border-rose-500' : 'border-white/10 focus:border-blue-500'
                } text-white text-sm rounded-xl pl-10 pr-11 py-2.5 outline-none transition-colors font-mono tracking-wider placeholder:tracking-normal placeholder:text-slate-500`}
              />
              <button
                type="button"
                id="btn-toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                title={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                id="remember-checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded bg-white/5 border-white/10 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-blue-600"
              />
              <span>จดจำการเข้าสู่ระบบในอุปกรณ์นี้</span>
            </label>
          </div>

          <button
            type="submit"
            id="btn-login-submit"
            disabled={isSubmitting || !passcode.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-all shadow-lg shadow-blue-600/25 cursor-pointer"
          >
            <span>{isSubmitting ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="pt-2 border-t border-white/5 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>การเข้าถึงได้รับการคุ้มครองด้วยการตรวจสอบความปลอดภัย</span>
          </div>
        </form>

        {/* Developer Credit Footer */}
        <div className="py-2.5 px-6 bg-black/20 border-t border-white/5 text-center">
          <p className="text-[11px] text-slate-400 font-medium">
            Developer by <span className="text-blue-400">Thawatchai ENG Team</span>
          </p>
        </div>
      </div>
    </div>
  );
};
