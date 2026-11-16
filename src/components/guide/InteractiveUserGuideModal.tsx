import React, { useEffect, useState } from 'react';
import {
  X,
  Box,
  Layers,
  Compass,
  Sparkles,
  ArrowUpRight,
  MousePointerClick,
  Move,
  ZoomIn,
  MapPin,
} from 'lucide-react';
import { Language } from '../../i18n/types';

interface InteractiveUserGuideModalProps {
  isOpen: boolean;
  lang: Language;
  onClose: () => void;
  onTry3D: () => void;
  onTryExplore: () => void;
  onOpenMap: () => void;
  onOpenEdTech: () => void;
}

interface GuideCopy {
  eyebrow: string;
  title: string;
  subtitle: string;
  cards: {
    num: string;
    title: string;
    body: string;
    highlights: string[];
    actionLabel: string;
  }[];
  controlsTitle: string;
  controls: {
    icon: 'left' | 'right' | 'zoom' | 'pin';
    badge: string;
    gesture: string;
    action: string;
  }[];
  primaryCta: string;
}

const GUIDE_CONTENT: Record<Language, GuideCopy> = {
  vi: {
    eyebrow: 'CẨM NANG TRẢI NGHIỆM SỐ',
    title: 'Hướng dẫn Khám phá Dấu Ấn Việt 3D',
    subtitle:
      'Làm chủ toàn bộ hệ sinh thái Bảo tàng Số 3D, Bản đồ Thành cổ 1815, Thuyết minh AR và Trợ lý Gemini AI chỉ trong 30 giây.',
    cards: [
      {
        num: '01',
        title: 'Điều khiển Không gian 3D & Nội thất',
        body: 'Xoay tự do 360°, thu phóng sát từng chi tiết hoa văn và dùng thanh công cụ kính mờ dưới đáy để chuyển đổi giữa các lớp hiển thị giải phẫu kiến trúc:',
        highlights: ['Nguyên bản', 'Bóc tách 3D (Exploded View)', 'X-Ray xuyên thấu', 'Xem Nội thất thật'],
        actionLabel: 'Thử ngay trong Không gian 3D ↗',
      },
      {
        num: '02',
        title: 'Cuộn Kể chuyện (Scrollytelling) & Xưa – Nay',
        body: 'Ngay trên trang Khám phá, cuộn chuột từ từ để chiêm ngưỡng công trình tự động tách lớp theo từng nhịp kiến trúc, đồng thời kéo thanh đối chiếu trực quan:',
        highlights: ['Cuộn 240vh tách lớp 3D', 'So sánh Xưa & Nay', 'Ảnh thực tế Wikimedia'],
        actionLabel: 'Trải nghiệm Cuộn 3D ↗',
      },
      {
        num: '03',
        title: 'Bản đồ Liên vùng & Thấu kính Cổ 1815',
        body: 'Bật Thấu kính Xuyên Không trên bản đồ số liên vùng TP.HCM – Bình Dương – BRVT để soi trực tiếp mặt bằng Thành Bát Quái 1815 chồng lên đô thị vệ tinh hôm nay:',
        highlights: ['Thấu kính Xuyên Không 1815', '7 Tuyến Di sản Liên vùng', 'Lớp Tư liệu GIS'],
        actionLabel: 'Mở Bản đồ ↗',
      },
      {
        num: '04',
        title: 'Trợ lý Gemini AI, Thuyết minh & Vé QR',
        body: 'Mở Trợ lý Giám tuyến AI để hỏi đáp kiến trúc – lịch sử tức thì, bật giọng đọc thuyết minh 3 thứ tiếng VI/EN/ZH và trải nghiệm đặt vé, nhận Hộ chiếu Di sản QR:',
        highlights: ['Trợ lý Giám tuyến AI', 'Audio & AR 3 ngôn ngữ', 'Vé & Học liệu QR'],
        actionLabel: 'Mở Vé & Học liệu ↗',
      },
    ],
    controlsTitle: 'TÓM TẮT THAO TÁC CHUỘT & CẢM ỨNG',
    controls: [
      {
        icon: 'left',
        badge: '🖱️',
        gesture: 'Chuột trái / 1 ngón',
        action: 'Xoay 360° quanh di tích',
      },
      {
        icon: 'right',
        badge: '🖱️',
        gesture: 'Chuột phải / 2 ngón',
        action: 'Di chuyển góc nhìn (Pan)',
      },
      {
        icon: 'zoom',
        badge: '⚙️',
        gesture: 'Con lăn / Chụm ngón',
        action: 'Phóng to chi tiết kiến trúc',
      },
      {
        icon: 'pin',
        badge: '📍',
        gesture: 'Chạm ghim số / Điểm nhấn',
        action: 'Bay camera tới từng phòng & nghe thuyết minh',
      },
    ],
    primaryCta: '✦ Bắt đầu Hành trình Khám phá (Tự động mở Không gian 3D)',
  },
  en: {
    eyebrow: 'DIGITAL EXPERIENCE GUIDE',
    title: 'Guide to Exploring Dấu Ấn Việt 3D',
    subtitle:
      'Master the 3D Spatial Museum, 1815 Citadel Spyglass Map, Trilingual AR Audio, and Gemini AI Curator in 30 seconds.',
    cards: [
      {
        num: '01',
        title: '3D Spatial Controls & Real Interiors',
        body: 'Orbit 360° freely, zoom into architectural ornaments, and use the bottom frosted VisionOS dock to switch seamlessly between structural inspection modes:',
        highlights: ['Original', 'Exploded View 3D', 'X-Ray Cutaway', 'Interior Tour'],
        actionLabel: 'Try in 3D Space ↗',
      },
      {
        num: '02',
        title: 'Scrollytelling & Past–Present Split',
        body: 'On the Explore view, scroll smoothly to watch the monument separate layer-by-layer across 3 architectural beats, or drag the Lisboa-style Before & After slider:',
        highlights: ['Scroll Layer Choreography', 'Before & After Split', 'Real Wikimedia Photos'],
        actionLabel: 'Explore Scrollytelling ↗',
      },
      {
        num: '03',
        title: 'Regional GIS Map & 1815 Spyglass Lens',
        body: 'Activate the 1815 Spyglass Lens across HCMC – Bình Dương – BRVT to inspect the historic 1815 Octagonal Citadel overlaid onto modern satellite streets and 7 routes:',
        highlights: ['1815 Spyglass Lens', '7 Inter-regional Routes', 'GIS Historical Layers'],
        actionLabel: 'Open Map ↗',
      },
      {
        num: '04',
        title: 'Gemini AI Curator, Audio & QR Pass',
        body: 'Consult the Gemini AI Curator for instant architectural & historical Q&A, listen to VI/EN/ZH narration, and preview QR Heritage Passes in Tickets & EdTech:',
        highlights: ['Gemini AI Curator', 'Trilingual Audio & AR', 'Tickets & QR EdTech'],
        actionLabel: 'Open Tickets & EdTech ↗',
      },
    ],
    controlsTitle: 'MOUSE & TOUCH QUICK REFERENCE',
    controls: [
      {
        icon: 'left',
        badge: '🖱️',
        gesture: 'Left Click / 1 Finger',
        action: 'Orbit 360° around the monument',
      },
      {
        icon: 'right',
        badge: '🖱️',
        gesture: 'Right Click / 2 Fingers',
        action: 'Pan across spatial camera view',
      },
      {
        icon: 'zoom',
        badge: '⚙️',
        gesture: 'Scroll Wheel / Pinch',
        action: 'Zoom into architectural details',
      },
      {
        icon: 'pin',
        badge: '📍',
        gesture: 'Tap Numbered Pins',
        action: 'Fly camera to rooms & play audio guide',
      },
    ],
    primaryCta: '✦ Start Exploring Journey (Launch 3D Space)',
  },
  zh: {
    eyebrow: '数字体验指南',
    title: 'Dấu Ấn Việt 3D 探索使用指南',
    subtitle:
      '30 秒快速掌握 3D 立体建筑空间、1815 八卦城透视地图、三语语音导览与 Gemini AI 策展人。',
    cards: [
      {
        num: '01',
        title: '3D 空间操控与真实室内结构',
        body: '自由 360° 旋转并缩放细节，通过底部 VisionOS 悬浮控制栏在多种建筑解剖模式之间流畅切换：',
        highlights: ['原始外观', '3D 结构拆解', 'X 光透视模式', '真实室内浏览'],
        actionLabel: '立即体验 3D 空间 ↗',
      },
      {
        num: '02',
        title: '滚动叙事 (Scrollytelling) 与古今对比',
        body: '在“探索”首页向下滚动即可观看建筑按结构层次逐段拆解，并可使用斜向滑块即时对比历史旧照与实景照片：',
        highlights: ['滚动分层叙事', '古今对比拉幕', 'Wikimedia 实景摄影'],
        actionLabel: '体验滚动叙事 ↗',
      },
      {
        num: '03',
        title: '跨区域 GIS 地图与 1815 古城透视镜',
        body: '在胡志明市—平阳—巴地头顿联区地图开启“1815 八卦城透视镜”，直观叠加查看嘉定古城历史布局与 7 条主题路线：',
        highlights: ['1815 八卦城透视镜', '7 条跨区域路线', 'GIS 历史图层'],
        actionLabel: '打开地图 ↗',
      },
      {
        num: '04',
        title: 'Gemini AI 策展人、导览与二维码通票',
        body: '打开 AI 历史策展人实时提问，启用越/英/中三语语音与 AR 导览，并在“门票与教材”专区体验电子通票与二维码遗产护照：',
        highlights: ['Gemini AI 策展人', '三语语音与 AR', '二维码通票与教材'],
        actionLabel: '打开门票与教材 ↗',
      },
    ],
    controlsTitle: '鼠标与触控快捷操作指南',
    controls: [
      {
        icon: 'left',
        badge: '🖱️',
        gesture: '鼠标左键 / 单指拖动',
        action: '360° 环绕古迹旋转观察',
      },
      {
        icon: 'right',
        badge: '🖱️',
        gesture: '鼠标右键 / 双指拖动',
        action: '平移视角 (Pan)',
      },
      {
        icon: 'zoom',
        badge: '⚙️',
        gesture: '滚轮 / 双指捏合',
        action: '放大查看建筑细节',
      },
      {
        icon: 'pin',
        badge: '📍',
        gesture: '点击编号锚点',
        action: '镜头飞抵各展厅并收听讲解',
      },
    ],
    primaryCta: '✦ 开启探索之旅（自动进入 3D 空间）',
  },
};

export const InteractiveUserGuideModal: React.FC<InteractiveUserGuideModalProps> = ({
  isOpen,
  lang,
  onClose,
  onTry3D,
  onTryExplore,
  onOpenMap,
  onOpenEdTech,
}) => {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setEntered(false);
      return;
    }
    const raf = requestAnimationFrame(() => setEntered(true));
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const copy = GUIDE_CONTENT[lang] || GUIDE_CONTENT.vi;

  const cardIcons = [
    <Box key="box" className="w-4 h-4 text-[#C5A059]" />,
    <Layers key="layers" className="w-4 h-4 text-[#C5A059]" />,
    <Compass key="compass" className="w-4 h-4 text-[#C5A059]" />,
    <Sparkles key="sparkles" className="w-4 h-4 text-[#C5A059]" />,
  ];

  const cardHandlers = [onTry3D, onTryExplore, onOpenMap, onOpenEdTech];

  const renderControlIcon = (type: 'left' | 'right' | 'zoom' | 'pin') => {
    switch (type) {
      case 'left':
        return <MousePointerClick className="w-4 h-4 text-[#C5A059] shrink-0" />;
      case 'right':
        return <Move className="w-4 h-4 text-[#C5A059] shrink-0" />;
      case 'zoom':
        return <ZoomIn className="w-4 h-4 text-[#C5A059] shrink-0" />;
      case 'pin':
        return <MapPin className="w-4 h-4 text-[#C5A059] shrink-0" />;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={copy.title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-xl overflow-y-auto transition-opacity duration-300 ${
        entered ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ wordSpacing: '1.5px' }}
        className={`max-w-4xl w-full rounded-[32px] bg-[#161618]/95 backdrop-blur-2xl border border-white/[0.1] shadow-[0_30px_90px_rgba(0,0,0,0.85)] p-5 sm:p-8 z-50 text-[#F5F5F7] my-auto tracking-normal transition-all duration-300 ease-out ${
          entered ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-3'
        }`}
      >
        {/* MODAL HEADER */}
        <div className="flex items-start justify-between gap-4 pb-5 border-b border-white/[0.08]">
          <div className="space-y-1.5 text-left">
            <span className="inline-block text-xs font-medium text-[#C5A059]">
              {copy.eyebrow}
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-semibold tracking-normal text-[#F5F5F7] leading-tight">
              {copy.title}
            </h2>
            <p className="text-xs sm:text-sm text-[#86868B] max-w-2xl leading-relaxed">
              {copy.subtitle}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={lang === 'en' ? 'Close' : lang === 'zh' ? '关闭' : 'Đóng'}
            className="w-9 h-9 rounded-full bg-white/[0.06] border border-white/[0.12] hover:border-[#C5A059] hover:bg-white/[0.12] text-[#F5F5F7] flex items-center justify-center transition-all shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2x2 APPLE TIPS BENTO GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-5">
          {copy.cards.map((card, idx) => (
            <div
              key={card.num}
              className="bg-[#1D1D1F] rounded-[22px] border border-white/[0.06] hover:border-[#C5A059]/40 p-5 transition-all flex flex-col justify-between gap-4 text-left"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-[#C5A059]/12 border border-[#C5A059]/30 flex items-center justify-center">
                      {cardIcons[idx]}
                    </span>
                    <span className="font-sans text-xs font-semibold tabular-nums text-[#C5A059]">
                      {card.num}
                    </span>
                  </div>
                </div>

                <h3 className="text-[15px] sm:text-base font-semibold text-[#F5F5F7] leading-snug">
                  {card.title}
                </h3>

                <p className="text-xs text-[#A1A1A6] leading-relaxed">
                  {card.body}
                </p>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {card.highlights.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-[10.5px] text-[#F5F5F7]/90"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
                <button
                  type="button"
                  onClick={cardHandlers[idx]}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#C5A059] hover:text-[#E8CA68] transition-colors cursor-pointer"
                >
                  <span>{card.actionLabel.replace(' ↗', '')}</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* MOUSE & TOUCH QUICK REFERENCE STRIP */}
        <div className="mt-4 rounded-[22px] bg-black/40 border border-white/[0.08] p-4 text-left">
          <div className="text-xs font-medium text-[#86868B] mb-3">
            {copy.controlsTitle}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {copy.controls.map((ctrl) => (
              <div
                key={ctrl.gesture}
                className="flex items-start gap-2.5 p-2.5 rounded-2xl bg-[#1D1D1F]/80 border border-white/[0.05]"
              >
                <div className="mt-0.5 flex items-center gap-1 shrink-0">
                  <span className="text-sm leading-none" aria-hidden="true">
                    {ctrl.badge}
                  </span>
                  {renderControlIcon(ctrl.icon)}
                </div>
                <div className="min-w-0">
                  <div className="text-[11.5px] font-semibold text-[#F5F5F7] leading-snug">
                    {ctrl.gesture}
                  </div>
                  <div className="text-[11px] text-[#86868B] leading-snug mt-0.5">
                    {ctrl.action}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FOOTER PRIMARY ACTION */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={onTry3D}
            className="w-full sm:w-auto px-6 py-3 rounded-full bg-[#C5A059] hover:bg-[#D4B06A] text-[#121110] font-semibold text-xs sm:text-[13px] shadow-[0_10px_30px_rgba(197,160,89,0.28)] transition-all cursor-pointer tracking-normal"
          >
            {copy.primaryCta}
          </button>
        </div>
      </div>
    </div>
  );
};
