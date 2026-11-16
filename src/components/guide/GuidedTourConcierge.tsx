import React from 'react';
import { HeritageSite } from '../../types/heritage';
import {
  GuidedTourRoute,
  ResolvedGuidedTour,
  getGuidedStopTip,
  getLocalizedGuidedRoute,
} from '../../data/guidedTours';
import { useI18n } from '../../i18n/I18nContext';
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Headphones,
  Lightbulb,
  Lock,
  MapPin,
  Star,
  Ticket,
  X,
} from 'lucide-react';

interface GuidedTourStarterSectionProps {
  tours: ResolvedGuidedTour[];
  isAuthenticated: boolean;
  masterpieceSite: HeritageSite | null;
  onStartTour: (tour: ResolvedGuidedTour) => void;
  onStartMasterpiece: () => void;
}

const HERITAGE_DOSSIER_BG_BY_INDEX = [
  'bg-[#A94F3D]',
  'bg-[#47796D]',
  'bg-[#526D8B]',
] as const;

export const GuidedTourStarterSection: React.FC<GuidedTourStarterSectionProps> = ({
  tours,
  isAuthenticated,
  masterpieceSite,
  onStartTour,
  onStartMasterpiece,
}) => {
  const { lang, getLocalizedSite } = useI18n();

  if (tours.length === 0 && !masterpieceSite) return null;

  const masterpieceShortName = masterpieceSite
    ? getLocalizedSite(masterpieceSite).officialName.split(/\s*[（(]/)[0].trim()
    : lang === 'en'
    ? 'Independence Palace'
    : lang === 'zh'
    ? '独立宫'
    : 'Dinh Độc Lập';

  const kickerLabel =
    lang === 'en'
      ? 'CURATED JOURNEYS  ·  EXHIBITION ITINERARIES'
      : lang === 'zh'
      ? '策展推荐路线  ·  主题游览指南'
      : 'HÀNH TRÌNH GIÁM TUYỂN  ·  LỘ TRÌNH THAM QUAN';

  const headingText =
    lang === 'en'
      ? 'First time visiting? Choose a curated itinerary tailored for you'
      : lang === 'zh'
      ? '首次到访？为您精选专属主题游览路线'
      : 'Lần đầu ghé thăm? Chọn hành trình gợi ý dành riêng cho bạn';

  const descriptionText =
    lang === 'en'
      ? 'Launch step-by-step guided exploration across landmark monuments, integrating 3D X-Ray dissection and synchronized audio narration.'
      : lang === 'zh'
      ? '启动分站式智能导览，穿越极具代表性的历史遗迹，融合3D X光透视拆解与自动语音讲解。'
      : 'Khởi động chế độ dẫn đường từng chặng qua các di tích tiêu biểu, tích hợp bóc tách 3D X-Ray và thuyết minh tự động.';

  const ctaLabel =
    lang === 'en'
      ? `Explore opening masterpiece: ${masterpieceShortName}`
      : lang === 'zh'
      ? `探索开篇杰作：${masterpieceShortName}`
      : `Khám phá kiệt tác mở màn: ${masterpieceShortName}`;

  const highlightPrefix =
    lang === 'en'
      ? 'Opening highlight:'
      : lang === 'zh'
      ? '开篇重点推荐：'
      : 'Điểm nhấn mở màn:';

  const highlightSuffix =
    lang === 'en'
      ? 'Fullscreen 3D architecture & synchronized audio narration'
      : lang === 'zh'
      ? '全屏 3D 建筑空间与同步语音导览'
      : 'Không gian 3D toàn màn hình & thuyết minh song hành';

  return (
    <section
      id="guided-tour-concierge"
      aria-label={headingText}
      className="rounded-sm bg-[#D8C9A9] text-[#171817] border border-[#171817]/[0.18] p-6 sm:p-10"
    >
      {/* 2-Column Asymmetric Exhibition Header */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-8 border-b border-[#171817]/15 items-end">
        <div className="lg:col-span-8">
          <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[#A94F3D] mb-2.5">
            {kickerLabel}
          </div>
          <h3 className="font-serif text-[32px] sm:text-[38px] font-normal leading-[1.18] tracking-tight text-[#171817]">
            {headingText}
          </h3>
          <p className="mt-3 text-[14.5px] leading-[1.65] text-[#171817]/75 max-w-2xl">
            {descriptionText}
          </p>
        </div>

        <div className="lg:col-span-4 lg:flex lg:justify-end">
          {masterpieceSite && (
            <button
              type="button"
              onClick={onStartMasterpiece}
              className="px-6 py-3.5 rounded-sm bg-[#171817] text-[#D8C9A9] text-[13.5px] font-medium hover:bg-[#A94F3D] transition-colors flex items-center gap-3 group cursor-pointer sm:whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171817]"
            >
              <span>{ctaLabel}</span>
              {!isAuthenticated && <Lock className="w-3.5 h-3.5 text-[#C9A46A] shrink-0" />}
              <span
                aria-hidden="true"
                className="transition-transform duration-200 group-hover:translate-x-1"
              >
                →
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Curatorial Sub-Line Directly Below Hairline */}
      {masterpieceSite && (
        <div className="py-3.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] text-[#171817]/70">
          <span>
            {highlightPrefix}{' '}
            <strong className="font-semibold text-[#171817]">{masterpieceShortName}</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>{highlightSuffix}</span>
        </div>
      )}

      {/* 3 Color-Blocked Heritage Dossiers */}
      {tours.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-7">
          {tours.map((item, idx) => {
            const { route, stops } = item;
            const localizedRoute = getLocalizedGuidedRoute(route, lang);
            const stopNames = stops.map((s) =>
              getLocalizedSite(s).officialName.split(/\s*[（(]/)[0].trim()
            );
            const bgClass =
              HERITAGE_DOSSIER_BG_BY_INDEX[idx % HERITAGE_DOSSIER_BG_BY_INDEX.length];

            const indexLabel =
              lang === 'en'
                ? `ROUTE 0${idx + 1}  ·  ${localizedRoute.durationShort}  ·  ${stops.length} STOPS`
                : lang === 'zh'
                ? `路线 0${idx + 1}  ·  ${localizedRoute.durationShort}  ·  ${stops.length} 站`
                : `TUYẾN 0${idx + 1}  ·  ${localizedRoute.durationShort}  ·  ${stops.length} CHẶNG`;

            const startLabel =
              lang === 'en' ? 'Start' : lang === 'zh' ? '开始' : 'Bắt đầu';

            return (
              <button
                key={route.id}
                type="button"
                onClick={() => onStartTour(item)}
                className={`${bgClass} rounded-sm p-7 flex flex-col justify-between min-h-[290px] cursor-pointer group transition-transform duration-300 hover:-translate-y-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171817]`}
              >
                <div>
                  <div className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[#C9A46A] tabular-nums">
                    {indexLabel}
                  </div>

                  <h4 className="font-serif text-[22px] leading-[1.28] text-[#D8C9A9] mt-2.5 font-normal">
                    {localizedRoute.editorialTitle}
                  </h4>

                  <p className="mt-3.5 text-[13.5px] leading-[1.65] text-[#D8C9A9]/85">
                    {stopNames.join(' → ')}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-[#D8C9A9]/20 flex items-center justify-between gap-3 w-full">
                  <span className="text-[12px] leading-[1.45] text-[#D8C9A9]/85">
                    {localizedRoute.theme}
                  </span>
                  <span className="text-[13px] font-semibold text-[#D8C9A9] group-hover:text-[#C9A46A] whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-colors">
                    {!isAuthenticated && (
                      <Lock className="w-3 h-3 text-[#C9A46A] shrink-0" />
                    )}
                    <span>{startLabel}</span>
                    <span
                      aria-hidden="true"
                      className="transition-transform duration-200 group-hover:translate-x-0.5"
                    >
                      →
                    </span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};

interface GuidedTourWelcomeModalProps {
  isOpen: boolean;
  visitorName: string;
  tours: ResolvedGuidedTour[];
  hasMasterpiece: boolean;
  onClose: () => void;
  onSelectTour: (tour: ResolvedGuidedTour) => void;
  onStartMasterpiece: () => void;
}

export const GuidedTourWelcomeModal: React.FC<GuidedTourWelcomeModalProps> = ({
  isOpen,
  visitorName,
  tours,
  hasMasterpiece,
  onClose,
  onSelectTour,
  onStartMasterpiece,
}) => {
  const { lang, getLocalizedSite } = useI18n();

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={
        lang === 'en'
          ? 'Choose a curated itinerary tailored for you'
          : lang === 'zh'
          ? '为您精选专属主题游览路线'
          : 'Chọn hành trình gợi ý dành riêng cho bạn'
      }
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-sm bg-[#D8C9A9] text-[#171817] border border-[#171817]/20 p-6 sm:p-8 space-y-6 my-auto animate-apple-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#171817]/15 pb-4">
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[#A94F3D] block">
              {lang === 'en'
                ? `WELCOME ${visitorName} TO DẤU ẤN VIỆT 3D`
                : lang === 'zh'
                ? `欢迎 ${visitorName} 来到越南印记 3D`
                : `CHÀO MỪNG ${visitorName} ĐẾN VỚI DẤU ẤN VIỆT 3D`}
            </span>
            <h3 className="font-serif text-2xl sm:text-3xl font-normal text-[#171817]">
              {lang === 'en'
                ? 'First time visiting? Choose a curated itinerary tailored for you'
                : lang === 'zh'
                ? '首次到访？为您精选专属主题游览路线'
                : 'Lần đầu ghé thăm? Chọn hành trình gợi ý dành riêng cho bạn'}
            </h3>
            <p className="text-xs sm:text-sm text-[#171817]/75">
              {lang === 'en'
                ? 'Step-by-step guided narration across 3D monument stations with X-Ray dissection, the 1815 map, and audio guides.'
                : lang === 'zh'
                ? '分站式 3D 古迹导览将带您深入探索 X 光透视剖面、1815 年历史地图与同步语音解说。'
                : 'Trợ lý dẫn đường sẽ đưa bạn đi qua từng chặng di tích 3D kèm mẹo tương tác X-Ray, Bản đồ 1815 và thuyết minh.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={lang === 'en' ? 'Close' : lang === 'zh' ? '关闭' : 'Đóng'}
            className="w-8 h-8 rounded-sm bg-[#171817]/10 hover:bg-[#171817] text-[#171817] hover:text-[#D8C9A9] flex items-center justify-center cursor-pointer shrink-0 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {tours.map((item, idx) => {
            const { route, stops } = item;
            const localizedRoute = getLocalizedGuidedRoute(route, lang);
            const bgClass =
              HERITAGE_DOSSIER_BG_BY_INDEX[idx % HERITAGE_DOSSIER_BG_BY_INDEX.length];

            return (
              <button
                key={route.id}
                type="button"
                onClick={() => onSelectTour(item)}
                className={`text-left rounded-sm ${bgClass} p-5 flex flex-col justify-between gap-4 transition-transform duration-200 hover:-translate-y-0.5 cursor-pointer group`}
              >
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[#C9A46A] tabular-nums">
                    {localizedRoute.durationShort} · {stops.length}{' '}
                    {lang === 'en' ? 'STOPS' : lang === 'zh' ? '站' : 'CHẶNG'}
                  </div>
                  <div className="font-serif text-lg text-[#D8C9A9] leading-snug">
                    {localizedRoute.editorialTitle}
                  </div>
                  <div className="text-xs text-[#D8C9A9]/85 leading-relaxed">
                    {stops
                      .map((s) => getLocalizedSite(s).officialName.split(/\s*[（(]/)[0].trim())
                      .join(' → ')}
                  </div>
                </div>
                <div className="text-xs font-semibold text-[#D8C9A9] group-hover:text-[#C9A46A] inline-flex items-center gap-1.5 pt-3 border-t border-[#D8C9A9]/20 transition-colors">
                  <span>
                    {lang === 'en'
                      ? 'Select itinerary'
                      : lang === 'zh'
                      ? '选择此路线'
                      : 'Chọn tuyến này'}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#171817]/15">
          {hasMasterpiece ? (
            <button
              type="button"
              onClick={onStartMasterpiece}
              className="px-5 py-3 rounded-sm bg-[#171817] hover:bg-[#A94F3D] text-[#D8C9A9] text-xs font-medium inline-flex items-center gap-2 cursor-pointer transition-colors"
            >
              <span>
                {lang === 'en'
                  ? 'Explore opening masterpiece'
                  : lang === 'zh'
                  ? '立即探索代表性杰作'
                  : 'Khám phá ngay kiệt tác tiêu biểu nhất'}
              </span>
              <span aria-hidden="true">→</span>
            </button>
          ) : (
            <span />
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-sm border border-[#171817]/25 hover:bg-[#171817]/10 text-xs font-medium text-[#171817] cursor-pointer transition-colors"
          >
            {lang === 'en'
              ? 'Explore on my own'
              : lang === 'zh'
              ? '稍后，我先自由浏览'
              : 'Để sau, tôi tự khám phá'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface GuidedTourProgressBarProps {
  route: GuidedTourRoute;
  stops: HeritageSite[];
  stepIndex: number;
  positionClassName: string;
  onNextStep: () => void;
  onOpenAudioGuide: (site: HeritageSite) => void;
  onExitTour: () => void;
}

export const GuidedTourProgressBar: React.FC<GuidedTourProgressBarProps> = ({
  route,
  stops,
  stepIndex,
  positionClassName,
  onNextStep,
  onOpenAudioGuide,
  onExitTour,
}) => {
  const { lang, getLocalizedSite } = useI18n();

  if (stops.length === 0) return null;

  const safeIndex = Math.min(Math.max(0, stepIndex), stops.length - 1);
  const currentStop = stops[safeIndex];
  const currentSiteName = getLocalizedSite(currentStop).officialName;
  const localizedRoute = getLocalizedGuidedRoute(route, lang);
  const isLastStep = safeIndex >= stops.length - 1;
  const progressPct = Math.round(((safeIndex + 1) / stops.length) * 100);
  const tipText = getGuidedStopTip(route, currentStop.id, lang);

  return (
    <aside
      aria-label={
        lang === 'en'
          ? 'Guided itinerary navigation bar'
          : lang === 'zh'
          ? '导览路线导航栏'
          : 'Thanh dẫn đường lộ trình tham quan'
      }
      className={`fixed z-30 w-[calc(100%-1.5rem)] max-w-[780px] rounded-2xl bg-[#161618]/92 backdrop-blur-2xl border border-[#C5A059]/45 shadow-[0_18px_48px_rgba(0,0,0,0.85)] overflow-hidden transition-all ${positionClassName}`}
    >
      {/* Thin Champagne Gold progress rail */}
      <div className="h-[2px] w-full bg-white/[0.08]">
        <div
          className="h-full bg-[#C5A059] transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        {/* Left: Route name + Step progress + Interactive Tip */}
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            <span className="inline-flex items-center gap-1 font-medium text-[#C5A059] whitespace-nowrap">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span>{localizedRoute.editorialTitle}</span>
            </span>
            <span className="text-white/25 hidden sm:inline">·</span>
            <span className="font-semibold text-[#F5F5F7] tabular-nums truncate">
              {lang === 'en'
                ? `Stop ${safeIndex + 1} / ${stops.length}: ${currentSiteName}`
                : lang === 'zh'
                ? `第 ${safeIndex + 1} / ${stops.length} 站：${currentSiteName}`
                : `Chặng ${safeIndex + 1} / ${stops.length}: ${currentSiteName}`}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-[#A1A1A6]">
            <Lightbulb className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
            <span className="truncate">{tipText}</span>
          </div>
        </div>

        {/* Right: Audio Guide + Next Stop / Complete + Exit */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onOpenAudioGuide(currentStop)}
            className="px-3 py-1.5 rounded-full bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.1] text-[#F5F5F7] text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Headphones className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
            <span>
              {lang === 'en'
                ? 'Audio Guide'
                : lang === 'zh'
                ? '语音导览'
                : 'Nghe thuyết minh'}
            </span>
          </button>

          <button
            type="button"
            onClick={onNextStep}
            className="px-3.5 py-1.5 rounded-full bg-[#C5A059] hover:bg-[#D5B26B] text-[#121110] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <span>
              {isLastStep
                ? lang === 'en'
                  ? 'Complete Journey'
                  : lang === 'zh'
                  ? '完成路线之旅'
                  : 'Hoàn thành hành trình'
                : lang === 'en'
                ? 'Next Monument →'
                : lang === 'zh'
                ? '下一处古迹 →'
                : 'Di tích tiếp theo →'}
            </span>
          </button>

          <button
            type="button"
            onClick={onExitTour}
            className="px-2.5 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.14] text-[#A1A1A6] hover:text-[#F5F5F7] text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
            title={
              lang === 'en'
                ? 'Exit guided mode'
                : lang === 'zh'
                ? '退出导览模式'
                : 'Thoát chế độ dẫn đường'
            }
          >
            {lang === 'en' ? '✕ Exit' : lang === 'zh' ? '✕ 退出' : '✕ Thoát tuyến'}
          </button>
        </div>
      </div>
    </aside>
  );
};

interface GuidedTourCompletionModalProps {
  completedRoute: { route: GuidedTourRoute; stopCount: number } | null;
  onClose: () => void;
  onGoToTicketsAndCertificate: () => void;
  onOpenFeedback: () => void;
}

export const GuidedTourCompletionModal: React.FC<GuidedTourCompletionModalProps> = ({
  completedRoute,
  onClose,
  onGoToTicketsAndCertificate,
  onOpenFeedback,
}) => {
  const { lang } = useI18n();

  if (!completedRoute) return null;

  const localizedRoute = getLocalizedGuidedRoute(completedRoute.route, lang);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={
        lang === 'en'
          ? 'Heritage Journey Completed'
          : lang === 'zh'
          ? '遗产探索路线已完成'
          : 'Hoàn thành Hành trình Di sản'
      }
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-[28px] bg-[#161618] border border-[#C5A059]/55 p-6 sm:p-8 text-[#F5F5F7] shadow-[0_32px_90px_rgba(0,0,0,0.92)] space-y-5 my-auto animate-apple-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#C5A059]/20 border border-[#C5A059]/50 flex items-center justify-center text-[#C5A059]">
            <Award className="w-6 h-6" />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={lang === 'en' ? 'Close' : lang === 'zh' ? '关闭' : 'Đóng'}
            className="w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.16] text-[#A1A1A6] hover:text-[#F5F5F7] flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>
              {lang === 'en'
                ? 'Synced completed itinerary to your profile & Admin Studio'
                : lang === 'zh'
                ? '已将路线完成记录同步至个人档案与管理后台'
                : 'Đã đồng bộ hoàn thành lộ trình vào hồ sơ & Admin Studio'}
            </span>
          </div>
          <h3 className="font-serif text-2xl sm:text-3xl font-medium text-[#F5F5F7]">
            {lang === 'en'
              ? 'You have completed the Heritage Journey'
              : lang === 'zh'
              ? '您已圆满完成本次遗产探索之旅'
              : 'Bạn đã hoàn thành Hành trình Di sản!'}
          </h3>
          <p className="text-xs sm:text-sm text-[#A1A1A6] leading-relaxed">
            {lang === 'en' ? (
              <>
                Congratulations on visiting all{' '}
                <strong className="text-[#F5F5F7] tabular-nums">
                  {completedRoute.stopCount} monument stops
                </strong>{' '}
                in <strong className="text-[#C5A059]">{localizedRoute.editorialTitle}</strong>.
              </>
            ) : lang === 'zh' ? (
              <>
                祝贺您完整游览了{' '}
                <strong className="text-[#C5A059]">{localizedRoute.editorialTitle}</strong> 的全部{' '}
                <strong className="text-[#F5F5F7] tabular-nums">
                  {completedRoute.stopCount} 处古迹站点
                </strong>
                。
              </>
            ) : (
              <>
                Chúc mừng bạn đã đi qua toàn bộ{' '}
                <strong className="text-[#F5F5F7] tabular-nums">
                  {completedRoute.stopCount} chặng di tích
                </strong>{' '}
                thuộc <strong className="text-[#C5A059]">{localizedRoute.editorialTitle}</strong>.
              </>
            )}
          </p>
        </div>

        <div className="space-y-2.5 pt-2">
          <button
            type="button"
            onClick={onGoToTicketsAndCertificate}
            className="w-full py-3 px-5 rounded-full bg-[#C5A059] hover:bg-[#D5B26B] text-[#121110] text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Ticket className="w-4 h-4 shrink-0" />
            <span>
              {lang === 'en'
                ? 'Claim Pass & Journey Certificate'
                : lang === 'zh'
                ? '领取数字门票与旅程证书'
                : 'Nhận Vé & Chứng nhận Hành trình'}
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenFeedback}
            className="w-full py-3 px-5 rounded-full bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.12] text-[#F5F5F7] text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Star className="w-4 h-4 text-[#C5A059] fill-[#C5A059] shrink-0" />
            <span>
              {lang === 'en'
                ? 'Submit Experience Feedback'
                : lang === 'zh'
                ? '提交游览体验评价'
                : 'Gửi đánh giá trải nghiệm'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

