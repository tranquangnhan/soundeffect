
import React from 'react';

interface ConfirmModalProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ title, message, onConfirm, onCancel }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel}></div>
      <div className="bg-ios-surface2 border border-white/10 rounded-2xl w-full max-w-sm p-6 relative z-10 shadow-2xl animate-[pulse_0.2s_ease-out]">
        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
        <p className="text-ios-gray mb-6 text-sm leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button 
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl font-semibold bg-white/5 hover:bg-white/10 text-white transition-colors"
          >
            Hủy
          </button>
          <button 
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 rounded-xl font-semibold bg-ios-blue hover:bg-ios-blueHighlight text-white shadow-lg shadow-blue-500/20 transition-colors"
          >
            Đồng ý
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
