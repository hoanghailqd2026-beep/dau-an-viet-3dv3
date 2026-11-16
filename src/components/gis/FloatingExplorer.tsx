import React, { useState, useMemo } from 'react';
import { HeritageSite, TourRoute } from '../../types/heritage';
import { TOUR_ROUTES } from '../../data/tours';
import { HERITAGE_SITES } from '../../data/heritageSites';
import { calculateTourDistanceKm } from '../../utils/coordinateConversion';
import { useI18n } from '../../i18n/I18nContext';
import {
  getIndochineCategoryMeta,
  getTourRouteIndochineColor,
  getHeritageColorBlock,
} from '../../utils/indochinePalette';
import { HeritageTypographicPlate } from '../common/HeritageTypographicPlate';
import { HeritageSmoothImage } from '../common/HeritageSmoothImage';
import {
  Search,
  X,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from 'lucide-react';

interface FloatingExplorerProps {
  sites: HeritageSite[];
  selectedSite: HeritageSite | null;
  onSelectSite: (site: HeritageSite) => void;
  onOpen3D: (site: HeritageSite) => void;
  onOpenARAudio: (site: HeritageSite) => void;
  onOpenDetailModal: (site: HeritageSite) => void;
  onOpenVideo?: (site: HeritageSite) => void;
  searchQuery: string;
  onSearchChange: (val: string) => void;
  filterRanking: string;
  onFilterRankingChange: (val: string) => void;
  filterDistrict: string;
  onFilterDistrictChange: (val: string) => void;
  filterType: string;
  onFilterTypeChange: (val: string) => void;
  filterTech: string;
  onFilterTechChange: (val: string) => void;
  uniqueDistricts: string[];
  totalSitesCount: number;
  hiddenSiteIds?: string[];
  activeTour?: TourRoute | null;
  onSelectTour?: (tour: TourRoute | null) => void;
}

interface ExplorerSiteCardProps {
  site: HeritageSite;
  idx: number;
  isSelected: boolean;
  officialName: string;
  chronologyYear: string | number;
  districtLabel: string;
  accentHex: string;
  badgeLabel: string;
  lang: 'vi' | 'en' | 'zh';
  isHiddenForVisitors?: boolean;
  onSelectSite: (site: HeritageSite) => void;
  onOpenDetailModal: (site: HeritageSite) => void;
  onOpen3D: (site: HeritageSite) => void;
  onOpenARAudio: (site: HeritageSite) => void;
  onOpenVideo?: (site: HeritageSite) => void;
}

const ExplorerSiteCard: React.FC<ExplorerSiteCardProps> = React.memo(({
  site,
  idx,
  isSelected,
  officialName,
  chronologyYear,
  districtLabel,
  accentHex,
  badgeLabel,
  lang,
  isHiddenForVisitors = false,
  onSelectSite,
  onOpenDetailModal,
  onOpen3D,
  onOpenARAudio,
  onOpenVideo,
}) => {
  const [imgFailed, setImgFailed] = React.useState(false);
  const rawPhoto = site.photos?.[0] || '';
  React.useEffect(() => {
    setImgFailed(false);
  }, [rawPhoto]);
  const hasRealPhoto = Boolean(rawPhoto && !imgFailed);

  const colorBlock = getHeritageColorBlock(site, lang);

  return (
  <div
    onClick={() => onSelectSite(site)}
    style={
      isSelected
        ? { backgroundColor: colorBlock.bg, color: colorBlock.fg, borderColor: '#171817' }
        : { borderLeftColor: colorBlock.bg, borderLeftWidth: '4px' }
    }
    className={`group p-3 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2.5 ${
      isSelected
        ? 'shadow-sm'
        : 'bg-[#EDE4D0] border-[#171817]/15 hover:bg-[#D8C9A9]/80 text-[#171817]'
    }`}
  >
    <div className="flex items-start gap-3">
      <div className="relative w-20 aspect-video shrink-0 rounded-xl bg-[#171817] border border-[#171817]/20 overflow-hidden">
        {hasRealPhoto ? (
          <>
            <HeritageSmoothImage
              src={rawPhoto}
              alt={officialName}
              loading="lazy"
              waitTone="dark"
              onError={() => setImgFailed(true)}
              className="w-full h-full object-cover object-center group-hover:scale-105 transition-[opacity,transform] duration-500"
            />
            <span
              className="absolute top-0.5 left-0.5 px-1.5 rounded-full bg-[#171817]/90 text-[#D8C9A9] text-[10px] font-semibold tabular-nums"
            >
              {String(idx + 1).padStart(2, '0')}
            </span>
          </>
        ) : (
          <HeritageTypographicPlate site={site} index={idx} variant="compact" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1.5">
          <span
            className="text-[11px] font-semibold tracking-normal truncate"
            style={{ color: isSelected ? colorBlock.fg : colorBlock.bg === '#C9A46A' ? '#171817' : colorBlock.bg }}
          >
            {badgeLabel}
          </span>
          <span
            className="text-[10px] shrink-0 tabular-nums opacity-75"
            style={{ color: isSelected ? colorBlock.fg : '#171817' }}
          >
            {site.identifierCode.split('-').slice(-1)[0]}
          </span>
        </div>

        <h3
          className="text-sm font-semibold transition-colors leading-snug line-clamp-1 mt-0.5"
          style={{ color: isSelected ? colorBlock.fg : '#171817' }}
        >
          {officialName}
        </h3>

        <div className="flex items-center justify-between gap-2 mt-0.5">
          <div
            className="text-[11px] truncate opacity-80"
            style={{ color: isSelected ? colorBlock.fg : '#171817' }}
          >
            {districtLabel} · {chronologyYear}
          </div>
          {isHiddenForVisitors && (
            <span className="px-2 py-0.5 rounded-full bg-[#171817] border border-[#C9A46A] text-[#C9A46A] text-[9px] font-semibold shrink-0">
              {lang === 'zh'
                ? '隐藏草稿 · 测试模式'
                : lang === 'en'
                ? 'Tester Preview · Hidden'
                : 'Đang ẩn · Chế độ Tester'}
            </span>
          )}
        </div>
      </div>
    </div>

    {isSelected && (
      <div
        className="pt-2 border-t flex items-center justify-between gap-2 text-[10.5px] font-medium"
        style={{ borderColor: colorBlock.fg === '#D8C9A9' ? 'rgba(216,201,169,0.28)' : 'rgba(23,24,23,0.2)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => onOpenDetailModal(site)}
          className="hover:underline cursor-pointer font-semibold"
          style={{ color: colorBlock.fg }}
        >
          {lang === 'vi' ? 'Hồ sơ ↗' : lang === 'zh' ? '档案 ↗' : 'Dossier ↗'}
        </button>
        <div className="flex items-center gap-1.5">
          {site.has3D && (
            <button
              type="button"
              onClick={() => onOpen3D(site)}
              className="px-2.5 py-1 rounded-full bg-[#171817] hover:bg-[#171817]/85 text-[#D8C9A9] cursor-pointer transition-colors font-semibold"
            >
              {lang === 'vi' ? 'Mở 3D ↗' : '3D ↗'}
            </button>
          )}
          <button
            type="button"
            onClick={() => onOpenARAudio(site)}
            className="px-2.5 py-1 rounded-full bg-[#F4EFE4] hover:bg-[#EDE4D0] text-[#171817] border border-[#171817]/20 cursor-pointer transition-colors"
          >
            {lang === 'vi' ? 'Thuyết minh' : lang === 'zh' ? '语音' : 'Audio'}
          </button>
          {onOpenVideo && (
            <button
              type="button"
              onClick={() => onOpenVideo(site)}
              className="px-2.5 py-1 rounded-full bg-[#C9A46A] hover:bg-[#b89256] text-[#171817] border border-[#171817]/20 cursor-pointer transition-colors font-semibold"
            >
              Video
            </button>
          )}
        </div>
      </div>
    )}
  </div>
  );
});

interface ExplorerRouteCardProps {
  tour: TourRoute;
  idx: number;
  visibleStopCount: number;
  distanceKm: number;
  isSelected: boolean;
  cleanTitle: string;
  lang: string;
  onSelectTour?: (tour: TourRoute | null) => void;
}

const ExplorerRouteCard: React.FC<ExplorerRouteCardProps> = React.memo(({
  tour,
  idx,
  visibleStopCount,
  distanceKm,
  isSelected,
  cleanTitle,
  lang,
  onSelectTour,
}) => {
  const routeColor = getTourRouteIndochineColor(tour);
  return (
  <button
    type="button"
    onClick={() => onSelectTour && onSelectTour(tour)}
    style={
      isSelected
        ? { backgroundColor: routeColor.primaryHex, color: routeColor.fgHex, borderColor: '#171817' }
        : { borderLeftColor: routeColor.primaryHex, borderLeftWidth: '4px' }
    }
    className={`w-full text-left p-3.5 rounded-2xl border transition-colors cursor-pointer flex items-start gap-3 ${
      isSelected
        ? 'shadow-sm'
        : 'bg-[#EDE4D0] border-[#171817]/15 hover:bg-[#D8C9A9]/80 text-[#171817]'
    }`}
  >
    <span
      className={`mt-0.5 w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 tabular-nums border ${
        isSelected
          ? 'bg-[#171817] text-[#D8C9A9] border-[#171817]'
          : 'bg-[#F4EFE4] text-[#171817] border-[#171817]/25'
      }`}
    >
      {String(idx + 1).padStart(2, '0')}
    </span>

    <div className="flex-1 min-w-0">
      <h3
        className="text-sm font-semibold leading-snug"
        style={{ color: isSelected ? routeColor.fgHex : '#171817' }}
      >
        {cleanTitle}
      </h3>
      <div
        className="mt-1 flex items-center gap-2 text-[11px] tabular-nums opacity-80"
        style={{ color: isSelected ? routeColor.fgHex : '#171817' }}
      >
        <span className="font-semibold">
          {visibleStopCount} {lang === 'vi' ? 'trạm' : lang === 'zh' ? '站' : 'stops'}
        </span>
        <span aria-hidden="true">•</span>
        <span>~{distanceKm} km</span>
      </div>
    </div>
  </button>
  );
});

export const FloatingExplorer: React.FC<FloatingExplorerProps> = React.memo(({
  sites,
  selectedSite,
  onSelectSite,
  onOpen3D,
  onOpenARAudio,
  onOpenDetailModal,
  onOpenVideo,
  searchQuery,
  onSearchChange,
  filterRanking,
  onFilterRankingChange,
  filterDistrict,
  onFilterDistrictChange,
  filterType,
  onFilterTypeChange,
  filterTech,
  onFilterTechChange,
  uniqueDistricts,
  totalSitesCount,
  hiddenSiteIds = [],
  activeTour = null,
  onSelectTour,
}) => {
  const { lang, t, getLocalizedSite, getLocalizedTour, formatDistrictName } = useI18n();
  const [isMobileCollapsed, setIsMobileCollapsed] = useState<boolean>(false);
  const [activeSubSection, setActiveSubSection] = useState<'sites' | 'routes'>('sites');

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    filterRanking !== 'all' ||
    filterDistrict !== 'all' ||
    filterType !== 'all' ||
    filterTech !== 'all';

  const resetAllFilters = () => {
    onSearchChange('');
    onFilterRankingChange('all');
    onFilterDistrictChange('all');
    onFilterTypeChange('all');
    onFilterTechChange('all');
  };

  const locActiveTour = activeTour ? getLocalizedTour(activeTour) : null;
  const activeTourColor = getTourRouteIndochineColor(activeTour);
  const visibleBaseSites = useMemo(
    () => HERITAGE_SITES.filter((s) => !hiddenSiteIds.includes(s.id)),
    [hiddenSiteIds]
  );

  return (
    <aside
      aria-label="Bảng điều khiển bản đồ di sản hợp nhất"
      className="w-full h-full bg-[#F4EFE4] flex flex-col z-20 select-none overflow-hidden text-[#171817] border-r border-[#171817]/15"
    >
      {/* 1. HEADER & SUB-TAB SWITCHER (DI TÍCH / LỘ TRÌNH) */}
      <div className="px-4 pt-3.5 pb-3 border-b border-[#171817]/12 bg-[#EDE4D0] shrink-0 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="block text-[12px] tracking-normal text-[#A94F3D] font-semibold">
              {lang === 'vi'
                ? 'Định vị không gian liên vùng'
                : lang === 'zh'
                ? '跨区域空间遗产名录'
                : 'Spatial heritage directory'}
            </span>
            <h2 className="text-lg font-serif font-semibold text-[#171817] tracking-tight mt-0.5 tabular-nums">
              {lang === 'vi'
                ? `Danh mục (${sites.length}/${totalSitesCount})`
                : lang === 'zh'
                ? `名录 (${sites.length}/${totalSitesCount})`
                : `Directory (${sites.length}/${totalSitesCount})`}
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setIsMobileCollapsed((p) => !p)}
            className="lg:hidden px-3 py-1 rounded-full bg-[#D8C9A9] border border-[#171817]/20 text-[10px] font-medium text-[#171817] flex items-center gap-1 cursor-pointer"
          >
            <span>{isMobileCollapsed ? (lang === 'vi' ? 'Mở danh sách' : 'Expand') : (lang === 'vi' ? 'Thu gọn' : 'Collapse')}</span>
            {isMobileCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Segmented Switcher: Danh sách Di tích | Tuyến Hành Trình */}
        <div className="grid grid-cols-2 p-1 rounded-full bg-[#D8C9A9] border border-[#171817]/15">
          <button
            type="button"
            onClick={() => setActiveSubSection('sites')}
            className={`py-1.5 px-2 rounded-full text-[11px] font-semibold transition-colors cursor-pointer ${
              activeSubSection === 'sites'
                ? 'bg-[#171817] text-[#D8C9A9]'
                : 'text-[#171817]/70 hover:text-[#171817]'
            }`}
          >
            {lang === 'vi' ? `Điểm Di Tích (${sites.length})` : lang === 'zh' ? `遗迹点 (${sites.length})` : `Sites (${sites.length})`}
          </button>
          <button
            type="button"
            onClick={() => setActiveSubSection('routes')}
            className={`py-1.5 px-2 rounded-full text-[11px] font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
              activeSubSection === 'routes'
                ? 'bg-[#171817] text-[#D8C9A9]'
                : 'text-[#171817]/70 hover:text-[#171817]'
            }`}
          >
            <span>
              {lang === 'vi'
                ? `Lộ Trình (${TOUR_ROUTES.length})`
                : lang === 'zh'
                ? `路线 (${TOUR_ROUTES.length})`
                : `Routes (${TOUR_ROUTES.length})`}
            </span>
            {activeTour && (
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: activeSubSection === 'routes' ? '#C9A46A' : activeTourColor.primaryHex }}
              />
            )}
          </button>
        </div>
      </div>

      {/* Collapsible Content Area */}
      <div
        className={`${
          isMobileCollapsed ? 'hidden lg:flex' : 'flex'
        } flex-1 flex-col min-h-0 max-lg:max-h-[42vh] overflow-hidden`}
      >
        {activeSubSection === 'sites' ? (
          <>
            {/* 2. UNIFIED SEARCH & SEGMENTED FILTERS */}
            <div className="p-3.5 border-b border-[#171817]/12 bg-[#F4EFE4] space-y-2.5 shrink-0">
              {/* Search Input */}
              <div className="relative rounded-full border border-[#171817]/20 bg-[#EDE4D0] focus-within:border-[#A94F3D]">
                <Search className="w-3.5 h-3.5 text-[#171817]/60 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={t('explorer.searchPlaceholder')}
                  className="w-full pl-9 pr-8 py-2 bg-transparent text-xs text-[#171817] placeholder-[#171817]/50 focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => onSearchChange('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#171817]/60 hover:text-[#171817] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Segmented Ranking Filter Bar */}
              <div className="grid grid-cols-4 p-0.5 rounded-full bg-[#EDE4D0] border border-[#171817]/15">
                {[
                  { id: 'all', label: lang === 'vi' ? 'Tất cả' : lang === 'zh' ? '全部' : 'All' },
                  { id: 'Special National', label: lang === 'vi' ? 'ĐB QG' : lang === 'zh' ? '特级' : 'Special' },
                  { id: 'National', label: lang === 'vi' ? 'Quốc gia' : lang === 'zh' ? '国家级' : 'National' },
                  { id: 'City Level', label: lang === 'vi' ? 'Cấp TP' : lang === 'zh' ? '市级' : 'City' },
                ].map((rank) => {
                  const active = filterRanking === rank.id;
                  return (
                    <button
                      key={rank.id}
                      type="button"
                      onClick={() => onFilterRankingChange(active && rank.id !== 'all' ? 'all' : rank.id)}
                      className={`py-1.5 px-1 rounded-full text-[10px] font-medium transition-colors cursor-pointer truncate ${
                        active
                          ? 'bg-[#A94F3D] text-[#D8C9A9] font-semibold'
                          : 'text-[#171817]/70 hover:text-[#171817]'
                      }`}
                    >
                      {rank.label}
                    </button>
                  );
                })}
              </div>

              {/* Row: District Select + Category Select + Reset */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 min-w-0 rounded-full border border-[#171817]/20 bg-[#EDE4D0]">
                  <select
                    value={filterDistrict}
                    onChange={(e) => onFilterDistrictChange(e.target.value)}
                    className="w-full appearance-none bg-transparent text-[#171817] pl-3 pr-7 py-1.5 text-[11px] focus:outline-none cursor-pointer truncate"
                  >
                    <option value="all" className="bg-[#F4EFE4] text-[#171817]">
                      {lang === 'vi' ? 'Khu vực: Tất cả' : lang === 'zh' ? '全部区域' : 'All Areas'}
                    </option>
                    {uniqueDistricts.map((d) => (
                      <option key={d} value={d} className="bg-[#F4EFE4] text-[#171817]">
                        {formatDistrictName(d)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 text-[#171817]/60 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                <div className="relative flex-1 min-w-0 rounded-full border border-[#171817]/20 bg-[#EDE4D0]">
                  <select
                    value={filterType}
                    onChange={(e) => onFilterTypeChange(e.target.value)}
                    className="w-full appearance-none bg-transparent text-[#171817] pl-3 pr-7 py-1.5 text-[11px] focus:outline-none cursor-pointer truncate"
                  >
                    <option value="all" className="bg-[#F4EFE4] text-[#171817]">
                      {lang === 'vi' ? 'Loại hình: Tất cả' : lang === 'zh' ? '全部类别' : 'All Types'}
                    </option>
                    <option value="Architecture" className="bg-[#F4EFE4] text-[#171817]">
                      {t('types.Architecture')}
                    </option>
                    <option value="History" className="bg-[#F4EFE4] text-[#171817]">
                      {t('types.History')}
                    </option>
                    <option value="Archaeology" className="bg-[#F4EFE4] text-[#171817]">
                      {t('types.Archaeology')}
                    </option>
                  </select>
                  <ChevronDown className="w-3 h-3 text-[#171817]/60 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="w-7 h-7 rounded-full border border-[#A94F3D] bg-[#A94F3D] text-[#D8C9A9] hover:bg-[#934232] flex items-center justify-center cursor-pointer shrink-0"
                    title="Đặt lại bộ lọc"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* 3. ACTIVE ROUTE SUMMARY BOX */}
            {activeTour && locActiveTour && (
              <div
                className="px-3.5 py-2.5 bg-[#EDE4D0] border-b border-[#171817]/15 flex items-center justify-between gap-2 shrink-0"
                style={{ borderLeft: `4px solid ${activeTourColor.primaryHex}` }}
              >
                <div className="min-w-0">
                  <span className="block text-[11px] tracking-normal font-semibold text-[#A94F3D]">
                    {lang === 'vi'
                      ? 'Lộ trình đang bật trên bản đồ'
                      : lang === 'zh'
                      ? '当前地图路线'
                      : 'Active map route'}
                  </span>
                  <div className="text-sm font-semibold text-[#171817] truncate">
                    {locActiveTour.title}
                  </div>
                </div>
                {onSelectTour && (
                  <button
                    type="button"
                    onClick={() => onSelectTour(null)}
                    className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-[#171817] text-[#D8C9A9] hover:bg-[#A94F3D] cursor-pointer shrink-0 transition-colors"
                  >
                    {lang === 'vi' ? 'Tắt tuyến' : lang === 'zh' ? '关闭路线' : 'Clear'}
                  </button>
                )}
              </div>
            )}

            {/* 4. SCROLLABLE HERITAGE SITES LIST */}
            <div className="flex-1 overflow-y-auto modal-scrollbar p-2.5 space-y-2 bg-[#F4EFE4]">
              {sites.length > 0 ? (
                sites.map((site, idx) => {
                  const isSelected = selectedSite?.id === site.id;
                  const locSite = getLocalizedSite(site);
                  const meta = getIndochineCategoryMeta(site, lang);

                  return (
                    <ExplorerSiteCard
                      key={site.id}
                      site={site}
                      idx={idx}
                      isSelected={isSelected}
                      officialName={locSite.officialName}
                      chronologyYear={site.commencementYear || locSite.chronology.split('(')[0].trim()}
                      districtLabel={formatDistrictName(site.address.district)}
                      accentHex={meta.accentHex}
                      badgeLabel={meta.badgeLabel}
                      lang={lang}
                      isHiddenForVisitors={hiddenSiteIds.includes(site.id)}
                      onSelectSite={onSelectSite}
                      onOpenDetailModal={onOpenDetailModal}
                      onOpen3D={onOpen3D}
                      onOpenARAudio={onOpenARAudio}
                      onOpenVideo={onOpenVideo}
                    />
                  );
                })
              ) : (
                <div className="p-8 text-center space-y-2.5">
                  <p className="text-sm text-[#171817]">
                    {t('explorer.emptyTitle')}
                  </p>
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="px-4 py-1.5 rounded-full bg-[#A94F3D] text-[#D8C9A9] text-xs font-semibold cursor-pointer"
                  >
                    {t('explorer.clearFilterBtn')}
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          /* CHẾ ĐỘ CHỌN NHANH LỘ TRÌNH DI SẢN */
          <div className="flex-1 overflow-y-auto modal-scrollbar p-3.5 space-y-2.5 bg-[#F4EFE4]">
            {TOUR_ROUTES.map((tour, idx) => {
              const isSelected = activeTour?.id === tour.id;
              const locTour = getLocalizedTour(tour);
              const cleanTitle = locTour.title.replace(/^(Tuyến|Route|路线)\s*\d+\s*[—:-]\s*/i, '');
              const visibleStopCount = tour.sites.filter((id) =>
                visibleBaseSites.some((s) => s.id === id)
              ).length;
              const distanceKm = calculateTourDistanceKm(tour, visibleBaseSites);

              return (
                <ExplorerRouteCard
                  key={tour.id}
                  tour={tour}
                  idx={idx}
                  visibleStopCount={visibleStopCount || tour.sites.length}
                  distanceKm={distanceKm || tour.distanceKm}
                  isSelected={isSelected}
                  cleanTitle={cleanTitle}
                  lang={lang}
                  onSelectTour={onSelectTour}
                />
              );
            })}
          </div>
        )}

        {/* 5. INLINE LEGEND FOOTER (4-PIGMENT HERITAGE PALETTE) */}
        <div className="px-4 py-2.5 border-t border-[#171817]/15 bg-[#EDE4D0] shrink-0">
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-[#171817]/80 font-medium">
            <div className="flex items-center gap-1.5 truncate">
              <span className="w-2.5 h-2.5 rounded-full bg-[#A94F3D] shrink-0" />
              <span className="truncate">
                {lang === 'vi'
                  ? 'Lịch sử & Hành chính'
                  : lang === 'zh'
                  ? '历史与行政遗迹'
                  : 'History & Civic'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 truncate">
              <span className="w-2.5 h-2.5 rounded-full bg-[#C9A46A] shrink-0 border border-[#171817]/20" />
              <span className="truncate">
                {lang === 'vi'
                  ? 'Bảo tàng & Kiến trúc'
                  : lang === 'zh'
                  ? '博物馆与建筑'
                  : 'Museum & Architecture'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 truncate">
              <span className="w-2.5 h-2.5 rounded-full bg-[#47796D] shrink-0" />
              <span className="truncate">
                {lang === 'vi'
                  ? 'Văn hóa & Nghệ thuật'
                  : lang === 'zh'
                  ? '文化与艺术'
                  : 'Culture & Art'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 truncate">
              <span className="w-2.5 h-2.5 rounded-full bg-[#526D8B] shrink-0" />
              <span className="truncate">
                {lang === 'vi'
                  ? 'Sông nước, Cảng & Biển'
                  : lang === 'zh'
                  ? '江海与港埠遗迹'
                  : 'River, Port & Sea'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
});
