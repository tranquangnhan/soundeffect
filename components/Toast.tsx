
import React, { useEffect } from 'react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type = 'info', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColors = {
    success: 'bg-green-500/90 text-white',
    error: 'bg-red-500/90 text-white',
    info: 'bg-ios-surface2 text-white border border-white/10',
  };

  return (
    <div className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-full shadow-2xl backdrop-blur-md z-50 flex items-center gap-3 animate-[float_0.3s_ease-out] ${bgColors[type]}`}>
      <span className="text-lg">
        {type === 'success' && '✅'}
        {type === 'error' && '⚠️'}
        {type === 'info' && 'ℹ️'}
      </span>
      <span className="font-medium text-sm">{message}</span>
    </div>
  );
};

export default Toast;
