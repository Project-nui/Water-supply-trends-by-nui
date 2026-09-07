import React, { useEffect } from 'react';
import { ToastMessage } from '../types';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

interface ToastProps {
  toast: ToastMessage | null;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onClose();
    }, 4500);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  const borderLeftColor =
    toast.type === 'error'
      ? 'border-l-rose-500'
      : toast.type === 'info'
      ? 'border-l-blue-500'
      : 'border-l-emerald-500';

  return (
    <div
      id="app-toast"
      className={`fixed bottom-6 right-6 bg-[#161922] border border-white/10 border-l-4 ${borderLeftColor} p-4 pr-5 rounded-xl text-xs text-white max-w-sm shadow-2xl z-50 flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200 backdrop-blur-md`}
    >
      <div className="shrink-0 mt-0.5">
        {toast.type === 'error' ? (
          <AlertCircle className="w-4 h-4 text-rose-400" />
        ) : toast.type === 'info' ? (
          <Info className="w-4 h-4 text-blue-400" />
        ) : (
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        )}
      </div>

      <div className="flex-1 leading-snug font-medium text-slate-200">{toast.message}</div>

      <button
        type="button"
        onClick={onClose}
        className="shrink-0 text-slate-400 hover:text-white transition-colors ml-1 p-0.5 cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
