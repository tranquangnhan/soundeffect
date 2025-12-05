
import React, { useState, useEffect } from 'react';

interface Step {
  targetId: string;
  title: string;
  description: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

interface TourProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const TOUR_STEPS: Step[] = [
  {
    targetId: 'welcome-center',
    title: 'Chào mừng đến SFX Studio! 👋',
    description: 'Trình quản lý âm thanh thông minh dành cho Video Editor. Hãy dạo một vòng nhé!',
    placement: 'center'
  },
  {
    targetId: 'tour-sidebar',
    title: 'Thanh điều hướng',
    description: 'Truy cập Thư viện, Tách nhạc từ video và Tìm kiếm Web tại đây.',
    placement: 'right'
  },
  {
    targetId: 'tour-search-bar',
    title: 'Smart Search 🔍',
    description: 'Tìm kiếm theo ngữ nghĩa tiếng Việt. Ví dụ: "âm thanh cháy nổ", "tiếng bước chân".',
    placement: 'bottom'
  },
  {
    targetId: 'tour-magic-scan-desktop',
    title: 'Magic Scan ✨',
    description: 'Dùng AI để tự động nghe, đặt tên lại và phân loại toàn bộ file chưa có nhãn.',
    placement: 'right'
  },
  {
    targetId: 'tour-categories',
    title: 'Danh mục',
    description: 'Kéo thả âm thanh vào đây để phân loại nhanh.',
    placement: 'right'
  }
];

const Tour: React.FC<TourProps> = ({ isOpen, onClose, onComplete }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const currentStep = TOUR_STEPS[currentStepIndex];

  useEffect(() => {
    if (!isOpen) return;

    const updateRect = () => {
      if (currentStep.placement === 'center') {
        setTargetRect(null);
        return;
      }

      const element = document.getElementById(currentStep.targetId);
      if (element) {
        // If element is hidden (e.g. mobile view for desktop sidebar), skip or center
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
           setTargetRect(null); // Fallback to center
        } else {
           setTargetRect(rect);
        }
      } else {
        setTargetRect(null);
      }
    };

    updateRect();
    window.addEventListener('resize', updateRect);
    // Slight delay to allow UI to settle
    const timer = setTimeout(updateRect, 300);

    return () => {
      window.removeEventListener('resize', updateRect);
      clearTimeout(timer);
    };
  }, [currentStepIndex, isOpen, currentStep]);

  const handleNext = () => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  // Calculate Tooltip Position
  const getTooltipStyle = (): React.CSSProperties => {
    // 1. Center Position (Default or fallback)
    if (!targetRect || currentStep.placement === 'center') {
        return {
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            position: 'fixed'
        };
    }

    const gap = 20;
    const cardWidth = 350; // Estimate card width
    const cardHeight = 200; // Estimate card height
    let top = 0;
    let left = 0;

    // 2. Right Position (e.g., Sidebar)
    if (currentStep.placement === 'right') {
        left = targetRect.right + gap;
        
        // Logic for vertical alignment
        if (targetRect.height > window.innerHeight * 0.8) {
             // If target is huge (like Sidebar), pin to top area
             top = 100; 
        } else {
             // Center vertically relative to target
             top = targetRect.top + (targetRect.height / 2) - (cardHeight / 2);
        }
    } 
    // 3. Bottom Position (e.g., Search Bar)
    else {
        top = targetRect.bottom + gap;
        left = targetRect.left + (targetRect.width / 2) - (cardWidth / 2);
    }

    // 4. Boundary Checks (Keep inside screen)
    // Horizontal check
    if (left + cardWidth > window.innerWidth) {
        left = window.innerWidth - cardWidth - 20;
    }
    if (left < 20) left = 20;

    // Vertical check
    if (top + cardHeight > window.innerHeight) {
        // If it goes off bottom, flip to top or pin to bottom
        top = window.innerHeight - cardHeight - 20;
    }
    if (top < 20) top = 20;

    return {
        position: 'absolute',
        top: top,
        left: left,
        width: '350px' // Enforce width for calculation consistency
    };
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden">
      {/* Background Mask */}
      <div className="absolute inset-0 bg-black/60 transition-colors duration-500" />

      {/* Spotlight Effect (Clip Path) */}
      {targetRect && (
        <div 
            className="absolute bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.7)] rounded-xl pointer-events-none transition-all duration-500 ease-in-out border-2 border-ios-blue/50 box-content"
            style={{
                top: targetRect.top - 5,
                left: targetRect.left - 5,
                width: targetRect.width + 10,
                height: targetRect.height + 10,
            }}
        />
      )}

      {/* Tooltip Card */}
      <div 
        className="absolute w-full h-full pointer-events-none top-0 left-0"
      >
         <div 
            className="pointer-events-auto bg-ios-surface2/95 backdrop-blur-xl border border-white/10 p-6 rounded-2xl shadow-2xl animate-[float_4s_ease-in-out_infinite] transition-all duration-500"
            style={getTooltipStyle()}
         >
            <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-ios-blue uppercase tracking-widest">
                    Step {currentStepIndex + 1}/{TOUR_STEPS.length}
                </span>
                <button onClick={handleSkip} className="text-ios-gray hover:text-white text-xs">
                    Bỏ qua
                </button>
            </div>
            
            <h3 className="text-xl font-bold text-white mb-2">{currentStep.title}</h3>
            <p className="text-ios-gray text-sm leading-relaxed mb-6">
                {currentStep.description}
            </p>

            <div className="flex justify-end gap-3">
                <button 
                    onClick={handleNext}
                    className="bg-ios-blue hover:bg-ios-blueHighlight text-white px-5 py-2 rounded-xl text-sm font-semibold shadow-lg shadow-blue-900/30 transition-all active:scale-95"
                >
                    {currentStepIndex === TOUR_STEPS.length - 1 ? 'Hoàn tất' : 'Tiếp tục →'}
                </button>
            </div>
         </div>
      </div>
    </div>
  );
};

export default Tour;