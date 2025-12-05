
import React, { useState } from 'react';

const SupportWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  // VietQR API Link construction based on user's image
  // BIDV - 8804021459 - TRAN LE BAO TRUC
  const qrUrl = "https://img.vietqr.io/image/BIDV-8804021459-compact2.jpg?addInfo=Donate%20SFX%20Studio&accountName=TRAN%20LE%20BAO%20TRUC";

  return (
    <div className="fixed bottom-[90px] md:bottom-8 right-4 md:right-8 z-40 flex flex-col items-end pointer-events-none font-sans">
      
      {/* Popup Content */}
      <div 
        className={`
          pointer-events-auto transition-all duration-300 origin-bottom-right transform 
          ${isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-90 opacity-0 translate-y-10 pointer-events-none'}
        `}
      >
         <div className="bg-ios-surface2/90 backdrop-blur-xl border border-white/10 p-5 rounded-2xl shadow-2xl w-72 mb-4">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
               <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-yellow-400 to-orange-500 flex items-center justify-center text-xl shadow-lg shadow-orange-500/20">
                 ☕
               </div>
               <div>
                 <h3 className="font-bold text-white text-[15px]">Buy me a coffee</h3>
                 <p className="text-[10px] text-ios-gray">Support Developer</p>
               </div>
            </div>

            {/* Motivational Message */}
            <div className="bg-white/5 rounded-xl p-3 mb-4 border border-white/5">
              <p className="text-sm text-ios-gray italic leading-relaxed text-center">
                 "Chúc bạn một ngày edit thật năng suất, nhẹ nhàng và đầy cảm hứng! 🎧✨"
              </p>
            </div>

            {/* QR Code Container */}
            <div className="bg-white p-3 rounded-xl shadow-inner relative overflow-hidden group">
               <img
                 src={qrUrl}
                 alt="Donate QR Code"
                 className="w-full h-auto rounded-lg mix-blend-multiply"
                 loading="lazy"
               />
               <div className="absolute inset-0 flex items-center justify-center bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <span className="bg-white/90 text-black text-[10px] font-bold px-2 py-1 rounded shadow-sm">Scan with App</span>
               </div>
            </div>
            
            <p className="text-[10px] text-center text-gray-500 mt-2">
               TRAN LE BAO TRUC • BIDV
            </p>
         </div>
      </div>

      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          pointer-events-auto w-12 h-12 md:w-14 md:h-14 rounded-full shadow-lg flex items-center justify-center text-2xl md:text-3xl 
          transition-all duration-300 hover:scale-110 active:scale-95
          ${isOpen 
            ? 'bg-ios-surface2 text-white rotate-45 border border-white/10' 
            : 'bg-gradient-to-tr from-pink-500 to-rose-600 text-white shadow-rose-500/40 animate-bounce'
          }
        `}
        style={{ animationDuration: '3s' }} // Slower bounce
      >
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : '☕'}
      </button>
    </div>
  );
};

export default SupportWidget;
